"""Decode the whole textbook to JSON + readable markdown, and render page PNGs."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from recover import Recover

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "extracted"
OUT.mkdir(exist_ok=True)

rec = Recover(ROOT / "source" / "11 International Public Law Textbook.pdf")
book = {}
md_lines = []
headings = []
for pno in range(len(rec.doc)):
    lines = rec.page_lines(pno)
    book[pno + 1] = lines
    md_lines.append(f"\n\n<!-- ===== PDF PAGE {pno + 1} ===== -->\n")
    for ln in lines:
        md_lines.append(ln["text"].strip())
    for ln in lines:
        if "Muol" in ln["font"] and len(ln["text"].strip()) > 3:
            headings.append({"pdf_page": pno + 1, "text": ln["text"].strip(), "size": ln["size"]})

(OUT / "textbook_decoded.json").write_text(json.dumps(book, ensure_ascii=False, indent=1), encoding="utf-8")
(OUT / "textbook_decoded.md").write_text("\n".join(md_lines), encoding="utf-8")
(OUT / "textbook_headings.json").write_text(json.dumps(headings, ensure_ascii=False, indent=1), encoding="utf-8")

chars = sum(len(l["text"]) for p in book.values() for l in p)
print(f"decoded {len(book)} pages, {chars:,} chars, {len(headings)} headings")
print("\n--- Muol headings (first 40) ---")
for h in headings[:40]:
    print(f"  p{h['pdf_page']:>3}  {h['text']}")
