/* library.js — read the textbook and the reference documents inside the app */
(function () {
  'use strict';
  const I = window.IPL;
  const t = I.t, esc = I.esc, qs = I.qs;
  const LIB = window.IPL_LIBRARY || { sources: [] };
  const state = { id: null, view: 'text', page: 1 };

  function src(id) { return LIB.sources.filter(function (s) { return s.id === id; })[0] || LIB.sources[0]; }

  function renderList() {
    qs('#lib-list').innerHTML = LIB.sources.map(function (s) {
      return '<button class="lib-src' + (s.id === state.id ? ' active' : '') + '" data-src="' + s.id + '">' +
        '<span class="ico">' + (s.kind === 'pdf' ? '📕' : '📗') + '</span>' +
        '<span style="flex:1;min-width:0"><b>' + esc(I.pick(s.title)) + '</b>' +
        '<span>' + esc(I.pick(s.author)) + ' · ' + s.pages.length + ' ' + esc(t('lib.pages')) + '</span></span></button>';
    }).join('');
    I.qsa('[data-src]', qs('#lib-list')).forEach(function (b) {
      b.addEventListener('click', function () { open(b.dataset.src, 1); });
    });
  }

  function chapterOf(s, page) {
    if (!s.pages.length) return null;
    const p = s.pages.filter(function (x) { return x.n === page; })[0];
    return p && p.ch ? p.ch : null;
  }

  function renderViewer() {
    const s = src(state.id);
    const page = Math.max(1, Math.min(s.pages.length, state.page));
    state.page = page;
    const rec = s.pages[page - 1] || { n: page, text: '' };
    const ch = chapterOf(s, page);
    const views = ['text'].concat(s.pdf ? ['pdf'] : []).concat(s.images && s.images.length ? ['shots'] : []);

    let body = '';
    if (state.view === 'pdf' && s.pdf) {
      body = '<iframe class="pdf-frame" src="' + esc(s.pdf) + '#page=' + page + '&view=FitH" title="' + esc(I.pick(s.title)) + '"></iframe>';
    } else if (state.view === 'shots') {
      body = '<div class="shots">' + s.images.map(function (im) {
        return '<figure class="shot" data-img="' + esc(im.img) + '" data-page="' + im.page + '">' +
          '<img loading="lazy" src="' + esc(im.img) + '" alt="page ' + im.page + '">' +
          '<figcaption>' + esc(t('lib.page')) + ' ' + im.page + ' · ' + esc(im.label) + '</figcaption></figure>';
      }).join('') + '</div>' +
      '<div class="small faint" style="margin-top:12px">' + esc(t('lib.zoom')) + '</div>';
    } else {
      body = '<div class="reader-page ' + (s.lang === 'km' ? 'km' : '') + '">' + esc(rec.text || '—') + '</div>';
    }

    qs('#viewer').innerHTML =
      '<div class="viewer-bar">' +
      '<div class="lib-tabs">' +
      views.map(function (v) {
        return '<button class="btn sm' + (state.view === v ? ' primary' : '') + '" data-view="' + v + '">' +
          esc(t('lib.view.' + v)) + '</button>';
      }).join('') + '</div>' +
      '<span class="spacer"></span>' +
      (ch ? '<span class="pill gold">' + esc(t('lib.chapter')) + ' ' + ch.num + ' · ' + esc(I.pick(ch.title)) + '</span>' : '') +
      (s.pdf ? '<a class="btn sm" href="' + esc(s.pdf) + '" download>⬇ ' + esc(t('lib.download')) + '</a>' : '') +
      '</div>' +
      '<div class="viewer-body">' +
      (state.view === 'text' ?
        '<div class="row" style="justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">' +
        '<div class="pager">' +
        '<button class="btn sm" id="prev-pg"' + (page <= 1 ? ' disabled' : '') + '>← ' + esc(t('lib.prev')) + '</button>' +
        '<input type="range" id="pg-range" aria-label="' + esc(t('lib.page')) + '" min="1" max="' + s.pages.length + '" value="' + page + '">' +
        '<button class="btn sm" id="next-pg"' + (page >= s.pages.length ? ' disabled' : '') + '> ' + esc(t('lib.next')) + ' →</button>' +
        '</div>' +
        '<div class="row"><span class="pill">' + esc(t('lib.page')) + ' ' + page + ' ' + esc(t('lib.of')) + ' ' + s.pages.length + '</span>' +
        '<input class="input" id="goto" type="number" aria-label="' + esc(t('lib.gotopage')) + '" min="1" max="' + s.pages.length + '" placeholder="' + esc(t('lib.gotopage')) + '" style="width:130px;min-height:38px">' +
        '</div></div>' : '') +
      body +
      '</div>';

    I.qsa('[data-view]', qs('#viewer')).forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.dataset.view; renderViewer(); });
    });
    const prev = qs('#prev-pg'), next = qs('#next-pg'), range = qs('#pg-range'), goto = qs('#goto');
    if (prev) prev.addEventListener('click', function () { state.page = page - 1; renderViewer(); syncHash(); });
    if (next) next.addEventListener('click', function () { state.page = page + 1; renderViewer(); syncHash(); });
    if (range) {
      range.addEventListener('input', function () {
        state.page = +range.value;
        const rec2 = src(state.id).pages[state.page - 1] || { text: '' };
        const body = qs('.viewer-body .reader-page');
        if (body) body.textContent = rec2.text || '—';
        qs('#viewer .pill:last-of-type');
      });
      range.addEventListener('change', function () { renderViewer(); syncHash(); });
    }
    if (goto) goto.addEventListener('change', function () {
      const v = Math.max(1, Math.min(src(state.id).pages.length, +goto.value || 1));
      state.page = v; renderViewer(); syncHash();
    });
    I.qsa('[data-img]', qs('#viewer')).forEach(function (f) {
      f.addEventListener('click', function () {
        I.modal(esc(t('lib.page')) + ' ' + f.dataset.page,
          '<img src="' + esc(f.dataset.img) + '" alt="" style="width:100%;border-radius:10px">');
      });
    });
    I.qsa('a[href^="library"]', qs('#viewer'));
  }

  function syncHash() {
    history.replaceState(null, '', '#' + state.id + '=' + state.page);
  }

  function open(id, page, view) {
    state.id = id;
    state.page = page || 1;
    const s = src(id);
    state.view = view || (s.pdf && false ? 'pdf' : 'text');
    renderList();
    renderViewer();
    const head = qs('#lib-head');
    if (head) {
      head.innerHTML = '<h2 style="margin:0 0 4px">' + esc(I.pick(s.title)) + '</h2>' +
        '<div class="muted small">' + esc(I.pick(s.author)) + (s.year ? ' · ' + esc(s.year) : '') +
        ' · ' + esc(I.pick(s.note)) + '</div>' +
        (s.pdf ? '' : '<div class="small faint" style="margin-top:6px">' + esc(t('lib.textonly')) + '</div>');
    }
    syncHash();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('library.html');
    if (!LIB.sources.length) {
      qs('#viewer').innerHTML = '<div class="viewer-body muted">' + esc(t('common.loading')) + '</div>';
      return;
    }
    const m = location.hash.match(/#?([a-z]+)=(\d+)/);
    const id = m ? m[1] : (LIB.sources[0] || {}).id;
    open(LIB.sources.filter(function (s) { return s.id === id; })[0] ? id : LIB.sources[0].id, m ? +m[2] : 1);
    I.commandPalette(function () {
      return LIB.sources.map(function (s) {
        return { kind: '📕', text: I.pick(s.title), href: '#' + s.id + '=1' };
      });
    });
  });
})();
