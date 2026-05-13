from django.contrib import admin
from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'recipient', 'preview', 'has_image', 'is_read', 'is_reported', 'created_at']
    list_filter = ['is_read', 'is_reported']
    search_fields = ['recipient__pseudo', 'text']
    readonly_fields = ['id', 'created_at', 'sender_ip', 'sender_device', 'sender_session_token']

    def id_short(self, obj):
        return str(obj.id)[:8] + '...'
    id_short.short_description = 'ID'

    def preview(self, obj):
        return obj.preview
    preview.short_description = 'Apercu'


