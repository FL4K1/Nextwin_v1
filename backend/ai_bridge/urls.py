from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.PredictView.as_view(), name='ai-predict'),
    path('risk-score/', views.RiskScoreView.as_view(), name='ai-risk-score'),
    path('scribe/', views.ScribeView.as_view(), name='ai-scribe'),
]
