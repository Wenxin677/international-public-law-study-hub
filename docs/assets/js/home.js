/* home.js — the dashboard: progress at a glance, continue, chapters, quick actions */
(function () {
  'use strict';
  const I = window.IPL, D = window.IPL_DATA, A = window.IPLAuth;
  const t = I.t, esc = I.esc, qs = I.qs;

  function lessonState(l) {
    const p = I.getProgress();
    if (p.lessons[l.id]) return 'done';
    if (p.quiz[l.id]) return 'part';
    const i = D.lessons.indexOf(l);
    const before = D.lessons.slice(0, i).some(function (x) { return p.lessons[x.id]; });
    return before ? 'part' : 'todo';
  }

  function nextLesson() {
    const p = I.getProgress();
    const unread = D.lessons.filter(function (l) { return !p.lessons[l.id]; });
    if (unread.length) return unread[0];
    return D.lessons[D.lessons.length - 1];
  }

  function renderProgress() {
    const p = I.getProgress();
    const total = D.lessons.length;
    const done = D.lessons.filter(function (l) { return p.lessons[l.id]; }).length;
    const pct = Math.round((done / total) * 100);
    const rank = I.rankFor(p.xp || 0);
    let bestSum = 0, bestN = 0;
    Object.keys(p.quiz).forEach(function (k) {
      const q = p.quiz[k];
      if (q && q.total) { bestSum += (q.best / q.total) * 100; bestN++; }
    });
    const avg = bestN ? Math.round(bestSum / bestN) : 0;

    qs('#prog-card').innerHTML =
      '<h2 class="sec-head">' + esc(t('dash.progress')) + '</h2>' +
      '<div class="sec-row" style="align-items:center;gap:18px">' +
        '<div class="progress-ring" style="--p:' + pct + '"><i>' + pct + '%</i></div>' +
        '<div style="flex:1;min-width:150px">' +
          '<div class="muted small">' + done + ' / ' + total + ' ' + esc(t('dash.studied')) + '</div>' +
          '<div class="sec-row" style="margin-top:10px">' +
            '<span class="pill">🔥 ' + (p.streak || 0) + ' ' + esc(t('dash.streak')) + '</span>' +
            '<span class="pill gold">⭐ ' + (p.xp || 0) + ' XP</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    /* card 3: the one number worth showing on its own */
    const stat = qs('#stat-card');
    if (stat) {
      stat.innerHTML =
        '<h2 class="sec-head">' + esc(t('dash.avg')) + '</h2>' +
        '<div class="stat-big grad">' + (bestN ? avg + '%' : '—') + '</div>' +
        '<div class="muted small" style="margin-top:6px">' +
          esc(bestN ? t('dash.avgOf') + ' ' + bestN + ' ' + t('quiz.title') : t('dash.avgNone')) + '</div>' +
        '<div class="sec-row" style="margin-top:14px">' +
          '<a class="btn sm primary" href="quiz.html">🎯 ' + esc(t('quiz.title')) + '</a>' +
        '</div>';
    }
  }

  function renderContinue() {
    const l = nextLesson();
    const st = lessonState(l);
    const label = st === 'done' ? (I.state.lang === 'km' ? 'មេរៀនបន្ទាប់ដែលគួរអាន' : 'Next lesson for you') : t('dash.pickup');
    qs('#continue-card').innerHTML =
      '<h2 class="sec-head">' + esc(t('dash.continue')) + '</h2>' +
      '<span class="pill">' + esc(label) + '</span>' +
      '<h3 style="margin:12px 0 4px;font-size:1.2rem">' + esc(I.pick(l.title)) + '</h3>' +
      '<div class="muted small">' + esc(I.pick(l.chapter.title)) + ' · ' + esc(t('learn.pages')) +
        ' ' + l.pages.from + '–' + l.pages.to + ' · ' + (l.pages.to - l.pages.from + 1) + ' ' + esc(t('learn.slides')) + '</div>' +
      '<div class="sec-row" style="margin-top:14px">' +
        '<a class="btn primary" href="learn.html#' + l.id + '">📘 ' + esc(t('learn.title')) + '</a>' +
        '<a class="btn" href="quiz.html#lesson=' + l.id + '">🎯 ' + esc(t('quiz.title')) + '</a>' +
      '</div>';
  }

  function renderQuick() {
    const items = [
      ['learn.html', '📘', 'dash.q.learn'],
      ['quiz.html', '🎯', 'dash.q.quiz'],
      ['teacher.html', '🤖', 'dash.q.teacher'],
      ['library.html', '📚', 'dash.q.library']
    ];
    qs('#quick').innerHTML = items.map(function (x) {
      return '<a class="card hoverable" href="' + x[0] + '" style="display:flex;gap:12px;align-items:center;text-decoration:none">' +
        '<div class="av" style="font-size:1.2rem">' + x[1] + '</div><b>' + esc(t(x[2])) + '</b></a>';
    }).join('');
  }

  function renderChapters() {
    qs('#chapters').innerHTML = D.chapters.map(function (ch) {
      const dots = ch.lessons.map(function (l) {
        const s = lessonState(l);
        return '<span class="lesson-dot ' + (s === 'done' ? 'done' : (s === 'part' ? 'part' : '')) + '" title="' + esc(I.pick(l.title)) + '"></span>';
      }).join('');
      return '<a class="card hoverable chapter-card" href="learn.html#' + (ch.lessons[0] ? ch.lessons[0].id : '') + '" style="text-decoration:none;color:inherit">' +
        '<span class="n">' + (ch.num || '•') + '</span>' +
        '<span style="flex:1;min-width:0">' +
        '<h3>' + esc(I.pick(ch.title)) + '</h3>' +
        '<div class="meta">' + ch.lessons.length + ' ' + esc(t('learn.title')) + ' · p.' + ch.pages.from + '–' + ch.pages.to + '</div>' +
        '<div class="lesson-strip">' + dots + '</div>' +
        '</span></a>';
    }).join('');
  }

  function renderNotes() {
    const p = I.getProgress();
    const withNotes = Object.keys(p.notes || {}).filter(function (k) { return (p.notes[k] || '').trim(); });
    const host = qs('#notes-card');
    if (!withNotes.length) {
      host.innerHTML = '<h3>' + esc(t('dash.notes')) + '</h3><div class="muted small">' +
        esc(I.state.lang === 'km' ? 'មិនទាន់មានកំណត់សម្គាល់ទេ — អ្នកអាចសរសេរនៅក្នុងមេរៀននីមួយៗ។' : 'No notes yet — you can write them inside any lesson.') + '</div>';
      return;
    }
    host.innerHTML = '<h3>' + esc(t('dash.notes')) + '</h3>' + withNotes.slice(0, 6).map(function (id) {
      const l = D.lessonById(id);
      if (!l) return '';
      return '<a class="card hoverable" href="learn.html#' + id + '" style="display:block;text-decoration:none;color:inherit;margin-bottom:10px">' +
        '<b>' + esc(I.pick(l.title)) + '</b><div class="muted small">' + esc(I.truncate(p.notes[id], 120)) + '</div></a>';
    }).join('');
  }

  function palette() {
    const items = [];
    D.chapters.forEach(function (ch) {
      items.push({ kind: I.state.lang === 'km' ? 'ជំពូក' : 'chapter', text: I.pick(ch.title), href: 'learn.html#' + (ch.lessons[0] ? ch.lessons[0].id : '') });
    });
    D.lessons.forEach(function (l) {
      items.push({ kind: t('quiz.lesson'), text: I.pick(l.title), href: 'learn.html#' + l.id });
    });
    D.glossary.slice(0, 220).forEach(function (g) {
      items.push({ kind: I.state.lang === 'km' ? 'ពាក្យ' : 'term', text: (g.km + ' · ' + g.en), href: 'glossary.html#t=' + encodeURIComponent(g.km) });
    });
    I.commandPalette(function () { return items; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('dashboard.html');
    const sess = A.session();
    const name = sess ? sess.u : '';
    qs('#greet').textContent = t('dash.hi') + (name ? ', ' + name : '') + ' 👋';
    qs('#greet-sub').textContent = t('dash.sub');

    renderProgress();
    renderContinue();
    renderQuick();
    renderChapters();
    renderNotes();
    palette();
    I.stagger(qs('#quick'));
    I.reveal();

    qs('#reset-btn').addEventListener('click', function () {
      I.modal(t('dash.reset'),
        '<p>' + esc(I.state.lang === 'km' ? 'តើអ្នកប្រាកដទេ? វឌ្ឍនភាព ពិន្ទុ និងកំណត់សម្គាល់ទាំងអស់នឹងត្រូវលុប។' : 'Are you sure? All progress, scores and notes will be cleared.') + '</p>',
        '<button class="btn" data-close>' + esc(t('common.cancel')) + '</button>' +
        '<button class="btn primary" id="confirm-reset">' + esc(t('common.yes')) + '</button>');
      qs('#confirm-reset').addEventListener('click', function () {
        I.saveProgress({ lessons: {}, quiz: {}, xp: 0, streak: 0, lastDay: null, notes: {} });
        I.closeModal();
        I.toast(t('common.done'));
        setTimeout(function () { location.reload(); }, 400);
      });
    });
  });
})();
