"""Khmer text recovery from a legacy (MS Word 2000 / KhmerOS) PDF.

Why not the PDF's ToUnicode? It is corrupt: Word built it against a wrong glyph
order, so extraction yields shifted/garbled characters.

What works: the embedded font subsets are copies of the KhmerOS fonts that ship
with Windows, and they keep the original glyph numbering (verified per font
object by outline comparison: 0 mismatches). With Identity-H encoding and
CIDToGIDMap=Identity, the CID is the original glyph index, so
    CID -> original glyph name -> Unicode text
gives exact glyph identity. The glyphs are stored in *display* order, so Khmer
visual->logical reordering is applied afterwards.
"""
import io, json, pathlib, re, sys
import pymupdf
from fontTools.ttLib import TTFont
from fontTools import agl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

ROOT = pathlib.Path(__file__).resolve().parents[1]
SYS_FONTS = {
    "KhmerOSSiemreap": r"C:\Windows\Fonts\KhmerOS_siemreap.ttf",
    "KhmerOSMuolLight": r"C:\Windows\Fonts\KhmerOS_muollight.ttf",
    "KhmerOSbattambang": r"C:\Windows\Fonts\KhmerOS_battambang.ttf",
    # the slide decks are set in KhmerOS Content; without it table_for() fell back
    # to Siemreap and every body span decoded to the wrong glyphs
    "KhmerOSContent": r"C:\Windows\Fonts\KhmerOS_content.ttf",
    "KhmerOSContentBold": r"C:\Windows\Fonts\KhmerOSContent-Bold.ttf",
}
KH_CONS = "\u1780-\u17A2"
COENG = "\u17D2"
PREBASE = "\u17C1\u17C2\u17C3"          # េ ែ ៃ
PART_UPPER = "\uF155"                   # KhmerOS private-use upper part of ើ

# split-vowel recombination: pre-part + post-part -> single Unicode vowel
SPLIT_VOWELS = [
    ("\u17C1\u17B6", "\u17C4"),      # េ + ា  -> ោ
    ("\u17C1\u17B8", "\u17BE"),      # េ + ី  -> ើ
    ("\u17C1\u17B9", "\u17BF"),      # េ + ឹ  -> ឿ
    ("\u17C1\u17BA", "\u17C0"),      # េ + ឺ  -> ៀ
    ("\u17C2\u17B6", "\u17C5"),      # ែ + ា  -> ៅ
    ("\u17C1" + PART_UPPER, "\u17BE"),
    ("\u17C1\u17BB", "\u17BD"),      # ុ variants seen in legacy input
    (PART_UPPER, "\u17BE"),
]


class GlyphTable:
    """glyph index -> Unicode text, using the original KhmerOS font."""

    def __init__(self, path, label):
        self.label = label
        self.font = TTFont(path, lazy=False)
        self.order = self.font.getGlyphOrder()
        inv = {}
        for u, n in self.font.getBestCmap().items():
            inv.setdefault(n, chr(u))
        self.idx2text = {i: self._name_to_text(n, inv) for i, n in enumerate(self.order)}

    @staticmethod
    def _name_to_text(nm, inv):
        # ligature forms: <base> + vowel ("a" = ា, "au" = ៅ, in legacy naming)
        m = re.fullmatch(r"uni([0-9A-Fa-f]{4})\.sub(?:\.alt\d*)?\.(a|au)", nm)
        if m:
            return COENG + chr(int(m.group(1), 16)) + ("\u17B6" if m.group(2) == "a" else "\u17C5")
        m = re.fullmatch(r"uni([0-9A-Fa-f]{4})\.(?:alt\d*)?\.(a|au)", nm)
        if m:
            return chr(int(m.group(1), 16)) + ("\u17B6" if m.group(2) == "a" else "\u17C5")
        m = re.fullmatch(r"uni([0-9A-Fa-f]{4})\.(a|au)", nm)
        if m:
            return chr(int(m.group(1), 16)) + ("\u17B6" if m.group(2) == "a" else "\u17C5")
        # subscript forms
        m = re.fullmatch(r"uni([0-9A-Fa-f]{4})\.sub(?:\.alt\d*)?", nm)
        if m:
            return COENG + chr(int(m.group(1), 16))
        if nm in inv:
            return inv[nm]
        m = re.fullmatch(r"uni([0-9A-Fa-f]{4})\.[a-zA-Z0-9]+", nm)
        if m:
            return chr(int(m.group(1), 16))
        m = re.fullmatch(r"uni([0-9A-Fa-f]{4})", nm)
        if m:
            return chr(int(m.group(1), 16))
        m = re.fullmatch(r"uni([0-9A-Fa-f]{4})([0-9A-Fa-f]{4})", nm)
        if m:
            return chr(int(m.group(1), 16)) + chr(int(m.group(2), 16))
        t = agl.toUnicode(nm)
        return t if t and t != nm else ""

    def __len__(self):
        return len(self.order)


from khmer_order import visual_to_logical  # noqa: E402


class Recover:
    def __init__(self, pdf_path):
        self.doc = pymupdf.open(pdf_path)
        self.tables = {k: GlyphTable(v, k) for k, v in SYS_FONTS.items() if pathlib.Path(v).exists()}

    def table_for(self, basefont):
        """Pick the table by name, preferring the most specific match: the subset
        names look like 'BCDGEE+Content-Bold', which must not fall back to the
        regular weight's glyph order (or to another family entirely)."""
        norm = re.sub(r"[^a-z0-9]", "", basefont.lower())
        best = None
        for key, tab in self.tables.items():
            k = re.sub(r"[^a-z0-9]", "", key.replace("KhmerOS", "").lower())
            if k and k in norm and (best is None or len(k) > best[0]):
                best = (len(k), tab)
        if best:
            return best[1]
        return self.tables.get("KhmerOSSiemreap") or list(self.tables.values())[0]

    def page_lines(self, pno):
        page = self.doc[pno]
        spans = []
        seen = set()
        for span in page.get_texttrace():
            fname = span["font"]
            khmer = "KhmerOS" in fname or "Khmer" in fname
            if khmer:
                tab = self.table_for(fname)
                txt = "".join(tab.idx2text.get(ch[1], "") for ch in span["chars"] if ch[1] >= 0)
            else:
                txt = "".join(chr(ch[0]) for ch in span["chars"] if 0 <= ch[0] < 0x110000)
            if not txt.strip():
                continue
            x0, y0, x1, y1 = span["bbox"]
            key = (round(x0), round(y0), round(x1), round(y1), txt)
            if key in seen:
                continue
            seen.add(key)
            spans.append({"text": txt, "bbox": (round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)),
                          "font": fname, "size": round(span["size"], 1)})
        spans.sort(key=lambda s: (round(s["bbox"][1], 1), s["bbox"][0]))
        lines = []
        for s in spans:
            if lines and abs(lines[-1]["y"] - s["bbox"][1]) <= 3.5:
                lines[-1]["spans"].append(s)
            else:
                lines.append({"y": s["bbox"][1], "spans": [s]})
        out = []
        for ln in lines:
            parts = sorted(ln["spans"], key=lambda z: z["bbox"][0])
            raw = "".join(p["text"] for p in parts)
            # reorder Khmer display order -> logical order (non-Khmer chars untouched)
            text = visual_to_logical(raw)
            out.append({"y": ln["y"], "text": text,
                        "font": parts[0]["font"], "size": parts[0]["size"], "x": parts[0]["bbox"][0]})
        return out

    def book(self):
        return {pno + 1: self.page_lines(pno) for pno in range(len(self.doc))}


if __name__ == "__main__":
    rec = Recover(ROOT / "source" / "11 International Public Law Textbook.pdf")
    for pno in [int(a) - 1 for a in sys.argv[1:]] or [11]:
        print("=" * 25, "PDF page", pno + 1, "=" * 25)
        for ln in rec.page_lines(pno):
            print(f"[{ln['font'][:20]:<20} {ln['size']:>4.1f}] {ln['text']}")
