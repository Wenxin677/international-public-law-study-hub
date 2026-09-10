import pathlib, hashlib, re
import pymupdf
from fontTools.ttLib import TTFont
from io import BytesIO

ROOT = pathlib.Path(__file__).resolve().parents[1]
doc = pymupdf.open(ROOT / "source" / "11 International Public Law Textbook.pdf")

def outline_hash(glyf, name):
    g = glyf[name]
    if g.numberOfContours == 0:
        return None
    coords = getattr(g, "coordinates", None)
    if coords is None:
        g.expand(glyf)
        coords = g.coordinates
    return hashlib.md5(repr((g.numberOfContours, list(coords), list(g.endPtsOfContours))).encode()).hexdigest()

def build_hashes(font):
    glyf = font["glyf"]
    h = {}
    for name in font.getGlyphOrder():
        try:
            hh = outline_hash(glyf, name)
        except Exception:
            hh = None
        if hh:
            h.setdefault(hh, []).append(name)
    return h

sysfonts = {}
for label, path in [("siemreap", r"C:\Windows\Fonts\KhmerOS_siemreap.ttf"),
                    ("muol", r"C:\Windows\Fonts\KhmerOSMoulLight.ttf"),
                    ("muol2", r"C:\Windows\Fonts\KhmerOS_muollight.ttf")]:
    try:
        f = TTFont(path, lazy=False)
        sysfonts[label] = (f, build_hashes(f))
        print(f"loaded {label}: {f['maxp'].numGlyphs} glyphs, {len(sysfonts[label][1])} outline hashes")
    except Exception as e:
        print("fail", label, e)

# embedded subsets
for xref, label in [(33, "pdf-siemreap-subset"), (16, "pdf-muol-subset")]:
    name, ext, stype, content = doc.extract_font(xref)
    sub = TTFont(BytesIO(content), lazy=False)
    print(f"\n== {label}: subset {name} glyphs={sub['maxp'].numGlyphs}")
    subh = build_hashes(sub)
    order = sub.getGlyphOrder()
    for match_label, (sf, sh) in sysfonts.items():
        hits = 0; total = 0
        for gname in order:
            try:
                hh = outline_hash(sub["glyf"], gname)
            except Exception:
                hh = None
            if not hh: continue
            total += 1
            if hh in sh: hits += 1
        if total:
            print(f"   vs {match_label}: {hits}/{total} glyph outlines matched ({100*hits/total:.0f}%)")
