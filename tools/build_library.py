"""Build docs/data/library.js — the per-page reading data behind the Library tab.

Sources:
  extracted/textbook_decoded.json   page -> decoded Khmer blocks (the recovered text)
  extracted/krlaw.json, paris.json  page -> extracted English text
  docs/data/lessons.js              chapter page ranges, so each page can be filed
  source/*.pdf                      the two reference PDFs, copied for in-page preview
"""
import json, pathlib, re, shutil, sys
import fitz  # pymupdf

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from page_map import book_page, front_matter, pdf_page  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUT = DOCS / "data" / "library.js"

# ---------------------------------------------------------------- chapter ranges
lessons_js = (DOCS / "data" / "lessons.js").read_text(encoding="utf-8")
json_part = lessons_js[lessons_js.index("["):lessons_js.rindex("]") + 1]
chapters = json.loads(json_part)
ranges = []
for c in chapters:
    if not c.get("pages"):
        continue
    ranges.append((c["pages"]["from"], c["pages"]["to"], c["num"], c["title"]))


def chapter_for(page, src):
    if src != "textbook":
        return None
    for a, b, num, title in ranges:
        if a <= page <= b:
            return {"num": num, "title": title}
    return None


def clean(text):
    text = re.sub(r"[ \t]+", " ", text or "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


sources = []

# ---------------------------------------------------------------- the textbook
# The owner chose to publish the textbook PDF as well, so the Library can show
# the real pages. It is credited to its author, and NOTICE.md invites a rights
# holder to ask for its removal. File name is kept URL-clean (no spaces).
TB_PDF_SRC = ROOT / "source" / "11 International Public Law Textbook.pdf"
TB_PDF_NAME = "11_International_Public_Law_Textbook.pdf"
raw = json.loads((ROOT / "extracted" / "textbook_decoded.json").read_text(encoding="utf-8"))
tb_pages = []
FRONT = front_matter("textbook")          # 11 sheets before book page 1
for k in sorted(raw.keys(), key=lambda x: int(x)):
    n = int(k)                            # n is a PDF sheet number
    book = book_page("textbook", n)       # ...which the book numbers differently
    if book < 1:
        continue                          # front matter: cover, title, contents, i-x
    blocks = [b for b in raw[k] if isinstance(b, dict) and (b.get("text") or "").strip()]
    if not blocks:
        continue
    # reading order: top to bottom, then left to right (two-column pages included)
    blocks.sort(key=lambda b: (round(b.get("y", 0) / 6.0), b.get("x", 0)))
    lines, last_y = [], None
    for b in blocks:
        y = round(b.get("y", 0) / 6.0)
        t = clean(b["text"])
        if not t:
            continue
        if last_y is not None and y != last_y:
            lines.append("\n")
        lines.append(t + (" " if not t.endswith(("-", "។", "៕")) else ""))
        last_y = y
    text = clean("".join(lines))
    tb_pages.append({"n": book, "text": text, "ch": chapter_for(book, "textbook")})

sources.append({
    "id": "textbook",
    "kind": "text",
    "lang": "km",
    "title": {"km": "ច្បាប់សាធារណៈអន្តរជាតិ", "en": "International Public Law"},
    "author": {"km": "ឡាយ រត្តនា", "en": "Lay Rottana"},
    "year": "2021",
    # page numbers in this data are BOOK pages; add this to address the PDF file
    "offset": FRONT,
    "note": {
        "km": "សៀវភៅសិក្សាដើម (ភាសាខ្មែរ) — អានជាអត្ថបទ ឬមើលទំព័រ PDF ដើម។",
        "en": "The original Khmer textbook — read the recovered text, or view the real PDF pages."
    },
    "rights": {
        "km": "សៀវភៅនេះជាកម្មសិទ្ធិរបស់អ្នកនិពន្ធ។ រួមបញ្ចូលសម្រាប់ការសិក្សាប៉ុណ្ណោះ — បើអ្នកកាន់សិទ្ធិសុំដក យើងនឹងដកចេញភ្លាម។",
        "en": "Copyright belongs to the author. Included for study only — a rights holder can ask us to remove it and we will."
    },
    "pages": tb_pages,
    "pdf": "library/" + TB_PDF_NAME if (ROOT / "source" / TB_PDF_NAME).exists() or (ROOT / "source" / "11 International Public Law Textbook.pdf").exists() else None,
    "images": []
})

# ---------------------------------------------------------------- reference docs
REFS = [
    ("eccc", "krlaw.json", {"km": "ច្បាប់ស្តីពីការបង្កើតអង្គជំនុំជំរះពិសេស", "en": "ECCC Law"},
     {"km": "ច្បាប់កម្ពុជា (វិសោធនកម្ម ២៧ តុលា ២០០៤)", "en": "Cambodian law, as amended 27 Oct 2004"}, "Law on the Establishment of the Extraordinary Chambers, as amended 27 October 2004", "2004",
     "Reference_KR_Law_as_amended_27_Oct_2004_Eng.pdf"),
    ("paris", "paris.json", {"km": "អនុសញ្ញាប៉ារីស", "en": "Paris Convention"},
     {"km": "ការពារកម្មសិទ្ធិឧស្សាហកម្ម (WIPO)", "en": "Protection of Industrial Property (WIPO)"}, "Paris Convention for the Protection of Industrial Property", "1883 / 1979",
     "Reference_Paris_Convention_0.pdf")]

lib_dir = DOCS / "library"
lib_dir.mkdir(parents=True, exist_ok=True)

# publish the textbook PDF too, under a URL-clean file name
if TB_PDF_SRC.exists():
    shutil.copy2(TB_PDF_SRC, lib_dir / TB_PDF_NAME)
    print(f"copied {TB_PDF_NAME} -> docs/library/ ({(lib_dir / TB_PDF_NAME).stat().st_size/1024/1024:.1f} MB)")

for sid, jf, title, author, cite, year, pdfname in REFS:
    j = json.loads((ROOT / "extracted" / jf).read_text(encoding="utf-8"))
    pages = [{"n": p["page"], "text": clean(p["text"])} for p in j["pages"]]
    src_pdf = ROOT / "source" / pdfname
    if src_pdf.exists():
        shutil.copy2(src_pdf, lib_dir / pdfname)
        print(f"copied {pdfname} -> docs/library/")
    sources.append({
        "id": sid, "kind": "pdf", "lang": "en", "title": title, "author": author,
        "year": year, "cite": cite, "note": {
            "km": "ឯកសារផ្លូវការ — មើលបានទាំងអត្ថបទ និងឯកសារ PDF ដើម។",
            "en": "Public legal document — read as text or open the original PDF."
        },
        "pages": pages, "pdf": "library/" + pdfname, "images": [], "offset": 0
    })

# ---------------------------------------------------------------- look-inside images
img_dir = DOCS / "assets" / "img" / "pages"
img_dir.mkdir(parents=True, exist_ok=True)
doc = fitz.open(str(ROOT / "source" / "11 International Public Law Textbook.pdf"))
# BOOK pages (the offset is added when addressing the PDF). The front matter is
# skipped: a "look inside" gallery should open on the book's own page 1.
LOOK = [(1, "chapter 1 opens"), (34, "the State and the nation"), (56, "recognition"),
        (132, "the Paris Peace Agreements"), (141, "annexes")]
shots = []
for book, label in LOOK:
    pno = pdf_page("textbook", book)
    if pno - 1 >= doc.page_count:
        continue
    page = doc[pno - 1]
    pix = page.get_pixmap(dpi=84)          # keep the gallery light: ~60 KB a shot
    name = f"p{book:03d}.jpg"
    pix.save(str(img_dir / name), jpg_quality=72)
    shots.append({"page": book, "img": "assets/img/pages/" + name, "label": label})
    print(f"rendered {name} ({(img_dir / name).stat().st_size/1024:.0f} KB)")
doc.close()
sources[0]["images"] = shots

payload = {"sources": sources, "built": None}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("/* generated by tools/build_library.py — do not edit by hand */\nwindow.IPL_LIBRARY = " +
               json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"\nlibrary.js: {OUT.stat().st_size/1024:.0f} KB")
for s in sources:
    chars = sum(len(p["text"]) for p in s["pages"])
    print(f"  {s['id']:9s} pages={len(s['pages']):3d} chars={chars:7d} pdf={'yes' if s['pdf'] else 'no '} images={len(s['images'])}")
