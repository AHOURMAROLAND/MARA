from django.contrib import admin
from .models import UserProfile, SessionLog


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['pseudo', 'link_id', 'accept_images', 'accept_messages', 'created_at']
    search_fields = ['pseudo', 'link_id']
    list_filter = ['accept_images', 'accept_messages']
    readonly_fields = ['id', 'created_at']


@admin.register(SessionLog)
class SessionLogAdmin(admin.ModelAdmin):
    list_display = ['token_short', 'session_type', 'user', 'ip_address', 'device_name', 'date_connexion', 'is_active']
    list_filter = ['session_type', 'is_active']
    search_fields = ['ip_address', 'device_name']
    readonly_fields = ['token', 'date_connexion']

    def token_short(self, obj):
        return obj.token[:12] + '...'
    token_short.short_description = 'Token'


