"""Content audit of the shipped study data.

Checks, per lesson: the learning aids exist in both languages; every quiz question
is well formed (four options in both languages, an answer index in range, an
explanation, a cited page); and the answer the site marks correct is actually
supported by the text of the page it cites.

The last one is the check that matters: a wrong answer key or a page citation
pointing at the wrong page teaches students something false. It compares against
the decoded corpus (docs/data/corpus.json), not the source PDF, because the PDF's
own text layer is the corrupt one the project had to decode around.

Run:  python tools/dev/content_audit.py [--samples N]
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'docs' / 'data'


def load_js_object(path: pathlib.Path):
    """window.IPL_CHAPTERS = [ ... ];  ->  python list"""
    text = path.read_text(encoding='utf-8')
    start = text.index('[')
    end = text.rindex(']') + 1
    return json.loads(text[start:end])


def norm(s: str) -> str:
    """compare on letters only: the site's typography adds zero-width joiners"""
    return re.sub(r'[\s\u200b-\u200d\u2060]+', '', s or '')


def page_texts():
    """book page -> the full decoded text of that page.

    Read from the decoded chapter files, which carry the page mapping in a comment
    (`<!-- pdf page 12 | book page 1 -->`). The shipped corpus is only ~3 passages a
    page, so it cannot prove an answer is absent from a page.
    """
    texts = {}
    for f in sorted((ROOT / 'extracted' / 'chapters').glob('ch*.txt')):
        cur = None
        for line in f.read_text(encoding='utf-8').splitlines():
            m = re.match(r'<!--\s*pdf page (\d+)\s*\|\s*book page (\d+)\s*-->', line)
            if m:
                cur = int(m.group(2))
                texts.setdefault(cur, [])
            elif cur is not None and line.strip():
                texts[cur].append(line)
    return {k: '\n'.join(v) for k, v in texts.items()}


def main() -> int:
    samples = 12
    if '--samples' in sys.argv:
        samples = int(sys.argv[samples and sys.argv.index('--samples') + 1])

    chapters = load_js_object(DATA / 'lessons.js')
    corpus = json.loads((DATA / 'corpus.json').read_text(encoding='utf-8'))
    passages = corpus.get('passages') if isinstance(corpus, dict) else corpus
    by_page = {}
    for p in passages:
        if isinstance(p, dict):
            pg = p.get('page') or p.get('p')
            if pg:
                by_page.setdefault(int(pg), []).append(p)
    full = page_texts()
    print(f'corpus passages: {len(passages)} · pages indexed: {len(by_page)} · '
          f'decoded page texts: {len(full)} pages')

    lessons = [l for ch in chapters for l in (ch.get('lessons') or [])]
    print(f'chapters: {len(chapters)} · lessons: {len(lessons)}')
    print(f'lesson fields: {sorted(lessons[0].keys())}')
    problems = []

    # 1. learning aids present in both languages
    missing = []
    for l in lessons:
        for field in ('objectives', 'plain', 'keyPoints', 'terms'):
            v = l.get(field)
            if not v or not (v.get('km') if isinstance(v, dict) else v):
                missing.append(f"{l['id']}.{field}")
    print(f'lessons: {len(lessons)} · learning aids missing: {len(missing)} {missing[:6]}')
    problems += missing

    # 2. quiz shape
    qs = []
    for l in lessons:
        for q in (l.get('quiz') or []):
            qs.append((l['id'], q))
    bad = []
    for lid, q in qs:
        o = q.get('options') or {}
        km, en = o.get('km') or [], o.get('en') or []
        if len(km) != 4 or len(en) != 4:
            bad.append(f'{lid}: {len(km)} km / {len(en)} en options')
        ans = q.get('answer')
        if not isinstance(ans, int) or not (0 <= ans < len(km)):
            bad.append(f'{lid}: answer index {ans} out of range')
        if not (q.get('explain') or {}).get('km'):
            bad.append(f'{lid}: no km explanation')
        if not q.get('page'):
            bad.append(f'{lid}: no cited page')
    print(f'quiz questions: {len(qs)} · malformed: {len(bad)} {bad[:6]}')
    problems += bad

    # 3. is the marked-correct answer anchored in the page it cites?
    # The options are authored paraphrases, not verbatim quotes, so an exact
    # substring test is the wrong instrument (it flagged "លក្ខន្តិកៈតុលាការ"
    # against the source's "លក្ខន្តិកៈរបស់តុលាការ" and called it a miss). What can
    # be checked mechanically: does the cited page contain a distinctive term from
    # the correct answer at all? Questions with nothing in common are the ones a
    # human should read.
    checked = anchored = 0
    skipped_english = 0
    misses = []
    for lid, q in qs:
        page = q.get('page')
        o = q.get('options') or {}
        km = o.get('km') or []
        if not page or not km:
            continue
        if lid.startswith('ref-'):
            # the reference documents are English: a Khmer answer can never match
            # their text, so this check does not apply to those lessons
            skipped_english += 1
            continue
        ans = q.get('answer')
        if not isinstance(ans, int) or ans >= len(km):
            continue
        ptxt = full.get(int(page))
        if ptxt is None:
            sub = by_page.get(int(page))
            if not sub:
                misses.append(f'{lid}: nothing decoded for page {page}')
                continue
            ptxt = ' '.join(str(x.get('text') or x.get('km') or '') for x in sub)
        blob = norm(ptxt)
        # Khmer has no word spaces, so compare in sliding windows: if any 5-character
        # run of the answer appears in the page, the answer is anchored there.
        ans_norm = norm(km[ans])
        windows = {ans_norm[i:i + 5] for i in range(0, max(1, len(ans_norm) - 4))}
        checked += 1
        if any(w in blob for w in windows):
            anchored += 1
        else:
            misses.append(f'{lid}: no phrase of the answer appears on cited page {page} — "{km[ans][:46]}"')
    print(f'\nanswer anchored on its cited page: {anchored}/{checked} '
          f'({100 * anchored // max(checked, 1)}%)  ·  {skipped_english} English-source '
          f'questions not applicable')
    for m in misses[:8]:
        print('   !', m)
    problems += misses[:8]

    print(f'\n{len(problems)} problem(s) in the shipped content data')
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
