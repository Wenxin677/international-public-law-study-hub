/* glossary.js — searchable Khmer/English legal glossary, table or flashcards */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA, S = window.IPLSearch;
  const t = I.t, esc = I.esc, qs = I.qs;
  let mode = 'table', rows = D.glossary.slice();

  function matches(g, q) {
    if (!q) return true;
    const lq = q.toLowerCase();
    return (g.km || '').indexOf(q) >= 0 || (g.en || '').toLowerCase().indexOf(lq) >= 0 ||
      (g.defKm || '').indexOf(q) >= 0 || (g.defEn || '').toLowerCase().indexOf(lq) >= 0;
  }

  function render() {
    const q = qs('#gsearch').value.trim();
    rows = D.glossary.filter(function (g) { return matches(g, q); });
    qs('#gcount').textContent = rows.length + ' ' + t('gloss.count');
    const host = qs('#gbody');
    if (!rows.length) { host.innerHTML = '<div class="card muted">' + esc(t('gloss.empty')) + '</div>'; return; }
    if (mode === 'flash') {
      host.className = 'flip-grid';
      host.innerHTML = rows.slice(0, 240).map(function (g, i) {
        const def = I.state.lang === 'km' ? (g.defKm || g.defEn) : (g.defEn || g.defKm);
        return '<div class="flip" data-i="' + i + '" role="button" tabindex="0" aria-pressed="false"><div class="inner">' +
          '<div class="face"><b>' + esc(g.km) + '</b><span class="muted small">' + esc(g.en) + '</span></div>' +
          '<div class="face back">' + esc(I.truncate(def || '—', 240)) +
          '<span class="faint small">' + esc(t('common.page')) + ' ' + (g.page || '—') + '</span></div>' +
          '</div></div>';
      }).join('');
      /* a card you can only flip with a mouse is not a card — make it a button */
      I.qsa('.flip', host).forEach(function (f) {
        const toggle = function () {
          const on = f.classList.toggle('on');
          f.setAttribute('aria-pressed', on ? 'true' : 'false');
        };
        f.addEventListener('click', toggle);
        f.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggle(); }
        });
      });
      return;
    }
    host.className = '';
    host.innerHTML = '<div class="card" style="padding:0;overflow:hidden"><div class="scroll-x"><table class="tbl">' +
      '<thead><tr><th>' + esc(I.state.lang === 'km' ? 'ពាក្យ' : 'Khmer') + '</th><th>English</th><th>' +
      esc(t('gloss.def')) + '</th><th>' + esc(t('common.page')) + '</th></tr></thead><tbody>' +
      rows.slice(0, 400).map(function (g, i) {
        const def = I.state.lang === 'km' ? (g.defKm || g.defEn) : (g.defEn || g.defKm);
        return '<tr class="gloss-row" data-i="' + i + '" tabindex="0" role="button"><td class="gloss-term">' + esc(g.km) + '</td>' +
          '<td>' + esc(g.en) + '</td><td class="gloss-def">' + esc(I.truncate(def || '—', 150)) + '</td>' +
          '<td class="nowrap">p.' + (g.page || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    /* rows open a detail panel on click — they must answer Enter/Space too */
    I.qsa('.gloss-row', host).forEach(function (r) {
      const open = function () { detail(rows[+r.dataset.i]); };
      r.addEventListener('click', open);
      r.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); open(); }
      });
    });
  }

  function detail(g) {
    if (!g) return;
    const l = g.lesson;
    I.modal(g.km, 
      '<div class="row" style="gap:8px;margin-bottom:10px"><span class="pill gold">' + esc(g.en || '') + '</span>' +
      (g.page ? '<span class="pill">' + esc(t('common.page')) + ' ' + g.page + '</span>' : '') + '</div>' +
      '<p class="km">' + esc(g.defKm || g.defEn || '—') + '</p>' +
      (g.defEn && g.defEn !== g.defKm ? '<p class="muted">' + esc(g.defEn) + '</p>' : '') +
      (l ? '<div class="cite-list"><a class="cite" href="learn.html#' + l.id + '">' + esc(t('gloss.where')) + ': ' + esc(I.pick(l.title)) + '</a>' +
        '<a class="cite" href="teacher.html?q=' + encodeURIComponent(g.km) + '">🤖 ' + esc(t('nav.teacher')) + '</a></div>' : ''),
      '<button class="btn" data-close>' + esc(t('common.close')) + '</button>');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('glossary.html');
    qs('#gsearch').setAttribute('aria-label', t('common.search'));
    const gc = qs('#gcount');
    if (gc) gc.setAttribute('aria-live', 'polite');
    qs('#gsearch').addEventListener('input', function () { render(); });
    I.qsa('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        I.qsa('[data-mode]').forEach(function (x) { x.classList.toggle('primary', x.dataset.mode === mode); });
        render();
      });
    });
    const m = location.hash.match(/t=([^&]+)/);
    if (m) { qs('#gsearch').value = decodeURIComponent(m[1]); }
    render();
    if (m) {
      const first = D.glossary.filter(function (g) { return matches(g, decodeURIComponent(m[1])); })[0];
      if (first) setTimeout(function () { detail(first); }, 150);
    }
  });
})();
