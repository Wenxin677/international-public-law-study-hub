/* ==========================================================================
   quiz.js — lesson/chapter quizzes with instant feedback and citations
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA;
  const t = I.t, esc = I.esc;

  const S = { items: [], i: 0, right: 0, wrong: [], mode: 'lesson', id: null, answered: false };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  /* build a runnable question with shuffled options (answer index tracked) */
  function prepare(q, lesson) {
    const lang = I.state.lang === 'km' ? 'km' : 'en';
    const optsKm = (q.options && (q.options.km || q.options.en)) || [];
    const optsEn = (q.options && (q.options.en || q.options.km)) || [];
    const n = Math.max(optsKm.length, optsEn.length);
    const idx = shuffle(Array.from({ length: n }, function (_, i) { return i; }));
    const correctPos = idx.indexOf(q.answer == null ? 0 : q.answer);
    return {
      lesson: lesson, raw: q,
      q: q.q || {}, explain: q.explain || {}, page: q.page,
      options: idx.map(function (o) {
        return { km: optsKm[o] || optsEn[o] || '', en: optsEn[o] || optsKm[o] || '' };
      }),
      correctPos: correctPos < 0 ? 0 : correctPos
    };
  }

  function start(mode, id) {
    S.mode = mode; S.id = id; S.i = 0; S.right = 0; S.wrong = []; S.answered = false;
    let raw = [];
    if (mode === 'lesson') {
      const l = D.lessonById(id);
      raw = (l ? l.quiz : []).map(function (q) { return { q: q, lesson: l }; });
    } else if (mode === 'chapter') {
      raw = D.quizForChapter(id);
    } else {
      raw = shuffle(D.allQuestions()).slice(0, 10);
    }
    S.items = shuffle(raw).map(function (r) { return prepare(r.q, r.lesson); });
    if (!S.items.length) { I.qs('#quiz-host').innerHTML = '<div class="card">' + esc(t('quiz.noquiz')) + '</div>'; return; }
    render();
  }

  function render() {
    const host = I.qs('#quiz-host');
    const it = S.items[S.i];
    const pct = Math.round((S.i / S.items.length) * 100);
    host.innerHTML =
      '<div class="quiz-head">' +
      '<span class="pill gold">' + esc(S.mode === 'lesson' ? I.pick(it.lesson.title) : (S.mode === 'chapter' ? it.lesson.chapter.title.km : t('quiz.title'))) + '</span>' +
      '<span class="small muted">' + esc(t('quiz.question') + ' ' + (S.i + 1) + ' ' + t('quiz.of') + ' ' + S.items.length) + '</span>' +
      '<div class="progress"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="q-text">' + I.bilingual(it.q) + '</div>' +
      '<div class="options" id="opts">' + it.options.map(function (o, i) {
        const body = I.state.lang === 'both'
          ? esc(o.km) + '<span class="en small muted" style="display:block">' + esc(o.en) + '</span>'
          : esc(I.state.lang === 'km' ? o.km : o.en);
        return '<button class="option" data-opt="' + i + '"><span class="key">' + (i + 1) + '</span><span>' + body + '</span></button>';
      }).join('') + '</div>' +
      '<div id="feedback"></div>';
  }

  function answer(pos) {
    if (S.answered) return;
    S.answered = true;
    const it = S.items[S.i];
    const ok = pos === it.correctPos;
    const opts = I.qsa('#opts .option');
    opts.forEach(function (o, i) {
      o.disabled = true;
      if (i === it.correctPos) o.classList.add('correct');
      else if (i === pos) o.classList.add('wrong');
    });
    if (ok) { S.right++; I.addXP(5); } else { S.wrong.push({ it: it, pick: pos }); }
    const fb = I.qs('#feedback');
    fb.innerHTML = '<div class="explain">' +
      '<b style="color:' + (ok ? 'var(--ok)' : 'var(--bad)') + '">' + esc(ok ? t('quiz.correct') : t('quiz.wrong')) + '</b>' +
      I.bilingual(it.explain) +
      '<div class="cite-list" style="margin-top:10px">' +
      (it.page ? '<span class="cite">' + esc(t('quiz.page')) + ' ' + it.page + '</span>' : '') +
      '<a class="cite" href="learn.html#' + it.lesson.id + '">' + esc(I.pick(it.lesson.title)) + '</a>' +
      '<a class="cite" href="chat.html?q=' + encodeURIComponent((I.pick(it.q) || '').slice(0, 70)) + '">' + esc(t('quiz.askbook')) + '</a>' +
      '</div></div>' +
      '<div style="margin-top:14px"><button class="btn primary" id="next-btn" data-next="1">' +
      esc(S.i + 1 >= S.items.length ? t('quiz.finish') : t('quiz.next')) + '</button></div>';
  }

  function next() {
    S.answered = false;
    S.i++;
    if (S.i >= S.items.length) finish(); else render();
  }

  function finish() {
    const host = I.qs('#quiz-host');
    const total = S.items.length;
    const pct = Math.round((S.right / total) * 100);
    const key = (S.mode === 'lesson' ? 'l:' : 'c:') + S.id;
    const p = I.getProgress();
    const prev = p.quiz[key] || { best: 0, total: total };
    p.quiz[key] = { best: Math.max(prev.best || 0, pct), total: total, ts: Date.now(), wrong: S.wrong.length };
    I.saveProgress(p);
    I.addXP(S.right * 2);
    const circumference = 2 * Math.PI * 58;
    host.innerHTML =
      '<div class="card pad-lg" style="text-align:center">' +
      '<div class="score-ring" style="background:conic-gradient(var(--gold) ' + (pct * 3.6) + 'deg, var(--line-soft) 0)">' +
      '<div style="width:104px;height:104px;border-radius:50%;background:var(--card);display:grid;place-items:center">' +
      '<b>' + pct + '%</b></div></div>' +
      '<h2 style="margin-top:16px" class="km">' + esc(t('quiz.score') + ': ' + S.right + '/' + total) + '</h2>' +
      '<p class="muted">' + esc(t('quiz.average') + ': ' + (p.quiz[key].best || 0) + '%') + '</p>' +
      '<div class="grid cols-2" style="margin-top:18px;text-align:left">' +
      '<div><h3>' + esc(t('quiz.review')) + '</h3>' +
      (S.wrong.length ? S.wrong.map(function (w) {
        return '<div class="review-row"><span class="pill bad">✕</span><div><div class="km">' + esc(I.pick(w.it.q)) + '</div>' +
          '<div class="small muted">' + esc(t('quiz.answer')) + ': ' + esc(I.pick(w.it.options[w.it.correctPos])) +
          (w.it.page ? ' · ' + esc(t('quiz.page')) + ' ' + w.it.page : '') + '</div></div></div>';
      }).join('') : '<p class="muted">' + esc('—') + '</p>') +
      '</div><div>' +
      '<button class="btn primary" id="again-btn" data-again="1">' + esc(t('quiz.retry')) + '</button> ' +
      '<a class="btn" href="' + (S.mode === 'lesson' ? 'learn.html#' + S.id : 'quiz.html') + '">' +
      esc(S.mode === 'lesson' ? I.pick((D.lessonById(S.id) || {}).title || {}) : t('quiz.title')) + '</a>' +
      '</div></div></div>';
  }

  /* ---------- delegated clicks: survive re-renders ---------- */
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-lesson],[data-chapter],[data-mixed],[data-opt],[data-next],[data-again]');
    if (!t) return;
    if (t.dataset.lesson && !t.disabled) start('lesson', t.dataset.lesson);
    else if (t.dataset.chapter && !t.disabled) start('chapter', t.dataset.chapter);
    else if (t.dataset.mixed && !t.disabled) start('mixed', 'all');
    else if (t.dataset.opt != null && !t.disabled) answer(parseInt(t.dataset.opt, 10));
    else if (t.dataset.next != null && !t.disabled) next();
    else if (t.dataset.again != null && !t.disabled) start(S.mode, S.id);
  });

  function menu() {
    const host = I.qs('#quiz-host');
    host.innerHTML = '<div class="card pad-lg"><h3>' + esc(t('quiz.choose')) + '</h3>' +
      '<div class="grid cols-2">' +
      D.chapters.map(function (ch) {
        const n = ch.lessons.reduce(function (a, l) { return a + l.quiz.length; }, 0);
        if (!n) return '';
        return '<div class="card"><div class="small muted">' + esc(ch.title.en) + '</div>' +
          '<h4 class="km">' + esc(ch.title.km) + '</h4>' +
          '<div class="small muted">' + n + ' ' + esc(t('stat.questions')) + '</div>' +
          '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn sm primary" data-chapter="' + ch.id + '">' + esc(t('quiz.start')) + ' (chapter)</button>' +
          ch.lessons.filter(function (l) { return l.quiz.length; }).map(function (l) {
            return '<button class="btn sm" data-lesson="' + l.id + '">' + esc(I.pick(l.title)) + '</button>';
          }).join('') +
          '</div></div>';
      }).join('') +
      '<div class="card"><div class="small muted">mixed</div><h4>' + esc(t('quiz.title')) + ' — 10</h4>' +
      '<button class="btn sm primary" data-mixed="1">' + esc(t('quiz.start')) + '</button></div>' +
      '</div></div>';
  }

  window.IPLQuiz = { start: start, menu: menu, state: S, answer: answer, next: next, prepare: prepare };

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('quiz.html');
    const hash = location.hash.slice(1);
    if (hash.indexOf('lesson=') === 0) start('lesson', hash.slice(7));
    else if (hash.indexOf('chapter=') === 0) start('chapter', hash.slice(8));
    else menu();
    document.addEventListener('keydown', function (e) {
      if (!S.items.length) return;
      if (e.key >= '1' && e.key <= '4') {
        const b = I.qsa('#opts .option')[parseInt(e.key, 10) - 1];
        if (b && !b.disabled) b.click();
      } else if (e.key === 'Enter') {
        const n = I.qs('#next-btn'); if (n) n.click();
      }
    });
    I.commandPalette(D.lessons.filter(function (l) { return l.quiz.length; }).map(function (l) {
      return { kind: 'quiz', text: I.pick(l.title), href: 'quiz.html#lesson=' + l.id };
    }));
  });
})();
