"""Make every font stack fall back to the Khmer face.

Headings use 'Space Grotesk' / 'Poppins' for Latin, but those fonts have no Khmer
glyphs, so Khmer text inside them fell through to the DEVICE's Khmer font. Adding
var(--font-km) before `sans-serif` means Latin keeps the display face and Khmer
always lands on KhmerOS Battambang.

Idempotent: declarations that already mention a Khmer font are left alone.

Run:  python tools/khmer_font_stack.py [--check]
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CSS = ROOT / "docs" / "assets" / "css"
FILES = ["style.css", "lesson.css", "sections.css"]

# font-family: <stack>;   — the custom property --font-km: ... is not matched
DECL = re.compile(r"(?<![\w-])font-family:\s*([^;}]+);")


def fix(text: str) -> tuple[str, int]:
    changed = 0

    def repl(m):
        nonlocal changed
        stack = m.group(1)
        if "font-km" in stack or "KhmerOS" in stack or "Khmer OS" in stack:
            return m.group(0)
        if "sans-serif" not in stack:
            return m.group(0)
        changed += 1
        return "font-family: " + stack.replace("sans-serif", "var(--font-km), sans-serif", 1) + ";"

    return DECL.sub(repl, text), changed


def main() -> int:
    check_only = "--check" in sys.argv
    total = 0
    for name in FILES:
        path = CSS / name
        text = path.read_text(encoding="utf-8")
        out, n = fix(text)
        total += n
        if n and not check_only:
            path.write_text(out, encoding="utf-8")
        print(f"  {name}: {n} stack(s) {'would be' if check_only else ''} pointed at the Khmer face")
    if check_only and total:
        print(f"{total} stack(s) missing the Khmer fallback")
        return 1
    print(f"done — {total} stack(s) updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
