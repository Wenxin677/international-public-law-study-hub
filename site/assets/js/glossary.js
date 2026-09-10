/* ==========================================================================
   glossary.js — bilingual legal glossary with table + flashcard trainer
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA;
  const t = I.t, esc = I.esc;
  let mode = 'table';

  function rows(q, chapterId) {
    q = (q || '').trim().toLowerCase();
    return D.glossary.filter(function (g) {
      if (chapterId && g.chapter.id !== chapterId) return false;
      if (!q) return true;
      return (g.km + ' ' + (g.en || '') + ' ' + (g.defKm || '') + ' ' + (g.defEn || '')).toLowerCase().indexOf(q) >= 0;
    });
  }

  function paint() {
    const host = I.qs('#gloss-host');
    const q = I.qs('#gloss-search').value;
    const ch = I.qs('#gloss-chapter').value;
    const list = rows(q, ch);
    I.qs('#gloss-count').textContent = list.length + ' ' + t('gloss.count');
    if (mode === 'table') {
      host.innerHTML = '<table class="data"><thead><tr><th>' + esc(t('gloss.term')) + '</th><th>' +
        esc(t('gloss.en')) + '</th><th>' + esc(t('gloss.def')) + '</th><th>' + esc(t('gloss.chapter')) + '</th></tr></thead><tbody>' +
        list.map(function (g) {
          return '<tr><td class="km" style="font-weight:600;color:var(--gold-soft)">' + esc(g.km) + '</td>' +
            '<td>' + esc(g.en || '') + '</td>' +
            '<td class="km">' + esc(I.state.lang === 'km' ? (g.defKm || '') : (g.defEn || '')) +
            (I.state.lang === 'km' && g.defEn ? '<div class="en small muted">' + esc(g.defEn) + '</div>' : '') + '</td>' +
            '<td class="small muted"><a href="learn.html#' + g.lesson.id + '">' + esc(I.pick(g.chapter.title)) + '</a>' +
            (g.page ? '<br>p.' + g.page : '') + '</td></tr>';
        }).join('') + '</tbody></table>' || '<p class="muted">—</p>';
    } else {
      host.innerHTML = '<div class="term-grid">' + list.slice(0, 60).map(function (g, i) {
        return '<div class="flip" data-flip="' + i + '"><div class="flip-inner">' +
          '<div class="flip-face"><div class="tkm">' + esc(g.km) + '</div><div class="ten">' + esc(g.en || '') + '</div>' +
          '<div class="small muted">' + esc(t('learn.flash')) + '</div></div>' +
          '<div class="flip-face flip-back"><div class="km">' + esc(I.state.lang === 'km' ? (g.defKm || '') : (g.defEn || '')) + '</div>' +
          '<div class="small muted" style="margin-top:6px"><a href="learn.html#' + g.lesson.id + '">' + esc(I.pick(g.chapter.title)) +
          (g.page ? ' · p.' + g.page : '') + '</a></div></div></div></div>';
      }).join('') + '</div>';
      I.qsa('.flip', host).forEach(function (c) {
        c.addEventListener('click', function () { c.classList.toggle('flipped'); });
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('glossary.html');
    I.qs('#gloss-search').setAttribute('placeholder', t('gloss.search'));
    I.qs('#gloss-chapter').innerHTML = '<option value="">' + esc(t('common.all')) + '</option>' +
      D.chapters.filter(function (c) { return c.lessons.some(function (l) { return (l.terms || []).length; }); })
        .map(function (c) { return '<option value="' + c.id + '">' + esc(I.pick(c.title)) + '</option>'; }).join('');
    I.qs('#gloss-search').addEventListener('input', paint);
    I.qs('#gloss-chapter').addEventListener('change', paint);
    I.qs('#mode-table').addEventListener('click', function () { mode = 'table'; paint(); });
    I.qs('#mode-flash').addEventListener('click', function () { mode = 'flash'; paint(); });
    paint();
    // deep link: glossary.html#t=<term>
    if (location.hash.indexOf('#t=') === 0) {
      const term = decodeURIComponent(location.hash.slice(3));
      I.qs('#gloss-search').value = term;
      paint();
    }
    I.commandPalette(D.glossary.map(function (g) {
      return { kind: 'term', text: g.km + ' · ' + (g.en || ''), href: 'glossary.html#t=' + encodeURIComponent(g.km) };
    }));
  });
})();
