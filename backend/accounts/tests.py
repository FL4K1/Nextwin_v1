from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AuthenticationFlowTests(TestCase):
    """Unit tests for authentication, JWT issuance, validation, and token refresh."""

    def setUp(self):
        self.client = APIClient()
        self.patient = User.objects.create_user(
            username='johndoe',
            email='johndoe@example.com',
            password='securepassword123',
            role='patient'
        )

    def test_login_with_username_succeeds(self):
        """User can log in using their username."""
        response = self.client.post('/api/auth/login/', {
            'username': 'johndoe',
            'password': 'securepassword123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'johndoe')
        self.assertEqual(response.data['user']['email'], 'johndoe@example.com')

    def test_login_with_email_succeeds(self):
        """User can log in using their email address."""
        response = self.client.post('/api/auth/login/', {
            'email': 'johndoe@example.com',
            'password': 'securepassword123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'johndoe')

    def test_login_with_email_in_username_field_succeeds(self):
        """User can enter email in the username field."""
        response = self.client.post('/api/auth/login/', {
            'username': 'johndoe@example.com',
            'password': 'securepassword123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['username'], 'johndoe')

    def test_login_with_wrong_password_returns_401(self):
        """Invalid password returns HTTP 401 Unauthorized."""
        response = self.client.post('/api/auth/login/', {
            'email': 'johndoe@example.com',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('no active account', response.data.get('detail', '').lower())

    def test_login_with_nonexistent_email_returns_401(self):
        """Non-existent email returns HTTP 401 Unauthorized."""
        response = self.client.post('/api/auth/login/', {
            'email': 'nonexistent@example.com',
            'password': 'anypassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_me_with_valid_token(self):
        """Protected /api/auth/me/ returns user info when valid Bearer token is provided."""
        login_res = self.client.post('/api/auth/login/', {
            'username': 'johndoe',
            'password': 'securepassword123'
        })
        access_token = login_res.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'johndoe')

    def test_access_me_unauthenticated_returns_401(self):
        """Protected endpoint returns HTTP 401 when no token is sent."""
        self.client.credentials()  # Clear credentials
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_me_with_invalid_token_returns_token_not_valid(self):
        """Tampered or invalid token returns HTTP 401 with token_not_valid code."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid.token.value')
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get('code'), 'token_not_valid')

    def test_token_refresh_flow(self):
        """Refresh token generates a new valid access token."""
        login_res = self.client.post('/api/auth/login/', {
            'username': 'johndoe',
            'password': 'securepassword123'
        })
        refresh_token = login_res.data['refresh']

        refresh_res = self.client.post('/api/auth/refresh/', {
            'refresh': refresh_token
        })
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        new_access = refresh_res.data.get('access')
        self.assertTrue(bool(new_access))

        # Verify new access token works
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access}')
        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)

    def test_user_registration_creates_profile_and_returns_tokens(self):
        """Registration creates user, role profile, and returns initial JWT tokens."""
        response = self.client.post('/api/auth/register/', {
            'username': 'newpatient',
            'email': 'newpatient@example.com',
            'password': 'newpatientpass123',
            'role': 'patient',
            'full_name': 'New Patient'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'newpatient')

        # Verify user can immediately query protected /api/auth/me/
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.data['username'], 'newpatient')
