from PIL import Image, ImageDraw, ImageFont
import io
import os
from django.conf import settings


def resize_image(image_file, max_width=1200, max_height=800):
    """
    Redimensionne une image pour qu'elle rentre dans les limites.
    Preserve l'aspect ratio.
    """
    img = Image.open(image_file)
    
    # Convertir en RGB si necessaire
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGB')
    
    # Calculer les nouvelles dimensions
    img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    
    return img


def add_watermark_to_profile(image_file):
    """
    Ajoute le watermark 'MARA' en bas a droite
    avec un degrade rose/orange sur la photo de profil.
    Retourne un fichier image pret a sauvegarder.
    """
    img = Image.open(image_file).convert("RGBA")
    width, height = img.size

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    text = "MARA"
    font_size = max(20, width // 12)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", font_size)
        except:
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = width - text_width - 15
    y = height - text_height - 15

    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 120))
    draw.text((x, y), text, font=font, fill=(255, 80, 120, 220))

    combined = Image.alpha_composite(img, overlay).convert("RGB")

    output = io.BytesIO()
    combined.save(output, format="JPEG", quality=90)
    output.seek(0)
    return output


def process_and_save_profile_photo(instance, image_file):
    """
    Watermarke la photo et la sauvegarde.
    A appeler dans le signal post_save de UserProfile.
    """
    watermarked = add_watermark_to_profile(image_file)
    filename = f"profiles/mara_{instance.pseudo}.jpg"
    full_path = os.path.join(settings.MEDIA_ROOT, filename)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'wb') as f:
        f.write(watermarked.read())
    return filename


def optimize_message_image(image_file, max_width=800, max_height=600):
    """
    Optimise une image de message pour l'affichage.
    Redimensionne et compresse pour un chargement rapide.
    """
    img = resize_image(image_file, max_width, max_height)
    
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=85, optimize=True)
    output.seek(0)
    return output
