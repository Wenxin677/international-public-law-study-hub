# RoboCL — Public International Law Study Hub

![RoboCL logo](docs/assets/img/logo.png)

**Live site:** https://wenxin677.github.io/international-public-law-study-hub/
**Built by Sok Panha, with AI.**

A bilingual **Khmer / English** study app for public international law, built from three
source documents, with an AI teacher that answers only from those documents.

| # | Source | Language | Pages |
|---|---|---|---|
| 1 | ច្បាប់សាធារណៈអន្តរជាតិ — ឡាយ រត្តនា (2021) | Khmer | 193 |
| 2 | Law on the Establishment of the Extraordinary Chambers (ECCC Law, as amended 27 Oct 2004) | English | 20 |
| 3 | Paris Convention for the Protection of Industrial Property (WIPO, 1883/1979) | English | 20 |

Everything inside the app — 10 chapters, 33 lessons, 238 quiz questions, 193 glossary terms
and 624 searchable passages — is derived from those documents only.

---

## Features

| Page | What it does |
|---|---|
| `index.html` | Homepage and tutorial: what the site is, the study tools, how to start, FAQ, sources. No account needed. |
| `signin.html` | Create an account or sign in — **username and password only**. |
| `dashboard.html` | Progress ring, streak, XP and rank, best quiz scores, continue-where-you-stopped, all chapters, your notes. |
| `learn.html` | Lessons: read the real textbook pages inline, plus learning objectives, key points, verbatim quotes with page numbers, key terms and your own notes. |
| `quiz.html` | Quizzes per lesson, per chapter or mixed, with instant explanations and page references, mistake review and best-score memory. |
| `teacher.html` | **RoboCL**, the AI teacher: a chat that shows its steps, streams the answer and always cites the page it used. |
| `library.html` | Read any of the three source documents page by page, with the searchable text beside the real pages. |
| `glossary.html` | 193 Khmer–English legal terms, as a table or flashcards. |
| `about.html` | Who built it, how, and the rights note. |

RoboCL's answers are **retrieval-grounded**: it finds the relevant passages first, then answers
from quoted text, the authored key points and the term definitions. When the sources do not
cover a question it says so instead of guessing.

**Languages:** Khmer and English, switchable anywhere (only those two, by design).

---

## Tech stack

* **Vanilla HTML, CSS and JavaScript** — no framework, no bundler, no build step required to run.
* **Static hosting** — the published site is plain files, served by GitHub Pages.
* **Optional backend** — accounts, progress and notes can be kept in a database you own, so a
  student's work follows them between devices. Until you connect one, accounts live in each
  visitor's browser and the app works completely offline.
* **Fonts** from Google Fonts. No trackers, no analytics, no ad networks.

---

## Run it locally

There is nothing to install. Either open the site directly:

```
docs/index.html
```

…or serve the folder (needed if you want a local sign-in to be remembered):

```bash
cd docs
python -m http.server 8000
# then open http://127.0.0.1:8000/
```

---

## Publish your own copy

1. Fork or copy this repository.
2. In **Settings → Pages**, choose **Deploy from a branch**, then branch `main` and folder
   **`/docs`**.
3. Your site appears at `https://<your-username>.github.io/<your-repo>/`.

---

## Accounts, progress and privacy

* Sign-up asks for **a username and a password only** — no email address, no payment, no
  personal details.
* Passwords are **not stored in any readable form**. Nobody — the site owner included — can look
  up a password; a forgotten one has to be reset.
* Study progress and notes are private to the account that made them.
* Sign-in activity (username, event, time, device) is recorded so the owner can see how the site
  is being used, and is shown to users on the sign-up form. The full privacy and rights wording
  is in [`NOTICE.md`](NOTICE.md).

If you want accounts and progress to work across devices, point the app at a database of your own
and fill in the settings file [`docs/data/config.js`](docs/data/config.js) with your own values:

```js
window.YOUR_BACKEND = {
  url: 'YOUR_BACKEND_URL_HERE',
  key: 'YOUR_PUBLIC_KEY_HERE'
};
```

The repository ships the SQL you can run in your own project, and an optional Google Sheet
collector for the sign-in log — see the comments inside `docs/data/config.js`. **Nothing works
until you add your own credentials; no real keys or URLs are committed here.**

---

## Sources, rights and honesty

* The **code** is MIT (see [`LICENSE`](LICENSE)).
* The **texts are not ours**. They are quoted with page numbers for study, credited to their
  authors, and [`NOTICE.md`](NOTICE.md) invites a takedown request from any rights holder.
* The textbook ships as a full-text index (the owner's choice). To publish a reduced
  quotes-only build instead: `python tools/build_site_data.py --quotes-only`.
* The textbook PDF itself is published (the owner's decision) so the Library can show real pages.
  The two reference documents are public legal texts.

---

## Rebuilding the data

The generated files under `docs/data/` come from the `content/` and `tools/` folders:

```bash
python tools/build_corpus.py        # chapter text -> retrieval corpus
python tools/build_library.py       # per-page reading data
python tools/build_site_data.py     # authored content -> site data, quotes verified
python tools/verify_site.py         # links, translations, data consistency
```

`tools/verify_site.py` fails if a link is broken, a translation is missing from either language,
or the numbers on the landing page drift from the built data.

### Method note

The Khmer PDF's text layer is corrupt (a legacy font whose character map points at the wrong
glyphs), so ordinary extractors return scrambled text. `tools/recover.py` recovers it by matching
each embedded glyph outline against the same Khmer fonts, and `tools/khmer_order.py` rebuilds
Khmer logical order. Every quote in the app is then checked to be a verbatim substring of that
recovered text.

---

## Contributing

Issues and pull requests are welcome. If you spot a wrong translation, a mis-cited page or a bug,
please open an issue with the page and a screenshot if you can.

## License

MIT — see [`LICENSE`](LICENSE). The source texts keep their own rights; see [`NOTICE.md`](NOTICE.md).

---

Study tool only — **not legal advice**.
