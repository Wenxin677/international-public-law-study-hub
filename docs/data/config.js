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

window.ROBOCL_SHEET = null;
/* example:
window.ROBOCL_SHEET = {
  url: 'https://script.google.com/macros/s/AKfycb.../exec'
};
*/

window.ROBOCL_CLOUD = null;
/* example:
window.ROBOCL_CLOUD = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'eyJhbGciOi...anon-key...',
  table: 'robo_users'
};
*/
