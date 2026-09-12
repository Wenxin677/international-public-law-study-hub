"""Add a skip-to-content link to every page (idempotent).

WCAG 2.2 2.4.1 (Bypass Blocks): keyboard and screen-reader users need a way past
the repeated header nav. The link must be the FIRST focusable element in the
document, so it goes immediately after <body>; it stays off-screen until focused
(see .skip-link in style.css) and targets <main id="main">.

Run:  python tools/add_skip_link.py [--check]
      --check  report which pages are missing it, change nothing (for verify_site)
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"

LINK = (
    '<a class="skip-link" href="#main">'
    '<span class="km-only">រំលងទៅខ្លឹមសារសំខាន់</span>'
    '<span class="en-only">Skip to main content</span>'
    "</a>\n"
)


def page_names() -> list[pathlib.Path]:
    return sorted(SITE.glob("*.html"))


def main() -> int:
    check_only = "--check" in sys.argv
    changed, missing = [], []

    for page in page_names():
        html = page.read_text(encoding="utf-8")
        if 'class="skip-link"' in html:
            continue
        if check_only:
            missing.append(page.name)
            continue

        body = re.search(r"<body[^>]*>\s*", html)
        if not body:
            missing.append(page.name)
            continue

        # the link needs something to jump to
        if '<main id="main"' not in html:
            html = re.sub(r"<main(?![^>]*\bid=)", '<main id="main"', html, count=1)

        html = html[: body.end()] + LINK + html[body.end():]
        page.write_text(html, encoding="utf-8")
        changed.append(page.name)

    if check_only:
        if missing:
            print(f"pages without a skip link: {', '.join(missing)}")
            return 1
        print(f"skip link present on all {len(page_names())} pages")
        return 0

    print(f"skip link added to {len(changed)} page(s): {', '.join(changed) or 'none — already present'}")
    if missing:
        print(f"could not patch: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
