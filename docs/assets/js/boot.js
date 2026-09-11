/* ==========================================================================
   boot.js — applied before first paint, so the page never flashes the wrong
   theme or language.  Kept as an external file (not an inline <script>) so the
   site can run under a strict Content-Security-Policy.
   ========================================================================== */
(function () {
  try {
    var theme = localStorage.getItem('robo.theme') || 'dark';
    var lang = localStorage.getItem('robo.lang') === 'en' ? 'en' : 'km';
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    document.documentElement.dataset.bootlang = lang;
  } catch (e) { /* private mode: defaults apply */ }
})();
