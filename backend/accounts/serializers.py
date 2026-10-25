from rest_framework import serializers, exceptions
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import PatientProfile, DoctorProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'language_pref', 'wallet_address', 'did_identifier', 'phone_number', 'avatar_url']
        read_only_fields = ['id']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Enhanced SimpleJWT serializer that allows authentication via either
    username OR email address. Returns access, refresh, and user profile data.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields['email'] = serializers.EmailField(required=False)

    def validate(self, attrs):
        username = attrs.get('username')
        email = attrs.get('email')

        # 1. If username was not provided but email was provided
        if not username and email:
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                raise exceptions.AuthenticationFailed(
                    self.error_messages['no_active_account'],
                    'no_active_account',
                )
            attrs['username'] = user.username
        # 2. If username contains '@', treat as email lookup
        elif username and '@' in username:
            user = User.objects.filter(email__iexact=username).first()
            if user:
                attrs['username'] = user.username

        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(write_only=True, required=False, default="")

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'full_name', 'phone_number', 'language_pref']

    def create(self, validated_data):
        full_name = validated_data.pop('full_name', '')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)

        # Use username as fallback for full_name
        display_name = full_name or user.username

        # Auto-create profile based on role
        if user.role == User.Role.PATIENT:
            PatientProfile.objects.create(user=user, full_name=display_name)
        elif user.role == User.Role.DOCTOR:
            DoctorProfile.objects.create(user=user, full_name=display_name)

        return user


class PatientProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = PatientProfile
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class DoctorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = DoctorProfile
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
