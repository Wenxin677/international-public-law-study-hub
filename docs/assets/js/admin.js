/* admin.js — the owner's view of accounts and sign-in records */
(function () {
  'use strict';
  const I = window.IPL, A = window.IPLAuth;
  const t = I.t, esc = I.esc, qs = I.qs;

  function gate() {
    qs('#admin-body').innerHTML =
      '<div class="card" style="max-width:560px">' +
      '<h3>' + esc(t('admin.code')) + '</h3>' +
      '<div class="field"><input class="input" id="code" type="password" placeholder="••••••" autocomplete="off"></div>' +
      '<button class="btn primary block" id="go">' + esc(t('admin.enter')) + '</button>' +
      '<div class="notice" style="margin:16px 0 0">' + esc(I.state.lang === 'km'
        ? 'ទំព័រនេះបង្ហាញតែគណនីដែលបានបង្កើតនៅក្នុងកម្មវិធីរុករកនេះប៉ុណ្ណោះ។ ព័ត៌មាននៅក្នុងកម្មវិធីរុករកផ្សេង ឬទូរស័ព្ទ មិនឃើញនៅទីនេះទេ។'
        : 'This page only shows the accounts created in THIS browser. Sign-ups made in another browser or on a phone do not appear here.') + '</div>' +
      '<div class="small faint" style="margin-top:12px">' + esc(I.state.lang === 'km'
        ? 'កូដស្ថិតនៅក្នុង docs/data/config.js (អ្នកអាចប្តូរវាបាន)។ ចង់ប្រមូលពីគ្រប់ឧបករណ៍ សូមភ្ជាប់ Google Sheet ឬ Supabase — មើល tools/google-sheet-collector.gs។'
        : 'The code lives in docs/data/config.js (change it there). To collect sign-ups from every device, connect a Google Sheet or Supabase — see tools/google-sheet-collector.gs.') + '</div>' +
      '<div class="small faint" style="margin-top:10px">' + esc(I.state.lang === 'km'
        ? 'លេខសម្ងាត់មិនត្រូវបានរក្សាទុកទេ — មានតែកូដហាស (hash) ដែលមើលមិនយល់។'
        : 'Passwords are never stored — only an unreadable hash, so no password can be recovered from here.') + '</div>' +
      '</div>';
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
    const st = A.collectorStatus ? A.collectorStatus() : { kind: 'local', url: '' };
    const collectLabel = st.kind === 'sheet' ? t('admin.collector.sheet') : (st.kind === 'supabase' ? t('admin.collector.supabase') : t('admin.collector.local'));
    const host = qs('#admin-body');
    host.innerHTML =
      '<div class="row" style="margin-bottom:14px">' +
      '<span class="pill">' + r.accounts.length + ' ' + esc(t('admin.users')) + '</span>' +
      '<span class="pill gold">' + r.events.length + ' ' + esc(t('admin.events')) + '</span>' +
      '<span class="pill ' + (st.kind !== 'local' ? 'ok' : '') + '">' + (st.kind !== 'local' ? '☁ ' : '💾 ') + esc(collectLabel) + '</span>' +
      '<span class="pill ' + (A.dbReady() ? 'ok' : '') + '">' + (A.dbReady() ? '🗄 ' : '📴 ') +
      esc(A.dbReady() ? t('admin.dbOn') : t('admin.dbOff')) + '</span>' +
      '<span class="spacer"></span>' +
      (st.kind !== 'local' ? '<button class="btn sm" id="testrow">📨 ' + esc(t('admin.test')) + '</button>' : '') +
      (st.kind !== 'local' && st.kind === 'sheet' ? '<a class="btn sm" id="opencollector" href="' + esc(st.url) + '" target="_blank" rel="noopener">🔗 ' + esc(t('admin.opencollector')) + '</a>' : '') +
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
      '<div class="card" id="db-card" style="margin-top:16px">' +
      '<h3>' + esc(t('admin.db')) + '</h3>' +
      (A.dbReady()
        ? '<p class="muted small">' + esc(t('admin.dbnote')) + '</p>' +
          '<button class="btn sm primary" id="loaddb">⬇ ' + esc(t('admin.loadacc')) + '</button>' +
          '<div id="db-out" style="margin-top:14px"></div>'
        : '<p class="muted small">' + esc(t('admin.localonly')) + '</p>') +
      '</div>' +
      '<div class="notice warn" style="margin-top:16px">' + esc(t('admin.localonly')) + '</div>';
    qs('#csv').addEventListener('click', function () {
      I.download('robocl-users-' + new Date().toISOString().slice(0, 10) + '.csv', A.toCSV(), 'text/csv;charset=utf-8');
    });
    qs('#copy').addEventListener('click', function () {
      I.copyText(JSON.stringify(A.report(), null, 2));
    });
    const tr = qs('#testrow');
    if (tr) tr.addEventListener('click', function () {
      const sent = A.testCollector();
      I.toast(sent ? t('admin.tested') : t('admin.notest'));
    });
    const lb = qs('#loaddb');
    if (lb) lb.addEventListener('click', loadDb);
  }

  function fmt(v) { return v ? I.fmtDate(v) : '—'; }

  /* pull every account out of the database (usernames + activity, no hashes) */
  async function loadDb() {
    const out = qs('#db-out'), btn = qs('#loaddb');
    btn.disabled = true;
    out.innerHTML = '<div class="skel" style="height:70px"></div>';
    const d = await A.dbAccounts();
    btn.disabled = false;
    if (!d.ok) {
      out.innerHTML = '<div class="notice bad">' + esc(t('admin.dbfail')) + ' — ' + esc(d.error || '') + '</div>';
      return;
    }
    const accs = d.accounts || [], evs = d.events || [];
    out.innerHTML =
      '<div class="row" style="margin-bottom:10px">' +
      '<span class="pill">' + accs.length + ' ' + esc(t('admin.users')) + '</span>' +
      '<span class="pill gold">' + evs.length + ' ' + esc(t('admin.events')) + '</span>' +
      '<span class="spacer"></span><button class="btn sm" id="dbcsv">⬇ ' + esc(t('admin.export')) + '</button></div>' +
      '<div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>' + esc(I.state.lang === 'km' ? 'ឈ្មោះ' : 'Username') +
      '</th><th>' + esc(I.state.lang === 'km' ? 'បង្កើត' : 'Created') + '</th><th>' + esc(I.state.lang === 'km' ? 'ចូលចុងក្រោយ' : 'Last sign-in') +
      '</th><th>' + esc(I.state.lang === 'km' ? 'ចំនួនចូល' : 'Sign-ins') + '</th><th>' + esc(I.state.lang === 'km' ? 'បរាជ័យ' : 'Failed') + '</th><th>Lang</th></tr></thead><tbody>' +
      (accs.length ? accs.map(function (a, i) {
        return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(a.username) + '</b></td><td class="nowrap">' + esc(fmt(a.created)) +
          '</td><td class="nowrap">' + esc(fmt(a.last_login)) + '</td><td>' + (a.logins || 0) + '</td><td>' + (a.failed || 0) +
          '</td><td>' + esc(a.lang || '') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted">' + esc(t('admin.none')) + '</td></tr>') +
      '</tbody></table></div>' +
      (evs.length ? '<h4 style="margin:16px 0 8px">' + esc(t('admin.events')) + '</h4><div class="scroll-x"><table class="tbl">' +
        '<thead><tr><th>' + esc(t('admin.events')) + '</th><th>' + esc(I.state.lang === 'km' ? 'ឈ្មោះ' : 'Username') +
        '</th><th>' + esc(I.state.lang === 'km' ? 'សកម្មភាព' : 'Action') + '</th><th>' + esc(I.state.lang === 'km' ? 'ឧបករណ៍' : 'Device') + '</th></tr></thead><tbody>' +
        evs.slice(0, 200).map(function (e) {
          return '<tr><td class="nowrap">' + esc(fmt(e.created)) + '</td><td>' + esc(e.username || '') + '</td><td>' + esc(e.type) +
            (e.reason ? ' <span class="faint">(' + esc(e.reason) + ')</span>' : '') + '</td><td>' + esc(e.device || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '');
    qs('#dbcsv').addEventListener('click', function () {
      const lines = ['type,username,created,last_login,logins,failed,device,lang'];
      accs.forEach(function (a) {
        lines.push(['account', a.username, a.created || '', a.last_login || '', a.logins || 0, a.failed || 0, '', a.lang || ''].join(','));
      });
      evs.forEach(function (e) {
        lines.push([e.type, e.username || '', e.created || '', '', '', '', e.device || '', ''].join(','));
      });
      I.download('robocl-accounts-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    });
    I.toast(t('admin.loaded') + ' ' + accs.length + ' ' + t('admin.users'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* No account needed: this page only ever shows the data stored in THIS browser,
       so the owner code alone is the gate. */
    I.renderChrome('admin.html');
    if (sessionStorage.getItem('robo.admin') === '1') render(); else gate();
  });
})();
