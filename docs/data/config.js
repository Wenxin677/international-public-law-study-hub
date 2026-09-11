/* ==========================================================================
   config.js — the site owner's settings (edit this file, nothing else)
   ========================================================================== */

/* Account name(s) that get the admin page (user data).  Lower case. */
window.ROBOCL_CONFIG = {
  adminUsers: ['panha', 'sokpanha', 'sok_panha', 'admin'],
  /* the code that opens admin.html — change it to something only you know */
  adminCode: 'panha2026'
};

/* ==========================================================================
   COLLECTING SIGN-UPS AND SIGN-INS FROM EVERY VISITOR  (optional)

   A static site cannot receive anything by itself, so the app posts each
   sign-up / sign-in / sign-out to a place you own.  Two options — fill in ONE:

   A) GOOGLE SHEET  (recommended: nothing to sign up for, the data is a
      spreadsheet you already know how to read)
      1. create a Google Sheet, e.g. "RoboCL users"
      2. Extensions → Apps Script → paste tools/google-sheet-collector.gs
      3. Deploy → New deployment → Web app
           Execute as: Me     Who has access: Anyone
      4. copy the Web app URL (ends in /exec) and put it below

   B) SUPABASE  (a database; run tools/supabase.sql first)
      window.ROBOCL_CLOUD = { url: 'https://xxxx.supabase.co', key: 'anon-key' };

   What is sent: username, event (signup / signin / signin_failed / signout),
   device (mobile or desktop), browser string and the time.
   What is NEVER sent: the password, and the password hash. Those never leave
   the visitor's browser.

   If you collect anything, tell your users — the sign-up form shows a notice
   automatically as soon as one of these options is filled in.
   ========================================================================== */

/* ==========================================================================
   ACCOUNT DATABASE  (optional, recommended once you have real users)

   A static site cannot keep accounts by itself, so point the app at a
   PostgreSQL database you own. Supabase gives you one free in a couple of
   minutes, and the SQL is ready in tools/supabase-accounts.sql:

     1. create a project at supabase.com
     2. SQL editor → paste tools/supabase-accounts.sql → Run
        (that file also asks you to invent an admin secret — put the same value
         in adminSecret below)
     3. Project settings → API → copy the "Project URL" and the "anon public" key
     4. paste them below, then commit + push the site

   With this filled in, sign-up and sign-in happen in the database:
     · passwords are bcrypt-hashed inside it — never stored as text, never
       readable by you or anyone else
     · the browser only ever calls three functions (sign up, sign in, log out),
       so no password hash can be downloaded from the site
     · every device shares the same accounts; sign-in works on any phone
   Without it, accounts stay in each visitor's own browser (which also keeps
   working as an offline fallback even when this is configured).
   ========================================================================== */

window.ROBOCL_DB = null;
/* example:
window.ROBOCL_DB = {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  key: 'eyJhbGciOi...anon-public-key...',
  adminSecret: 'the-same-long-secret-you-put-in-the-sql-file'
};
*/

window.ROBOCL_SHEET = {
  url: 'https://script.google.com/macros/s/AKfycbwzfS6SnL59jVnPTkaKbYngi2aa1WXmGCNOsiPz8QWtu5boEwsZiRrZ6LAUmWco6LcWLQ/exec'
};
/* verified working 2026-09-11: GET returns "RoboCL collector is running" and an
   anonymous POST is accepted (302 → echo), which appends a row to the sheet. */

window.ROBOCL_CLOUD = null;
/* example:
window.ROBOCL_CLOUD = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'eyJhbGciOi...anon-key...',
  table: 'robo_users'
};
*/
