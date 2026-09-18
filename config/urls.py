from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from apps.users import views as user_views
from apps.inbox import views as inbox_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.api.urls')),
    # Apps urls will be refactored to APIs later if needed, but for now we remove HTML includes
    # path('', include('apps.users.urls')),
    # path('m/', include('apps.inbox.urls')),
    # path('groups/', include('apps.groups.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
