/* ==========================================================================
   learn.js — the lesson template

   Everything is rendered from the built data (docs/data/lessons.js, generated
   from content/*.json by tools/build_site_data.py), so editing a lesson means
   editing its JSON and rebuilding — nothing about a chapter lives in this file.

   What a lesson page gives a student
     · the lesson's own PDF — just its pages (lesson 1.2 is two pages, so the
       viewer holds two slides), lazy-loaded, with the browser's own viewer
     · a guided walk-through: the lesson explains itself one point at a time and
       the student clicks Next to go on (arrow keys work too). Finishing it marks
       the lesson studied and fills the chapter-progress bar
     · learning objectives, key terms (tap to open), the plain-language summary,
       the authored key points and the verbatim quotes with page numbers
     · a sticky chapter-progress bar, notes, and the lesson's quiz
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
  const slidesOf = (lesson) => lesson.pages.to - lesson.pages.from + 1;
  const lessonPdf = (lesson) => 'library/lessons/' + lesson.id + '.pdf';
  const chapterPdf = (chapter) => 'library/chapters/' + chapter.id + '.pdf';
  const slideUrl = (n) => lessonPdf(current.lesson) + '#page=' + n + '&zoom=page-width&view=FitH';
  const bookPage = () => current.lesson.pages.from + ui.slide - 1;

  /* ------------------------------------------------------------------ rail */
  function renderRail() {
    const rail = qs('#rail');
    if (!rail) return;
    const done = I.getProgress().lessons || {};
    rail.innerHTML = chapters.map(function (c) {
      const open = current && current.chapter.id === c.id;
      const items = (c.lessons || []).map(function (l) {
        const active = current && current.lesson.id === l.id;
        return '<a href="#' + l.id + '" data-lesson="' + l.id + '" class="' +
          (active ? 'active ' : '') + (done[l.id] ? 'done' : '') + '">' +
          '<span class="dot"></span><span class="tt">' + esc(pick(l.title)) + '</span></a>';
      }).join('');
      return '<div class="ch' + (open ? ' open' : '') + '">' +
        '<button type="button" data-ch="' + c.id + '"><span class="n">' + esc(String(c.num)) +
        '</span><span class="ct">' + esc(pick(c.title)) + '</span></button>' +
        '<div class="ls">' + items + '</div></div>';
    }).join('');
    qsa('[data-ch]', rail).forEach(function (b) {
      b.addEventListener('click', function () { b.parentNode.classList.toggle('open'); });
    });
    qsa('[data-lesson]', rail).forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); location.hash = '#' + a.dataset.lesson; });
    });
    const active = qs('.ls a.active', rail);
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  /* ------------------------------------------------------------------ hero */
  function hero() {
    const c = current.chapter, l = current.lesson;
    return '<header class="lk-hero">' +
      '<div class="lk-kicker">' + esc(t('learn.chapter')) + ' <b>' + esc(String(c.num)) + '</b> · ' +
        esc(pick(c.title)) + '</div>' +
      '<h1 class="lk-title"><span>' + esc(pick(l.title)) + '</span></h1>' +
      '<div class="lk-meta">' +
        '<span class="lk-pill hot">📑 ' + slidesOf(l) + ' ' + esc(t('learn.slides')) +
          ' · ' + esc(t('learn.pages')) + ' ' + l.pages.from + '–' + l.pages.to + '</span>' +
        '<span class="lk-pill">🎯 ' + arr(l.objectives).length + ' ' + esc(t('learn.objectives')) + '</span>' +
        '<span class="lk-pill">🔑 ' + (l.terms || []).length + ' ' + esc(t('learn.terms')) + '</span>' +
        '<span class="lk-pill">🎬 ' + (l.quiz || []).length + ' ' + esc(t('quiz.questions')) + '</span>' +
        '<button class="lk-pill" id="lk-rail-toggle" type="button" style="cursor:pointer">☰ ' + esc(t('learn.pick')) + '</button>' +
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
        '<span class="lk-pct" id="lk-pct">0%</span></div>' +
      '<div class="lk-bar"><i id="lk-fill"></i></div>' +
      '<div class="lk-dots" id="lk-dots"></div></div>';
  }

  /* ------------------------------------------------------- the guided walk */
  function guideSteps() {
    const l = current.lesson;
    const out = [];
    arr(l.objectives).forEach((x) => out.push({ kind: 'objective', text: x }));
    arr(l.plain).forEach((x) => out.push({ kind: 'explanation', text: x }));
    arr(l.keyPoints).slice(0, 5).forEach((x) => out.push({ kind: 'keypoint', text: x }));
    return out;
  }

  function guideCard() {
    const steps = guideSteps();
    if (!steps.length) return '';
    return '<section class="lk-guide lk-reveal" data-sec="guide" id="lk-guide">' +
      '<div class="lk-guide-head">' +
        '<span class="lk-guide-title">🎓 ' + esc(t('learn.guide')) + '</span>' +
        '<span class="lk-guide-count"><b id="lk-gstep">1</b>/' + steps.length + '</span></div>' +
      '<div class="lk-guide-stage" id="lk-gstage"></div>' +
      '<div class="lk-guide-bar"><i id="lk-gfill"></i></div>' +
      '<div class="lk-guide-actions">' +
        '<button class="lk-btn" id="lk-gprev" type="button">← ' + esc(t('learn.back')) + '</button>' +
        '<button class="lk-btn primary" id="lk-gnext" type="button">' + esc(t('learn.next')) + ' →</button>' +
        '<span class="lk-guide-hint">' + esc(t('learn.guideHint')) + '</span>' +
      '</div></section>';
  }

  function paintGuide() {
    const steps = guideSteps();
    const s = steps[ui.step];
    const stage = qs('#lk-gstage');
    if (!s || !stage) return;
    const label = { objective: 'learn.kObjective', explanation: 'learn.kExplanation', keypoint: 'learn.kKeypoint' }[s.kind];
    stage.innerHTML = '<div class="lk-guide-card kind-' + s.kind + '">' +
      '<span class="lk-guide-kind">' + esc(t(label)) + '</span>' +
      '<p>' + esc(s.text) + '</p></div>';
    const fill = qs('#lk-gfill');
    if (fill) fill.style.width = Math.round(((ui.step + 1) / steps.length) * 100) + '%';
    const n = qs('#lk-gstep');
    if (n) n.textContent = String(ui.step + 1);
    const back = qs('#lk-gprev'), next = qs('#lk-gnext');
    if (back) back.disabled = ui.step === 0;
    if (next) {
      const last = ui.step >= steps.length - 1;
      next.textContent = last ? '✓ ' + t('learn.finish') : t('learn.next') + ' →';
      next.classList.toggle('done', last);
    }
    ui.seen.guide = true;
    paintProgress();
  }

  function guideGo(delta) {
    const steps = guideSteps();
    const next = ui.step + delta;
    if (next < 0) return;
    if (next >= steps.length) { finishGuide(); return; }
    ui.step = next;
    paintGuide();
    const card = qs('#lk-guide');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function finishGuide() {
    const steps = guideSteps();
    ui.step = steps.length - 1;
    ui.guided = true;
    ui.seen.objectives = true;
    ui.seen.plain = true;
    paintGuide();
    markStudiedUI();
    I.toast('🎓 ' + t('learn.guideDone'));
  }

  /** one place that marks the lesson studied and updates the button, so the auto
      mark and the button can never disagree */
  function markStudiedUI() {
    if (ui.marked) return;
    ui.marked = true;
    I.markStudied(current.lesson.id);
    renderRail();
    const m = qs('#mark-btn');
    if (m) { m.disabled = true; m.textContent = '✓ ' + t('learn.studied'); }
  }

  /* ---------------------------------------------------------------- viewer */
  function pdfCard() {
    const c = current.chapter, l = current.lesson;
    return '<section class="lk-card lk-pdf-card lk-reveal" data-sec="pdf" id="lk-pdf">' +
      '<div class="lk-pdf-head">' +
        '<span class="lk-ico" style="display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:var(--lk-grad);color:#0b0f22">📑</span>' +
        '<span class="lk-file">' + esc(l.id) + '.pdf · ' + slidesOf(l) + ' ' + esc(t('learn.slides')) + '</span>' +
        '<button class="lk-btn" id="lk-chapter" type="button" title="' + esc(t('learn.wholeChapter')) + '">📚 ' + esc(t('learn.wholeChapter')) + '</button>' +
        '<button class="lk-btn" id="lk-open" type="button">↗ ' + esc(t('lib.open')) + '</button>' +
      '</div>' +
      '<div class="lk-pdf-stage" id="lk-stage">' +
        '<div class="lk-skel" id="lk-skel">📕<br>' + esc(t('lib.loading')) + '</div>' +
        '<iframe data-src="' + slideUrl(ui.slide) + '" title="' + esc(pick(l.title)) + '" loading="lazy"></iframe>' +
      '</div>' +
      '<div class="lk-pagebar">' +
        '<span class="lk-pageno">' + esc(t('learn.slide')) + ' <b id="lk-slide">' + ui.slide + '</b>/' + slidesOf(l) +
          ' · ' + esc(t('learn.bookPage')) + ' <b id="lk-bookpage">' + bookPage() + '</b></span>' +
        '<button class="lk-btn" id="lk-prev" type="button" aria-label="' + esc(t('lib.prev')) + '">←</button>' +
        '<button class="lk-btn" id="lk-next" type="button" aria-label="' + esc(t('lib.next')) + '">→</button>' +
      '</div>' +
      '<p class="lk-pdf-note">' + esc(t('learn.viewerNote')) + '</p></section>';
  }

  /* ------------------------------------------------------------ objectives */
  function objectivesCard() {
    return '<section class="lk-card lk-reveal" data-sec="objectives" id="lk-objectives">' +
      '<h2><span class="lk-ico">🎯</span>' + esc(t('learn.objectives')) + '</h2>' +
      '<ul class="lk-obj">' + arr(current.lesson.objectives).map((x) => '<li>' + esc(x) + '</li>').join('') +
      '</ul></section>';
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
    return '<section class="lk-plain lk-reveal" data-sec="plain" id="lk-plain"><div>' +
      '<h2><span class="lk-ico">✨</span>' + esc(t('learn.plain')) + '</h2>' +
      '<ul>' + arr(current.lesson.plain).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
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
        '<span class="faint small" id="notes-state" style="align-self:center"></span></div></section>';
  }

  function actionsCard() {
    const studied = !!(I.getProgress().lessons || {})[current.lesson.id];
    return '<div class="lk-actions lk-reveal">' +
      '<a class="lk-btn primary" href="quiz.html#lesson=' + current.lesson.id + '">🎯 ' + esc(t('learn.quiz')) + '</a>' +
      '<a class="lk-btn" href="teacher.html?q=' + encodeURIComponent(pick(current.lesson.title)) + '">🤖 ' + esc(t('nav.teacher')) + '</a>' +
      '<button class="lk-btn" id="mark-btn" type="button"' + (studied ? ' disabled' : '') + '>' +
        (studied ? '✓ ' + esc(t('learn.studied')) : '✓ ' + esc(t('learn.mark'))) + '</button>' +
      '<button class="lk-btn" id="print-btn" type="button">🖨 ' + esc(t('common.print')) + '</button></div>';
  }

  /* ----------------------------------------------------------------- view */
  function render() {
    const host = qs('#lesson');
    if (!host || !current) return;
    host.className = 'lesson-body lesson-page';
    document.body.classList.add('lk-open');
    host.innerHTML = hero() + progressBar() +
      '<div class="lk-grid split">' + pdfCard() + objectivesCard() + '</div>' +
      '<div class="lk-grid" style="margin-top:18px">' + guideCard() + termsCard() + plainCard() +
      foldsCard() + notesCard() + actionsCard() + '</div>';
    wire();
    paintGuide();
    paintProgress();
  }

  /* ---------------------------------------------------------------- wiring */
  function wire() {
    stickyOffset();
    lazyViewer();
    revealOnScroll();

    qs('#lk-prev').addEventListener('click', function () { goto(ui.slide - 1); });
    qs('#lk-next').addEventListener('click', function () { goto(ui.slide + 1); });
    qs('#lk-open').addEventListener('click', function () { window.open(slideUrl(ui.slide), '_blank', 'noopener'); });
    qs('#lk-chapter').addEventListener('click', function () { window.open(chapterPdf(current.chapter), '_blank', 'noopener'); });

    qs('#lk-gnext').addEventListener('click', function () { guideGo(1); });
    qs('#lk-gprev').addEventListener('click', function () { guideGo(-1); });

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

    /* arrow keys walk the guided lesson, unless you are typing in the notes */
    document.addEventListener('keydown', onKey);
    if (I.commandPalette) {
      I.commandPalette(chapters.flatMap(function (c) {
        return c.lessons.map(function (l) { return { kind: t('learn.title'), text: pick(l.title), href: '#' + l.id }; });
      }));
    }
    document.title = pick(current.lesson.title) + ' · RoboCL';
  }

  function onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    if (e.key === 'ArrowRight') { guideGo(1); }
    else if (e.key === 'ArrowLeft') { guideGo(-1); }
  }

  function stickyOffset() {
    const bar = qs('#topbar');
    const h = bar && bar.offsetHeight ? bar.offsetHeight : 56;
    document.documentElement.style.setProperty('--lk-stick', (h + 8) + 'px');
  }

  /** the lesson PDF is a same-origin file, so the browser's own viewer shows it;
      we only attach the src when the card comes near the viewport */
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
    } else { load(); }
  }

  function revealOnScroll() {
    const els = qsa('.lk-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
    els.forEach((e, i) => { e.style.transitionDelay = Math.min(i * 60, 240) + 'ms'; io.observe(e); });
  }

  /* ------------------------------------------------------- chapter progress */
  const SECTIONS = [['pdf', 'learn.viewPDF'], ['guide', 'learn.guide'], ['objectives', 'learn.objectives'],
                    ['terms', 'learn.terms'], ['plain', 'learn.plain']];

  function paintProgress() {
    const seen = SECTIONS.filter(([k]) => ui.seen[k]).length;
    const walked = guideSteps().length ? (ui.guided ? 1 : ui.step / Math.max(1, guideSteps().length))
                                       : 0;
    const pct = Math.round(100 * (0.5 * (seen / SECTIONS.length) + 0.5 * walked));
    const fill = qs('#lk-fill');
    if (fill) fill.style.width = pct + '%';
    const p = qs('#lk-pct'), s = qs('#lk-seen');
    if (p) p.textContent = pct + '%';
    if (s) s.textContent = seen + '/' + SECTIONS.length;
    const dots = qs('#lk-dots');
    if (dots) dots.innerHTML = SECTIONS.map(function ([k, label]) {
      return '<span class="' + (ui.seen[k] ? 'done' : '') + '">' + (ui.seen[k] ? '✓ ' : '') + esc(t(label)) + '</span>';
    }).join('');
    if (ui.guided) markStudiedUI();
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

  /** move inside the lesson's own pages (slide 1 = the lesson's first book page) */
  function goto(slide) {
    const max = slidesOf(current.lesson);
    const next = Math.max(1, Math.min(max, slide));
    if (next === ui.slide) return;
    ui.slide = next;
    const frame = qs('#lk-stage iframe');
    if (frame) frame.src = slideUrl(next);
    const el = qs('#lk-slide'), bp = qs('#lk-bookpage');
    if (el) el.textContent = String(next);
    if (bp) bp.textContent = String(bookPage());
    I.sSet('lkslide:' + current.lesson.id, String(next));
    ui.seen.pdf = true;
    paintProgress();
  }

  /* ------------------------------------------------------------------ show */
  function findLesson(id) {
    const l = D.lessonById ? D.lessonById(id) : null;
    if (l && l.chapter) return { chapter: l.chapter, lesson: l };
    if (l) for (const c of chapters) if ((c.lessons || []).indexOf(l) >= 0) return { chapter: c, lesson: l };
    return null;
  }

  function show(id) {
    const found = findLesson(id) || (chapters[0] && chapters[0].lessons[0] && findLesson(chapters[0].lessons[0].id));
    if (!found) return;
    current = found;
    const saved = parseInt(I.sGet('lkslide:' + found.lesson.id, ''), 10);
    ui = {
      slide: (saved > 0 && saved <= slidesOf(found.lesson)) ? saved : 1,
      step: 0,
      guided: false,
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
