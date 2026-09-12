/* Run the real quiz and dashboard pages without a browser (jsdom): choose a quiz,
   answer one question at a time, reach the results screen; then check the
   dashboard shows three cards and hides the rest in a fold.

   Setup:  cd "$LOCALAPPDATA/Temp/pglite-test" && npm i jsdom
   Run:    NODE_PATH=... node <repo>/tools/dev/quiz_dash_test.cjs
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

function boot(page) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/' + page, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  window.localStorage.setItem('robo.session', JSON.stringify({ u: 'checkuser', t: 'tok', ts: Date.now(), exp: Date.now() + 864e5 }));
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message || e)));
  for (const rel of Array.from(html.matchAll(/<script src="([^"?]+)/g)).map((m) => m[1])) {
    try { window.eval(fs.readFileSync(path.join(SITE, rel), 'utf8')); }
    catch (e) { check('runs: ' + rel, false, String(e.message).slice(0, 120)); }
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, d: window.document, errors };
}
const click = (window, el) => el && el.dispatchEvent(new window.Event('click', { bubbles: true }));

/* ------------------------------------------------------------------- quiz */
console.log('='.repeat(70));
console.log('QUIZ — pick, answer one at a time, results');
console.log('='.repeat(70));
const { window: w, d, errors } = boot('quiz.html');

console.log('\n— choosing a quiz —');
check('the setup screen is shown first', d.getElementById('run-wrap').hidden && !d.getElementById('setup-wrap').hidden);
check('there is a mixed-quiz button', !!d.getElementById('mixed-btn'));
check('every chapter is one collapsible block', d.querySelectorAll('#setup details.qset').length === w.IPL_DATA.chapters.length,
  d.querySelectorAll('#setup details.qset').length + ' blocks');
check('lessons are inside the block, not on the page as a wall of cards',
  d.querySelectorAll('#setup .qset .ls-body [data-ls]').length === w.IPL_DATA.lessons.length,
  d.querySelectorAll('#setup .qset .ls-body [data-ls]').length + ' lesson buttons');
check('the search box clutter is gone', !d.getElementById('qsearch'));

console.log('\n— one question at a time —');
click(w, d.getElementById('mixed-btn'));
const wrap = d.getElementById('run-wrap');
check('starting a quiz hides the setup', d.getElementById('setup-wrap').hidden === true && wrap.hidden === false);
check('exactly one question is on screen', d.querySelectorAll('.q-text').length === 1);
check('the header says which question this is', /1\b/.test((d.querySelector('.qhead .pill') || {}).textContent || ''),
  (d.querySelector('.qhead .pill') || {}).textContent);
check('there is a progress bar', !!d.querySelector('.sec-bar > i'));
const opts = d.querySelectorAll('.options .option');
check('answers are clickable cards with a number key', opts.length >= 3 && !!opts[0].querySelector('.key'),
  opts.length + ' options');
check('Next is disabled until an answer is chosen', d.getElementById('next').disabled === true);
check('no explanation is shown before answering', !d.querySelector('#fb .explain'));

console.log('\n— choosing before you commit (click or 1–4) —');
click(w, opts[0]);
check('the picked card is marked as selected', opts[0].classList.contains('sel'),
  opts[0].className.replace('option', '').trim());
check('nothing is graded yet',
  !d.querySelector('#fb .explain') && d.querySelectorAll('.option.correct, .option.wrong').length === 0);
check('you can still change your mind',
  Array.from(d.querySelectorAll('.option')).every((o) => o.disabled === false));
check('Next is enabled now there is a selection', d.getElementById('next').disabled === false);
const key = (k) => d.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
key('3');
check('a number key selects that option',
  d.querySelectorAll('.options .option')[2].classList.contains('sel') &&
  d.querySelectorAll('.option.sel').length === 1);
key('1');
check('another number key changes the selection',
  d.querySelectorAll('.options .option')[0].classList.contains('sel') &&
  d.querySelectorAll('.option.sel').length === 1);

console.log('\n— Enter checks the answer —');
key('Enter');
check('Enter grades it and reveals the explanation', !!d.querySelector('#fb .explain'));
check('the choice is marked right or wrong',
  d.querySelectorAll('.option.correct, .option.wrong').length >= 1);
check('the right answer is revealed when you miss', (function () {
  const wrong = d.querySelectorAll('.option.wrong').length;
  const reveal = d.querySelectorAll('.option.reveal').length;
  return (wrong && reveal) || (!wrong && !reveal);
})());
check('the cards are locked after checking',
  Array.from(d.querySelectorAll('.option')).every((o) => o.disabled === true));
check('the button now offers to move on',
  /Next|Finish|បន្ទាប់|បញ្ចប់/.test(d.getElementById('next').textContent),
  d.getElementById('next').textContent.trim());

console.log('\n— working through to the results —');
key('Enter');
check('Enter again moves to question 2', /2\b/.test((d.querySelector('.qhead .pill') || {}).textContent || ''),
  (d.querySelector('.qhead .pill') || {}).textContent);
check('still only one question on screen', d.querySelectorAll('.q-text').length === 1);
/* pick, check, move on — until the results appear */
let guard = 0;
while (guard++ < 40 && d.getElementById('result-wrap').hidden) {
  const o = d.querySelector('.options .option');
  if (!o) break;
  click(w, o);
  click(w, d.getElementById('next'));
  const n = d.getElementById('next');
  if (n && !n.disabled) click(w, n);
}
check('the run reaches the results screen', d.getElementById('result-wrap').hidden === false);
check('the question screen is gone', d.getElementById('run-wrap').hidden === true);

console.log('\n— the results screen —');
const res = d.getElementById('result-wrap');
check('it shows a score ring', !!res.querySelector('.result-ring'));
check('it shows the percentage', /\d+%/.test(res.textContent));
check('correct and wrong counts are both shown',
  res.querySelectorAll('.result-facts .fact').length >= 3 &&
  /Correct|ត្រូវ/.test(res.textContent) && /Wrong|ខុស/.test(res.textContent),
  res.querySelectorAll('.result-facts .fact').length + ' facts');
check('the questions you missed are listed (or it says none)',
  !!res.querySelector('details.fold') || /Nothing wrong|គ្មានសំណួរខុស/.test(res.textContent));
check('there is a way to run it again', !!d.getElementById('again'));
check('no script errors on the quiz page', errors.length === 0, errors.slice(0, 2).join(' | '));

/* -------------------------------------------------------------- dashboard */
console.log('\n' + '='.repeat(70));
console.log('DASHBOARD — three cards, everything else folded away');
console.log('='.repeat(70));
const { window: w2, d: d2, errors: errors2 } = boot('dashboard.html');

console.log('\n— the essentials —');
const cards = d2.querySelectorAll('.dash-3 > .sec-card');
check('exactly three cards', cards.length === 3, cards.length + ' cards');
check('card 1 is overall progress', !!d2.getElementById('prog-card').querySelector('.progress-ring'));
check('card 2 is the next lesson', !!d2.querySelector('#continue-card a[href^="learn.html#"]'));
check('card 3 is one key stat',
  !!d2.querySelector('#stat-card .stat-big') || /No quizzes taken yet|មិនទាន់ធ្វើកម្រងសំណួរ/.test(d2.getElementById('stat-card').textContent),
  (d2.querySelector('#stat-card .stat-big') || {}).textContent || d2.getElementById('stat-card').textContent.trim().slice(0, 40));
check('the stat card links to the quiz', !!d2.querySelector('#stat-card a[href^="quiz.html"]'));
check('the old three-tile stat block is gone', d2.querySelectorAll('#prog-card .tile').length === 0);

console.log('\n— the continue CTA leads —');
const hero = d2.getElementById('continue-card');
check('the continue card is the hero card', hero.classList.contains('hero'));
check('it carries a big primary call to action', !!hero.querySelector('a.btn.primary.lg[href^="learn.html#"]'),
  (hero.querySelector('a.btn.primary.lg') || {}).textContent);
check('no other card is a hero', d2.querySelectorAll('.dash-3 > .sec-card.hero').length === 1);
check('the hero pairs the CTA with the quiz for that lesson', !!hero.querySelector('a[href^="quiz.html#lesson="]'));

console.log('\n— secondary stats are folded away —');
const fold = d2.querySelector('#more-stats');
check('there is one fold', !!fold && fold.tagName === 'DETAILS');
check('it is closed by default', fold && fold.open === false);
check('it is labelled More stats', /More stats|ស្ថិតិបន្ថែម/.test(fold.querySelector('summary').textContent),
  fold.querySelector('summary').textContent.trim());
check('it holds the detailed stats', fold.querySelectorAll('#more-facts .fact').length === 5,
  fold.querySelectorAll('#more-facts .fact').length + ' stats');
check('the chapter breakdown is inside it', !!fold.querySelector('#chapters'));
check('notes and quick actions are inside it', !!fold.querySelector('#notes-card') && !!fold.querySelector('#quick'));
check('the reset button is still reachable', !!fold.querySelector('#reset-btn'));
check('none of that is in the main view', d2.querySelectorAll('.dash-3 .mini-grid, .dash-3 .fact').length === 0);
check('the main page is not a dense grid any more', d2.querySelectorAll('main > .wrap > .grid').length === 0);
check('no untranslated keys are left showing', !/\b(dash|quiz|learn)\.[a-zA-Z]/.test(d2.body.textContent));
check('no script errors on the dashboard', errors2.length === 0, errors2.slice(0, 2).join(' | '));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (problems.length) { console.log('failed:'); problems.forEach((p) => console.log('   -', p)); }
process.exit(fail ? 1 : 0);
