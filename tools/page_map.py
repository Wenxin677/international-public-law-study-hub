"""The one place that knows how book pages relate to PDF pages.

The textbook PDF opens with 11 front-matter sheets (cover, title, contents, i-x),
so its printed page 1 is sheet 12: PDF page = book page + 11.

Everything a student reads uses BOOK pages: the lesson ranges in lessons.js, the
"read page N" links in lessons and quizzes, and the chapter text files (their
headers record the mapping, e.g. "book pages 1-42 (pdf 12-53)"). Anything that
addresses a PDF file must add the offset, or it silently shows the wrong pages.

The reference documents have no front matter, so their offset is 0.
"""

TEXTBOOK_OFFSET = 11
OFFSETS = {"textbook": TEXTBOOK_OFFSET, "eccc": 0, "paris": 0, "ref-eccc": 0, "ref-paris": 0}


def offset(source_id: str) -> int:
    return OFFSETS.get(source_id, 0)


def pdf_page(source_id: str, book_page: int) -> int:
    """book page (what the printed book and the site cite) -> PDF sheet number"""
    return book_page + offset(source_id)


def book_page(source_id: str, pdf_page_number: int) -> int:
    """PDF sheet number -> book page (0 or less means front matter)"""
    return pdf_page_number - offset(source_id)


def front_matter(source_id: str) -> int:
    """sheets before book page 1 — not covered by any lesson"""
    return offset(source_id)
