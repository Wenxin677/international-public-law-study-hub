"""Split the three source PDFs into one PDF per chapter, so a lesson can embed
   its own chapter instead of the whole book.

   Output: docs/library/chapters/<chapter-id>.pdf  (deterministic names, so the
   lesson template just builds the URL from the chapter id).
   The page ranges come from docs/data/lessons.js — the same data the lesson page
   renders — so the PDF can never drift from the chapter it belongs to.
"""
import json
import pathlib
import sys

import fitz  # pymupdf

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"
LIB = SITE / "library"
OUT = LIB / "chapters"

# which source document each chapter is built from
SOURCE_OF = {
    "textbook": LIB / "11_International_Public_Law_Textbook.pdf",
    "ref-eccc": LIB / "Reference_KR_Law_as_amended_27_Oct_2004_Eng.pdf",
    "ref-paris": LIB / "Reference_Paris_Convention_0.pdf",
}

chapters = json.loads((SITE / "data/lessons.js").read_text(encoding="utf-8")
                      .split("=", 1)[1].rsplit(";", 1)[0].strip())
OUT.mkdir(parents=True, exist_ok=True)
total = 0
print(f"{'chapter':10s} {'pages':>9s}  {'file':22s} {'size':>9s}  pdf pages")
for ch in chapters:
    cid = ch["id"]
    src_path = SOURCE_OF.get(cid) or SOURCE_OF["textbook"]
    first, last = ch["pages"]["from"], ch["pages"]["to"]
    src = fitz.open(src_path)
    part = fitz.open()
    part.insert_pdf(src, from_page=first - 1, to_page=last - 1)
    title = ch["title"]["en"]
    part.set_metadata({"title": f"{cid} — {title}", "producer": "RoboCL chapter extract"})
    dest = OUT / f"{cid}.pdf"
    part.save(dest, deflate=True, garbage=4)
    pages = part.page_count
    part.close()
    src.close()
    size = dest.stat().st_size
    total += size
    ok = "✓" if pages == last - first + 1 else "✗"
    print(f"{cid:10s} {first:>4}-{last:<4}  {dest.name:22s} {size/1024:7.1f} KB  {pages} {ok}")
    if pages != last - first + 1:
        print(f"   !! expected {last - first + 1} pages, got {pages}")
        sys.exit(1)

print(f"\n{len(chapters)} chapter PDFs, {total/1024/1024:.2f} MB total")

# how much content each lesson carries (what the new template can show)
lessons = [l for ch in chapters for l in ch["lessons"]]
def n_list(l, k):  v = l.get(k);  return len(v) if isinstance(v, list) else 0
def n_pair(l, k):  v = l.get(k);  return len(v.get("km", [])) if isinstance(v, dict) else 0
print("\nper lesson content:")
print(f"  objectives   min {min(n_pair(l,'objectives') for l in lessons)}  max {max(n_pair(l,'objectives') for l in lessons)}")
print(f"  plain points min {min(n_pair(l,'plain') for l in lessons)}  max {max(n_pair(l,'plain') for l in lessons)}")
print(f"  key points   min {min(n_pair(l,'keyPoints') for l in lessons)}  max {max(n_pair(l,'keyPoints') for l in lessons)}")
print(f"  terms        min {min(n_list(l,'terms') for l in lessons)}  max {max(n_list(l,'terms') for l in lessons)}  total {sum(n_list(l,'terms') for l in lessons)}")
print(f"  quotes       min {min(n_list(l,'quotes') for l in lessons)}  max {max(n_list(l,'quotes') for l in lessons)}  total {sum(n_list(l,'quotes') for l in lessons)}")
no_terms = [l["id"] for l in lessons if n_list(l, "terms") < 3]
print(f"  lessons with fewer than 3 terms: {len(no_terms)} {no_terms[:6]}")
