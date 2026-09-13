/* Run the REAL lesson page without a browser: jsdom loads docs/learn.html and then
   evaluates the actual site scripts (boot, config, core, auth, progress, lessons,
   learn) inside that document, so the rendered result is what a student's browser
   would build — DOM, i18n, the lazy PDF viewer, the page navigation and the
   progress bar included.  Nothing is mocked except the browser itself.

   Setup:  cd "$LOCALAPPDATA/Temp/pglite-test" && npm i jsdom
   Run:    NODE_PATH=... node <repo>/tools/dev/lesson_render_test.cjs
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SITE = path.resolve(__dirname, '../../docs');
const html = fs.readFileSync(path.join(SITE, 'learn.html'), 'utf8');

let pass = 0, fail = 0;
const problems = [];
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; problems.push(name); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

const dom = new JSDOM(html, {
  url: 'https://example.test/learn.html',
  pretendToBeVisual: true,
  runScripts: 'outside-only'
});
const { window } = dom;

/* a signed-in session, so the page guard lets the lesson through */
window.localStorage.setItem('robo.session', JSON.stringify({
  u: 'rendercheck', t: 'localtoken', ts: Date.now(), exp: Date.now() + 864e5
}));

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e)));
window.console.error = (...a) => errors.push('console.error: ' + a.join(' '));

/* evaluate the real scripts, in the order the page itself loads them */
const srcs = Array.from(html.matchAll(/<script src="([^"?]+)/g)).map((m) => m[1]);
console.log('scripts found in the page:', srcs.length);
for (const rel of srcs) {
  const file = path.join(SITE, rel);
  try {
    window.eval(fs.readFileSync(file, 'utf8'));
    check('runs: ' + rel, true);
  } catch (e) {
    check('runs: ' + rel, false, String(e.message).slice(0, 140));
  }
}
console.log('='.repeat(70));
console.log('LESSON TEMPLATE — the real page rendered headlessly');
console.log('='.repeat(70));

window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

const d = window.document;
const data = (window.IPL_DATA && window.IPL_DATA.chapters) || [];
const lesson = data[0].lessons[0];
const objCount = (lesson.objectives.en || []).length;
const termCount = (lesson.terms || []).length;
const plainCount = (lesson.plain.en || []).length;

console.log('\n— the shell —');
check('the page renders a lesson', !!d.querySelector('.lk-hero') && !!d.querySelector('#lesson'));
check('the hero title is the lesson title', (d.querySelector('.lk-title') || {}).textContent.trim().length > 3,
  (d.querySelector('.lk-title') || {}).textContent.trim().slice(0, 40));
check('the generic page heading is replaced', d.body.classList.contains('lk-open'));
check('the rail lists all chapters and lessons',
  d.querySelectorAll('#rail .ch:not(.wk-group)').length === data.length &&
  d.querySelectorAll('#rail [data-lesson]').length === data.reduce((n, c) => n + c.lessons.length, 0),
  d.querySelectorAll('#rail [data-lesson]').length + ' lessons');

console.log('\n— the lesson slides —');
const frame = d.querySelector('#lk-pdf iframe');
check('the PDF viewer is embedded', !!frame);
const src = frame ? (frame.getAttribute('src') || frame.getAttribute('data-src') || '') : '';
const slides = lesson.pages.to - lesson.pages.from + 1;
check('it shows the lesson\'s own slides, not the whole chapter',
  new RegExp('library/lessons/' + lesson.id + '\\.pdf').test(src), src.split('#')[0]);
check('it opens at the first slide of the lesson', /#page=1\b/.test(src), src.slice(src.indexOf('#')));
check('the lesson file really holds that many pages', (function () {
  const p = path.join(SITE, 'library/lessons', lesson.id + '.pdf');
  if (!fs.existsSync(p)) return false;
  const raw = fs.readFileSync(p, 'latin1');
  const m = raw.match(/\/Count\s+(\d+)/);
  return m ? Math.max(...raw.match(/\/Count\s+(\d+)/g).map((x) => parseInt(x.replace(/\D/g, ''), 10))) === slides : false;
})(), slides + ' slides expected');
check('the viewer is lazy-loaded (src is put in place by script, not markup)',
  /data-src=/.test(fs.readFileSync(path.join(SITE, 'assets/js/learn.js'), 'utf8')) &&
  (frame ? frame.hasAttribute('data-src') || frame.getAttribute('src') === frame.getAttribute('data-src') : false));
const pdfPath = path.join(SITE, src.split('#')[0]);
check('the file it points at really exists', fs.existsSync(pdfPath),
  fs.existsSync(pdfPath) ? (fs.statSync(pdfPath).size / 1024).toFixed(0) + ' KB' : pdfPath);
check('the counter shows slide 1 and its book page',
  (d.querySelector('#lk-slide') || {}).textContent === '1' &&
  (d.querySelector('#lk-bookpage') || {}).textContent === String(lesson.pages.from),
  (d.querySelector('.lk-pageno') || {}).textContent);

console.log('\n— the content cards —');
check('objectives are listed', d.querySelectorAll('.lk-obj li').length === objCount,
  d.querySelectorAll('.lk-obj li').length + ' of ' + objCount);
check('key terms render as expandable cards', d.querySelectorAll('.lk-term').length === termCount,
  d.querySelectorAll('.lk-term').length + ' of ' + termCount);
check('each term carries its one-line definition',
  Array.from(d.querySelectorAll('.lk-term .lk-body')).every((b) => b.textContent.trim().length > 20));
check('the plain-language summary is there', d.querySelectorAll('.lk-plain li').length === plainCount,
  d.querySelectorAll('.lk-plain li').length + ' of ' + plainCount);
check('key points and quotes are foldable', !!d.querySelector('#lk-points details, #lk-points') && !!d.querySelector('#lk-quotes'));
check('quotes carry a page number', /Page \d+|ទំព័រ \d+/.test((d.querySelector('#lk-quotes') || {}).textContent || ''));
check('notes area is available', !!d.querySelector('#notes'));
check('the quiz link points at this lesson',
  (d.querySelector('a[href^="quiz.html#lesson="]') || {}).getAttribute('href') === 'quiz.html#lesson=' + lesson.id,
  (d.querySelector('a[href^="quiz.html#lesson="]') || {}).getAttribute('href'));

console.log('\n— the sticky progress bar —');
check('the bar exists', !!d.querySelector('#lk-progress'));
check('it tracks five parts', d.querySelectorAll('#lk-dots span').length === 5,
  d.querySelectorAll('#lk-dots span').length + ' parts');
check('it starts with a score', /\d+%/.test((d.querySelector('#lk-pct') || {}).textContent || ''),
  (d.querySelector('#lk-pct') || {}).textContent);

console.log('\n— slide navigation (inside the lesson only) —');
const before = d.querySelector('#lk-slide').textContent;
d.querySelector('#lk-next').dispatchEvent(new window.Event('click', { bubbles: true }));
const after = d.querySelector('#lk-slide').textContent;
check('Next moves the viewer one slide',
  Number(after) === Number(before) + 1 &&
  new RegExp('page=' + after + '\\b').test(d.querySelector('#lk-pdf iframe').getAttribute('src') || ''),
  'slide ' + before + ' → ' + after);
check('the book page follows the slide',
  d.querySelector('#lk-bookpage').textContent === String(lesson.pages.from + Number(after) - 1),
  d.querySelector('#lk-bookpage').textContent);
d.querySelector('#lk-prev').dispatchEvent(new window.Event('click', { bubbles: true }));
d.querySelector('#lk-prev').dispatchEvent(new window.Event('click', { bubbles: true }));
check('it cannot go back past the first slide of the lesson',
  d.querySelector('#lk-slide').textContent === '1', 'slide ' + d.querySelector('#lk-slide').textContent);
check('moving through slides raises the progress score',
  parseInt(d.querySelector('#lk-pct').textContent, 10) > 30, d.querySelector('#lk-pct').textContent);

console.log('\n— the guided walk-through (click to continue) —');
const stepCount = (lesson.objectives.en || []).length + (lesson.plain.en || []).length +
                  Math.min(5, (lesson.keyPoints.en || []).length);
check('the guided lesson exists', !!d.querySelector('#lk-guide'));
check('it holds every point of the lesson',
  d.querySelector('.lk-guide-count').textContent.replace(/\s/g, '') === '1/' + stepCount,
  d.querySelector('.lk-guide-count').textContent.trim());
const firstPoint = (d.querySelector('.lk-guide-card p') || {}).textContent || '';
check('the first point is shown', firstPoint.length > 15, firstPoint.slice(0, 46));
const firstKind = (d.querySelector('.lk-guide-kind') || {}).textContent || '';
check('it says what kind of point this is', /Objective|គោលបំណង/.test(firstKind), firstKind);
d.querySelector('#lk-gnext').dispatchEvent(new window.Event('click', { bubbles: true }));
const secondPoint = (d.querySelector('.lk-guide-card p') || {}).textContent || '';
check('clicking Next moves to the next point', secondPoint !== firstPoint && secondPoint.length > 15, secondPoint.slice(0, 46));
check('the step counter follows', /2\//.test(d.querySelector('.lk-guide-count').textContent));
check('the walk-through bar fills up', /%/.test(d.querySelector('#lk-gfill').style.width || ''), d.querySelector('#lk-gfill').style.width);
d.querySelector('#lk-gprev').dispatchEvent(new window.Event('click', { bubbles: true }));
check('Back goes to the previous point', (d.querySelector('.lk-guide-card p') || {}).textContent === firstPoint);
for (let i = 0; i < stepCount + 2; i++) d.querySelector('#lk-gnext').dispatchEvent(new window.Event('click', { bubbles: true }));
check('finishing the walk-through marks the lesson studied',
  d.querySelector('#mark-btn').disabled === true &&
  /Marked as studied|បានរៀនរួច/.test(d.querySelector('#mark-btn').textContent),
  d.querySelector('#mark-btn').textContent.trim());

console.log('\n— the left rail (the bit that was broken) —');
/* the rail now opens with a Weekly Classes group, so chapter assertions are
   scoped with :not(.wk-group) — the group itself is covered by weekly_test.cjs */
check('chapters render as the accordion the stylesheet expects',
  d.querySelectorAll('#rail .ch:not(.wk-group)').length === data.length,
  d.querySelectorAll('#rail .ch:not(.wk-group)').length + ' chapters');
check('each chapter has a numbered header button',
  d.querySelectorAll('#rail .ch:not(.wk-group) > button .n').length === data.length);
check('lessons live in the .ls list the stylesheet shows/hides',
  d.querySelectorAll('#rail .ch:not(.wk-group) .ls').length === data.length);
check('the current chapter is open',
  d.querySelectorAll('#rail .ch:not(.wk-group).open').length === 1 &&
  d.querySelector('#rail .ch:not(.wk-group).open .ls a.active') !== null);
check('the open lesson is the one on screen',
  (d.querySelector('#rail .ls a.active') || {}).getAttribute('href') === '#' + lesson.id,
  (d.querySelector('#rail .ls a.active') || {}).getAttribute('href'));
check('every lesson is listed with its dot marker',
  d.querySelectorAll('#rail .ch:not(.wk-group) .ls a .dot').length === data.reduce((n, c) => n + c.lessons.length, 0));
check('clicking a chapter header collapses it', (function () {
  const btn = d.querySelector('#rail .ch:not(.wk-group).open > button');
  btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  const closed = d.querySelectorAll('#rail .ch:not(.wk-group).open').length === 0;
  btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  return closed;
})());

console.log('\n— both languages —');
/* the shell switches language by reloading the page, which jsdom cannot do, so
   re-render the lesson the way a navigation would */
window.IPL.state.lang = 'km';
window.dispatchEvent(new window.Event('hashchange'));
const kmHtml = d.querySelector('#lesson').innerHTML;
const kmFirst = (d.querySelector('.lk-obj li') || {}).textContent || '';
window.IPL.state.lang = 'en';
window.dispatchEvent(new window.Event('hashchange'));
const enHtml = d.querySelector('#lesson').innerHTML;
const enFirst = (d.querySelector('.lk-obj li') || {}).textContent || '';
check('Khmer and English render differently', kmHtml !== enHtml && kmFirst !== enFirst);
check('the Khmer build shows Khmer text', /[\u1780-\u17FF]/.test(kmFirst), kmFirst.slice(0, 40));
check('the English build shows English text', /[A-Za-z]{4}/.test(enFirst) && !/[\u1780-\u17FF]/.test(enFirst), enFirst.slice(0, 48));
check('the active language leads the term card',
  /[A-Za-z]{3}/.test((d.querySelector('.lk-term summary .lk-km') || {}).textContent || '') &&
  !/[\u1780-\u17FF]/.test((d.querySelector('.lk-term summary .lk-km') || {}).textContent || ''),
  ((d.querySelector('.lk-term summary .lk-km') || {}).textContent || '').slice(0, 40));
check('the term definition follows the active language',
  /[A-Za-z]{3}/.test(((d.querySelector('.lk-term .lk-body b') || {}).textContent || '')));
check('no translation key leaks into the page',
  !/(learn|lib|quiz|admin|auth|common)\.[a-z][A-Za-z]+/.test(d.querySelector('#lesson').textContent));

console.log('\n— nothing broke —');
check('no script errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (problems.length) { console.log('failed:'); problems.forEach((p) => console.log('   -', p)); }
process.exit(fail ? 1 : 0);
