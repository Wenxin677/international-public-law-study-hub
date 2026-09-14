/* library.js — read the textbook and the reference documents inside the app.
   Every source ships its real PDF, so the default view shows actual pages with
   a page number, prev/next, jump-to-page, fit/zoom, and a way out to the file
   itself when the browser cannot render a PDF inline. */
(function () {
  'use strict';
  const I = window.IPL;
  const t = I.t, esc = I.esc, qs = I.qs;
  const LIB = window.IPL_LIBRARY || { sources: [] };
  /* view: 'pdf' | 'text' | 'shots'; page is the BOOK page (PDF page = book + offset) */
  const state = { id: null, view: 'pdf', page: 1, fit: 'FitH' };

  function src(id) { return LIB.sources.filter(function (s) { return s.id === id; })[0] || LIB.sources[0]; }
  function total(s) { return (s.pages || []).length; }
  /* The textbook PDF opens with 11 front-matter sheets, so its printed page 1 is
     sheet 12. Lessons and quizzes cite BOOK pages, so every link into the file has
     to add that offset or it opens 11 pages early. */
  function offsetOf(s) { return (s && s.offset) || 0; }

  /* Some browsers cannot show a PDF inside a page (iOS Safari above all, and
     Firefox on Android). Detect it so we can offer the file instead of a blank. */
  function canInlinePdf() {
    if (typeof navigator.pdfViewerEnabled === 'boolean') return navigator.pdfViewerEnabled;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return false;
    if (/Android/.test(ua) && !/Chrome/.test(ua)) return false;
    return true;
  }

  function pdfUrl(s, page, fit) {
    let frag = '#page=' + (page + offsetOf(s));
    if (fit === 'FitH' || fit === 'FitV') frag += '&view=' + fit;
    else if (fit && fit.indexOf('zoom:') === 0) frag += '&zoom=' + fit.slice(5);
    return s.pdf + frag;
  }

  /* --------------------------------------------------------------- the list */
  function renderList() {
    qs('#lib-list').innerHTML = LIB.sources.map(function (s) {
      return '<button class="lib-src' + (s.id === state.id ? ' active' : '') + '" data-src="' + s.id + '">' +
        '<span class="ico">' + (s.id === 'textbook' ? '📗' : '📕') + '</span>' +
        '<span style="flex:1;min-width:0"><b>' + esc(I.pick(s.title)) + '</b>' +
        '<span>' + esc(I.pick(s.author)) + ' · ' + total(s) + ' ' + esc(t('lib.pages')) + '</span></span></button>';
    }).join('');
    I.qsa('[data-src]', qs('#lib-list')).forEach(function (b) {
      b.addEventListener('click', function () { open(b.dataset.src, 1); });
    });
  }

  function chapterOf(s, page) {
    const p = (s.pages || []).filter(function (x) { return x.n === page; })[0];
    return p && p.ch ? p.ch : null;
  }

  /* --------------------------------------------------------------- the bar */
  function pagerHtml(s, page) {
    return '<div class="row lib-pager">' +
      '<div class="pager">' +
      '<button class="btn sm" id="prev-pg"' + (page <= 1 ? ' disabled' : '') + ' aria-label="' + esc(t('lib.prev')) + '">← ' + esc(t('lib.prev')) + '</button>' +
      '<input type="range" id="pg-range" aria-label="' + esc(t('lib.page')) + '" min="1" max="' + total(s) + '" value="' + page + '">' +
      '<button class="btn sm" id="next-pg"' + (page >= total(s) ? ' disabled' : '') + ' aria-label="' + esc(t('lib.next')) + '">' + esc(t('lib.next')) + ' →</button>' +
      '</div>' +
      '<span class="pill" id="pg-label">' + esc(t('lib.page')) + ' ' + page + ' ' + esc(t('lib.of')) + ' ' + total(s) + '</span>' +
      '<input class="input" id="goto" type="number" aria-label="' + esc(t('lib.gotopage')) + '" min="1" max="' + total(s) + '" placeholder="' + esc(t('lib.gotopage')) + '">' +
      '</div>';
  }

  function viewTabs(s) {
    const views = ['pdf', 'text'].concat((s.images && s.images.length) ? ['shots'] : []);
    return '<div class="lib-tabs">' + views.map(function (v) {
      return '<button class="btn sm' + (state.view === v ? ' primary' : '') + '" data-view="' + v + '">' +
        esc(t('lib.view.' + v)) + '</button>';
    }).join('') + '</div>';
  }

  function fitSelect() {
    const opts = [['FitH', t('lib.fit.width')], ['FitV', t('lib.fit.page')],
                  ['zoom:75', '75%'], ['zoom:100', '100%'], ['zoom:150', '150%']];
    return '<select class="input lib-fit" id="fit" aria-label="' + esc(t('lib.fit')) + '">' +
      opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (state.fit === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
  }

  function pdfBody(s, page) {
    if (!canInlinePdf()) {
      return '<div class="card pdf-fallback">' +
        '<div style="font-size:2rem">📄</div>' +
        '<p class="muted" style="margin:10px 0 14px">' + esc(t('lib.pdf.blocked')) + '</p>' +
        '<div class="row" style="justify-content:center">' +
        '<a class="btn primary" target="_blank" rel="noopener noreferrer" href="' + esc(pdfUrl(s, page, state.fit)) + '">↗ ' + esc(t('lib.newtab')) + '</a>' +
        '<a class="btn" href="' + esc(s.pdf) + '" download>⬇ ' + esc(t('lib.download')) + '</a>' +
        '</div></div>';
    }
    return '<div class="pdf-hold">' +
      '<div class="pdf-loading small faint" id="pdf-loading">' + esc(t('lib.pdf.loading')) + '</div>' +
      '<iframe class="pdf-frame" id="pdf-frame" src="' + esc(pdfUrl(s, page, state.fit)) +
      '" title="' + esc(I.pick(s.title)) + ' — ' + esc(t('lib.page')) + ' ' + page + '"></iframe>' +
      '</div>';
  }

  function textBody(s, page) {
    const rec = (s.pages || [])[page - 1] || { n: page, text: '' };
    return '<div class="reader-page ' + (s.lang === 'km' ? 'km' : '') + '">' + esc(rec.text || '—') + '</div>';
  }

  function shotsBody(s) {
    return '<div class="shots">' + s.images.map(function (im) {
      return '<figure class="shot" data-img="' + esc(im.img) + '" data-page="' + im.page + '" tabindex="0" role="button">' +
        '<img loading="lazy" src="' + esc(im.img) + '" alt="page ' + im.page + '">' +
        '<figcaption>' + esc(t('lib.page')) + ' ' + im.page + ' · ' + esc(im.label) + '</figcaption></figure>';
    }).join('') + '</div>' +
    '<div class="small faint" style="margin-top:12px">' + esc(t('lib.zoom')) + '</div>';
  }

  /* --------------------------------------------------------------- the viewer */
  function renderViewer() {
    const s = src(state.id);
    const page = Math.max(1, Math.min(total(s), state.page));
    state.page = page;
    if (state.view === 'shots' && !(s.images && s.images.length)) state.view = 'pdf';
    if (state.view === 'pdf' && !s.pdf) state.view = 'text';
    const ch = chapterOf(s, page);

    let body;
    if (state.view === 'pdf') body = pdfBody(s, page);
    else if (state.view === 'shots') body = shotsBody(s);
    else body = textBody(s, page);

    qs('#viewer').innerHTML =
      '<div class="viewer-bar">' + viewTabs(s) +
      (state.view === 'pdf' ? fitSelect() : '') +
      '<span class="spacer"></span>' +
      (ch ? '<span class="pill gold">' + esc(t('lib.chapter')) + ' ' + ch.num + ' · ' + esc(I.pick(ch.title)) + '</span>' : '') +
      (s.pdf ? '<a class="btn sm" target="_blank" rel="noopener noreferrer" href="' + esc(pdfUrl(s, page, state.fit)) + '">↗ ' + esc(t('lib.newtab')) + '</a>' : '') +
      (s.pdf ? '<a class="btn sm" href="' + esc(s.pdf) + '" download>⬇ ' + esc(t('lib.download')) + '</a>' : '') +
      '</div>' +
      '<div class="viewer-body">' +
      pagerHtml(s, page) +
      body +
      (s.rights ? '<div class="small faint lib-rights">' + esc(I.pick(s.rights)) + '</div>' : '') +
      '</div>';

    wire(s, page);
  }

  function wire(s, page) {
    I.qsa('[data-view]', qs('#viewer')).forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.dataset.view; renderViewer(); });
    });
    const fit = qs('#fit');
    if (fit) fit.addEventListener('change', function () { state.fit = fit.value; refreshPdf(); });
    const frame = qs('#pdf-frame');
    if (frame) {
      const done = function () { const l = qs('#pdf-loading'); if (l) l.hidden = true; };
      frame.addEventListener('load', done);
      setTimeout(done, 4000);          /* never leave the label hanging */
    }
    const prev = qs('#prev-pg'), next = qs('#next-pg'), range = qs('#pg-range'), goto = qs('#goto');
    if (prev) prev.addEventListener('click', function () { go(state.page - 1); });
    if (next) next.addEventListener('click', function () { go(state.page + 1); });
    if (range) {
      range.addEventListener('input', function () { setLabel(+range.value); });   /* live label only */
      range.addEventListener('change', function () { go(+range.value); });
    }
    if (goto) goto.addEventListener('change', function () { go(+goto.value || 1); });
    I.qsa('[data-img]', qs('#viewer')).forEach(function (f) {
      const openImg = function () {
        I.modal(t('lib.page') + ' ' + f.dataset.page,
          '<img src="' + esc(f.dataset.img) + '" alt="" style="width:100%;border-radius:10px">');
      };
      f.addEventListener('click', openImg);
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openImg(); }
      });
    });
  }

  function setLabel(page) {
    const s = src(state.id);
    const lab = qs('#pg-label');
    if (lab) lab.textContent = t('lib.page') + ' ' + page + ' ' + t('lib.of') + ' ' + total(s);
  }

  /* The built-in PDF viewer IGNORES a fragment-only src change ("#page=N" on the
     same URL), which is why the page buttons used to do nothing. Replacing the
     frame is the only reliable way to land on the requested page: the URL is
     unchanged, so the bytes come from cache and the jump is quick. */
  function refreshPdf() {
    const s = src(state.id);
    const old = qs('#pdf-frame');
    if (!old) return;
    const veil = qs('#pdf-loading');
    if (veil) veil.hidden = false;
    const next = document.createElement('iframe');
    next.className = 'pdf-frame';
    next.id = 'pdf-frame';
    next.setAttribute('title', I.pick(s.title) + ' — ' + t('lib.page') + ' ' + state.page);
    next.addEventListener('load', function () {
      const v = qs('#pdf-loading');
      if (v) v.hidden = true;
    });
    next.setAttribute('src', pdfUrl(s, state.page, state.fit));
    old.parentNode.replaceChild(next, old);
  }

  function go(n) {
    const s = src(state.id);
    state.page = Math.max(1, Math.min(total(s), n));
    const range = qs('#pg-range');
    if (range) range.value = state.page;
    const prev = qs('#prev-pg'), next = qs('#next-pg');
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= total(s);
    setLabel(state.page);
    if (state.view === 'pdf') refreshPdf();
    else if (state.view === 'text') {
      const rec = s.pages[state.page - 1] || { text: '' };
      const body = qs('.viewer-body .reader-page');
      if (body) body.textContent = rec.text || '—';
    }
    syncHash();
  }

  function syncHash() {
    try { history.replaceState(null, '', '#' + state.id + '=' + state.page); } catch (e) {}
  }

  function open(id, page, view) {
    const s = src(id);
    state.id = s.id;
    state.page = page || 1;
    state.view = view || (s.pdf ? 'pdf' : 'text');
    renderList();
    renderViewer();
    const head = qs('#lib-head');
    if (head) {
      head.innerHTML = '<h2 style="margin:0 0 4px">' + esc(I.pick(s.title)) + '</h2>' +
        '<div class="muted small">' + esc(I.pick(s.author)) + (s.year ? ' · ' + esc(s.year) : '') +
        ' · ' + esc(I.pick(s.note)) + '</div>' +
        (s.pdf ? '<div class="small faint" style="margin-top:6px">' + esc(t('lib.kbhint')) + '</div>' : '');
    }
    syncHash();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('library.html');
    /* lets the stylesheet give the document viewer a wider page on big screens */
    document.body.classList.add('lib-open');
    if (!LIB.sources.length) {
      qs('#viewer').innerHTML = '<div class="viewer-body muted">' + esc(t('common.loading')) + '</div>';
      return;
    }
    const m = location.hash.match(/#?([a-z]+)=(\d+)/);
    const want = m ? LIB.sources.filter(function (s) { return s.id === m[1]; })[0] : null;
    open(want ? want.id : LIB.sources[0].id, m ? +m[2] : 1);

    /* arrow keys turn pages, as long as the PDF frame does not hold focus */
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(state.page + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(state.page - 1); }
    });

    /* in-page deep links must work too (e.g. the Ctrl+K palette or a lesson
       citation clicked while the Library is already open) */
    window.addEventListener('hashchange', function () {
      const h = location.hash.match(/#?([a-z]+)=(\d+)/);
      if (!h) return;
      const s = LIB.sources.filter(function (x) { return x.id === h[1]; })[0];
      if (!s) return;
      if (s.id === state.id) go(+h[2]);
      else open(s.id, +h[2]);
    });

    I.commandPalette(function () {
      return LIB.sources.map(function (s) {
        return { kind: '📕', text: I.pick(s.title), href: '#' + s.id + '=1' };
      });
    });
  });
})();
