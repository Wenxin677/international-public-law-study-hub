/* ==========================================================================
   learn.js — the lesson template

   One reusable page for every lesson of every chapter.  Everything it shows
   comes from the built data (docs/data/lessons.js, generated from content/*.json
   by tools/build_site_data.py) — nothing about a chapter is hard-coded here, so
   editing a lesson means editing its JSON and rebuilding.

   Each lesson page has:
     · the real chapter PDF, embedded and lazy-loaded (native viewer: no
       megabyte of PDF.js, and it still works from a file:// copy)
     · learning objectives, key terms (tap to open), a plain-language summary,
       the authored key points and the verbatim quotes with their page numbers
     · a sticky chapter-progress bar, notes, and the quiz for that lesson
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL;
  const t = I.t, esc = I.esc, qs = I.qs, qsa = I.qsa, pick = I.pick;
  /* docs/assets/js/data.js assembles the generated files into this object */
  const D = window.IPL_DATA || {};
  const chapters = D.chapters || [];

  let current = null;          // { chapter, lesson }
  let ui = null;               // per-lesson view state

  const arr = (pair) => (pair && (pair[I.state.lang] || pair.en || pair.km)) || [];
  const bookPage = () => (current ? current.chapter.pages.from + ui.page - 1 : 0);
  const lessonSpan = () => (current ? current.lesson.pages.to - current.lesson.pages.from + 1 : 1);
  const pdfFile = (chapter) => 'library/chapters/' + chapter.id + '.pdf';
  const pdfUrl = (page) => pdfFile(current.chapter) + '#page=' + page + '&zoom=page-width&view=FitH';

  /* ------------------------------------------------------------------ rail */
  function renderRail() {
    const rail = qs('#rail');
    if (!rail) return;
    const done = I.getProgress().lessons || {};
    rail.innerHTML = chapters.map(function (c) {
      const items = c.lessons.map(function (l) {
        const active = current && current.lesson.id === l.id;
        const studied = done[l.id] ? ' ✓' : '';
        return '<a class="item' + (active ? ' active' : '') + '" href="#' + l.id + '" data-lesson="' + l.id + '">' +
          '<span class="num">' + esc(String(c.num)) + '</span>' +
          '<span class="ttl">' + esc(pick(l.title)) + studied + '</span></a>';
      }).join('');
      return '<div class="rail-ch"><div class="rail-ch-t">' + esc(pick(c.title)) + '</div>' + items + '</div>';
    }).join('');
    qsa('[data-lesson]', rail).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        location.hash = '#' + a.dataset.lesson;
      });
    });
  }

  /* ------------------------------------------------------------------ hero */
  function hero() {
    const c = current.chapter, l = current.lesson;
    return '<header class="lk-hero">' +
      '<div class="lk-kicker">' + esc(t('learn.chapter')) + ' <b>' + esc(String(c.num)) + '</b> · ' +
        esc(pick(c.title)) + '</div>' +
      '<h1 class="lk-title"><span>' + esc(pick(l.title)) + '</span></h1>' +
      '<div class="lk-meta">' +
        '<span class="lk-pill hot">📖 ' + esc(t('learn.pages')) + ' ' + l.pages.from + '–' + l.pages.to + '</span>' +
        '<span class="lk-pill">🎯 ' + arr(l.objectives).length + ' ' + esc(t('learn.objectives')) + '</span>' +
        '<span class="lk-pill">🔑 ' + (l.terms || []).length + ' ' + esc(t('learn.terms')) + '</span>' +
        '<span class="lk-pill">🎬 ' + (l.quiz || []).length + ' ' + esc(t('quiz.questions')) + '</span>' +
        '<button class="lk-pill" id="lk-rail-toggle" style="cursor:pointer">☰ ' + esc(t('learn.pick')) + '</button>' +
      '</div>' +
      '<p class="lk-pdf-note" style="margin-top:12px">' + esc(pick(c.summary)) + '</p>' +
      '</header>';
  }

  /* -------------------------------------------------------------- progress */
  function progressBar() {
    return '<div class="lk-progress" id="lk-progress" role="status" aria-live="polite">' +
      '<div class="lk-progress-top">' +
        '<span>⚡ ' + esc(t('learn.progress')) + '</span>' +
        '<b id="lk-seen">0/5</b>' +
        '<span class="lk-pct" id="lk-pct">0%</span>' +
      '</div>' +
      '<div class="lk-bar"><i id="lk-fill"></i></div>' +
      '<div class="lk-dots" id="lk-dots"></div>' +
      '</div>';
  }

  /* ---------------------------------------------------------------- viewer */
  function pdfCard() {
    const c = current.chapter, l = current.lesson;
    return '<section class="lk-card lk-pdf-card lk-reveal" data-sec="pdf" id="lk-pdf">' +
      '<div class="lk-pdf-head">' +
        '<span class="lk-ico" style="display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:var(--lk-grad);color:#0b0f22">📄</span>' +
        '<span class="lk-file">' + esc(c.id) + '.pdf · ' + esc(t('learn.chapter')) + ' ' + esc(String(c.num)) + '</span>' +
        '<button class="lk-btn" id="lk-open" type="button">↗ ' + esc(t('lib.open')) + '</button>' +
      '</div>' +
      '<div class="lk-pdf-stage" id="lk-stage">' +
        '<div class="lk-skel" id="lk-skel">📕<br>' + esc(t('lib.loading')) + '</div>' +
        '<iframe data-src="' + pdfUrl(ui.page) + '" title="' + esc(pick(l.title)) + '" loading="lazy"></iframe>' +
      '</div>' +
      '<div class="lk-pagebar">' +
        '<span class="lk-pageno">' + esc(t('lib.page')) + ' <b id="lk-bookpage">' + bookPage() + '</b> / ' +
          (c.pages.from + c.pages.to - c.pages.from) + ' · ' + esc(t('learn.inChapter')) + ' ' +
          '<b id="lk-chpage">' + ui.page + '</b>/' + (c.pages.to - c.pages.from + 1) + '</span>' +
        '<button class="lk-btn" id="lk-prev" type="button" aria-label="' + esc(t('lib.prev')) + '">←</button>' +
        '<button class="lk-btn" id="lk-start" type="button">' + esc(t('learn.lessonStart')) + '</button>' +
        '<button class="lk-btn" id="lk-next" type="button" aria-label="' + esc(t('lib.next')) + '">→</button>' +
      '</div>' +
      '<p class="lk-pdf-note">' + esc(t('learn.viewerNote')) + '</p>' +
      '</section>';
  }

  /* ------------------------------------------------------------ objectives */
  function objectivesCard() {
    const o = arr(current.lesson.objectives);
    return '<section class="lk-card lk-reveal" data-sec="objectives" id="lk-objectives">' +
      '<h2><span class="lk-ico">🎯</span>' + esc(t('learn.objectives')) + '</h2>' +
      '<ul class="lk-obj">' + o.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '</section>';
  }

  /* ------------------------------------------------------------ key terms */
  function termsCard() {
    const terms = current.lesson.terms || [];
    const km = I.state.lang === 'km';
    return '<section class="lk-card lk-reveal" data-sec="terms" id="lk-terms">' +
      '<h2><span class="lk-ico">🔑</span>' + esc(t('learn.terms')) + '</h2>' +
      '<div class="lk-terms">' + terms.map(function (x) {
        const head = km ? esc(x.km) : esc(x.en);
        const alt = km ? esc(x.en) : esc(x.km);
        const def = km ? esc(x.defKm) : esc(x.defEn);
        const defAlt = km ? esc(x.defEn) : esc(x.defKm);
        return '<details class="lk-term"><summary><span class="lk-km">' + head + '</span>' +
          '<span class="faint small">' + alt + '</span></summary>' +
          '<div class="lk-body"><p><b>' + head + '</b> — ' + def + '</p>' +
          (defAlt && defAlt !== def ? '<p class="faint small">' + defAlt + '</p>' : '') + '</div></details>';
      }).join('') + '</div></section>';
  }

  /* --------------------------------------------------------- quick explain */
  function plainCard() {
    const p = arr(current.lesson.plain);
    return '<section class="lk-plain lk-reveal" data-sec="plain" id="lk-plain"><div>' +
      '<h2><span class="lk-ico">✨</span>' + esc(t('learn.plain')) + '</h2>' +
      '<ul>' + p.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '</div></section>';
  }

  /* ------------------------------------------------- key points and quotes */
  function foldsCard() {
    const l = current.lesson;
    const points = arr(l.keyPoints);
    const quotes = l.quotes || [];
    return '<details class="lk-fold lk-reveal" id="lk-points"><summary>🧠 ' + esc(t('learn.keypoints')) +
        ' <span class="faint small">(' + points.length + ')</span></summary>' +
      '<div class="lk-fold-body"><ul class="lk-points">' + points.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></details>' +
      '<details class="lk-fold lk-reveal" id="lk-quotes"><summary>❝ ' + esc(t('learn.quotes')) +
        ' <span class="faint small">(' + quotes.length + ')</span></summary>' +
      '<div class="lk-fold-body">' + quotes.map(function (q) {
        return '<blockquote class="lk-quote">' + esc(pick(q)) +
          '<span class="lk-src">' + esc(t('quiz.page')) + ' ' + esc(String(q.page || '')) + '</span></blockquote>';
      }).join('') + '</div></details>';
  }

  /* ---------------------------------------------------------------- notes */
  function notesCard() {
    return '<section class="lk-card lk-notes lk-reveal" data-sec="notes" id="lk-notes">' +
      '<h2><span class="lk-ico">📝</span>' + esc(t('learn.notes')) + '</h2>' +
      '<textarea id="notes" aria-label="' + esc(t('learn.notes')) + '" placeholder="' + esc(t('learn.notes.ph')) + '">' +
        esc(I.getNotes(current.lesson.id)) + '</textarea>' +
      '<div class="lk-actions">' +
        '<button class="lk-btn primary" id="save-notes" type="button">💾 ' + esc(t('common.save')) + '</button>' +
        '<span class="faint small" id="notes-state" style="align-self:center"></span>' +
      '</div></section>';
  }

  /* -------------------------------------------------------------- actions */
  function actionsCard() {
    const studied = !!(I.getProgress().lessons || {})[current.lesson.id];
    return '<div class="lk-actions lk-reveal">' +
      '<a class="lk-btn primary" href="quiz.html#lesson=' + current.lesson.id + '">🎯 ' + esc(t('learn.quiz')) + '</a>' +
      '<a class="lk-btn" href="teacher.html?q=' + encodeURIComponent(pick(current.lesson.title)) + '">🤖 ' + esc(t('nav.teacher')) + '</a>' +
      '<button class="lk-btn" id="mark-btn" type="button"' + (studied ? ' disabled' : '') + '>' +
        (studied ? '✓ ' + esc(t('learn.studied')) : '✓ ' + esc(t('learn.mark'))) + '</button>' +
      '<button class="lk-btn" id="print-btn" type="button">🖨 ' + esc(t('common.print')) + '</button>' +
      '</div>';
  }

  /* ----------------------------------------------------------------- view */
  function render() {
    const host = qs('#lesson');
    if (!host || !current) return;
    host.className = 'lesson-body lesson-page';
    document.body.classList.add('lk-open');
    host.innerHTML = hero() + progressBar() +
      '<div class="lk-grid split">' + pdfCard() + objectivesCard() + '</div>' +
      '<div class="lk-grid" style="margin-top:18px">' + termsCard() + plainCard() + foldsCard() +
      notesCard() + actionsCard() + '</div>';
    wire();
    paintProgress();
  }

  /* ---------------------------------------------------------------- wiring */
  function wire() {
    stickyOffset();
    lazyViewer();
    revealOnScroll();

    qs('#lk-prev').addEventListener('click', function () { goto(ui.page - 1); });
    qs('#lk-next').addEventListener('click', function () { goto(ui.page + 1); });
    qs('#lk-start').addEventListener('click', function () { goto(current.lesson.pages.from - current.chapter.pages.from + 1); });
    qs('#lk-open').addEventListener('click', function () {
      window.open(pdfUrl(ui.page), '_blank', 'noopener');
    });
    const rt = qs('#lk-rail-toggle');
    if (rt) rt.addEventListener('click', function () {
      const wrap = qs('#rail-wrap');
      if (wrap) wrap.classList.toggle('open');
    });
    const wrap = qs('#rail-wrap');
    if (wrap) wrap.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-lesson]')) wrap.classList.remove('open');
    });

    qs('#save-notes').addEventListener('click', function () {
      I.setNotes(current.lesson.id, qs('#notes').value.trim());
      qs('#notes-state').textContent = t('learn.saved');
      setTimeout(function () { qs('#notes-state').textContent = ''; }, 1800);
    });
    const mark = qs('#mark-btn');
    if (mark) mark.addEventListener('click', function () {
      I.markStudied(current.lesson.id);
      mark.disabled = true;
      mark.textContent = '✓ ' + t('learn.studied');
      I.toast(t('learn.saved'));
      renderRail();
    });
    qs('#print-btn').addEventListener('click', function () { window.print(); });

    if (I.commandPalette) {
      I.commandPalette(chapters.flatMap(function (c) {
        return c.lessons.map(function (l) { return { kind: t('learn.title'), text: pick(l.title), href: '#' + l.id }; });
      }));
    }
    document.title = pick(current.lesson.title) + ' · RoboCL';
  }

  /** the sticky bar sits under the top bar, whatever height it is */
  function stickyOffset() {
    const bar = qs('#topbar');
    const h = bar && bar.offsetHeight ? bar.offsetHeight : 56;
    document.documentElement.style.setProperty('--lk-stick', (h + 8) + 'px');
  }

  /** the PDF is a same-origin file, so the browser's own viewer shows it; we only
      put the src in place when the card comes near the viewport (never blocks
      the page load), and take the skeleton away once it has loaded */
  function lazyViewer() {
    const stage = qs('#lk-stage');
    const frame = stage && stage.querySelector('iframe');
    if (!frame) return;
    const skel = qs('#lk-skel');
    const load = function () {
      if (frame.src) return;
      frame.src = frame.dataset.src;
      frame.addEventListener('load', function () { if (skel) skel.remove(); });
      setTimeout(function () { if (skel && skel.parentNode) skel.remove(); }, 4000);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { load(); io.disconnect(); } });
      }, { rootMargin: '700px 0px' });
      io.observe(stage);
    } else {
      load();
    }
  }

  function revealOnScroll() {
    const els = qsa('.lk-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
    els.forEach((e, i) => { e.style.transitionDelay = Math.min(i * 60, 240) + 'ms'; io.observe(e); });
  }

  /* ------------------------------------------------------- chapter progress */
  const SECTIONS = [['pdf', 'learn.viewPDF'], ['objectives', 'learn.objectives'], ['terms', 'learn.terms'],
                    ['plain', 'learn.plain'], ['notes', 'learn.notes']];

  function paintProgress() {
    const seen = SECTIONS.filter(([k]) => ui.seen[k]).length;
    const pagePart = Math.min(1, ui.pagesRead / Math.min(lessonSpan(), 6));
    const pct = Math.round(100 * (0.7 * (seen / SECTIONS.length) + 0.3 * pagePart));
    const fill = qs('#lk-fill');
    if (fill) fill.style.width = pct + '%';
    const p = qs('#lk-pct'), s = qs('#lk-seen');
    if (p) p.textContent = pct + '%';
    if (s) s.textContent = seen + '/' + SECTIONS.length;
    const dots = qs('#lk-dots');
    if (dots) dots.innerHTML = SECTIONS.map(function ([k, label]) {
      return '<span class="' + (ui.seen[k] ? 'done' : '') + '">' + (ui.seen[k] ? '✓ ' : '') + esc(t(label)) + '</span>';
    }).join('');
    if (pct >= 100 && !ui.marked) {
      ui.marked = true;
      I.markStudied(current.lesson.id);
      I.toast('✓ ' + t('learn.studied'));
      renderRail();
      const m = qs('#mark-btn');
      if (m) { m.disabled = true; m.textContent = '✓ ' + t('learn.studied'); }
    }
  }

  function watchSections() {
    if (!('IntersectionObserver' in window)) { SECTIONS.forEach(([k]) => { ui.seen[k] = true; }); paintProgress(); return; }
    const io = new IntersectionObserver(function (entries) {
      let changed = false;
      entries.forEach(function (e) {
        const k = e.target.dataset.sec;
        if (e.isIntersecting && k && !ui.seen[k]) { ui.seen[k] = true; changed = true; }
      });
      if (changed) paintProgress();
    }, { threshold: .35 });
    qsa('[data-sec]').forEach((e) => io.observe(e));
  }

  /** page navigation inside the chapter PDF (a browser PDF viewer does not report
      its own scrolling to the page around it, so the bar counts the parts and the
      pages you have been through) */
  function goto(page) {
    const max = current.chapter.pages.to - current.chapter.pages.from + 1;
    const next = Math.max(1, Math.min(max, page));
    if (next === ui.page) return;
    ui.pagesRead++;
    ui.page = next;
    const frame = qs('#lk-stage iframe');
    if (frame) frame.src = pdfUrl(next);
    const bp = qs('#lk-bookpage'), cp = qs('#lk-chpage');
    if (bp) bp.textContent = String(bookPage());
    if (cp) cp.textContent = String(next);
    I.sSet('lkpage:' + current.lesson.id, String(next));
    ui.seen.pdf = true;
    paintProgress();
  }

  /* ------------------------------------------------------------------ show */
  function findLesson(id) {
    /* data.js already attached each lesson's chapter to it */
    const l = D.lessonById ? D.lessonById(id) : null;
    if (l && l.chapter) return { chapter: l.chapter, lesson: l };
    if (l) {
      for (const c of chapters) if ((c.lessons || []).indexOf(l) >= 0) return { chapter: c, lesson: l };
    }
    return null;
  }

  function show(id) {
    const found = findLesson(id) || (chapters[0] && chapters[0].lessons[0] && findLesson(chapters[0].lessons[0].id));
    if (!found) return;
    current = found;
    const saved = parseInt(I.sGet('lkpage:' + found.lesson.id, ''), 10);
    const startPage = found.lesson.pages.from - found.chapter.pages.from + 1;
    ui = {
      page: (saved > 0 && saved <= (found.chapter.pages.to - found.chapter.pages.from + 1)) ? saved : startPage,
      pagesRead: 1,
      seen: {},
      marked: false
    };
    renderRail();
    render();
    watchSections();
  }

  document.addEventListener('DOMContentLoaded', function () {
    I.guard();
    I.renderChrome('learn.html');
    const id = location.hash.replace('#', '') || (chapters[0] && chapters[0].lessons[0] && chapters[0].lessons[0].id);
    show(id);
    window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });
    window.addEventListener('resize', stickyOffset);
  });
})();
