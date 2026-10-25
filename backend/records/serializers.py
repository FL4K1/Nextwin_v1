from rest_framework import serializers
from .models import MedicalRecord, Consultation, ConsentRecord
from .media_service import CloudinaryMediaService


class MedicalRecordSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default='')
    file_url = serializers.SerializerMethodField()
    is_encrypted = serializers.SerializerMethodField()
    provider = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'file_url', 'is_encrypted', 'provider']

    def get_file_url(self, obj) -> str:
        """Return secure signed temporary Cloudinary URL or fallback to file_data URL."""
        if obj.cloudinary_public_id:
            return CloudinaryMediaService.get_signed_access_url(
                public_id=obj.cloudinary_public_id,
                resource_type=obj.cloudinary_resource_type or 'auto',
                access_type=obj.access_type or 'authenticated',
                expires_seconds=3600,
            )
        if isinstance(obj.file_data, dict):
            return obj.file_data.get('url', '')
        return ''

    def get_is_encrypted(self, obj) -> bool:
        return bool(obj.ipfs_hash or obj.access_type == 'authenticated')

    def get_provider(self, obj) -> str:
        if obj.created_by and obj.created_by.username:
            role = getattr(obj.created_by, 'role', '')
            return f"Dr. {obj.created_by.username}" if role == 'doctor' else obj.created_by.username
        return "NexTwin Health"


class ConsultationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.username', read_only=True)
    doctor_name = serializers.CharField(source='doctor.username', read_only=True)
    attachments_count = serializers.SerializerMethodField()

    class Meta:
        model = Consultation
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_attachments_count(self, obj) -> int:
        return obj.attachments.count() if hasattr(obj, 'attachments') else 0


class ConsentRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.username', read_only=True)
    grantee_name = serializers.CharField(source='grantee.username', read_only=True)

    class Meta:
        model = ConsentRecord
        fields = '__all__'
        read_only_fields = ['id', 'granted_at']
