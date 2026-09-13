"""Decode a slide deck from the same course (legacy Word/KhmerOS PDF) to JSON+markdown.

The PDF's own text layer is corrupt (same as the textbook: the ToUnicode is built
against a shifted glyph order), so this reuses tools/recover.py — the glyph
outline recovery that already decodes the textbook exactly.

Run:  python tools/decode_weekly.py "path/to/Week1 - Lessons.pdf" week1
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from recover import Recover

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "extracted" / "weekly"
OUT.mkdir(parents=True, exist_ok=True)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, slug = pathlib.Path(sys.argv[1]), sys.argv[2]
    if not src.exists():
        print(f"not found: {src}")
        return 2

    rec = Recover(src)
    deck = {"source": src.name, "slug": slug, "pages": {}}
    md = [f"# {src.stem}\n"]
    for i in range(len(rec.doc)):
        lines = rec.page_lines(i)                      # [{text, size, font, x, y}, ...]
        deck["pages"][i + 1] = lines
        md.append(f"\n\n<!-- ===== SLIDE {i + 1} ===== -->\n")
        md.extend(ln["text"] for ln in lines)
    (OUT / f"{slug}.json").write_text(json.dumps(deck, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / f"{slug}.md").write_text("\n".join(md), encoding="utf-8")

    print(f"{src.name}: {len(rec.doc)} slides -> extracted/weekly/{slug}.json (+ .md)\n")
    for i in range(len(rec.doc)):
        lines = deck["pages"][i + 1]
        biggest = max((ln["size"] for ln in lines), default=0)
        joined = " ".join(ln["text"] for ln in lines)
        print(f"slide {i + 1:2d} [{len(lines):2d} lines, max {biggest:4.1f}pt]: {joined[:150]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
