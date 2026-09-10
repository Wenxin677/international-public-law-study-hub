/* ==========================================================================
   data.js — assembles the generated data files and builds the search indexes
   Loaded after data/corpus.js, data/lessons.js and search.js
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, S = window.IPLSearch;

  const chapters = (window.IPL_CHAPTERS || []).filter(function (c) { return c; })
    .sort(function (a, b) { return (a.num || 0) - (b.num || 0); });

  /* flat lesson list, each entry knows its chapter */
  const lessons = [];
  chapters.forEach(function (ch) {
    ch.lessons = (ch.lessons || []).filter(function (l) { return l; });
    ch.lessons.sort(function (a, b) { return (a.pages && a.pages.from || 0) - (b.pages && b.pages.from || 0); });
    ch.lessons.forEach(function (l) {
      l.chapter = ch;
      l.quiz = (l.quiz || []).filter(function (q) { return q && q.q; });
      lessons.push(l);
    });
  });
  lessons.sort(function (a, b) {
    const ca = a.chapter.num * 1000 + (a.pages && a.pages.from || 0);
    const cb = b.chapter.num * 1000 + (b.pages && b.pages.from || 0);
    return ca - cb;
  });

  /* glossary: terms collected from lessons, de-duplicated by Khmer headword */
  const glossary = [];
  const seen = Object.create(null);
  lessons.forEach(function (l) {
    (l.terms || []).forEach(function (tm) {
      if (!tm || !tm.km) return;
      const key = tm.km.trim();
      if (seen[key]) { seen[key].count++; return; }
      const entry = {
        km: tm.km, en: tm.en || '', defKm: tm.defKm || '', defEn: tm.defEn || '',
        page: (l.pages && l.pages.from) || null, lesson: l, count: 1,
        chapter: l.chapter
      };
      seen[key] = entry;
      glossary.push(entry);
    });
  });
  glossary.sort(function (a, b) { return a.km.localeCompare(b.km, 'km'); });

  /* quiz index */
  const quizByLesson = Object.create(null);
  lessons.forEach(function (l) { if (l.quiz.length) quizByLesson[l.id] = l.quiz; });

  function allQuestions() {
    const out = [];
    lessons.forEach(function (l) {
      l.quiz.forEach(function (q, i) { out.push({ q: q, lesson: l, index: i }); });
    });
    return out;
  }

  /* documents used by the "ask the book" semantic layer */
  const docs = [];
  lessons.forEach(function (l) {
    docs.push({
      kind: 'lesson', id: 'lesson:' + l.id, lesson: l, title: l.title,
      page: (l.pages && l.pages.from) || null,
      text: [I.pick ? '' : '', l.title && (l.title.km + ' ' + l.title.en), l.summary && (l.summary.km + ' ' + l.summary.en),
             (l.objectives && l.objectives.km || []).join(' '), (l.objectives && l.objectives.en || []).join(' '),
             (l.keyPoints && l.keyPoints.km || []).join(' '), (l.keyPoints && l.keyPoints.en || []).join(' ')].filter(Boolean).join('\n'),
      pointsKm: l.keyPoints && l.keyPoints.km || [],
      pointsEn: l.keyPoints && l.keyPoints.en || []
    });
    (l.terms || []).forEach(function (tm) {
      docs.push({
        kind: 'term', id: 'term:' + l.id + ':' + (tm.km || ''), lesson: l,
        km: tm.km, en: tm.en, defKm: tm.defKm, defEn: tm.defEn,
        page: (l.pages && l.pages.from) || null, src: 'textbook',
        text: [tm.km, tm.en, tm.defKm, tm.defEn].filter(Boolean).join('\n')
      });
    });
    (l.quotes || []).forEach(function (qt) {
      docs.push({
        kind: 'quote', id: 'quote:' + l.id + ':' + (qt.page || '') , lesson: l,
        page: qt.page, km: qt.km, en: qt.en, src: qt.srcLang === 'en' ? null : 'textbook',
        text: [qt.km, qt.en].filter(Boolean).join('\n')
      });
    });
  });

  const corpus = (window.IPL_CORPUS || []).filter(function (c) { return c && c.text; });

  if (corpus.length) S.initCorpus(corpus);
  if (docs.length) S.initDocs(docs);

  /* English -> Khmer bridge for the chatbot, built from the app's own glossary */
  const lexicon = [];
  const lexSeen = Object.create(null);
  glossary.forEach(function (g) {
    if (g.en && g.km && !lexSeen[g.en.toLowerCase()]) {
      lexSeen[g.en.toLowerCase()] = 1;
      lexicon.push({ en: g.en, km: g.km });
    }
  });
  lessons.forEach(function (l) {
    (l.terms || []).forEach(function (tm) {
      if (tm.en && tm.km && !lexSeen[tm.en.toLowerCase()]) {
        lexSeen[tm.en.toLowerCase()] = 1;
        lexicon.push({ en: tm.en, km: tm.km });
      }
    });
  });
  // a few high-frequency bridges that course terms often miss
  [['sovereignty', 'អធិបតេយ្យភាព'], ['treaty', 'សន្ធិសញ្ញា'], ['state', 'រដ្ឋ'],
   ['international law', 'ច្បាប់អន្តរជាតិ'], ['sources of international law', 'ប្រភពនៃច្បាប់អន្តរជាតិ'],
   ['customary international law', 'ទំនៀមទម្លាប់អន្តរជាតិ'], ['recognition', 'ការទទួលស្គាល់'],
   ['use of force', 'ការប្រើប្រាស់កម្លាំង'], ['territory', 'ទឹកដី'], ['human rights', 'សិទ្ធិមនុស្ស'],
   ['united nations', 'អង្គការសហប្រជាជាតិ'], ['convention', 'អនុសញ្ញា'], ['ratification', 'ការផ្ដល់សច្ចាប័ន']
  ].forEach(function (p) {
    if (!lexSeen[p[0]]) { lexSeen[p[0]] = 1; lexicon.push({ en: p[0], km: p[1] }); }
  });
  S.setLexicon(lexicon);

  const corpusIndex = Object.create(null);
  corpus.forEach(function (c) {
    const k = c.src + '#' + c.page;
    corpusIndex[k] = (corpusIndex[k] ? corpusIndex[k] + '\n\n' : '') + c.text;
  });

  function corpusByPage(src, page) { return corpusIndex[src + '#' + page] || ''; }

  function lessonById(id) {
    for (let i = 0; i < lessons.length; i++) if (lessons[i].id === id) return lessons[i];
    return null;
  }

  window.IPL_DATA = {
    chapters: chapters,
    lessons: lessons,
    glossary: glossary,
    corpus: corpus,
    docs: docs,
    allLessons: function () { return lessons; },
    lessonById: lessonById,
    quizForLesson: function (id) { return quizByLesson[id] || []; },
    quizForChapter: function (chId) {
      const ch = chapters.filter(function (c) { return c.id === chId; })[0];
      if (!ch) return [];
      const out = [];
      ch.lessons.forEach(function (l) { l.quiz.forEach(function (q, i) { out.push({ q: q, lesson: l, index: i }); }); });
      return out;
    },
    allQuestions: allQuestions,
    corpusByPage: corpusByPage,
    stats: {
      pages: 193, chapters: chapters.filter(function (c) { return (c.num || 0) > 0; }).length,
      lessons: lessons.length,
      questions: allQuestions().length,
      terms: glossary.length,
      quizLessons: Object.keys(quizByLesson).length
    }
  };
})();
