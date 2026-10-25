from django.urls import path
from . import views

urlpatterns = [
    path('patients/records/', views.MedicalRecordListCreateView.as_view(), name='records-list'),
    path('patients/<uuid:patient_id>/records/', views.MedicalRecordListCreateView.as_view(), name='patient-records'),
    path('records/<uuid:id>/', views.MedicalRecordDetailView.as_view(), name='record-detail'),
    path('records/<uuid:id>/access/', views.MedicalRecordAccessView.as_view(), name='record-access'),
    path('records/<uuid:id>/content/', views.MedicalRecordContentStreamView.as_view(), name='record-content'),
    path('consultations/', views.ConsultationListCreateView.as_view(), name='consultations-list'),
    path('consultations/<uuid:id>/', views.ConsultationDetailView.as_view(), name='consultation-detail'),
    path('consultations/<uuid:id>/room/', views.ConsultationRoomView.as_view(), name='consultation-room'),
]
