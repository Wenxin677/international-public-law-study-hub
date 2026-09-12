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
# (a Node stub accepts any arguments, so only a real engine catches a drift)
sql_text = (SITE.parent / "tools/supabase-accounts.sql").read_text(encoding="utf-8")
sig = {}
for m in re.finditer(r"create or replace function public\.(robo_\w+)\((.*?)\)\s*returns", sql_text, re.S):
    sig[m.group(1)] = re.findall(r"\b(p_\w+)\b", m.group(2))
for fn in ["robo_signup", "robo_login", "robo_logout", "robo_admin_accounts"]:
    if fn not in sig:
        problems.append(f"supabase-accounts.sql: {fn} is missing")
        continue
    block = re.search(r"async function " + ("signup" if fn == "robo_signup" else "signin" if fn == "robo_login" else "signout" if fn == "robo_logout" else "dbAccounts") + r"\(.*?\n  \}", auth_js, re.S)
    if not block:
        continue
    sent = set(re.findall(r"\b(p_\w+)\s*:", block.group(0)))
    if sent and not sent.issubset(set(sig[fn])):
        problems.append(f"auth.js sends {sorted(sent - set(sig[fn]))} to {fn}, which the SQL does not accept")
    missing = set(sig[fn]) - sent
    if sent and missing and fn != "robo_login":      # login's older callers pass fewer names
        notes.append(f"  note: {fn} also has optional params never sent: {sorted(missing)}")

print("\n".join(notes))
print()
if problems:
    print(f"{len(problems)} problem(s):")
    for p in problems:
        print("  ✗", p)
    sys.exit(1)
print("all checks passed")
