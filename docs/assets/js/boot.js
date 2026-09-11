/* ==========================================================================
   boot.js — applied before first paint, so the page never flashes the wrong
   theme or language.  Kept as an external file (not an inline <script>) so the
   site can run under a strict Content-Security-Policy.
   ========================================================================== */
(function () {
  try {
    /* marks that scripting is on, so CSS can reveal the page when it is not */
    document.documentElement.dataset.js = '1';
    /* an explicit ?_l= wins, so shared/deep links open in the right language */
    var q = new URLSearchParams(location.search).get('_l');
    var theme = localStorage.getItem('robo.theme') || 'dark';
    var lang = (q === 'en' || q === 'km') ? q : (localStorage.getItem('robo.lang') === 'en' ? 'en' : 'km');
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.lang = lang;
    document.documentElement.dataset.bootlang = lang;
  } catch (e) { /* private mode: defaults apply */ }
})();
