"""Turn the supplied artwork into the site's logo set.

The source is a round badge on a near-white background.  For a dark UI we need the
badge to stand on its own, so the outside of the circle is made transparent with an
anti-aliased edge (4x supersampled mask), and a favicon / apple-touch icon are derived
from the same master.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter

SRC = pathlib.Path.home() / "AppData/Roaming/Hermes/composer-images/ChatGPT_Image_Sep_11_2026_12_21_22_AM_e188b1.png"
OUT = pathlib.Path(__file__).resolve().parents[1] / "docs/assets/img"
OUT.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
print("source:", img.size, img.mode)

# ---- 1. locate the badge: everything that is not near-white background -------------
px = img.convert("RGB")
w, h = px.size
small = px.resize((min(w, 400), min(h, 400)))
bg = small.getpixel((2, 2))
print("background sample:", bg)

mask = Image.new("L", small.size, 0)
sp = small.load()
mp = mask.load()
for y in range(small.size[1]):
    for x in range(small.size[0]):
        r, g, b = sp[x, y]
        # distance from the background colour: the badge is strongly coloured
        if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 60:
            mp[x, y] = 255
bbox_small = mask.getbbox()
scale = w / small.size[0]
bbox = tuple(int(v * scale) for v in bbox_small)
print("badge bounding box:", bbox)

x0, y0, x1, y1 = bbox
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
radius = max(x1 - x0, y1 - y0) / 2

# ---- 2. build an anti-aliased circular alpha mask -----------------------------------
SS = 4  # supersample factor
big = Image.new("L", (w * SS, h * SS), 0)
d = ImageDraw.Draw(big)
d.ellipse([(cx - radius) * SS, (cy - radius) * SS, (cx + radius) * SS, (cy + radius) * SS], fill=255)
alpha = big.resize((w, h), Image.LANCZOS)

rounded = img.copy()
rounded.putalpha(alpha)

# trim to the circle so the asset has no dead margin
pad = 2
box = (int(cx - radius) - pad, int(cy - radius) - pad, int(cx + radius) + pad, int(cy + radius) + pad)
circle = rounded.crop(box)
print("circle:", circle.size)

# ---- 3. exports ---------------------------------------------------------------------
def save(im, name):
    p = OUT / name
    im.save(p, "PNG", optimize=True)
    print(f"  {name:24s} {im.size[0]}x{im.size[1]}  {p.stat().st_size/1024:.1f} KB")

save(circle.resize((512, 512), Image.LANCZOS), "logo.png")
save(circle.resize((192, 192), Image.LANCZOS), "logo-192.png")
save(circle.resize((96, 96), Image.LANCZOS), "logo-96.png")
save(circle.resize((64, 64), Image.LANCZOS), "favicon.png")

# apple touch icon keeps a soft background (iOS masks corners itself)
touch = Image.new("RGBA", (180, 180), (238, 244, 255, 255))
touch.paste(circle.resize((176, 176), Image.LANCZOS), (2, 2), circle.resize((176, 176), Image.LANCZOS))
save(touch, "apple-touch-icon.png")

# a wide banner for the landing hero: badge on a transparent strip
banner = Image.new("RGBA", (760, 300), (0, 0, 0, 0))
badge = circle.resize((300, 300), Image.LANCZOS)
glow = badge.filter(ImageFilter.GaussianBlur(18))
banner.paste(glow, (0, 0), glow)
banner.paste(badge, (0, 0), badge)
save(banner, "logo-glow.png")
print("done")
