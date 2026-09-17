import uuid
import random
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings
from .models import SessionLog, UserProfile


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_device_name(request):
    ua = request.META.get('HTTP_USER_AGENT', '')
    if 'iPhone' in ua:
        return 'iPhone'
    if 'iPad' in ua:
        return 'iPad'
    if 'Android' in ua:
        return 'Android'
    if 'Windows' in ua:
        return 'Windows PC'
    if 'Macintosh' in ua:
        return 'Mac'
    if 'Linux' in ua:
        return 'Linux'
    return 'Unknown Device'


def generate_token():
    return str(uuid.uuid4()).replace('-', '')


def create_session(request, user=None, session_type='visitor'):
    token = request.session.get('ngl_token')

    if token:
        try:
            session = SessionLog.objects.get(token=token, is_active=True)
            if session.expiry > timezone.now():
                # Upgrade session if needed
                needs_save = False
                if session_type == 'owner' and session.session_type == 'visitor':
                    session.session_type = 'owner'
                    needs_save = True
                if user and session.user != user:
                    session.user = user
                    needs_save = True
                if needs_save:
                    session.save()
                return session
        except SessionLog.DoesNotExist:
            pass

    token = generate_token()
    expiry = timezone.now() + timedelta(days=30)

    session = SessionLog.objects.create(
        token=token,
        session_type=session_type,
        user=user,
        ip_address=get_client_ip(request),
        device_name=get_device_name(request),
        date_connexion=timezone.now(),
        expiry=expiry,
        is_active=True,
    )

    request.session['ngl_token'] = token
    return session


def get_current_session(request):
    token = request.session.get('ngl_token')
    if not token:
        return None
    try:
        session = SessionLog.objects.get(token=token, is_active=True)
        if session.expiry > timezone.now():
            return session
        session.is_active = False
        session.save()
        return None
    except SessionLog.DoesNotExist:
        return None


def get_owner_from_session(request):
    # Try Django session first
    session = get_current_session(request)
    if session and session.session_type == 'owner' and session.user:
        return session.user
    
    # Check ngl_session cookie
    token = request.COOKIES.get('ngl_session')
    if token:
        log = SessionLog.objects.filter(token=token, session_type='owner', is_active=True).first()
        if log and log.user:
            return log.user
            
    # Check Bearer token in Authorization header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        bearer = auth_header.replace('Bearer ', '').strip()
        u = UserProfile.objects.filter(reconnect_token=bearer).first()
        if u:
            return u
        log = SessionLog.objects.filter(token=bearer, session_type='owner', is_active=True).first()
        if log and log.user:
            return log.user
    return None


def get_session_token(request):
    """Retrieve session token from session, cookies or header"""
    token = request.session.get('ngl_token')
    if token:
        return token
    token = request.COOKIES.get('ngl_session')
    if token:
        return token
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header.replace('Bearer ', '').strip()
    return None


def set_session_cookie(response, token):
    """Sets the ngl_session cookie on an HTTP response"""
    max_age = 60 * 60 * 24 * 30 # 30 days
    response.set_cookie(
        'ngl_session',
        token,
        max_age=max_age,
        httponly=True,
        samesite='Lax',
        secure=not settings.DEBUG
    )
    return response


def random_visitor_count():
    return random.randint(150, 999)

