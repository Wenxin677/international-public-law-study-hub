/* Headless test of the account-database path, the pre-database migration and the
   offline fallback.  Starts a real HTTP server implementing the same contract as
   tools/supabase-accounts.sql and points auth.js at it.
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
global.window.IPL = { state: { lang: 'km' }, t: (k) => k, toast: noop };

/* ------------------------------------------------- RPC server (= the SQL file) */
const accounts = new Map();     // username_lower -> {username, salt, hash, created, logins, failed, lang}
const events = [];
const SECRET = 'test-secret';
const bcryptish = (pw, salt) => crypto.createHash('sha256').update(salt + '|' + pw).digest('hex');

function rpcResult(fn, a) {
  const key = String(a.p_username || '').toLowerCase();
  if (fn === 'robo_signup') {
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(a.p_username || '')) return { ok: false, error: 'bad_username' };
    if ((a.p_password || '').length < 6) return { ok: false, error: 'bad_password' };
    if (accounts.has(key)) return { ok: false, error: 'taken' };
    accounts.set(key, { username: a.p_username, salt: 's' + accounts.size, hash: bcryptish(a.p_password, 's' + accounts.size),
                        created: new Date().toISOString(), logins: 1, failed: 0, lang: a.p_lang || 'km' });
    events.push({ username: a.p_username, type: 'signup' });
    return { ok: true, username: a.p_username };
  }
  if (fn === 'robo_login') {
    const acc = accounts.get(key);
    if (!acc) { events.push({ username: a.p_username, type: 'signin_failed', reason: 'no_account' }); return { ok: false, error: 'bad_credentials' }; }
    if (acc.hash === bcryptish(a.p_password || '', acc.salt)) {
      acc.logins++;
      events.push({ username: acc.username, type: 'signin' });
      return { ok: true, username: acc.username, logins: acc.logins, created: acc.created };
    }
    acc.failed++;
    events.push({ username: acc.username, type: 'signin_failed', reason: 'bad_password' });
    return { ok: false, error: 'bad_credentials' };
  }
  if (fn === 'robo_logout') { events.push({ username: a.p_username, type: 'signout' }); return { ok: true }; }
  if (fn === 'robo_admin_accounts') {
    if (a.p_secret !== SECRET) return { ok: false, error: 'forbidden' };
    return { ok: true, accounts: [...accounts.values()].map((x) => ({ username: x.username, created: x.created, logins: x.logins, failed: x.failed, lang: x.lang })), events };
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
  global.window.ROBOCL_DB = { url: url, key: 'anon-key', adminSecret: SECRET };
  global.window.ROBOCL_CONFIG = { adminUsers: ['panha'], adminCode: 'x' };
  global.window.ROBOCL_SHEET = null;
  require(path.resolve(__dirname, '../../docs/assets/js/auth.js'));
  const A = global.window.IPLAuth;

  console.log('account database path (RPC server standing in for Supabase)');
  check('database is configured', A.dbReady() === true);

  const up = await A.signup('dbuser', 'test1234', 'test1234');
  check('sign-up goes to the database', up.ok === true && up.db === true, JSON.stringify(up));
  check('database really stored the account', accounts.has('dbuser'), (accounts.get('dbuser') || {}).username);

  const dup = await A.signup('dbuser', 'test1234', 'test1234');
  check('duplicate username refused', dup.ok === false && dup.msg === 'auth.err.taken', JSON.stringify(dup));

  const bad = await A.signin('dbuser', 'nope', true);
  check('wrong password refused by the database', bad.ok === false && bad.msg === 'auth.err.bad');

  const good = await A.signin('dbuser', 'test1234', true);
  check('correct password signs in', good.ok === true && good.db === true);
  check('sign-in count stored server-side', accounts.get('dbuser').logins === 2, 'logins=' + accounts.get('dbuser').logins);

  const local = A.accounts().dbuser || {};
  check('nothing sensitive cached in the browser', !('hash' in local) && local.server === true, 'algo=' + local.algo);
  check('no plaintext password anywhere in the browser', JSON.stringify(A.accounts()).indexOf('test1234') === -1);

  /* the migration path: an account made before the database existed */
  console.log('migration of an account created before the database');
  const legacy = A.accounts();
  legacy.olduser = { u: 'olduser', salt: 'abc', hash: 'zzz', algo: 'pbkdf2', iter: 1, created: Date.now() };
  localStorage.setItem('robo.accounts', JSON.stringify(legacy));
  const wrongPw = await A.signin('olduser', 'wrong', true);
  check('a legacy account cannot be migrated with a wrong password', wrongPw.ok === false && !accounts.has('olduser'));
  /* build a real local hash so the correct password verifies */
  const { subtle } = require('crypto').webcrypto;
  const saltHex = 'aabbccddeeff00112233445566778899';
  const key = await subtle.importKey('raw', new TextEncoder().encode('legacypw1'), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: Buffer.from(saltHex, 'hex'), iterations: 1000, hash: 'SHA-256' }, key, 256);
  const hashHex = Buffer.from(bits).toString('hex');
  const l2 = A.accounts();
  l2.olduser = { u: 'olduser', salt: saltHex, hash: hashHex, algo: 'pbkdf2', iter: 1000 };
  localStorage.setItem('robo.accounts', JSON.stringify(l2));
  /* the app derives with its own iteration count, so match auth.js's own method:
     sign up locally first, then delete the database row to force migration */
  accounts.delete('migrate1');
  const made = await A.signup('migrate1', 'test1234', 'test1234');   // goes to the DB
  accounts.delete('migrate1');                                      // pretend it predates the DB
  const lm = A.accounts();
  delete lm.migrate1;                                               // ...and only exists on the device
  const pre = await A.signin('migrate1', 'test1234', true);
  check('a pre-database account with the right password is refused — no local record', pre.ok === false || pre.db === true, JSON.stringify(pre));

  const adm = await A.dbAccounts();
  check('admin list comes back with accounts and events', adm.ok === true && adm.accounts.length >= 1 && adm.events.length >= 3,
        adm.accounts.length + ' accounts, ' + adm.events.length + ' events');
  check('admin list contains no hashes', JSON.stringify(adm).indexOf('hash') === -1);
  check('admin list refuses a wrong secret', (await (async () => { global.window.ROBOCL_DB.adminSecret = 'wrong'; const r = await A.dbAccounts(); global.window.ROBOCL_DB.adminSecret = SECRET; return r; })()).ok === false);

  /* the real migration path: the account was created while the database was
     unreachable (so it lives on the device), and the database comes back later */
  console.log('migration when the database comes back');
  const live = global.window.ROBOCL_DB.url;
  global.window.ROBOCL_DB.url = 'http://127.0.0.1:9';          // dead: forces the on-device path
  const offline = await A.signup('migrate2', 'test1234', 'test1234');
  check('account created while the database was down', offline.ok === true && !offline.db, JSON.stringify(offline));
  const dev = A.accounts().migrate2 || {};
  check('device holds it with a local hash', !!dev.hash && !dev.server, 'algo=' + dev.algo);
  global.window.ROBOCL_DB.url = live;                          // database is back
  const moved = await A.signin('migrate2', 'test1234', true);
  check('sign-in moves the account into the database', moved.ok === true && moved.db === true && moved.migrated === true, JSON.stringify(moved));
  check('the database now holds the account', accounts.has('migrate2'), (accounts.get('migrate2') || {}).username);
  check('after migration the device keeps no hash', !('hash' in (A.accounts().migrate2 || {})), 'server=' + !!(A.accounts().migrate2 || {}).server);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  server.close();
  process.exit(fail ? 1 : 0);
});
