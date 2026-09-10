/* ==========================================================================
   home.js — landing page: stats, continue-where-you-left-off, progress
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA;
  const t = I.t, esc = I.esc;

  function paintStats() {
    const s = D.stats;
    const host = I.qs('#stats');
    host.innerHTML = [
      ['stat.pages', s.pages], ['stat.chapters', s.chapters], ['stat.lessons', s.lessons],
      ['stat.questions', s.questions], ['stat.terms', s.terms]
    ].map(function (x) {
      return '<div class="stat"><b>' + x[1] + '</b><span>' + esc(t(x[0])) + '</span></div>';
    }).join('');
  }

  function paintProgress() {
    const p = I.getProgress();
    const total = D.lessons.length || 1;
    const done = Object.keys(p.lessons).length;
    const pct = Math.round((done / total) * 100);
    const r = I.rankFor(p.xp || 0);
    const quizzes = Object.keys(p.quiz).length;
    const avg = quizzes ? Math.round(Object.keys(p.quiz).reduce(function (a, k) {
      return a + (p.quiz[k].best || 0);
    }, 0) / quizzes) : 0;
    I.qs('#progress-card').innerHTML =
      '<h3>' + esc(t('progress.title')) + '</h3>' +
      '<div class="progress" style="margin:10px 0"><i style="width:' + pct + '%"></i></div>' +
      '<div class="grid cols-2">' +
      '<div class="stat"><b>' + done + '/' + total + '</b><span>' + esc(t('progress.lessons')) + '</span></div>' +
      '<div class="stat"><b>' + (p.xp || 0) + '</b><span>' + esc(t('progress.xp')) + '</span></div>' +
      '<div class="stat"><b>' + esc(I.state.lang === 'km' ? r.km : r.en) + '</b><span>' + esc(t('progress.rank')) + '</span></div>' +
      '<div class="stat"><b>' + avg + '%</b><span>' + esc(t('quiz.average')) + '</span></div>' +
      '</div>' +
      '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<a class="btn primary" href="learn.html#' + nextLessonId() + '">' + esc(t('hero.cta.learn')) + '</a>' +
      '<button class="btn ghost sm" id="reset-btn">' + esc(t('progress.reset')) + '</button></div>';
    I.qs('#reset-btn').addEventListener('click', function () {
      if (confirm('Reset all local progress?')) { localStorage.removeItem(I.STORE.progress); paintProgress(); }
    });
  }

  function nextLessonId() {
    const p = I.getProgress();
    const next = D.lessons.filter(function (l) { return !p.lessons[l.id]; })[0];
    return (next || D.lessons[0] || { id: 'ch1-l1' }).id;
  }

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('index.html');
    paintStats();
    paintProgress();
    paintChapterStrip();
    document.addEventListener('progress:changed', paintProgress);
    I.commandPalette(D.lessons.map(function (l) {
      return { kind: 'L' + l.chapter.num, text: I.pick(l.title), href: 'learn.html#' + l.id };
    }).concat(D.glossary.slice(0, 200).map(function (g) {
      return { kind: 'term', text: g.km + ' · ' + (g.en || ''), href: 'glossary.html#t=' + encodeURIComponent(g.km) };
    })));
  });

  function paintChapterStrip() {
    const host = I.qs('#chapter-strip');
    if (!host) return;
    host.innerHTML = D.chapters.map(function (ch) {
      return '<a class="card mode-card" href="learn.html#' + (ch.lessons[0] ? ch.lessons[0].id : '') + '" style="text-decoration:none;color:inherit">' +
        '<div class="small muted">' + esc(ch.title.en || '') + '</div>' +
        '<h3 class="km" style="font-size:18px">' + esc((ch.num > 0 ? ch.num + '. ' : '') + (ch.title.km || '')) + '</h3>' +
        '<div class="small muted">' + ch.lessons.length + ' ' + esc(t('stat.lessons')) +
        (ch.pages ? ' · p.' + ch.pages.from + '–' + ch.pages.to : '') + '</div></a>';
    }).join('');
  }
})();
