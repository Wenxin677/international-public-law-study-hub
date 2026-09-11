/* learn.js — the lesson player: objectives, key points, quotes, terms, notes */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA;
  const t = I.t, esc = I.esc, qs = I.qs;
  let current = null;

  function renderRail() {
    const p = I.getProgress();
    const host = qs('#rail');
    host.innerHTML = D.chapters.map(function (ch) {
      const open = current && current.chapter.id === ch.id ? ' open' : '';
      const items = ch.lessons.map(function (l) {
        const done = p.lessons[l.id] ? ' done' : '';
        const act = current && current.id === l.id ? ' active' : '';
        return '<a href="#' + l.id + '" class="' + (done + act).trim() + '"><span class="dot"></span><span>' +
          esc(I.pick(l.title)) + '</span></a>';
      }).join('');
      return '<div class="ch' + open + '" data-ch="' + ch.id + '">' +
        '<button data-toggle="' + ch.id + '" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="n">' + (ch.num || '•') + '</span>' +
        '<span style="flex:1">' + esc(I.pick(ch.title)) + '</span><span class="faint small">' + ch.lessons.length + '</span></button>' +
        '<div class="ls">' + items + '</div></div>';
    }).join('');
    I.qsa('[data-toggle]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        const box = qs('[data-ch="' + b.dataset.toggle + '"]', host);
        const isOpen = box.classList.toggle('open');
        b.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  function flipCard(term) {
    const def = I.state.lang === 'km' ? (term.defKm || term.defEn) : (term.defEn || term.defKm);
    const other = I.state.lang === 'km' ? (term.defEn || '') : (term.defKm || '');
    return '<div class="flip" role="button" tabindex="0" aria-pressed="false"><div class="inner"><div class="face"><b>' + esc(term.km) + '</b>' +
      '<span class="muted small">' + esc(term.en) + '</span></div>' +
      '<div class="face back">' + esc(I.truncate(def || '—', 300)) +
      (other && other !== def ? '<span class="faint small">' + esc(I.truncate(other, 160)) + '</span>' : '') +
      '</div></div></div>';
  }

  function render() {
    const l = current;
    const p = I.getProgress();
    const L = I.state.lang;
    const done = !!p.lessons[l.id];
    const objectives = (l.objectives && l.objectives[L]) || [];
    const points = (l.keyPoints && l.keyPoints[L]) || [];
    const quotes = (l.quotes || []).filter(Boolean);
    const terms = (l.terms || []).filter(function (x) { return x && x.km; });
    const idx = D.lessons.indexOf(l);
    const prev = D.lessons[idx - 1], next = D.lessons[idx + 1];

    qs('#lesson').innerHTML =
      '<div class="lesson-head">' +
      '<div style="flex:1;min-width:240px">' +
      '<div class="crumb"><a href="dashboard.html">' + esc(t('nav.dashboard')) + '</a> <span>›</span> <span>' + esc(I.pick(l.chapter.title)) + '</span></div>' +
      '<h1>' + esc(I.pick(l.title)) + '</h1>' +
      '<div class="row"><span class="pill">' + esc(t('learn.pages')) + ' ' + l.pages.from + '–' + l.pages.to + '</span>' +
      '<span class="pill gold">' + esc(l.chapter.num) + '. ' + esc(I.pick(l.chapter.title)) + '</span>' +
      (done ? '<span class="pill ok">' + esc(t('learn.marked')) + '</span>' : '') + '</div></div>' +
      '<div class="row" style="align-items:flex-start">' +
      '<button class="btn sm" id="mark-btn">' + (done ? '✓ ' + esc(t('learn.marked')) : '＋ ' + esc(t('learn.mark'))) + '</button>' +
      '<button class="btn sm" id="print-btn">🖨 ' + esc(t('learn.print')) + '</button>' +
      '</div></div>' +

      '<div class="lesson-block"><h2>' + esc(t('learn.objectives')) + '</h2>' +
      (objectives.length ? '<ul class="point-list">' + objectives.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>'
        : '<div class="muted small">—</div>') + '</div>' +

      '<div class="lesson-block"><h2>' + esc(t('learn.keypoints')) + '</h2>' +
      (points.length ? '<ul class="point-list">' + points.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>'
        : '<div class="muted small">—</div>') + '</div>' +

      (quotes.length ? '<div class="lesson-block"><h2>' + esc(t('learn.quotes')) + '</h2>' +
        quotes.map(function (q) {
          const text = L === 'km' ? q.km : (q.en || q.km);
          return '<div class="quote">' + esc(text) +
            '<span class="src">' + esc(q.srcLang === 'en' ? (I.state.lang === 'km' ? 'ឯកសារយោង' : 'Reference document') : (I.state.lang === 'km' ? 'សៀវភៅសិក្សា' : 'Textbook')) +
            ' · ' + esc(t('quiz.page')) + ' ' + q.page + '</span>' +
            '<div class="cite-list">' +
            '<a class="cite" href="library.html#' + (q.srcLang === 'en' ? (q.page <= 20 ? 'eccc=' : 'paris=') : 'textbook=') + q.page + '">📖 ' + esc(t('learn.readsource')) + '</a>' +
            '<button class="cite" data-copy="' + esc(text) + '">⧉ ' + esc(t('learn.copy')) + '</button>' +
            '</div></div>';
        }).join('') + '</div>' : '') +

      (terms.length ? '<div class="lesson-block"><h2>' + esc(t('learn.terms')) + '</h2>' +
        '<div class="small faint" style="margin-bottom:10px">' + esc(t('learn.flash')) + '</div>' +
        '<div class="flip-grid">' + terms.map(flipCard).join('') + '</div></div>' : '') +

      '<div class="lesson-block"><h2>' + esc(t('learn.notes')) + '</h2>' +
      '<textarea class="input notes-area" id="notes" aria-label="' + esc(t('learn.notes')) + '" placeholder="' + esc(t('learn.notes.ph')) + '">' + esc(I.getNotes(l.id)) + '</textarea>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm" id="save-notes">' + esc(t('common.save')) + '</button>' +
      '<span class="small faint" id="notes-state"></span></div></div>' +

      '<div class="lesson-block"><h2>' + esc(I.state.lang === 'km' ? 'បន្តទៀត' : 'Keep going') + '</h2>' +
      '<div class="row">' +
      '<a class="btn primary" href="quiz.html#lesson=' + l.id + '">🎯 ' + esc(t('learn.quiz')) + '</a>' +
      '<a class="btn gold" href="teacher.html?q=' + encodeURIComponent(I.pick(l.title)) + '">🤖 ' + esc(t('learn.ask')) + '</a>' +
      '</div></div>' +

      '<div class="lesson-nav">' +
      (prev ? '<a class="btn" href="#' + prev.id + '">← ' + esc(t('learn.prev')) + '<br><span class="small faint">' + esc(I.truncate(I.pick(prev.title), 34)) + '</span></a>' : '<span></span>') +
      (next ? '<a class="btn" href="#' + next.id + '" style="text-align:right">' + esc(t('learn.next')) + ' →<br><span class="small faint">' + esc(I.truncate(I.pick(next.title), 34)) + '</span></a>' : '<span></span>') +
      '</div>';

    I.qsa('.flip', qs('#lesson')).forEach(function (f) {
      const toggle = function () {
        const on = f.classList.toggle('on');
        f.setAttribute('aria-pressed', on ? 'true' : 'false');
      };
      f.addEventListener('click', toggle);
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggle(); }
      });
    });
    I.qsa('[data-copy]', qs('#lesson')).forEach(function (b) {
      b.addEventListener('click', function () { I.copyText(b.dataset.copy); });
    });
    qs('#mark-btn').addEventListener('click', function () {
      I.markStudied(l.id);
      I.toast(t('learn.saved'));
      renderRail();
      render();
    });
    qs('#print-btn').addEventListener('click', function () { window.print(); });
    qs('#save-notes').addEventListener('click', function () {
      I.setNotes(l.id, qs('#notes').value.trim());
      qs('#notes-state').textContent = t('learn.saved');
      setTimeout(function () { qs('#notes-state').textContent = ''; }, 1800);
    });
    document.title = I.pick(l.title) + ' · RoboCL';
  }

  function show(id) {
    const l = D.lessonById(id) || D.lessons[0];
    if (!l) return;
    current = l;
    renderRail();
    render();
    qs('#rail-wrap').classList.remove('open');
    const rt = qs('#rail-toggle');
    if (rt) rt.setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('learn.html');
    const m = location.hash.replace('#', '') || I.getProgress().lastLesson || (D.lessons[0] || {}).id;
    show(m);
    window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });
    const rb = qs('#rail-toggle');
    if (rb) {
      rb.setAttribute('aria-expanded', 'false');
      rb.setAttribute('aria-controls', 'rail-wrap');
      rb.addEventListener('click', function () {
        const open = qs('#rail-wrap').classList.toggle('open');
        rb.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    if (D.lessons.length) {
      I.commandPalette(function () {
        return D.lessons.map(function (l) {
          return { kind: I.t('quiz.lesson'), text: I.pick(l.title), href: '#' + l.id };
        });
      });
    }
  });
})();
