"""Build chapter text files + the chatbot corpus from the decoded book."""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EX = ROOT / "extracted"
DATA = ROOT / "docs" / "data"
DATA.mkdir(parents=True, exist_ok=True)
CHAPTERS_DIR = ROOT / "extracted" / "chapters"
CHAPTERS_DIR.mkdir(exist_ok=True)

book = json.loads((EX / "textbook_decoded.json").read_text(encoding="utf-8"))
kr = json.loads((EX / "krlaw.json").read_text(encoding="utf-8"))
paris = json.loads((EX / "paris.json").read_text(encoding="utf-8"))

# ---- chapter boundaries (pdf page numbers) from the recovered headings ----
# covering both chapter (X.) and section (X.Y) levels
CHAPTER_MAP = [
    ("ch1", 1, 12, 54, "នីតិអន្តរជាតិសាធារណៈ", "Public International Law"),
    ("ch2", 2, 54, 78, "នីតិអន្តរជាតិ", "International Law"),
    ("ch3", 3, 78, 89, "ទំនាក់ទំនងរវាងរដ្ឋនិងនីតិអន្តរជាតិ", "States and International Law"),
    ("ch4", 4, 89, 112, "ប្រភពនៃច្បាប់អន្តរជាតិ", "Sources of International Law"),
    ("ch5", 5, 112, 120, "ទំនាក់ទំនងរវាងនីតិជាតិនិងនីតិអន្តរជាតិ", "National Law and International Law"),
    ("ch6", 6, 120, 140, "អនុសញ្ញា", "Conventions"),
    ("ch7", 7, 140, 154, "ប្រវត្តិនៃធម្មនុញ្ញអន្តរជាតិ", "History of International Charters"),
    ("ch8", 8, 154, 205, "កិច្ចព្រមព្រៀងទីក្រុងប៉ារីស", "Paris Peace Agreements"),
]

OFFSET = 11  # book page = pdf page - 11


def page_text(pno):
    return [ln["text"].strip() for ln in book[str(pno)] if ln["text"].strip()]


# --- 1. per-chapter plain text files for content authoring ---
for cid, num, p_from, p_to, t_km, t_en in CHAPTER_MAP:
    buf = [f"# {cid}: {t_km} / {t_en}", f"book pages {p_from - OFFSET}-{p_to - 1 - OFFSET} (pdf {p_from}-{p_to - 1})", ""]
    for pno in range(p_from, min(p_to, len(book) + 1)):
        buf.append(f"\n<!-- pdf page {pno} | book page {pno - OFFSET} -->")
        buf.extend(page_text(pno))
    (CHAPTERS_DIR / f"{cid}.txt").write_text("\n".join(buf), encoding="utf-8")
    print(f"{cid}: pdf {p_from}-{p_to-1} -> {(CHAPTERS_DIR / f'{cid}.txt').stat().st_size:,} bytes")

# --- 2. chat corpus ---
CHUNK_MIN, CHUNK_MAX = 240, 900
corpus = []


def add_chunks(src, lang, pages, page_texts, offset=0):
    """group consecutive page lines into paragraph-sized chunks"""
    cur, cur_page = [], None
    for pno, lines in page_texts:
        for ln in lines:
            if cur and len("\n".join(cur)) + len(ln) > CHUNK_MAX:
                corpus.append({"src": src, "lang": lang, "page": (pno - offset) if offset else pno,
                               "pdf": pno, "text": "\n".join(cur).strip()})
                cur = []
            cur.append(ln)
            cur_page = pno
        if cur and len("\n".join(cur)) >= CHUNK_MIN:
            corpus.append({"src": src, "lang": lang, "page": (pno - offset) if offset else pno,
                           "pdf": pno, "text": "\n".join(cur).strip()})
            cur = []
    if cur:
        corpus.append({"src": src, "lang": lang, "page": (cur_page - offset) if offset else cur_page,
                       "pdf": cur_page, "text": "\n".join(cur).strip()})


add_chunks("textbook", "km", None, [(p, page_text(p)) for p in range(12, len(book) + 1)], offset=OFFSET)
add_chunks("eccc", "en", None, [(p["page"], [l for l in p["text"].split("\n") if l.strip()]) for p in kr["pages"]])
add_chunks("paris", "en", None, [(p["page"], [l for l in p["text"].split("\n") if l.strip()]) for p in paris["pages"]])

for i, c in enumerate(corpus):
    c["id"] = f"{c['src']}-{c.get('page','?')}-{i}"

(DATA / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False), encoding="utf-8")
km = [c for c in corpus if c["lang"] == "km"]
en = [c for c in corpus if c["lang"] == "en"]
print(f"\ncorpus: {len(corpus)} chunks ({len(km)} km / {len(en)} en), "
      f"{sum(len(c['text']) for c in corpus):,} chars, {(DATA / 'corpus.json').stat().st_size:,} bytes")
