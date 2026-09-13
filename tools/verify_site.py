"""Static site verification: internal references resolve, dictionaries line up,
landing numbers match the real data, and generated data files are consistent."""
import json, pathlib, re, sys

sys.stdout.reconfigure(encoding="utf-8")
SITE = pathlib.Path(__file__).resolve().parents[1] / "docs"
problems, notes = [], []

# ---------------------------------------------------------------- 1. references
html_files = sorted(SITE.glob("*.html"))
for f in html_files:
    s = f.read_text(encoding="utf-8")
    for m in re.finditer(r'(?:src|href)="([^"#?:]+)(?:\?[^"]*)?"', s):
        ref = m.group(1)
        if ref.startswith(("http", "mailto:", "data:", "//")) or not ref:
            continue
        if not (SITE / ref).exists():
            problems.append(f"{f.name}: missing reference -> {ref}")

# ---------------------------------------------------------------- 2. dictionaries
core = (SITE / "assets/js/core.js").read_text(encoding="utf-8")
i18n_block = core[core.index("const I18N"):core.index("function t(key")]
km_keys = set(re.findall(r"^\s*'([a-z0-9._]+)':", i18n_block, re.M))
# the two language halves
halves = i18n_block.split("    en: {")
if len(halves) == 2:
    km_only = set(re.findall(r"'([a-z0-9._]+)':", halves[0]))
    en_only = set(re.findall(r"'([a-z0-9._]+)':", halves[1]))
    for k in sorted(km_only - en_only):
        problems.append(f"i18n: '{k}' exists in km but not en")
    for k in sorted(en_only - km_only):
        problems.append(f"i18n: '{k}' exists in en but not km")
else:
    problems.append("i18n: could not split the two language blocks")
notes.append(f"i18n keys: {len(km_keys)}")

# every key used in markup/JS should exist
def keys_from(src):
    out = set()
    out |= set(re.findall(r'data-t(?:-ph|-title)?="([a-z0-9._]+)"', src))
    out |= set(re.findall(r"(?:\bI\.)?\bt\('([a-z0-9._]+)'", src))          # t('key') / I.t('key')
    return out

used = set()
for f in list(html_files) + list((SITE / "assets/js").glob("*.js")):
    used |= keys_from(f.read_text(encoding="utf-8"))

SKIP_PREFIX = ("robo", "ipl", "assets", "data", "http", "font", "seg")
missing = []
for k in sorted(used):
    if k.startswith(SKIP_PREFIX) or ".html" in k or ".js" in k or ".css" in k:
        continue
    if k in km_keys:
        continue
    if any(x.startswith(k) for x in km_keys):
        continue          # key built dynamically, e.g. t('lib.view.' + v) or t('landing.q' + i)
    missing.append(k)
for k in missing:
    problems.append(f"i18n: key used but not defined -> {k}")

# ---------------------------------------------------------------- 3. data files
lessons_js = (SITE / "data/lessons.js").read_text(encoding="utf-8")
chapters = json.loads(lessons_js[lessons_js.index("["):lessons_js.rindex("]") + 1])
lessons = [l for c in chapters for l in c.get("lessons", [])]
questions = sum(len(l.get("quiz", [])) for l in lessons)
terms = set()
for l in lessons:
    for t in l.get("terms", []):
        if t and t.get("km"):
            terms.add(t["km"].strip())
pages = (SITE / "data/library.js").read_text(encoding="utf-8")
lib = json.loads(pages[pages.index("{"):pages.rindex("}") + 1])
lib_pages = sum(len(s["pages"]) for s in lib["sources"])
corpus = (SITE / "data/corpus.js").read_text(encoding="utf-8")
chunks = corpus.count('"page"')
notes.append(f"data: {len(chapters)} chapters · {len(lessons)} lessons · {questions} questions · "
             f"{len(terms)} unique terms · {lib_pages} library pages · ~{chunks} corpus chunks")

# ---------------------------------------------------------------- 4. landing numbers
land = (SITE / "index.html").read_text(encoding="utf-8")
counts = [int(x) for x in re.findall(r'data-count="(\d+)"', land)]
real = [193, len([c for c in chapters if c.get("num", 0) > 0]), len(lessons), questions, len(terms), 3]
if counts != real:
    problems.append(f"landing stats {counts} do not match the data {real}")
else:
    notes.append("landing stats match the built data")

# ---------------------------------------------------------------- 5. page wiring
for page, script in [("dashboard.html", "home.js"), ("learn.html", "learn.js"), ("quiz.html", "quiz.js"),
                     ("teacher.html", "teacher.js"), ("library.html", "library.js"),
                     ("glossary.html", "glossary.js"), ("admin.html", "admin.js"),
                     ("signin.html", "signin.js"), ("index.html", "landing.js")]:
    s = (SITE / page).read_text(encoding="utf-8")
    if script not in s:
        problems.append(f"{page}: does not load {script}")
    if "core.js" not in s or "auth.js" not in s:
        problems.append(f"{page}: core.js/auth.js missing")
    if "config.js" not in s:
        problems.append(f"{page}: data/config.js missing (needed before auth.js)")

# app pages must guard the content behind the account (admin.html is gated by the
# owner code instead — it only ever reads this browser's own data)
for page in ["dashboard.html", "learn.html", "quiz.html", "teacher.html", "library.html", "glossary.html"]:
    js = {"dashboard.html": "home.js", "learn.html": "learn.js", "quiz.html": "quiz.js",
          "teacher.html": "teacher.js", "library.html": "library.js",
          "glossary.html": "glossary.js"}[page]
    if "gu" + "ard()" not in (SITE / "assets/js" / js).read_text(encoding="utf-8"):
        problems.append(f"{js}: does not call IPL.guard() — page would be open without an account")

admin_js = (SITE / "assets/js/admin.js").read_text(encoding="utf-8")
if "adminCodeHash" not in admin_js:
    problems.append("admin.js: does not check the hashed owner code")
if "panha2026" in admin_js:
    problems.append("admin.js: still prints a default code on screen")
if "dbAccounts" not in admin_js:
    problems.append("admin.js: no database panel")

auth_js = (SITE / "assets/js/auth.js").read_text(encoding="utf-8")
# the published config and code must never carry a plaintext owner code
for f in [SITE / "data/config.js"] + list((SITE / "assets/js").glob("*.js")):
    text = f.read_text(encoding="utf-8")
    if "adminCode:" in text:
        problems.append(f"{f.name}: plaintext adminCode is back — use adminCodeHash")
# hardening that must stay in place
for needle, msg in [("Content-Security-Policy", "pages are missing the CSP meta tag"),
                    ("MIN_PASS = 8", "password minimum is not 8"),
                    ("lockedOut", "no brute-force lockout in auth.js"),
                    ("mode: 'no-cors'", "collector fetch is not CORS-safe")]:
    if needle == "Content-Security-Policy":
        if not all(needle in p.read_text(encoding="utf-8") for p in html_files):
            problems.append(msg)
    elif needle not in auth_js:
        problems.append(msg)

# --- security rules that must never regress ---------------------------------
ROOT = SITE.parent
admin_js = (SITE / "assets/js/admin.js").read_text(encoding="utf-8")
sql = (ROOT / "tools/supabase-accounts.sql").read_text(encoding="utf-8")
core_js = (SITE / "assets/js/core.js").read_text(encoding="utf-8")
teacher_js = (SITE / "assets/js/teacher.js").read_text(encoding="utf-8")

for needle, msg in [("verifyCode", "admin.js no longer verifies the hashed owner code"),
                    ("codeLocked", "admin.js has no lockout on wrong owner codes")]:
    if needle not in admin_js:
        problems.append(msg)
for needle, msg in [("admin_denied", "the account list has no lockout in the SQL"),
                    ("drop function if exists public.robo_admin_accounts(text)",
                     "re-running the SQL would leave the old admin function callable"),
                    ("length(p_password) < 8", "the SQL does not enforce the 8-character minimum")]:
    if needle not in sql:
        problems.append(msg)
if "openSettings" in teacher_js or "api-key" in teacher_js:
    problems.append("teacher.js still offers to store an API key")
for needle, msg in [("admin.setup", "no owner-code setup instructions"),
                    ("admin.codelocked", "no lockout message for wrong owner codes")]:
    if needle not in core_js:
        problems.append(msg)

# a published owner code is the one secret that must never appear again
for f in [ROOT / "README.md", ROOT / "NOTICE.md", ROOT / "tools/desktop-readme.txt",
          SITE / "data/config.js", SITE / "assets/js/auth.js", SITE / "assets/js/admin.js"]:
    if f.exists() and "panha2026" in f.read_text(encoding="utf-8"):
        problems.append(f"{f.name}: the old plaintext owner code is back in the repo")
if "adminSecret" in (ROOT / "README.md").read_text(encoding="utf-8"):
    problems.append("README.md still documents a removed adminSecret setting")

# --- the client and the database must agree on the function signatures -------
# (a Node stub accepts any arguments, so only a real engine catches a drift; and
#  PostgREST matches by name, so a rename on either side fails only on the live
#  project — check every call site in the shipped code)
sql_text = (SITE.parent / "tools/supabase-accounts.sql").read_text(encoding="utf-8")
sig = {}
for m in re.finditer(r"create or replace function public\.(robo_\w+)\((.*?)\)\s*returns", sql_text, re.S):
    sig[m.group(1)] = re.findall(r"\b(p_\w+)\b", m.group(2))
progress_js = (SITE / "assets/js/progress.js").read_text(encoding="utf-8")
call_sites = 0
for src, name in ((auth_js, "auth.js"), (progress_js, "progress.js")):
    for m in re.finditer(r"(?:rpc|call)\(\s*'(robo_\w+)'\s*,\s*\{(.*?)\}\s*\)", src, re.S):
        fn, body = m.group(1), m.group(2)
        call_sites += 1
        if fn not in sig:
            problems.append(f"{name} calls {fn}, which the SQL does not define")
            continue
        sent = set(re.findall(r"\b(p_\w+)\s*:", body))
        extra = sent - set(sig[fn])
        if extra:
            problems.append(f"{name} sends {sorted(extra)} to {fn}, which the SQL does not accept")
if call_sites < 8:
    problems.append(f"only {call_sites} database calls found in the shipped code — expected the account, session, progress and owner calls")
for fn in sig:
    if fn.startswith("robo_") and fn not in ("robo_token_hash", "robo_uid_for_token", "robo_new_session", "robo_session_purge"):
        if f"grant execute on function public.{fn}" not in sql_text:
            problems.append(f"the SQL never grants execute on {fn} to anon — the site cannot call it")
notes.append(f"  database: {len(sig)} functions defined, {call_sites} call sites checked against them")

# --- the lesson template (PDF per chapter, and the content it must show) ------
LESSON_JS = (SITE / "assets/js/learn.js").read_text(encoding="utf-8")
LESSON_HTML = (SITE / "learn.html").read_text(encoding="utf-8")
try:
    chapters = json.loads((SITE / "data/lessons.js").read_text(encoding="utf-8")
                          .split("=", 1)[1].rsplit(";", 1)[0].strip())
except Exception as e:
    chapters = []
    problems.append(f"data/lessons.js is not readable: {e}")

if "IPL_DATA" not in LESSON_JS:
    problems.append("learn.js does not render from the built data (IPL_DATA)")
if re.search(r"['\"](?:ch\d+|ref-\w+)-l\d+['\"]", LESSON_JS):
    problems.append("learn.js hard-codes a lesson id — lessons must come from the data")
if "assets/css/lesson.css" not in LESSON_HTML:
    problems.append("learn.html does not load the lesson stylesheet")
if "Space+Grotesk" not in LESSON_HTML:
    problems.append("learn.html does not load the display font")
for needle, msg in (("data-src", "the PDF is not lazy-loaded"),
                    ("IntersectionObserver", "no lazy/scroll observer in learn.js"),
                    ("lk-progress", "no progress bar in the lesson template")):
    if needle not in LESSON_JS:
        problems.append(f"learn.js: {msg}")

try:
    import pymupdf
    have_pdf_lib = True
except Exception:
    have_pdf_lib = False

lesson_count = 0
for ch in chapters:
    pdf = SITE / "library/chapters" / f"{ch['id']}.pdf"
    want = ch["pages"]["to"] - ch["pages"]["from"] + 1
    if not pdf.exists():
        problems.append(f"missing chapter PDF: library/chapters/{ch['id']}.pdf")
    elif have_pdf_lib:
        with pymupdf.open(pdf) as doc:
            if doc.page_count != want:
                problems.append(f"{ch['id']}.pdf has {doc.page_count} pages, chapter says {want}")
    kb = pdf.stat().st_size / 1024 if pdf.exists() else 0
    if pdf.exists() and kb < 20:
        problems.append(f"{ch['id']}.pdf looks empty ({kb:.0f} KB)")
    for les in ch.get("lessons", []):
        lesson_count += 1
        lid = les.get("id", "?")
        # the lesson's own slides: exactly its page range
        lpdf = SITE / "library/lessons" / f"{lid}.pdf"
        lwant = les["pages"]["to"] - les["pages"]["from"] + 1
        if not lpdf.exists():
            problems.append(f"missing lesson PDF: library/lessons/{lid}.pdf")
        elif have_pdf_lib:
            with pymupdf.open(lpdf) as doc:
                if doc.page_count != lwant:
                    problems.append(f"{lid}.pdf has {doc.page_count} pages, the lesson says {lwant}")
        if lpdf.exists() and lpdf.stat().st_size / 1024 < 8:
            problems.append(f"{lid}.pdf looks empty")
        obj = (les.get("objectives") or {}).get("en") or []
        plain = (les.get("plain") or {}).get("en") or []
        if not 3 <= len(obj) <= 5:
            problems.append(f"{lid}: {len(obj)} learning objectives (the template asks for 3–5)")
        if len(les.get("terms") or []) < 3:
            problems.append(f"{lid}: fewer than 3 key terms")
        if len(plain) < 3:
            problems.append(f"{lid}: fewer than 3 plain-language points")
        if len(les.get("quotes") or []) < 1:
            problems.append(f"{lid}: no quotes")
        if not les.get("quiz"):
            problems.append(f"{lid}: no quiz questions")
        for pair in ("objectives", "plain", "keyPoints"):
            v = les.get(pair) or {}
            if not v.get("km") or not v.get("en"):
                problems.append(f"{lid}: {pair} is not in both languages")

# the guided walk-through and the rail must use the markup the shell styles
for needle, msg in (("lk-guide", "learn.js has no guided walk-through"),
                    ("data-ch=", "learn.js does not build the chapter accordion the rail styles expect"),
                    ('<div class="ls">', "learn.js does not render the rail lesson list"),
                    ("library/lessons/", "the lesson viewer does not point at the lesson's own PDF")):
    if needle not in LESSON_JS:
        problems.append(f"learn.js: {msg}")
TEACHER_JS = (SITE / "assets/js/teacher.js").read_text(encoding="utf-8")
for needle, msg in (("type: 'long'", "the teacher has no longer explanation"),
                    ("function clean(", "the teacher does not tidy the text it prints"),
                    ("bar stepping", "the thinking bar does not show real progress")):
    if needle not in TEACHER_JS:
        problems.append(f"teacher.js: {msg}")
notes.append(f"  lessons: {lesson_count} checked · chapter PDFs: {len(chapters)} · lesson PDFs: {lesson_count}")

# ------------------------------------------------- 9. accessibility invariants
# The full audit runs in tools/dev/a11y_check.mjs (real Chrome, 390px, all pages).
# These are the invariants that must never silently regress in the shipped files.
html_text = {f.name: f.read_text(encoding="utf-8") for f in html_files}

for name, html in html_text.items():
    if 'class="skip-link"' not in html:
        problems.append(f"{name}: no skip-to-content link (WCAG 2.2 2.4.1)")
    if '<main id="main"' not in html:
        problems.append(f"{name}: <main> has no id for the skip link to target")

STYLE_CSS = (SITE / "assets/css/style.css").read_text(encoding="utf-8")
if ":focus-visible" not in STYLE_CSS:
    problems.append("style.css: no :focus-visible rule — keyboard focus would be invisible (2.4.7)")
if "outline: 2px solid var(--focus)" not in STYLE_CSS:
    problems.append("style.css: the focus ring is missing or too faint (1.4.11 needs 3:1)")
if "font-size: 16px" not in STYLE_CSS:
    problems.append("style.css: form fields must be >=16px or iOS zooms the page on focus")

img_total = 0
for name, html in html_text.items():
    for m in re.finditer(r"<img\b[^>]*>", html):
        img_total += 1
        if "alt=" not in m.group(0):
            problems.append(f"{name}: <img> without alt — {m.group(0)[:60]}")

notes.append(f"  a11y: {len(html_files)} pages · skip links + main ids · focus ring · {img_total} images with alt")

# ----------------------------------------------------------- 10. weekly classes
WEEKLY_JS = SITE / "data/weekly.js"
if not WEEKLY_JS.exists():
    problems.append("data/weekly.js is missing — run tools/build_weekly.py")
else:
    wj = WEEKLY_JS.read_text(encoding="utf-8")
    wdata = json.loads(re.search(r"window\.IPL_WEEKLY\s*=\s*(\{.*\});?\s*$", wj, re.S).group(1))
    # the deck's own text layer is corrupt, so a Khmer label carrying one of the
    # source artefacts would ship visibly broken Khmer
    artefacts = ["អនតរ", "កនុង", "ដលែ", "ដដ្យ", "ប្ប", "សប្ា", "នន", "ចាប់កនុង", "រឋែ"]
    wk_slides = 0
    for w in wdata.get("weeks", []):
        deck = SITE / w["deck"]
        if not deck.exists():
            problems.append(f"weekly {w['id']}: deck missing at {w['deck']}")
        else:
            import pymupdf
            with pymupdf.open(str(deck)) as doc:
                if doc.page_count != w["pages"]:
                    problems.append(f"weekly {w['id']}: deck has {doc.page_count} pages, data says {w['pages']}")
        want = [n for n in range(1, w["pages"] + 1) if n not in (w.get("skip") or [])]
        if [s["n"] for s in w["slides"]] != want:
            problems.append(f"weekly {w['id']}: slides do not cover the deck (skipped {w.get('skip')})")
        for s in w["slides"]:
            wk_slides += 1
            if len((s.get("summary") or "").strip()) < 40:
                problems.append(f"weekly {w['id']} slide {s['n']}: summary missing")
            bad = [a for a in artefacts if a in (s.get("km") or "")]
            if bad:
                problems.append(f"weekly {w['id']} slide {s['n']}: Khmer label carries source artefacts {bad}")
    notes.append(f"  weekly: {len(wdata.get('weeks', []))} deck(s) · {wk_slides} slides with summaries · labels clean")

print("\n".join(notes))
print()
if problems:
    print(f"{len(problems)} problem(s):")
    for p in problems:
        print("  ✗", p)
    sys.exit(1)
print("all checks passed")
