#!/usr/bin/env python3
"""Generate OG image for Anima Companion — 1200x630 PNG."""

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1200, 630

# Brand colors
BG_COLOR = (250, 250, 250)  # #FAFAFA
ORANGE = (249, 115, 22)      # #F97316
PURPLE = (124, 58, 237)      # #7C3AED
DARK = (30, 30, 30)          # near-black text
GRAY = (120, 120, 120)       # muted text

img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)

# Try to load fonts
try:
    font_title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 72)
    font_tagline = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 36)
    font_small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
    font_brand = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
    font_emoji = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 120)
except:
    font_title = ImageFont.load_default()
    font_tagline = ImageFont.load_default()
    font_small = ImageFont.load_default()
    font_brand = ImageFont.load_default()
    font_emoji = ImageFont.load_default()

# === Background gradient effect (subtle orange→purple) ===
for y in range(HEIGHT):
    r = int(250 + (249 - 250) * (y / HEIGHT) * 0.3)
    g = int(250 + (115 - 250) * (y / HEIGHT) * 0.3)
    b = int(250 + (22 - 250) * (y / HEIGHT) * 0.3)
    draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

# === Decorative blurred orbs (simplified) ===
draw.ellipse([-100, -100, 300, 300], fill=(249, 115, 22, 20))
draw.ellipse([900, 400, 1300, 800], fill=(124, 58, 237, 20))

# === Paw print logo (left side) ===
cx, cy = 200, 315  # center of paw print

# 4 toe pads (purple)
toe_positions = [(cx-35, cy-60), (cx-10, cy-85), (cx+20, cy-85), (cx+45, cy-60)]
for tx, ty in toe_positions:
    draw.ellipse([tx-18, ty-25, tx+18, ty+25], fill=PURPLE)

# Central pad (orange) — larger
draw.ellipse([cx-40, cy+5, cx+40, cy+85], fill=ORANGE)

# White heart in center of orange pad
heart_cx, heart_cy = cx, cy + 45
# Simple heart shape
draw.ellipse([heart_cx-12, heart_cy-8, heart_cx-2, heart_cy+2], fill=(255, 255, 255))
draw.ellipse([heart_cx+2, heart_cy-8, heart_cx+12, heart_cy+2], fill=(255, 255, 255))
draw.polygon([(heart_cx-12, heart_cy-3), (heart_cx+12, heart_cy-3), (heart_cx, heart_cy+12)], fill=(255, 255, 255))

# === Text content (right side) ===
text_x = 380

# Brand name (uppercase, bold)
draw.text((text_x, 130), 'ANIMA COMPANION', font=font_brand, fill=DARK)

# Main title
draw.text((text_x, 180), 'Elevating', font=font_title, fill=DARK)
# Gradient text (simulate by drawing orange then purple offset)
draw.text((text_x, 260), 'Animal Health', font=font_title, fill=ORANGE)

# Tagline
draw.text((text_x, 370), 'Suplemen & vitamin hewan peliharaan', font=font_tagline, fill=GRAY)
draw.text((text_x, 420), 'rekomendasi dokter hewan.', font=font_tagline, fill=GRAY)

# Trust badges
badge_y = 500
badges = ['515+ Klinik Resmi', 'BPOM Terdaftar', '4.9★ Rating']
badge_x = text_x
for badge in badges:
    # Draw pill background
    bbox = draw.textbbox((0, 0), badge, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.rounded_rectangle([badge_x-8, badge_y-4, badge_x+tw+16, badge_y+32], radius=16, fill=(240, 240, 240))
    draw.text((badge_x+8, badge_y), badge, font=font_small, fill=DARK)
    badge_x += tw + 40

# Hashtag
draw.text((text_x, 560), '#PawrentHebatAnabulSehat', font=font_small, fill=PURPLE)

# Save
img.save('/home/z/my-project/public/og-image.png', 'PNG', optimize=True)
print('OG image saved: /home/z/my-project/public/og-image.png')
print(f'Size: {img.size}')
