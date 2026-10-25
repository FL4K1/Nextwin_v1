import io
import uuid
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from records.models import MedicalRecord, Consultation, ConsentRecord
from records.media_service import (
    CloudinaryMediaService, MediaCategory,
    CloudinaryNotConfiguredError, MediaValidationError, CloudinaryUploadError
)

User = get_user_model()


class CloudinaryMediaIntegrationTests(TestCase):
    """Comprehensive test suite for Cloudinary Media Integration."""

    def setUp(self):
        self.client = APIClient()

        # Patient 1
        self.patient1 = User.objects.create_user(
            username='patient1',
            password='testpassword123',
            role='patient',
            email='patient1@test.com'
        )

        # Patient 2 (Unauthorized stranger)
        self.patient2 = User.objects.create_user(
            username='patient2',
            password='testpassword123',
            role='patient',
            email='patient2@test.com'
        )

        # Doctor 1 (Assigned)
        self.doctor1 = User.objects.create_user(
            username='doctor1',
            password='testpassword123',
            role='doctor',
            email='doctor1@test.com'
        )

        # Doctor 2 (Unassigned)
        self.doctor2 = User.objects.create_user(
            username='doctor2',
            password='testpassword123',
            role='doctor',
            email='doctor2@test.com'
        )

        # Create valid consultation between doctor1 and patient1
        self.consultation = Consultation.objects.create(
            doctor=self.doctor1,
            patient=self.patient1,
            status='active'
        )

    # ─────────────────────────────────────────────────────────────
    # 1. Credentials & Configuration Tests
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='', CLOUDINARY_API_KEY='', CLOUDINARY_API_SECRET='', CLOUDINARY_URL='')
    def test_missing_cloudinary_credentials_returns_503(self):
        """When credentials are not configured, upload returns 503 Service Unavailable."""
        self.client.force_authenticate(user=self.patient1)
        valid_pdf = SimpleUploadedFile("report.pdf", b"%PDF-1.4 test document content", content_type="application/pdf")

        response = self.client.post('/api/patients/records/', {
            'title': 'Test CBC Report',
            'record_type': 'lab_report',
            'file': valid_pdf,
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("not configured", response.data.get('detail', '').lower())

    # ─────────────────────────────────────────────────────────────
    # 2. Upload Validation Tests (Type, Size, Empty)
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_invalid_file_type_rejected_with_400(self):
        """Disallowed file extension (e.g. .exe) is rejected with HTTP 400."""
        self.client.force_authenticate(user=self.patient1)
        invalid_file = SimpleUploadedFile("malicious.exe", b"MZexecutable content", content_type="application/octet-stream")

        response = self.client.post('/api/patients/records/', {
            'title': 'Malicious Executable',
            'record_type': 'lab_report',
            'file': invalid_file,
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("unsupported file format", response.data.get('detail', '').lower())

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret', MAX_UPLOAD_SIZE_MB=1)
    def test_oversized_file_rejected_with_400(self):
        """File exceeding MAX_UPLOAD_SIZE_MB is rejected with HTTP 400."""
        self.client.force_authenticate(user=self.patient1)
        # Create 2MB file when limit is 1MB
        oversized_data = b"%PDF-1.4 " + (b"0" * (2 * 1024 * 1024))
        oversized_file = SimpleUploadedFile("huge.pdf", oversized_data, content_type="application/pdf")

        response = self.client.post('/api/patients/records/', {
            'title': 'Oversized Lab Report',
            'record_type': 'lab_report',
            'file': oversized_file,
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds the allowed limit", response.data.get('detail', '').lower())

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_empty_file_rejected_with_400(self):
        """Empty 0-byte file is rejected with HTTP 400."""
        self.client.force_authenticate(user=self.patient1)
        empty_file = SimpleUploadedFile("empty.pdf", b"", content_type="application/pdf")

        response = self.client.post('/api/patients/records/', {
            'title': 'Empty Document',
            'record_type': 'lab_report',
            'file': empty_file,
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("empty", response.data.get('detail', '').lower())

    # ─────────────────────────────────────────────────────────────
    # 3. Successful Upload with Mocked Cloudinary SDK
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_successful_upload_with_mocked_cloudinary(self):
        """Valid file upload creates record and persists Cloudinary metadata."""
        self.client.force_authenticate(user=self.patient1)
        valid_pdf = SimpleUploadedFile("blood_test.pdf", b"%PDF-1.4 valid pdf content", content_type="application/pdf")

        mock_upload_result = {
            'public_id': 'nexttwin/records/test-uuid-1234',
            'version': 1714000000,
            'resource_type': 'raw',
            'format': 'pdf',
            'bytes': 28,
            'secure_url': 'https://res.cloudinary.com/test-cloud/raw/upload/v1714000000/nexttwin/records/test-uuid-1234.pdf',
            'original_filename': 'blood_test.pdf',
            'access_type': 'authenticated',
            'created_at': '2026-10-25T00:00:00Z',
        }

        with patch('records.media_service.CloudinaryMediaService.upload_file', return_value=mock_upload_result):
            response = self.client.post('/api/patients/records/', {
                'title': 'Complete Blood Count',
                'record_type': 'lab_report',
                'description': 'Normal platelet count',
                'file': valid_pdf,
            }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Complete Blood Count')
        self.assertEqual(response.data['cloudinary_public_id'], 'nexttwin/records/test-uuid-1234')
        self.assertEqual(response.data['access_type'], 'authenticated')
        self.assertTrue(response.data['is_encrypted'])

        # Verify database record exists
        record = MedicalRecord.objects.get(title='Complete Blood Count')
        self.assertEqual(str(record.patient_id), str(self.patient1.id))
        self.assertEqual(record.cloudinary_public_id, 'nexttwin/records/test-uuid-1234')

    # ─────────────────────────────────────────────────────────────
    # 4. Authentication & Object-Level Authorization Tests
    # ─────────────────────────────────────────────────────────────

    def test_unauthenticated_upload_rejected_with_401(self):
        """Unauthenticated requests are rejected with HTTP 401."""
        valid_pdf = SimpleUploadedFile("report.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        response = self.client.post('/api/patients/records/', {
            'title': 'Unauthorized Upload',
            'file': valid_pdf,
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patient_cannot_read_another_patients_records(self):
        """Patient2 cannot access Patient1's records (HTTP 403)."""
        # Create record belonging to patient1
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Confidential Lab Report',
            record_type='lab_report',
            cloudinary_public_id='nexttwin/records/secret-123',
            access_type='authenticated'
        )

        # Authenticate as patient2
        self.client.force_authenticate(user=self.patient2)
        response = self.client.get(f'/api/patients/{self.patient1.id}/records/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt direct detail retrieval
        response_detail = self.client.get(f'/api/records/{record.id}/')
        self.assertEqual(response_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_authorized_doctor_can_read_patient_record(self):
        """Assigned doctor can view patient records via consultation."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Consultation Vitals Summary',
            record_type='consultation_note',
            consultation=self.consultation,
            cloudinary_public_id='nexttwin/records/consult-123',
            access_type='authenticated'
        )

        # Authenticate as doctor1 (assigned)
        self.client.force_authenticate(user=self.doctor1)
        response = self.client.get(f'/api/patients/{self.patient1.id}/records/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', [])
        self.assertTrue(any(r['id'] == str(record.id) for r in results))

    def test_unassigned_doctor_cannot_read_patient_record(self):
        """Doctor2 (not assigned) cannot access patient1 records (HTTP 403)."""
        self.client.force_authenticate(user=self.doctor2)
        response = self.client.get(f'/api/patients/{self.patient1.id}/records/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ─────────────────────────────────────────────────────────────
    # 5. Temporary Signed Access URL Tests
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_authorized_access_returns_signed_url(self):
        """Authorized user receives a temporary signed access URL."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Private MRI Scan',
            record_type='imaging',
            file_name='mri.png',
            mime_type='image/png',
            cloudinary_public_id='nexttwin/records/mri-scan-999',
            access_type='authenticated'
        )

        self.client.force_authenticate(user=self.patient1)

        expected_signed_url = 'https://res.cloudinary.com/test-cloud/image/authenticated/s--signed--/nexttwin/records/mri-scan-999'

        with patch('records.media_service.CloudinaryMediaService.get_signed_access_url', return_value=expected_signed_url):
            response = self.client.get(f'/api/records/{record.id}/access/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['access_url'], expected_signed_url)
        self.assertEqual(response.data['expires_in'], 3600)
        self.assertEqual(response.data['file_name'], 'mri.png')
        self.assertIn('content_url', response.data)
        self.assertIn('download_url', response.data)

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_authorized_content_stream_returns_pdf(self):
        """Authorized user can stream medical record content via secure backend proxy."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Clinical Report',
            record_type='lab_report',
            file_name='report.pdf',
            mime_type='application/pdf',
            cloudinary_public_id='nexttwin/records/doc-123.pdf',
            cloudinary_resource_type='raw',
            access_type='authenticated'
        )

        self.client.force_authenticate(user=self.patient1)

        mock_stream_res = MagicMock()
        mock_stream_res.status_code = 200
        mock_stream_res.headers = {'Content-Type': 'application/pdf', 'Content-Length': '1024'}
        mock_stream_res.iter_content.return_value = [b"%PDF-1.4 mock content bytes"]

        with patch('records.media_service.CloudinaryMediaService.get_signed_access_url', return_value='https://api.cloudinary.com/signed-url'):
            with patch('requests.get', return_value=mock_stream_res):
                response = self.client.get(f'/api/records/{record.id}/content/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('inline', response['Content-Disposition'])
        self.assertIn('report.pdf', response['Content-Disposition'])

    def test_unauthorized_stranger_cannot_stream_content(self):
        """Stranger is rejected with HTTP 403 when trying to stream another patient's document."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Secret Report',
            record_type='lab_report',
            cloudinary_public_id='nexttwin/records/secret.pdf',
            access_type='authenticated'
        )

        self.client.force_authenticate(user=self.patient2)
        response = self.client.get(f'/api/records/{record.id}/content/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_stream_content(self):
        """Unauthenticated user is rejected with HTTP 401 when trying to stream document."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Secret Report',
            record_type='lab_report',
            cloudinary_public_id='nexttwin/records/secret.pdf',
            access_type='authenticated'
        )

        self.client.credentials()  # No token
        response = self.client.get(f'/api/records/{record.id}/content/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_content_stream_upstream_failure_returns_502(self):
        """Upstream Cloudinary network error returns sanitized HTTP 502."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Failure Test',
            record_type='lab_report',
            cloudinary_public_id='nexttwin/records/fail.pdf',
            access_type='authenticated'
        )

        self.client.force_authenticate(user=self.patient1)

        with patch('records.media_service.CloudinaryMediaService.get_signed_access_url', return_value='https://api.cloudinary.com/signed-url'):
            with patch('requests.get', side_effect=Exception("Connection refused")):
                response = self.client.get(f'/api/records/{record.id}/content/')

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn('failed to retrieve', response.data.get('detail', '').lower())

    @override_settings(CLOUDINARY_CLOUD_NAME='', CLOUDINARY_API_KEY='', CLOUDINARY_API_SECRET='', CLOUDINARY_URL='')
    def test_content_stream_unconfigured_cloudinary_returns_503(self):
        """Unconfigured Cloudinary returns HTTP 503 on content streaming."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Unconfigured Test',
            record_type='lab_report',
            cloudinary_public_id='nexttwin/records/unconf.pdf',
            access_type='authenticated'
        )

        self.client.force_authenticate(user=self.patient1)
        response = self.client.get(f'/api/records/{record.id}/content/')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    # ─────────────────────────────────────────────────────────────
    # 6. Cloudinary Upstream Failure & Timeout Handling
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_cloudinary_upload_timeout_returns_502(self):
        """Upstream Cloudinary network error/timeout returns sanitized HTTP 502."""
        self.client.force_authenticate(user=self.patient1)
        valid_pdf = SimpleUploadedFile("report.pdf", b"%PDF-1.4 test", content_type="application/pdf")

        with patch('records.media_service.CloudinaryMediaService.upload_file', side_effect=CloudinaryUploadError("Upload to media storage failed: Connection timeout to api.cloudinary.com")):
            response = self.client.post('/api/patients/records/', {
                'title': 'Timeout Test',
                'record_type': 'lab_report',
                'file': valid_pdf,
            }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn("media storage failed", response.data.get('detail', '').lower())
        # Verify no database record was created
        self.assertFalse(MedicalRecord.objects.filter(title='Timeout Test').exists())

    # ─────────────────────────────────────────────────────────────
    # 7. Database Failure After Upload Triggers Cleanup
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_database_failure_triggers_cloudinary_cleanup(self):
        """If database persistence fails after upload, Cloudinary asset is cleaned up."""
        self.client.force_authenticate(user=self.patient1)
        valid_pdf = SimpleUploadedFile("report.pdf", b"%PDF-1.4 test", content_type="application/pdf")

        mock_upload_result = {
            'public_id': 'nexttwin/records/orphan-test-123',
            'resource_type': 'raw',
            'access_type': 'authenticated',
            'original_filename': 'report.pdf',
            'bytes': 15,
        }

        with patch('records.media_service.CloudinaryMediaService.upload_file', return_value=mock_upload_result):
            with patch('records.models.MedicalRecord.objects.create', side_effect=Exception("Database lock/write failure")):
                with patch('records.media_service.CloudinaryMediaService.delete_asset') as mock_delete:
                    response = self.client.post('/api/patients/records/', {
                        'title': 'Cleanup Test',
                        'file': valid_pdf,
                    }, format='multipart')

                    self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
                    # Verify cleanup delete was called for the orphaned public_id
                    mock_delete.assert_called_once_with(
                        'nexttwin/records/orphan-test-123',
                        resource_type='raw',
                        access_type='authenticated'
                    )

    # ─────────────────────────────────────────────────────────────
    # 8. Deletion & Partial Failure Handling
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_successful_record_and_asset_deletion(self):
        """Deleting a record removes it from both Cloudinary and the database."""
        record = MedicalRecord.objects.create(
            patient=self.patient1,
            created_by=self.patient1,
            title='Record to Delete',
            record_type='lab_report',
            cloudinary_public_id='nexttwin/records/delete-me-123',
            access_type='authenticated'
        )

        self.client.force_authenticate(user=self.patient1)

        with patch('records.media_service.CloudinaryMediaService.delete_asset', return_value=True) as mock_delete:
            response = self.client.delete(f'/api/records/{record.id}/')

            self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
            mock_delete.assert_called_once_with(
                public_id='nexttwin/records/delete-me-123',
                resource_type='auto',
                access_type='authenticated'
            )
            self.assertFalse(MedicalRecord.objects.filter(id=record.id).exists())

    # ─────────────────────────────────────────────────────────────
    # 9. Avatar Upload Endpoint Tests
    # ─────────────────────────────────────────────────────────────

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_user_avatar_upload(self):
        """User can upload a profile avatar."""
        self.client.force_authenticate(user=self.patient1)
        valid_jpg = SimpleUploadedFile("avatar.jpg", b"\xff\xd8\xff\xe0" + b"avatar content", content_type="image/jpeg")

        mock_avatar_result = {
            'public_id': 'nexttwin/avatars/avatar-uuid-456',
            'secure_url': 'https://res.cloudinary.com/test-cloud/image/upload/v1/nexttwin/avatars/avatar-uuid-456.jpg',
        }

        with patch('records.media_service.CloudinaryMediaService.upload_file', return_value=mock_avatar_result):
            response = self.client.post('/api/auth/profile/avatar/', {
                'file': valid_jpg,
            }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['avatar_url'], mock_avatar_result['secure_url'])

        # Verify user avatar_url persisted in DB
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.avatar_url, mock_avatar_result['secure_url'])
        self.assertEqual(self.patient1.avatar_public_id, 'nexttwin/avatars/avatar-uuid-456')

    # -------------------------------------------------------------
    # 10. URL Generation Tests (private_download_url for Authenticated Assets)
    # -------------------------------------------------------------

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_signed_access_url_for_authenticated_raw_asset_uses_private_download(self):
        """Authenticated raw assets use private_download_url with empty format."""
        with patch('cloudinary.utils.private_download_url') as mock_private_download:
            mock_private_download.return_value = 'https://api.cloudinary.com/v1_1/test-cloud/raw/download?signed=1'
            url = CloudinaryMediaService.get_signed_access_url(
                public_id='nexttwin/records/test-doc.pdf',
                resource_type='raw',
                access_type='authenticated',
                expires_seconds=1800,
                attachment=False
            )
            self.assertEqual(url, 'https://api.cloudinary.com/v1_1/test-cloud/raw/download?signed=1')
            mock_private_download.assert_called_once()
            args, kwargs = mock_private_download.call_args
            self.assertEqual(kwargs.get('public_id') or (args[0] if args else None), 'nexttwin/records/test-doc.pdf')
            self.assertEqual(kwargs['resource_type'], 'raw')
            self.assertEqual(kwargs['type'], 'authenticated')
            self.assertEqual(kwargs['format'], '')
            self.assertFalse(kwargs['attachment'])

    @override_settings(CLOUDINARY_CLOUD_NAME='test-cloud', CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret')
    def test_signed_access_url_for_public_asset_uses_cloudinary_url(self):
        """Public assets use standard cloudinary_url helper."""
        with patch('cloudinary.utils.cloudinary_url') as mock_cld_url:
            mock_cld_url.return_value = ('https://res.cloudinary.com/test-cloud/image/upload/sample.jpg', {})
            url = CloudinaryMediaService.get_signed_access_url(
                public_id='sample.jpg',
                resource_type='image',
                access_type='upload'
            )
            self.assertEqual(url, 'https://res.cloudinary.com/test-cloud/image/upload/sample.jpg')
            mock_cld_url.assert_called_once()

    @override_settings(CLOUDINARY_CLOUD_NAME='', CLOUDINARY_API_KEY='', CLOUDINARY_API_SECRET='', CLOUDINARY_URL='')
    def test_signed_access_url_unconfigured_returns_empty(self):
        """When Cloudinary is unconfigured, get_signed_access_url safely returns empty string."""
        url = CloudinaryMediaService.get_signed_access_url(
            public_id='test.pdf',
            resource_type='raw',
            access_type='authenticated'
        )
        self.assertEqual(url, '')
