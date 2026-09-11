# RoboCL — Public International Law Study Hub

**Live site:** https://wenxin677.github.io/international-public-law-study-hub/
**Built by Sok Panha, with AI.**

A bilingual **Khmer / English** study app for public international law, made from three
source documents and one AI teacher that never invents an answer.

| # | Source | Language | Pages |
|---|---|---|---|
| 1 | ច្បាប់សាធារណៈអន្តរជាតិ — ឡាយ រត្តនា (2021) | Khmer | 193 |
| 2 | Law on the Establishment of the Extraordinary Chambers (ECCC Law, as amended 27 Oct 2004) | English | 20 |
| 3 | Paris Convention for the Protection of Industrial Property (WIPO, 1883/1979) | English | 20 |

Everything inside the app — 10 chapters, 33 lessons, 238 quiz questions, 193 glossary terms
and 624 searchable passages — is derived from those documents only.

---

## What is in it

| Page | What it does |
|---|---|
| `index.html` | **Homepage / tutorial** — what the site is, the five study tools, four steps to start, FAQ, and the sources. Public (no account needed). |
| `signin.html` | **Sign in / create account** — username + password only. |
| `dashboard.html` | **Dashboard** — progress ring, streak, XP and rank, best quiz scores, continue-where-you-stopped, all 10 chapters, your notes. |
| `learn.html` | **Lessons** — chapter rail + lesson with objectives, key points, verbatim quotes (with page numbers), term flashcards, your notes, mark-as-studied, print. |
| `quiz.html` | **Quizzes** — per lesson, per chapter (12 questions) or mixed (10 random), instant explanations, page references, review of your mistakes, best-score memory. Keys `1–4` / `Enter`. |
| `teacher.html` | **RoboCL, the AI teacher** — a Claude-style chat. Shows its work ("reading the question → searching the book → comparing passages → building the answer → checking pages"), streams the answer, and always cites the page. |
| `library.html` | **Textbook & sources** — read the textbook page by page, open the reference PDFs in an embedded viewer, see real page samples. |
| `glossary.html` | **Glossary** — 193 Khmer–English legal terms, table or flashcards. |
| `about.html` | **About / credits** — who built it, how, and the rights note. |
| `admin.html` | **User data** (owner) — the accounts and sign-in records on this device, with CSV / JSON export. |

RoboCL answers are **retrieval-grounded**: the engine finds the passages, then composes an
answer from quoted text, the authored key points and the term definitions. When the sources do
not cover a question it says so instead of guessing.

---

## Accounts

* Sign-up needs **only a username and a password** — no email, no payment, no personal data.
* The password is never stored. The browser derives a **PBKDF2-SHA256 hash (120 000 rounds,
  random salt)** with `crypto.subtle` and keeps only that. Where `crypto.subtle` is unavailable
  (opening the files directly from disk in some browsers) it falls back to iterated SHA-256.
* Every app page is behind `IPL.guard()`: without a session you are sent to `signin.html`.
* Sign-up / sign-in / sign-in-failure / sign-out events are recorded locally so the owner can
  see who used the site. `admin.html` lists them and exports CSV or JSON. It is opened with an
  **owner code** that is only stored as a PBKDF2 hash (120 000 rounds) in `docs/data/config.js` —
  make your own with `python tools/admin_code.py "your code"`. With a database connected the page
  asks for your own account password instead, and nothing secret is in the file at all. Without a
  database this gate is a convenience only: it hides the panel from casual visitors, and the rows
  it shows live in that visitor's own browser.
* **Collecting this from every visitor's device needs somewhere to send it** — a static site has
  nowhere to put it by itself. Two ready-made options, both one setting in
  [`docs/data/config.js`](docs/data/config.js):
  * **Google Sheet (recommended)** — create a sheet, paste
    [`tools/google-sheet-collector.gs`](tools/google-sheet-collector.gs) into its Apps Script
    editor, deploy it as a Web app ("Anyone" access), and put the `/exec` URL in
    `window.ROBOCL_SHEET`. Every sign-up / sign-in / failed attempt / sign-out then appends a row
    (`time · username · event · device · browser · language`) to your spreadsheet, and a second
    "all users" tab is kept as a per-user summary.
  * **Supabase** — create a free project, run [`tools/supabase.sql`](tools/supabase.sql), and fill
    in `window.ROBOCL_CLOUD`.
  Only the username, the event and the device are ever sent — **never the password and never its
  hash**. `admin.html` shows which collector is live and has a "Send a test row" button.
  When a collector is configured the sign-up form automatically shows users that their username
  and sign-in times are recorded.

---

## Sources, rights and honesty

* The **code** is MIT (see `LICENSE`).
* The **texts are not ours**. They are quoted with page numbers for study, credited to their
  authors, and `NOTICE.md` invites a takedown request from any rights holder.
* The textbook ships as a full-text index (the owner's choice). To publish a reduced
  quotes-only build instead: `python tools/build_site_data.py --quotes-only`.
* The textbook PDF itself is **not** published; the Library reads the text recovered from it.
  The two reference documents are public legal texts and are included for the PDF viewer.

---

## Security

What the site does to protect the people using it:

| Area | Measure |
|---|---|
| Passwords | bcrypt inside the database (or PBKDF2-SHA256, 120k rounds, on the device when no database is set up) — never stored, never logged, never sent to the sheet collector |
| Password rules | minimum 8 characters, with a strength meter; usernames limited to `a–z 0–9 _ .` |
| Brute force | 8 failed attempts for a username in 15 minutes locks it out in the database, plus a 5-attempt / 10-minute lock in the browser |
| Database exposure | Row Level Security with no policies: the public key cannot read or write the tables; only four functions are callable |
| Account list | requires an `is_admin` account **and** its real password — no shared secret is published |
| Owner code (no database) | compared against a **PBKDF2-SHA256 hash** (120 000 rounds) in `config.js`, so the code is not in the repository (`tools/admin_code.py`) |
| Script injection | strict `Content-Security-Policy` on every page (`script-src 'self'`, no inline scripts), all user text HTML-escaped, `object-src`/`base-uri` locked, `target=_blank` links carry `rel=noopener` |
| Collecting data | only the username, event, device, browser string and time; the sign-up form tells users when collection is on |
| Sessions | 14-day expiry, fresh token per sign-in, "don't remember me" keeps the session in the tab only |

What is **not** protected, honestly:

* **Page guards are convenience, not security.** The app pages are static files; anyone can read
  the study content directly. The real protection is that *account data* lives in the database and
  passwords are hashed — not that a page is hidden.
* **The collector URL is public** (it has to be, so visitors' browsers can post to it). A stranger
  who reads the source could add junk rows. The Apps Script sanitises every field (length caps,
  control characters stripped, a leading `=`/`+`/`-`/`@` neutralised so a post can never become a
  live spreadsheet formula) and refuses more than ~150 rows a minute, and the optional `token` in
  `config.js`/the Apps Script makes posts without it pointless; if the sheet is still abused,
  redeploy the Apps Script for a new URL. With a database connected, events have a better home
  (server-side, RLS-protected).
* **No server-side rate limiting on the static host.** Lockouts are enforced in the database and in
  the browser; a determined attacker can still open many connections.
* **GitHub Pages cannot send security headers** (HSTS, X-Frame-Options, Permissions-Policy). The CSP
  is delivered by meta tag, which covers most of the practical risk. A custom domain + Cloudflare
  in front would let you add the rest.

## Accounts in a real database (recommended once you have users)

By default accounts live in each visitor's browser. Point the app at a database and every device
shares the same accounts — a student can sign up on a phone and sign in on a laptop.

```
tools/supabase-accounts.sql   →  the schema, the security rules and three functions
docs/data/config.js           →  window.ROBOCL_DB = { url, key }
```

What that SQL sets up:

* `robo_accounts` — username, **bcrypt password hash**, created, last sign-in, sign-in count,
  failed attempts, language. `robo_events` — every signup / signin / failed attempt / signout.
* **Row Level Security with no policies**: the browser (holding only the public anon key) cannot
  read or write either table. No password hash can be downloaded from the site.
* Three `SECURITY DEFINER` functions do all the work — `robo_signup`, `robo_login`, `robo_logout` —
  plus `robo_admin_accounts` (secret-protected) which returns usernames and activity, never hashes.
* Passwords are verified inside the database; nobody, including the owner, can read one. A lost
  password can only be reset, never recovered.

The site keeps working if the database is unreachable: sign-up and sign-in fall back to the
on-device account, and database-backed accounts say plainly that a connection is needed.

`admin.html` shows whether a database is connected, and **Load every account from the database**
renders the whole user table with CSV export.

## Sheet collector vs database

They do different jobs and can run together:

| | Google Sheet (`ROBOCL_SHEET`) | Database (`ROBOCL_DB`) |
|---|---|---|
| Stores | a log of events | the accounts themselves |
| Sign-in on a new device | needs an account there already | works anywhere |
| Passwords | never | bcrypt hash, service-side |
| You read it | in Google Sheets | in `admin.html` or the Supabase dashboard |

---

## Repository layout

```
docs/                     the published site (GitHub Pages, main → /docs)
  index.html … admin.html the ten pages
  assets/css/style.css    design system (dark/light, animations, mobile)
  assets/js/              core · auth · data · search · teacher · learn · quiz · glossary · library · home · landing · signin · admin
  assets/img/             RoboCL logo set + look-inside page samples
  data/lessons.js         10 chapters, 33 lessons, quizzes, terms  (generated)
  data/corpus.js          624 passages for retrieval                (generated)
  data/library.js         245 pages of source text for the reader   (generated)
  data/config.js          owner settings: admin code, optional Supabase cloud
  library/*.pdf           the two public reference documents
content/                  authored lesson JSON (the editorial source)
tools/                    the pipeline that builds everything above
tools/dev/                browser self-test + responsive audit harnesses
```

## Rebuilding

```bash
python tools/build_corpus.py        # chapter text -> retrieval corpus
python tools/build_library.py       # per-page reading data + look-inside images
python tools/build_site_data.py     # merge content/ -> docs/data/*.js, verify every quote
python tools/verify_site.py         # links, i18n coverage, data consistency, guards
```

`tools/verify_site.py` fails if any internal link is broken, if a translation key is missing
from either language, if the landing-page numbers drift from the built data, or if an app page
stops guarding its content.

## Testing the real pages

`tools/dev/_selftest.html` and `tools/dev/_audit.html` drive the actual pages in a browser:

```bash
cp tools/dev/*.html docs/            # they must be served from docs/ to be same-origin
python -m http.server 8099 --bind 127.0.0.1   # from docs/
# open http://127.0.0.1:8099/_selftest.html   -> 69 flow checks (auth, lessons, quiz, RoboCL, library, admin, EN/KM)
# open http://127.0.0.1:8099/_audit.html      -> horizontal-overflow audit at 360 / 390 / 768 px
```

Last run: **69/69 checks passed**, no horizontal overflow on any page at 360 px.

## Method note

The Khmer PDF's text layer is corrupt (a Word 2000 font whose ToUnicode map points at the wrong
glyphs), so extractors return scrambled text. `tools/recover.py` recovers it exactly by matching
each embedded glyph outline against the KhmerOS fonts installed on the machine, then
`tools/khmer_order.py` rebuilds Khmer logical order from the display order. Every quote in the
app is checked to be a verbatim substring of that recovered text — 128/128 verified.

---

Study tool only — not legal advice. Questions: open an issue on the repository.
