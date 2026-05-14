from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.utils.text import slugify
from django.http import JsonResponse
from django.contrib.auth.hashers import make_password, check_password
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import UserProfile, PushSubscription
from .utils import create_session, get_owner_from_session
import re
import json
import base64
import logging
import random

logger = logging.getLogger(__name__)


def generate_pseudo_suggestions(base_pseudo):
    """Genere 3 alternatives de pseudo si le pseudo est deja pris."""
    suggestions = []
    suffixes = [
        str(random.randint(10, 99)),
        str(random.randint(100, 999)),
        '_' + str(random.randint(10, 99)),
        '_real',
        '_off',
        '_pro',
        str(random.randint(1, 9)),
    ]
    random.shuffle(suffixes)
    for suffix in suffixes:
        candidate = (base_pseudo + suffix)[:50]
        candidate = re.sub(r'[^a-z0-9_]', '', candidate)
        if len(candidate) >= 3 and not UserProfile.objects.filter(pseudo=candidate).exists():
            suggestions.append(candidate)
        if len(suggestions) == 3:
            break
    return suggestions


def home(request):
    owner = get_owner_from_session(request)
    if owner:
        return redirect('inbox', link_id=owner.link_id)
    return render(request, 'home.html')


def create_profile(request):
    if request.method == 'POST':
        pseudo = request.POST.get('pseudo', '').strip().lower()
        photo = request.FILES.get('photo')

        pin_code = request.POST.get('pin_code', '').strip()

        pseudo = re.sub(r'[^a-z0-9_]', '', pseudo)
        if len(pseudo) < 3:
            messages.error(request, 'Le pseudo doit avoir au moins 3 caracteres.')
            return render(request, 'home.html')

        if not pin_code or not pin_code.isdigit() or len(pin_code) != 4:
            messages.error(request, 'Le code PIN doit contenir exactement 4 chiffres.')
            return render(request, 'home.html')

        if UserProfile.objects.filter(pseudo=pseudo).exists():
            suggestions = generate_pseudo_suggestions(pseudo)
            return render(request, 'home.html', {
                'pseudo_taken': True,
                'typed_pseudo': pseudo,
                'suggestions': suggestions,
            })

        link_id = pseudo
        user = UserProfile.objects.create(
            pseudo=pseudo,
            photo=photo,
            link_id=link_id,
            pin_code=make_password(pin_code),
        )

        create_session(request, user=user, session_type='owner')
        request.session.modified = True
        request.session.save()
        return redirect('inbox', link_id=link_id)

    return redirect('home')


def login_with_pin(request):
    if request.method == 'POST':
        pseudo = request.POST.get('pseudo', '').strip().lower()
        pin_code = request.POST.get('pin_code', '').strip()

        if not pseudo or not pin_code:
            messages.error(request, 'Veuillez remplir tous les champs.')
            return redirect('home')

        try:
            user = UserProfile.objects.get(pseudo=pseudo)
            if not user.pin_code:
                messages.error(request, 'Ce compte n\'a pas de code PIN configure.')
                return redirect('home')
            
            if len(user.pin_code) == 4 and user.pin_code == pin_code:
                # Upgrade plain text pin to hash
                user.pin_code = make_password(pin_code)
                user.save()
            elif not check_password(pin_code, user.pin_code):
                messages.error(request, 'Identifiants incorrects.')
                return redirect('home')

            create_session(request, user=user, session_type='owner')
            request.session.modified = True
            request.session.save()
            return redirect('inbox', link_id=user.link_id)
            
        except UserProfile.DoesNotExist:
            messages.error(request, 'Identifiants incorrects.')
            return redirect('home')

    return redirect('home')


def profile_share(request, link_id):
    owner = get_owner_from_session(request)
    user = get_object_or_404(UserProfile, link_id=link_id)

    if not owner or owner.link_id != link_id:
        return redirect('send_message', link_id=link_id)

    share_url = request.build_absolute_uri(f'/m/send/{link_id}/')
    vapid_public_key = getattr(settings, 'VAPID_PUBLIC_KEY', '')
    return render(request, 'profile_share.html', {
        'user': user,
        'share_url': share_url,
        'VAPID_PUBLIC_KEY': vapid_public_key,
    })


def profile_settings(request, link_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    vapid_public_key = getattr(settings, 'VAPID_PUBLIC_KEY', '')

    if request.method == 'POST':
        content_mode = request.POST.get('content_mode', 'both')
        if content_mode in ('text', 'images', 'both'):
            owner.content_mode = content_mode
            # Sync deprecated fields for backward compatibility
            owner.accept_messages = content_mode in ('text', 'both')
            owner.accept_images = content_mode in ('images', 'both')

        # Telegram Chat ID
        telegram_chat_id = request.POST.get('telegram_chat_id', '').strip()
        owner.telegram_chat_id = telegram_chat_id if telegram_chat_id else None

        old_pin = request.POST.get('old_pin', '').strip()
        new_pin = request.POST.get('new_pin', '').strip()
        confirm_pin = request.POST.get('confirm_pin', '').strip()

        if old_pin or new_pin or confirm_pin:
            if not new_pin or not confirm_pin:
                messages.error(request, 'Veuillez remplir les champs de nouveau code PIN.')
                return redirect('profile_settings', link_id=link_id)
            if new_pin != confirm_pin:
                messages.error(request, 'Les nouveaux codes PIN ne correspondent pas.')
                return redirect('profile_settings', link_id=link_id)
            if not (new_pin.isdigit() and len(new_pin) == 4):
                messages.error(request, 'Le nouveau code PIN doit contenir exactement 4 chiffres.')
                return redirect('profile_settings', link_id=link_id)
                
            is_valid = False
            if owner.pin_code:
                if not old_pin:
                    messages.error(request, 'Veuillez saisir votre ancien code PIN.')
                    return redirect('profile_settings', link_id=link_id)
                if len(owner.pin_code) == 4 and owner.pin_code == old_pin:
                    is_valid = True
                elif check_password(old_pin, owner.pin_code):
                    is_valid = True
            else:
                is_valid = True # No old PIN to verify
                
            if not is_valid:
                messages.error(request, 'L\'ancien code PIN est incorrect.')
                return redirect('profile_settings', link_id=link_id)
                
            owner.pin_code = make_password(new_pin)
            owner.save()
            messages.success(request, 'Code PIN mis à jour avec succès.')

        # Handle photo upload
        photo = request.FILES.get('photo')
        if photo:
            # Delete old photo if exists
            if owner.photo:
                try:
                    owner.photo.delete(save=False)
                except Exception:
                    pass
            owner.photo = photo

        # Handle photo deletion
        if request.POST.get('delete_photo') == 'true':
            if owner.photo:
                try:
                    owner.photo.delete(save=False)
                except Exception:
                    pass
                owner.photo = None

        owner.save()
        messages.success(request, 'Parametres sauvegardes !')

    return render(request, 'settings.html', {
        'user': owner,
        'VAPID_PUBLIC_KEY': vapid_public_key,
    })


def logout_view(request):
    token = request.session.get('ngl_token')
    if token:
        from .models import SessionLog
        SessionLog.objects.filter(token=token).update(is_active=False)
    request.session.flush()
    return redirect('home')


# ==================== PUSH NOTIFICATION API ====================

@csrf_exempt
def push_subscribe(request):
    """Subscribe a user to push notifications"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    owner = get_owner_from_session(request)
    if not owner:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    try:
        data = json.loads(request.body)
        endpoint = data.get('endpoint')
        keys = data.get('keys', {})
        p256dh = keys.get('p256dh')
        auth = keys.get('auth')

        if not endpoint or not p256dh or not auth:
            return JsonResponse({'error': 'Missing subscription data'}, status=400)

        # Deactivate old subscriptions for this endpoint
        PushSubscription.objects.filter(endpoint=endpoint).update(is_active=False)

        # Create or update subscription
        PushSubscription.objects.update_or_create(
            user=owner,
            endpoint=endpoint,
            defaults={
                'p256dh': p256dh,
                'auth': auth,
                'is_active': True
            }
        )

        return JsonResponse({'success': True})
    except Exception as e:
        logger.error(f'Push subscribe error: {e}')
        return JsonResponse({'error': 'Server error'}, status=500)


@csrf_exempt
def push_unsubscribe(request):
    """Unsubscribe a user from push notifications"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    owner = get_owner_from_session(request)
    if not owner:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    try:
        data = json.loads(request.body)
        endpoint = data.get('endpoint')

        if endpoint:
            PushSubscription.objects.filter(user=owner, endpoint=endpoint).update(is_active=False)
        else:
            PushSubscription.objects.filter(user=owner).update(is_active=False)

        return JsonResponse({'success': True})
    except Exception as e:
        logger.error(f'Push unsubscribe error: {e}')
        return JsonResponse({'error': 'Server error'}, status=500)


# ==================== PUSH NOTIFICATION SENDER ====================

def send_push_notification(user, title, body, url=None, data=None):
    """Send push notification to a user"""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning('[MARA] pywebpush not installed, skipping push notification')
        return False

    vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
    vapid_claims = getattr(settings, 'VAPID_CLAIMS', None)

    if not vapid_private_key or not vapid_claims:
        logger.warning(f'[MARA] VAPID keys not configured for user {user.pseudo}, skipping push notification')
        return False

    subscriptions = PushSubscription.objects.filter(user=user, is_active=True)
    if not subscriptions.exists():
        logger.info(f'[MARA] No active push subscriptions for user {user.pseudo}')
        return False

    payload = {
        'title': title,
        'body': body,
        'icon': '/static/img/mara-192x192.png',
        'badge': '/static/img/mara-96x96.png',
        'tag': 'new-message',
        'url': url or '/',
        'image': data.get('image') if data else None,
    }
    if data:
        payload.update(data)

    logger.info(f'[MARA] Sending push to {user.pseudo} ({subscriptions.count()} subscriptions)')
    
    sent_count = 0
    failed_endpoints = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {
                        'p256dh': sub.p256dh,
                        'auth': sub.auth
                    }
                },
                data=json.dumps(payload),
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims
            )
            sent_count += 1
            logger.info(f'[MARA] Push sent successfully to {sub.endpoint[:30]}...')
        except WebPushException as e:
            logger.error(f'[MARA] WebPush error for {sub.endpoint[:30]}...: {e}')
            # Mark subscription as inactive on certain errors (410 = Gone, 404 = Not Found)
            if '410' in str(e) or '404' in str(e) or '403' in str(e):
                failed_endpoints.append(sub.endpoint)

    # Clean up failed subscriptions
    if failed_endpoints:
        logger.info(f'[MARA] Cleaning up {len(failed_endpoints)} failed subscriptions for {user.pseudo}')
        PushSubscription.objects.filter(endpoint__in=failed_endpoints).update(is_active=False)

    return sent_count > 0


def send_telegram_notification(user, message_text):
    """Send a notification via Telegram if the user has a chat_id configured"""
    if not user.telegram_chat_id or not settings.TELEGRAM_BOT_TOKEN:
        return False

    import requests
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = user.telegram_chat_id
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    
    payload = {
        'chat_id': chat_id,
        'text': message_text,
        'parse_mode': 'HTML'
    }

    try:
        response = requests.post(url, data=payload, timeout=10)
        if response.status_code == 200:
            logger.info(f"[MARA] Telegram notification sent to @{user.pseudo}")
            return True
        else:
            logger.error(f"[MARA] Telegram error: {response.text}")
            return False
    except Exception as e:
        logger.error(f"[MARA] Telegram exception: {e}")
        return False


def get_vapid_public_key(request):
    """Return VAPID public key for frontend"""
    vapid_key = getattr(settings, 'VAPID_PUBLIC_KEY', '')
    return JsonResponse({'vapidPublicKey': vapid_key})


@csrf_exempt
def reconnect_session(request):
    """
    API de reconnexion sans cookie.
    Verifie link_id + reconnect_token stockes dans localStorage
    et recree une session Django valide.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        link_id = data.get('link_id', '').strip()
        reconnect_token = data.get('reconnect_token', '').strip()

        if not link_id or not reconnect_token:
            return JsonResponse({'error': 'Missing fields'}, status=400)

        # Rate limiting: max 5 requests per minute per IP
        from django.core.cache import cache
        client_ip = request.META.get('REMOTE_ADDR', 'unknown')
        cache_key = f'reconnect_limit_{client_ip}_{link_id}'
        attempts = cache.get(cache_key, 0)
        
        if attempts >= 5:
            return JsonResponse({'error': 'Too many requests'}, status=429)
            
        cache.set(cache_key, attempts + 1, timeout=60)

        # Verification en base
        try:
            user = UserProfile.objects.get(link_id=link_id, reconnect_token=reconnect_token)
        except UserProfile.DoesNotExist:
            return JsonResponse({'error': 'Invalid credentials'}, status=401)

        # Recree la session
        create_session(request, user=user, session_type='owner')
        request.session.modified = True
        request.session.save()

        logger.info(f'[MARA] Reconnexion reussie pour @{user.pseudo}')
        return JsonResponse({
            'success': True,
            'pseudo': user.pseudo,
            'link_id': user.link_id,
            'redirect': f'/m/inbox/{user.link_id}/',
        })

    except Exception as e:
        logger.error(f'[MARA] Erreur reconnexion : {e}')
        return JsonResponse({'error': 'Server error'}, status=500)

