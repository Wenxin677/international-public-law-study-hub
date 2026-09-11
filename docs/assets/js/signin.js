/* signin.js — sign in / create account (username + password only) */
(function () {
  'use strict';
  const I = window.IPL, A = window.IPLAuth;
  const t = I.t, esc = I.esc, qs = I.qs;

  let mode = 'signin';

  /* Only ever redirect to a real page on this site. An unchecked ?next= turns
     the sign-in page into an open redirect (a phishing hop), and a
     javascript: value handed to location would be script execution. */
  function safeNext(raw) {
    let n = '';
    try { n = decodeURIComponent(raw || ''); } catch (e) { n = ''; }
    n = String(n).replace(/^\/+/, '');
    return /^[a-z0-9][\w.-]*\.html(?:[?#][\s\S]*)?$/i.test(n) ? n : 'dashboard.html';
  }

  function nextTarget() {
    return safeNext(new URLSearchParams(location.search).get('next'));
  }

  /* Forgotten password: a local account cannot be recovered (the password is
     never stored), so give people an honest way out instead of a dead end. */
  function clearDevice() {
    ['robo.accounts', 'robo.session', 'robo.events', 'robo.chats', 'robo.fails',
     'robo.progress', 'robo.notes', 'robo.seen', 'robo.codefails'].forEach(I.sDel);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.indexOf('robo.progress.') === 0) localStorage.removeItem(k);
      }
      sessionStorage.removeItem('robo.session');
    } catch (e) {}
    I.toast(t('auth.forgot.done'));
    setTimeout(function () { location.href = 'signin.html'; }, 800);
  }
  function forgot() {
    I.modal(t('auth.forgot.t'), '<p>' + esc(t('auth.forgot.d')) + '</p>',
      '<button class="btn" data-close>' + esc(t('common.close')) + '</button>' +
      '<button class="btn" id="wipe-device" style="color:var(--bad)">' + esc(t('auth.forgot.clear')) + '</button>');
    const wipe = I.qs('#wipe-device');
    if (wipe) wipe.addEventListener('click', function () {
      if (window.confirm(t('auth.forgot.confirm'))) clearDevice();
    });
  }

  function setMode(m) {
    mode = m;
    qsa('[data-tab]').forEach(function (b) {
      const on = b.dataset.tab === m;
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');   /* roving tabindex, as the tabs pattern expects */
    });
    const form = qs('#auth-form');
    if (form) { form.setAttribute('role', 'tabpanel'); form.setAttribute('aria-labelledby', 'tab-' + m); }
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
      location.href = nextTarget();
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
    if (sess) { location.replace(nextTarget()); return; }

    /* tabs: role="tab" is a promise — arrow keys must work too */
    const tabs = qsa('[data-tab]');
    tabs.forEach(function (b, i) {
      b.id = 'tab-' + b.dataset.tab;
      b.setAttribute('aria-controls', 'auth-form');
      b.setAttribute('tabindex', b.dataset.tab === mode ? '0' : '-1');
      b.addEventListener('click', function () { setMode(b.dataset.tab); });
      b.addEventListener('keydown', function (e) {
        const k = e.key;
        if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'Home' && k !== 'End') return;
        e.preventDefault();
        const to = k === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
          : k === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
            : k === 'Home' ? tabs[0] : tabs[tabs.length - 1];
        setMode(to.dataset.tab);
        to.focus();
      });
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
    /* be accurate: a sheet log is not cloud accounts */
    const st = (A.collectorStatus && A.collectorStatus()) || { kind: 'local' };
    const engineNote = (A.dbReady && A.dbReady()) ? t('auth.engine.db')
      : (st.kind && st.kind !== 'local' ? t('auth.engine.sheet') : t('auth.engine.local'));
    qs('#engine-note').textContent = A.engine + ' · ' + engineNote;
    /* a forgotten on-device password cannot be recovered — offer a way out */
    const alt = qs('#swap');
    if (alt) {
      const wrap = I.el('div', { class: 'small center', style: 'margin-top:8px' });
      const a = I.el('a', { href: '#', id: 'forgot-link', text: t('auth.forgot') });
      a.addEventListener('click', function (e) { e.preventDefault(); forgot(); });
      wrap.appendChild(a);
      alt.parentNode.insertBefore(wrap, alt.nextSibling);
    }
    /* be straight with users when the owner collects sign-in records */
    if (A.cloudEnabled && A.collectorStatus && A.collectorStatus().kind !== 'local') {
      const box = I.el('div', { class: 'notice warn', html: esc(t('auth.consent')) });
      const alt = qs('#swap');
      if (alt) alt.parentNode.insertBefore(box, alt);
    }
    setMode(location.hash === '#signup' ? 'signup' : 'signin');
    I.reveal();
  });
})();
