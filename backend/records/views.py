import uuid
import logging
from django.utils import timezone
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import MedicalRecord, Consultation, ConsentRecord
from .serializers import MedicalRecordSerializer, ConsultationSerializer, ConsentRecordSerializer
from .media_service import (
    CloudinaryMediaService, MediaCategory,
    MediaServiceError, CloudinaryNotConfiguredError,
    MediaValidationError, CloudinaryUploadError, CloudinaryDeleteError
)

import requests
from django.http import StreamingHttpResponse, HttpResponse

logger = logging.getLogger(__name__)


def is_authorized_for_patient(user, patient_id) -> bool:
    """Check if a user is authorized to access a patient's medical data."""
    if not user or not user.is_authenticated:
        return False
    if str(user.id) == str(patient_id):
        return True
    if user.is_staff or user.is_superuser:
        return True
    if getattr(user, 'role', '') == 'doctor':
        # Check active or historical consultation
        has_consultation = Consultation.objects.filter(doctor=user, patient_id=patient_id).exists()
        if has_consultation:
            return True
        # Check patient consent
        has_consent = ConsentRecord.objects.filter(
            grantee=user, patient_id=patient_id, revoked_at__isnull=True
        ).exists()
        return has_consent
    return False


class MedicalRecordListCreateView(APIView):
    """
    List or create patient medical records with optional Cloudinary file upload.
    Supports both JSON and multipart/form-data.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, patient_id=None):
        target_patient_id = patient_id or request.user.id

        if not is_authorized_for_patient(request.user, target_patient_id):
            raise PermissionDenied("You are not authorized to view these medical records.")

        queryset = MedicalRecord.objects.filter(patient_id=target_patient_id)

        # Optional filter by record type
        record_type = request.query_params.get('record_type')
        if record_type and record_type != 'all':
            queryset = queryset.filter(record_type=record_type)

        serializer = MedicalRecordSerializer(queryset, many=True)
        return Response({'results': serializer.data})

    def post(self, request, patient_id=None):
        target_patient_id = patient_id or request.data.get('patient_id') or request.user.id

        # Enforce that patients cannot create records for other users
        if getattr(request.user, 'role', '') == 'patient' and str(target_patient_id) != str(request.user.id):
            raise PermissionDenied("Patients cannot upload records for other users.")

        if not is_authorized_for_patient(request.user, target_patient_id):
            raise PermissionDenied("You are not authorized to create records for this patient.")

        uploaded_file = request.FILES.get('file')
        cloudinary_data = None

        if uploaded_file:
            # 1. First validate file content, size, and extension
            try:
                CloudinaryMediaService.validate_file(uploaded_file, category=MediaCategory.MEDICAL_RECORD)
            except MediaValidationError as e:
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            # 2. Check if Cloudinary is configured
            if not CloudinaryMediaService.is_configured():
                return Response(
                    {'detail': 'Cloudinary media service is not configured. Uploads are currently unavailable.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

            # 3. Perform upload
            try:
                cloudinary_data = CloudinaryMediaService.upload_file(
                    uploaded_file,
                    category=MediaCategory.MEDICAL_RECORD,
                    custom_filename=uploaded_file.name
                )
            except CloudinaryNotConfiguredError as e:
                return Response({'detail': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            except CloudinaryUploadError as e:
                return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
            except Exception as e:
                logger.error(f"Unexpected upload failure: {e}")
                return Response({'detail': 'Media upload failed due to an unexpected error.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            with transaction.atomic():
                title = request.data.get('title')
                if not title:
                    if uploaded_file:
                        title = uploaded_file.name
                    else:
                        title = "Medical Record"

                record_type = request.data.get('record_type', MedicalRecord.RecordType.LAB_REPORT)
                description = request.data.get('description', '')
                consultation_id = request.data.get('consultation') or request.data.get('consultation_id')

                consultation = None
                if consultation_id:
                    try:
                        consultation = Consultation.objects.get(id=consultation_id)
                    except (Consultation.DoesNotExist, ValueError):
                        pass

                record = MedicalRecord.objects.create(
                    patient_id=target_patient_id,
                    created_by=request.user,
                    title=title,
                    record_type=record_type,
                    description=description,
                    consultation=consultation,
                    cloudinary_public_id=cloudinary_data['public_id'] if cloudinary_data else '',
                    cloudinary_resource_type=cloudinary_data['resource_type'] if cloudinary_data else 'auto',
                    file_name=cloudinary_data['original_filename'] if cloudinary_data else '',
                    file_size=cloudinary_data['bytes'] if cloudinary_data else (uploaded_file.size if uploaded_file else None),
                    mime_type=getattr(uploaded_file, 'content_type', '') if uploaded_file else '',
                    access_type=cloudinary_data['access_type'] if cloudinary_data else 'authenticated',
                )

                serializer = MedicalRecordSerializer(record)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            # If database persistence fails after successful Cloudinary upload, cleanup asset to prevent orphans
            if cloudinary_data and cloudinary_data.get('public_id'):
                logger.warning(f"Database save failed; cleaning up Cloudinary asset {cloudinary_data['public_id']}")
                try:
                    CloudinaryMediaService.delete_asset(
                        cloudinary_data['public_id'],
                        resource_type=cloudinary_data.get('resource_type', 'image'),
                        access_type=cloudinary_data.get('access_type', 'authenticated')
                    )
                except Exception as del_err:
                    logger.error(f"Failed to cleanup orphaned Cloudinary asset: {del_err}")

            logger.error(f"Failed to persist medical record: {e}")
            return Response({'detail': 'Failed to save medical record to database.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MedicalRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a specific medical record."""
    serializer_class = MedicalRecordSerializer
    lookup_field = 'id'
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return MedicalRecord.objects.all()
        if getattr(user, 'role', '') == 'doctor':
            # Doctor can view records of patients they consult with or have consent for
            consultation_patients = Consultation.objects.filter(doctor=user).values_list('patient_id', flat=True)
            consent_patients = ConsentRecord.objects.filter(grantee=user, revoked_at__isnull=True).values_list('patient_id', flat=True)
            authorized_patient_ids = set(consultation_patients) | set(consent_patients)
            return MedicalRecord.objects.filter(patient_id__in=authorized_patient_ids) | MedicalRecord.objects.filter(patient=user)
        # Patient can only view their own records
        return MedicalRecord.objects.filter(patient=user)

    def perform_destroy(self, instance):
        # Enforce that only the record owner, creator, or admin can delete
        user = self.request.user
        if str(instance.patient_id) != str(user.id) and str(getattr(instance.created_by, 'id', '')) != str(user.id) and not user.is_staff:
            raise PermissionDenied("You do not have permission to delete this medical record.")

        # Delete from Cloudinary if asset exists
        if instance.cloudinary_public_id:
            try:
                CloudinaryMediaService.delete_asset(
                    public_id=instance.cloudinary_public_id,
                    resource_type=instance.cloudinary_resource_type or 'auto',
                    access_type=instance.access_type or 'authenticated'
                )
            except CloudinaryDeleteError as e:
                logger.error(f"Remote Cloudinary deletion failed for {instance.cloudinary_public_id}: {e}")

        instance.delete()


class MedicalRecordAccessView(APIView):
    """
    Get a temporary, fresh signed URL to view or download a private medical record.
    Valid for 1 hour.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        try:
            record = MedicalRecord.objects.get(id=id)
        except MedicalRecord.DoesNotExist:
            return Response({'detail': 'Medical record not found'}, status=status.HTTP_404_NOT_FOUND)

        if not is_authorized_for_patient(request.user, record.patient_id):
            raise PermissionDenied("You are not authorized to access this medical record.")

        content_url = f"/api/records/{record.id}/content/"
        download_url = f"/api/records/{record.id}/content/?download=true"

        if not record.cloudinary_public_id:
            # Fallback to local or IPFS data if no Cloudinary asset
            url = record.file_data.get('url', '') if isinstance(record.file_data, dict) else ''
            return Response({
                'access_url': url,
                'content_url': content_url,
                'download_url': download_url,
                'expires_in': 0,
                'file_name': record.file_name or record.title,
                'mime_type': record.mime_type
            })

        if not CloudinaryMediaService.is_configured():
            return Response(
                {'detail': 'Cloudinary media service is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        url = CloudinaryMediaService.get_signed_access_url(
            public_id=record.cloudinary_public_id,
            resource_type=record.cloudinary_resource_type or 'auto',
            access_type=record.access_type or 'authenticated',
            expires_seconds=3600
        )

        return Response({
            'access_url': url,
            'content_url': content_url,
            'download_url': download_url,
            'expires_in': 3600,
            'file_name': record.file_name or record.title,
            'mime_type': record.mime_type
        })


class MedicalRecordContentStreamView(APIView):
    """
    Secure backend proxy for medical record preview/download.
    Authenticates the patient/doctor, verifies ownership/consent,
    fetches the asset securely from Cloudinary, and streams it
    directly to the authorized client with appropriate headers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        try:
            record = MedicalRecord.objects.get(id=id)
        except MedicalRecord.DoesNotExist:
            return Response({'detail': 'Medical record not found'}, status=status.HTTP_404_NOT_FOUND)

        if not is_authorized_for_patient(request.user, record.patient_id):
            raise PermissionDenied("You are not authorized to access this medical record.")

        if not record.cloudinary_public_id:
            url = record.file_data.get('url', '') if isinstance(record.file_data, dict) else ''
            if url:
                return Response({'redirect_url': url})
            return Response({'detail': 'No file content found for this record.'}, status=status.HTTP_404_NOT_FOUND)

        if not CloudinaryMediaService.is_configured():
            return Response(
                {'detail': 'Cloudinary media service is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        is_download = request.query_params.get('download', '').lower() in {'true', '1'}
        signed_url = CloudinaryMediaService.get_signed_access_url(
            public_id=record.cloudinary_public_id,
            resource_type=record.cloudinary_resource_type or 'auto',
            access_type=record.access_type or 'authenticated',
            expires_seconds=3600,
            attachment=is_download,
        )

        if not signed_url:
            return Response({'detail': 'Failed to generate secure media access URL.'}, status=status.HTTP_502_BAD_GATEWAY)

        try:
            cld_res = requests.get(signed_url, stream=True, timeout=20)
            if cld_res.status_code != 200:
                logger.error(f"Cloudinary fetch failed: status {cld_res.status_code}, error: {cld_res.headers.get('x-cld-error')}")
                return Response({'detail': f"Upstream media delivery error: {cld_res.headers.get('x-cld-error', 'Access denied')}"}, status=status.HTTP_502_BAD_GATEWAY)

            content_type = cld_res.headers.get('Content-Type') or record.mime_type or 'application/octet-stream'
            file_name = record.file_name or f"medical_record_{record.id}"
            disposition_type = "attachment" if is_download else "inline"

            response = StreamingHttpResponse(
                cld_res.iter_content(chunk_size=8192),
                content_type=content_type,
                status=status.HTTP_200_OK
            )
            response['Content-Disposition'] = f'{disposition_type}; filename="{file_name}"'
            if 'Content-Length' in cld_res.headers:
                response['Content-Length'] = cld_res.headers['Content-Length']
            response['Cache-Control'] = 'private, max-age=3600'
            return response

        except Exception as e:
            logger.error(f"Error proxying Cloudinary asset: {e}")
            return Response({'detail': 'Failed to retrieve media asset from storage provider.'}, status=status.HTTP_502_BAD_GATEWAY)


class ConsultationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConsultationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'role', '') == 'doctor':
            return Consultation.objects.filter(doctor=user)
        return Consultation.objects.filter(patient=user)

    def perform_create(self, serializer):
        room_id = f"medgenie-{uuid.uuid4().hex[:12]}"
        serializer.save(patient=self.request.user, livekit_room=room_id)


class ConsultationDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ConsultationSerializer
    lookup_field = 'id'
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Consultation.objects.filter(patient=user) | Consultation.objects.filter(doctor=user)


class ConsultationRoomView(APIView):
    """Get LiveKit room token for consultation."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        try:
            consultation = Consultation.objects.get(id=id)
        except Consultation.DoesNotExist:
            return Response({'detail': 'Consultation not found'}, status=status.HTTP_404_NOT_FOUND)

        if str(consultation.patient_id) != str(request.user.id) and str(consultation.doctor_id) != str(request.user.id) and not request.user.is_staff:
            raise PermissionDenied("You are not a participant in this consultation.")

        return Response({
            'room': consultation.livekit_room,
            'token': f"mock-token-{consultation.livekit_room}",
            'url': 'ws://localhost:7880',
        })
