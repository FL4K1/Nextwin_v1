from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .serializers import (
    RegisterSerializer, UserSerializer, PatientProfileSerializer, DoctorProfileSerializer,
    CustomTokenObtainPairSerializer
)
from .models import PatientProfile, DoctorProfile

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """Register a new patient or doctor and return user info with initial JWT tokens."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Login view accepting username or email, returning JWT pair and user data."""
    serializer_class = CustomTokenObtainPairSerializer


class MeView(APIView):
    """Get current authenticated user info."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        data = serializer.data

        # Attach profile
        if request.user.role == 'patient' and hasattr(request.user, 'patient_profile'):
            data['profile'] = PatientProfileSerializer(request.user.patient_profile).data
        elif request.user.role == 'doctor' and hasattr(request.user, 'doctor_profile'):
            data['profile'] = DoctorProfileSerializer(request.user.doctor_profile).data

        return Response(data)


class PatientProfileView(generics.RetrieveUpdateAPIView):
    """Get/update patient profile."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PatientProfileSerializer

    def get_object(self):
        return PatientProfile.objects.get(user=self.request.user)


class DoctorProfileView(generics.RetrieveUpdateAPIView):
    """Get/update doctor profile."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DoctorProfileSerializer

    def get_object(self):
        return DoctorProfile.objects.get(user=self.request.user)


class AvailableDoctorsView(generics.ListAPIView):
    """List available doctors for consultation."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DoctorProfileSerializer
    queryset = DoctorProfile.objects.filter(available=True)


class AvatarUploadView(APIView):
    """Upload user avatar to Cloudinary."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('avatar')
        if not file_obj:
            return Response({'detail': 'No avatar image file was provided.'}, status=status.HTTP_400_BAD_REQUEST)

        from records.media_service import (
            CloudinaryMediaService, MediaCategory,
            MediaServiceError, CloudinaryNotConfiguredError, MediaValidationError
        )

        try:
            # 1. Validate and upload new avatar first
            result = CloudinaryMediaService.upload_file(file_obj, category=MediaCategory.AVATAR)
            new_url = result.get('secure_url', '')
            new_public_id = result.get('public_id', '')

            # 2. Record old public ID for cleanup after successful save
            old_public_id = request.user.avatar_public_id

            # 3. Save new avatar to user profile
            request.user.avatar_url = new_url
            request.user.avatar_public_id = new_public_id
            request.user.save(update_fields=['avatar_url', 'avatar_public_id'])

            # 4. Cleanup superseded avatar from storage
            if old_public_id and old_public_id != new_public_id:
                try:
                    CloudinaryMediaService.delete_asset(old_public_id, resource_type='image', access_type='upload')
                except Exception:
                    pass

            return Response({
                'message': 'Avatar uploaded successfully',
                'avatar_url': request.user.avatar_url,
                'user': UserSerializer(request.user).data
            }, status=status.HTTP_200_OK)

        except CloudinaryNotConfiguredError as e:
            return Response({'detail': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except MediaValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except MediaServiceError as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({'detail': 'An unexpected error occurred during avatar upload.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
