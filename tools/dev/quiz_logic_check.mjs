/* Drive a whole quiz run in a real browser and check the scoring end to end.

   This is the check jsdom cannot do honestly: it clicks the real options on the
   real page, reads what the page says after each check, tallies the outcomes,
   then compares its tally with the score the results screen reports. It needs no
   answer key: after a check the page itself reveals which option was right.

   What it verifies
     1. the setup screen lists the mixed quiz and every chapter
     2. Next is disabled until an answer is picked
     3. after a pick the feedback matches the option classes (correct/wrong)
     4. keyboard 1-4 + Enter drive the quiz the same way clicking does
     5. the results screen's score, ring, percent and missed-question list all
        equal this script's own tally
     6. no JavaScript errors and no failed requests during the run

   Run:  node tools/dev/quiz_logic_check.mjs [--url BASE] [--lang en|km]
*/
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const urlIdx = argv.indexOf('--url');
const BASE = urlIdx > -1 ? argv[urlIdx + 1] : 'https://wenxin677.github.io/international-public-law-study-hub';
const langIdx = argv.indexOf('--lang');
const LANG = langIdx > -1 ? argv[langIdx + 1] : 'en';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'
].find((p) => existsSync(p));
if (!CHROME) { console.error('no Chrome found'); process.exit(2); }

const PORT = 9339;
const profile = mkdtempSync(path.join(tmpdir(), 'ipl-quiz-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0, pass = 0, fail = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params };
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception || {}).description);
  return r.result.value;
};
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? '  — ' + detail : ''}`);
};

const consoleErrors = [];

try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
    if (!target) await sleep(250);
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id); pending.delete(d.id);
      d.error ? p.rej(new Error(d.error.message)) : p.res(d.result);
      return;
    }
    if (d.method === 'Runtime.exceptionThrown') {
      const e = d.params.exceptionDetails;
      consoleErrors.push((e.exception && e.exception.description) || e.text);
    } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      consoleErrors.push((d.params.args || []).map((a) => a.value || a.description || '').join(' '));
    } else if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) {
      consoleErrors.push(`HTTP ${d.params.response.status} ${d.params.response.url}`);
    }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  /* sign in, so the quiz page renders instead of bouncing to signin */
  await send('Page.navigate', { url: `${BASE}/signin.html` });
  await sleep(3000);
  await js(`localStorage.setItem('robo.session', JSON.stringify({u:'quizaudit',t:'tok',ts:Date.now(),exp:Date.now()+864e5}));
    localStorage.setItem('robo.lang','${LANG}'); 'seeded'`);

  console.log(`\nQuiz logic — ${BASE}/quiz.html  (lang=${LANG})`);
  await send('Page.navigate', { url: `${BASE}/quiz.html` });
  await sleep(3500);

  const setup = JSON.parse(await js(`JSON.stringify({
    mixed: !!document.querySelector('#mixed-btn'),
    sets: document.querySelectorAll('details.qset').length,
    landed: location.pathname.split('/').pop()
  })`));
  check('the quiz page rendered (not redirected to sign-in)', setup.landed === 'quiz.html', setup.landed);
  check('the setup screen offers the mixed quiz', setup.mixed);
  check('every chapter has a quiz set', setup.sets === 10, `${setup.sets} chapter sets`);

  /* start the mixed quiz (10 questions) */
  await js(`document.querySelector('#mixed-btn').click(); 'go'`);
  await sleep(700);
  const running = await js(`!document.querySelector('#run-wrap').hidden`);
  check('the mixed quiz started', running);

  const TOTAL = 10;
  let expectedRight = 0, expectedWrong = 0;
  const problems = [];

  for (let q = 1; q <= TOTAL; q++) {
    /* 1. the question + options are present, Next is disabled */
    const head = JSON.parse(await js(`JSON.stringify({
      n: (document.querySelector('.qhead .pill')||{}).textContent || '',
      bar: ((document.querySelector('.sec-bar i')||{}).style || {}).width || '',
      q: (document.querySelector('.q-text')||{}).textContent || '',
      opts: document.querySelectorAll('#opts .option').length,
      nextDisabled: document.querySelector('#next').disabled
    })`));
    if (!head.q.trim()) problems.push(`question ${q}: no question text`);
    if (!/1\s*\/\s*10|1.*10|1/.test(head.n) || !head.n.trim()) problems.push(`question ${q}: no "Question X of Y" indicator`);
    if (head.opts !== 4) problems.push(`question ${q}: ${head.opts} options instead of 4`);
    if (!head.nextDisabled) problems.push(`question ${q}: Next was enabled before answering`);

    /* 2. answer it — mouse on odd questions, keyboard on even ones */
    const useKeyboard = q % 2 === 0;
    const pick = (q % 4);                       // varies which option is chosen
    if (useKeyboard) {
      const key = String(pick + 1);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, text: key, windowsVirtualKeyCode: 48 + pick + 1 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key });
      await sleep(150);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    } else {
      await js(`document.querySelectorAll('#opts .option')[${pick}].click(); 'picked'`);
      await sleep(150);
      await js(`document.querySelector('#next').click(); 'checked'`);
    }
    await sleep(400);

    /* 3. read what the page says happened. NB the revealed right answer gets the
       class `reveal`, not `correct` — only a right pick is marked `correct`. */
    const res = JSON.parse(await js(`JSON.stringify({
      fb: (document.querySelector('#fb')||{}).innerText || '',
      cls: [...document.querySelectorAll('#opts .option')].map(b => b.className),
      nextDisabled: document.querySelector('#next').disabled,
      nextLabel: (document.querySelector('#next')||{}).textContent || ''
    })`));
    const saidOk = /✓/.test(res.fb);
    const saidBad = /✕/.test(res.fb);
    if (!saidOk && !saidBad) problems.push(`question ${q}: no feedback after checking (fb="${res.fb.slice(0, 40)}")`);
    if (saidOk) {
      expectedRight++;
      if (!/correct/.test(res.cls[pick])) problems.push(`question ${q}: said correct but the picked option is not marked .correct`);
    }
    if (saidBad) {
      expectedWrong++;
      if (!/wrong/.test(res.cls[pick])) problems.push(`question ${q}: said wrong but the picked option is not marked .wrong`);
      if (!res.cls.some((c, i) => i !== pick && /reveal/.test(c))) problems.push(`question ${q}: the right answer was not revealed after a wrong pick`);
    }
    if (res.nextDisabled) problems.push(`question ${q}: Next still disabled after checking`);

    /* 4. move on — a second Enter after a keyboard answer, the Next button otherwise */
    if (useKeyboard) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    } else {
      await js(`document.querySelector('#next').click(); 'next'`);
    }
    await sleep(400);
    if (q < TOTAL) {
      const after = await js(`(document.querySelector('.qhead .pill')||{}).textContent || ''`);
      if (after === head.n) problems.push(`question ${q}: did not advance to the next question`);
      else {
        const barW = await js(`((document.querySelector('.sec-bar i')||{}).style||{}).width || ''`);
        if (barW === head.bar) problems.push(`question ${q}: the progress bar did not move (${barW})`);
      }
    }
  }

  /* 5. the results screen must agree with this script's tally */
  const out = JSON.parse(await js(`JSON.stringify({
    visible: !document.querySelector('#result-wrap').hidden,
    runHidden: document.querySelector('#run-wrap').hidden,
    ring: (document.querySelector('.result-ring i')||{}).textContent || '',
    pct: (document.querySelector('#result-wrap h2')||{}).textContent || '',
    ok: (document.querySelector('.fact.ok b')||{}).textContent || '',
    bad: (document.querySelector('.fact.bad b')||{}).textContent || '',
    total: (document.querySelectorAll('.result-facts .fact')[2]||{}).textContent || '',
    missed: document.querySelectorAll('.fold-body .sec-card').length,
    fold: (document.querySelector('.fold summary')||{}).textContent || ''
  })`));

  console.log(`  · the page scored ${out.ring} (${out.pct}) with ${out.bad} wrong; this script counted ${expectedRight} right / ${expectedWrong} wrong`);
  check('the results screen is shown', out.visible && out.runHidden);
  check('the score ring matches the tally', out.ring === `${expectedRight}/${TOTAL}`, `${out.ring} vs ${expectedRight}/${TOTAL}`);
  check('the correct count matches the tally', out.ok === String(expectedRight), `${out.ok} vs ${expectedRight}`);
  check('the wrong count matches the tally', out.bad === String(expectedWrong), `${out.bad} vs ${expectedWrong}`);
  check('right + wrong equals the number of questions', expectedRight + expectedWrong === TOTAL, `${expectedRight}+${expectedWrong}=${TOTAL}`);
  const pctNum = parseInt(out.pct, 10);
  check('the percentage matches the score', pctNum === Math.round((expectedRight / TOTAL) * 100), `${out.pct} vs ${Math.round((expectedRight / TOTAL) * 100)}%`);
  check('the missed-question list has one card per wrong answer',
    out.missed === (expectedWrong || 0) || (expectedWrong === 0 && out.missed === 0), `${out.missed} cards for ${expectedWrong} wrong`);
  check('no JavaScript errors during the whole run', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  if (problems.length) {
    console.log(`\n${problems.length} problem(s) inside the run:`);
    problems.slice(0, 12).forEach((p) => console.log('   ! ' + p));
    fail += problems.length;
  }
} catch (e) {
  console.error('quiz driver failed:', e.message);
  fail++;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
