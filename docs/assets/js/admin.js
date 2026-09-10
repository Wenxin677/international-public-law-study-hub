/* admin.js — the owner's view of accounts and sign-in records */
(function () {
  'use strict';
  const I = window.IPL, A = window.IPLAuth;
  const t = I.t, esc = I.esc, qs = I.qs;

  function gate() {
    qs('#admin-body').innerHTML =
      '<div class="card" style="max-width:460px">' +
      '<h3>' + esc(t('admin.code')) + '</h3>' +
      '<div class="field"><input class="input" id="code" type="password" placeholder="••••••" autocomplete="off"></div>' +
      '<button class="btn primary block" id="go">' + esc(t('admin.enter')) + '</button>' +
      '<div class="small faint" style="margin-top:10px">' + esc(I.state.lang === 'km'
        ? 'កូដលំនាំដើមគឺ panha2026 — អ្នកអាចប្តូរបានក្នុង docs/data/config.js'
        : 'Default code is panha2026 — change it in docs/data/config.js') + '</div></div>';
    qs('#go').addEventListener('click', tryOpen);
    qs('#code').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryOpen(); });
  }
  function tryOpen() {
    const code = qs('#code').value;
    if (!A || code !== (A.config.adminCode || '')) { I.toast(t('admin.wrong')); return; }
    sessionStorage.setItem('robo.admin', '1');
    render();
  }

  function render() {
    const r = A.report();
    const host = qs('#admin-body');
    host.innerHTML =
      '<div class="row" style="margin-bottom:14px">' +
      '<span class="pill">' + r.accounts.length + ' ' + esc(t('admin.users')) + '</span>' +
      '<span class="pill gold">' + r.events.length + ' ' + esc(t('admin.events')) + '</span>' +
      '<span class="pill ' + (r.cloud ? 'ok' : '') + '">' + (r.cloud ? '☁ ' + esc(t('admin.cloud')) : '💾 ' + esc(I.state.lang === 'km' ? 'ក្នុងឧបករណ៍' : 'local')) + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn sm" id="copy">⧉ ' + esc(t('admin.copy')) + '</button>' +
      '<button class="btn sm primary" id="csv">⬇ ' + esc(t('admin.export')) + '</button>' +
      '</div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<h3>' + esc(t('admin.users')) + '</h3>' +
      (r.accounts.length
        ? '<div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>Username</th><th>' +
          esc(I.state.lang === 'km' ? 'បង្កើត' : 'Created') + '</th><th>' + esc(I.state.lang === 'km' ? 'ចូលចុងក្រោយ' : 'Last sign-in') +
          '</th><th>' + esc(I.state.lang === 'km' ? 'ចំនួនចូល' : 'Sign-ins') + '</th><th>Admin</th></tr></thead><tbody>' +
          r.accounts.map(function (a, i) {
            return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(a.username) + '</b></td><td class="nowrap">' +
              esc(a.created ? I.fmtDate(a.created) : '—') + '</td><td class="nowrap">' +
              esc(a.lastLogin ? I.fmtDate(a.lastLogin) : '—') + '</td><td>' + (a.logins || 0) + '</td><td>' +
              (a.admin ? '✓' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="muted">' + esc(t('admin.none')) + '</div>') +
      '</div>' +
      '<div class="card">' +
      '<h3>' + esc(t('admin.events')) + '</h3>' +
      '<div class="scroll-x"><table class="tbl"><thead><tr><th>' + esc(I.state.lang === 'km' ? 'ពេលវេលា' : 'When') +
      '</th><th>' + esc(I.state.lang === 'km' ? 'ឈ្មោះ' : 'Username') + '</th><th>' + esc(I.state.lang === 'km' ? 'សកម្មភាព' : 'Action') +
      '</th><th>' + esc(I.state.lang === 'km' ? 'ឧបករណ៍' : 'Device') + '</th></tr></thead><tbody>' +
      (r.events.length ? r.events.slice(0, 200).map(function (e) {
        return '<tr><td class="nowrap">' + esc(I.fmtDate(e.ts)) + '</td><td>' + esc(e.u) + '</td><td>' +
          esc(e.type) + (e.reason ? ' <span class="faint">(' + esc(e.reason) + ')</span>' : '') + '</td><td>' + esc(e.device || '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">—</td></tr>') +
      '</tbody></table></div></div>' +
      '<div class="notice warn" style="margin-top:16px">' + esc(t('admin.localonly')) + '</div>';
    qs('#csv').addEventListener('click', function () {
      I.download('robocl-users-' + new Date().toISOString().slice(0, 10) + '.csv', A.toCSV(), 'text/csv;charset=utf-8');
    });
    qs('#copy').addEventListener('click', function () {
      I.copyText(JSON.stringify(A.report(), null, 2));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('admin.html');
    if (sessionStorage.getItem('robo.admin') === '1') render(); else gate();
  });
})();
