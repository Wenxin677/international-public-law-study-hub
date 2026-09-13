"""Find which installed font an embedded subset's glyphs came from, by comparing
glyph OUTLINES. These legacy Word/PowerPoint exports ship a corrupt ToUnicode and
their own glyph order, so shape matching is the only reliable route.

Run:  python tools/match_subset_font.py "deck.pdf" 45 [--decode 1]
"""
import hashlib
import io
import pathlib
import sys

import pymupdf
from fontTools.ttLib import TTFont


def shape_key(font, name):
    """shape signature of one glyph: contours + sorted points (composites recurse by name)"""
    glyf = font.get("glyf")
    if glyf is None:
        return None
    try:
        g = glyf[name]
    except KeyError:
        return None
    if g.isComposite():
        return "C:" + ",".join(c.glyphName for c in g.components)
    try:
        coords, ends, flags = g.getCoordinates(glyf)
    except Exception:
        return None
    if not coords:
        return "empty"
    pts = sorted((round(x), round(y)) for x, y in coords)
    return hashlib.blake2b(("%d|" % len(ends) + ",".join("%d,%d" % p for p in pts)).encode(),
                           digest_size=12).hexdigest()


def index_font(path):
    f = TTFont(str(path), lazy=False)
    idx = {}
    for gn in f.getGlyphOrder():
        k = shape_key(f, gn)
        if k and k not in idx:
            idx[k] = gn
    return f, idx


def decode_with(doc, xref, font, idx, page_no=1):
    """glyph ids -> shapes -> the candidate font's glyph -> Unicode"""
    _n, _e, _t, content = doc.extract_font(xref)
    emb = TTFont(io.BytesIO(content), lazy=False)
    order = emb.getGlyphOrder()
    cmap = {}
    for u, gname in font.getBestCmap().items():
        cmap.setdefault(gname, chr(u))
    spans = [s for s in doc[page_no].get_texttrace() if s["font"] and _n.split("+")[-1].split("-")[0] in s["font"]]
    if not spans:
        spans = doc[page_no].get_texttrace()
    sp = max(spans, key=lambda s: len(s["chars"]))
    out = []
    for c in sp["chars"]:
        gn = order[c[1]] if 0 <= c[1] < len(order) else None
        k = shape_key(emb, gn) if gn else None
        target = idx.get(k) if k else None
        out.append(cmap.get(target, "") if target else "")
    return "".join(out)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    doc = pymupdf.open(sys.argv[1])
    xref = int(sys.argv[2])
    _n, _ext, _t, content = doc.extract_font(xref)
    emb = TTFont(io.BytesIO(content), lazy=False)
    order = emb.getGlyphOrder()
    shapes = {}
    for gn in order:
        k = shape_key(emb, gn)
        if k:
            shapes.setdefault(k, gn)
    print(f"embedded {_n}: {len(order)} glyphs, {len(shapes)} distinct shapes")

    fonts_dir = pathlib.Path(r"C:\Windows\Fonts")
    cands = sorted(p for p in fonts_dir.glob("*.ttf") if "khmer" in p.name.lower() or "noto" in p.name.lower())
    print(f"candidates: {len(cands)}\n")
    results = []
    for path in cands:
        try:
            f, idx = index_font(path)
        except Exception:
            continue
        hits = sum(1 for k in shapes if k in idx)
        if hits:
            results.append((hits, path, f, idx))
    results.sort(key=lambda r: -r[0])
    for hits, path, _f, _i in results[:10]:
        print(f"  {hits * 100 // max(1, len(shapes)):3d}%  ({hits}/{len(shapes)})  {path.name}")
    if not results:
        print("  no installed font matches this subset by shape")
        return 1

    best_hits, best_path, best_font, best_idx = results[0]
    print(f"\nbest: {best_path.name} ({best_hits * 100 // max(1, len(shapes))}% of shapes)")
    if "--decode" in sys.argv:
        page = int(sys.argv[sys.argv.index("--decode") + 1])
        print("decode with it:", decode_with(doc, xref, best_font, best_idx, page)[:110])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
