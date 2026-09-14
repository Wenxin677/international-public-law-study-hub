/* Prove the Khmer webfont is actually in use, not merely declared.

   Declaring @font-face is easy to get wrong: a wrong path, a CSP block, a stack
   that skips the font, or a subset missing the glyphs all fail silently and the
   reader just sees the device's Khmer font. So this measures, in a real browser:

     1. the font file loads (document.fonts.load resolves)
     2. Khmer elements compute a stack whose first entry is KhmerOS Battambang
     3. a Khmer string's measured width with the webfont differs from the width
        with a fallback — i.e. the glyphs really come from the shipped file
     4. Khmer text renders identical width in bold vs regular only if the bold
        face loaded (catches a missing bold file)

   Run:  node tools/dev/font_check.mjs [page ...]
*/
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const PAGES = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!PAGES.length) PAGES.push('index.html', 'learn.html', 'dashboard.html', 'quiz.html', 'glossary.html', 'library.html');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'
].find((p) => existsSync(p));
if (!CHROME) { console.error('no Chrome found'); process.exit(2); }

const PORT = 9338;
const profile = mkdtempSync(path.join(tmpdir(), 'ipl-font-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0, failures = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params };
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});

const PROBE = `(async () => {
  const KM = 'ច្បាប់សាធារណៈអន្តរជាតិ';
  const load = async (spec) => { try { await document.fonts.load(spec); } catch (e) {} };
  await load('16px "KhmerOS Battambang"');
  await load('700 16px "KhmerOS Battambang"');
  await document.fonts.ready;

  const width = (font, bold) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = (bold ? '700 ' : '') + '32px ' + font;
    return Math.round(c.measureText(KM).width * 100) / 100;
  };
  const webfont = width('"KhmerOS Battambang", monospace', false);
  const fallback = width('monospace', false);
  const webfontBold = width('"KhmerOS Battambang", monospace', true);
  const fallbackBold = width('monospace', true);

  // a real element that shows Khmer, and what the browser resolved for it
  const el = [...document.querySelectorAll('h1,h2,h3,p,li,a,button,span')]
    .find((n) => /[\\u1780-\\u17FF]/.test(n.textContent || '') && n.offsetParent !== null);
  const cs = el ? getComputedStyle(el) : null;

  return JSON.stringify({
    regularLoaded: document.fonts.check('16px "KhmerOS Battambang"'),
    faces: [...document.fonts].filter((f) => /Battambang/i.test(f.family))
      .map((f) => f.family + ' ' + f.weight + ' ' + f.status),
    boldFaceLoaded: [...document.fonts].some((f) => /Battambang/i.test(f.family) && +f.weight >= 700 && f.status === 'loaded'),
    webfont, fallback, webfontBold, fallbackBold,
    stack: cs ? cs.fontFamily : null,
    sample: el ? (el.textContent || '').trim().slice(0, 24) : null
  });
})()`;

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

  /* seed a session on the first page so learn/quiz/dashboard render their real
     content instead of bouncing to signin */
  await send('Page.navigate', { url: 'file:///' + path.join(SITE, PAGES[0]).replace(/\\/g, '/') });
  await sleep(1200);
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('robo.session', JSON.stringify({u:'fontcheck',t:'tok',ts:Date.now(),exp:Date.now()+864e5})); 'seeded'`
  });

  for (const page of PAGES) {
    try {
      await send('Page.navigate', { url: 'file:///' + path.join(SITE, page).replace(/\\/g, '/') });
      await sleep(2200);
      const r = await send('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true });
      const v = JSON.parse(r.result.value);
      const usesFont = v.webfont !== v.fallback;
      /* NB: Battambang Bold has the SAME advance widths as Regular by design
         (only the outlines are heavier), so width equality is NOT a failure
         signal — the loaded faces list is what proves the bold file is in use. */
      const ok = v.regularLoaded && usesFont && v.boldFaceLoaded && (!v.stack || /KhmerOS Battambang/i.test(v.stack.split(',')[0]));
      if (!ok) failures++;
      console.log(`\n${ok ? '✓' : '✗'} ${page}`);
      console.log(`   faces loaded: ${v.faces.join(' | ') || 'NONE'}`);
      console.log(`   Khmer string width: webfont ${v.webfont}px vs fallback ${v.fallback}px  ${usesFont ? '(the shipped file is rendering)' : '(FALLBACK IS RENDERING)'}`);
      console.log(`   bold: ${v.boldFaceLoaded ? 'real bold face loaded (same advances, heavier outlines — by design)' : 'NO BOLD FACE'}`);
      if (v.stack) console.log(`   resolved stack of a Khmer element: ${v.stack.split(',').slice(0, 3).join(',')}`);
      if (v.sample) console.log(`   sample: "${v.sample}"`);
    } catch (e) {
      failures++;
      console.log(`\n✗ ${page}: ${e.message}`);
    }
  }
} catch (e) {
  console.error('font check failed:', e.message);
  failures++;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(failures ? `\n${failures} page(s) not using the Khmer webfont` : '\nKhmer webfont is loading and rendering on every page');
process.exit(failures ? 1 : 0);
