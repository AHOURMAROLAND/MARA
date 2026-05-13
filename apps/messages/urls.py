from django.urls import path
from . import views

urlpatterns = [
    path('send/<str:link_id>/', views.send_message, name='send_message'),
    path('inbox/<str:link_id>/', views.inbox, name='inbox'),
    path('inbox/<str:link_id>/<uuid:msg_id>/', views.message_detail, name='message_detail'),
    path('inbox/<str:link_id>/<uuid:msg_id>/delete/', views.delete_message, name='delete_message'),
    path('inbox/<str:link_id>/<uuid:msg_id>/report/', views.report_message, name='report_message'),
    path('download/<uuid:msg_id>/', views.download_image, name='download_image'),
    path('inbox/<str:link_id>/<uuid:msg_id>/download-card/', views.download_message_card, name='download_message_card'),
]
