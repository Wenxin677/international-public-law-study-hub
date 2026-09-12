/* End-to-end check of the SHIPPED client code against a LIVE Supabase project.
   Not a stub: it loads docs/assets/js/auth.js + progress.js unchanged and drives
   them over HTTPS against the real database, so it proves the PostgREST contract
   (parameter names, grants, token flow, RLS) that a local stand-in cannot.

   Run:  node tools/dev/live_db_check.js <project-url> <anon-or-publishable-key>
*/
const path = require('path');
const crypto = require('crypto');

const url = process.argv[2];
const key = process.argv[3];
if (!url || !key) { console.log('usage: node live_db_check.js <url> <key>'); process.exit(2); }

/* ------------------------------------------------------------------ fake DOM */
const store = () => { const m = Object.create(null); return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
global.window = global;
global.localStorage = store();
global.sessionStorage = store();
global.navigator = { userAgent: 'live-check' };
global.crypto = crypto.webcrypto;
global.TextEncoder = require('util').TextEncoder;
global.location = { href: 'https://example.test/', replace() {} };
const noop = () => {};
global.document = {
  addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, remove: noop }),
  body: { appendChild: noop, dataset: {} }, documentElement: { dataset: {} }
};
global.window.IPL = {
  state: { lang: 'en' }, t: (k) => k, toast: noop,
  getProgress: () => (global.__local || (global.__local = { xp: 0, lessons: {}, quiz: {}, notes: {} })),
  saveProgress: (p) => { global.__local = p; return true; }
};

global.window.ROBOCL_DB = { url: url, key: key };
global.window.ROBOCL_CONFIG = { adminUsers: [], adminCodeHash: '' };
global.window.ROBOCL_SHEET = null;
require(path.resolve(__dirname, '../../docs/assets/js/auth.js'));
require(path.resolve(__dirname, '../../docs/assets/js/progress.js'));

const A = global.window.IPLAuth;
const P = global.window.IPLProgress;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const problems = [];
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; problems.push(name); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}
const stamp = Date.now().toString().slice(-6);
const userA = 'setuptestA' + stamp;
const userB = 'setuptestB' + stamp;
const pwA = 'PanhaTest' + stamp;
const pwB = 'PanhaTest' + stamp;

(async () => {
  console.log('='.repeat(70));
  console.log('LIVE DATABASE: the shipped client code, against your real project');
  console.log('='.repeat(70));
  console.log('  project:', url);
  check('the client sees the database as configured', A.dbReady() === true);

  console.log('\n— signing up for real —');
  const up = await A.signup(userA, pwA, pwA);
  check('a new account is created in your database', up.ok === true && up.db === true, JSON.stringify(up));
  check('the browser kept a session token', typeof A.sessionToken() === 'string' && A.sessionToken().length === 64);
  const dup = await A.signup(userA, pwA, pwA);
  check('the same username is refused the second time', dup.ok === false);

  console.log('\n— signing in —');
  const bad = await A.signin(userA, 'wrongpassword', true);
  check('a wrong password is refused', bad.ok === false && bad.msg === 'auth.err.bad', JSON.stringify(bad));
  const good = await A.signin(userA, pwA, true);
  check('the right password signs in', good.ok === true && good.db === true);
  const who = await A.dbSession();
  check('the session is confirmed by the database', !!who && who.username.toLowerCase() === userA.toLowerCase());

  console.log('\n— progress and notes (create, read, update) —');
  P.push('studied', { lesson: 'ch1-l1' });
  P.push('quiz', { lesson: 'ch1-l1', best: 9, total: 10 });
  P.push('notes', { lesson: 'ch1-l1', body: 'Article 38 — live database test note' });
  await sleep(1200);
  global.__local = { xp: 0, lessons: {}, quiz: {}, notes: {} };      // wipe the device copy
  const pulled = await P.pull();
  const loc = global.window.IPL.getProgress();
  check('pull from your database succeeds', pulled === true);
  check('the studied mark came back', !!loc.lessons['ch1-l1']);
  check('the quiz score came back', !!loc.quiz['ch1-l1'] && loc.quiz['ch1-l1'].best === 9, JSON.stringify(loc.quiz['ch1-l1'] || {}));
  check('the note came back', loc.notes['ch1-l1'] === 'Article 38 — live database test note');

  console.log('\n— a second student cannot reach the first student\'s work —');
  const upB = await A.signup(userB, pwB, pwB);
  check('the second account is created', upB.ok === true);
  P.push('notes', { lesson: 'ch1-l1', body: 'B private note' });
  await sleep(1200);
  const seenB = await A.call('robo_notes_get', { p_token: A.sessionToken() });
  check('the second student sees only their own row', (seenB.notes || []).length === 1 && seenB.notes[0].body === 'B private note',
    JSON.stringify(seenB.notes));
  const asA = await A.signin(userA, pwA, true);
  await sleep(600);
  const seenA = await A.call('robo_notes_get', { p_token: A.sessionToken() });
  check('the first student\'s note is untouched', (seenA.notes || [])[0].body.includes('live database test note'), JSON.stringify(seenA.notes));
  const badTok = await A.call('robo_notes_put', { p_token: 'not-a-real-token', p_lesson: 'ch1-l1', p_body: 'hack' });
  check('a made-up token writes nothing', badTok.error === 'no_session');

  console.log('\n— the public key still cannot read the tables —');
  const res = await fetch(url + '/rest/v1/robo_progress?select=user_id&limit=1', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  const body = await res.text();
  check('direct table access is denied to the public key', res.status === 401 && /permission denied/i.test(body), 'HTTP ' + res.status + ' ' + body.slice(0, 60));
  const res2 = await fetch(url + '/rest/v1/rpc/robo_admin_accounts', {
    method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_username: userA, p_password: pwA })
  });
  const body2 = await res2.json();
  check('a normal account cannot list users', body2.error === 'forbidden', JSON.stringify(body2));

  console.log('\n— signing out really ends the session —');
  const tok = A.sessionToken();
  A.signout();
  await sleep(1200);
  check('the browser forgot the token', A.sessionToken() === null);
  const after = await A.call('robo_session_check', { p_token: tok });
  check('the database refuses the revoked token', after.error === 'no_session', JSON.stringify(after));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  console.log(`\nTest accounts created in your project (please delete them):`);
  console.log(`   ${userA}   ${userB}`);
  console.log(`   delete from robo_accounts where username_lower in ('${userA.toLowerCase()}','${userB.toLowerCase()}');`);
  if (problems.length) { console.log('\nfailed checks:'); problems.forEach((p) => console.log('   -', p)); }
  process.exit(fail ? 1 : 0);
})();
