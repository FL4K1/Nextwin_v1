import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model with healthcare-specific fields."""
    
    class Role(models.TextChoices):
        PATIENT = 'patient', 'Patient'
        DOCTOR = 'doctor', 'Doctor'
        ADMIN = 'admin', 'Admin'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PATIENT)
    did_identifier = models.CharField(max_length=255, blank=True, null=True, help_text='Ceramic DID')
    wallet_address = models.CharField(max_length=42, blank=True, null=True, help_text='Polygon wallet')
    language_pref = models.CharField(max_length=10, default='en')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    avatar_url = models.CharField(max_length=500, blank=True, default='')
    avatar_public_id = models.CharField(max_length=255, blank=True, default='')
    
    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.username} ({self.role})"


class PatientProfile(models.Model):
    """Extended profile for patients."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    full_name = models.CharField(max_length=255)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    blood_group = models.CharField(max_length=5, blank=True)
    height_cm = models.FloatField(null=True, blank=True)
    weight_kg = models.FloatField(null=True, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    rural_flag = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'patient_profiles'

    def __str__(self):
        return self.full_name


class DoctorProfile(models.Model):
    """Extended profile for doctors."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    full_name = models.CharField(max_length=255)
    specialization = models.CharField(max_length=100, blank=True)
    license_number = models.CharField(max_length=100, blank=True)
    hospital_affiliation = models.CharField(max_length=255, blank=True)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'doctor_profiles'

    def __str__(self):
        return f"Dr. {self.full_name} ({self.specialization})"
