from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, Http404
from django.conf import settings
from apps.users.models import UserProfile
from apps.users.utils import create_session, get_owner_from_session, random_visitor_count, get_client_ip, get_device_name
from apps.users.views import send_push_notification
from .models import Message
import os


def send_message(request, link_id):
    recipient = get_object_or_404(UserProfile, link_id=link_id)

    create_session(request, user=None, session_type='visitor')

    if request.method == 'POST':
        text = request.POST.get('text', '').strip()
        image = request.FILES.get('image')
        caption = request.POST.get('caption', '').strip()

        if not text and not image:
            return render(request, 'send.html', {
                'recipient': recipient,
                'visitor_count': random_visitor_count(),
                'error': 'Ecris un message ou envoie une image !'
            })

        # Check content mode restrictions
        if text and not recipient.accepts_text():
            return render(request, 'send.html', {
                'recipient': recipient,
                'visitor_count': random_visitor_count(),
                'error': 'Ce profil n\'accepte que les images !'
            })

        if image and not recipient.accepts_images():
            image = None

        msg = Message.objects.create(
            recipient=recipient,
            text=text if text else None,
            image=image if image else None,
            image_caption=caption if (image and caption) else None,
            sender_ip=get_client_ip(request),
            sender_device=get_device_name(request),
            sender_session_token=request.session.get('ngl_token', ''),
        )

        # Send push notification to recipient
        try:
            inbox_url = f'/u/{recipient.link_id}/'
            send_push_notification(
                user=recipient,
                title='Nouveau message anonyme !',
                body='Tu as recu un message sur MARA',
                url=inbox_url,
                data={'messageId': str(msg.id)}
            )
        except Exception:
            pass  # Don't block message sending if push fails

        return render(request, 'sent_success.html', {'recipient': recipient})

    return render(request, 'send.html', {
        'recipient': recipient,
        'visitor_count': random_visitor_count(),
    })


def inbox(request, link_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msgs = Message.objects.filter(recipient=owner, is_reported=False)
    msgs.filter(is_read=False).update(is_read=True)

    return render(request, 'inbox.html', {
        'user': owner,
        'messages': msgs,
    })


def message_detail(request, link_id, msg_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    return render(request, 'message_detail.html', {'msg': msg, 'user': owner})


def delete_message(request, link_id, msg_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    if request.method == 'POST':
        if msg.image:
            if os.path.isfile(msg.image.path):
                os.remove(msg.image.path)
        msg.delete()

    return redirect('inbox', link_id=link_id)


def report_message(request, link_id, msg_id):
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        return redirect('home')

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)
    msg.is_reported = True
    msg.save()
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

    except Exception:
        # Fallback: redirect to original image
        return redirect(msg.image.url)


def download_message_card(request, link_id, msg_id):
    """Generate NGL-style message card image for download"""
    owner = get_owner_from_session(request)
    if not owner or owner.link_id != link_id:
        raise Http404

    msg = get_object_or_404(Message, id=msg_id, recipient=owner)

    try:
        from PIL import Image, ImageDraw, ImageFont
        import io

        # Create card image (NGL style)
        width, height = 600, 800
        img = Image.new('RGB', (width, height), color='#F5F5F5')
        draw = ImageDraw.Draw(img)

        # Draw card background
        card_margin = 40
        card_top = 100
        card_height = 500
        card_width = width - (card_margin * 2)

        # White card background with rounded corners effect
        draw.rounded_rectangle(
            [card_margin, card_top, width - card_margin, card_top + card_height],
            radius=30,
            fill='white'
        )

        # Draw gradient header
        header_height = 140
        for y in range(card_top, card_top + header_height):
            # Gradient from pink to orange
            r = int(255 - ((y - card_top) / header_height) * 30)
            g = int(45 + ((y - card_top) / header_height) * 62)
            b = int(85 - ((y - card_top) / header_height) * 43)
            draw.line([(card_margin, y), (width - card_margin, y)], fill=(r, g, b))

        # Header text
        try:
            header_font = ImageFont.truetype("arial.ttf", 28)
            message_font = ImageFont.truetype("arial.ttf", 36)
            date_font = ImageFont.truetype("arial.ttf", 20)
        except:
            header_font = ImageFont.load_default()
            message_font = ImageFont.load_default()
            date_font = ImageFont.load_default()

        # Draw header text
        header_text = "send me anonymous\nmessages!"
        bbox = draw.textbbox((0, 0), header_text, font=header_font)
        text_width = bbox[2] - bbox[0]
        text_x = (width - text_width) // 2
        draw.text((text_x, card_top + 40), header_text, fill='white', font=header_font, align='center')

        # Draw message content
        content_top = card_top + header_height + 40

        if msg.text:
            # Wrap text
            words = msg.text.split()
            lines = []
            current_line = []
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

            # Draw wrapped text
            y_offset = content_top
            for line in lines[:8]:  # Limit to 8 lines
                bbox = draw.textbbox((0, 0), line, font=message_font)
                text_width = bbox[2] - bbox[0]
                text_x = (width - text_width) // 2
                draw.text((text_x, y_offset), line, fill='#1a1a1a', font=message_font)
                y_offset += 50

        # Draw date
        date_text = msg.created_at.strftime("%d/%m/%Y à %H:%M")
        bbox = draw.textbbox((0, 0), date_text, font=date_font)
        text_width = bbox[2] - bbox[0]
        text_x = (width - text_width) // 2
        draw.text((text_x, card_top + card_height - 40), date_text, fill='#999999', font=date_font)

        # Draw MARA branding at bottom
        try:
            brand_font = ImageFont.truetype("arial.ttf", 24)
        except:
            brand_font = ImageFont.load_default()

        brand_text = "MARA - Messages anonymes"
        bbox = draw.textbbox((0, 0), brand_text, font=brand_font)
        text_width = bbox[2] - bbox[0]
        text_x = (width - text_width) // 2
        draw.text((text_x, height - 80), brand_text, fill='#999999', font=brand_font)

        # Save to bytes
        output = io.BytesIO()
        img.save(output, format='PNG', quality=95)
        output.seek(0)

        response = HttpResponse(output.read(), content_type='image/png')
        response['Content-Disposition'] = f'attachment; filename="mara_message_{msg_id}.png"'
        return response

    except Exception as e:
        # Fallback: redirect to message detail
        return redirect('message_detail', link_id=link_id, msg_id=msg_id)
