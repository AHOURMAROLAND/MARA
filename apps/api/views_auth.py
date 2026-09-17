import json
import uuid
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.hashers import make_password, check_password
from apps.users.models import UserProfile, SessionLog
from apps.users.utils import get_session_token, set_session_cookie
from django.utils import timezone
from datetime import timedelta


def get_authenticated_user(request):
    """Retrieve UserProfile from cookie session, header token or Bearer token."""
    # Check session cookie
    token = request.COOKIES.get('ngl_session')
    if token:
        log = SessionLog.objects.filter(token=token, session_type='owner', is_active=True).first()
        if log and log.user:
            return log.user

    # Check Authorization header (for Mobile apps)
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        bearer_token = auth_header.replace('Bearer ', '').strip()
        # Try reconnect_token
        try:
            u = UserProfile.objects.filter(reconnect_token=bearer_token).first()
            if u:
                return u
        except Exception:
            pass
        # Try session token
        log = SessionLog.objects.filter(token=bearer_token, session_type='owner', is_active=True).first()
        if log and log.user:
            return log.user

    return None


@csrf_exempt
@require_http_methods(["GET"])
def check_pseudo_availability(request):
    pseudo = request.GET.get('pseudo', '').strip().lower()
    if not pseudo or len(pseudo) < 2:
        return JsonResponse({'available': False, 'message': 'Pseudo trop court'})
    
    exists = UserProfile.objects.filter(pseudo__iexact=pseudo).exists()
    return JsonResponse({
        'available': not exists,
        'pseudo': pseudo,
        'message': 'Disponible' if not exists else 'Déjà pris'
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_register(request):
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            pseudo = data.get('pseudo', '').strip().lower()
            pin_code = str(data.get('pin_code', '')).strip()
            photo = None
        else:
            pseudo = request.POST.get('pseudo', '').strip().lower()
            pin_code = str(request.POST.get('pin_code', '')).strip()
            photo = request.FILES.get('photo')

        if not pseudo or len(pseudo) < 2:
            return JsonResponse({'success': False, 'error': 'Le pseudo doit comporter au moins 2 caractères.'}, status=400)

        if not pin_code or len(pin_code) != 4 or not pin_code.isdigit():
            return JsonResponse({'success': False, 'error': 'Le code PIN doit comporter 4 chiffres.'}, status=400)

        if UserProfile.objects.filter(pseudo__iexact=pseudo).exists():
            return JsonResponse({'success': False, 'error': 'Ce pseudo est déjà pris.'}, status=400)

        # Generate unique link_id
        link_id = f"{pseudo}_{uuid.uuid4().hex[:6]}"

        user = UserProfile(
            pseudo=pseudo,
            link_id=link_id,
            pin_code=make_password(pin_code),
            reconnect_token=uuid.uuid4()
        )
        if photo:
            user.photo = photo
        user.save()

        # Create session log
        session_token = str(uuid.uuid4())
        expiry = timezone.now() + timedelta(days=30)
        SessionLog.objects.create(
            token=session_token,
            session_type='owner',
            user=user,
            ip_address=request.META.get('REMOTE_ADDR'),
            device_name=request.headers.get('User-Agent', '')[:255],
            expiry=expiry,
            is_active=True
        )

        resp = JsonResponse({
            'success': True,
            'user': {
                'id': str(user.id),
                'pseudo': user.pseudo,
                'link_id': user.link_id,
                'photo': user.photo.url if user.photo else None,
                'reconnect_token': str(user.reconnect_token),
                'token': session_token,
                'theme_color': user.theme_color,
                'is_searchable': user.is_searchable,
                'is_private_pro': user.is_private_pro,
            }
        })
        set_session_cookie(resp, session_token)
        return resp
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_login_pin(request):
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            pseudo = data.get('pseudo', '').strip().lower()
            pin_code = str(data.get('pin_code', '')).strip()
        else:
            pseudo = request.POST.get('pseudo', '').strip().lower()
            pin_code = str(request.POST.get('pin_code', '')).strip()

        user = UserProfile.objects.filter(pseudo__iexact=pseudo).first()
        if not user:
            return JsonResponse({'success': False, 'error': 'Utilisateur introuvable.'}, status=404)

        if not user.pin_code or not check_password(pin_code, user.pin_code):
            return JsonResponse({'success': False, 'error': 'Code PIN incorrect.'}, status=401)

        session_token = str(uuid.uuid4())
        expiry = timezone.now() + timedelta(days=30)
        SessionLog.objects.create(
            token=session_token,
            session_type='owner',
            user=user,
            ip_address=request.META.get('REMOTE_ADDR'),
            device_name=request.headers.get('User-Agent', '')[:255],
            expiry=expiry,
            is_active=True
        )

        resp = JsonResponse({
            'success': True,
            'user': {
                'id': str(user.id),
                'pseudo': user.pseudo,
                'link_id': user.link_id,
                'photo': user.photo.url if user.photo else None,
                'reconnect_token': str(user.reconnect_token),
                'token': session_token,
                'theme_color': user.theme_color,
                'is_searchable': user.is_searchable,
                'is_private_pro': user.is_private_pro,
            }
        })
        set_session_cookie(resp, session_token)
        return resp
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_reconnect(request):
    try:
        data = json.loads(request.body)
        link_id = data.get('link_id')
        reconnect_token = data.get('reconnect_token')

        user = UserProfile.objects.filter(link_id=link_id, reconnect_token=reconnect_token).first()
        if not user:
            return JsonResponse({'success': False, 'error': 'Session invalide ou expirée.'}, status=401)

        session_token = str(uuid.uuid4())
        expiry = timezone.now() + timedelta(days=30)
        SessionLog.objects.create(
            token=session_token,
            session_type='owner',
            user=user,
            ip_address=request.META.get('REMOTE_ADDR'),
            device_name=request.headers.get('User-Agent', '')[:255],
            expiry=expiry,
            is_active=True
        )

        resp = JsonResponse({
            'success': True,
            'user': {
                'id': str(user.id),
                'pseudo': user.pseudo,
                'link_id': user.link_id,
                'photo': user.photo.url if user.photo else None,
                'reconnect_token': str(user.reconnect_token),
                'token': session_token,
                'theme_color': user.theme_color,
            }
        })
        set_session_cookie(resp, session_token)
        return resp
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_me(request):
    user = get_authenticated_user(request)
    if not user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    friends_count = user.get_friends().count()
    stories_count = user.stories.filter(expires_at__gt=timezone.now()).count()
    received_msgs_count = user.received_messages.count()

    return JsonResponse({
        'success': True,
        'user': {
            'id': str(user.id),
            'pseudo': user.pseudo,
            'bio': user.bio or '',
            'link_id': user.link_id,
            'photo': user.photo.url if user.photo else None,
            'theme_color': user.theme_color,
            'is_searchable': user.is_searchable,
            'is_private_pro': user.is_private_pro,
            'content_mode': user.content_mode,
            'reconnect_token': str(user.reconnect_token),
            'stats': {
                'friends_count': friends_count,
                'stories_count': stories_count,
                'received_messages_count': received_msgs_count,
            }
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_update_profile(request):
    user = get_authenticated_user(request)
    if not user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            if 'bio' in data:
                user.bio = data['bio'][:250]
            if 'theme_color' in data:
                user.theme_color = data['theme_color']
            if 'is_searchable' in data:
                user.is_searchable = bool(data['is_searchable'])
            if 'is_private_pro' in data:
                user.is_private_pro = bool(data['is_private_pro'])
        else:
            if 'bio' in request.POST:
                user.bio = request.POST.get('bio', '')[:250]
            if 'theme_color' in request.POST:
                user.theme_color = request.POST.get('theme_color')
            if 'is_searchable' in request.POST:
                user.is_searchable = request.POST.get('is_searchable') in ('true', '1', 'on')
            if 'is_private_pro' in request.POST:
                user.is_private_pro = request.POST.get('is_private_pro') in ('true', '1', 'on')
            if 'photo' in request.FILES:
                user.photo = request.FILES['photo']

        user.save()
        return JsonResponse({
            'success': True,
            'user': {
                'pseudo': user.pseudo,
                'bio': user.bio,
                'photo': user.photo.url if user.photo else None,
                'theme_color': user.theme_color,
                'is_searchable': user.is_searchable,
                'is_private_pro': user.is_private_pro,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
