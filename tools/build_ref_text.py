"""Write reference-document text files (ECCC law, Paris Convention) for authoring."""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
EX = ROOT / "extracted"
OUT = EX / "chapters"
OUT.mkdir(exist_ok=True)

def clean(lines):
    out = []
    for ln in lines:
        t = re.sub(r"\s+", " ", ln).strip()
        if t:
            out.append(t)
    return out

for key, name, title in [("krlaw", "ref-eccc", "Law on the Establishment of the Extraordinary Chambers (ECCC Law, as amended 27 Oct 2004)"),
                         ("paris", "ref-paris", "Paris Convention for the Protection of Industrial Property (WIPO)")]:
    data = json.loads((EX / f"{key}.json").read_text(encoding="utf-8"))
    buf = [f"# {name}: {title}", ""]
    for p in data["pages"]:
        buf.append(f"\n<!-- page {p['page']} -->")
        buf.extend(clean(p["text"].split("\n")))
    (OUT / f"{name}.txt").write_text("\n".join(buf), encoding="utf-8")
    print(name, (OUT / f"{name}.txt").stat().st_size, "bytes")
