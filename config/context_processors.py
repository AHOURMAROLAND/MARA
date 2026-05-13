from django.conf import settings


def app_meta(request):
    """
    Injecte les meta tags globaux dans tous les templates.
    Overrides page par page si necessaire.
    """
    return {
        'APP_NAME': 'MARA',
        'APP_TAGLINE': 'Message At Random Anonymous',
        'APP_URL': request.build_absolute_uri('/'),
        'APP_DEFAULT_IMAGE': request.build_absolute_uri('/static/img/mara-og-default.jpg'),
    }
