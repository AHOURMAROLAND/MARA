import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from apps.users.models import UserProfile
from apps.inbox.models import Story, StoryView, Conversation, ConversationMessage, Notification
from apps.api.views_auth import get_authenticated_user


@csrf_exempt
@require_http_methods(["GET"])
def api_active_stories_rail(request):
    """Horizontal stories rail for the Discussions home screen (Image 3 & 4)."""
    current_user = get_authenticated_user(request)

    # Get active stories (expires_at > now)
    now = timezone.now()
    active_stories = Story.objects.filter(expires_at__gt=now).select_related('user')

    # Group by user
    user_stories_map = {}
    for s in active_stories:
        u = s.user
        if u.id not in user_stories_map:
            # Check if current user has viewed all stories of this user
            all_viewed = False
            if current_user:
                viewed_count = StoryView.objects.filter(story__user=u, viewer=current_user, story__expires_at__gt=now).count()
                total_count = Story.objects.filter(user=u, expires_at__gt=now).count()
                all_viewed = (viewed_count >= total_count and total_count > 0)

            user_stories_map[u.id] = {
                'user_id': str(u.id),
                'pseudo': u.pseudo,
                'photo': u.photo.url if u.photo else None,
                'theme_color': u.theme_color,
                'stories_count': 0,
                'has_active_story': True,
                'all_viewed': all_viewed,
            }
        user_stories_map[u.id]['stories_count'] += 1

    # Format list: put current user first if they have stories, then friends, then others
    story_list = list(user_stories_map.values())
    return JsonResponse({'success': True, 'stories': story_list})


@csrf_exempt
@require_http_methods(["GET"])
def api_user_stories(request, user_id):
    """Retrieve active stories for full-screen Story Viewer (Image 1)."""
    current_user = get_authenticated_user(request)
    now = timezone.now()

    user = UserProfile.objects.filter(id=user_id).first()
    if not user:
        return JsonResponse({'success': False, 'error': 'Utilisateur introuvable.'}, status=404)

    stories = Story.objects.filter(user=user, expires_at__gt=now).order_by('created_at')
    story_items = []
    for s in stories:
        liked = False
        if current_user:
            liked = StoryView.objects.filter(story=s, viewer=current_user, liked=True).exists()

        story_items.append({
            'id': str(s.id),
            'media_type': s.media_type,
            'media_url': s.media_file.url if s.media_file else None,
            'text_content': s.text_content,
            'text_color': s.text_color,
            'bg_gradient': s.bg_gradient,
            'created_at': s.created_at.isoformat(),
            'liked': liked,
            'views_count': s.views.count(),
        })

    return JsonResponse({
        'success': True,
        'user': {
            'id': str(user.id),
            'pseudo': user.pseudo,
            'photo': user.photo.url if user.photo else None,
            'theme_color': user.theme_color,
        },
        'stories': story_items
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_create_story(request):
    """Create a new 24h story (image, video, text)."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    try:
        media_type = 'image'
        media_file = None
        text_content = None
        text_color = '#FFFFFF'
        bg_gradient = 'linear-gradient(135deg, #FF4565 0%, #FF8038 100%)'

        if request.content_type == 'application/json':
            data = json.loads(request.body)
            media_type = data.get('media_type', 'text')
            text_content = data.get('text_content')
            text_color = data.get('text_color', '#FFFFFF')
            bg_gradient = data.get('bg_gradient', bg_gradient)
        else:
            media_type = request.POST.get('media_type', 'image')
            text_content = request.POST.get('text_content')
            text_color = request.POST.get('text_color', '#FFFFFF')
            bg_gradient = request.POST.get('bg_gradient', bg_gradient)
            if 'media_file' in request.FILES:
                media_file = request.FILES['media_file']

        story = Story.objects.create(
            user=current_user,
            media_file=media_file,
            media_type=media_type,
            text_content=text_content,
            text_color=text_color,
            bg_gradient=bg_gradient
        )

        return JsonResponse({
            'success': True,
            'story': {
                'id': str(story.id),
                'media_type': story.media_type,
                'media_url': story.media_file.url if story.media_file else None,
                'text_content': story.text_content,
                'expires_at': story.expires_at.isoformat(),
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_mark_story_viewed(request, story_id):
    """Mark story as viewed with confirmation if fully loaded."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': True})

    story = Story.objects.filter(id=story_id).first()
    if not story or story.user_id == current_user.id:
        return JsonResponse({'success': True})

    try:
        is_fully_loaded = True
        if request.body:
            try:
                data = json.loads(request.body)
                is_fully_loaded = data.get('is_fully_loaded', True)
            except Exception:
                pass

        StoryView.objects.update_or_create(
            story=story,
            viewer=current_user,
            defaults={'is_fully_loaded': is_fully_loaded}
        )
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_story_react(request, story_id):
    """Send like reaction ❤️ or text reply to a story."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    story = Story.objects.filter(id=story_id).select_related('user').first()
    if not story:
        return JsonResponse({'success': False, 'error': 'Story introuvable.'}, status=404)

    try:
        data = json.loads(request.body)
        action = data.get('action') or data.get('type')  # 'like' or 'reply'

        if action == 'like':
            view, created = StoryView.objects.get_or_create(
                story=story,
                viewer=current_user
            )
            view.liked = not view.liked
            view.save()

            if view.liked and story.user_id != current_user.id:
                Notification.objects.create(
                    recipient=story.user,
                    actor=current_user,
                    verb='story_like',
                    title=f"@{current_user.pseudo} a aimé ta story ❤️",
                    target_url=f"/story/{str(story.id)}/"
                )

            return JsonResponse({'success': True, 'liked': view.liked})

        elif action == 'reply':
            text = data.get('text', '').strip()
            if not text:
                return JsonResponse({'success': False, 'error': 'Réponse vide.'}, status=400)

            # Send via conversation
            conv, _ = Conversation.objects.get_or_create(
                user1=min(current_user, story.user, key=lambda u: str(u.id)),
                user2=max(current_user, story.user, key=lambda u: str(u.id))
            )
            ConversationMessage.objects.create(
                conversation=conv,
                sender=current_user,
                text=f"💬 Réponse à ta story : {text}",
                status='sent'
            )
            conv.last_message_at = timezone.now()
            conv.save()

            Notification.objects.create(
                recipient=story.user,
                actor=current_user,
                verb='new_message',
                title=f"@{current_user.pseudo} a répondu à ta story",
                body=text,
                target_url=f"/chat/{str(conv.id)}/"
            )

            return JsonResponse({'success': True, 'message': 'Réponse envoyée !'})

        return JsonResponse({'success': False, 'error': 'Action invalide.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
