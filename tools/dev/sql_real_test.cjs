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

  console.log('\n— sessions: the token is what identifies a student —');
  const su = await rpc('robo_signup', 'alice', 'alicepass1', 'en', 'phone', 'Safari');
  check('sign-up hands back a session token', typeof su.token === 'string' && su.token.length === 64, (su.token || '').slice(0, 8) + '…');
  const alice = su.token;
  const li = await rpc('robo_login', 'probe', 'newpassword', 'laptop', 'Chrome', 'en');
  check('sign-in also hands back a token', typeof li.token === 'string' && li.token.length === 64);
  check('only the token hash is stored', Number(await val(db, "select count(*) from robo_sessions where token_hash = encode(digest($1,'sha256'),'hex')", [alice])) === 1);
  check('the raw token is nowhere in the table', Number(await val(db, 'select count(*) from robo_sessions where token_hash = $1', [alice])) === 0);
  const who = await rpc('robo_session_check', alice);
  check('a token identifies its owner', who.ok === true && who.username === 'alice');
  check('a made-up token identifies nobody', (await rpc('robo_session_check', 'deadbeef')).error === 'no_session');
  check('no token at all is refused', (await rpc('robo_progress_get', null)).error === 'no_session');

  console.log('\n— per-user progress (create, read, update) —');
  check('mark a lesson studied', (await rpc('robo_progress_put', alice, 'ch1-l1', true, null, null)).ok === true);
  let pg = await rpc('robo_progress_get', alice);
  check('it reads back', pg.ok === true && pg.progress.length === 1 && pg.progress[0].studied === true, JSON.stringify(pg.progress[0] || {}));
  check('saving a quiz result records the score', (await rpc('robo_progress_put', alice, 'ch1-l1', null, 8, 10)).best === 8);
  const worse = await rpc('robo_progress_put', alice, 'ch1-l1', null, 5, 10);
  check('a worse retake never overwrites the best score', worse.best === 8, 'best=' + worse.best);
  check('attempts are counted', worse.attempts === 2, 'attempts=' + worse.attempts);
  await rpc('robo_progress_put', alice, 'ch1-l2', true, null, null);
  pg = await rpc('robo_progress_get', alice);
  check('a second lesson adds a second row (no duplicates)', pg.progress.length === 2);
  check('a bogus lesson id is refused', (await rpc('robo_progress_put', alice, '', true, null, null)).error === 'bad_lesson');

  console.log('\n— per-user notes —');
  check('a note saves', (await rpc('robo_notes_put', alice, 'ch1-l1', 'Article 38 — sources of law')).ok === true);
  check('the note reads back', (await rpc('robo_notes_get', alice, 'ch1-l1')).notes[0].body.includes('Article 38'));
  check('editing replaces instead of duplicating',
    (await rpc('robo_notes_put', alice, 'ch1-l1', 'edited note')).ok === true &&
    (await rpc('robo_notes_get', alice)).notes.length === 1);
  check('a very long note is trimmed, not rejected',
    (await rpc('robo_notes_put', alice, 'ch2-l1', 'x'.repeat(25000))).length === 20000);

  console.log('\n— one student cannot reach another student\'s data —');
  const bob = (await rpc('robo_signup', 'bob', 'bobpass123', 'km', 'phone', 'Chrome')).token;
  const bobPg = await rpc('robo_progress_get', bob);
  check('a new student sees an empty progress list', bobPg.ok === true && bobPg.progress.length === 0);
  const bobNotes = await rpc('robo_notes_get', bob);
  check('a new student sees no notes', bobNotes.notes.length === 0);
  await rpc('robo_progress_put', bob, 'ch1-l1', true, 10, 10);
  const bobRow = (await rpc('robo_progress_get', bob)).progress[0];
  const aliceRow = (await rpc('robo_progress_get', alice)).progress.find((x) => x.lesson === 'ch1-l1');
  check('bob\'s identical lesson id writes his own row only', bobRow.best === 10 && aliceRow.best === 8, 'bob=' + bobRow.best + ' alice=' + aliceRow.best);
  check('the function takes no username, so another account cannot be named',
    Number(await val(db, "select count(*) from pg_proc where proname='robo_progress_get' and pg_get_function_arguments(oid) like '%p_username%'")) === 0);
  check('the tables are still unreachable directly',
    (await (async () => { await db.exec('set role anon'); const x = await asAnon('select count(*) from public.robo_progress'); return !x.ok && /permission denied/i.test(x.err); })()));

  console.log('\n— signing out really ends the session —');
  await rpc('robo_logout', 'alice', alice, 'phone');
  check('the token stops working', (await rpc('robo_session_check', alice)).error === 'no_session');
  check('the other student is unaffected', (await rpc('robo_session_check', bob)).ok === true);

  console.log('\n— the owner sees the class, not just the accounts —');
  /* the owner list was throttled on purpose earlier: clearing the lockout is the
     documented "someone mistyped" action, and it must work */
  await db.exec("delete from robo_events where type in ('admin_denied','signin_failed','signin_locked')");
  const acc = await rpc('robo_admin_accounts', 'panha', 'test1234');
  check('clearing the lock events lets the owner back in', acc.ok === true);
  const aliceRow2 = acc.accounts.find((a) => a.username === 'alice');
  check('the account list shows each student\'s activity',
    aliceRow2 && aliceRow2.studied === 2 && aliceRow2.quizzes === 1 && aliceRow2.notes === 2,
    JSON.stringify(aliceRow2 || {}));
  const cls = await rpc('robo_admin_progress', 'panha', 'test1234');
  const aliceCls = (cls.students || []).find((s) => s.username === 'alice');
  check('the class view shows studied / answered / correct / percent',
    !!aliceCls && aliceCls.studied === 2 && aliceCls.answered === 10 && aliceCls.correct === 8 && aliceCls.percent === 80,
    JSON.stringify(aliceCls || {}));
  const bobCls = (cls.students || []).find((s) => s.username === 'bob');
  check('a second student is listed separately', !!bobCls && bobCls.percent === 100, JSON.stringify(bobCls || {}));
  check('the class view refuses a normal account', (await rpc('robo_admin_progress', 'bob', 'bobpass123')).error === 'forbidden');
  check('the class view refuses a wrong password', (await rpc('robo_admin_progress', 'panha', 'nope')).error === 'forbidden');

  console.log('\n— deleting a student removes everything of theirs (cascade) —');
  check('alice has rows before the delete',
    Number(await val(db, "select count(*) from robo_progress p join robo_accounts a on a.id=p.user_id where a.username_lower='alice'")) === 2);
  await db.exec("delete from robo_accounts where username_lower='alice'");
  check('her progress rows are gone too',
    Number(await val(db, "select count(*) from robo_progress p join robo_accounts a on a.id=p.user_id where a.username_lower='alice'")) === 0);
  check('and her notes and sessions', Number(await val(db, 'select count(*) from robo_notes')) === 0 && Number(await val(db, 'select count(*) from robo_sessions')) >= 1);
  check('bob is untouched', (await rpc('robo_session_check', bob)).ok === true);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (problems.length) { console.log('failed checks:'); problems.forEach((p) => console.log('   -', p)); }
  await db.close();
  process.exit(fail ? 1 : 0);
})();
