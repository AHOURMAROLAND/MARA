import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from apps.users.models import UserProfile
from apps.inbox.models import Conversation, ConversationMessage, MessageReaction, Notification
from apps.api.views_auth import get_authenticated_user
from apps.api.utils_ssrf import scrape_link_preview


@csrf_exempt
@require_http_methods(["GET"])
def api_list_conversations(request):
    """List all discussions with contact info, last message, unread badge."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    convs = Conversation.objects.filter(
        Q(user1=current_user) | Q(user2=current_user)
    ).select_related('user1', 'user2').order_by('-last_message_at')

    results = []
    for c in convs:
        other_user = c.get_other_user(current_user)
        last_msg = c.messages.filter(is_deleted_for_all=False).order_by('-created_at').first()
        
        # Calculate unread count
        unread_count = c.messages.filter(
            conversation=c,
            status__in=['sent', 'delivered']
        ).exclude(sender=current_user).count()

        # Check if active stories exist
        has_story = other_user.stories.filter(expires_at__gt=timezone.now()).exists()

        results.append({
            'id': str(c.id),
            'other_user': {
                'id': str(other_user.id),
                'pseudo': other_user.pseudo,
                'photo': other_user.photo.url if other_user.photo else None,
                'theme_color': other_user.theme_color,
                'has_story': has_story,
            },
            'last_message': {
                'text': last_msg.text if last_msg and last_msg.text else (f"[{last_msg.get_media_type_display()}]" if last_msg else "Aucun message"),
                'created_at': last_msg.created_at.isoformat() if last_msg else c.created_at.isoformat(),
                'sender_id': str(last_msg.sender_id) if last_msg else None,
                'status': last_msg.status if last_msg else None,
            } if last_msg else None,
            'unread_count': unread_count,
            'is_pinned': c.is_pinned_by(current_user),
        })

    return JsonResponse({'success': True, 'conversations': results})


@csrf_exempt
@require_http_methods(["GET"])
def api_get_messages(request, conversation_id):
    """Fetch messages in a conversation."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    conv = Conversation.objects.filter(id=conversation_id).first()
    if not conv or (conv.user1_id != current_user.id and conv.user2_id != current_user.id):
        return JsonResponse({'success': False, 'error': 'Conversation introuvable.'}, status=404)

    other_user = conv.get_other_user(current_user)

    # Mark received unread messages as read
    conv.messages.filter(status__in=['sent', 'delivered']).exclude(sender=current_user).update(status='read')

    msgs_qs = conv.messages.filter(is_deleted_for_all=False).select_related('sender', 'reply_to').order_by('created_at')

    # Filter out messages deleted specifically for this user
    if conv.user1_id == current_user.id:
        msgs_qs = msgs_qs.filter(deleted_for_user1=False)
    else:
        msgs_qs = msgs_qs.filter(deleted_for_user2=False)

    messages = []
    for m in msgs_qs:
        reactions = list(m.reactions.values('emoji', 'user__pseudo', 'session_token'))
        messages.append({
            'id': str(m.id),
            'is_me': m.sender_id == current_user.id,
            'sender_pseudo': m.sender.pseudo,
            'text': m.text,
            'media_url': m.media_file.url if m.media_file else None,
            'media_type': m.media_type,
            'voice_duration': m.voice_duration,
            'status': m.status,
            'is_pinned': m.is_pinned,
            'is_edited': m.is_edited,
            'is_forwarded': m.is_forwarded,
            'reply_to': {
                'id': str(m.reply_to.id),
                'text': m.reply_to.text,
                'sender_pseudo': m.reply_to.sender.pseudo
            } if m.reply_to else None,
            'reactions': reactions,
            'created_at': m.created_at.strftime('%H:%M'),
            'date': m.created_at.strftime('%Y-%m-%d'),
        })

    return JsonResponse({
        'success': True,
        'conversation_id': str(conv.id),
        'other_user': {
            'id': str(other_user.id),
            'pseudo': other_user.pseudo,
            'photo': other_user.photo.url if other_user.photo else None,
            'theme_color': other_user.theme_color,
            'bio': other_user.bio or '',
        },
        'messages': messages
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_send_message(request, conversation_id):
    """Send text or multimedia message in a 1-to-1 conversation."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    conv = Conversation.objects.filter(id=conversation_id).first()
    if not conv or (conv.user1_id != current_user.id and conv.user2_id != current_user.id):
        return JsonResponse({'success': False, 'error': 'Conversation introuvable.'}, status=404)

    other_user = conv.get_other_user(current_user)

    text = None
    media_file = None
    media_type = 'text'
    voice_duration = 0
    reply_to_id = None

    if request.content_type == 'application/json':
        data = json.loads(request.body)
        text = data.get('text')
        reply_to_id = data.get('reply_to_id')
    else:
        text = request.POST.get('text')
        media_type = request.POST.get('media_type', 'text')
        voice_duration = int(request.POST.get('voice_duration', 0))
        reply_to_id = request.POST.get('reply_to_id')
        if 'media_file' in request.FILES:
            media_file = request.FILES['media_file']

    if not text and not media_file:
        return JsonResponse({'success': False, 'error': 'Message vide.'}, status=400)

    reply_to = None
    if reply_to_id:
        reply_to = ConversationMessage.objects.filter(id=reply_to_id, conversation=conv).first()

    msg = ConversationMessage.objects.create(
        conversation=conv,
        sender=current_user,
        text=text,
        media_file=media_file,
        media_type=media_type,
        voice_duration=voice_duration,
        reply_to=reply_to,
        status='sent'
    )

    conv.last_message_at = timezone.now()
    conv.save()

    # Trigger Notification
    Notification.objects.create(
        recipient=other_user,
        actor=current_user,
        verb='new_message',
        title=f"@{current_user.pseudo}",
        body=text[:100] if text else f"Nouveau média ({media_type})",
        target_url=f"/chat/{str(conv.id)}/"
    )

    return JsonResponse({
        'success': True,
        'message': {
            'id': str(msg.id),
            'is_me': True,
            'sender_pseudo': current_user.pseudo,
            'text': msg.text,
            'media_url': msg.media_file.url if msg.media_file else None,
            'media_type': msg.media_type,
            'voice_duration': msg.voice_duration,
            'status': msg.status,
            'created_at': msg.created_at.strftime('%H:%M'),
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_message_action(request):
    """Handle message context menu actions: edit, delete, pin, react."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    try:
        data = json.loads(request.body)
        msg_id = data.get('message_id')
        action = data.get('action')

        msg = ConversationMessage.objects.filter(id=msg_id).select_related('conversation').first()
        if not msg:
            return JsonResponse({'success': False, 'error': 'Message introuvable.'}, status=404)

        conv = msg.conversation
        if conv.user1_id != current_user.id and conv.user2_id != current_user.id:
            return JsonResponse({'success': False, 'error': 'Accès refusé.'}, status=403)

        if action == 'edit':
            if msg.sender_id != current_user.id:
                return JsonResponse({'success': False, 'error': 'Seul l\'auteur peut modifier son message.'}, status=403)
            # 15 minutes edit window
            if timezone.now() - msg.created_at > timedelta(minutes=15):
                return JsonResponse({'success': False, 'error': 'Délai de modification de 15 minutes dépassé.'}, status=400)
            msg.text = data.get('text', '')
            msg.is_edited = True
            msg.edited_at = timezone.now()
            msg.save()
            return JsonResponse({'success': True, 'action': 'edited', 'text': msg.text})

        elif action in ('delete', 'delete_for_me'):
            if conv.user1_id == current_user.id:
                msg.deleted_for_user1 = True
            else:
                msg.deleted_for_user2 = True
            msg.save()
            return JsonResponse({'success': True, 'action': 'deleted_for_me'})

        elif action == 'delete_for_everyone':
            if msg.sender_id != current_user.id:
                return JsonResponse({'success': False, 'error': 'Action non autorisée.'}, status=403)
            msg.is_deleted_for_all = True
            msg.save()
            return JsonResponse({'success': True, 'action': 'deleted_for_everyone'})

        elif action == 'pin':
            msg.is_pinned = not msg.is_pinned
            msg.save()
            return JsonResponse({'success': True, 'action': 'pin_toggled', 'is_pinned': msg.is_pinned})

        elif action == 'react':
            emoji = data.get('emoji', '❤️')
            reaction, created = MessageReaction.objects.get_or_create(
                conversation_message=msg,
                user=current_user,
                emoji=emoji
            )
            if not created:
                reaction.delete()
                return JsonResponse({'success': True, 'action': 'reaction_removed'})
            return JsonResponse({'success': True, 'action': 'reaction_added', 'emoji': emoji})

        return JsonResponse({'success': False, 'error': 'Action inconnue.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_link_preview(request):
    """Scrape OpenGraph data safely."""
    try:
        data = json.loads(request.body)
        url = data.get('url')
        preview = scrape_link_preview(url)
        if preview:
            return JsonResponse({'success': True, 'preview': preview})
        return JsonResponse({'success': False, 'error': 'Aperçu non disponible.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_delete_conversation(request, conversation_id):
    """Delete / hide all messages in a conversation for the current user."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    conv = Conversation.objects.filter(id=conversation_id).first()
    if not conv or (conv.user1_id != current_user.id and conv.user2_id != current_user.id):
        return JsonResponse({'success': False, 'error': 'Conversation introuvable.'}, status=404)

    if conv.user1_id == current_user.id:
        conv.messages.update(deleted_for_user1=True)
    else:
        conv.messages.update(deleted_for_user2=True)

    return JsonResponse({'success': True, 'message': 'Conversation effacée avec succès.'})

