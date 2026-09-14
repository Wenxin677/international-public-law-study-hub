"""Do the shipped PDF extracts really contain the pages the site claims?

Every lesson and chapter has its own slice of the source PDF. Their page ranges are
BOOK pages (what the printed book shows and what the lessons and quizzes cite), but
the textbook PDF opens with 11 front-matter sheets, so a slice built without that
offset shows the wrong pages while its page COUNT still looks right. That is
exactly the bug this catches: it reads the printed page number off the first and
last sheet of each extract and compares it with the declared range.

Run:  python tools/dev/pdf_page_audit.py
"""
import json
import pathlib
import re
import sys

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from page_map import pdf_page  # noqa: E402

SITE = ROOT / 'docs'


def chapters():
    text = (SITE / 'data' / 'lessons.js').read_text(encoding='utf-8')
    return json.loads(text[text.index('['):text.rindex(']') + 1])


def printed(lines):
    """the page number printed on the sheet, if the extract kept it"""
    for ln in lines[:3]:
        m = re.match(r'\s*(\d{1,3})\b', ln)
        if m:
            return int(m.group(1))
    return None


def check(pdf_path, want_from, want_to, label, source_id, source):
    """Compare the extract's first and last sheet with the source sheet they should
    have come from. Identical text means the slice is the right slice — this works
    for every document, including ones whose pages do not start with a number."""
    if not pdf_path.exists():
        return f'{label}: file missing ({pdf_path.name})'
    doc = pymupdf.open(pdf_path)
    if doc.page_count != want_to - want_from + 1:
        return f'{label}: {doc.page_count} sheets for book pages {want_from}-{want_to}'
    first_pdf, last_pdf = pdf_page(source_id, want_from), pdf_page(source_id, want_to)
    for got_sheet, want_sheet, where in ((0, first_pdf, 'first'), (doc.page_count - 1, last_pdf, 'last')):
        got = doc[got_sheet].get_text().strip()
        want = source[want_sheet - 1].get_text().strip()
        if got != want:
            printed_from = printed(doc[0].get_text().strip().split('\n'))
            return (f'{label}: the {where} sheet is not source page {want_sheet} '
                    f'(holds printed page {printed_from}; site says {want_from}-{want_to})')
    return None


def main() -> int:
    problems, checked = [], 0
    sources = {
        'textbook': pymupdf.open(SITE / 'library' / '11_International_Public_Law_Textbook.pdf'),
        'ref-eccc': pymupdf.open(SITE / 'library' / 'Reference_KR_Law_as_amended_27_Oct_2004_Eng.pdf'),
        'ref-paris': pymupdf.open(SITE / 'library' / 'Reference_Paris_Convention_0.pdf'),
    }
    for ch in chapters():
        cid = ch['id']
        src_id = cid if cid in sources else 'textbook'
        a, b = ch['pages']['from'], ch['pages']['to']
        checked += 1
        p = check(SITE / 'library' / 'chapters' / f'{cid}.pdf', a, b, f'chapter {cid}', src_id, sources[src_id])
        problems.append(p) if p else None
        for l in ch['lessons']:
            la, lb = l['pages']['from'], l['pages']['to']
            checked += 1
            p = check(SITE / 'library' / 'lessons' / f"{l['id']}.pdf", la, lb, f"lesson {l['id']}", src_id, sources[src_id])
            problems.append(p) if p else None

    print(f'extracts checked: {checked} (10 chapters + 33 lessons)')
    if problems:
        print(f'{len(problems)} wrong:')
        for p in problems[:14]:
            print('   !', p)
        return 1
    print('every extract holds exactly the book pages its lesson or chapter claims')
    print('   (compared sheet-by-sheet against the source document, not by counting)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
