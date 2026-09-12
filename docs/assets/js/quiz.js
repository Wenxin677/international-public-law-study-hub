/* quiz.js — choose a quiz, answer one question at a time, then a results screen

   Structure the student sees
     1. pick a quiz      — one clean list (mixed, or a chapter you open)
     2. the questions    — one at a time, "Question X of Y" + a progress bar,
                           answers as cards, Next only once you have chosen
     3. the results      — score ring, correct/wrong counts, then what you missed
   Everything is rendered from IPL_DATA, so a question only ever has to be added
   to the lesson JSON.
*/
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA;
  const t = I.t, esc = I.esc, qs = I.qs;

  const run = { list: [], i: 0, right: 0, wrong: [], id: '', answered: false };

  /* ------------------------------------------------------------- setup */
  function setup() {
    const host = qs('#setup');
    if (!host) return;
    const km = I.state.lang === 'km';
    host.innerHTML =
      '<div class="quiz-pick">' +
        '<button class="qset mixed" id="mixed-btn" type="button">' +
          '<span class="qset-head">🎲 <span>' + esc(t('quiz.mixed')) +
          '<span class="sub">' + esc(t('quiz.mixed.d')) + '</span></span>' +
          '<span class="pill">10</span></span>' +
        '</button>' +
        D.chapters.map(function (ch) {
          const n = D.quizForChapter(ch.id).length;
          return '<details class="qset" data-ch="' + ch.id + '">' +
            '<summary><span class="n">' + esc(String(ch.num)) + '</span>' +
              '<span>' + esc(I.pick(ch.title)) +
              '<span class="small muted" style="display:block;font-weight:500">' + ch.lessons.length + ' ' +
              esc(t('quiz.lesson')) + ' · ' + n + ' ' + esc(t('quiz.title')) + '</span></span></summary>' +
            '<div class="ls-body">' +
              '<button type="button" data-ch-all="' + ch.id + '">▸ ' + esc(t('quiz.wholeChapter')) + ' · ' + n + '</button>' +
              ch.lessons.map(function (l) {
                return '<button type="button" data-ls="' + l.id + '">' + esc(I.truncate(I.pick(l.title), 46)) + '</button>';
              }).join('') +
            '</div></details>';
        }).join('') +
      '</div>';

    qs('#mixed-btn').addEventListener('click', function () { start('mixed'); });
    I.qsa('[data-ch-all]', host).forEach(function (b) {
      b.addEventListener('click', function () { start('ch:' + b.dataset.chAll); });
    });
    I.qsa('[data-ls]', host).forEach(function (b) {
      b.addEventListener('click', function () { start('ls:' + b.dataset.ls); });
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
    document.body.classList.add('quiz-mode');
    qs('#setup-wrap').hidden = true;
    qs('#result-wrap').hidden = true;
    qs('#run-wrap').hidden = false;
    question();
  }

  /* ------------------------------------------------------------- questions */
  function question() {
    const it = run.list[run.i];
    const L = I.state.lang;
    const src = it.opts || (it.q.options || {});
    const opts = src[L] || src.en || src.km || [];
    const last = run.i === run.list.length - 1;
    run.answered = false;
    qs('#run-wrap').innerHTML =
      '<div class="qwrap">' +
        '<div class="qhead">' +
          '<span class="pill">' + esc(t('quiz.question')) + ' <b>' + (run.i + 1) + '</b> ' +
            esc(t('quiz.of')) + ' ' + run.list.length + '</span>' +
          '<span class="pill gold">' + esc(I.truncate(I.pick(it.lesson.title), 40)) + '</span>' +
          '<button class="btn sm ghost quit" id="quit" type="button">✕ ' + esc(t('common.close')) + '</button>' +
        '</div>' +
        '<div class="sec-bar"><i style="width:' + Math.round((run.i / run.list.length) * 100) + '%"></i></div>' +
        '<div class="q-card">' +
          '<div class="q-text">' + I.T(it.q.q) + '</div>' +
          '<div class="options" id="opts">' +
            opts.map(function (o, i) {
              return '<button class="option" type="button" data-opt="' + i + '">' +
                '<span class="key">' + (i + 1) + '</span><span>' + esc(o) + '</span></button>';
            }).join('') +
          '</div>' +
          '<div id="fb" aria-live="polite"></div>' +
          '<div class="qfoot"><span class="spacer"></span>' +
            '<button class="btn primary" id="next" type="button" disabled>' +
              (last ? esc(t('quiz.finish')) : esc(t('quiz.next'))) + ' →</button>' +
          '</div>' +
        '</div>' +
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
    const btns = I.qsa('#opts .option');
    const right = (it.answer != null ? it.answer : q.answer);
    btns.forEach(function (b) { b.disabled = true; });
    if (choice === right) {
      btns[choice].classList.add('correct');
      run.right++;
    } else {
      btns[choice].classList.add('wrong');
      btns[right].classList.add('reveal');
      run.wrong.push({ lesson: it.lesson, q: q, chosen: choice, answer: right });
    }
    const page = q.page ? ' <a class="cite" href="library.html#textbook=' + q.page + '">📖 ' + esc(t('quiz.page')) + ' ' + q.page + '</a>' : '';
    qs('#fb').innerHTML = '<div class="explain">' +
      '<b class="' + (choice === right ? 'ok-text' : 'bad-text') + '">' +
      esc(choice === right ? '✓ ' + t('quiz.correct') : '✕ ' + t('quiz.wrong')) + '</b>' +
      '<div style="margin-top:8px"><b>' + esc(t('quiz.explain')) + ':</b> ' + I.T(q.explain || '') + '</div>' +
      '<div class="cite-list" style="margin-top:10px">' + page +
      '<a class="cite" href="teacher.html?q=' + encodeURIComponent(qs('.q-text').textContent.trim()) + '">🤖 ' + esc(t('quiz.ask')) + '</a>' +
      '<a class="cite" href="learn.html#' + it.lesson.id + '">📘 ' + esc(I.truncate(I.pick(it.lesson.title), 34)) + '</a>' +
      '</div></div>';
    const n = qs('#next');
    n.disabled = false;
    n.focus();
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
    const L = I.state.lang;
    document.body.classList.remove('quiz-mode');
    qs('#run-wrap').hidden = true;
    qs('#result-wrap').hidden = false;
    const msg = pct >= 90 ? t('quiz.perfect') : (pct >= 60 ? t('quiz.good') : t('quiz.keep'));
    qs('#result-wrap').innerHTML =
      '<div class="qwrap">' +
        '<div class="q-card result">' +
          '<div class="result-hero">' +
            '<div class="result-ring" style="--p:' + pct + '"><i>' + run.right + '/' + total + '</i></div>' +
            '<h2 style="margin:8px 0 0;font-size:2.4rem">' + pct + '%</h2>' +
            '<div class="muted">' + esc(msg) + '</div>' +
          '</div>' +
          '<div class="result-facts">' +
            '<div class="fact ok"><b>' + run.right + '</b><span>' + esc(t('quiz.rightCount')) + '</span></div>' +
            '<div class="fact bad"><b>' + run.wrong.length + '</b><span>' + esc(t('quiz.wrongCount')) + '</span></div>' +
            '<div class="fact"><b>' + total + '</b><span>' + esc(t('quiz.questions')) + '</span></div>' +
            (earned ? '<div class="fact"><b>+' + earned + '</b><span>XP</span></div>' : '') +
          '</div>' +
          (saved.better ? '<div class="sec-row" style="justify-content:center;margin-bottom:14px">' +
            '<span class="pill ok">★ ' + esc(t('quiz.best')) + ' ' + run.right + '/' + total + '</span></div>'
            : '<div class="sec-row" style="justify-content:center;margin-bottom:14px"><span class="muted small">' +
              esc(t('quiz.repeat')) + '</span></div>') +
          '<div class="sec-row" style="justify-content:center">' +
            '<button class="btn primary" id="again" type="button">↻ ' + esc(t('quiz.again')) + '</button>' +
            '<a class="btn" href="dashboard.html">🏠 ' + esc(t('nav.dashboard')) + '</a>' +
            '<a class="btn gold" href="teacher.html">🤖 ' + esc(t('nav.teacher')) + '</a>' +
          '</div>' +
        '</div>' +
        (run.wrong.length
          ? '<details class="fold" open><summary>✕ ' + esc(t('quiz.review')) + ' (' + run.wrong.length + ')</summary>' +
            '<div class="fold-body">' + run.wrong.map(function (w) {
              const opts = (w.q.options && (w.q.options[L] || w.q.options.en || [])) || [];
              return '<div class="sec-card">' +
                '<b>' + esc(I.pick(w.lesson.title)) + '</b>' +
                '<div style="margin:8px 0">' + I.T(w.q.q) + '</div>' +
                '<div class="notice ok" style="margin:0">✓ ' + esc(opts[w.q.answer] || '') + '</div>' +
                '<div class="small muted" style="margin-top:8px">' + I.T(w.q.explain || '') + '</div>' +
                (w.q.page ? '<div class="cite-list" style="margin-top:8px">' +
                  '<a class="cite" href="library.html#textbook=' + w.q.page + '">📖 p.' + w.q.page + '</a>' +
                  '<a class="cite" href="learn.html#' + w.lesson.id + '">📘 ' + esc(t('learn.title')) + '</a></div>' : '') +
                '</div>';
            }).join('') + '</div></details>'
          : '<div class="sec-card"><b>✓ ' + esc(t('quiz.noWrong')) + '</b></div>') +
      '</div>';
    qs('#again').addEventListener('click', function () { start(run.id); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToSetup() {
    document.body.classList.remove('quiz-mode');
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
    const search = qs('#qsearch');
    if (search) {
      search.setAttribute('aria-label', t('common.search'));
      search.addEventListener('input', setup);
    }
    const m = location.hash.match(/(?:#|&)(lesson|chapter)=([^&]+)/);
    if (m) {
      const id = m[1] === 'lesson' ? 'ls:' + m[2] : 'ch:' + m[2];
      setTimeout(function () { start(id); }, 120);
    }
    document.addEventListener('keydown', function (e) {
      if (qs('#run-wrap').hidden) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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
