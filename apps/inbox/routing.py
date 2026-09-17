from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<conversation_id>[a-f0-9-]+)/$', consumers.DirectChatConsumer.as_asgi()),
    re_path(r'ws/thread/(?P<thread_id>[a-f0-9-]+)/$', consumers.AnonymousThreadConsumer.as_asgi()),
    re_path(r'ws/notifications/(?P<user_id>[a-f0-9-]+)/$', consumers.NotificationConsumer.as_asgi()),
]
