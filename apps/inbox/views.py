from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, Http404, JsonResponse
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.contrib import messages
from apps.users.models import UserProfile
from apps.users.utils import create_session, get_owner_from_session, random_visitor_count, get_client_ip, get_device_name
from apps.users.image_utils import optimize_message_image
from .models import Message
import os
from django.core.files.base import ContentFile
import bleach
import logging

logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
MAX_TEXT_LENGTH = 500


def get_client_ip_address(request):
    """Recupere l'IP du client (compatible proxy)"""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def send_message(request, link_id):
    recipient = get_object_or_404(UserProfile, link_id=link_id)

    create_session(request, user=None, session_type='visitor')

    if request.method == 'POST':
        # Rate limiting par IP
        ip = get_client_ip_address(request)
        cache_key = f"send_limit_{ip}_{link_id}"
        count = cache.get(cache_key, 0)

        if count >= 5:  # max 5 messages / 10 min par IP
            logger.warning(f"[MARA] Rate limit atteint pour IP {ip} sur {link_id}")
            return render(request, 'send.html', {
                'recipient': recipient,
                'visitor_count': random_visitor_count(),
                'error': 'Trop de messages. Reessaie dans 10 minutes.'
            })

        cache.set(cache_key, count + 1, timeout=600)

        text = request.POST.get('text', '').strip()
        image = request.FILES.get('image')
        caption = request.POST.get('caption', '').strip()

        # Nettoyage du texte (XSS protection)
        text = bleach.clean(text, tags=[], strip=True)
        if len(text) > MAX_TEXT_LENGTH:
            text = text[:MAX_TEXT_LENGTH]

        if not text and not image:
            return render(request, 'send.html', {
                'recipient': recipient,
                'visitor_count': random_visitor_count(),
                'error': 'Ecris un message ou envoie une image !'
            })

        if image and not recipient.accepts_images():
            image = None

        # Validation de l'image
        if image:
            # Verifier la taille
            if image.size > MAX_IMAGE_SIZE:
                logger.warning(f"[MARA] Image trop lourde : {image.size} bytes")
                return render(request, 'send.html', {
                    'recipient': recipient,
                    'visitor_count': random_visitor_count(),
                    'error': 'Image trop lourde (max 5 MB)'
                })

            # Verifier le type MIME
            if image.content_type not in ALLOWED_IMAGE_TYPES:
                logger.warning(f"[MARA] Type MIME non autorise : {image.content_type}")
                return render(request, 'send.html', {
                    'recipient': recipient,
                    'visitor_count': random_visitor_count(),
                    'error': 'Format non autorise (JPEG, PNG, GIF, WebP seulement)'
                })

            # Optimise l'image
            try:
                optimized = optimize_message_image(image)
                image_filename = f"messages/msg_{request.session.get('ngl_token', 'unknown')[:8]}.jpg"
                image = ContentFile(optimized.read(), name=image_filename)
            except Exception as e:
                logger.error(f"[MARA] Erreur optimisation image : {e}")
                return render(request, 'send.html', {
                    'recipient': recipient,
                    'visitor_count': random_visitor_count(),
                    'error': 'Erreur lors du traitement de l\'image'
                })

        msg = Message.objects.create(
            recipient=recipient,
            text=text if text else None,
            image=image if image else None,
            image_caption=caption if (image and caption and caption.lower() != 'none') else None,
            sender_ip=get_client_ip(request),
            sender_device=get_device_name(request),
            sender_session_token=request.session.get('ngl_token', ''),
        )

        # Trigger Web Push Notification
        try:
            from apps.users.views import send_push_notification, send_telegram_notification
            push_title = "Nouveau message sur MARA 💌"
            push_body = "Tu as reçu un nouveau message anonyme !"
            if text:
                # Preview first 30 chars
                preview = text[:30] + "..." if len(text) > 30 else text
                push_body = f"Nouveau message : {preview}"
            elif image:
                push_body = "Tu as reçu une nouvelle image anonyme ! 📸"
            
            inbox_url = request.build_absolute_uri(f'/m/inbox/{recipient.link_id}/{msg.id}/')
            
            # Send Web Push
            send_push_notification(recipient, push_title, push_body, url=inbox_url)
            
            # Send Telegram
            tg_message = f"<b>{push_title}</b>\n\n{push_body}\n\n<a href='{inbox_url}'>Voir le message</a>"
            send_telegram_notification(recipient, tg_message)
            
        except Exception as e:
            logger.error(f"[MARA] Error triggering push: {e}")

        logger.info(f"[MARA] Message envoye a {recipient.pseudo} par {ip}")
        return render(request, 'sent_success.html', {'recipient': recipient})

    # Rate limiting sur la page d'envoi (anti-scraping)
    ip = get_client_ip_address(request)
    cache_key_view = f"view_limit_{ip}"
    count_view = cache.get(cache_key_view, 0)

    if count_view >= 30:  # max 30 pages vues / minute
        logger.warning(f"[MARA] Anti-scraping : trop de vues pour IP {ip}")
        response = HttpResponse("Trop de requetes. Reessaie plus tard.", status=429)
        return response

    cache.set(cache_key_view, count_view + 1, timeout=60)

    return render(request, 'send.html', {
        'recipient': recipient,
        'visitor_count': random_visitor_count(),
    })


def inbox(request, link_id):
    from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
    
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    messages_list = Message.objects.filter(
        recipient=owner,
        is_reported=False,
        is_archived=False
    ).order_by('-created_at')
    unread_count = messages_list.filter(is_read=False).count()
    
    # Pagination - 20 messages per page
    paginator = Paginator(messages_list, 20)
    page = request.GET.get('page', 1)
    
    try:
        messages = paginator.page(page)
    except PageNotAnInteger:
        messages = paginator.page(1)
    except EmptyPage:
        messages = paginator.page(paginator.num_pages)
    
    # Get groups created by the user or where the user is a participant
    from apps.groups.models import Group
    from django.db.models import Max, Case, When, F, Value, IntegerField
    session_token = request.session.get('ngl_token')
    
    # Helper function to get groups with unread counts
    def get_groups_with_unread(groups_queryset):
        groups_with_unread = []
        for group in groups_queryset:
            participant = group.participants.filter(session_token=session_token).first()
            unread_count = 0
            if participant and participant.last_read_message_id:
                # Count messages after last_read_message_id
                last_read_msg = group.messages.filter(id=participant.last_read_message_id).first()
                if last_read_msg:
                    unread_count = group.messages.filter(created_at__gt=last_read_msg.created_at).count()
            elif participant:
                # No last_read_message_id means all messages are unread
                unread_count = group.messages.count()
            
            groups_with_unread.append({
                'group': group,
                'unread_count': unread_count,
                'last_activity': group.last_message_time or group.last_activity
            })
        return groups_with_unread
    
    # --- Active Groups ---
    # Groups created by user (excluding archived)
    created_groups = owner.created_groups.filter(is_archived=False)
    
    # Groups joined by user (via session token, excluding archived)
    joined_groups = Group.objects.filter(participants__session_token=session_token, is_archived=False).exclude(creator=owner)
    
    # Combine and annotate with unread counts
    user_groups = (created_groups | joined_groups).distinct()
    
    # Annotate with last message time
    user_groups = user_groups.annotate(
        last_message_time=Max('messages__created_at')
    )
    
    # Sort by last_activity (last message time), then by created_at
    user_groups = user_groups.order_by('-last_message_time', '-last_activity', '-created_at')
    groups_with_unread = get_groups_with_unread(user_groups)
    
    # --- Archived Groups ---
    # Groups created by user (archived)
    archived_created_groups = owner.created_groups.filter(is_archived=True)
    
    # Groups joined by user (via session token, archived)
    archived_joined_groups = Group.objects.filter(participants__session_token=session_token, is_archived=True).exclude(creator=owner)
    
    # Combine and annotate
    archived_user_groups = (archived_created_groups | archived_joined_groups).distinct()
    
    # Annotate with last message time
    archived_user_groups = archived_user_groups.annotate(
        last_message_time=Max('messages__created_at')
    )
    
    # Sort by archived_at (newest first)
    archived_user_groups = archived_user_groups.order_by('-archived_at')
    archived_groups_with_unread = get_groups_with_unread(archived_user_groups)

    return render(request, 'inbox.html', {
        'user': owner,
        'messages': messages,
        'unread_count': unread_count,
        'user_groups': groups_with_unread,
        'archived_groups': archived_groups_with_unread,
    })


def message_detail(request, link_id, msg_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    
    # Marquer comme lu a l'ouverture
    if not msg.is_read:
        msg.is_read = True
        msg.save(update_fields=['is_read'])
    
    return render(request, 'message_detail.html', {'msg': msg, 'user': owner})


def delete_message(request, link_id, msg_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    if request.method == 'POST':
        msg.is_archived = True
        msg.archived_at = timezone.now()
        msg.save(update_fields=['is_archived', 'archived_at'])
        messages.success(request, 'Message archivé avec succès !')

    return redirect('inbox', link_id=link_id)


def unarchive_message(request, link_id, msg_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    if request.method == 'POST':
        msg.is_archived = False
        msg.archived_at = None
        msg.save(update_fields=['is_archived', 'archived_at'])
        messages.success(request, 'Message désarchivé avec succès !')

    return redirect('archived_messages', link_id=link_id)


def archived_messages(request, link_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    archived_list = Message.objects.filter(
        recipient=owner,
        is_archived=True,
        is_reported=False
    ).order_by('-archived_at')
    
    # Get archived groups
    from apps.groups.models import Group
    from django.db.models import Max
    session_token = request.session.get('ngl_token')
    
    # Helper function to get groups with unread counts
    def get_groups_with_unread(groups_queryset):
        groups_with_unread = []
        for group in groups_queryset:
            participant = group.participants.filter(session_token=session_token).first()
            unread_count = 0
            if participant and participant.last_read_message_id:
                # Count messages after last_read_message_id
                last_read_msg = group.messages.filter(id=participant.last_read_message_id).first()
                if last_read_msg:
                    unread_count = group.messages.filter(created_at__gt=last_read_msg.created_at).count()
            elif participant:
                # No last_read_message_id means all messages are unread
                unread_count = group.messages.count()
            
            groups_with_unread.append({
                'group': group,
                'unread_count': unread_count,
                'last_activity': group.last_message_time or group.last_activity
            })
        return groups_with_unread
    
    # --- Archived Groups ---
    # Groups created by user (archived)
    archived_created_groups = owner.created_groups.filter(is_archived=True)
    
    # Groups joined by user (via session token, archived)
    archived_joined_groups = Group.objects.filter(participants__session_token=session_token, is_archived=True).exclude(creator=owner)
    
    # Combine and annotate
    archived_user_groups = (archived_created_groups | archived_joined_groups).distinct()
    
    # Annotate with last message time
    archived_user_groups = archived_user_groups.annotate(
        last_message_time=Max('messages__created_at')
    )
    
    # Sort by archived_at (newest first)
    archived_user_groups = archived_user_groups.order_by('-archived_at')
    archived_groups_with_unread = get_groups_with_unread(archived_user_groups)

    return render(request, 'archived.html', {
        'user': owner,
        'messages': archived_list,
        'archived_groups': archived_groups_with_unread,
    })


def check_new_messages(request):
    owner = get_owner_from_session(request)
    if not owner:
        return JsonResponse({'success': False})
        
    last_id = request.GET.get('last_id', '0')
    
    if last_id == '0' or not last_id:
        last_msg = Message.objects.filter(recipient=owner).order_by('created_at').last()
        return JsonResponse({
            'success': True, 
            'has_new': False, 
            'last_id': str(last_msg.id) if last_msg else '0'
        })
        
    try:
        # Validate if last_id is a valid UUID before filtering
        from django.core.exceptions import ValidationError
        try:
            import uuid
            uuid.UUID(str(last_id))
        except (ValueError, TypeError):
            # Not a valid UUID, reset to 0 logic
            last_msg = Message.objects.filter(recipient=owner).order_by('created_at').last()
            return JsonResponse({
                'success': True, 
                'has_new': False, 
                'last_id': str(last_msg.id) if last_msg else '0'
            })

        # Get the reference message to find newer ones
        ref_msg = Message.objects.filter(recipient=owner, id=last_id).first()
        if ref_msg:
            new_msgs = Message.objects.filter(recipient=owner, created_at__gt=ref_msg.created_at).order_by('created_at')
        else:
            # If ref message not found (maybe deleted), just return latest
            last_msg = Message.objects.filter(recipient=owner).order_by('created_at').last()
            return JsonResponse({
                'success': True, 
                'has_new': False, 
                'last_id': str(last_msg.id) if last_msg else '0'
            })
    except Exception as e:
        logger.error(f"[MARA] Error in check_new_messages: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

    if new_msgs.exists():
        msg = new_msgs.last()
        return JsonResponse({
            'success': True,
            'has_new': True,
            'last_id': str(msg.id),
            'text': msg.text[:40] + '...' if (msg.text and len(msg.text) > 40) else (msg.text or "📸 Image"),
            'link_id': owner.link_id,
        })
        
    return JsonResponse({'success': True, 'has_new': False, 'last_id': last_id})


def mark_as_read(request, msg_id):
    owner = get_owner_from_session(request)
    if not owner:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    msg.is_read = True
    msg.save()
    return JsonResponse({'success': True})


def report_message(request, link_id, msg_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    msg.is_reported = True
    msg.save()
    logger.info(f"[MARA] Message signale : {msg_id}")
    return redirect('inbox', link_id=link_id)


def download_image(request, msg_id):
    owner = get_owner_from_session(request)
    if not owner:
        raise Http404

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    if not msg.image:
        raise Http404

    try:
        from PIL import Image, ImageDraw, ImageFont
        import io
        import requests

        # Download image from URL (works with Cloudinary or local)
        image_url = msg.image.url
        if image_url.startswith('/'):
            image_url = request.build_absolute_uri(image_url)
        
        response_img = requests.get(image_url, timeout=10)
        response_img.raise_for_status()
        
        img = Image.open(io.BytesIO(response_img.content)).convert('RGBA')
        draw = ImageDraw.Draw(img)
        app_name = getattr(settings, 'APP_NAME', 'MARA')

        text = f"via {app_name}"
        draw.text((img.width - 150, img.height - 30), text, fill=(255, 255, 255, 180))

        output = io.BytesIO()
        img.save(output, format='PNG')
        output.seek(0)

        response = HttpResponse(output.read(), content_type='image/png')
        response['Content-Disposition'] = f'attachment; filename="mara_image_{msg_id}.png"'
        return response

    except Exception as e:
        logger.error(f"[MARA] Erreur telechargement image {msg_id} : {e}")
        # Fallback: redirect to original image
        return redirect(msg.image.url)


def download_message_card(request, link_id, msg_id):
    """Generate MARA-style message card image for download"""
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        raise Http404

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)

    try:
        from PIL import Image, ImageDraw, ImageFont
        import io

        width, height = 600, 800
        img = Image.new('RGB', (width, height), color='#F5F5F5')
        draw = ImageDraw.Draw(img)

        card_margin = 40
        card_top = 100
        card_height = 500
        card_width = width - (card_margin * 2)

        draw.rounded_rectangle(
            [card_margin, card_top, width - card_margin, card_top + card_height],
            radius=30,
            fill='white'
        )

        header_height = 140
        for y in range(card_top, card_top + header_height):
            r = int(255 - ((y - card_top) / header_height) * 30)
            g = int(45 + ((y - card_top) / header_height) * 62)
            b = int(85 - ((y - card_top) / header_height) * 43)
            draw.line([(card_margin, y), (width - card_margin, y)], fill=(r, g, b))

        try:
            header_font = ImageFont.truetype("arial.ttf", 28)
            message_font = ImageFont.truetype("arial.ttf", 36)
            date_font = ImageFont.truetype("arial.ttf", 20)
            brand_font = ImageFont.truetype("arial.ttf", 24)
        except Exception:
            header_font = ImageFont.load_default()
            message_font = ImageFont.load_default()
            date_font = ImageFont.load_default()
            brand_font = ImageFont.load_default()

        header_text = "envoie moi des messages anonymes !"
        bbox = draw.textbbox((0, 0), header_text, font=header_font)
        text_x = (width - (bbox[2] - bbox[0])) // 2
        draw.text((text_x, card_top + 50), header_text, fill='white', font=header_font)

        content_top = card_top + header_height + 40
        if msg.text:
            words = msg.text.split()
            lines, current_line = [], []
            for word in words:
                test_line = ' '.join(current_line + [word])
                bbox = draw.textbbox((0, 0), test_line, font=message_font)
                if bbox[2] - bbox[0] <= card_width - 60:
                    current_line.append(word)
                else:
                    if current_line:
                        lines.append(' '.join(current_line))
                    current_line = [word]
            if current_line:
                lines.append(' '.join(current_line))

            y_offset = content_top
            for line in lines[:8]:
                bbox = draw.textbbox((0, 0), line, font=message_font)
                text_x = (width - (bbox[2] - bbox[0])) // 2
                draw.text((text_x, y_offset), line, fill='#1a1a1a', font=message_font)
                y_offset += 50

        date_text = msg.created_at.strftime("%d/%m/%Y à %H:%M")
        bbox = draw.textbbox((0, 0), date_text, font=date_font)
        text_x = (width - (bbox[2] - bbox[0])) // 2
        draw.text((text_x, card_top + card_height - 40), date_text, fill='#999999', font=date_font)

        brand_text = "MARA - Messages anonymes"
        bbox = draw.textbbox((0, 0), brand_text, font=brand_font)
        text_x = (width - (bbox[2] - bbox[0])) // 2
        draw.text((text_x, height - 80), brand_text, fill='#999999', font=brand_font)

        output = io.BytesIO()
        img.save(output, format='PNG', quality=95)
        output.seek(0)

        response = HttpResponse(output.read(), content_type='image/png')
        response['Content-Disposition'] = f'attachment; filename="mara_message_{msg_id}.png"'
        return response

    except Exception as e:
        logger.error(f"[MARA] Erreur génération card {msg_id} : {e}")
        return redirect('message_detail', link_id=link_id, msg_id=msg_id)
