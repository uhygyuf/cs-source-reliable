#!/usr/bin/env python
"""Generate cs-source-reliable icon PNGs (512 and 180 px) with Pillow.

Design: rounded blue gradient tile, white shield, blue book, green check.
Original artwork, no third-party assets. Output goes to ../assets/.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

SIZE = 512
# Diagonal gradient: #2f6fed -> #1b3fa8
c0 = np.array([47, 111, 237], dtype=np.float32)
c1 = np.array([27, 63, 168], dtype=np.float32)
y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
t = (x + y) / (2 * (SIZE - 1))
grad = (c0[None, None, :] * (1 - t[..., None]) + c1[None, None, :] * t[..., None]).astype(np.uint8)
img = Image.fromarray(grad, "RGB").convert("RGBA")

# Rounded-square mask
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=96, fill=255)
img.putalpha(mask)

# Shield silhouette (white, slightly translucent)
shield = [(256, 40), (432, 108), (432, 248), (256, 384), (80, 248), (80, 108)]
shield_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(shield_layer).polygon(shield, fill=(255, 255, 255, 242))
img = Image.alpha_composite(img, shield_layer)
d = ImageDraw.Draw(img)

# Book (blue): cover + spine lines
book_blue = (47, 111, 237, 255)
d.rounded_rectangle([150, 170, 330, 292], radius=18, fill=book_blue)
d.line([186, 202, 186, 260], fill=(255, 255, 255, 255), width=10)
for yy in (212, 236, 260):
    d.line([204, yy, 300, yy], fill=(255, 255, 255, 235), width=9)

# Check (green) over the shield's lower right
check = (34, 160, 107, 255)
d.line([(322, 322), (352, 352), (414, 282)], fill=check, width=26, joint="curve")

img.save(OUT / "icon-512.png")
img.resize((180, 180), Image.LANCZOS).save(OUT / "icon-180.png")
print("wrote", OUT / "icon-512.png", "and", OUT / "icon-180.png")
