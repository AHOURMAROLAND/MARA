from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_group, name='create_group'),
    path('g/<str:link_id>/', views.group_chat, name='group_chat'),
    path('g/<str:link_id>/settings/', views.group_settings, name='group_settings'),
    path('api/g/<str:link_id>/send/', views.send_group_message, name='api_send_group_message'),
    path('api/g/<str:link_id>/messages/', views.get_group_messages, name='api_get_group_messages'),
    path('api/g/<str:link_id>/toggle-write/<int:participant_id>/', views.toggle_participant_write, name='api_toggle_participant_write'),
    path('api/g/<str:link_id>/delete-user/<int:participant_id>/', views.delete_participant, name='api_delete_participant'),
]
