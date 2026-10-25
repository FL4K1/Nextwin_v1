from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AIBridgeTests(TestCase):
    """Test suite for authenticated AI Bridge gateway views."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testpatient',
            password='testpassword123',
            role='patient',
            email='patient@test.com'
        )

    def test_unauthenticated_requests_are_rejected_with_401(self):
        """Unauthenticated requests to AI bridge endpoints return HTTP 401."""
        self.assertEqual(self.client.post('/api/ai/predict/', {}).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post('/api/ai/risk-score/', {}).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get('/api/ai/risk-score/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post('/api/ai/scribe/', {}).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_predict_returns_predictions(self):
        """Authenticated user receives prediction structure."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/ai/predict/', {'vitals': [{'heart_rate': 78}]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('predictions', response.data)
        self.assertIn('patient_id', response.data)

    def test_authenticated_risk_score_via_get_and_post(self):
        """Authenticated user receives risk scores via both GET and POST."""
        self.client.force_authenticate(user=self.user)
        
        # Test POST
        res_post = self.client.post('/api/ai/risk-score/', {})
        self.assertEqual(res_post.status_code, status.HTTP_200_OK)
        self.assertIn('risk_scores', res_post.data)
        self.assertIn('cardiac', res_post.data['risk_scores'])

        # Test GET
        res_get = self.client.get('/api/ai/risk-score/')
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertIn('risk_scores', res_get.data)

    def test_authenticated_scribe_generates_summary(self):
        """Authenticated user receives clinical summary from consultation transcript."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/ai/scribe/', {
            'transcript': 'Patient reports severe headache and fever for two days with generalized fatigue.'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('summary', response.data)
        self.assertIn('symptoms', response.data)
        self.assertIn('recommendations', response.data)
