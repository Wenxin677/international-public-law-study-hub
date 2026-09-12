"""Turn the supplied artwork into the site's logo set.

The source is a round badge that is already cut out (transparent outside the
circle), so this only finds the badge, centres it in a square, and exports the
set the site references: logo.png (nav / chat avatar), logo-192 / logo-96,
favicon.png, apple-touch-icon.png (with a soft background for iOS) and
logo-glow.png (the landing hero strip).
"""
import pathlib
from PIL import Image, ImageFilter

SRC = pathlib.Path.home() / "AppData/Roaming/Hermes/composer-images/094c99e2-adab-4de2-adc0-b85435a1101f_50e0a6.png"
OUT = pathlib.Path(__file__).resolve().parents[1] / "docs/assets/img"
OUT.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
print("source:", img.size, img.mode)

# ---- 1. the badge is whatever is not transparent ---------------------------------
bbox = img.getchannel("A").getbbox()
print("badge bounding box:", bbox)
x0, y0, x1, y1 = bbox
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
half = max(x1 - x0, y1 - y0) / 2 + 2          # 2px breathing room, keeps it square
box = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
badge = img.crop(box)
print("badge:", badge.size, "  centre:", (round(cx), round(cy)))

# a rounded badge stays round: crop to the circle so the corners stay transparent
badge = badge.resize((1024, 1024), Image.LANCZOS)


def save(im, name):
    p = OUT / name
    im.save(p, "PNG", optimize=True)
    print(f"  {name:24s} {im.size[0]}x{im.size[1]}  {p.stat().st_size/1024:.1f} KB")


# ---- 2. exports --------------------------------------------------------------------
save(badge.resize((512, 512), Image.LANCZOS), "logo.png")
save(badge.resize((192, 192), Image.LANCZOS), "logo-192.png")
save(badge.resize((96, 96), Image.LANCZOS), "logo-96.png")
save(badge.resize((64, 64), Image.LANCZOS), "favicon.png")

# apple touch icon: iOS puts its own rounded mask on top, so give it a soft backdrop
touch = Image.new("RGBA", (180, 180), (238, 244, 255, 255))
small = badge.resize((176, 176), Image.LANCZOS)
touch.paste(small, (2, 2), small)
save(touch, "apple-touch-icon.png")

# a wide banner for the landing hero: badge with its own glow, transparent strip
banner = Image.new("RGBA", (760, 300), (0, 0, 0, 0))
hero = badge.resize((300, 300), Image.LANCZOS)
glow = hero.filter(ImageFilter.GaussianBlur(18))
banner.paste(glow, (0, 0), glow)
banner.paste(hero, (0, 0), hero)
save(banner, "logo-glow.png")

# ---- 3. sanity: the corners must be transparent, the middle must not be ------------
check = Image.open(OUT / "logo.png")
a = check.getchannel("A")
corners = [a.getpixel(p) for p in [(2, 2), (509, 2), (2, 509), (509, 509)]]
middle = a.getpixel((256, 256))
print("alpha corners:", corners, " middle:", middle)
assert all(c == 0 for c in corners), "the badge is not round — corners are not transparent"
assert middle > 200, "the badge looks empty in the middle"
print("done")
