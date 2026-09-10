# មជ្ឈមណ្ឌលសិក្សា ច្បាប់សាធារណៈអន្តរជាតិ · Public International Law Study Hub

A bilingual **Khmer / English** study web app for public international law, built from three sources:

| # | Source | Language | What it is |
|---|--------|----------|------------|
| 1 | **ច្បាប់សាធារណៈអន្តរជាតិ** — *International Public Law*, ឡាយ រត្តនា (Lay Rottana), 2021 | Khmer | 193-page textbook: the international community, states, sources of international law, the use of force, treaties, conventions, the 1991 Paris Peace Agreements |
| 2 | **Law on the Establishment of the Extraordinary Chambers** (ECCC Law, as amended 27 Oct 2004) | English | Legal basis of the Khmer Rouge tribunal |
| 3 | **Paris Convention for the Protection of Industrial Property** (WIPO, 1883 as revised) | English | National treatment, priority, patents, marks, the Union |

Everything runs **in the browser**. No server, no build step, no account, no tracking. Progress, notes and any API key stay in `localStorage`.

---

## ✨ What is in the app

| Page | What it does |
|------|--------------|
| `index.html` | Landing page: stats, chapter strip, XP / rank / streak progress |
| `learn.html` | 10 chapters → 33 lessons with **objectives, key points, verbatim quotes (page-cited), flashcard terms and per-lesson notes** |
| `quiz.html` | 238 questions: per-lesson, per-chapter and mixed-10 runs. Instant feedback, explanation, source page, score ring, review of wrong answers, best-score memory, keyboard shortcuts (1–4, Enter) |
| `chat.html` | **Ask the book** — a grounded assistant: BM25 retrieval over the whole corpus with Khmer-aware character n-grams (Khmer has no word spaces), English↔Khmer bridging through the app's own glossary, citation chips, “show source text”, and an optional plug-in-your-own-API-key mode for paraphrased / translated answers |
| `glossary.html` | 193 legal terms: Khmer ↔ English, definitions, chapter + page, table or flashcard mode |
| `about.html` | The sources, the method, how to cite, disclaimer |

Extras: Khmer / English / **both** language modes, dark & light themes, `Ctrl/⌘+K` command palette, printable lesson sheets, offline-friendly (no network calls unless you add an API key).

## 🚀 Run it

Open `index.html` in a browser — that is all. To serve it locally:

```bash
cd docs && python -m http.server 8000     # then http://localhost:8000
```

## 🧠 How the Khmer textbook text was recovered

The textbook PDF was produced with MS Word 2000 and a legacy KhmerOS font. Its embedded
`ToUnicode` maps are corrupt, so every normal PDF extractor returns shifted, garbled Khmer
(`សេចក្តី` → `សេចកតី`, `ព្រឹត្តិ` → `្រទឹស្តី`, …).

`tools/` contains the recovery pipeline actually used here:

1. **`recover.py`** — the embedded font subsets are copies of the KhmerOS fonts that ship with
   Windows and keep the original glyph numbering (`Identity-H` + `CIDToGIDMap/Identity`).
   Glyph outlines are matched against the installed `KhmerOS_siemreap.ttf` / `KhmerOS_muollight.ttf`
   to recover the exact Unicode for every glyph — including legacy ligature forms such as
   `.a` (base + ា) and `.au` (base + ៅ) — and then `khmer_order.py` rebuilds Unicode **logical order**
   from the display order the glyphs were laid out in.
2. **`khmer_order.py`** — display → logical reordering: pre-base vowels (េ ែ ៃ), the ╞ro╡ subscript
   written before its base, split vowels (េ+ា → ោ, េ+ី → ើ, …), vowel signs typed before subscripts.
3. **`decode_all.py`**, **`build_corpus.py`** — decode all 205 PDF pages, split the book into
   chapter files and build the searchable corpus.
4. **`build_site_data.py`** — merge the lesson JSON in `content/` into `docs/data/` and, crucially,
   **verify every quote verbatim against the decoded source** (currently 128/128) so no lesson text
   is invented.

Reproducing it needs `pymupdf`, `fonttools`, the KhmerOS fonts installed on Windows, and the source PDFs.

## 📁 Layout

```
docs/                     the published app (GitHub Pages: main /docs) (static, no build step)
  index.html learn.html quiz.html chat.html glossary.html about.html
  assets/css/style.css    design system
  assets/js/              core (i18n/progress), search (BM25), data, per-page scripts
  data/corpus.js          searchable passages from all three sources
  data/lessons.js         10 chapters · 33 lessons · 238 questions · 193 terms
tools/                    the text-recovery + build pipeline (Python / Node)
content/                  the lesson content sources (JSON)
```

## 🤝 Contributing / updating content

Lessons live in `content/*.json` following `content/_TEMPLATE.json`. After editing:

```bash
python tools/build_site_data.py     # merges content → docs/data + verifies quotes
node tools/search_test.js "your question"    # checks the chatbot retrieval
```

Every quote must be a verbatim substring of the decoded source, otherwise the build reports it.

## ⚖️ Licence & attribution

* **Code** (HTML/CSS/JS/Python in this repository): MIT — see `LICENSE`.
* **Quoted texts**: they are **not** MIT-licensed. The Khmer textbook remains the property of
  its author, ឡាយ រត្តនា (2021); the ECCC Law and the Paris Convention are public legal
  instruments (WIPO / UN). Quotations are included, with page references, for educational study.
  See `NOTICE.md` — and if you are a rights holder and want something removed, open an issue.
* This is a **study aid, not legal advice**.

## 🙏 Credits

Built as a study tool for Cambodian law students. Fonts: Kantumruy Pro, Inter, Fraunces (Google Fonts).
Text recovery, lesson structure, quizzes and the assistant were generated from the three sources above —
every claim in the app carries the page it came from.
