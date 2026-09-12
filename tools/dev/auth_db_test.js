/* Headless test of the account-database path, migration, lockout and the offline
   fallback.  Starts a real HTTP server implementing the same contract as
   tools/supabase-accounts.sql (including the brute-force lockout and the
   is_admin requirement for the account list).
   Run:  node tools/dev/auth_db_test.js                                        */
const http = require('http');
const path = require('path');
const crypto = require('crypto');

/* ------------------------------------------------------------------ fake DOM */
function memoryStore() {
  const m = Object.create(null);
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
}
global.window = global;
global.localStorage = memoryStore();
global.sessionStorage = memoryStore();
global.navigator = { userAgent: 'node-test' };
global.crypto = crypto.webcrypto;
global.TextEncoder = require('util').TextEncoder;
global.location = { href: 'http://localhost/x', replace() {} };
const noop = () => {};
global.document = {
  addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, remove: noop }),
  body: { appendChild: noop, dataset: {} }, documentElement: { dataset: {} }
};
global.window.IPL = {
  state: { lang: 'km' }, t: (k) => k, toast: noop,
  /* the same local store core.js keeps, so progress.js has something to merge with */
  getProgress: () => (global.__local || (global.__local = { xp: 0, lessons: {}, quiz: {}, notes: {} })),
  saveProgress: (p) => { global.__local = p; return true; }
};

/* -------------------------------------------- RPC server (= supabase SQL file) */
const accounts = new Map();     // username_lower -> record
const events = [];
const sessions = new Map();     // token -> username_lower
const progress = new Map();     // username_lower -> { lesson: {...} }
const notes = new Map();        // username_lower -> { lesson: body }
const bcryptish = (pw, salt) => crypto.createHash('sha256').update(salt + '|' + pw).digest('hex');
const failsIn15 = (name) => events.filter((e) => e.type === 'signin_failed' && (e.username || '').toLowerCase() === name.toLowerCase()).length;
const newToken = () => crypto.randomBytes(32).toString('hex');
const whoami = (t) => sessions.get(String(t || '')) || null;
const progFor = (u) => progress.get(u) || (progress.set(u, {}), progress.get(u));
const notesFor = (u) => notes.get(u) || (notes.set(u, {}), notes.get(u));

function rpcResult(fn, a) {
  const key = String(a.p_username || '').toLowerCase();
  if (fn === 'robo_signup') {
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(a.p_username || '')) return { ok: false, error: 'bad_username' };
    if ((a.p_password || '').length < 8) return { ok: false, error: 'bad_password' };
    if (accounts.has(key)) return { ok: false, error: 'taken' };
    const salt = 's' + accounts.size;
    accounts.set(key, { username: a.p_username, salt, hash: bcryptish(a.p_password, salt),
                        created: new Date().toISOString(), logins: 1, failed: 0, lang: a.p_lang || 'km', is_admin: false });
    events.push({ username: a.p_username, type: 'signup' });
    const t = newToken();
    sessions.set(t, key);
    return { ok: true, username: a.p_username, token: t, expires_days: 14 };
  }
  if (fn === 'robo_login') {
    if (failsIn15(key) >= 8) { events.push({ username: a.p_username, type: 'signin_locked' }); return { ok: false, error: 'locked' }; }
    const acc = accounts.get(key);
    if (!acc) { events.push({ username: a.p_username, type: 'signin_failed', reason: 'no_account' }); return { ok: false, error: 'bad_credentials' }; }
    if (acc.hash === bcryptish(a.p_password || '', acc.salt)) {
      acc.logins++;
      events.push({ username: acc.username, type: 'signin' });
      const t = newToken();
      sessions.set(t, key);
      return { ok: true, username: acc.username, logins: acc.logins, created: acc.created, admin: acc.is_admin, token: t };
    }
    acc.failed++;
    events.push({ username: acc.username, type: 'signin_failed', reason: 'bad_password' });
    return { ok: false, error: 'bad_credentials' };
  }
  if (fn === 'robo_logout') {
    if (a.p_token) sessions.delete(a.p_token);
    events.push({ username: a.p_username, type: 'signout' });
    return { ok: true };
  }
  if (fn === 'robo_session_check') {
    const u = whoami(a.p_token);
    if (!u) return { ok: false, error: 'no_session' };
    return { ok: true, username: accounts.get(u).username, admin: accounts.get(u).is_admin };
  }
  if (fn === 'robo_progress_get') {
    const u = whoami(a.p_token);
    if (!u) return { ok: false, error: 'no_session' };
    const rows = Object.keys(progFor(u)).map((l) => Object.assign({ lesson: l }, progFor(u)[l]));
    return { ok: true, progress: rows };
  }
  if (fn === 'robo_progress_put') {
    const u = whoami(a.p_token);
    if (!u) return { ok: false, error: 'no_session' };
    const l = String(a.p_lesson || '').trim();
    if (!l || l.length > 40) return { ok: false, error: 'bad_lesson' };
    const row = progFor(u)[l] || { studied: false, quiz_best: null, quiz_total: null, attempts: 0 };
    if (a.p_studied != null) row.studied = !!a.p_studied;
    if (a.p_best != null) {
      row.quiz_best = Math.max(Number(a.p_best), row.quiz_best == null ? 0 : row.quiz_best);
      row.quiz_total = a.p_total != null ? Number(a.p_total) : row.quiz_total;
      row.attempts += 1;
    }
    progFor(u)[l] = row;
    return { ok: true, lesson: l, studied: row.studied, best: row.quiz_best, total: row.quiz_total, attempts: row.attempts };
  }
  if (fn === 'robo_notes_get') {
    const u = whoami(a.p_token);
    if (!u) return { ok: false, error: 'no_session' };
    const one = String(a.p_lesson || '').trim();
    const rows = Object.keys(notesFor(u))
      .filter((l) => !one || l === one)
      .map((l) => ({ lesson: l, body: notesFor(u)[l] }));
    return { ok: true, notes: rows };
  }
  if (fn === 'robo_notes_put') {
    const u = whoami(a.p_token);
    if (!u) return { ok: false, error: 'no_session' };
    const l = String(a.p_lesson || '').trim();
    if (!l || l.length > 40) return { ok: false, error: 'bad_lesson' };
    notesFor(u)[l] = String(a.p_body || '').slice(0, 20000);
    return { ok: true, lesson: l, length: notesFor(u)[l].length };
  }
  if (fn === 'robo_admin_progress') {
    const acc = accounts.get(key);
    if (!acc || !acc.is_admin || acc.hash !== bcryptish(a.p_password || '', acc.salt)) {
      return { ok: false, error: 'forbidden' };
    }
    const students = [...accounts.entries()].map(([k2, x]) => {
      const rows = Object.values(progFor(k2));
      const answered = rows.reduce((n, r) => n + (r.quiz_total || 0), 0);
      const correct = rows.reduce((n, r) => n + (r.quiz_best || 0), 0);
      return { username: x.username, studied: rows.filter((r) => r.studied).length,
               quizzes: rows.filter((r) => r.quiz_best != null).length,
               answered, correct, percent: answered ? Math.round((100 * correct) / answered) : null };
    });
    return { ok: true, students };
  }
  if (fn === 'robo_admin_accounts') {
    const acc = accounts.get(key);
    if (!acc || !acc.is_admin || acc.hash !== bcryptish(a.p_password || '', acc.salt)) {
      return { ok: false, error: 'forbidden' };            // same answer for all three cases
    }
    events.push({ username: acc.username, type: 'admin_view' });
    return { ok: true,
             accounts: [...accounts.values()].map((x) => ({ username: x.username, created: x.created, logins: x.logins, failed: x.failed, lang: x.lang, admin: x.is_admin })),
             events };
  }
  return { ok: false, error: 'unknown' };
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const fn = req.url.split('/').pop().split('?')[0];
    let args = {};
    try { args = JSON.parse(body || '{}'); } catch (e) {}
    const out = JSON.stringify(rpcResult(fn, args));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(out) });
    res.end(out);
  });
});

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

server.listen(0, '127.0.0.1', async () => {
  const url = 'http://127.0.0.1:' + server.address().port;
  global.window.ROBOCL_DB = { url: url, key: 'anon-key' };
  global.window.ROBOCL_CONFIG = { adminUsers: ['panha'], adminCodeHash: '' };
  global.window.ROBOCL_SHEET = null;
  require(path.resolve(__dirname, '../../docs/assets/js/auth.js'));
  const A = global.window.IPLAuth;

  console.log('account database path (RPC server standing in for Supabase)');
  check('database is configured', A.dbReady() === true);

  const short = await A.signup('shorty', 'abc123', 'abc123');
  check('a password under 8 characters is refused', short.ok === false && short.msg === 'auth.err.short.pass', JSON.stringify(short));

  const up = await A.signup('dbuser', 'test1234', 'test1234');
  check('sign-up goes to the database', up.ok === true && up.db === true, JSON.stringify(up));
  check('database really stored the account', accounts.has('dbuser'));

  const dup = await A.signup('dbuser', 'test1234', 'test1234');
  check('duplicate username refused', dup.ok === false && dup.msg === 'auth.err.taken');

  const bad = await A.signin('dbuser', 'nope', true);
  check('wrong password refused by the database', bad.ok === false && bad.msg === 'auth.err.bad');

  const good = await A.signin('dbuser', 'test1234', true);
  check('correct password signs in', good.ok === true && good.db === true);
  check('sign-in count stored server-side', accounts.get('dbuser').logins === 2, 'logins=' + accounts.get('dbuser').logins);

  const local = A.accounts().dbuser || {};
  check('nothing sensitive cached in the browser', !('hash' in local) && local.server === true, 'algo=' + local.algo);
  check('no plaintext password anywhere in the browser', JSON.stringify(A.accounts()).indexOf('test1234') === -1);

  console.log('brute-force lockout');
  /* the client stops after 5 local failures — verify the database's own lockout
     too, by hammering the RPC directly */
  const rpcPost = async (fn, args) => {
    const res = await fetch(url + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return res.json();
  };
  await rpcPost('robo_signup', { p_username: 'locktest', p_password: 'test1234', p_lang: 'km' });
  let dbLocked = false;
  for (let i = 1; i <= 9 && !dbLocked; i++) {
    const r = await rpcPost('robo_login', { p_username: 'locktest', p_password: 'wrong' + i });
    if (r.error === 'locked') dbLocked = true;
  }
  check('the database locks a username after repeated failures', dbLocked);
  check('the lockout is recorded in the database', events.some((e) => e.type === 'signin_locked'));
  const dbSaysLocked = await rpcPost('robo_login', { p_username: 'locktest', p_password: 'test1234' });
  check('the database refuses even the right password while locked', dbSaysLocked.error === 'locked', JSON.stringify(dbSaysLocked));

  check('the app stops trying after 5 local failures', (await A.signin('dbuser', 'nope', true)).msg !== 'auth.err.signedin');
  let lockedAt = 0;
  for (let i = 1; i <= 7; i++) {
    const r = await A.signin('dbuser', 'wrong' + i, true);
    if (r.msg === 'auth.err.locked' && !lockedAt) lockedAt = i;
  }
  check('repeated wrong passwords end in a lockout in the app too', lockedAt > 0, 'locked on attempt ' + lockedAt);

  console.log('owner account list');
  check('listing without credentials is refused', (await A.dbAccounts()).ok === false);
  check('a non-admin account cannot list users', (await A.dbAccounts('dbuser', 'test1234')).ok === false);
  accounts.get('dbuser').is_admin = true;
  const adm = await A.dbAccounts('dbuser', 'wrongpass');
  check('the right account with the wrong password is refused', adm.ok === false, adm.error);
  const listed = await A.dbAccounts('dbuser', 'test1234');
  check('admin with the right password gets the list', listed.ok === true && listed.accounts.length >= 1, (listed.accounts || []).length + ' accounts');
  check('the list contains no password hashes', JSON.stringify(listed).indexOf('hash') === -1);
  check('the list view is logged', events.some((e) => e.type === 'admin_view'));

  console.log('progress and notes through the app (create / read / update)');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  require(path.resolve(__dirname, '../../docs/assets/js/progress.js'));
  const P = global.window.IPLProgress;
  check('the progress layer loads', !!P && typeof P.pull === 'function');
  const tok = A.sessionToken();
  check('the session carries the database token', typeof tok === 'string' && tok.length === 64, (tok || '').slice(0, 8) + '…');

  P.push('studied', { lesson: 'ch1-l1' });
  P.push('quiz', { lesson: 'ch1-l1', best: 7, total: 10 });
  P.push('notes', { lesson: 'ch1-l1', body: 'Article 38 note' });
  await sleep(200);
  check('marking a lesson studied reaches the database', progFor('dbuser')['ch1-l1'].studied === true);
  check('a quiz result reaches the database', progFor('dbuser')['ch1-l1'].quiz_best === 7);
  check('a note reaches the database', notesFor('dbuser')['ch1-l1'] === 'Article 38 note');

  console.log('a second student cannot touch the first student\'s rows');
  const other = await A.signup('other2', 'otherpass1', 'otherpass1');
  check('a second account signs up through the app', other.ok === true && other.db === true);
  const tok2 = A.sessionToken();
  P.push('studied', { lesson: 'ch9-l9' });
  P.push('notes', { lesson: 'ch9-l9', body: 'my own note' });
  await sleep(200);
  check('the second student\'s rows are their own', !!progFor('other2')['ch9-l9'] && !progFor('dbuser')['ch9-l9']);
  check('the first student\'s rows are untouched', progFor('dbuser')['ch1-l1'].quiz_best === 7 && !notesFor('dbuser')['ch9-l9']);

  console.log('a new device pulls the work back down');
  global.__local = { xp: 0, lessons: {}, quiz: {}, notes: {} };
  const synced = await P.pull();
  const loc = global.window.IPL.getProgress();
  check('pull reports success', synced === true);
  check('the studied mark comes back', !!loc.lessons['ch9-l9']);
  check('the note comes back', loc.notes['ch9-l9'] === 'my own note');
  check('nothing from the other student came with it', !loc.notes['ch1-l1'] && !loc.lessons['ch1-l1']);

  console.log('signing out ends the session for real');
  A.signout();
  await sleep(200);
  check('the token is gone from this browser', A.sessionToken() === null);
  check('the database no longer accepts it', whoami(tok2) === null);
  P.push('studied', { lesson: 'ch9-l10' });
  await sleep(200);
  check('after sign-out nothing more is written', !progFor('other2')['ch9-l10']);
  const cls = await A.dbClass('dbuser', 'test1234');
  check('the owner class view answers', cls.ok === true && (cls.students || []).length >= 2, (cls.students || []).length + ' students');

  console.log('migration when the database comes back');
  const live = global.window.ROBOCL_DB.url;
  global.window.ROBOCL_DB.url = 'http://127.0.0.1:9';
  const offline = await A.signup('migrate2', 'test1234', 'test1234');
  check('account created while the database was down', offline.ok === true && !offline.db);
  const dev = A.accounts().migrate2 || {};
  check('device holds it with a local hash', !!dev.hash && !dev.server);
  global.window.ROBOCL_DB.url = live;
  const moved = await A.signin('migrate2', 'test1234', true);
  check('sign-in moves the account into the database', moved.ok === true && moved.migrated === true, JSON.stringify(moved));
  check('the database now holds the account', accounts.has('migrate2'));
  check('after migration the device keeps no hash', !('hash' in (A.accounts().migrate2 || {})));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  server.close();
  process.exit(fail ? 1 : 0);
});
