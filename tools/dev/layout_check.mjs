/* Measure the real rendered layout in headless Chrome — no dev server, no
   browser tool. Answers the two questions jsdom cannot: does the page overflow
   horizontally at phone/tablet/desktop widths, and do the card grids actually
   stack.

   Run:  node tools/dev/layout_check.mjs [page ...] [--widths 360,768,1280]
   Default pages: dashboard.html quiz.html learn.html
   Exit code is non-zero if any page overflows its viewport.
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const argv = process.argv.slice(2);
const widthsArg = argv.indexOf('--widths');
const WIDTHS = (widthsArg > -1 ? argv[widthsArg + 1] : '360,768,1280').split(',').map(Number);
const shotIdx = argv.indexOf('--shots');
const SHOT_DIR = shotIdx > -1 ? argv[shotIdx + 1] : null;
const SHOT_WIDTHS = [412, 1280];
const SHOT_PAGE = 'dashboard.html';
const PAGES = argv.filter((a, i) => !a.startsWith('--') &&
  i !== widthsArg + 1 && !(shotIdx > -1 && i === shotIdx + 1));
if (!PAGES.length) PAGES.push('dashboard.html', 'quiz.html', 'learn.html');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find((p) => existsSync(p));
if (!CHROME) { console.error('no Chrome found'); process.exit(2); }

const PORT = 9333;
const profile = mkdtempSync(path.join(tmpdir(), 'ipl-layout-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--allow-file-access-from-files', '--hide-scrollbars',
  '--window-size=360,900', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

const MEASURE = `(() => {
  const de = document.documentElement, vw = window.innerWidth;
  const out = [];
  const clippedBy = (e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox !== 'visible' && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  document.querySelectorAll('body *').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.right <= 0) return;                    /* off-canvas drawer, slides in later */
    if (getComputedStyle(e).position === 'fixed') return;
    if (r.right > vw + 1 && !clippedBy(e)) {
      out.push((e.tagName.toLowerCase()) + '.' + String(e.className || '').trim().split(/\\s+/).slice(0, 2).join('.') +
        ' [l=' + Math.round(r.left) + ' r=' + Math.round(r.right) + ']');
    }
  });
  const cols = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).gridTemplateColumns : null; };
  const hero = document.querySelector('.dash-3 > .hero');
  const cards = [...document.querySelectorAll('.dash-3 > .sec-card')].map((c) => Math.round(c.getBoundingClientRect().width));
  const wrap = document.querySelector('main .wrap') || document.querySelector('main');
  return JSON.stringify({
    url: location.pathname.split('/').pop(),
    wrapChildren: wrap ? wrap.children.length : 0,
    vw, scrollWidth: de.scrollWidth, scrollHeight: de.scrollHeight,
    overflowCount: out.length, overflow: out.slice(0, 6),
    dashCols: cols('.dash-3'), heroOrder: hero ? getComputedStyle(hero).order : null,
    heroWidth: hero ? Math.round(hero.getBoundingClientRect().width) : null,
    cardWidths: cards
  });
})()`;

/* the app sends you to signin.html without a session, so seed one first —
   otherwise every page measures as the sign-in screen */
const SEED = `localStorage.setItem('robo.session', JSON.stringify({
  u: 'layoutcheck', t: 'tok', ts: Date.now(), exp: Date.now() + 864e5
})); 'seeded'`;

let ws, id = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  return new Promise((res, rej) => {
    pending.set(msg.id, { res, rej });
    ws.send(JSON.stringify(msg));
  });
}

let failures = 0;
try {
  const target = await targets();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? rej(new Error(d.error.message)) : res(d.result);
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');

  for (const page of PAGES) {
    const file = 'file:///' + path.join(SITE, page).replace(/\\/g, '/');
    await send('Page.navigate', { url: file });
    await sleep(700);
    await send('Runtime.evaluate', { expression: SEED });   /* file:// shares one origin here */
    await sleep(200);
    for (const w of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
      await send('Page.navigate', { url: file });
      await sleep(1500); /* let the page scripts render */
      const r = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
      const v = JSON.parse(r.result.value);
      const landed = v.url === page;
      const bad = !landed || v.scrollWidth > v.vw + 1 || v.overflowCount > 0;
      if (bad) failures++;
      console.log(`${bad ? 'OVERFLOW' : '     ok '} ${page.padEnd(16)} ${String(w).padStart(4)}px  ` +
        (landed ? '' : `LANDED ON ${v.url} (no session?) · `) +
        `viewport ${v.vw} · scrollWidth ${v.scrollWidth} · height ${v.scrollHeight} · blocks ${v.wrapChildren}` +
        (v.dashCols ? ` · cols ${v.dashCols} · hero ${v.heroWidth}px order ${v.heroOrder} · cards [${v.cardWidths}]` : ''));
      if (v.overflow.length) v.overflow.forEach((o) => console.log('            └ ' + o));

      /* the dashboard has a shape we can assert, not just eyeball */
      if (page === 'dashboard.html' && v.dashCols) {
        const cw = v.cardWidths;
        const equal = cw.length === 3 && Math.max(...cw) - Math.min(...cw) <= 3;
        const single = cw.length === 3 && Math.abs(cw[0] - (v.vw - 28)) <= 40 && equal;
        const want = w >= 1080 ? ['three equal cards', equal]
          : w >= 720 ? ['hero full width, two cards under it',
            cw.length === 3 && Math.max(...cw) >= v.vw - 60 && Math.abs(cw[0] - cw[2]) <= 3]
            : ['one column, hero first', equal && String(v.heroOrder) === '-1'];
        const okShape = want[1];
        if (!okShape) failures++;
        console.log(`            ${okShape ? '✓' : '✗'} ${want[0]} (cards ${cw.join('/')}px${single ? '' : ''})`);
      }

      /* optional: pictures of the real page, for a human to look at */
      if (SHOT_DIR && page === SHOT_PAGE && SHOT_WIDTHS.includes(w)) {
        const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        mkdirSync(SHOT_DIR, { recursive: true });
        const file = path.join(SHOT_DIR, `${page.replace('.html', '')}-${w}.png`);
        writeFileSync(file, Buffer.from(cap.data, 'base64'));
        console.log(`            📷 ${file}`);
      }
    }
  }
} catch (e) {
  console.error('layout check failed:', e.message);
  failures++;
} finally {
  try { ws && ws.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
console.log(failures ? `\n${failures} overflowing layout(s)` : '\nno horizontal overflow at any tested width');
process.exit(failures ? 1 : 0);
