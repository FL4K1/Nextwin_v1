from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'healthy', 'service': 'nexttwin-api'})

urlpatterns = [
    path('', health_check, name='root-health'),
    path('health/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('vitals.urls')),
    path('api/', include('records.urls')),
    path('api/', include('alerts.urls')),
    path('api/ai/', include('ai_bridge.urls')),
    path('api/comm/', include('communication.urls')),
    path('api/', include('geospatial.urls')),
]
