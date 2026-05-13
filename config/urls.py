from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from apps.users import views as user_views
from apps.inbox import views as inbox_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('apps.users.urls')),
    path('m/', include('apps.inbox.urls')),
    path('groups/', include('apps.groups.urls')),
    path('api/check-messages/', inbox_views.check_new_messages, name='api_check_messages'),
    path('api/push/subscribe/', user_views.push_subscribe, name='push_subscribe'),
    path('api/push/unsubscribe/', user_views.push_unsubscribe, name='push_unsubscribe'),
    
    # PWA Support at Root
    path('service-worker.js', TemplateView.as_view(
        template_name="js/service-worker.js",
        content_type='application/javascript',
    ), name='service-worker'),
    path('manifest.json', TemplateView.as_view(
        template_name="manifest.json",
        content_type='application/json',
    ), name='manifest'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
