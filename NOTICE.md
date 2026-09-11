# NOTICE — sources, rights and attribution

The **code** in this repository is MIT-licensed (see `LICENSE`). The **texts quoted by the app
are not**, and are used here under educational-quotation terms. Please read this before reusing
or redistributing the data files.

## 1. ច្បាប់សាធារណៈអន្តរជាតិ / International Public Law — ឡាយ រត្តនា (Lay Rottana), 2021

* Copyright remains with the author (and any publisher/institution holding rights).
* The app quotes this textbook: verbatim passages with page numbers, lesson summaries, key points,
  quiz questions and Khmer–English terminology, and the full text is indexed in
  `docs/data/corpus.js` (plus `docs/data/library.js` for the page reader) so that the **RoboCL**
  teacher can search it.
* Intended use: private study by students who are expected to work with this textbook.
  It is **not** a substitute for owning or reading the book, and no commercial use is intended.
* **If you are the author or a rights holder and you would prefer a shorter quotation, or the
  removal of the full-text index, open an issue in this repository and it will be actioned.**
  The build pipeline supports a reduced corpus:

  ```bash
  python tools/build_site_data.py --quotes-only     # ships lesson quotes only, no full-text index
  ```

## 2. Law on the Establishment of the Extraordinary Chambers (ECCC Law)

* As amended and promulgated on 27 October 2004 (NS/RKM/1004/006).
* A public legal instrument of the Kingdom of Cambodia; reproduced/quoted for study.
* Original English text also available from the Extraordinary Chambers in the Courts of Cambodia
  and the UN (the document supplied for this project is the standard English text).

## 3. Paris Convention for the Protection of Industrial Property

* WIPO legislative text (1883, revised at Brussels 1900, Washington 1911, The Hague 1925,
  London 1934, Lisbon 1958, Stockholm 1967; amended 28 September 1979) — WIPO document WO020EN.
* The Paris Convention is an international treaty administered by WIPO; treaty texts are generally
  free to reproduce, and this app quotes it for study with article/page references.

## 4. English translations

* Where an English rendering of a Khmer passage is shown (lesson summaries, key points, terminology,
  quiz explanations), it is a **translation prepared for this study app**, not an official
  translation of the textbook.

## 5. No legal advice

This app is a study aid. It is not legal advice and cannot replace the original documents, your
teacher, or a qualified lawyer. Quiz answers and chatbot output are study aids; always check the
cited page.

## 6. Fonts, images and the RoboCL logo

* Fonts are loaded from Google Fonts: Inter and Noto Sans Khmer (both SIL Open Font License).
  They are progressive enhancement only — the app falls back to the system Khmer fonts offline.
* `docs/assets/img/logo.png` and its variants: the RoboCL mascot (a robot reading a law book
  beside the scales of justice) was generated with an AI image tool for this project by Sok Panha.
* `docs/assets/img/cover.jpg` is a render of page i of the textbook, included so students
  recognise the book. It remains the property of the book's rights holder.
* `docs/assets/img/pages/*.jpg` are renders of six sample pages, used for the "real page samples"
  view in the Library, under the same educational-quotation terms as section 1.
* No other third-party assets are bundled.

## 7. Accounts and privacy

* Accounts are created with a **username and password only**. No email address, name or other
  personal data is requested or collected.
* Passwords are **never stored and never transmitted**. The browser derives a PBKDF2-SHA256 hash
  (120 000 rounds, random 16-byte salt) via the Web Crypto API and stores only that hash; a
  pure-JS iterated SHA-256 path is used when `crypto.subtle` is unavailable (e.g. `file://`).
  This is a study tool's convenience login — it is not a bank, and it is not built to protect
  valuable secrets. Do not reuse an important password.
* By default, accounts and the sign-up/sign-in record live **in the visitor's own browser**
  (localStorage). The owner can export them from `admin.html` on that device.
* If the owner configures a collector (`docs/data/config.js`), each sign-up / sign-in /
  failed attempt / sign-out also sends the **username, event type, device, browser string and
  timestamp** to the destination the owner chose — a Google Sheet
  (`tools/google-sheet-collector.gs`) or a Supabase table (`tools/supabase.sql`). The sign-up
  form shows users a notice as soon as a collector is active. **The password and its hash are
  never sent anywhere** — verification happens entirely inside the visitor's browser.
* The admin page shows only what the current browser recorded; the collected rows live in the
  owner's own sheet/database, under the owner's account.
