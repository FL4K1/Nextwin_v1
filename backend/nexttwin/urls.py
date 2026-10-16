from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('vitals.urls')),
    path('api/', include('records.urls')),
    path('api/', include('alerts.urls')),
    path('api/ai/', include('ai_bridge.urls')),
    path('api/comm/', include('communication.urls')),
    path('api/', include('geospatial.urls')),
]
