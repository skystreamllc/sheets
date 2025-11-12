"""
ASGI config for sheets_project project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sheets_project.settings')

# Инициализируем Django приложение ДО импорта routing
django_asgi_app = get_asgi_application()

# Теперь можно импортировать routing, так как Django настроен
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import sheets.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            sheets.routing.websocket_urlpatterns
        )
    ),
})
