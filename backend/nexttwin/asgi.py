import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexttwin.settings')

django_asgi = get_asgi_application()

from vitals.routing import websocket_urlpatterns as vitals_ws
from alerts.routing import websocket_urlpatterns as alerts_ws
from communication.routing import websocket_urlpatterns as communication_ws

from nexttwin.middleware import JWTAuthMiddlewareStack

application = ProtocolTypeRouter({
    'http': django_asgi,
    'websocket': JWTAuthMiddlewareStack(
        URLRouter(
            vitals_ws + alerts_ws + communication_ws
        )
    ),
})
