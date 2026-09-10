/* ==========================================================================
   search.js — Khmer-aware tokenizer + BM25 retrieval over the source corpus
   Khmer has no word spaces, so Khmer text is indexed with character n-grams.
   ========================================================================== */
(function () {
  'use strict';

  const KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/;
  const KHMER_RUN = /[\u1780-\u17FF\u19E0-\u19FF]+/g;
  const LATIN = /[a-z0-9]{2,}/g;

  function ngrams(run, n) {
    const out = [];
    // base characters only (consonants + independent vowels), so that combining
    // signs do not fragment the n-grams
    for (let i = 0; i + n <= run.length; i++) out.push(run.slice(i, i + n));
    return out;
  }

  function tokenize(text) {
    const toks = [];
    if (!text) return toks;
    const s = String(text).replace(/[\u200b\u200c\u200d]/g, '');
    const low = s.toLowerCase();
    let m;
    LATIN.lastIndex = 0;
    while ((m = LATIN.exec(low))) toks.push('l:' + m[0]);
    KHMER_RUN.lastIndex = 0;
    let run;
    while ((run = KHMER_RUN.exec(s))) {
      const r = run[0];
      if (r.length <= 3) { toks.push('k:' + r); continue; }
      // whole word-sized run (up to 10 chars) plus 3-grams
      if (r.length <= 10) toks.push('w:' + r);
      ngrams(r, 3).forEach(function (g) { toks.push('g:' + g); });
      ngrams(r, 4).forEach(function (g) { toks.push('h:' + g); });
    }
    return toks;
  }

  function buildIndex(docs) {
    const df = Object.create(null);
    const postings = docs.map(function (d, i) {
      const toks = tokenize(d.text);
      const tf = Object.create(null);
      toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
      return { tf: tf, len: toks.length };
    });
    const avgdl = postings.reduce(function (a, p) { return a + p.len; }, 0) / (postings.length || 1);
    return { docs: docs, df: df, postings: postings, avgdl: avgdl, N: docs.length };
  }

  const K1 = 1.4, B = 0.72;

  function idf(index, term) {
    const n = index.df[term] || 0;
    return Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
  }

  function score(index, docIdx, qtokens) {
    const p = index.postings[docIdx];
    let s = 0;
    for (let i = 0; i < qtokens.length; i++) {
      const t = qtokens[i];
      const f = p.tf[t];
      if (!f) continue;
      const norm = 1 - B + B * (p.len / (index.avgdl || 1));
      // 4-grams and whole-word tokens are more discriminative than 3-grams
      const w = t.slice(0, 2) === 'h:' ? 1.35 : (t.slice(0, 2) === 'w:' ? 1.5 : (t.slice(0, 2) === 'l:' ? 1.2 : 1));
      s += w * idf(index, t) * (f * (K1 + 1)) / (f + K1 * norm);
    }
    return s;
  }

  let CHAT = null;      // index over corpus chunks
  let DOCS = null;      // index over lesson/term documents (built by learn/glossary)

  function initCorpus(chunks) {
    CHAT = { index: buildIndex(chunks), chunks: chunks };
    return CHAT;
  }

  function initDocs(docs) {
    DOCS = { index: buildIndex(docs), docs: docs };
    return DOCS;
  }

  function normSearchText(s) {
    return String(s || '').replace(/[\u200b\u200c\u200d]/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ---------- query hygiene: stopwords + bilingual expansion ---------- */
  const STOP_EN = ['what', 'is', 'are', 'was', 'were', 'the', 'of', 'a', 'an', 'in', 'to', 'for', 'and', 'or',
    'does', 'do', 'did', 'how', 'why', 'which', 'who', 'when', 'where', 'list', 'give', 'me', 'about', 'on',
    'at', 'by', 'with', 'that', 'this', 'it', 'be', 'can', 'will', 'tell', 'explain', 'define', 'please',
    'meaning', 'under', 'between', 'from'];
  const STOP_KM = ['តើ', 'ជាអ្វី', 'អ្វីទៅជា', 'គឺជា', 'គឺ', 'នៃ', 'របស់', 'អ្វីខ្លះ', 'មានអ្វីខ្លះ', 'សូម',
    'ពន្យល់', 'ប្រាប់', 'ខ្ញុំ', 'នេះ', 'នោះ', 'ដែល', 'ក្នុង', 'លើ', 'តាម', 'ដោយ', 'សម្រាប់', 'ពី', 'ទៅ',
    'និង', 'ឬ', 'ក៏', 'ទេ', 'បាន', 'យ៉ាងណា', 'ណា', 'មួយ', 'អ្វី'];

  let LEXICON = [];   // [{en, km}] built from the app glossary
  function setLexicon(pairs) { LEXICON = pairs || []; }

  function cleanQuery(q) {
    let s = ' ' + String(q || '') + ' ';
    STOP_EN.forEach(function (w) { s = s.replace(new RegExp('\\b' + w + '\\b', 'gi'), ' '); });
    STOP_KM.forEach(function (w) { s = s.split(w).join(' '); });
    return s.replace(/\s+/g, ' ').trim();
  }

  /* use the app's own glossary to bridge English questions to the Khmer textbook */
  function expandQuery(q) {
    const low = ' ' + String(q || '').toLowerCase() + ' ';
    const extra = [];
    for (let i = 0; i < LEXICON.length && extra.length < 6; i++) {
      const p = LEXICON[i];
      if (!p.en || !p.km || p.en.length < 4) continue;
      const e = p.en.toLowerCase();
      const words = e.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 3; });
      const whole = low.indexOf(e) >= 0;
      const all = words.length > 1 && words.every(function (w) { return low.indexOf(w) >= 0; });
      if (whole || all) extra.push(p.km);
    }
    return extra;
  }

  const SRC_HINTS = [
    { re: /eccc|extraordinary chambers|khmer rouge|tribunal/i, src: 'eccc' },
    { re: /paris convention|industrial property|wipo|priority right|trademark|patent/i, src: 'paris' }
  ];

  /**
   * search the textbook/reference corpus.
   * opts: { limit, lang, src, minScore }
   */
  function searchCorpus(query, opts) {
    opts = opts || {};
    if (!CHAT) return [];
    const cleaned = cleanQuery(query);
    const base = cleaned || normSearchText(query);
    const expanded = expandQuery(query);
    const qtBase = tokenize(base);
    const qtExp = expanded.length ? tokenize(expanded.join(' ')) : [];
    if (!qtBase.length && !qtExp.length) return [];
    const results = [];
    const qPlain = base.toLowerCase();
    const hints = SRC_HINTS.filter(function (h) { return h.re.test(query); }).map(function (h) { return h.src; });
    for (let i = 0; i < CHAT.chunks.length; i++) {
      const c = CHAT.chunks[i];
      if (opts.src && c.src !== opts.src) continue;
      let s = score(CHAT.index, i, qtBase);
      if (qtExp.length) s += 0.55 * score(CHAT.index, i, qtExp);   // bridged terms weigh less
      if (s <= 0) { continue; }
      const text = c.text.toLowerCase();
      if (qPlain.length >= 4 && text.indexOf(qPlain) >= 0) s += 8;
      (qPlain.match(/\d+/g) || []).forEach(function (d) { if (text.indexOf(d) >= 0) s += 1.2; });
      if (hints.length && hints.indexOf(c.src) >= 0) s += 3;
      // bibliography / annexes and dense number lists are poor answers
      if (c.src === 'textbook' && c.page >= 185) s *= 0.55;
      const digits = (c.text.match(/[0-9\u17E0-\u17E9]/g) || []).length;
      if (digits / Math.max(1, c.text.length) > 0.16) s *= 0.7;
      results.push({ chunk: c, score: s });
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, opts.limit || 6);
  }

  function searchDocs(query, opts) {
    opts = opts || {};
    if (!DOCS) return [];
    const cleaned = cleanQuery(query);
    const qt = tokenize(cleaned || normSearchText(query));
    if (!qt.length) return [];
    const out = [];
    for (let i = 0; i < DOCS.docs.length; i++) {
      const d = DOCS.docs[i];
      let s = score(DOCS.index, i, qt);
      // exact term match (either language) is a strong signal
      const qpl = (cleaned || query).trim().toLowerCase();
      if (qpl.length > 2) {
        if (d.km && d.km.toLowerCase() === qpl) s += 12;
        else if (d.en && d.en.toLowerCase() === qpl) s += 12;
        else if (d.km && d.km.indexOf(qpl) >= 0) s += 4;
      }
      if (s > 0) out.push({ doc: d, score: s });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, opts.limit || 5);
  }

  /* extract the sentences of a passage that best match the query */
  function bestSentences(text, query, max) {
    const parts = String(text).split(/(?<=[។៕!?\.])\s+|\n+/).filter(function (p) { return p.trim().length > 12; });
    if (!parts.length) return [String(text)];
    const qt = tokenize(normSearchText(query));
    const scored = parts.map(function (p, i) {
      const pt = tokenize(p);
      let s = 0;
      qt.forEach(function (t) { if (pt.indexOf(t) >= 0) s += t.slice(0, 2) === 'h:' ? 1.4 : 1; });
      return { p: p.trim(), s: s, i: i };
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    const top = scored.slice(0, max || 3).filter(function (x) { return x.s > 0; });
    if (!top.length) return [String(text).slice(0, 420)];
    top.sort(function (a, b) { return a.i - b.i; });     // keep reading order
    return top.map(function (x) { return x.p; });
  }

  window.IPLSearch = {
    tokenize: tokenize, buildIndex: buildIndex, initCorpus: initCorpus, initDocs: initDocs,
    searchCorpus: searchCorpus, searchDocs: searchDocs, bestSentences: bestSentences,
    setLexicon: setLexicon, cleanQuery: cleanQuery, expandQuery: expandQuery
  };
})();
