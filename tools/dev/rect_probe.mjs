/* What does an element actually render? Rect, computed background, and a cropped
   screenshot of each match — because computed styles lie when a gradient or a
   translucent layer sits behind the element.

   Run:  node tools/dev/rect_probe.mjs dashboard.html ".dash-3 > .sec-card" [--out DIR] [--width 1280]
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT = outIdx > -1 ? argv[outIdx + 1] : null;
const wIdx = argv.indexOf('--width');
const WIDTH = wIdx > -1 ? Number(argv[wIdx + 1]) : 1280;
const [page, selector] = argv.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1 && i !== wIdx + 1);
if (!page || !selector) { console.error('usage: rect_probe.mjs <page> <selector> [--out DIR] [--width N]'); process.exit(2); }

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'
].find((p) => existsSync(p));

const PORT = 9335;
const profile = mkdtempSync(path.join(tmpdir(), 'ipl-rect-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params };
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});

const PROBE = (sel) => `(() => {
  const out = [];
  document.querySelectorAll(${JSON.stringify(sel)}).forEach((el, i) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const stack = [];
    for (let e = el; e && stack.length < 4; e = e.parentElement) {
      const s = getComputedStyle(e);
      stack.push({ el: e.tagName.toLowerCase() + '.' + String(e.className || '').split(' ').slice(0,2).join('.'),
        bg: s.backgroundColor, img: s.backgroundImage === 'none' ? null : s.backgroundImage.slice(0, 60),
        clip: s.backgroundClip, opacity: s.opacity });
    }
    out.push({ i, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      color: cs.color, bg: cs.backgroundColor, img: cs.backgroundImage === 'none' ? null : cs.backgroundImage.slice(0, 80),
      clip: cs.backgroundClip, origin: cs.backgroundOrigin, opacity: cs.opacity, radius: cs.borderRadius, border: cs.borderColor,
      shadow: cs.boxShadow.slice(0, 60), stack });
  });
  return JSON.stringify(out);
})()`;

try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
    if (!target) await sleep(250);
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: WIDTH < 700 });

  const file = 'file:///' + path.join(SITE, page).replace(/\\/g, '/');
  await send('Page.navigate', { url: file });
  await sleep(600);
  await send('Runtime.evaluate', { expression: `localStorage.setItem('robo.session', JSON.stringify({u:'probe',t:'tok',ts:Date.now(),exp:Date.now()+864e5})); 'ok'` });
  await send('Page.navigate', { url: file });
  await sleep(1600);

  const r = await send('Runtime.evaluate', { expression: PROBE(selector), returnByValue: true });
  const items = JSON.parse(r.result.value);
  console.log(`${page} @ ${WIDTH}px · selector "${selector}" · ${items.length} match(es)\n`);
  for (const it of items) {
    console.log(`#${it.i} rect x=${it.rect[0]} y=${it.rect[1]} ${it.rect[2]}x${it.rect[3]}`);
    console.log(`   colour ${it.color} on background-color ${it.bg}`);
    console.log(`   background-image ${it.img || 'none'}`);
    console.log(`   clip ${it.clip} · origin ${it.origin} · radius ${it.radius} · opacity ${it.opacity}`);
    console.log(`   border ${it.border} · shadow ${it.shadow}`);
    if (it.stack.length > 1) console.log('   layer stack: ' + it.stack.map((s) => `${s.el}[${s.bg}${s.img ? '+img' : ''}]`).join(' -> '));
    if (OUT && it.rect[2] > 0 && it.rect[3] > 0) {
      mkdirSync(OUT, { recursive: true });
      const png = await send('Page.captureScreenshot', { format: 'png',
        clip: { x: it.rect[0], y: it.rect[1], width: it.rect[2], height: it.rect[3], scale: 1 } });
      const f = path.join(OUT, `${page.replace('.html', '')}-${it.i}.png`);
      writeFileSync(f, Buffer.from(png.data, 'base64'));
      console.log(`   crop -> ${f}`);
    }
    console.log();
  }
} catch (e) {
  console.error('rect probe failed:', e.message);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  await sleep(250);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
