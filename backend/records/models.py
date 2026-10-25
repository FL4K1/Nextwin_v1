import uuid
from django.db import models
from django.conf import settings


class MedicalRecord(models.Model):
    """Patient medical record with IPFS/blockchain linkage."""
    
    class RecordType(models.TextChoices):
        LAB_REPORT = 'lab_report', 'Lab Report'
        PRESCRIPTION = 'prescription', 'Prescription'
        DIAGNOSIS = 'diagnosis', 'Diagnosis'
        IMAGING = 'imaging', 'Imaging'
        CONSULTATION_NOTE = 'consultation_note', 'Consultation Note'
        DISCHARGE_SUMMARY = 'discharge_summary', 'Discharge Summary'
        VACCINATION = 'vaccination', 'Vaccination'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='medical_records')
    record_type = models.CharField(max_length=50, choices=RecordType.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    ipfs_hash = models.CharField(max_length=100, blank=True, help_text='IPFS CID')
    blockchain_tx = models.CharField(max_length=100, blank=True, help_text='Polygon tx hash')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_records'
    )
    file_data = models.JSONField(default=dict, blank=True, help_text='Encrypted local file data for MVP')
    cloudinary_public_id = models.CharField(max_length=255, blank=True, default='', help_text='Cloudinary asset public ID')
    cloudinary_resource_type = models.CharField(max_length=50, blank=True, default='auto', help_text='image or raw')
    file_name = models.CharField(max_length=255, blank=True, default='', help_text='Original file name')
    file_size = models.PositiveIntegerField(null=True, blank=True, help_text='File size in bytes')
    mime_type = models.CharField(max_length=100, blank=True, default='', help_text='File MIME type')
    access_type = models.CharField(max_length=20, default='authenticated', choices=[('authenticated', 'Authenticated'), ('upload', 'Public')])
    consultation = models.ForeignKey(
        'Consultation', on_delete=models.SET_NULL, null=True, blank=True, related_name='attachments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medical_records'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.record_type}) - {self.patient.username}"


class Consultation(models.Model):
    """Doctor-patient consultation session."""
    
    class Status(models.TextChoices):
        REQUESTED = 'requested', 'Requested'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patient_consultations')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doctor_consultations')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    livekit_room = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    prescription = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'consultations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Consultation: {self.patient.username} <-> {self.doctor.username} [{self.status}]"


class ConsentRecord(models.Model):
    """Data sharing consent record (mirrors blockchain)."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='consents_given')
    grantee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='consents_received')
    data_scope = models.JSONField(default=list, help_text='What data is shared')
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    blockchain_tx = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'consent_records'

    def __str__(self):
        status = 'revoked' if self.revoked_at else 'active'
        return f"Consent: {self.patient.username} -> {self.grantee.username} [{status}]"
