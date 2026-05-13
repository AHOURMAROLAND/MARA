#!/usr/bin/env python
"""
Script pour generer l'image Open Graph par defaut pour MARA.
Lance une seule fois : python generate_og.py
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Cree l'image 1200x630 (ratio OG standard)
img = Image.new('RGB', (1200, 630), color=(255, 80, 120))
draw = ImageDraw.Draw(img)

# Essaie de charger les fonts
try:
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
    font_subtitle = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
except:
    try:
        font_title = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 120)
        font_subtitle = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 36)
    except:
        font_title = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()

# Titre "MARA"
draw.text((600, 250), "MARA", font=font_title, fill="white", anchor="mm")

# Sous-titre
draw.text((600, 370), "Message At Random Anonymous", font=font_subtitle, fill=(255, 200, 210), anchor="mm")

# Cree le dossier s'il n'existe pas
os.makedirs('static/img', exist_ok=True)

# Sauvegarde l'image
img.save('static/img/mara-og-default.jpg', quality=95)
print("✅ Image OG generee : static/img/mara-og-default.jpg")
