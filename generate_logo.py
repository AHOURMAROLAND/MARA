"""
MARA Logo Generator
Generates all required favicon and PWA icon sizes.
"""
from PIL import Image, ImageDraw, ImageFont
import os, math

# Brand colors
COLOR_PINK   = (255, 80, 120)    # #FF5078
COLOR_ORANGE = (255, 140, 66)    # #FF8C42
WHITE        = (255, 255, 255)
FONT_BOLD    = "C:/Windows/Fonts/arialbd.ttf"
OUT_DIR      = "static/img"

os.makedirs(OUT_DIR, exist_ok=True)


def make_gradient(size):
    """Create a 135° pink→orange gradient image."""
    img = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)  # 135° diagonal
            r = int(COLOR_PINK[0] + (COLOR_ORANGE[0] - COLOR_PINK[0]) * t)
            g = int(COLOR_PINK[1] + (COLOR_ORANGE[1] - COLOR_PINK[1]) * t)
            b = int(COLOR_PINK[2] + (COLOR_ORANGE[2] - COLOR_PINK[2]) * t)
            draw.point((x, y), fill=(r, g, b, 255))
    return img


def rounded_mask(size, radius_frac=0.18):
    """Create a rounded-rectangle mask."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = int(size * radius_frac)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask


def add_text(img, text, font_size_frac=0.38, y_offset_frac=0.0):
    """Draw centred white text on img (in-place)."""
    size = img.width
    font_size = max(8, int(size * font_size_frac))
    try:
        font = ImageFont.truetype(FONT_BOLD, font_size)
    except Exception:
        font = ImageFont.load_default()

    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1] + int(size * y_offset_frac)
    draw.text((x, y), text, font=font, fill=WHITE)


def save_rgba_as_png(img, path, apply_mask=True, radius_frac=0.18):
    if apply_mask:
        mask = rounded_mask(img.width, radius_frac)
        result = Image.new("RGBA", img.size, (0, 0, 0, 0))
        result.paste(img, mask=mask)
    else:
        result = img
    result.save(path)
    print(f"  Saved {path}")


def save_as_png_flat(img, path, bg=(255, 255, 255)):
    """Save as flat PNG (no transparency) for formats that need it."""
    flat = Image.new("RGB", img.size, bg)
    flat.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
    flat.save(path)
    print(f"  Saved {path}")


# ── Standard icons (rounded square) ──────────────────────────────────────────

def make_icon(size, text, font_frac=0.38, maskable=False):
    """Maskable icons have extra padding (safe zone = center 80%)."""
    if maskable:
        # Draw logo at 80% of the full size, centered
        inner = int(size * 0.72)
        base = make_gradient(size)          # full gradient bg
        inner_img = make_gradient(inner)
        # No text here – apply text on full canvas with reduced font
        add_text(base, text, font_size_frac=font_frac * 0.72)
        return base
    else:
        img = make_gradient(size)
        add_text(img, text, font_size_frac=font_frac)
        return img

print("Generating MARA logo assets...")

# 512×512 — full MARA text
img512 = make_icon(512, "MARA", font_frac=0.30)
save_rgba_as_png(img512, f"{OUT_DIR}/mara-512x512.png", radius_frac=0.15)

# 192×192 — full MARA text
img192 = make_icon(192, "MARA", font_frac=0.30)
save_rgba_as_png(img192, f"{OUT_DIR}/mara-192x192.png", radius_frac=0.15)

# 96×96 — full MARA text (shortcut icon)
img96 = make_icon(96, "MARA", font_frac=0.30)
save_rgba_as_png(img96, f"{OUT_DIR}/mara-96x96.png", radius_frac=0.15)

# Maskable 512×512
img512m = make_icon(512, "MARA", font_frac=0.30, maskable=True)
save_rgba_as_png(img512m, f"{OUT_DIR}/mara-maskable-512x512.png", apply_mask=False)

# Maskable 192×192
img192m = make_icon(192, "MARA", font_frac=0.30, maskable=True)
save_rgba_as_png(img192m, f"{OUT_DIR}/mara-maskable-192x192.png", apply_mask=False)

# Apple Touch Icon 180×180 (needs to be flat square for iOS)
img180 = make_icon(180, "MARA", font_frac=0.30)
add_text(img180, "", 0)  # no-op, already drawn
img180f = Image.new("RGBA", (180, 180))
grad180 = make_gradient(180)
add_text(grad180, "MARA", font_size_frac=0.30)
grad180.save(f"{OUT_DIR}/apple-touch-icon.png")
print(f"  Saved {OUT_DIR}/apple-touch-icon.png")

# Favicon 32×32 — "M" letter only
img32 = make_gradient(32)
add_text(img32, "M", font_size_frac=0.62)
save_rgba_as_png(img32, f"{OUT_DIR}/favicon-32x32.png", radius_frac=0.15)

# Favicon 16×16 — "M" letter only
img16 = make_gradient(16)
add_text(img16, "M", font_size_frac=0.65)
save_rgba_as_png(img16, f"{OUT_DIR}/favicon-16x16.png", radius_frac=0.15)

print("\nAll MARA logo assets generated successfully!")
