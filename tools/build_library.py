"""Build docs/data/library.js — the per-page reading data behind the Library tab.

Sources:
  extracted/textbook_decoded.json   page -> decoded Khmer blocks (the recovered text)
  extracted/krlaw.json, paris.json  page -> extracted English text
  docs/data/lessons.js              chapter page ranges, so each page can be filed
  source/*.pdf                      the two reference PDFs, copied for in-page preview
"""
import json, pathlib, re, shutil, sys
import fitz  # pymupdf

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
raw = json.loads((ROOT / "extracted" / "textbook_decoded.json").read_text(encoding="utf-8"))
tb_pages = []
for k in sorted(raw.keys(), key=lambda x: int(x)):
    n = int(k)
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
    tb_pages.append({"n": n, "text": text, "ch": chapter_for(n, "textbook")})

sources.append({
    "id": "textbook",
    "kind": "text",
    "lang": "km",
    "title": {"km": "ច្បាប់សាធារណៈអន្តរជាតិ", "en": "International Public Law"},
    "author": {"km": "ឡាយ រត្តនា", "en": "Lay Rottana"},
    "year": "2021",
    "note": {
        "km": "សៀវភៅសិក្សាដើម (ភាសាខ្មែរ) — អត្ថបទត្រូវបានសង្គ្រោះចេញពីឯកសារ PDF ដើម។",
        "en": "The original Khmer textbook. Text recovered from the source PDF page by page."
    },
    "pages": tb_pages,
    "pdf": None,
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
        "pages": pages, "pdf": "library/" + pdfname, "images": []
    })

# ---------------------------------------------------------------- look-inside images
img_dir = DOCS / "assets" / "img" / "pages"
img_dir.mkdir(parents=True, exist_ok=True)
doc = fitz.open(str(ROOT / "source" / "11 International Public Law Textbook.pdf"))
LOOK = [(1, "title page"), (12, "chapter 1 opens"), (45, "the State and the nation"), (67, "recognition"),
        (143, "the Paris Peace Agreements"), (152, "annexes")]
shots = []
for pno, label in LOOK:
    if pno - 1 >= doc.page_count:
        continue
    page = doc[pno - 1]
    pix = page.get_pixmap(dpi=105)
    name = f"p{pno:03d}.jpg"
    pix.save(str(img_dir / name), jpg_quality=72)
    shots.append({"page": pno, "img": "assets/img/pages/" + name, "label": label})
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
