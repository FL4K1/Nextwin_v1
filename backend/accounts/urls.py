from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.MeView.as_view(), name='me'),
    path('patient/profile/', views.PatientProfileView.as_view(), name='patient-profile'),
    path('doctor/profile/', views.DoctorProfileView.as_view(), name='doctor-profile'),
    path('doctors/available/', views.AvailableDoctorsView.as_view(), name='available-doctors'),
    path('profile/avatar/', views.AvatarUploadView.as_view(), name='profile-avatar'),
]
