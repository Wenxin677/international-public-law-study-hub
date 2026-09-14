"""Turn a desktop Khmer TTF into a small webfont for the site.

Subsets to Khmer + Latin + the punctuation the pages actually use, then writes
woff2 (falling back to woff when brotli is unavailable) into docs/assets/fonts/.

Run:  python tools/build_webfont.py "path/to/KhmerOSBattambang-Regular.ttf" khmeros-battambang [--family "KhmerOS Battambang"]
"""
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets" / "fonts"

UNICODES = (
    "U+1780-17FF,U+19E0-19FF,U+200B-200D,U+2018-201D,U+2026,U+2039-203A,"
    "U+0020-007E,U+00A0,U+00AB,U+00BB,U+2010-2015,U+2032-2033,U+2190-2193,"
    "U+21D2,U+2202,U+2206,U+2212,U+2260,U+2264-2265,U+2261,U+00D7,U+00F7,"
    "U+0E3F,U+20AC,U+17DB,U+061B,U+0640,U+1F600-1F64F,U+2600-27BF,U+FE0F"
)


def build(src: pathlib.Path, slug: str) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    if not src.exists():
        print(f"not found: {src}")
        return 2

    tmp = OUT / f".{slug}.subset.ttf"
    args = [
        str(src), f"--output-file={tmp}", f"--unicodes={UNICODES}",
        "--layout-features=*", "--glyph-names", "--notdef-outline",
        "--name-IDs=*", "--drop-tables+=DSIG", "--recalc-bounds", "--no-hinting",
    ]
    subset.main(args)

    for fmt, suffix in (("woff2", "woff2"), ("woff", "woff")):
        out = OUT / f"{slug}.{suffix}"
        try:
            f = TTFont(str(tmp))
            f.flavor = fmt
            f.save(str(out))
            print(f"  {out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB")
            break
        except Exception as e:
            print(f"  {fmt} failed ({e}); trying the next format")
    else:
        out = OUT / f"{slug}.ttf"
        tmp.replace(out)
        print(f"  {out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB (uncompressed)")

    if tmp.exists():
        tmp.unlink()
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(build(pathlib.Path(sys.argv[1]), sys.argv[2]))
