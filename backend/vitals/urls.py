from django.urls import path
from . import views

urlpatterns = [
    path('patients/vitals/', views.VitalListCreateView.as_view(), name='vitals-list-create'),
    path('patients/<uuid:patient_id>/vitals/', views.VitalListCreateView.as_view(), name='patient-vitals'),
    path('patients/vitals/latest/', views.VitalLatestView.as_view(), name='vitals-latest'),
    path('patients/<uuid:patient_id>/vitals/latest/', views.VitalLatestView.as_view(), name='patient-vitals-latest'),
    path('patients/vitals/timeline/', views.VitalTimelineView.as_view(), name='vitals-timeline'),
    path('patients/vitals/stats/', views.VitalStatsView.as_view(), name='vitals-stats'),
    path('patients/<uuid:patient_id>/vitals/stats/', views.VitalStatsView.as_view(), name='patient-vitals-stats'),
    path('patients/twin/', views.DigitalTwinView.as_view(), name='digital-twin'),
    path('patients/<uuid:patient_id>/twin/', views.DigitalTwinView.as_view(), name='patient-twin'),
    path('patients/twin/simulate/', views.DigitalTwinSimulateView.as_view(), name='twin-simulate'),
    path('googlefit/connect/', views.GoogleFitConnectView.as_view(), name='googlefit-connect'),
    path('googlefit/callback/', views.GoogleFitCallbackView.as_view(), name='googlefit-callback'),
    path('googlefit/sync/', views.GoogleFitSyncView.as_view(), name='googlefit-sync'),
    path('voice-log/', views.VoiceLogView.as_view(), name='voice-log'),
]
