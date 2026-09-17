import json
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Q
from apps.users.models import UserProfile, Friendship, Invitation, BlockedSender
from apps.inbox.models import Conversation, Notification
from apps.api.views_auth import get_authenticated_user
import qrcode
import io


@csrf_exempt
@require_http_methods(["GET"])
def api_search_users(request):
    """Live search for users by pseudo. Filters out non-searchable or blocked users."""
    current_user = get_authenticated_user(request)
    query = request.GET.get('q', '').strip().lower()

    if not query or len(query) < 1:
        return JsonResponse({'success': True, 'results': []})

    # Find users matching pseudo
    users_qs = UserProfile.objects.filter(
        pseudo__icontains=query,
        is_searchable=True,
        is_private_pro=False
    )
    if current_user:
        users_qs = users_qs.exclude(id=current_user.id)
        # Exclude blocked users
        blocked_ids = BlockedSender.objects.filter(user=current_user).values_list('blocked_user_id', flat=True)
        users_qs = users_qs.exclude(id__in=blocked_ids)

    results = []
    for u in users_qs[:20]:
        is_friend = current_user.is_friend_with(u) if current_user else False
        pending_invitation = False
        if current_user and not is_friend:
            pending_invitation = Invitation.objects.filter(
                from_user=current_user,
                to_user=u,
                status='pending'
            ).exists()

        results.append({
            'id': str(u.id),
            'pseudo': u.pseudo,
            'bio': u.bio or '',
            'photo': u.photo.url if u.photo else None,
            'link_id': u.link_id,
            'is_friend': is_friend,
            'pending_invitation': pending_invitation,
            'theme_color': u.theme_color,
        })

    return JsonResponse({'success': True, 'results': results})


@csrf_exempt
@require_http_methods(["POST"])
def api_send_invitation(request):
    """Send an invitation with a strict limit of 10 pending invitations."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    try:
        data = json.loads(request.body)
        target_pseudo = data.get('pseudo', '').strip().lower()
        target_id = data.get('user_id')

        if target_id:
            target_user = UserProfile.objects.filter(id=target_id).first()
        else:
            target_user = UserProfile.objects.filter(pseudo__iexact=target_pseudo).first()

        if not target_user:
            return JsonResponse({'success': False, 'error': 'Utilisateur introuvable.'}, status=404)

        if target_user.id == current_user.id:
            return JsonResponse({'success': False, 'error': 'Action impossible sur vous-même.'}, status=400)

        # Check if already friends
        if current_user.is_friend_with(target_user):
            return JsonResponse({'success': False, 'error': 'Vous êtes déjà amis.'}, status=400)

        # Check if blocked
        if BlockedSender.objects.filter(user=target_user, blocked_user=current_user).exists():
            return JsonResponse({'success': False, 'error': 'Impossible d\'envoyer une invitation à ce contact.'}, status=403)

        # Check pending invitations limit (max 10)
        pending_count = Invitation.objects.filter(from_user=current_user, status='pending').count()
        if pending_count >= 10:
            return JsonResponse({'success': False, 'error': 'Plafond atteint : Vous avez déjà 10 invitations en attente.'}, status=400)

        # Create or update invitation
        inv, created = Invitation.objects.update_or_create(
            from_user=current_user,
            to_user=target_user,
            defaults={'status': 'pending'}
        )

        # Create in-app notification
        Notification.objects.create(
            recipient=target_user,
            actor=current_user,
            verb='invitation_received',
            title=f"Nouvelle invitation de @{current_user.pseudo}",
            body="veut t'ajouter à ses contacts.",
            target_url="/contacts/add/"
        )

        return JsonResponse({'success': True, 'message': f'Invitation envoyée à @{target_user.pseudo} !'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_respond_invitation(request):
    """Accept, decline or block an invitation."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    try:
        data = json.loads(request.body)
        invitation_id = data.get('invitation_id')
        action = data.get('action')  # 'accept', 'decline', 'block'

        invitation = Invitation.objects.filter(id=invitation_id, to_user=current_user).first()
        if not invitation:
            return JsonResponse({'success': False, 'error': 'Invitation introuvable.'}, status=404)

        if action == 'accept':
            invitation.status = 'accepted'
            invitation.save()

            # Create friendship
            Friendship.objects.get_or_create(
                user1=min(current_user, invitation.from_user, key=lambda u: str(u.id)),
                user2=max(current_user, invitation.from_user, key=lambda u: str(u.id))
            )

            # Create or get conversation
            conv, _ = Conversation.objects.get_or_create(
                user1=min(current_user, invitation.from_user, key=lambda u: str(u.id)),
                user2=max(current_user, invitation.from_user, key=lambda u: str(u.id))
            )

            # Create notification
            Notification.objects.create(
                recipient=invitation.from_user,
                actor=current_user,
                verb='invitation_accepted',
                title=f"@{current_user.pseudo} a accepté ton invitation !",
                body="Vous pouvez maintenant discuter ensemble.",
                target_url=f"/chat/{str(conv.id)}/"
            )

            return JsonResponse({'success': True, 'action': 'accepted', 'conversation_id': str(conv.id)})

        elif action == 'decline':
            invitation.status = 'declined'
            invitation.save()
            return JsonResponse({'success': True, 'action': 'declined'})

        elif action == 'block':
            invitation.status = 'blocked'
            invitation.save()
            BlockedSender.objects.get_or_create(user=current_user, blocked_user=invitation.from_user)
            return JsonResponse({'success': True, 'action': 'blocked'})

        return JsonResponse({'success': False, 'error': 'Action invalide.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_list_friends(request):
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    friends = current_user.get_friends()
    results = []
    for f in friends:
        # Find conversation
        conv = Conversation.objects.filter(
            (Q(user1=current_user) & Q(user2=f)) | (Q(user1=f) & Q(user2=current_user))
        ).first()

        results.append({
            'id': str(f.id),
            'pseudo': f.pseudo,
            'bio': f.bio or '',
            'photo': f.photo.url if f.photo else None,
            'link_id': f.link_id,
            'theme_color': f.theme_color,
            'conversation_id': str(conv.id) if conv else None,
        })

    return JsonResponse({'success': True, 'friends': results})


@csrf_exempt
@require_http_methods(["GET"])
def api_list_invitations(request):
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    received = Invitation.objects.filter(to_user=current_user, status='pending').select_related('from_user')
    results = [{
        'id': str(inv.id),
        'from_user': {
            'id': str(inv.from_user.id),
            'pseudo': inv.from_user.pseudo,
            'photo': inv.from_user.photo.url if inv.from_user.photo else None,
            'theme_color': inv.from_user.theme_color,
        },
        'created_at': inv.created_at.isoformat()
    } for inv in received]

    return JsonResponse({'success': True, 'invitations': results})


@csrf_exempt
@require_http_methods(["GET"])
def api_profile_qrcode(request, link_id):
    """Generate QR code image for a profile link."""
    user = UserProfile.objects.filter(link_id=link_id).first()
    if not user:
        return JsonResponse({'success': False, 'error': 'Profil introuvable.'}, status=404)

    profile_url = request.build_absolute_uri(f"/u/{user.link_id}/")
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(profile_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#FF4565", back_color="#0B0E14")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return HttpResponse(buffer.getvalue(), content_type="image/png")
