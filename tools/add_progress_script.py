"""Add assets/js/progress.js to every page (and bump the asset version) so the
   database-backed progress layer loads right after core.js on all pages."""
import pathlib
import re

SITE = pathlib.Path(__file__).resolve().parents[1] / "docs"
pages = sorted(SITE.glob("*.html"))
added = bumped = 0

for p in pages:
    s = p.read_text(encoding="utf-8")
    if 'assets/js/progress.js' not in s:
        # insert directly after core.js so IPLProgress exists before page scripts run
        m = re.search(r'[ \t]*<script src="assets/js/core\.js\?v=[^"]+" defer></script>\n', s)
        if m:
            tag = m.group(0).replace('core.js', 'progress.js')
            s = s[:m.end()] + tag + s[m.end():]
            added += 1
    # bump the version so browsers re-fetch the changed files
    new = re.sub(r'\?v=20260911c', '?v=20260912a', s)
    if new != s:
        bumped += 1
        s = new
    p.write_text(s, encoding="utf-8")

print(f"progress.js added to {added} pages; asset version bumped on {bumped} pages")
