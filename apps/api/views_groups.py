import json
import uuid
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from apps.groups.models import Group, GroupParticipant, GroupMessage, GroupMessageReaction
from apps.groups.constants import get_random_nickname
from apps.api.views_auth import get_authenticated_user


@csrf_exempt
@require_http_methods(["GET"])
def api_list_groups(request):
    """List groups joined by current user / session."""
    current_user = get_authenticated_user(request)
    session_token = request.COOKIES.get('ngl_session') or request.headers.get('X-Session-Token')

    if current_user:
        memberships = GroupParticipant.objects.filter(user=current_user).select_related('group')
    elif session_token:
        memberships = GroupParticipant.objects.filter(session_token=session_token).select_related('group')
    else:
        return JsonResponse({'success': True, 'groups': []})

    results = []
    for m in memberships:
        g = m.group
        last_msg = g.messages.order_by('-created_at').first()
        unread_count = m.get_unread_count()

        results.append({
            'id': str(g.id),
            'name': g.name,
            'link_id': g.link_id,
            'image_url': g.image.url if g.image else None,
            'group_type': g.group_type,
            'ephemeral_mode': g.ephemeral_mode,
            'members_count': g.participants.count(),
            'unread_count': unread_count,
            'last_message': {
                'text': last_msg.text if last_msg else "Aucun message",
                'sender_nickname': last_msg.sender_nickname if last_msg else None,
                'created_at': last_msg.created_at.strftime('%H:%M') if last_msg else None,
            } if last_msg else None,
        })

    return JsonResponse({'success': True, 'groups': results})


@csrf_exempt
@require_http_methods(["POST"])
def api_create_group(request):
    """Create group with choice of Anonymous or Known identity mode."""
    current_user = get_authenticated_user(request)
    if not current_user:
        return JsonResponse({'success': False, 'error': 'Non authentifié.'}, status=401)

    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            name = data.get('name', '').strip()
            group_type = data.get('group_type', 'anonymous')
            ephemeral_mode = data.get('ephemeral_mode', 'none')
            image = None
        else:
            name = request.POST.get('name', '').strip()
            group_type = request.POST.get('group_type', 'anonymous')
            ephemeral_mode = request.POST.get('ephemeral_mode', 'none')
            image = request.FILES.get('image')

        if not name or len(name) < 2:
            return JsonResponse({'success': False, 'error': 'Le nom du groupe doit comporter au moins 2 caractères.'}, status=400)

        link_id = f"grp_{uuid.uuid4().hex[:8]}"

        group = Group.objects.create(
            creator=current_user,
            name=name,
            image=image,
            link_id=link_id,
            group_type=group_type,
            ephemeral_mode=ephemeral_mode
        )

        session_token = str(uuid.uuid4())
        nickname = current_user.pseudo if group_type == 'known' else get_random_nickname()

        GroupParticipant.objects.create(
            group=group,
            user=current_user if group_type == 'known' else None,
            session_token=session_token,
            nickname=nickname
        )

        return JsonResponse({
            'success': True,
            'group': {
                'id': str(group.id),
                'name': group.name,
                'link_id': group.link_id,
                'group_type': group.group_type,
                'image_url': group.image.url if group.image else None,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
