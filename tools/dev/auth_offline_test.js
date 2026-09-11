/* Headless test of auth.js's database path and its offline fallback.
   Run:  node tools/dev/auth_offline_test.js
   Stubs just enough DOM for auth.js, points it at a dead database port, and
   checks that sign-up/sign-in still work from the on-device account. */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function memoryStore() {
  const m = Object.create(null);
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _raw: m };
}

global.window = global;
global.localStorage = memoryStore();
global.sessionStorage = memoryStore();
global.navigator = { userAgent: 'node-test' };
global.crypto = crypto.webcrypto;
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
global.location = { href: 'http://localhost/x', replace() {}, pathname: '/x' };
const noop = () => {};
global.document = {
  addEventListener: noop, removeEventListener: noop,
  querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, remove: noop }),
  body: { appendChild: noop, dataset: {} }, documentElement: { dataset: {} }
};
global.window.IPL = { state: { lang: 'km' }, t: (k) => k, toast: noop };

/* a database that is configured but unreachable (port 9 = discard) */
global.window.ROBOCL_DB = { url: 'http://127.0.0.1:9', key: 'dead-key', adminSecret: 's' };
global.window.ROBOCL_CONFIG = { adminUsers: ['panha'], adminCode: 'x' };
global.window.ROBOCL_SHEET = null;

require(path.resolve(__dirname, '../../docs/assets/js/auth.js'));

const A = global.window.IPLAuth;
let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

(async () => {
  console.log('auth.js with the account database unreachable');
  check('database is configured', A.dbReady() === true);

  const up = await A.signup('offlineuser', 'test1234', 'test1234');
  check('sign-up still succeeds (falls back on-device)', up.ok === true && !up.db, JSON.stringify(up));

  const rec = A.accounts()['offlineuser'] || {};
  check('on-device record was created', rec.u === 'offlineuser' && !!rec.hash, 'algo=' + rec.algo);
  check('no plaintext password stored', JSON.stringify(rec).indexOf('test1234') === -1);

  const bad = await A.signin('offlineuser', 'wrongpass', true);
  check('wrong password is rejected', bad.ok === false && bad.msg === 'auth.err.bad', JSON.stringify(bad));

  const good = await A.signin('offlineuser', 'test1234', true);
  check('correct password signs in', good.ok === true, (A.session() || {}).u);

  const adm = await A.dbAccounts();
  check('the admin panel reports the database is unreachable', adm.ok === false, adm.error);

  /* a database-backed account cannot be verified offline — it must say so */
  localStorage.setItem('robo.accounts', JSON.stringify({ dbonly: { u: 'dbonly', server: true, algo: 'bcrypt (database)' } }));
  const srv = await A.signin('dbonly', 'whatever', true);
  check('database account offline gives a clear message', srv.ok === false && srv.msg === 'auth.err.offline', JSON.stringify(srv));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
