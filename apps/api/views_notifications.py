import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from apps.inbox.models import Notification
from apps.users.models import PushSubscription
from apps.api.views_auth import get_authenticated_user


@csrf_exempt
@require_http_methods(["GET"])
def api_list_notifications(request):
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    notifs = current_user.notifications.exclude(verb='new_message')[:50]
    unread_count = current_user.notifications.exclude(verb='new_message').filter(is_read=False).count()

    results = []
    for n in notifs:
        results.append({
            'id': str(n.id),
            'verb': n.verb,
            'title': n.title,
            'body': n.body or '',
            'target_url': n.target_url,
            'is_read': n.is_read,
            'created_at': n.created_at.strftime('%d/%m à %H:%M'),
        })

    return JsonResponse({
        'success': True,
        'unread_count': unread_count,
        'notifications': results
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_mark_notification_read(request, notif_id):
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    if notif_id == 'all':
        current_user.notifications.filter(is_read=False).update(is_read=True)
        return JsonResponse({'success': True, 'message': 'Toutes les notifications ont été marquées comme lues.'})

    notif = current_user.notifications.filter(id=notif_id).first()
    if notif:
        notif.is_read = True
        notif.save()
        return JsonResponse({'success': True})

    return JsonResponse({'success': False, 'error': 'Notification introuvable.'}, status=404)


@csrf_exempt
@require_http_methods(["POST"])
def api_register_push(request):
    """Register web push or native Capacitor FCM push token."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    try:
        data = json.loads(request.body)
        endpoint = data.get('endpoint')
        p256dh = data.get('keys', {}).get('p256dh', '') or data.get('p256dh', '')
        auth = data.get('keys', {}).get('auth', '') or data.get('auth', '')

        if endpoint:
            PushSubscription.objects.update_or_create(
                user=current_user,
                endpoint=endpoint,
                defaults={'p256dh': p256dh, 'auth': auth, 'is_active': True}
            )

        return JsonResponse({'success': True, 'message': 'Abonnement push enregistré !'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
