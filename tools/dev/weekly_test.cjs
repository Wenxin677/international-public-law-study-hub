/* Weekly Classes, without a browser: run the real learn.html in jsdom, route to
   #w=week1 and drive the split view, then check lesson pages still work.

   Run:  NODE_PATH=... node tools/dev/weekly_test.cjs
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SITE = path.resolve(__dirname, '../../docs');
let pass = 0, fail = 0;
const problems = [];
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; problems.push(name); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

function boot(hash) {
  const html = fs.readFileSync(path.join(SITE, 'learn.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://example.test/learn.html' + hash,
    pretendToBeVisual: true, runScripts: 'outside-only'
  });
  const { window } = dom;
  window.localStorage.setItem('robo.session', JSON.stringify({ u: 'wk', t: 'tok', ts: Date.now(), exp: Date.now() + 864e5 }));
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message || e)));
  for (const rel of Array.from(html.matchAll(/<script src="([^"?]+)/g)).map((m) => m[1])) {
    try { window.eval(fs.readFileSync(path.join(SITE, rel), 'utf8')); }
    catch (e) { check('runs: ' + rel, false, String(e.message).slice(0, 140)); }
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, d: window.document, errors };
}
const key = (w, k) => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));

const BAD = ['អនតរ', 'កនុង', 'ដលែ', 'ដដ្យ', 'ប្ប', 'សប្ា', 'នន', 'ចាប់កនុង', 'រឋែ'];

console.log('='.repeat(70));
console.log('WEEKLY CLASSES — split view over the Week 1 deck');
console.log('='.repeat(70));
const { window: w, d, errors } = boot('#w=week1');
const W = w.IPL_WEEKLY;
const week = W && W.weeks && W.weeks[0];

console.log('\n— the data —');
check('the weekly data file is loaded', !!week, week ? week.id : 'missing');
check('it points at a deck inside the site', !!week && /^library\/weekly\/week1\.pdf$/.test(week.deck), week && week.deck);
check('the title slide is skipped', !!week && week.skip.indexOf(1) >= 0, week && JSON.stringify(week.skip));
check('every remaining slide is covered', !!week && week.slides.length === week.pages - week.skip.length,
  week && `${week.slides.length} of ${week.pages - week.skip.length}`);
check('every slide has a written summary', !!week && week.slides.every((s) => (s.summary || '').length > 40));
check('every slide has an English label', !!week && week.slides.every((s) => (s.en || '').trim().length > 2));
check('no Khmer label carries the source PDF artefacts',
  !!week && week.slides.every((s) => !BAD.some((b) => (s.km || '').includes(b))),
  week && week.slides.filter((s) => BAD.some((b) => (s.km || '').includes(b))).map((s) => s.n).join(',') || 'clean');

console.log('\n— the view —');
check('the split view rendered', !!d.querySelector('.wk-split'));
check('the slide can be expanded to full screen', !!d.querySelector('#wk-fs'));
check('the slide list has one entry per slide',
  d.querySelectorAll('#wk-list button').length === week.slides.length,
  d.querySelectorAll('#wk-list button').length + ' entries');
check('the first entry is the first non-title slide',
  (d.querySelector('#wk-list button') || {}).dataset && d.querySelector('#wk-list button').dataset.slide === String(week.slides[0].n),
  (d.querySelector('#wk-list button') || {}).dataset && d.querySelector('#wk-list button').dataset.slide);
check('a slide is selected on load', d.querySelectorAll('#wk-list button.active').length === 1);
check('the count reads Slide X of Y',
  /2\b/.test((d.getElementById('wk-count') || {}).textContent || ''),
  (d.getElementById('wk-count') || {}).textContent);
check('the summary is shown', (d.getElementById('wk-summary').textContent || '').length > 60);
check('the real slide is embedded at the right page',
  /library\/weekly\/week1\.pdf#page=2\b/.test(d.getElementById('wk-pdf').getAttribute('src') || ''),
  d.getElementById('wk-pdf').getAttribute('src'));
check('there is a link to open the deck', /#page=2\b/.test(d.getElementById('wk-open').getAttribute('href') || ''));

console.log('\n— clicking a slide swaps the panel —');
const target = d.querySelectorAll('#wk-list button')[5];
click(w, target);
check('the clicked entry becomes active', target.classList.contains('active'));
check('the panel follows the click',
  /#page=7\b/.test(d.getElementById('wk-pdf').getAttribute('src') || ''),
  d.getElementById('wk-pdf').getAttribute('src'));
check('the summary belongs to that slide',
  (d.getElementById('wk-summary').textContent || '').includes(week.slides[5].summary.slice(0, 40)));
check('the count moved with it', /7\b/.test((d.getElementById('wk-count') || {}).textContent || ''),
  (d.getElementById('wk-count') || {}).textContent);

console.log('\n— next / previous and the keyboard —');
click(w, d.getElementById('wk-next'));
check('next moves one slide', /#page=8\b/.test(d.getElementById('wk-pdf').getAttribute('src') || ''),
  d.getElementById('wk-pdf').getAttribute('src'));
key(w, 'ArrowRight');
check('the right arrow also moves forward', /#page=9\b/.test(d.getElementById('wk-pdf').getAttribute('src') || ''));
click(w, d.getElementById('wk-prev'));
key(w, 'ArrowLeft');
check('back two lands on slide 7 again', /#page=7\b/.test(d.getElementById('wk-pdf').getAttribute('src') || ''),
  d.getElementById('wk-pdf').getAttribute('src'));
/* clamp at the ends */
for (let i = 0; i < 40; i++) click(w, d.getElementById('wk-prev'));
check('it stops at the first slide', /#page=2\b/.test(d.getElementById('wk-pdf').getAttribute('src') || ''),
  d.getElementById('wk-pdf').getAttribute('src'));
for (let i = 0; i < 40; i++) click(w, d.getElementById('wk-next'));
check('it stops at the last slide',
  new RegExp('#page=' + week.pages + '\\b').test(d.getElementById('wk-pdf').getAttribute('src') || ''),
  d.getElementById('wk-pdf').getAttribute('src'));

console.log('\n— the rail and the rest of the page —');
check('the rail lists the weekly class', !!d.querySelector('#rail [data-week="week1"]'));
check('the active week is marked in the rail', !!d.querySelector('#rail [data-week="week1"].active'));
check('no script errors', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log('\n— lesson pages still work —');
const two = boot('#ch1-l1');
check('a lesson still renders', !!two.d.querySelector('#lk-guide'));
check('the lesson rail still lists chapters', two.d.querySelectorAll('#rail .ch').length >= 10,
  two.d.querySelectorAll('#rail .ch').length + ' groups (weekly + chapters)');
check('the weekly group is in the rail there too', !!two.d.querySelector('#rail [data-week="week1"]'));
check('no script errors on the lesson route', two.errors.length === 0, two.errors.slice(0, 2).join(' | '));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (problems.length) { console.log('failed:'); problems.forEach((p) => console.log('   -', p)); }
process.exit(fail ? 1 : 0);
