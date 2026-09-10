/* landing.js — the public homepage: animated hero, tour, counters, marquee */
(function () {
  'use strict';
  const I = window.IPL, esc = I.esc;

  const KEYWORDS = {
    km: ['អធិបតេយ្យភាព', 'ប្រភពនៃច្បាប់អន្តរជាតិ', 'សន្ធិសញ្ញា', 'ការទទួលស្គាល់រដ្ឋ', 'អង្គការសហប្រជាជាតិ',
         'ទំនៀមទម្លាប់អន្តរជាតិ', 'ការប្រើប្រាស់កម្លាំង', 'សិទ្ធិមនុស្ស', 'កិច្ចព្រមព្រៀងទីក្រុងប៉ារីស',
         'ច្បាប់សមុទ្រ', 'UNCLOS ១៩៨២', 'តុលាការអន្តរជាតិ', 'ទំនាក់ទំនងរដ្ឋ និងច្បាប់អន្តរជាតិ'],
    en: ['Sovereignty', 'Sources of international law', 'Treaties', 'Recognition of states', 'United Nations',
         'Customary international law', 'Use of force', 'Human rights', 'Paris Peace Agreements',
         'Law of the sea', 'UNCLOS 1982', 'International Court of Justice', 'State responsibility']
  };

  function marquee() {
    const host = I.qs('#kw-marquee');
    if (!host) return;
    const list = KEYWORDS[I.state.lang] || KEYWORDS.en;
    const one = list.map(function (k) { return '<span class="chip">◆ ' + esc(k) + '</span>'; }).join('');
    host.innerHTML = '<div class="marquee-track">' + one + one + '</div>';
  }

  function ctas() {
    const sess = window.IPLAuth && window.IPLAuth.session();
    const host = I.qs('#hero-cta');
    if (!host) return;
    if (sess) {
      host.innerHTML = '<a class="btn primary" href="dashboard.html">▶ ' +
        esc(I.state.lang === 'km' ? 'បន្តទៅផ្ទាំងសិក្សា' : 'Continue to dashboard') + '</a>' +
        '<a class="btn" href="teacher.html">🤖 ' + esc(I.t('nav.teacher')) + '</a>';
      const note = I.qs('#hero-note');
      if (note) note.textContent = (I.state.lang === 'km' ? 'ចូលប្រើជា ' : 'Signed in as ') + sess.u;
    }
  }

  function faq() {
    const host = I.qs('#faq');
    if (!host) return;
    host.innerHTML = [1, 2, 3, 4].map(function (i) {
      return '<details' + (i === 1 ? ' open' : '') + '><summary>' + esc(I.t('landing.q' + i)) + '</summary><p>' +
        esc(I.t('landing.a' + i)) + '</p></details>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('index.html');
    I.qs('#topbar').classList.add('public');
    marquee();
    faq();
    ctas();
    I.reveal();
    I.counters();
    ['#tour-grid', '#steps', '#feature-sources'].forEach(function (sel) {
      const n = I.qs(sel);
      if (n) I.stagger(n);
    });
    /* keep the tour buttons friendly on touch */
    I.qsa('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { location.href = b.dataset.goto; });
    });
  });
})();
