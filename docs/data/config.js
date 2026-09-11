/* ==========================================================================
   config.js — the site owner's settings (edit this file, nothing else)
   ========================================================================== */

window.ROBOCL_CONFIG = {
  /* Usernames that count as "owner" accounts (lower case). Used for display and,
     with a database, to check who may open the account list. */
  adminUsers: ['panha', 'sokpanha', 'sok_panha'],

  /* The admin page (admin.html) asks for a code. Nothing secret is published any
     more: this is the SHA-256 hash of your code, so reading this file does not
     reveal it. Make your own with:

         python tools/admin_code.py "your long code here"

     and paste the hash between the quotes. Leave it empty to keep admin.html
     shut (it will show setup instructions instead). With a database configured,
     admin.html asks for your account password instead — stronger, and nothing
     has to live in this file at all. */
  adminCodeHash: 'pbkdf2$120000$c1fea35780954683b52092bd82ba625a$8da8c2b171f82d0424a359c7367462850c3efca78e782926384d1f5771fa664f'
};

/* ==========================================================================
   COLLECTING SIGN-UPS AND SIGN-INS FROM EVERY VISITOR  (optional)

   A static site cannot receive anything by itself, so the app posts each
   sign-up / sign-in / sign-out to a place you own. Two options — fill in ONE:

   A) GOOGLE SHEET  — the log you already have
      1. create a Google Sheet, e.g. "RoboCL users"
      2. Extensions → Apps Script → paste tools/google-sheet-collector.gs
      3. Deploy → New deployment → Web app
           Execute as: Me     Who has access: Anyone
      4. copy the Web app URL (ends in /exec) and put it below
      The script also accepts a shared "token"; set the same value in both places
      to make it ignore junk posts that do not carry it.

   B) ACCOUNT DATABASE — see the block below; it stores the accounts themselves

   What is sent: username, event (signup / signin / signin_failed / signout),
   device, browser string and the time.  What is NEVER sent: the password, and
   never a password hash.

   If you collect anything, tell your users — the sign-up form shows a notice
   automatically as soon as one of these options is filled in.
   ========================================================================== */

window.ROBOCL_SHEET = {
  url: 'https://script.google.com/macros/s/AKfycbwzfS6SnL59jVnPTkaKbYngi2aa1WXmGCNOsiPz8QWtu5boEwsZiRrZ6LAUmWco6LcWLQ/exec',
  /* optional shared token — keep the same value in the Apps Script (TOKEN) */
  token: ''
};
/* verified working 2026-09-11: GET returns "RoboCL collector is running" and an
   anonymous POST is accepted (302 → echo), which appends a row to the sheet. */

/* ==========================================================================
   ACCOUNT DATABASE  (recommended once you have real users)

   Point the app at a PostgreSQL database you own. Supabase gives you one free in
   a couple of minutes and the SQL is ready in tools/supabase-accounts.sql:

     1. create a project at supabase.com
     2. SQL editor → paste tools/supabase-accounts.sql → Run
     3. Project settings → API → copy "Project URL" and the "anon public" key
     4. paste them below, then commit + push the site
     5. sign up in the app with the username you want to be the owner, then run
        once in the SQL editor:   update robo_accounts set is_admin = true
                                  where username_lower = 'yourname';

   With this filled in, sign-up and sign-in happen in the database:
     · passwords are bcrypt-hashed inside it — never stored as text, never
       readable by you or anyone else
     · the browser may only call a few functions (sign up, sign in, log out), so
       no password hash can be downloaded from the site
     · admin.html asks for your owner password and can then list every account
     · every device shares the same accounts; sign-in works on any phone
   Without it, accounts stay in each visitor's browser (which also keeps working
   as an offline fallback even when this is configured).
   ========================================================================== */

window.ROBOCL_DB = null;
/* example:
window.ROBOCL_DB = {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  key: 'eyJhbGciOi...anon-public-key...'
};
*/
