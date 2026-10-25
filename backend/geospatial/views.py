"""Geospatial Health Intelligence — proxies to AI Engine for location-aware insights."""
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
import httpx
import logging

logger = logging.getLogger(__name__)

def _get_ai_headers():
    token = getattr(settings, 'AI_ENGINE_INTERNAL_TOKEN', '')
    return {'X-Internal-Token': token} if token else {}


class GeospatialAnalysisView(APIView):
    """POST lat/lng → environmental risk + nearby facilities + emergency routing."""

    def post(self, request):
        lat = request.data.get('lat')
        lng = request.data.get('lng')

        if lat is None or lng is None:
            return Response({'error': 'lat and lng are required'}, status=400)

        try:
            response = httpx.post(
                f"{settings.AI_ENGINE_URL}/geospatial",
                json={
                    'patient_id': str(request.user.id),
                    'lat': float(lat),
                    'lng': float(lng),
                    'risk_scores': request.data.get('risk_scores', {}),
                },
                timeout=15,
                headers=_get_ai_headers(),
            )
            return Response(response.json())
        except Exception:
            # Fallback mock when AI engine offline
            return Response({
                'patient_id': str(request.user.id),
                'location': {'lat': lat, 'lng': lng},
                'nearby_facilities': [
                    {'name': 'AMTZ Medical Hub', 'type': 'hospital', 'distance_km': 2.1, 'eta_minutes': 6.3, 'services': ['cardiology', 'emergency']},
                    {'name': 'Apollo Clinic', 'type': 'clinic', 'distance_km': 3.4, 'eta_minutes': 10.2, 'services': ['general']},
                ],
                'environmental_risk': {'aqi': 65, 'aqi_category': 'Moderate', 'heat_index': 32.0, 'humidity_pct': 72, 'pollen_level': 'Low', 'risk_level': 'moderate'},
                'emergency_route': {'priority': 'STANDARD', 'recommended_facility': 'AMTZ Medical Hub', 'distance_km': 2.1, 'eta_minutes': 6.3, 'ambulance_recommended': False},
                'spatial_insights': ['Nearest facility: AMTZ Medical Hub (2.1 km, ~6.3 min).'],
                'status': 'ai_engine_offline_using_mock',
            })


class BehavioralAnalysisView(APIView):
    """POST vitals + voice text → stress, mood, activity readiness."""

    def post(self, request):
        try:
            response = httpx.post(
                f"{settings.AI_ENGINE_URL}/behavioral-analysis",
                json={
                    'patient_id': str(request.user.id),
                    'vitals': request.data.get('vitals', []),
                    'voice_text': request.data.get('voice_text', ''),
                    'sleep_hours': request.data.get('sleep_hours', 7.0),
                    'activity_minutes': request.data.get('activity_minutes', 30.0),
                },
                timeout=15,
                headers=_get_ai_headers(),
            )
            return Response(response.json())
        except Exception:
            return Response({
                'patient_id': str(request.user.id),
                'stress_index': 0.28,
                'mood': {'label': 'neutral', 'valence': 0.0, 'arousal': 0.5},
                'activity_readiness': 0.65,
                'sleep_quality': 0.88,
                'behavioral_risk_modifiers': {'cardiac': 1.04, 'hypertension': 1.03, 'overall_health': 0.97},
                'insights': ['Behavioral state within normal range — maintain current routine.'],
                'status': 'ai_engine_offline_using_mock',
            })


class PatientSimilarityView(APIView):
    """POST vitals → anonymized similar patient cohort + recommendations."""

    def post(self, request):
        try:
            response = httpx.post(
                f"{settings.AI_ENGINE_URL}/patient-similarity",
                json={
                    'patient_id': str(request.user.id),
                    'vitals': request.data.get('vitals', []),
                    'top_k': request.data.get('top_k', 3),
                },
                timeout=15,
                headers=_get_ai_headers(),
            )
            return Response(response.json())
        except Exception:
            return Response({
                'patient_id': str(request.user.id),
                'similar_patients': [
                    {'cohort_id': 'anon-0001', 'similarity_score': 0.91, 'shared_conditions': ['hypertension'], 'treatment_outcomes': ['Dietary sodium restriction lowered systolic by 8 mmHg']},
                ],
                'aggregated_recommendations': ['Maintain regular BP monitoring', 'Consider low-sodium diet'],
                'status': 'ai_engine_offline_using_mock',
            })


class FederatedStatusView(APIView):
    """GET federated learning round status."""

    def get(self, request):
        try:
            response = httpx.get(f"{settings.AI_ENGINE_URL}/federated/status", timeout=10)
            return Response(response.json())
        except Exception:
            return Response({
                'rounds_completed': 0,
                'active_participants': 0,
                'global_accuracy': 0.72,
                'privacy_guarantee': 'differential_privacy_epsilon=0.1',
                'aggregation_method': 'FedAvg',
                'status': 'ai_engine_offline',
            })
