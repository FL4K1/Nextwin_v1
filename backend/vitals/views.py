from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta
import random

from .models import Vital, DigitalTwinState
from .serializers import VitalSerializer, VitalCreateSerializer, DigitalTwinSerializer


class VitalListCreateView(generics.ListCreateAPIView):
    """List vitals for a patient or create new vital record."""

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return VitalCreateSerializer
        return VitalSerializer

    def get_queryset(self):
        patient_id = self.kwargs.get('patient_id', self.request.user.id)
        queryset = Vital.objects.filter(patient_id=patient_id)

        # Filter by metric type
        metric_type = self.request.query_params.get('metric_type')
        if metric_type:
            queryset = queryset.filter(metric_type=metric_type)

        # Filter by time range
        hours = self.request.query_params.get('hours')
        if hours:
            since = timezone.now() - timedelta(hours=int(hours))
            queryset = queryset.filter(recorded_at__gte=since)

        return queryset


class VitalLatestView(APIView):
    """Get latest vitals for each metric type for a patient."""

    def get(self, request, patient_id=None):
        pid = patient_id or request.user.id
        metrics = Vital.MetricType.values

        latest = []
        for metric in metrics:
            vital = Vital.objects.filter(
                patient_id=pid, metric_type=metric
            ).order_by('-recorded_at').first()
            if vital:
                latest.append(VitalSerializer(vital).data)

        return Response(latest)


class VitalTimelineView(APIView):
    """Get timeline of vitals for the last N hours."""

    def get(self, request, patient_id=None):
        pid = patient_id or request.user.id
        hours = int(request.query_params.get('hours', 24))
        since = timezone.now() - timedelta(hours=hours)

        vitals = Vital.objects.filter(
            patient_id=pid, recorded_at__gte=since
        ).order_by('recorded_at')

        return Response(VitalSerializer(vitals, many=True).data)


class DigitalTwinView(APIView):
    """Get or update digital twin state."""

    def get(self, request, patient_id=None):
        pid = patient_id or request.user.id
        twin, created = DigitalTwinState.objects.get_or_create(
            patient_id=pid,
            defaults={
                'risk_scores': _generate_mock_risk_scores(),
                'active_conditions': [],
                'predicted_events': _generate_mock_predictions(),
            }
        )
        return Response(DigitalTwinSerializer(twin).data)


class DigitalTwinSimulateView(APIView):
    """Run what-if simulation on the digital twin."""

    def post(self, request, patient_id=None):
        pid = patient_id or request.user.id
        scenario = request.data  # scenario is the full dict of boolean flags

        # Get current twin state for original risks
        twin = DigitalTwinState.objects.filter(patient_id=pid).first()
        original_risks = twin.risk_scores if twin else _generate_mock_risk_scores()

        results = _simulate_scenario(pid, scenario, original_risks)
        return Response(results)


class VoiceLogView(APIView):
    """Accept voice symptom log, forward to AI engine for structured insights, or use heuristic."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        text = request.data.get('text', '')
        try:
            token = getattr(settings, 'AI_ENGINE_INTERNAL_TOKEN', '')
            headers = {'X-Internal-Token': token} if token else {}
            response = httpx.post(
                f"{settings.AI_ENGINE_URL}/voice-log",
                json={
                    'patient_id': str(request.user.id),
                    'data': {'text': text},
                    'text': text,
                },
                headers=headers,
                timeout=15,
            )
            if response.status_code == 200:
                data = response.json()
                data['acknowledged'] = True
                return Response(data)
        except Exception:
            pass

        symptoms = [s.strip() for s in text.replace(',', ' and ').split(' and ') if s.strip()] if text else ['Voice symptom recorded']
        return Response({
            'status': 'logged',
            'text': text,
            'acknowledged': True,
            'extracted_symptoms': symptoms[:3],
            'severity': 'mild',
            'recommended_specialist': 'General Physician'
        })


class GoogleFitConnectView(APIView):
    """Initiate Google Fit OAuth2 connection."""

    def post(self, request):
        from .google_fit import get_oauth_url
        try:
            url, state = get_oauth_url()
            return Response({'authorization_url': url, 'state': state})
        except Exception as e:
            return Response(
                {'error': str(e), 'message': 'Google Fit credentials not configured. Using mock data.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )


class GoogleFitCallbackView(APIView):
    """Handle Google Fit OAuth2 callback."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        code = request.query_params.get('code')
        if not code:
            return Response({'error': 'No authorization code'}, status=400)

        from .google_fit import exchange_code
        from .models import GoogleFitToken

        try:
            credentials = exchange_code(code)
            GoogleFitToken.objects.update_or_create(
                user=request.user,
                defaults={
                    'access_token': credentials.token,
                    'refresh_token': credentials.refresh_token,
                    'token_expiry': credentials.expiry,
                    'scopes': ','.join(credentials.scopes or []),
                }
            )
            return Response({'message': 'Google Fit connected successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class GoogleFitSyncView(APIView):
    """Trigger Google Fit data sync or generate mock data."""

    def post(self, request):
        from .google_fit import generate_mock_data

        # For MVP: generate realistic mock data
        count = generate_mock_data(request.user.id, hours=24)

        # Update digital twin
        _update_digital_twin(request.user.id)

        return Response({
            'message': f'Synced {count} vitals data points',
            'count': count,
            'source': 'mock_data',
        })


class VitalStatsView(APIView):
    """Get aggregated vital statistics."""

    def get(self, request, patient_id=None):
        pid = patient_id or request.user.id
        hours = int(request.query_params.get('hours', 24))
        since = timezone.now() - timedelta(hours=hours)

        from django.db.models import Avg, Min, Max, Count
        metrics = ['heart_rate', 'spo2', 'bp_systolic', 'bp_diastolic', 'body_temp', 'steps']

        stats = {}
        for metric in metrics:
            agg = Vital.objects.filter(
                patient_id=pid, metric_type=metric, recorded_at__gte=since
            ).aggregate(
                avg=Avg('value'), min=Min('value'), max=Max('value'), count=Count('id')
            )
            if agg['count'] > 0:
                stats[metric] = {
                    'avg': round(agg['avg'], 1),
                    'min': round(agg['min'], 1),
                    'max': round(agg['max'], 1),
                    'count': agg['count'],
                }

        return Response(stats)


# --- Helpers ---

def _generate_mock_risk_scores():
    import random
    return {
        'cardiac': round(random.uniform(0.05, 0.35), 2),
        'diabetes': round(random.uniform(0.1, 0.4), 2),
        'respiratory': round(random.uniform(0.02, 0.2), 2),
        'hypertension': round(random.uniform(0.1, 0.5), 2),
        'stroke': round(random.uniform(0.01, 0.15), 2),
        'overall_health': round(random.uniform(0.6, 0.95), 2),
    }


def _generate_mock_predictions():
    return [
        {'event': 'Potential hypertension episode', 'probability': 0.23, 'timeframe': '7 days'},
        {'event': 'Sleep quality decline', 'probability': 0.15, 'timeframe': '3 days'},
        {'event': 'Elevated stress indicators', 'probability': 0.31, 'timeframe': '48 hours'},
    ]


def _simulate_scenario(patient_id, scenario, original_risks=None):
    """Simple rule-based what-if simulation for MVP."""
    if original_risks is None:
        original_risks = _generate_mock_risk_scores()

    adjusted = dict(original_risks)

    # Apply scenario modifiers
    if scenario.get('increase_exercise'):
        adjusted['cardiac'] = adjusted.get('cardiac', 0.2) * 0.8
        adjusted['diabetes'] = adjusted.get('diabetes', 0.3) * 0.7
        adjusted['overall_health'] = min(1.0, adjusted.get('overall_health', 0.7) * 1.1)

    if scenario.get('reduce_sodium'):
        adjusted['hypertension'] = adjusted.get('hypertension', 0.3) * 0.75
        adjusted['stroke'] = adjusted.get('stroke', 0.1) * 0.85

    if scenario.get('improve_sleep'):
        adjusted['cardiac'] = adjusted.get('cardiac', 0.2) * 0.9
        adjusted['overall_health'] = min(1.0, adjusted.get('overall_health', 0.7) * 1.05)

    if scenario.get('quit_smoking'):
        adjusted['cardiac'] = adjusted.get('cardiac', 0.2) * 0.75
        adjusted['respiratory'] = adjusted.get('respiratory', 0.1) * 0.6

    if scenario.get('medication_adherence'):
        for k in adjusted:
            if k != 'overall_health':
                adjusted[k] = adjusted[k] * 0.85

    # Compute metric deltas (physiological projections)
    metric_deltas = {
        'heart_rate': round(-2.5 if scenario.get('increase_exercise') else 0.5, 1),
        'blood_pressure': round(-5.0 if scenario.get('reduce_sodium') else 0.0, 1),
        'sleep_quality': round(+1.2 if scenario.get('improve_sleep') else -0.2, 1),
    }

    clinical_summaries = []
    if scenario.get('increase_exercise'):
        clinical_summaries.append('Regular cardio exercise 30 min/day can reduce cardiac risk by ~20%.')
    if scenario.get('reduce_sodium'):
        clinical_summaries.append('Reducing sodium intake may lower hypertension risk by ~25%.')
    if scenario.get('improve_sleep'):
        clinical_summaries.append('Consistent sleep schedule can boost overall health score by 5-10%.')
    if scenario.get('quit_smoking'):
        clinical_summaries.append('Cessation support programs reduce cardiac and respiratory risk significantly.')
    if scenario.get('medication_adherence'):
        clinical_summaries.append('Strict medication adherence can reduce most risk categories by ~15%.')
    if not clinical_summaries:
        clinical_summaries.append('Select interventions above to generate personalized projections.')

    return {
        'original_risks': {k: round(v, 3) for k, v in original_risks.items()},
        'adjusted_risks': {k: round(v, 3) for k, v in adjusted.items()},
        'metric_deltas': metric_deltas,
        'clinical_summary': clinical_summaries,
        'scenario': scenario,
        'model_version': 'rule-based-v0.2',
    }


def _update_digital_twin(patient_id):
    """Update digital twin state after new data."""
    DigitalTwinState.objects.update_or_create(
        patient_id=patient_id,
        defaults={
            'risk_scores': _generate_mock_risk_scores(),
            'predicted_events': _generate_mock_predictions(),
        }
    )
