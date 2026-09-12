"""Bump the ?v= cache-buster on stylesheets and scripts across every page.

GitHub Pages caches assets by URL, so a changed file keeps being served from the
visitor's cache unless its URL changes.  Run this after touching css/js and pass
the new token:  python tools/bump_version.py 20260912d
"""
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parents[1] / "docs"
new = sys.argv[1] if len(sys.argv) > 1 else None
if not new:
    print(__doc__)
    sys.exit(2)

changed = 0
for page in sorted(SITE.glob("*.html")):
    s = page.read_text(encoding="utf-8")
    # only stylesheets and scripts: images keep the stamp they were published with
    out = re.sub(r'(assets/(?:css|js)/[^"?]+)\?v=[0-9a-z]+', lambda m: f"{m.group(1)}?v={new}", s)
    out = re.sub(r'(data/[^"?]+\.js)\?v=[0-9a-z]+', lambda m: f"{m.group(1)}?v={new}", out)
    if out != s:
        page.write_text(out, encoding="utf-8")
        changed += 1
        n = len(re.findall(r'\?v=' + new, out))
        print(f"  {page.name:20s} {n} references")
print(f"{changed} pages updated to ?v={new}")
