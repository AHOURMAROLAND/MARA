from django.urls import path
from django.views.generic import TemplateView
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('create/', views.create_profile, name='create_profile'),
    path('login/', views.login_with_pin, name='login_with_pin'),
    path('u/<str:link_id>/', views.profile_share, name='profile_share'),
    path('u/<str:link_id>/settings/', views.profile_settings, name='profile_settings'),
    path('logout/', views.logout_view, name='logout'),
    path('api/reconnect/', views.reconnect_session, name='reconnect_session'),
    path('terms/', TemplateView.as_view(template_name="terms.html"), name='terms'),
    path('privacy/', TemplateView.as_view(template_name="privacy.html"), name='privacy'),
]
