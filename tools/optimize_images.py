"""Shrink what the site ships, and remove what nothing references.

Two jobs:
  1. re-encode the logo — it is displayed at 40-72 px but weighed 262 KB
  2. delete assets that no HTML/JS/CSS file references (an old cover image, the
     legacy page scans from the first build, two unused logo sizes)

Run:  python tools/optimize_images.py [--dry-run]
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"
IMG = SITE / "assets" / "img"

# files kept on purpose even though no literal reference exists
KEEP = {"assets/img/logo.png", "assets/img/favicon.png", "assets/img/apple-touch-icon.png"}


def referenced_text() -> str:
    parts = []
    for p in list(SITE.glob("*.html")) + list((SITE / "assets/js").glob("*.js")) + list((SITE / "assets/css").glob("*.css")):
        parts.append(p.read_text(encoding="utf-8", errors="replace"))
    return "\n".join(parts)


def unreferenced() -> list[pathlib.Path]:
    text = referenced_text()
    refs = set(re.findall(r"([\w./-]+\.(?:js|css|png|jpg|jpeg|svg|webp|json|pdf))", text))
    out = []
    for p in sorted((SITE / "assets" / "img").rglob("*")):
        if not p.is_file():
            continue
        rel = str(p.relative_to(SITE)).replace("\\", "/")
        if rel in KEEP:
            continue
        if p.name not in refs and rel not in refs:
            out.append(p)
    return out


def shrink_logo(dry: bool) -> None:
    try:
        from PIL import Image
    except ImportError:
        print("Pillow not installed — run: pip install pillow")
        return
    for name, size, colours in (("logo.png", 256, 128), ("apple-touch-icon.png", 180, 128)):
        path = IMG / name
        if not path.exists():
            continue
        before = path.stat().st_size
        img = Image.open(path).convert("RGBA")
        if img.size != (size, size):
            img = img.resize((size, size), Image.LANCZOS)
        # a badge logo is flat art: a small palette cuts the bytes a lot
        alpha = img.getchannel("A")
        quant = img.convert("RGB").quantize(colors=colours, method=Image.MEDIANCUT).convert("RGBA")
        quant.putalpha(alpha)
        if dry:
            print(f"  would rebuild {name}: {before/1024:.1f} KB -> ? (dry run)")
            continue
        quant.save(path, "PNG", optimize=True)
        after = path.stat().st_size
        print(f"  {name}: {before/1024:.1f} KB -> {after/1024:.1f} KB ({100 - after * 100 / before:.0f}% smaller)")


def main() -> int:
    dry = "--dry-run" in sys.argv

    print("logo:")
    shrink_logo(dry)

    dead = unreferenced()
    total = sum(p.stat().st_size for p in dead)
    print(f"\nunreferenced: {len(dead)} file(s), {total/1024:.0f} KB")
    for p in dead:
        print(f"  {p.stat().st_size/1024:7.1f} KB  {p.relative_to(SITE)}")
        if not dry:
            p.unlink()
    if dead and not dry:
        print(f"deleted {len(dead)} file(s)")

    # drop now-empty directories
    if not dry:
        for d in sorted((SITE / "assets" / "img").rglob("*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
