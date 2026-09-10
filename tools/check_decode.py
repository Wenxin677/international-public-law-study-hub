"""Spot-check the decoded text: known phrases, plus a validity scan for
impossible Khmer sequences (a good proxy for residual decode errors)."""
import json, pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parents[1]
book = json.loads((ROOT / "extracted" / "textbook_decoded.json").read_text(encoding="utf-8"))
txt = "".join(ln["text"] for p in book.values() for ln in p)

CHECKS = ["នៅក្នុង", "នេះ", "ទៅ", "ដោយ", "សង្គ្រាម", "ជម្លោះ", "សហរដ្ឋអាមេរិក", "ប្រជាជាតិ",
          "ច្បាប់អន្តរជាតិ", "អធិបតេយ្យ", "នីតិអន្តរជាតិ", "កិច្ចព្រមព្រៀង", "សន្ធិសញ្ញា",
          "អង្គការសហប្រជាជាតិ", "សិទ្ធិមនុស្ស", "រដ្ឋាភិបាល", "អនុសញ្ញា", "ទីក្រុងប៉ារីស"]
print("known-phrase spot check (occurrences in decoded book):")
for c in CHECKS:
    print(f"  {c:<28} {txt.count(c):>5}")

bad = {
    "coeng before vowel": len(re.findall("\u17D2[\u17B6-\u17C5]", txt)),
    "coeng at end": len(re.findall("\u17D2(?![\u1780-\u17A2])", txt)),
    "double vowel": len(re.findall("([\u17B6-\u17C5])\\1", txt)),
    "prebase before coeng": len(re.findall("[\u17C1\u17C2\u17C3]\u17D2", txt)),
    "stray PUA": len(re.findall("[\uE000-\uF8FF]", txt)),
}
print("\nvalidity scan (lower is better):")
for k, v in bad.items():
    print(f"  {k:<22} {v:>6}")
print(f"\ntotal chars: {len(txt):,}")
