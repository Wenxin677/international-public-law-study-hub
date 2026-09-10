/* Node harness: exercises the browser search engine without a browser.
   usage: node tools/search_test.js "query" ["query2" ...]            */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');

// minimal browser shims
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

function load(rel) { (0, eval)(fs.readFileSync(path.join(SITE, rel), 'utf8')); }
load('assets/js/search.js');
load('data/corpus.js');
load('data/lessons.js');

const S = global.IPLSearch;
const corpus = global.IPL_CORPUS;
const chapters = global.IPL_CHAPTERS;

S.initCorpus(corpus);

/* build the doc index + lexicon the way data.js does */
const docs = [];
const lessons = [];
chapters.forEach(ch => (ch.lessons || []).forEach(l => { l.chapter = ch; lessons.push(l); }));
lessons.forEach(l => {
  docs.push({ kind: 'lesson', lesson: l, title: l.title, page: l.pages && l.pages.from,
    km: (l.title && l.title.km) || '', en: (l.title && l.title.en) || '',
    text: [(l.title && l.title.km), (l.title && l.title.en), (l.summary && l.summary.km), (l.summary && l.summary.en),
           ((l.keyPoints && l.keyPoints.km) || []).join(' '), ((l.keyPoints && l.keyPoints.en) || []).join(' ')].filter(Boolean).join('\n'),
    pointsKm: (l.keyPoints && l.keyPoints.km) || [], pointsEn: (l.keyPoints && l.keyPoints.en) || [] });
  (l.terms || []).forEach(tm => docs.push({ kind: 'term', lesson: l, km: tm.km, en: tm.en, defKm: tm.defKm, defEn: tm.defEn, page: l.pages && l.pages.from, src: 'textbook', text: [tm.km, tm.en, tm.defKm, tm.defEn].filter(Boolean).join('\n') }));
});
S.initDocs(docs);

const lexicon = [];
const seen = {};
lessons.forEach(l => (l.terms || []).forEach(tm => {
  if (tm.en && tm.km && !seen[tm.en.toLowerCase()]) { seen[tm.en.toLowerCase()] = 1; lexicon.push({ en: tm.en, km: tm.km }); }
}));
[['sovereignty', 'អធិបតេយ្យភាព'], ['treaty', 'សន្ធិសញ្ញា'], ['state', 'រដ្ឋ'],
 ['international law', 'ច្បាប់អន្តរជាតិ'], ['sources of international law', 'ប្រភពនៃច្បាប់អន្តរជាតិ'],
 ['customary international law', 'ទំនៀមទម្លាប់អន្តរជាតិ'], ['recognition', 'ការទទួលស្គាល់'],
 ['use of force', 'ការប្រើប្រាស់កម្លាំង'], ['territory', 'ទឹកដី'], ['human rights', 'សិទ្ធិមនុស្ស'],
 ['united nations', 'អង្គការសហប្រជាជាតិ'], ['convention', 'អនុសញ្ញា'], ['ratification', 'ការផ្ដល់សច្ចាប័ន'],
 ['national treatment', 'ការអនុគ្រោះជាតិ'], ['instances', 'ឧទាហរណ៍']
].forEach(p => { if (!seen[p[0]]) { seen[p[0]] = 1; lexicon.push({ en: p[0], km: p[1] }); } });
S.setLexicon(lexicon);

const queries = process.argv.slice(2);
(queries.length ? queries : ['តើអធិបតេយ្យភាពជាអ្វី?', 'sources of international law', 'what are the criteria of statehood?']).forEach(q => {
  const t0 = Date.now();
  const res = S.searchCorpus(q, { limit: 4 });
  const dres = S.searchDocs(q, { limit: 3 });
  console.log('\nQ: ' + q + '   [' + (Date.now() - t0) + 'ms]');
  console.log('   clean: "' + S.cleanQuery(q) + '"  expanded: ' + JSON.stringify(S.expandQuery(q)));
  res.forEach(r => console.log('   [' + r.score.toFixed(1) + '] ' + r.chunk.src + ' p.' + r.chunk.page + ' :: ' +
    r.chunk.text.replace(/\s+/g, ' ').slice(0, 100)));
  dres.forEach(d => console.log('   doc [' + d.score.toFixed(1) + '] ' + d.doc.kind + ' ' +
    (d.doc.km || '') + ' / ' + (d.doc.en || '') + (d.doc.defEn ? ' :: ' + d.doc.defEn.slice(0, 60) : '')));
});
