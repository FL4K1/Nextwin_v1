from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from urllib.parse import parse_qs
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class JWTAuthMiddleware:
    """
    Custom middleware for Django Channels to authenticate users via JWT in the query string.
    Usage: ws://host:port/path/?token=<JWT_TOKEN>
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Extract token from query string
        query_params = parse_qs(scope['query_string'].decode())
        token = query_params.get('token')

        if token:
            try:
                # Validate the token
                access_token = AccessToken(token[0])
                # Access the user ID from the token payload (default is 'user_id')
                user_id = access_token['user_id']
                scope['user'] = await self.get_user(user_id)
                logger.info(f"WebSocket authenticated user: {scope['user']}")
            except Exception as e:
                logger.error(f"WebSocket JWT authentication failed: {str(e)}")
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()

        return await self.app(scope, receive, send)

    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()

def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
