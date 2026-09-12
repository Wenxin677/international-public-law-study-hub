/* Validate tools/supabase-accounts.sql on a real PostgreSQL engine (PGlite = the
   WASM Postgres Supabase itself uses) WITH pgcrypto, so the bcrypt calls, the
   lockout, RLS and the grants are all exercised for real — not stubbed.
   A Node stand-in for the RPC cannot catch a SQL syntax error, a wrong function
   signature or a missing grant; this can.

   Setup (once, in a scratch dir):
     mkdir "$LOCALAPPDATA/Temp/pglite-test" && cd "$LOCALAPPDATA/Temp/pglite-test"
     npm i @electric-sql/pglite
   Run:
     cd "$LOCALAPPDATA/Temp/pglite-test"
     NODE_PATH="$LOCALAPPDATA/Temp/pglite-test/node_modules" node "<repo>/tools/dev/sql_real_test.cjs"
*/
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

const SQL = fs.readFileSync(path.resolve(__dirname, '../../tools/supabase-accounts.sql'), 'utf8');

let pass = 0, fail = 0;
const problems = [];
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; problems.push(name); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}
const one = (rows) => (rows && rows[0]) ? Object.values(rows[0])[0] : undefined;
const val = async (db, sql, params) => one((await db.query(sql, params)).rows);

(async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const q = async (sql, params) => (await db.query(sql, params)).rows;

  console.log('='.repeat(72));
  console.log('REAL POSTGRES (PGlite + pgcrypto) — running the exact SQL file you will paste');
  console.log('='.repeat(72));
  console.log('  engine:', String(await val(db, 'select version()')).split(' on ')[0]);
  check('the engine has pgcrypto (bcrypt)',
    await val(db, "select exists(select 1 from pg_available_extensions where name='pgcrypto')") === true);

  await db.exec('create role anon; create role authenticated;');   // Supabase has these

  let ran = true, err = '';
  try { await db.exec(SQL); } catch (e) { ran = false; err = String(e.message).slice(0, 200); }
  check('the whole SQL file runs top to bottom', ran, err);
  if (!ran) { console.log('\nSTOP: the file she is about to paste does not run.\n'); process.exit(1); }

  console.log('\n— the tables are locked (RLS on, no policies) —');
  check('RLS on robo_accounts', await val(db, "select relrowsecurity from pg_class where oid='public.robo_accounts'::regclass") === true);
  check('RLS on robo_events', await val(db, "select relrowsecurity from pg_class where oid='public.robo_events'::regclass") === true);
  check('no policy exists at all', Number(await val(db, "select count(*) from pg_policies where tablename in ('robo_accounts','robo_events')")) === 0);

  console.log('\n— what the public key (role anon) can and cannot do —');
  const asAnon = async (sql, params) => {
    try { const r = await q(sql, params); await db.exec('reset role'); return { ok: true, r }; }
    catch (e) { try { await db.exec('reset role'); } catch (_) {} return { ok: false, err: String(e.message) }; }
  };
  await db.exec('set role anon');
  let r = await asAnon('select count(*) from public.robo_accounts');
  check('anon CANNOT read robo_accounts', !r.ok && /permission denied/i.test(r.err), (r.err || '').slice(0, 60));
  await db.exec('set role anon');
  r = await asAnon('select count(*) from public.robo_events');
  check('anon CANNOT read robo_events', !r.ok && /permission denied/i.test(r.err), (r.err || '').slice(0, 60));
  await db.exec('set role anon');
  r = await asAnon("insert into public.robo_accounts(username, pwhash) values ('x','x')");
  check('anon CANNOT insert an account directly', !r.ok && /permission denied/i.test(r.err), (r.err || '').slice(0, 60));
  await db.exec('set role anon');
  r = await asAnon("select public.robo_signup('probe','probe12345','km','web','ua')");
  check('anon CAN call robo_signup', r.ok, r.err);

  /* the real signatures: signup(user,pass,lang,device,ua) · login(user,pass,device,ua,lang)
     · logout(user,device) · admin_accounts(user,pass) */
  const rpc = async (fn, ...args) => {
    try {
      return one((await db.query(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')})`, args)).rows);
    } catch (e) {
      return { threw: String(e.message).slice(0, 120) };
    }
  };

  console.log('\n— sign up —');
  check('password under 8 characters is refused',
    (await rpc('robo_signup', 'shorty', 'abc123', 'km', 'web', 'ua')).error === 'bad_password');
  check('a bad username is refused',
    (await rpc('robo_signup', 'a b!', 'test1234', 'km', 'web', 'ua')).error === 'bad_username');
  let out = await rpc('robo_signup', 'panha', 'test1234', 'km', 'phone', 'Chrome');
  check('sign-up works', out.ok === true, JSON.stringify(out).slice(0, 70));
  check('duplicate username refused', (await rpc('robo_signup', 'panha', 'test1234', 'km', 'web', 'ua')).error === 'taken');
  check('duplicates caught case-insensitively', (await rpc('robo_signup', 'PANHA', 'test1234', 'km', 'web', 'ua')).error === 'taken');
  const hash = await val(db, "select pwhash from robo_accounts where username_lower='panha'");
  check('the stored password is a real bcrypt hash', typeof hash === 'string' && hash.startsWith('$2'), String(hash).slice(0, 7) + '…');
  check('the password itself is not stored anywhere',
    !JSON.stringify(await q("select * from robo_accounts where username_lower='panha'")).includes('test1234'));
  check('a signup event is logged', Number(await val(db, "select count(*) from robo_events where type='signup'")) === 2);

  console.log('\n— sign in —');
  check('wrong password refused', (await rpc('robo_login', 'panha', 'nope', 'web', 'ua', 'km')).error === 'bad_credentials');
  check('the failure is counted on the account', Number(await val(db, "select failed from robo_accounts where username_lower='panha'")) === 1);
  check('an unknown username looks the same', (await rpc('robo_login', 'ghost', 'nope', 'web', 'ua', 'km')).error === 'bad_credentials');
  check('the right password signs in', (await rpc('robo_login', 'panha', 'test1234', 'phone2', 'ua', 'km')).ok === true);
  check('sign-in count kept server-side', Number(await val(db, "select logins from robo_accounts where username_lower='panha'")) === 2);
  check('last_login recorded', await val(db, "select last_login is not null from robo_accounts where username_lower='panha'") === true);
  check('the sign-in answer carries no hash',
    !JSON.stringify(await rpc('robo_login', 'panha', 'test1234', 'web', 'ua', 'km')).includes('pwhash'));

  console.log('\n— brute-force lockout, enforced by the database —');
  for (let i = 0; i < 8; i++) await rpc('robo_login', 'panha', 'wrong' + i, 'web', 'ua', 'km');
  check('after 8 failures even the right password is refused',
    (await rpc('robo_login', 'panha', 'test1234', 'web', 'ua', 'km')).error === 'locked');
  check('the lockout is recorded', Number(await val(db, "select count(*) from robo_events where type='signin_locked'")) >= 1);
  check('another username is unaffected', (await rpc('robo_login', 'probe', 'probe12345', 'web', 'ua', 'km')).ok === true);

  console.log("\n— the owner's account list —");
  check('null credentials refused', (await rpc('robo_admin_accounts', null, null)).error === 'forbidden');
  check('a normal account cannot list users', (await rpc('robo_admin_accounts', 'probe', 'probe12345')).error === 'forbidden');
  check('right account + wrong password refused', (await rpc('robo_admin_accounts', 'panha', 'wrongpass')).error === 'forbidden');
  await db.exec("update robo_accounts set is_admin = true where username_lower='panha'");
  const listed = await rpc('robo_admin_accounts', 'panha', 'test1234');
  check('owner (is_admin + real password) gets the list', listed.ok === true && listed.accounts.length === 2, (listed.accounts || []).length + ' accounts');
  check('the list has no password hash',
    !JSON.stringify(listed).includes('pwhash') && !JSON.stringify(listed).includes('$2'));
  check('the list shows what you need',
    ['username', 'created', 'last_login', 'logins', 'failed', 'admin'].every((k) => k in listed.accounts[0]),
    Object.keys(listed.accounts[0]).join(','));
  check('the list view is logged (audit trail)', Number(await val(db, "select count(*) from robo_events where type='admin_view'")) === 1);
  for (let i = 0; i < 8; i++) await rpc('robo_admin_accounts', 'panha', 'bad');
  check('repeated wrong owner passwords are throttled too',
    (await rpc('robo_admin_accounts', 'panha', 'test1234')).error === 'locked');

  console.log('\n— re-running the file (she will, when it is updated) —');
  let again = true, err2 = '';
  try { await db.exec(SQL); } catch (e) { again = false; err2 = String(e.message).slice(0, 160); }
  check('running the whole file a second time succeeds', again, err2);
  check('no leftover one-argument overload of the admin function',
    Number(await val(db, "select count(*) from pg_proc where proname='robo_admin_accounts'")) === 1);
  check('existing accounts survive the re-run', Number(await val(db, 'select count(*) from robo_accounts')) === 2);
  check('is_admin survives the re-run', await val(db, "select is_admin from robo_accounts where username_lower='panha'") === true);

  console.log('\n— the password-reset line from the guide (on an account that is not locked) —');
  await db.exec("update robo_accounts set pwhash = crypt('newpassword', gen_salt('bf',10)) where username_lower='probe'");
  const re = await rpc('robo_login', 'probe', 'newpassword', 'web', 'ua', 'km');
  check('after the reset the new password works', re.ok === true, JSON.stringify(re).slice(0, 80));
  check('the old password stops working after a reset',
    (await rpc('robo_login', 'probe', 'probe12345', 'web', 'ua', 'km')).error === 'bad_credentials');
  check('a locked account stays locked until the window passes (recovery is by time, not by reset)',
    (await rpc('robo_login', 'panha', 'newpassword', 'web', 'ua', 'km')).error === 'locked');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (problems.length) { console.log('failed checks:'); problems.forEach((p) => console.log('   -', p)); }
  await db.close();
  process.exit(fail ? 1 : 0);
})();
