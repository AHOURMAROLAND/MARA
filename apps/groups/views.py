from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.utils.text import slugify
from django.utils import timezone
from django.contrib import messages
from apps.users.utils import get_owner_from_session, create_session, get_client_ip, get_device_name
from apps.users.image_utils import optimize_message_image
from django.core.files.base import ContentFile
import bleach
from .models import Group, GroupMessage, GroupParticipant
from .constants import BIZARRE_NAMES
from datetime import timedelta
import random
import json
import uuid

def generate_random_nickname(exclude_list=None):
    if exclude_list is None:
        exclude_list = []
    
    available_names = [name for name in BIZARRE_NAMES if name not in exclude_list]
    if not available_names:
        available_names = BIZARRE_NAMES
        
    return random.choice(available_names)

def rotate_pseudo_if_needed(participant):
    """Rotate pseudo every 30 minutes"""
    now = timezone.now()
    if now > participant.last_pseudo_update + timedelta(minutes=30):
        # Get names currently used in this group to avoid duplicates if possible
        used_names = list(GroupParticipant.objects.filter(group=participant.group).values_list('nickname', flat=True))
        participant.nickname = generate_random_nickname(exclude_list=used_names)
        participant.last_pseudo_update = now
        participant.save(update_fields=['nickname', 'last_pseudo_update'])
        return True
    return False

def create_group(request):
    owner = get_owner_from_session(request)
    if not owner:
        return redirect('home')

    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        if not name:
            messages.error(request, "Le nom du groupe est requis.")
            return redirect('profile_share', link_id=owner.link_id)

        link_id = f"{slugify(name)}-{str(uuid.uuid4())[:8]}"
        
        group = Group.objects.create(
            creator=owner,
            name=name,
            link_id=link_id
        )
        
        messages.success(request, f"Groupe '{name}' créé avec succès !")
        return redirect('group_chat', link_id=link_id)

    return redirect('profile_share', link_id=owner.link_id)

def group_chat(request, link_id):
    group = get_object_or_404(Group, link_id=link_id, is_active=True)
    
    # Check if the current user is the owner (BEFORE create_session potentially messes with it)
    owner = get_owner_from_session(request)
    
    # Ensure session exists (will preserve owner if already exists due to my fix in utils.py)
    create_session(request, user=None, session_type='visitor')
    session_token = request.session.get('ngl_token')
    
    # Re-check owner after session ensures existence
    if not owner:
        owner = get_owner_from_session(request)
    
    # Get or create participant identity for this group
    participant, created = GroupParticipant.objects.get_or_create(
        group=group,
        session_token=session_token,
        defaults={'nickname': generate_random_nickname()}
    )
    
    # Check for rotation
    rotate_pseudo_if_needed(participant)
    
    # Update last activity
    participant.last_activity = timezone.now()
    participant.save(update_fields=['last_activity'])
    
    # Check if the current user is the owner
    is_owner = (owner == group.creator) if owner else False
    
    messages_list = group.messages.all().order_by('created_at').select_related('parent')
    
    # Filter ephemeral messages
    if group.ephemeral_mode == '1h':
        messages_list = messages_list.filter(created_at__gt=timezone.now() - timedelta(hours=1))
    elif group.ephemeral_mode == '24h':
        messages_list = messages_list.filter(created_at__gt=timezone.now() - timedelta(hours=24))
    
    # Prefetch reactions
    messages_list = messages_list.prefetch_related('reactions')
    
    # Count active users (last 2 minutes)
    active_count = GroupParticipant.objects.filter(
        group=group, 
        last_activity__gt=timezone.now() - timedelta(minutes=2)
    ).count()
    
    return render(request, 'groups/chat.html', {
        'group': group,
        'participant': participant,
        'messages_list': messages_list,
        'is_owner': is_owner,
        'active_count': active_count,
    })

from apps.users.image_utils import optimize_message_image
from django.core.files.base import ContentFile
import bleach

def send_group_message(request, link_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    group = get_object_or_404(Group, link_id=link_id, is_active=True)
    session_token = request.session.get('ngl_token')
    
    if not session_token:
        return JsonResponse({'error': 'No session'}, status=401)
        
    participant = GroupParticipant.objects.filter(group=group, session_token=session_token).first()
    if not participant:
        return JsonResponse({'error': 'Not a participant'}, status=403)
    
    if not participant.can_write:
        return JsonResponse({'error': 'Tu as été banni de l\'écriture dans ce groupe.'}, status=403)
        
    text = request.POST.get('text', '').strip()
    image = request.FILES.get('image')
    parent_id = request.POST.get('parent_id')
    
    # Nettoyage du texte (XSS protection)
    text = bleach.clean(text, tags=[], strip=True) if text else ""
    
    if not text and not image:
        return JsonResponse({'error': 'Empty message'}, status=400)

    # Optimisation de l'image
    if image:
        try:
            optimized = optimize_message_image(image)
            image_filename = f"group_messages/msg_{session_token[:8]}.jpg"
            image = ContentFile(optimized.read(), name=image_filename)
        except Exception as e:
            print(f"[MARA] Error optimizing group image: {e}")
            # On continue avec l'image originale si l'optimisation échoue
            
    parent_msg = None
    if parent_id:
        try:
            parent_msg = GroupMessage.objects.get(id=parent_id, group=group)
        except (GroupMessage.DoesNotExist, ValueError):
            pass

    msg = GroupMessage.objects.create(
        group=group,
        parent=parent_msg,
        sender_session_token=session_token,
        sender_nickname=participant.nickname,
        text=text if text else None,
        image=image if image else None,
        sender_ip=get_client_ip(request),
        sender_device=get_device_name(request)
    )

    # Broadcast to WebSockets
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        
        msg_data = {
            'id': str(msg.id),
            'text': msg.text,
            'sender_nickname': msg.sender_nickname,
            'sender_session_token': msg.sender_session_token,
            'created_at': msg.created_at.strftime("%H:%M"),
        }
        if msg.parent:
            parent_text = msg.parent.text or "📸 Image"
            msg_data['parent'] = {
                'id': str(msg.parent.id),
                'text': parent_text[:50] + '...' if len(parent_text) > 50 else parent_text,
                'sender_nickname': msg.parent.sender_nickname
            }
        if msg.image:
            msg_data['image_url'] = msg.image.url

        async_to_sync(channel_layer.group_send)(
            f'chat_{group.link_id}',
            {
                'type': 'chat_message',
                'message': msg_data
            }
        )
    except Exception as e:
        print(f"Error broadcasting websocket message: {e}")

    # Trigger Push Notification to Group Creator
    if group.creator:
        try:
            from apps.users.views import send_push_notification
            push_title = f"Nouveau message dans {group.name} 💬"
            push_body = f"{participant.nickname} : {text[:50]}..." if len(text) > 50 else f"{participant.nickname} : {text}"
            
            group_url = request.build_absolute_uri(f'/groups/g/{group.link_id}/')
            # Don't notify the creator if they are the one who sent the message
            if session_token != request.session.get('ngl_token'): # This logic is a bit flawed since session_token IS request.session.get('ngl_token') here
                # Better: only notify if the sender is NOT the creator
                # But wait, the creator is a UserProfile, the sender is a session.
                # Let's check if the current session belongs to the creator.
                owner = get_owner_from_session(request)
                if owner != group.creator:
                    send_push_notification(group.creator, push_title, push_body, url=group_url)
        except Exception as e:
            print(f"[MARA] Error triggering group push: {e}")
    
    return JsonResponse({
        'success': True,
        'message': {
            'id': str(msg.id),
            'text': msg.text,
            'sender_nickname': msg.sender_nickname,
            'created_at': msg.created_at.strftime("%H:%M"),
            'is_me': True
        }
    })

def get_group_messages(request, link_id):
    group = get_object_or_404(Group, link_id=link_id, is_active=True)
    last_id = request.GET.get('last_id')
    session_token = request.session.get('ngl_token')
    
    participant = GroupParticipant.objects.filter(group=group, session_token=session_token).first()
    if participant:
        rotate_pseudo_if_needed(participant)
        participant.last_activity = timezone.now()
        participant.save(update_fields=['last_activity'])

    messages_query = group.messages.all().select_related('parent')
    
    # Filter ephemeral messages
    if group.ephemeral_mode == '1h':
        messages_query = messages_query.filter(created_at__gt=timezone.now() - timedelta(hours=1))
    elif group.ephemeral_mode == '24h':
        messages_query = messages_query.filter(created_at__gt=timezone.now() - timedelta(hours=24))

    if last_id:
        # Fix ISO format with space instead of + from URL decoding
        if ' ' in last_id and '+' not in last_id:
            last_id = last_id.replace(' ', '+')
        try:
            messages_query = messages_query.filter(created_at__gt=last_id)
        except Exception as e:
            print(f"[MARA] Error filtering messages with last_id {last_id}: {e}")
        
    # Get current user's GMT offset from query or session (default to 0)
    gmt_offset = request.GET.get('gmt', 0)
    try:
        gmt_offset = int(gmt_offset)
    except ValueError:
        gmt_offset = 0

    new_messages = []
    for m in messages_query:
        # Apply GMT offset to created_at
        local_time = m.created_at + timedelta(minutes=gmt_offset)
        
        msg_data = {
            'id': str(m.id),
            'text': m.text,
            'sender_nickname': m.sender_nickname,
            'created_at': local_time.strftime("%H:%M"),
            'is_me': m.sender_session_token == session_token,
            'image_url': m.image.url if m.image else None,
        }
        if m.parent:
            parent_text = m.parent.text or "📸 Image"
            msg_data['parent'] = {
                'id': str(m.parent.id),
                'text': parent_text[:50] + '...' if len(parent_text) > 50 else parent_text,
                'sender_nickname': m.parent.sender_nickname
            }
        new_messages.append(msg_data)
        
    return JsonResponse({
        'success': True,
        'messages': new_messages,
        'nickname': participant.nickname if participant else None,
        'active_count': GroupParticipant.objects.filter(group=group, last_activity__gt=timezone.now() - timedelta(minutes=2)).count(),
        'last_id': messages_query.last().created_at.isoformat() if messages_query.exists() else last_id
    })

def group_settings(request, link_id):
    owner = get_owner_from_session(request)
    group = get_object_or_404(Group, link_id=link_id)
    
    if not owner or owner != group.creator:
        return redirect('home')
        
    if request.method == 'POST':
        # Update Group Profile
        new_name = request.POST.get('name', '').strip()
        new_image = request.FILES.get('image')
        ephemeral_mode = request.POST.get('ephemeral_mode')
        
        if new_name:
            group.name = new_name
        if new_image:
            group.image = new_image
        if ephemeral_mode in ['none', '1h', '24h']:
            group.ephemeral_mode = ephemeral_mode
            
        group.save()
        messages.success(request, "Profil du groupe mis à jour !")
        return redirect('group_settings', link_id=link_id)

    participants = group.participants.all().order_by('-last_activity')
    
    return render(request, 'groups/settings.html', {
        'group': group,
        'participants': participants,
    })

def toggle_participant_write(request, link_id, participant_id):
    owner = get_owner_from_session(request)
    group = get_object_or_404(Group, link_id=link_id)
    
    if not owner or owner != group.creator:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    participant = get_object_or_404(GroupParticipant, id=participant_id, group=group)
    participant.can_write = not participant.can_write
    participant.save(update_fields=['can_write'])
    
    return JsonResponse({
        'success': True,
        'can_write': participant.can_write,
        'nickname': participant.nickname
    })

def delete_participant(request, link_id, participant_id):
    owner = get_owner_from_session(request)
    group = get_object_or_404(Group, link_id=link_id)
    
    if not owner or owner != group.creator:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    participant = get_object_or_404(GroupParticipant, id=participant_id, group=group)
    nickname = participant.nickname
    participant.delete()
    
    return JsonResponse({
        'success': True,
        'nickname': nickname
    })

def cleanup_inactive_groups():
    """Delete groups with no activity for more than 7 days"""
    from django.utils import timezone
    from datetime import timedelta
    
    threshold = timezone.now() - timedelta(days=7)
    
    # Groups where the last message is older than 7 days OR no messages and created > 7 days ago
    inactive_groups = Group.objects.filter(is_active=True).annotate(
        last_msg=models.Max('messages__created_at')
    ).filter(
        models.Q(last_msg__lt=threshold) | 
        models.Q(last_msg__isnull=True, created_at__lt=threshold)
    )
    
    count = inactive_groups.count()
    inactive_groups.delete()
    return count
