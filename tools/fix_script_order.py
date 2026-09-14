"""Keep script tags in a safe order on every page.

auth.js must run before progress.js: progress.js talks to the database through
window.IPLAuth. (progress.js now resolves it at call time too, so a wrong order
is no longer fatal — but the order should still be right.)

Idempotent. Run:  python tools/fix_script_order.py [--check]
"""
import re
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
# each pair: this must appear no later than that
PAIRS = [("assets/js/auth.js", "assets/js/progress.js")]


def main() -> int:
    check_only = "--check" in sys.argv
    problems = []
    for page in sorted(DOCS.glob("*.html")):
        text = page.read_text(encoding="utf-8")
        srcs = re.findall(r'<script src="([^"?]+)', text)
        for first, second in PAIRS:
            if first in srcs and second in srcs and srcs.index(first) > srcs.index(second):
                problems.append((page.name, f"{first} must load before {second}"))
                if not check_only:
                    lines = text.split("\n")
                    i = next(i for i, l in enumerate(lines) if second in l)
                    j = next(j for j, l in enumerate(lines) if first in l)
                    lines[i], lines[j] = lines[j], lines[i]
                    page.write_text("\n".join(lines), encoding="utf-8")

    for name, why in problems:
        print(f"  {'would fix' if check_only else 'fixed    '} {name}: {why}")
    if not problems:
        print("every page loads the scripts in a safe order")
    return 1 if (problems and check_only) else 0


if __name__ == "__main__":
    raise SystemExit(main())
