/* Load every page in a real browser and report what a developer would see in the
   console: JavaScript errors, failed requests, and console warnings. Also checks
   that each page's own title/h1 rendered (i.e. the scripts actually ran).

   Run:  node tools/dev/console_check.mjs [--url BASE] [page ...]
   Default BASE is the live site, so this audits production, not just localhost.
*/
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const urlIdx = argv.indexOf('--url');
const BASE = urlIdx > -1 ? argv[urlIdx + 1] : 'https://wenxin677.github.io/international-public-law-study-hub';
const PAGES = argv.filter((a, i) => !a.startsWith('--') && !(urlIdx > -1 && i === urlIdx + 1));
if (!PAGES.length) {
  PAGES.push('index.html', 'signin.html', 'dashboard.html', 'learn.html', 'quiz.html',
    'teacher.html', 'library.html', 'glossary.html', 'about.html', 'admin.html');
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'
].find((p) => existsSync(p));

const PORT = 9336;
const profile = mkdtempSync(path.join(tmpdir(), 'ipl-console-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params };
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});

let failures = 0;
try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
    if (!target) await sleep(250);
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

  const events = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id); pending.delete(d.id);
      d.error ? p.rej(new Error(d.error.message)) : p.res(d.result);
      return;
    }
    if (d.method === 'Runtime.exceptionThrown') {
      const e = d.params.exceptionDetails;
      events.push({ kind: 'error', text: (e.exception && (e.exception.description || e.exception.value)) || e.text });
    } else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
      events.push({ kind: d.params.type, text: (d.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200) });
    } else if (d.method === 'Log.entryAdded' && ['error', 'warning'].includes(d.params.entry.level)) {
      events.push({ kind: d.params.entry.level, text: `${d.params.entry.text} ${d.params.entry.url || ''}`.slice(0, 200) });
    } else if (d.method === 'Network.loadingFailed') {
      events.push({ kind: 'netfail', text: `${d.params.type} ${d.params.errorText} (blocked=${!!d.params.blockedReason})` });
    } else if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) {
      events.push({ kind: 'http' + d.params.response.status, text: d.params.response.url });
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await send('Runtime.evaluate', { expression: `localStorage.setItem('robo.session', JSON.stringify({u:'audit',t:'t',ts:Date.now(),exp:Date.now()+864e5})); 'ok'`, url: BASE });
  await sleep(200);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });

  for (const page of PAGES) {
    events.length = 0;
    await send('Page.navigate', { url: `${BASE}/${page}` });
    await sleep(2600);
    const r = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ title: document.title, h1: (document.querySelector('h1')||{}).textContent || '',
        body: document.body.innerText.length, url: location.pathname.split('/').pop() })`,
      returnByValue: true
    });
    const v = JSON.parse(r.result.value);
    const errs = events.filter((e) => e.kind === 'error' || e.kind === 'netfail' || /^http[45]/.test(e.kind));
    const warns = events.filter((e) => e.kind === 'warning');
    const landed = v.url === page;
    if (errs.length || !landed) failures++;
    console.log(`\n${errs.length || !landed ? '✗' : '✓'} ${page}  title="${v.title.slice(0, 42)}" · ${v.body} chars of text` +
      (landed ? '' : `  LANDED ON ${v.url}`));
    if (v.h1 === '') console.log('   · no <h1> text rendered (scripts may not have run)');
    errs.forEach((e) => console.log(`   ${e.kind.toUpperCase()}: ${e.text.slice(0, 170)}`));
    warns.slice(0, 4).forEach((e) => console.log(`   warn: ${e.text.slice(0, 150)}`));
    if (!errs.length && !warns.length) console.log('   no console errors, no failed requests');
  }
} catch (e) {
  console.error('console check failed:', e.message);
  failures++;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(failures ? `\n${failures} page(s) with errors` : '\nno console errors on any page');
process.exit(failures ? 1 : 0);
