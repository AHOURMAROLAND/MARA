from django.contrib import admin
from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'is_read', 'is_reported', 'created_at')
    list_filter = ('is_read', 'is_reported', 'created_at')
    search_fields = ('recipient__pseudo',)
