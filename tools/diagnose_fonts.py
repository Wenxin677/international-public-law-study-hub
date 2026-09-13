"""Diagnose a legacy Khmer PDF's fonts: which subset fonts it embeds, whether the
system KhmerOS font of the same name still maps glyph-for-glyph (by outline), and
therefore whether tools/recover.py's name-based table is valid for that file.

Run:  python tools/diagnose_fonts.py "path/to/deck.pdf"
"""
import hashlib
import io
import pathlib
import sys
from collections import Counter, defaultdict

import pymupdf
from fontTools.ttLib import TTFont

SYS = {
    "Siemreap": r"C:\Windows\Fonts\KhmerOS_siemreap.ttf",
    "MuolLight": r"C:\Windows\Fonts\KhmerOS_muollight.ttf",
    "battambang": r"C:\Windows\Fonts\KhmerOS_battambang.ttf",
}


def outline_key(glyph_set, name):
    """a hash of the glyph's actual drawing, so two fonts can be compared by shape"""
    try:
        g = glyph_set[name]
    except KeyError:
        return None
    try:
        if g.isComposite():
            return "composite:" + ",".join(c.glyphName for c in g.components)
        coords, endPts, flags = g.getCoordinates(glyph_set)
        return hashlib.blake2b(
            ("%d|%d|" % (len(coords), len(endPts)) + ",".join("%d,%d" % (x, y) for x, y in coords)).encode(),
            digest_size=16).hexdigest()
    except Exception:
        return None


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    doc = pymupdf.open(sys.argv[1])
    print(f"{pathlib.Path(sys.argv[1]).name}: {doc.page_count} pages\n")

    # what fonts are on the pages, and how often
    used = Counter()
    for pno in range(doc.page_count):
        for span in doc[pno].get_texttrace():
            if span["text"] if "text" in span else "":
                pass
        for f in doc.get_page_fonts(pno, full=True):
            used[(f[0], f[3])] += 0   # xref, basefont
    xrefs = defaultdict(list)
    for pno in range(doc.page_count):
        for f in doc.get_page_fonts(pno, full=True):
            xrefs[f[0]].append(f[3])

    print(f"embedded font objects: {len(xrefs)}")
    for xref, names in xrefs.items():
        name = sorted(set(names))[0]
        try:
            info = doc.extract_font(xref)
        except Exception as e:
            print(f"  xref {xref} {name}: cannot extract ({e})")
            continue
        _n, ext, _t, content = info
        print(f"\n  xref {xref}  {name}  ({ext}, {len(content) // 1024} KB)")
        if ext not in ("ttf", "otf", "cff"):
            print("     not a TTF/OTF — skipped")
            continue
        try:
            emb = TTFont(io.BytesIO(content), lazy=False)
        except Exception as e:
            print(f"     cannot parse: {e}")
            continue
        cand = None
        for label, path in SYS.items():
            if label.lower() in name.lower():
                cand = (label, path)
        if not cand:
            print("     no system font matches this name — name-based table cannot work")
            continue
        label, path = cand
        if not pathlib.Path(path).exists():
            print(f"     system font {path} missing")
            continue
        sys_font = TTFont(path, lazy=False)
        egs, sgs = emb.getGlyphSet(), sys_font.getGlyphSet()
        sys_keys = {}
        for gn in sys_font.getGlyphOrder():
            k = outline_key(sgs, gn)
            if k and k not in sys_keys:
                sys_keys[k] = gn
        order = emb.getGlyphOrder()
        matched = sum(1 for gn in order if outline_key(egs, gn) in sys_keys)
        print(f"     system candidate: {label}")
        print(f"     glyphs in subset: {len(order)} · outline-matched to {label}: {matched} "
              f"({matched * 100 // max(1, len(order))}%)")
        # does the ORDER match? that is what recover.py assumes
        same_order = 0
        for i, gn in enumerate(order[:400]):
            k = outline_key(egs, gn)
            if k and i < len(sys_font.getGlyphOrder()) and outline_key(sgs, sys_font.getGlyphOrder()[i]) == k:
                same_order += 1
        print(f"     position-for-position identical to the system order (first 400): {same_order}/400")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
