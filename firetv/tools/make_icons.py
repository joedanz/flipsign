#!/usr/bin/env python3
"""Draws the Fire TV banner (320x180) and launcher icons as split-flap tiles.

Run from firetv/ after changing the look:  python3 tools/make_icons.py
Needs Pillow and a bold sans font (macOS Helvetica by default, or pass a .ttf path).
The generated PNGs are committed, so building the app does not need this script.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

RES = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'main', 'res')
FONT = sys.argv[1] if len(sys.argv) > 1 else '/System/Library/Fonts/HelveticaNeue.ttc'
COLORS = ['#d6312b', '#f0782d', '#f6c53d', '#3aa655', '#2f7fd3', '#7f4fbf']  # matches the board's colour tiles


def font(px):
    try:
        return ImageFont.truetype(FONT, px, index=1)  # index 1 = Bold in HelveticaNeue.ttc
    except Exception:
        return ImageFont.truetype(FONT, px)


def tile(draw, x, y, w, h, ch=None, color=None, f=None):
    top, bottom = (color, color) if color else ('#2a2a2a', '#222222')
    draw.rectangle([x, y, x + w - 1, y + h // 2 - 1], fill=top)
    draw.rectangle([x, y + h // 2, x + w - 1, y + h - 1], fill=bottom)
    if ch:
        draw.text((x + w / 2, y + h / 2 + h * 0.03), ch, fill='#f2f2f2', font=f, anchor='mm')
    draw.line([x, y + h // 2, x + w - 1, y + h // 2], fill='#000000', width=max(1, h // 40))


def banner():
    w, h, scale = 320, 180, 4  # draw large, then downsample for smooth edges
    img = Image.new('RGB', (w * scale, h * scale), '#0d0d0d')
    d = ImageDraw.Draw(img)
    word = 'FLIPSIGN'
    tw, th, gap = 34 * scale, 48 * scale, 3 * scale
    x0 = (w * scale - (len(word) * tw + (len(word) - 1) * gap)) // 2
    y0 = 52 * scale
    f = font(34 * scale)
    for i, ch in enumerate(word):
        tile(d, x0 + i * (tw + gap), y0, tw, th, ch, f=f)
    # a strip of colour tiles underneath, like the board's colour flaps
    cw, ch_ = 22 * scale, 10 * scale
    cx0 = (w * scale - (len(COLORS) * cw + (len(COLORS) - 1) * gap)) // 2
    for i, c in enumerate(COLORS):
        tile(d, cx0 + i * (cw + gap), y0 + th + 14 * scale, cw, ch_, color=c)
    out = os.path.join(RES, 'drawable-xhdpi')
    os.makedirs(out, exist_ok=True)
    img.resize((w, h), Image.LANCZOS).save(os.path.join(out, 'banner.png'), optimize=True)


def icon(size, folder):
    scale = 4
    s = size * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 8, fill='#0d0d0d')
    # two flap tiles, "FS", filling the square (Fire OS letterboxes square icons in a wide slot)
    pad, gap = s // 14, s // 28
    tw, th = (s - 2 * pad - gap) // 2, s - 4 * pad
    f = font(int(tw * 1.05))
    for i, ch in enumerate('FS'):
        tile(d, pad + i * (tw + gap), 2 * pad, tw, th, ch, f=f)
    out = os.path.join(RES, folder)
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, 'ic_launcher.png'), optimize=True)


if __name__ == '__main__':
    banner()
    for size, folder in [(48, 'mipmap-mdpi'), (72, 'mipmap-hdpi'), (96, 'mipmap-xhdpi'), (144, 'mipmap-xxhdpi'), (192, 'mipmap-xxxhdpi')]:
        icon(size, folder)
    print('icons written to', os.path.normpath(RES))
