/* What does a page actually render? Loads it in headless Chrome and reports the
   visible text plus the state of the parts that are built by JavaScript.

   Useful when a page "loads fine" but looks empty: it separates "the scripts did
   not run" from "the scripts ran and rendered nothing" from "a splash/overlay is
   still covering the content".

   Run:  node tools/dev/page_probe.mjs [--url BASE] [--width N] [--wait ms] page[#hash] ...
*/
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const get = (flag, dflt) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : dflt; };
const BASE = get('--url', 'https://wenxin677.github.io/international-public-law-study-hub');
const WIDTH = Number(get('--width', '1280'));
const WAIT = Number(get('--wait', '3500'));
const PAGES = argv.filter((a, i) => !a.startsWith('--') && !['--url', '--width', '--wait'].includes(argv[i - 1]));
if (!PAGES.length) PAGES.push('teacher.html');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'
].find((p) => existsSync(p));
if (!CHROME) { console.error('no Chrome found'); process.exit(2); }

const PORT = 9340;
const profile = mkdtempSync(path.join(tmpdir(), 'ipl-probe-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params };
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

const PROBE = `JSON.stringify((() => {
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01 && el.getBoundingClientRect().height > 0; };
  const splash = document.querySelector('#splash');
  const main = document.querySelector('main');
  const text = ((main || document.body || {}).innerText || '').replace(/\\s+/g, ' ').trim();
  const zeroHeight = [...document.querySelectorAll('main > *, main section, main aside, main div')]
    .filter((el) => el.getBoundingClientRect().height === 0).length;
  return {
    title: document.title,
    url: location.pathname.split('/').pop() + location.hash,
    textLen: text.length,
    textHead: text.slice(0, 220),
    splashVisible: vis(splash),
    mainTextLen: text.length,
    counts: {
      thread: document.querySelectorAll('#thread > *').length,
      suggest: document.querySelectorAll('#suggest > *').length,
      side: document.querySelectorAll('#chat-side > *').length,
      cards: document.querySelectorAll('.sec-card, .inc-card, .wk-strip li, .rail .ch').length,
      h1: document.querySelectorAll('h1').length
    },
    zeroHeight,
    iframes: [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src') || '(no src)'),
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth
  };
})())`;

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
    }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: WIDTH < 700 });
  await send('Page.navigate', { url: `${BASE}/index.html` });
  await sleep(2500);
  await js(`localStorage.setItem('robo.session', JSON.stringify({u:'probe',t:'tok',ts:Date.now(),exp:Date.now()+864e5})); 'ok'`);

  for (const page of PAGES) {
    await send('Page.navigate', { url: `${BASE}/${page}` });
    await sleep(WAIT);
    const v = JSON.parse(await js(PROBE));
    console.log(`\n── ${page} @${WIDTH}px  ${v.url}`);
    console.log(`   title: ${v.title}`);
    console.log(`   visible text: ${v.textLen} chars  |  ${JSON.stringify(v.counts)}`);
    console.log(`   splash covering the page: ${v.splashVisible ? 'YES' : 'no'}   main-children with zero height: ${v.zeroHeight}`);
    console.log(`   scrollWidth ${v.scrollW} vs viewport ${v.innerW}  ${v.scrollW > v.innerW + 1 ? 'OVERFLOW' : 'ok'}`);
    if (v.iframes && v.iframes.length) console.log(`   iframes: ${v.iframes.map((s) => s.split('/').pop()).join('  ')}`);
    console.log(`   text: "${v.textHead}${v.textLen > 220 ? '…' : ''}"`);
  }
} catch (e) {
  console.error('probe failed:', e.message);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
