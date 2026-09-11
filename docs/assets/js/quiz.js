/* quiz.js — setup, question loop, results and review */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA;
  const t = I.t, esc = I.esc, qs = I.qs;

  const run = { list: [], i: 0, right: 0, wrong: [], id: '', answered: false, timed: false };

  /* ------------------------------------------------------------- setup */
  function setup() {
    const host = qs('#setup');
    const filter = qs('#qsearch').value.trim().toLowerCase();
    const chs = D.chapters.filter(function (c) {
      if (!filter) return true;
      return I.pick(c.title).toLowerCase().indexOf(filter) >= 0;
    });
    host.innerHTML =
      '<div class="card hoverable" data-mixed style="cursor:pointer;background:linear-gradient(135deg,rgba(111,155,240,.18),rgba(232,180,74,.14))">' +
      '<div class="row"><div class="av" style="font-size:1.3rem">🎲</div><div style="flex:1">' +
      '<h3 style="margin:0 0 4px">' + esc(t('quiz.mixed')) + '</h3>' +
      '<div class="muted small">' + esc(t('quiz.mixed.d')) + '</div></div><span class="pill gold">10</span></div></div>' +
      chs.map(function (ch) {
        const n = D.quizForChapter(ch.id).length;
        return '<div class="card hoverable quiz-setup" data-ch="' + ch.id + '">' +
          '<div class="row"><span class="badge-num">' + ch.num + '</span><div style="flex:1;min-width:0">' +
          '<b>' + esc(I.pick(ch.title)) + '</b>' +
          '<div class="muted small">' + ch.lessons.length + ' ' + esc(t('quiz.lesson')) + ' · p.' + ch.pages.from + '–' + ch.pages.to + '</div>' +
          '</div><span class="pill">' + n + ' ' + esc(t('quiz.title')) + '</span></div>' +
          '<div class="lesson-strip" style="margin-top:12px">' +
          ch.lessons.map(function (l) {
            return '<button class="btn sm" data-ls="' + l.id + '">' + esc(I.truncate(I.pick(l.title), 30)) + '</button>';
          }).join('') +
          '</div></div>';
      }).join('');
    host.classList.add('grid', 'g2');

    I.qsa('[data-mixed]', host).forEach(function (n) {
      n.addEventListener('click', function () { start('mixed'); });
    });
    I.qsa('[data-ch]', host).forEach(function (n) {
      n.addEventListener('click', function (e) {
        if (e.target.closest('[data-ls]')) return;
        start('ch:' + n.dataset.ch);
      });
    });
    I.qsa('[data-ls]', host).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); start('ls:' + b.dataset.ls); });
    });
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  }

  function start(id) {
    let items = [];
    if (id === 'mixed') items = shuffle(D.allQuestions().slice()).slice(0, 10);
    else if (id.indexOf('ch:') === 0) items = shuffle(D.quizForChapter(id.slice(3)).slice()).slice(0, 12);
    else if (id.indexOf('ls:') === 0) items = D.quizForLesson(id.slice(3)).map(function (q, i) { return { q: q, lesson: D.lessonById(id.slice(3)), index: i }; });
    if (!items.length) { I.toast(t('quiz.noquiz')); return; }
    /* Shuffle a COPY of the options per run: the canonical question objects in
       IPL_DATA must never be rewritten in place. */
    items.forEach(function (it) {
      const q = it.q;
      const km = (q.options && q.options.km) || [];
      const en = (q.options && q.options.en) || [];
      const pairs = [];
      km.forEach(function (o, i) { pairs.push({ km: o, en: en[i] || '', right: i === q.answer }); });
      shuffle(pairs);
      it.opts = { km: pairs.map(function (p) { return p.km; }), en: pairs.map(function (p) { return p.en; }) };
      it.answer = pairs.findIndex(function (p) { return p.right; });
    });
    run.list = items; run.i = 0; run.right = 0; run.wrong = []; run.id = id; run.answered = false;
    qs('#setup-wrap').hidden = true;
    qs('#run-wrap').hidden = false;
    qs('#result-wrap').hidden = true;
    question();
  }

  /* ------------------------------------------------------------- questions */
  function question() {
    const it = run.list[run.i];
    const q = it.q;
    const L = I.state.lang;
    const src = it.opts || (q.options || {});
    const opts = src[L] || src.en || src.km || [];
    run.answered = false;
    qs('#run-wrap').innerHTML =
      '<div class="q-card">' +
      '<div class="q-top">' +
      '<span class="pill">' + esc(t('quiz.question')) + ' ' + (run.i + 1) + ' ' + esc(t('quiz.of')) + ' ' + run.list.length + '</span>' +
      '<span class="pill gold">' + esc(I.truncate(I.pick(it.lesson.title), 40)) + '</span>' +
      '<span class="spacer"></span><button class="btn sm ghost" id="quit">✕ ' + esc(t('common.close')) + '</button>' +
      '</div>' +
      '<div class="q-bar"><i style="width:' + ((run.i) / run.list.length * 100) + '%"></i></div>' +
      '<div class="q-text">' + I.T(q.q) + '</div>' +
      '<div class="options" id="opts">' +
      opts.map(function (o, i) {
        return '<button class="option" data-opt="' + i + '"><span class="key">' + (i + 1) + '</span><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>' +
      '<div id="fb" aria-live="polite"></div>' +
      '<div class="row" style="margin-top:16px"><span class="spacer"></span>' +
      '<button class="btn primary" id="next" disabled>' + (run.i === run.list.length - 1 ? esc(t('quiz.finish')) : esc(t('quiz.next'))) + '</button></div>' +
      '</div>';
    qs('#quit').addEventListener('click', backToSetup);
    I.qsa('#opts .option').forEach(function (b) {
      b.addEventListener('click', function () { answer(+b.dataset.opt); });
    });
    qs('#next').addEventListener('click', function () {
      if (run.i === run.list.length - 1) result();
      else { run.i++; question(); }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function answer(choice) {
    if (run.answered) return;
    run.answered = true;
    const it = run.list[run.i], q = it.q;
    const L = I.state.lang;
    const btns = I.qsa('#opts .option');
    const right = (it.answer != null ? it.answer : q.answer);
    btns.forEach(function (b) { b.disabled = true; });
    if (choice === right) {
      btns[choice].classList.add('correct');
      run.right++;
    } else {
      btns[choice].classList.add('wrong');
      btns[right].classList.add('reveal');
      run.wrong.push({ lesson: it.lesson, q: q, chosen: choice });
    }
    const page = q.page ? ' <a class="cite" href="library.html#textbook=' + q.page + '">📖 ' + esc(t('quiz.page')) + ' ' + q.page + '</a>' : '';
    qs('#fb').innerHTML = '<div class="explain">' +
      '<b style="color:' + (choice === right ? 'var(--ok)' : 'var(--bad)') + '">' +
      esc(choice === right ? '✓ ' + t('quiz.correct') : '✕ ' + t('quiz.wrong')) + '</b>' +
      '<div style="margin-top:8px"><b>' + esc(t('quiz.explain')) + ':</b> ' + I.T(q.explain || '') + '</div>' +
      '<div class="cite-list" style="margin-top:10px">' + page +
      '<a class="cite" href="teacher.html?q=' + encodeURIComponent(qs('.q-text').textContent.trim()) + '">🤖 ' + esc(t('quiz.ask')) + '</a>' +
      '<a class="cite" href="learn.html#' + it.lesson.id + '">📘 ' + esc(I.truncate(I.pick(it.lesson.title), 34)) + '</a>' +
      '</div></div>';
    qs('#next').disabled = false;
    qs('#next').focus();
  }

  /* ------------------------------------------------------------- result */
  function result() {
    const total = run.list.length;
    const pct = Math.round((run.right / total) * 100);
    const saved = I.saveQuizResult(run.id, run.right, total, run.wrong.map(function (w) { return w.q; }));
    /* XP for a run is paid once, and only when the record improves, so replaying
       the same quiz cannot farm rank */
    const bonus = saved.better ? (run.right * 4 + 6) : 0;
    if (bonus) I.addXP(bonus);
    const earned = saved.gained + bonus;
    qs('#run-wrap').hidden = true;
    qs('#result-wrap').hidden = false;
    const msg = pct >= 90 ? t('quiz.perfect') : (pct >= 60 ? t('quiz.good') : t('quiz.keep'));
    qs('#result-wrap').innerHTML =
      '<div class="q-card card">' +
      '<div class="result-hero"><div class="result-ring" style="--p:' + pct + '"><i>' + run.right + '/' + total + '</i></div>' +
      '<h2 style="margin:0">' + pct + '%</h2>' +
      '<div class="muted">' + esc(msg) + '</div>' +
      (saved.better ? '<div class="pill ok" style="margin-top:10px">★ ' + esc(t('quiz.best')) + ' ' + run.right + '/' + total + '</div>' : '') +
      (earned ? '<div class="pill gold" style="margin-top:10px">+' + earned + ' XP</div>'
        : '<div class="muted small" style="margin-top:10px">' + esc(t('quiz.repeat')) + '</div>') +
      '</div>' +
      '<div class="row" style="justify-content:center;margin-bottom:18px">' +
      '<button class="btn primary" id="again">↻ ' + esc(t('quiz.again')) + '</button>' +
      '<a class="btn" href="dashboard.html">🏠 ' + esc(t('nav.dashboard')) + '</a>' +
      '<a class="btn gold" href="teacher.html">🤖 ' + esc(t('nav.teacher')) + '</a>' +
      '</div>' +
      (run.wrong.length ? '<h3>' + esc(t('quiz.review')) + '</h3>' + run.wrong.map(function (w) {
        const L = I.state.lang;
        const opts = (w.q.options && (w.q.options[L] || []) ) || [];
        return '<div class="card" style="margin-bottom:12px">' +
          '<b>' + esc(I.pick(w.lesson.title)) + '</b>' +
          '<div style="margin:8px 0">' + I.T(w.q.q) + '</div>' +
          '<div class="notice ok" style="margin:0">✓ ' + esc(opts[w.q.answer] || '') + '</div>' +
          '<div class="small muted" style="margin-top:8px">' + I.T(w.q.explain || '') + '</div>' +
          (w.q.page ? '<div class="cite-list" style="margin-top:8px"><a class="cite" href="library.html#textbook=' + w.q.page + '">📖 p.' + w.q.page + '</a>' +
            '<a class="cite" href="learn.html#' + w.lesson.id + '">📘 ' + esc(t('learn.title')) + '</a></div>' : '') +
          '</div>';
      }).join('') : '') +
      '</div>';
    qs('#again').addEventListener('click', function () { start(run.id); });
  }

  function backToSetup() {
    qs('#run-wrap').hidden = true;
    qs('#result-wrap').hidden = true;
    qs('#setup-wrap').hidden = false;
    setup();
  }

  /* ------------------------------------------------------------- init */
  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('quiz.html');
    setup();
    qs('#qsearch').setAttribute('aria-label', t('common.search'));
    qs('#qsearch').addEventListener('input', setup);
    const m = location.hash.match(/(?:#|&)(lesson|chapter)=([^&]+)/);
    if (m) {
      const id = m[1] === 'lesson' ? 'ls:' + m[2] : 'ch:' + m[2];
      setTimeout(function () { start(id); }, 120);
    }
    document.addEventListener('keydown', function (e) {
      if (qs('#run-wrap').hidden) return;
      if (/^[1-4]$/.test(e.key)) {
        const b = I.qsa('#opts .option')[+e.key - 1];
        if (b && !b.disabled) b.click();
      } else if (e.key === 'Enter') {
        const n = qs('#next');
        if (n && !n.disabled) n.click();
      }
    });
  });
})();
