/* ==========================================================================
   config.js — the site owner's settings (edit this file, nothing else)
   ========================================================================== */

/* Account whose name(s) get the admin page (user data).  Lower case. */
window.ROBOCL_CONFIG = {
  adminUsers: ['panha', 'sokpanha', 'sok_panha', 'admin'],
  /* the code that opens admin.html — change it to something only you know */
  adminCode: 'panha2026'
};

/* --------------------------------------------------------------------------
   OPTIONAL: collect sign-ups / sign-ins from every visitor's device.
   Without this, accounts + records stay in each visitor's own browser (which
   is what happens by default, and what the privacy note in the app promises).

   To turn cloud sync on:
     1. create a free project at supabase.com
     2. in the SQL editor run the file tools/supabase.sql
     3. paste your project URL and the "anon public" key below
   Only the username, the event type and the device are sent — never the
   password and never its hash.
   -------------------------------------------------------------------------- */
window.ROBOCL_CLOUD = null;
/* example:
window.ROBOCL_CLOUD = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'eyJhbGciOi...anon-key...',
  table: 'robo_users'
};
*/
