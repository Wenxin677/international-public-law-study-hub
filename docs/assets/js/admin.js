/* ==========================================================================
   admin.js — the owner's view of accounts and sign-in records

   Two ways in, depending on how the site is set up:
     · a database is configured → the owner signs in with their own account
       password (verified inside the database; the account must be flagged
       is_admin). Nothing secret is published in the repository.
     · no database → the owner code is checked against a PBKDF2 hash in
       docs/data/config.js (make one with tools/admin_code.py), so the code
       itself never appears in the published source.
   Note: with no database this gate is a convenience only — the rows it reveals
   live in the visitor's own browser, never anywhere else.
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, A = window.IPLAuth;
  const t = I.t, esc = I.esc, qs = I.qs;

  let owner = null;          // database credentials, kept in memory only
  let dbData = null;         // the last result, so the CSV button works

  /* ---------------------------------------------------------------- gate */
  function gate() {
    const body = qs('#admin-body');

    if (A.dbReady()) {
      body.innerHTML =
        '<div class="card" style="max-width:560px">' +
        '<h3>' + esc(t('admin.owner')) + '</h3>' +
        '<p class="muted small">' + esc(t('admin.ownernote')) + '</p>' +
        '<div class="field"><label>' + esc(t('auth.username')) + '</label>' +
        '<input class="input" id="owner-user" autocomplete="username"></div>' +
        '<div class="field"><label>' + esc(t('auth.password')) + '</label>' +
        '<input class="input" id="owner-pass" type="password" autocomplete="current-password"></div>' +
        '<button class="btn primary block" id="go">' + esc(t('admin.enter')) + '</button>' +
        '<div class="notice bad" id="gate-err" role="alert" hidden></div>' +
        '<div class="small faint" style="margin-top:12px">' + esc(t('admin.ownerhint')) + '</div>' +
        '</div>';
      const submit = function () {
        const u = qs('#owner-user').value.trim(), p = qs('#owner-pass').value;
        if (!u || !p) { gateError(t('auth.err.empty')); return; }
        openWithCredentials(u, p);
      };
      qs('#go').addEventListener('click', submit);
      qs('#owner-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      return;
    }

    if (!(A.config && A.config.adminCodeHash)) {
      body.innerHTML =
        '<div class="card" style="max-width:620px">' +
        '<h3>' + esc(t('admin.setup')) + '</h3>' +
        '<p class="muted small">' + esc(t('admin.setuptext')) + '</p>' +
        '<pre class="reader-page" style="background:var(--bg-soft);padding:12px;border-radius:10px;white-space:pre-wrap">python tools/admin_code.py "your own code"\n\n→ paste the printed hash into\ndocs/data/config.js  →  adminCodeHash</pre>' +
        '<p class="muted small">' + esc(t('admin.setupwhy')) + '</p>' +
        '</div>';
      return;
    }

    body.innerHTML =
      '<div class="card" style="max-width:560px">' +
      '<h3>' + esc(t('admin.code')) + '</h3>' +
      '<div class="field"><input class="input" id="code" type="password" aria-label="' + esc(t('admin.code')) + '" placeholder="••••••••" autocomplete="off"></div>' +
      '<button class="btn primary block" id="go">' + esc(t('admin.enter')) + '</button>' +
      '<div class="notice bad" id="gate-err" role="alert" hidden></div>' +
      '<div class="notice" style="margin:16px 0 0">' + esc(t('admin.localonly')) + '</div>' +
      '<div class="small faint" style="margin-top:12px">' + esc(t('admin.hashnote')) + '</div>' +
      '</div>';
    const submit = async function () {
      if (A.codeLocked && A.codeLocked()) { gateError(t('admin.codelocked')); return; }
      const want = (A.config && A.config.adminCodeHash) || '';
      const close = qs('#code').value;
      const ok = A.verifyCode ? await A.verifyCode(close, want) : false;
      if (!ok) {
        if (A.noteCodeFailure) A.noteCodeFailure();
        gateError(t('admin.wrong'));
        return;
      }
      if (A.clearCodeFailures) A.clearCodeFailures();
      sessionStorage.setItem('robo.admin', '1');
      render();
    };
    qs('#go').addEventListener('click', submit);
    qs('#code').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function gateError(msg) {
    const box = qs('#gate-err');
    if (!box) { I.toast(msg); return; }
    box.textContent = msg;
    box.hidden = false;
  }

  /* ---------------------------------------------------------------- database */
  async function openWithCredentials(username, password) {
    const btn = qs('#go');
    if (btn) { btn.disabled = true; btn.textContent = t('common.loading'); }
    const d = await A.dbAccounts(username, password);
    if (btn) { btn.disabled = false; btn.textContent = t('admin.enter'); }
    if (!d.ok) {
      gateError(d.error === 'forbidden' ? t('admin.ownerdenied') : t('admin.dbfail') + ' — ' + (d.error || ''));
      return;
    }
    owner = { u: username, p: password };
    sessionStorage.setItem('robo.admin', '1');
    dbData = d;
    render();
    paintDb(d);
  }

  async function loadDatabase() {
    if (!owner) { gate(); return; }
    const out = qs('#db-out');
    if (out) out.innerHTML = '<div class="skel" style="height:70px"></div>';
    const d = await A.dbAccounts(owner.u, owner.p);
    if (!d.ok) {
      if (out) out.innerHTML = '<div class="notice bad">' + esc(t('admin.dbfail')) + ' — ' + esc(d.error || '') + '</div>';
      return;
    }
    dbData = d;
    paintDb(d);
  }

  function paintDb(d) {
    const out = qs('#db-out');
    if (!out) return;
    const accs = d.accounts || [], evs = d.events || [];
    out.innerHTML =
      '<div class="row" style="margin-bottom:10px">' +
      '<span class="pill">' + accs.length + ' ' + esc(t('admin.users')) + '</span>' +
      '<span class="pill gold">' + evs.length + ' ' + esc(t('admin.events')) + '</span>' +
      '<span class="spacer"></span><button class="btn sm" id="dbcsv">⬇ ' + esc(t('admin.export')) + '</button></div>' +
      '<div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>' + esc(I.state.lang === 'km' ? 'ឈ្មោះ' : 'Username') +
      '</th><th>' + esc(I.state.lang === 'km' ? 'បង្កើត' : 'Created') + '</th><th>' + esc(I.state.lang === 'km' ? 'ចូលចុងក្រោយ' : 'Last sign-in') +
      '</th><th>' + esc(I.state.lang === 'km' ? 'ចំនួនចូល' : 'Sign-ins') + '</th><th>' + esc(I.state.lang === 'km' ? 'បរាជ័យ' : 'Failed') +
      '</th><th>Lang</th></tr></thead><tbody>' +
      (accs.length ? accs.map(function (a, i) {
        return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(a.username) + '</b></td><td class="nowrap">' + esc(fmt(a.created)) +
          '</td><td class="nowrap">' + esc(fmt(a.last_login)) + '</td><td>' + (a.logins || 0) + '</td><td>' + (a.failed || 0) +
          '</td><td>' + esc(a.lang || '') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted">' + esc(t('admin.none')) + '</td></tr>') +
      '</tbody></table></div>' +
      (evs.length ? '<h4 style="margin:16px 0 8px">' + esc(t('admin.events')) + '</h4><div class="scroll-x"><table class="tbl">' +
        '<thead><tr><th>' + esc(I.state.lang === 'km' ? 'ពេលវេលា' : 'When') + '</th><th>' + esc(I.state.lang === 'km' ? 'ឈ្មោះ' : 'Username') +
        '</th><th>' + esc(I.state.lang === 'km' ? 'សកម្មភាព' : 'Action') + '</th><th>' + esc(I.state.lang === 'km' ? 'ឧបករណ៍' : 'Device') + '</th></tr></thead><tbody>' +
        evs.slice(0, 200).map(function (e) {
          return '<tr><td class="nowrap">' + esc(fmt(e.created)) + '</td><td>' + esc(e.username || '') + '</td><td>' + esc(e.type) +
            (e.reason ? ' <span class="faint">(' + esc(e.reason) + ')</span>' : '') + '</td><td>' + esc(e.device || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '');
    const csv = qs('#dbcsv');
    if (csv) csv.addEventListener('click', function () {
      const row = I.csvRow ? I.csvRow : function (c) { return c.join(','); };
      const lines = [row(['type', 'username', 'created', 'last_login', 'logins', 'failed', 'device', 'lang'])];
      accs.forEach(function (a) {
        lines.push(row(['account', a.username, a.created || '', a.last_login || '', a.logins || 0, a.failed || 0, '', a.lang || '']));
      });
      evs.forEach(function (e) {
        lines.push(row([e.type, e.username || '', e.created || '', '', '', '', e.device || '', '']));
      });
      I.download('robocl-accounts-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    });
    I.toast(t('admin.loaded') + ' ' + accs.length + ' ' + t('admin.users'));
  }

  /* ---------------------------------------------------------------- view */
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
      (st.kind === 'sheet' ? '<a class="btn sm" href="' + esc(st.url) + '" target="_blank" rel="noopener">🔗 ' + esc(t('admin.opencollector')) + '</a>' : '') +
      '<button class="btn sm" id="copy">⧉ ' + esc(t('admin.copy')) + '</button>' +
      '<button class="btn sm primary" id="csv">⬇ ' + esc(t('admin.export')) + '</button>' +
      '<button class="btn sm" id="lock">🔒 ' + esc(t('admin.lock')) + '</button>' +
      '</div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<h3>' + esc(t('admin.users')) + '</h3>' +
      '<p class="muted small">' + esc(t('admin.localonly')) + '</p>' +
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
      (A.dbReady()
        ? '<div class="card" id="db-card" style="margin-top:16px">' +
          '<h3>' + esc(t('admin.db')) + '</h3>' +
          '<p class="muted small">' + esc(t('admin.dbnote')) + '</p>' +
          '<button class="btn sm primary" id="loaddb">⬇ ' + esc(t('admin.loadacc')) + '</button>' +
          '<div id="db-out" style="margin-top:14px"></div></div>'
        : '') +
      '<div class="notice warn" style="margin-top:16px">' + esc(t('admin.hashnote')) + '</div>';

    qs('#csv').addEventListener('click', function () {
      I.download('robocl-browser-' + new Date().toISOString().slice(0, 10) + '.csv', A.toCSV(), 'text/csv;charset=utf-8');
    });
    qs('#copy').addEventListener('click', function () { I.copyText(JSON.stringify(A.report(), null, 2)); });
    qs('#lock').addEventListener('click', function () {
      owner = null;
      dbData = null;
      sessionStorage.removeItem('robo.admin');
      gate();
      I.toast(t('admin.locked'));
    });
    const tr = qs('#testrow');
    if (tr) tr.addEventListener('click', function () {
      /* the browser cannot read the Apps Script reply (no-cors), so never claim
         the row definitely landed — point the owner at the sheet instead */
      I.toast(A.testCollector() ? t('admin.testsent') : t('admin.notest'), 4200);
    });
    const lb = qs('#loaddb');
    if (lb) lb.addEventListener('click', loadDatabase);
  }

  function fmt(v) { return v ? I.fmtDate(v) : '—'; }

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('admin.html');
    /* An open session shows the panel; the database credentials are never kept
       anywhere except in memory for the length of this page. */
    if (sessionStorage.getItem('robo.admin') === '1' && !A.dbReady()) render();
    else gate();
  });
})();
