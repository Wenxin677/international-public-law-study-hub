"""Static site verification: referenced local files exist, CSS balances, data sane."""
import json, pathlib, re, sys

SITE = pathlib.Path(__file__).resolve().parents[1] / "site"
problems, notes = [], []

pages = sorted(SITE.glob("*.html"))
for p in pages:
    html = p.read_text(encoding="utf-8")
    for m in re.finditer(r'(?:src|href)="([^"#][^"]*)"', html):
        ref = m.group(1)
        if ref.startswith(("http", "data:", "mailto:")):
            continue
        target = (p.parent / ref.split("#")[0].split("?")[0]).resolve()
        if not target.exists():
            problems.append(f"{p.name}: missing local resource {ref}")
    for m in re.finditer(r'src="data/([^"]+)"', html):
        notes.append(f"{p.name} loads {m.group(1)}")
    if "<title>" not in html:
        problems.append(f"{p.name}: no <title>")

css = (SITE / "assets" / "css" / "style.css").read_text(encoding="utf-8")
if css.count("{") != css.count("}"):
    problems.append(f"style.css: unbalanced braces ({css.count('{')} open / {css.count('}')} close)")
for token in ("--gold", "--bg", "--ink", "prefers-color-scheme" if False else "@media"):
    if token not in css:
        notes.append(f"style.css: {token} not found")

# data sanity
lessons_js = (SITE / "data" / "lessons.js").read_text(encoding="utf-8")
corpus_js = (SITE / "data" / "corpus.js").read_text(encoding="utf-8")
chapters = json.loads(lessons_js.split("=", 1)[1].rstrip(";\n"))
corpus = json.loads(corpus_js.split("=", 1)[1].rstrip(";\n"))

lessons = [l for c in chapters for l in c.get("lessons", [])]
questions = [q for l in lessons for q in l.get("quiz", [])]
terms = [t for l in lessons for t in l.get("terms", [])]
bad_q = [q for q in questions if len((q.get("options") or {}).get("km", [])) < 2
         or q.get("answer") is None or not (q.get("q") or {}).get("km")]
if bad_q:
    problems.append(f"{len(bad_q)} quiz questions malformed")
missing_page = [l["id"] for l in lessons if not (l.get("pages") or {}).get("from")]
if missing_page:
    problems.append(f"lessons without page numbers: {missing_page}")
km_only = [t for t in terms if not t.get("en")]
notes.append(f"{len(km_only)} terms have no English gloss")

print(f"pages: {len(pages)} · chapters: {len(chapters)} · lessons: {len(lessons)} · "
      f"questions: {len(questions)} · terms: {len(terms)} · corpus passages: {len(corpus)}")
print(f"corpus size: {len(corpus_js)/1024:.0f} KB · lessons size: {len(lessons_js)/1024:.0f} KB")
print("\nnotes:")
for n in notes[:12]:
    print("  ·", n)
print("\nPROBLEMS:" if problems else "\nno problems found")
for pr in problems[:30]:
    print("  ✗", pr)
sys.exit(1 if problems else 0)
