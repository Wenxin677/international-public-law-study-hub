/* ==========================================================================
   learn.js — chapter/lesson browser and lesson reader
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA;
  const t = I.t, esc = I.esc;

  let current = null;

  function lessonRow(l) {
    const p = I.getProgress();
    const done = p.lessons[l.id];
    return '<li><button class="lesson-link" data-lesson="' + l.id + '">' +
      (done ? '<span class="done-dot">✓</span>' : '') +
      '<span class="km">' + esc(I.pick(l.title)) + '</span>' +
      '<span class="pg">' + (l.pages ? 'p.' + l.pages.from : '') + '</span></button></li>';
  }

  function renderRail(filter) {
    const rail = I.qs('#rail');
    const q = (filter || '').toLowerCase();
    rail.innerHTML = D.chapters.map(function (ch) {
      const lessonsHtml = ch.lessons
        .filter(function (l) { return !q || (I.pick(l.title) + ' ' + l.id).toLowerCase().indexOf(q) >= 0; })
        .map(lessonRow).join('');
      if (!lessonsHtml) return '';
      return '<div class="chapter-group">' +
        '<button class="chapter-btn" data-chapter="' + ch.id + '">' +
        '<span class="num">' + (ch.num > 0 ? ch.num : '§') + '</span>' +
        '<span><span class="km">' + esc(ch.title.km || ch.title.en) + '</span>' +
        '<br><span class="small muted">' + esc(ch.title.en || '') + '</span></span></button>' +
        '<ul class="lesson-list">' + lessonsHtml + '</ul></div>';
    }).join('') || '<div class="muted small">—</div>';

    I.qsa('[data-lesson]', rail).forEach(function (b) {
      b.addEventListener('click', function () { showLesson(b.dataset.lesson); });
    });
    I.qsa('[data-chapter]', rail).forEach(function (b) {
      b.addEventListener('click', function () {
        window.location.href = 'quiz.html#chapter=' + b.dataset.chapter;
      });
    });
  }

  function tabsFor(l) {
    return [
      ['overview', t('learn.objectives')],
      ['points', t('learn.keypoints')],
      ['quotes', t('learn.quotes')],
      ['terms', t('learn.terms') + ' (' + (l.terms || []).length + ')'],
      ['notes', t('common.notes')]
    ];
  }

  function showLesson(id, tab) {
    const l = D.lessonById(id);
    if (!l) return;
    current = l;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    I.qsa('.lesson-link').forEach(function (b) { b.classList.toggle('active', b.dataset.lesson === id); });
    const host = I.qs('#lesson-host');
    const p = I.getProgress();
    const done = !!p.lessons[id];
    const idx = D.lessons.indexOf(l);
    const prev = D.lessons[idx - 1], next = D.lessons[idx + 1];

    host.innerHTML =
      '<div class="card pad-lg">' +
      '<div class="small muted"><span class="pill gold">' + esc(l.chapter.title.en || '') + '</span> ' +
      '<span class="pill">' + esc(t('learn.pages') + ' ' + (l.pages ? l.pages.from + '–' + l.pages.to : '')) + '</span>' +
      (l.quiz.length ? ' <span class="pill">' + l.quiz.length + ' Q</span>' : '') + '</div>' +
      '<h1 style="margin:10px 0 6px" class="km">' + esc(l.title.km || l.title.en) + '</h1>' +
      '<div class="muted">' + esc(l.title.en || '') + '</div>' +
      '<div class="kbach" style="margin:16px 0"></div>' +
      '<div class="tabs">' + tabsFor(l).map(function (x) {
        return '<button class="tab" data-tab="' + x[0] + '">' + esc(x[1]) + '</button>';
      }).join('') + '</div>' +
      '<div id="tab-body"></div>' +
      '<div class="kbach" style="margin:22px 0 16px"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn primary" id="mark-btn">' + esc(done ? t('learn.marked') : t('learn.mark')) + '</button>' +
      (l.quiz.length ? '<a class="btn" href="quiz.html#lesson=' + l.id + '">' + esc(t('learn.quiz')) + '</a>' : '') +
      '<button class="btn ghost" id="cite-btn">' + esc(t('common.copy')) + '</button>' +
      '<span class="spacer" style="flex:1"></span>' +
      (prev ? '<button class="btn sm" data-go="' + prev.id + '">← ' + esc(t('learn.prev')) + '</button>' : '') +
      (next ? '<button class="btn sm" data-go="' + next.id + '">' + esc(t('learn.next')) + ' →</button>' : '') +
      '</div></div>';

    const tabs = I.qsa('.tab', host);
    function paint(which) {
      tabs.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === which); });
      I.qs('#tab-body', host).innerHTML = panel(l, which);
      if (which === 'terms') {
        I.qsa('.flip', host).forEach(function (c) {
          c.addEventListener('click', function () { c.classList.toggle('flipped'); });
        });
      }
      if (which === 'notes') {
        const ta = I.qs('#notes-area', host);
        ta.addEventListener('input', function () {
          const pr = I.getProgress(); pr.notes[l.id] = ta.value; I.saveProgress(pr);
        });
      }
    }
    tabs.forEach(function (b) { b.addEventListener('click', function () { paint(b.dataset.tab); }); });
    paint(tab || 'overview');

    I.qs('#mark-btn', host).addEventListener('click', function () {
      const pr = I.getProgress();
      if (pr.lessons[l.id]) { delete pr.lessons[l.id]; }
      else { pr.lessons[l.id] = { ts: Date.now() }; }
      I.saveProgress(pr);
      if (pr.lessons[l.id]) I.addXP(10);
      renderRail(I.qs('#rail-search').value);
      showLesson(l.id, I.qs('.tab.active', host).dataset.tab);
      I.toast(pr.lessons[l.id] ? '+10 XP · ' + t('learn.marked') : '—');
    });
    I.qs('#cite-btn', host).addEventListener('click', function () {
      I.copyText('ឡាយ រតតនា, ច្បាប់សាធារណៈអន្តរជាតិ (២០២១), pp. ' +
        (l.pages ? l.pages.from + '–' + l.pages.to : '') + ' — ' + (l.title.km || ''));
    });
    I.qsa('[data-go]', host).forEach(function (b) {
      b.addEventListener('click', function () { showLesson(b.dataset.go); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
  }

  function panel(l, which) {
    if (which === 'overview') {
      return '<div class="grid cols-2">' +
        '<div><h3>' + esc(t('learn.objectives')) + '</h3>' +
        '<ul class="objective-list km">' + (I.state.lang === 'km' ? (l.objectives.km || []) : (l.objectives.en || [])).map(function (o) {
          return '<li>' + esc(o) + '</li>';
        }).join('') + '</ul></div>' +
        '<div><h3>' + esc(l.chapter.title.km) + '</h3>' +
        '<p class="km muted">' + esc(l.chapter.summary ? (I.state.lang === 'km' ? l.chapter.summary.km : l.chapter.summary.en) : '') + '</p>' +
        (l.summary ? '<p class="km">' + esc(I.state.lang === 'km' ? l.summary.km : l.summary.en) + '</p>' : '') +
        '<div class="callout small">' + esc(t('learn.flash')) + '</div></div></div>';
    }
    if (which === 'points') {
      const pts = (I.state.lang === 'km' ? l.keyPoints.km : l.keyPoints.en) || [];
      const other = (I.state.lang === 'km' ? l.keyPoints.en : l.keyPoints.km) || [];
      return '<ul class="point-list km">' + pts.map(function (p, i) {
        const alt = other[i] && I.state.lang !== 'both' ? '<div class="en small muted" style="margin-top:2px">' + esc(other[i]) + '</div>' : '';
        return '<li>' + esc(p) + alt + '</li>';
      }).join('') + '</ul>';
    }
    if (which === 'quotes') {
      return (l.quotes || []).map(function (q) {
        const en = q.en || '';
        return '<div class="quote">' + esc(q.km || en) +
          (en && en !== q.km ? '<span class="en">' + esc(en) + '</span>' : '') +
          '<span class="src">' + esc((q.srcLang === 'en' ? 'Paris Convention / ECCC Law' : 'ច្បាប់សាធារណៈអន្តរជាតិ')) +
          ' · ' + esc(t('common.page')) + ' ' + q.page + '</span></div>' +
          '<div class="cite-list" style="margin:-6px 0 14px"><button class="cite" data-copy="' +
          esc((q.km || en).replace(/"/g, '')) + '">' + esc(t('common.copy')) + '</button>' +
          '<a class="cite" href="chat.html?q=' + encodeURIComponent((q.km || en).slice(0, 60)) + '">' + esc(t('quiz.askbook')) + '</a></div>';
      }).join('');
    }
    if (which === 'terms') {
      return '<div class="term-grid">' + (l.terms || []).map(function (tm) {
        return '<div class="flip"><div class="flip-inner">' +
          '<div class="flip-face"><div class="tkm">' + esc(tm.km) + '</div>' +
          '<div class="ten">' + esc(tm.en || '') + '</div>' +
          '<div class="small muted">' + esc(t('learn.flash')) + '</div></div>' +
          '<div class="flip-face flip-back"><div>' + esc(I.state.lang === 'km' ? (tm.defKm || '') : (tm.defEn || '')) + '</div>' +
          (I.state.lang === 'km' && tm.defEn ? '<div class="en small muted">' + esc(tm.defEn) + '</div>' : '') +
          '</div></div></div>';
      }).join('') + '</div>';
    }
    if (which === 'notes') {
      const pr = I.getProgress();
      return '<h3>' + esc(t('common.notes')) + '</h3>' +
        '<textarea class="search km" id="notes-area" rows="8" placeholder="' + esc(t('common.notes.ph')) + '">' +
        esc(pr.notes[l.id] || '') + '</textarea>' +
        '<div class="small muted" style="margin-top:8px">' + esc('Saved automatically in this browser.') + '</div>';
    }
    return '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('learn.html');
    if (!D.lessons.length) {
      I.qs('#rail').innerHTML = '<div class="card">' + esc(t('common.loading')) + '</div>';
      return;
    }
    renderRail('');
    I.qs('#rail-search').addEventListener('input', function (e) { renderRail(e.target.value); });
    I.qs('#rail-search').setAttribute('placeholder', t('common.search'));
    const hash = location.hash.slice(1);
    showLesson(hash && D.lessonById(hash) ? hash : D.lessons[0].id);
    document.addEventListener('progress:changed', function () { renderRail(I.qs('#rail-search').value); });
    document.addEventListener('click', function (e) {
      const b = e.target.closest('[data-copy]');
      if (b) I.copyText(b.dataset.copy);
    });
    // command palette
    I.commandPalette(D.lessons.map(function (l) {
      return { kind: 'L' + l.chapter.num, text: I.pick(l.title), href: 'learn.html#' + l.id };
    }).concat(D.glossary.slice(0, 200).map(function (g) {
      return { kind: 'term', text: g.km + ' · ' + g.en, href: 'glossary.html#t=' + encodeURIComponent(g.km) };
    })));
  });
})();
