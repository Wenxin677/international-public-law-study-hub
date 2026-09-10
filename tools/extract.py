import json, re, pathlib, sys
import pymupdf

SRC = pathlib.Path(__file__).resolve().parents[1] / "source"
OUT = pathlib.Path(__file__).resolve().parents[1] / "extracted"
OUT.mkdir(exist_ok=True)

files = {
    "textbook": "11 International Public Law Textbook.pdf",
    "krlaw": "Reference_KR_Law_as_amended_27_Oct_2004_Eng.pdf",
    "paris": "Reference_Paris_Convention_0.pdf",
}

for key, fn in files.items():
    doc = pymupdf.open(SRC / fn)
    pages = []
    for i, page in enumerate(doc):
        txt = page.get_text("text")
        pages.append({"page": i + 1, "text": txt, "chars": len(txt.strip())})
    meta = doc.metadata
    (OUT / f"{key}.json").write_text(json.dumps({"file": fn, "n_pages": len(pages),
                                                 "metadata": meta, "pages": pages}, ensure_ascii=False), encoding="utf-8")
    empty = [p["page"] for p in pages if p["chars"] < 40]
    print(f"== {key}: {len(pages)} pages, {sum(p['chars'] for p in pages):,} chars, near-empty pages: {len(empty)} {empty[:20]}")
    print(f"   metadata title={meta.get('title')!r} author={meta.get('author')!r}")
    print("   first page text (400):", repr(pages[0]["text"][:400]))
