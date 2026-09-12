/* Audit the real pages against WCAG 2.2 AA + 2026 practice, in headless Chrome
   over CDP. Read-only: it never edits the site.

   Checks per page (AA failures are fatal, the rest are reported):
     · text contrast   — 4.5:1 normal text, 3:1 large (>=24px, or >=18.66px bold)
                         on solid backgrounds; gradient/image backgrounds reported
                         separately as unmeasurable rather than passed
     · tap targets     — >=24x24 CSS px (WCAG 2.5.8 AA), >=44 flagged as practice
     · images          — every <img> needs alt (alt="" is fine when decorative)
     · headings        — one h1, no skipped levels
     · focus           — the first control must show a visible focus ring
     · mobile inputs   — <input>/<select>/<textarea> under 16px causes iOS zoom
     · landmarks       — main/header/nav/footer, lang attribute, zoomable viewport
     · icon buttons    — a button with no text needs an accessible name

   Run:  node tools/dev/a11y_check.mjs [--width 390] [page ...]
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const argv = process.argv.slice(2);
const wIdx = argv.indexOf('--width');
const WIDTH = wIdx > -1 ? Number(argv[wIdx + 1]) : 390;
const PAGES = argv.filter((a, i) => !a.startsWith('--') && i !== wIdx + 1);
if (!PAGES.length) {
  PAGES.push('index.html', 'signin.html', 'dashboard.html', 'learn.html', 'quiz.html',
    'teacher.html', 'library.html', 'glossary.html', 'about.html', 'admin.html');
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'
].find((p) => existsSync(p));
if (!CHROME) { console.error('no Chrome found'); process.exit(2); }

const PORT = 9334;
const profile = mkdtempSync(path.join(tmpdir(), 'ipl-a11y-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--allow-file-access-from-files', 'about:blank'
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = `localStorage.setItem('robo.session', JSON.stringify({
  u: 'a11ycheck', t: 'tok', ts: Date.now(), exp: Date.now() + 864e5
})); 'seeded'`;

/* The whole audit runs inside the page. Contrast is computed from the real
   computed styles, so it catches tokens we did not think to check by hand. */
const AUDIT = `(() => {
  const toRGB = (s) => {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (f, b) => {
    const a = lum(f), c = lum(b);
    return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
  };
  const bgOf = (el) => {
    let image = null;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') image = cs.backgroundImage;
      const c = toRGB(cs.backgroundColor);
      if (c && c.a > 0.6) return { bg: c, image };
    }
    return { bg: { r: 11, g: 15, b: 34, a: 1 }, image };
  };
  const text = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };

  const lowContrast = [], unmeasured = [], smallTargets = [], tinyTargets = [];
  const all = [...document.querySelectorAll('body *')];

  all.forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    const t = text(el);
    if (t && t.length > 1 && el.children.length === 0) {
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      const fg = toRGB(cs.color);
      const { bg, image } = bgOf(el);
      if (fg && fg.a > 0 && bg) {
        const r = ratio(fg, bg);
        if (r < need) {
          const rec = { sel: el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\\s+/).slice(0, 2).join('.'),
            size: Math.round(size), ratio: Math.round(r * 100) / 100, need, text: t.slice(0, 32), onImage: !!image };
          (image ? unmeasured : lowContrast).push(rec);
        }
      }
    }
    const tag = el.tagName.toLowerCase();
    if (['a', 'button', 'input', 'select', 'textarea', 'summary', '[role="button"]'].includes(tag) || el.getAttribute('role') === 'button') {
      const r = el.getBoundingClientRect();
      const inlineLink = tag === 'a' && el.parentElement && /^(P|LI|SPAN|EM|STRONG|TD)$/.test(el.parentElement.tagName);
      if (inlineLink) return;
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w < 24 || h < 24) smallTargets.push({ sel: tag + '.' + String(el.className || '').split(' ')[0], w, h });
      else if (w < 44 || h < 44) tinyTargets.push({ sel: tag + '.' + String(el.className || '').split(' ')[0], w, h });
    }
  });

  const imgs = [...document.querySelectorAll('img')].filter((i) => visible(i));
  const noAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;

  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible)
    .map((h) => ({ lvl: +h.tagName[1], txt: (h.textContent || '').trim().slice(0, 40) }));
  const skips = [];
  for (let i = 1; i < heads.length; i++) if (heads[i].lvl - heads[i - 1].lvl > 1) skips.push(heads[i - 1].lvl + '->' + heads[i].lvl);

  /* focus ring on the first real control */
  let focusRing = null;
  const first = [...document.querySelectorAll('a[href], button:not([disabled]), input, summary')].filter(visible)[0];
  if (first) {
    first.focus();
    const fs = getComputedStyle(first);
    focusRing = { outline: fs.outlineStyle + ' ' + fs.outlineWidth, shadow: fs.boxShadow !== 'none' };
  }

  const smallInputs = [...document.querySelectorAll('input, select, textarea')].filter(visible)
    .filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16)
    .map((i) => ({ name: i.id || i.name || i.type, size: Math.round(parseFloat(getComputedStyle(i).fontSize)) }));

  const nameless = [...document.querySelectorAll('button')].filter(visible).filter((b) => {
    const label = (b.textContent || '').trim() || b.getAttribute('aria-label') || b.getAttribute('title') || '';
    return !label;
  }).map((b) => b.className || b.outerHTML.slice(0, 40));

  const vp = document.querySelector('meta[name="viewport"]');
  /* named pairs we care about: buttons and pills that often sit on gradients */
  const probes = [];
  ['.btn.primary', '.btn.gold', '.btn.ghost', '.pill', '.pill.gold', '.pill.ok',
   '.topbar a', '.topbar button', '.qset.mixed .qset-head', '.qset .n', '.nav a',
   '.sec-head', '.muted.small', '.small.faint', '.cite', '.option .key'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el || !visible(el)) return;
    const cs = getComputedStyle(el);
    const fg = toRGB(cs.color);
    const { bg, image } = bgOf(el);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
    probes.push({ sel, size: Math.round(size), fg: cs.color, bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')',
      ratio: fg ? Math.round(ratio(fg, bg) * 100) / 100 : null, need, gradient: !!image,
      rect: [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)] });
  });
  return JSON.stringify({
    title: document.title,
    probes,
    lang: document.documentElement.getAttribute('lang') || null,
    viewport: vp ? vp.getAttribute('content') : null,
    landmarks: { main: document.querySelectorAll('main').length, header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length, footer: document.querySelectorAll('footer').length },
    skipLink: !!document.querySelector('a[href^="#"]') && /skip|រំលង/i.test(document.querySelector('a[href^="#"]') ? document.querySelector('a[href^="#"]').textContent : ''),
    lowContrast: lowContrast.slice(0, 12), lowContrastCount: lowContrast.length,
    unmeasured: unmeasured.slice(0, 4), unmeasuredCount: unmeasured.length,
    smallTargets: smallTargets.slice(0, 8), smallTargetCount: smallTargets.length,
    tinyTargets: tinyTargets.slice(0, 6), tinyTargetCount: tinyTargets.length,
    imgs: imgs.length, noAlt,
    h1: heads.filter((h) => h.lvl === 1).length, headings: heads.length, skipped: skips.slice(0, 3),
    focusRing, smallInputs, nameless,
    text: document.body.innerText.length
  });
})()`;

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params };
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});

let failures = 0;
const style = (n) => n ? '\u001b[31m' + n + '\u001b[0m' : n;

try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not up */ }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('DevTools endpoint never came up');
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
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: WIDTH < 700 });

  const totals = { contrast: 0, targets: 0, alt: 0, heads: 0, inputs: 0, focus: 0, lang: 0 };
  for (const page of PAGES) {
    const file = 'file:///' + path.join(SITE, page).replace(/\\/g, '/');
    await send('Page.navigate', { url: file });
    await sleep(700);
    await send('Runtime.evaluate', { expression: SEED });
    await send('Page.navigate', { url: file });
    await sleep(1500);
    const r = await send('Runtime.evaluate', { expression: AUDIT, returnByValue: true });
    const v = JSON.parse(r.result.value);
    const fails = [];
    if (v.lowContrastCount) { fails.push(`${v.lowContrastCount} low-contrast text`); totals.contrast += v.lowContrastCount; }
    if (v.smallTargetCount) { fails.push(`${v.smallTargetCount} targets under 24px`); totals.targets += v.smallTargetCount; }
    if (v.noAlt) { fails.push(`${v.noAlt} images without alt`); totals.alt += v.noAlt; }
    if (v.h1 !== 1) { fails.push(`${v.h1} h1 elements`); totals.heads++; }
    if (v.skipped.length) { fails.push('skipped heading level ' + v.skipped.join(',')); totals.heads++; }
    if (v.smallInputs.length) { fails.push(`${v.smallInputs.length} inputs under 16px`); totals.inputs += v.smallInputs.length; }
    if (!v.focusRing || /none/.test(v.focusRing.outline) && !v.focusRing.shadow) { fails.push('no visible focus ring'); totals.focus++; }
    if (!v.lang) { fails.push('no lang attribute'); totals.lang++; }
    failures += fails.length;

    console.log(`\n${fails.length ? '✗' : '✓'} ${page}  (${v.headings} headings, ${v.imgs} images, ${v.text} chars)`);
    console.log(`   lang=${v.lang} · viewport=${v.viewport ? (/(user-scalable=no|maximum-scale=1)/.test(v.viewport) ? 'ZOOM BLOCKED' : 'ok') : 'missing'} · landmarks m${v.landmarks.main}/h${v.landmarks.header}/n${v.landmarks.nav}/f${v.landmarks.footer} · skip-link=${v.skipLink}`);
    console.log(`   focus ring on first control: ${v.focusRing ? v.focusRing.outline : 'n/a'}`);
    if (fails.length) console.log('   ' + style('FAIL') + ': ' + fails.join(' · '));
    if (v.lowContrast.length) v.lowContrast.forEach((c) => console.log(`     · contrast ${c.ratio}:1 (needs ${c.need}) ${c.size}px  ${c.sel}  "${c.text}"`));
    if (v.smallTargetCount) console.log('     · ' + v.smallTargets.map((t) => `${t.sel} ${t.w}x${t.h}`).join(' · '));
    if (v.unmeasuredCount) console.log(`     · ${v.unmeasuredCount} text runs sit on a gradient/image — contrast unmeasurable there`);
    if (v.tinyTargetCount) console.log(`     · ${v.tinyTargetCount} targets between 24 and 44px (mobile practice)`);
    if (v.nameless.length) console.log(`     · buttons with no accessible name: ${v.nameless.length}`);
    if (process.env.A11Y_PROBES && v.probes) {
      v.probes.forEach((p) => console.log(`     probe ${p.ratio}${p.ratio && p.ratio < p.need ? ' <-- UNDER ' + p.need : ''}  ${p.size}px  ${p.sel}  ${p.fg} on ${p.bg}${p.gradient ? ' (on gradient)' : ''} ${p.rect[0]}x${p.rect[1]}`));
    }
  }
  console.log(`\nTOTALS  low-contrast text ${totals.contrast} · sub-24px targets ${totals.targets} · missing alt ${totals.alt} · heading issues ${totals.heads} · small inputs ${totals.inputs} · focus issues ${totals.focus} · lang issues ${totals.lang}`);
} catch (e) {
  console.error('a11y check failed:', e.message);
  failures++;
} finally {
  try { ws && ws.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
console.log(failures ? `\n${failures} AA-level issue(s) to fix` : '\nno AA-level accessibility issues found');
process.exit(failures ? 1 : 0);
