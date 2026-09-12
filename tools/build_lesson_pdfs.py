"""One PDF per lesson — only that lesson's pages, taken from the source document.

A lesson like 1.2 spans pages 25-26 of the textbook, so its slide file is exactly
those two pages: the student reads the lesson, not the whole chapter.

Output: docs/library/lessons/<lesson-id>.pdf
Page ranges come from docs/data/lessons.js, so a lesson's slides can never drift
from the lesson itself.  (The chapter-wide PDFs from build_chapter_pdfs.py stay
available as a "read the whole chapter" link.)
"""
import json
import pathlib
import sys

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"
LIB = SITE / "library"
OUT = LIB / "lessons"

SOURCE_OF = {
    "ref-eccc": LIB / "Reference_KR_Law_as_amended_27_Oct_2004_Eng.pdf",
    "ref-paris": LIB / "Reference_Paris_Convention_0.pdf",
}
TEXTBOOK = LIB / "11_International_Public_Law_Textbook.pdf"

chapters = json.loads((SITE / "data/lessons.js").read_text(encoding="utf-8")
                      .split("=", 1)[1].rsplit(";", 1)[0].strip())
OUT.mkdir(parents=True, exist_ok=True)

total = 0
count = 0
print(f"{'lesson':10s} {'pages':>9s} {'file':16s} {'size':>9s}  pages in pdf")
for ch in chapters:
    src_path = SOURCE_OF.get(ch["id"], TEXTBOOK)
    src = pymupdf.open(src_path)
    for les in ch["lessons"]:
        first, last = les["pages"]["from"], les["pages"]["to"]
        if last > src.page_count:
            print(f"  !! {les['id']}: pages {first}-{last} go past the end of {src_path.name} ({src.page_count})")
            sys.exit(1)
        part = pymupdf.open()
        part.insert_pdf(src, from_page=first - 1, to_page=last - 1)
        part.set_metadata({"title": f"{les['id']} — {les['title']['en']}",
                           "producer": "RoboCL lesson extract"})
        dest = OUT / f"{les['id']}.pdf"
        part.save(dest, deflate=True, garbage=4)
        n = part.page_count
        part.close()
        want = last - first + 1
        ok = "✓" if n == want else "✗"
        total += dest.stat().st_size
        count += 1
        print(f"{les['id']:10s} {first:>4}-{last:<4} {dest.name:16s} {dest.stat().st_size/1024:7.1f} KB  {n} {ok}")
        if n != want:
            print("   !! page count mismatch")
            sys.exit(1)
    src.close()

print(f"\n{count} lesson PDFs, {total/1024/1024:.2f} MB total")
