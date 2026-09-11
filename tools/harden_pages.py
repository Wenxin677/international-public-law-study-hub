"""Apply the site-wide security hardening to every page:

  · a Content-Security-Policy + referrer policy meta tag
  · the inline theme-boot script replaced by assets/js/boot.js (so script-src can
    be 'self' with no 'unsafe-inline')
  · the inline credits script in about.html replaced by assets/js/about.js
  · asset cache versions bumped

Run from the project root: python tools/harden_pages.py
"""
import pathlib, re, sys

sys.stdout.reconfigure(encoding="utf-8")
DOCS = pathlib.Path(__file__).resolve().parents[1] / "docs"
V = "20260911c"

CSP = (
    '<meta http-equiv="Content-Security-Policy" content="'
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data:; "
    "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://*.supabase.co; "
    "frame-src 'self'; "
    "object-src 'none'; base-uri 'none'; form-action 'self'"
    '">\n'
)
REFERRER = '<meta name="referrer" content="strict-origin-when-cross-origin">\n'

BOOT_RE = re.compile(r"[ \t]*<script>.*?robo\.theme.*?</script>\n", re.S)
ABOUT_RE = re.compile(r"[ \t]*<script>\s*document\.addEventListener\('DOMContentLoaded'.*?</script>\n", re.S)

changed = []
for page in sorted(DOCS.glob("*.html")):
    s = original = page.read_text(encoding="utf-8")

    # 1. CSP + referrer right after the viewport meta
    if "Content-Security-Policy" not in s:
        s = re.sub(r'(<meta name="viewport"[^>]*>\n)', r"\1" + CSP + REFERRER, s, count=1)

    # 2. inline boot script -> external file
    if BOOT_RE.search(s):
        s = BOOT_RE.sub(f'<script src="assets/js/boot.js?v={V}"></script>\n', s, count=1)

    # 3. about.html credits script -> external file
    if ABOUT_RE.search(s):
        s = ABOUT_RE.sub(f'<script src="assets/js/about.js?v={V}" defer></script>\n', s, count=1)

    # 4. bump asset versions
    s = s.replace("?v=20260911b", f"?v={V}").replace("?v=20260911a", f"?v={V}")

    if s != original:
        page.write_text(s, encoding="utf-8")
        changed.append(page.name)

print("pages hardened:", ", ".join(changed) if changed else "none")
print("inline scripts left:", sum(len(re.findall(r"<script>", p.read_text(encoding='utf-8'))) for p in DOCS.glob("*.html")))
print("CSP present in:", sum(1 for p in DOCS.glob("*.html") if "Content-Security-Policy" in p.read_text(encoding='utf-8')), "pages")
