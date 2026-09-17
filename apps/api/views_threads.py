import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from apps.users.models import UserProfile, Friendship
from apps.inbox.models import Message, AnonymousThread, AnonymousThreadMessage, Conversation, ConversationMessage, Notification, Story
from apps.api.views_auth import get_authenticated_user


@csrf_exempt
@require_http_methods(["GET"])
def api_list_threads(request):
    """List anonymous threads for recipient or sender session token."""
    current_user = get_authenticated_user(request)
    session_token = request.COOKIES.get('ngl_visitor_token') or request.headers.get('X-Visitor-Token')

    if current_user:
        threads = AnonymousThread.objects.filter(recipient=current_user, status__in=['active', 'revealed']).select_related('initial_message')
    elif session_token:
        threads = AnonymousThread.objects.filter(sender_session_token=session_token, status__in=['active', 'revealed']).select_related('recipient')
    else:
        return JsonResponse({'success': True, 'threads': []})

    results = []
    for t in threads:
        last_msg = t.messages.order_by('-created_at').first()
        results.append({
            'id': str(t.id),
            'recipient_pseudo': t.recipient.pseudo,
            'initial_message_text': t.initial_message.text or 'Photo reçue',
            'status': t.status,
            'last_message': {
                'text': last_msg.text if last_msg else t.initial_message.text,
                'sender_type': last_msg.sender_type if last_msg else 'anonymous',
                'created_at': last_msg.created_at.strftime('%H:%M') if last_msg else t.created_at.strftime('%H:%M')
            },
            'created_at': t.created_at.isoformat(),
        })

    return JsonResponse({'success': True, 'threads': results})


@csrf_exempt
@require_http_methods(["GET"])
def api_get_thread(request, thread_id):
    """Retrieve full anonymous thread history and actions."""
    current_user = get_authenticated_user(request)
    session_token = request.COOKIES.get('ngl_visitor_token') or request.headers.get('X-Visitor-Token')

    thread = AnonymousThread.objects.filter(id=thread_id).select_related('recipient', 'initial_message', 'revealed_user').first()
    if not thread:
        return JsonResponse({'success': False, 'error': 'Fil anonyme introuvable.'}, status=404)

    is_recipient = current_user and current_user.id == thread.recipient_id
    is_sender = session_token and session_token == thread.sender_session_token

    if not is_recipient and not is_sender:
        return JsonResponse({'success': False, 'error': 'Accès non autorisé.'}, status=403)

    messages = []
    for m in thread.messages.order_by('created_at'):
        # Determine if message is sent by the current viewer
        if is_recipient:
            is_me = (m.sender_type == 'recipient')
        else:
            is_me = (m.sender_type == 'anonymous')

        messages.append({
            'id': str(m.id),
            'is_me': is_me,
            'sender_type': m.sender_type,
            'text': m.text,
            'image_url': m.image.url if m.image else None,
            'status': m.status,
            'created_at': m.created_at.strftime('%H:%M'),
        })

    return JsonResponse({
        'success': True,
        'thread': {
            'id': str(thread.id),
            'recipient_pseudo': thread.recipient.pseudo,
            'recipient_photo': thread.recipient.photo.url if thread.recipient.photo else None,
            'initial_message': {
                'text': thread.initial_message.text,
                'image_url': thread.initial_message.image.url if thread.initial_message.image else None,
                'created_at': thread.initial_message.created_at.strftime('%H:%M'),
            },
            'status': thread.status,
            'is_recipient': is_recipient,
            'revealed_user': {
                'pseudo': thread.revealed_user.pseudo,
                'photo': thread.revealed_user.photo.url if thread.revealed_user.photo else None,
            } if thread.revealed_user else None,
            'messages': messages,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_send_thread_message(request, thread_id):
    """Send a reply inside an anonymous thread."""
    current_user = get_authenticated_user(request)
    session_token = request.COOKIES.get('ngl_visitor_token') or request.headers.get('X-Visitor-Token')

    thread = AnonymousThread.objects.filter(id=thread_id).select_related('recipient').first()
    if not thread or thread.status == 'closed':
        return JsonResponse({'success': False, 'error': 'Fil fermé ou inexistant.'}, status=404)

    is_recipient = current_user and current_user.id == thread.recipient_id
    is_sender = session_token and session_token == thread.sender_session_token

    if not is_recipient and not is_sender:
        return JsonResponse({'success': False, 'error': 'Accès non autorisé.'}, status=403)

    sender_type = 'recipient' if is_recipient else 'anonymous'

    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            text = data.get('text', '').strip()
            image = None
        else:
            text = request.POST.get('text', '').strip()
            image = request.FILES.get('image')

        if not text and not image:
            return JsonResponse({'success': False, 'error': 'Message vide.'}, status=400)

        msg = AnonymousThreadMessage.objects.create(
            thread=thread,
            sender_type=sender_type,
            text=text,
            image=image,
            status='sent'
        )

        thread.updated_at = timezone.now()
        thread.save()

        # If sender replied, notify recipient
        if sender_type == 'anonymous':
            Notification.objects.create(
                recipient=thread.recipient,
                verb='anonymous_reply',
                title="Réponse dans ton Fil Anonyme 💌",
                body=text[:100] or "Nouveau message anonyme",
                target_url=f"/thread/{str(thread.id)}/"
            )

        return JsonResponse({
            'success': True,
            'message': {
                'id': str(msg.id),
                'is_me': True,
                'sender_type': msg.sender_type,
                'text': msg.text,
                'image_url': msg.image.url if msg.image else None,
                'status': msg.status,
                'created_at': msg.created_at.strftime('%H:%M'),
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_reveal_thread(request, thread_id):
    """Action 'Découvrir qui c'est': converts anonymous thread to identified Conversation."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    thread = AnonymousThread.objects.filter(id=thread_id, recipient=current_user).first()
    if not thread:
        return JsonResponse({'success': False, 'error': 'Fil introuvable.'}, status=404)

    # Check if sender has a profile associated with sender_session_token
    from apps.users.models import SessionLog
    sender_log = SessionLog.objects.filter(token=thread.sender_session_token, user__isnull=False).first()
    sender_user = sender_log.user if sender_log else None

    if sender_user:
        thread.revealed_user = sender_user
        thread.status = 'revealed'
        thread.save()

        # Create or fetch friendship and conversation
        Friendship.objects.get_or_create(
            user1=min(current_user, sender_user, key=lambda u: str(u.id)),
            user2=max(current_user, sender_user, key=lambda u: str(u.id))
        )
        conv, _ = Conversation.objects.get_or_create(
            user1=min(current_user, sender_user, key=lambda u: str(u.id)),
            user2=max(current_user, sender_user, key=lambda u: str(u.id))
        )

        # Notify sender
        Notification.objects.create(
            recipient=sender_user,
            actor=current_user,
            verb='invitation_accepted',
            title=f"@{current_user.pseudo} a révélé vos identités !",
            body="Votre fil anonyme est devenu une discussion amie.",
            target_url=f"/chat/{str(conv.id)}/"
        )

        return JsonResponse({
            'success': True,
            'revealed': True,
            'user': {
                'pseudo': sender_user.pseudo,
                'photo': sender_user.photo.url if sender_user.photo else None,
            },
            'conversation_id': str(conv.id)
        })
    else:
        # Sender was a 100% guest without account
        return JsonResponse({
            'success': True,
            'revealed': False,
            'message': 'L\'expéditeur n\'a pas encore de compte MARA public associé.'
        })


@csrf_exempt
@require_http_methods(["POST"])
def api_close_thread(request, thread_id):
    """Action 'Clore la discussion': immediately destroys or marks the thread closed."""
    current_user = get_authenticated_user(request)
    session_token = request.COOKIES.get('ngl_visitor_token') or request.headers.get('X-Visitor-Token')

    thread = AnonymousThread.objects.filter(id=thread_id).first()
    if not thread:
        return JsonResponse({'success': False, 'error': 'Fil introuvable.'}, status=404)

    is_recipient = current_user and current_user.id == thread.recipient_id
    is_sender = session_token and session_token == thread.sender_session_token

    if not is_recipient and not is_sender:
        return JsonResponse({'success': False, 'error': 'Accès refusé.'}, status=403)

    thread.status = 'closed'
    thread.save()
    return JsonResponse({'success': True, 'message': 'Discussion close avec succès.'})


@csrf_exempt
@require_http_methods(["GET"])
def api_inbox_deck(request):
    """Screen 8.5: Swipeable deck of anonymous messages with action pills."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    msgs = Message.objects.filter(recipient=current_user, is_archived=False).order_by('-created_at')[:30]
    cards = []
    for m in msgs:
        # Check if thread exists
        thread = m.threads.first()
        cards.append({
            'id': str(m.id),
            'text': m.text,
            'image_url': m.image.url if m.image else None,
            'image_caption': m.image_caption,
            'created_at': m.created_at.strftime('%d/%m à %H:%M'),
            'thread_id': str(thread.id) if thread else None,
            'is_read': m.is_read,
        })

    return JsonResponse({'success': True, 'cards': cards})


@csrf_exempt
@require_http_methods(["POST"])
def api_repost_message_to_story(request, message_id):
    """Repost an anonymous image message directly as user's story."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    msg = Message.objects.filter(id=message_id, recipient=current_user).first()
    if not msg or not msg.image:
        return JsonResponse({'success': False, 'error': 'Message ou image introuvable.'}, status=404)

    story = Story.objects.create(
        user=current_user,
        media_file=msg.image,
        media_type='image',
        text_content=msg.text or 'Message anonyme reçu 💌',
        bg_gradient='linear-gradient(135deg, #FF4565 0%, #FF8038 100%)'
    )

    return JsonResponse({'success': True, 'story_id': str(story.id), 'message': 'Ajouté en Story avec succès !'})
