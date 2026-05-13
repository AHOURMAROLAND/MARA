#!/usr/bin/env python
"""
Script pour generer les logos MARA (favicon, PWA icons, etc.)
Lance une seule fois : python generate_logos.py
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_logo(size, filename, is_maskable=False):
    """Cree un logo MARA de la taille specifiee"""
    
    # Couleurs
    pink = (255, 80, 120)
    orange = (255, 140, 66)
    white = (255, 255, 255)
    
    # Creer l'image
    if is_maskable:
        # Pour maskable, on a besoin d'une zone de securite
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    else:
        img = Image.new('RGBA', (size, size), white)
    
    draw = ImageDraw.Draw(img)
    
    # Dessiner le gradient (approxime avec des rectangles)
    for i in range(size):
        ratio = i / size
        r = int(pink[0] * (1 - ratio) + orange[0] * ratio)
        g = int(pink[1] * (1 - ratio) + orange[1] * ratio)
        b = int(pink[2] * (1 - ratio) + orange[2] * ratio)
        draw.rectangle([(0, i), (size, i + 1)], fill=(r, g, b, 255))
    
    # Charger la font
    try:
        font_size = int(size * 0.5)
        font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.5))
        except:
            font = ImageFont.load_default()
    
    # Dessiner le texte "M"
    text = "M"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    # Ombre
    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 100))
    # Texte blanc
    draw.text((x, y), text, font=font, fill=white)
    
    # Sauvegarder
    os.makedirs('static/img', exist_ok=True)
    img.save(f'static/img/{filename}', 'PNG')
    print(f"✅ {filename} ({size}x{size}) genere")


def main():
    print("Genération des logos MARA...")
    
    # Favicon
    create_logo(16, 'favicon-16x16.png')
    create_logo(32, 'favicon-32x32.png')
    
    # PWA Icons
    create_logo(96, 'mara-96x96.png')
    create_logo(192, 'mara-192x192.png')
    create_logo(512, 'mara-512x512.png')
    
    # Maskable icons (pour PWA avec safe zone)
    create_logo(192, 'mara-maskable-192x192.png', is_maskable=True)
    create_logo(512, 'mara-maskable-512x512.png', is_maskable=True)
    
    # Apple touch icon
    create_logo(180, 'apple-touch-icon.png')
    
    print("\n✅ Tous les logos ont ete generes !")
    print("📁 Fichiers crees dans static/img/")


if __name__ == '__main__':
    main()
