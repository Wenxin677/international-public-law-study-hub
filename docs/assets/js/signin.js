/* signin.js — sign in / create account (username + password only) */
(function () {
  'use strict';
  const I = window.IPL, A = window.IPLAuth;
  const t = I.t, esc = I.esc, qs = I.qs;

  let mode = 'signin';

  function setMode(m) {
    mode = m;
    qsa('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === m)); });
    qs('#field-confirm').hidden = m !== 'signup';
    qs('#submit-btn').textContent = m === 'signup' ? t('auth.signup') : t('auth.signin');
    qs('#form-title').textContent = m === 'signup' ? t('auth.welcome.new') : t('auth.welcome');
    qs('#swap').innerHTML = m === 'signup'
      ? esc(t('auth.have')) + ' <a href="#" data-swap="signin">' + esc(t('auth.signin')) + '</a>'
      : esc(t('auth.havenot')) + ' <a href="#" data-swap="signup">' + esc(t('auth.signup')) + '</a>';
    qs('#pw-strength').hidden = m !== 'signup';
    err('');
  }
  function qsa(sel) { return I.qsa(sel); }

  function err(key) {
    const box = qs('#form-err');
    box.textContent = key ? t(key) : '';
    box.hidden = !key;
  }

  async function submit(e) {
    e.preventDefault();
    const u = qs('#username').value.trim();
    const p = qs('#password').value;
    const c = qs('#confirm').value;
    const remember = qs('#remember').checked;
    const btn = qs('#submit-btn');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = t('common.loading');
    try {
      const res = mode === 'signup' ? await A.signup(u, p, c) : await A.signin(u, p, remember);
      if (!res.ok) { err(res.msg); btn.disabled = false; btn.textContent = label; return; }
      I.toast(t(res.msg) + (res.user ? ' — ' + res.user : ''));
      const next = new URLSearchParams(location.search).get('next');
      location.href = next ? decodeURIComponent(next) : 'dashboard.html';
    } catch (ex) {
      err('auth.err.empty');
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('');
    /* already signed in? go straight in */
    const sess = A.session();
    const next = new URLSearchParams(location.search).get('next');
    if (sess) { location.replace(next ? decodeURIComponent(next) : 'dashboard.html'); return; }

    qsa('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.tab); });
    });
    qs('#auth-form').addEventListener('submit', submit);
    document.addEventListener('click', function (e) {
      const s = e.target.closest('[data-swap]');
      if (s) { e.preventDefault(); setMode(s.dataset.swap); }
    });
    qs('#pw-eye').addEventListener('click', function () {
      const p = qs('#password');
      p.type = p.type === 'password' ? 'text' : 'password';
      this.textContent = p.type === 'password' ? '👁' : '🙈';
    });
    qs('#password').addEventListener('input', function () {
      const s = A.strength(this.value);
      const bar = qs('#pw-bar');
      bar.style.width = s + '%';
      bar.style.background = s < 40 ? 'var(--bad)' : (s < 70 ? 'var(--gold)' : 'var(--ok)');
    });
    qs('#engine-note').textContent = A.engine + ' · ' + (A.cloudEnabled
      ? (I.state.lang === 'km' ? 'ភ្ជាប់ពពករួចរាល់' : 'cloud sync on')
      : (I.state.lang === 'km' ? 'រក្សាទុកក្នុងឧបករណ៍នេះ' : 'stored on this device'));
    setMode(location.hash === '#signup' ? 'signup' : 'signin');
    I.reveal();
  });
})();
