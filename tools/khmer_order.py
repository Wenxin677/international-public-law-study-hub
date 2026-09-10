"""Khmer display order (legacy MS Word / KhmerOS layout) -> Unicode logical order.

The textbook PDF stores Khmer glyphs in *display* order, i.e. the order Word laid
them out on the line, which differs from Unicode logical order:

    display              logical (Unicode)
    ្រ ប + vowel        ប ្ រ + vowel        ro subscript renders to the left of its base
    ជ ម េ ្ល ា ះ          ជ ម ្ ល ោ ះ           pre-base vowel typed before, split vowel
    ស ិ ទ ិ ្ធ           ស ិ ទ ្ ធ ិ           below-vowel typed before the subscript
    ឆ ា ្ន ំ               ឆ ្ ន ា ំ             ា typed with its base, subscript after

Rebuilt cluster by cluster; non-Khmer characters pass through untouched.
"""
import re

COENG = "\u17D2"
RO = "\u179A"
PREBASE = "\u17C1\u17C2\u17C3"
PART_UPPER = "\uF155"                                     # KhmerOS PUA: upper part of ើ
SIGNS = "\u17C6\u17C7\u17C8\u17CB\u17CC\u17CD\u17CE\u17CF\u17D0\u17DD"
STEM_SIGNS = "\u17C9\u17CA"                               # ៉ ៊ follow the base directly
VOWELS = "".join(chr(c) for c in range(0x17B6, 0x17C6))
MARKS = VOWELS + SIGNS + STEM_SIGNS + PART_UPPER

# split vowels: pre-base part + post-base part -> single Unicode vowel sign
SPLIT = [
    ("\u17C1\u17B6", "\u17C4"),      # េ + ា  -> ោ
    ("\u17C1\u17B8", "\u17BE"),      # េ + ី  -> ើ
    ("\u17C1\u17B9", "\u17BF"),      # េ + ឹ  -> ឿ
    ("\u17C1\u17BA", "\u17C0"),      # េ + ឺ  -> ៀ
    ("\u17C2\u17B6", "\u17C5"),      # ែ + ា  -> ៅ
    ("\u17C1\u17BB", "\u17BD"),      # េ + ុ  -> ួ
    ("\u17C1\u17C5", "\u17C5"),
    ("\u17C2\u17C5", "\u17C5"),
    ("\u17C1\u17C0", "\u17C0"),
    ("\u17C1\u17BE", "\u17BE"),
    ("\u17C1\u17BF", "\u17BF"),
    ("\u17C1\u17BD", "\u17BD"),
    ("\u17C1" + PART_UPPER, "\u17BE"),
    (PART_UPPER, "\u17BE"),
]


def _is_cons(ch):
    return "\u1780" <= ch <= "\u17A2"


def _merge_marks(marks):
    stems = "".join(m for m in marks if m in STEM_SIGNS)
    vowels = "".join(m for m in marks if m not in SIGNS and m not in STEM_SIGNS)
    signs = "".join(m for m in marks if m in SIGNS)
    for a, b in SPLIT:
        vowels = vowels.replace(a, b)
    vowels = re.sub("([" + VOWELS + "])\\1+", r"\1", vowels)     # collapse doubles
    return stems + vowels + signs


def visual_to_logical(s):
    if not s:
        return s
    s = s.replace("\u200b", "")
    out = []
    pending_pre = []          # pre-base vowels waiting for their cluster
    pending_ro = False        # ្រ that must land after the next cluster's subscripts
    i, n = 0, len(s)

    def flush_pending():
        nonlocal pending_pre, pending_ro
        if pending_pre:
            out.append(_merge_marks(pending_pre))
            pending_pre = []
        if pending_ro:
            out.append(COENG + RO)
            pending_ro = False

    while i < n:
        c = s[i]
        # a pre-base vowel belongs to the cluster that follows
        if c in PREBASE or c == PART_UPPER:
            pending_pre.append(c)
            i += 1
            continue
        # coeng-ro
        if c == COENG and i + 1 < n and s[i + 1] == RO:
            k = i + 2
            skipped = []
            while k < n and (s[k] in PREBASE or s[k] == PART_UPPER):
                skipped.append(s[k])
                k += 1
            if k < n and (_is_cons(s[k]) or s[k] == COENG):
                pending_pre.extend(skipped)
                pending_ro = True
                i = k
                continue
            out.append(COENG + RO + _merge_marks(pending_pre))
            pending_pre = []
            i += 2
            continue
        # a consonant starts a cluster
        if _is_cons(c):
            base = c
            subs, marks = [], []
            pending_ro_next = False
            pending_pre_next = []
            j = i + 1
            while j < n:
                if s[j] == COENG and j + 1 < n and _is_cons(s[j + 1]):
                    if s[j + 1] == RO and j + 2 < n and _is_cons(s[j + 2]):
                        pending_ro_next = True     # ro for the next cluster
                        pending_pre_next = []
                        break
                    subs.append(s[j:j + 2])
                    j += 2
                    continue
                if s[j] in MARKS:
                    if s[j] in PREBASE:
                        break                      # vowel belongs to the next cluster
                    marks.append(s[j])
                    j += 1
                    continue
                break
            ro = [x for x in subs if x == COENG + RO]
            others = [x for x in subs if x != COENG + RO]
            if pending_ro:
                ro.append(COENG + RO)
                pending_ro = False
            out.append(base + "".join(others) + "".join(ro) + _merge_marks(pending_pre + marks))
            pending_pre = []
            i = j
            continue
        # marks with no base left (e.g. pre-base vowel + post vowel: េ + ៀ)
        if c in MARKS:
            if pending_pre:
                run = []
                while i < n and s[i] in MARKS:
                    run.append(s[i])
                    i += 1
                out.append(_merge_marks(pending_pre + run))
                pending_pre = []
                continue
            out.append(c)
            i += 1
            continue
        out.append(c)
        i += 1
    flush_pending()
    return "".join(out)
