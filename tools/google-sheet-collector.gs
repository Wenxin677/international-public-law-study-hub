/**
 * RoboCL — sign-up / sign-in collector for Google Sheets
 * ============================================================================
 * WHAT THIS DOES
 *   Receives one small JSON message per sign-up / sign-in / sign-out from the
 *   RoboCL site and appends a row to this spreadsheet:
 *       time · username · event · device · user agent · language
 *   Passwords are never sent — the site only ever produces a salted hash
 *   inside the visitor's browser, and that hash never leaves it either.
 *
 * SET-UP (about three minutes)
 *   1. Create a Google Sheet (any name, e.g. "RoboCL users").
 *   2. In that sheet: Extensions → Apps Script.
 *   3. Delete the sample code, paste this whole file, click Save (💾).
 *   4. Click Deploy → New deployment.
 *        · Select type:  Web app
 *        · Description:   RoboCL collector
 *        · Execute as:    Me
 *        · Who has access: Anyone
 *      → Deploy, and approve the permissions prompt (it only needs to edit this
 *        spreadsheet; Google will warn that the script is "unverified" because
 *        you wrote it — that warning is expected for personal scripts).
 *   5. Copy the **Web app URL** (it ends with /exec).
 *   6. Put that URL into the site: docs/data/config.js → window.ROBOCL_SHEET
 *      = { url: 'https://script.google.com/macros/s/…/exec' }
 *      …or send it to whoever maintains the site and they will do it.
 *
 *   Re-deploying after an edit: Deploy → Manage deployments → ✏️ → Version:
 *   New version → Deploy. (The URL stays the same.)
 *
 * CHECKING IT WORKS
 *   · Open the /exec URL in a browser: it should say "RoboCL collector is running".
 *   · On the site, open admin.html and press "Send a test row".
 *   · Or run the function `testInsert` below once from the editor.
 */

var SHEET_NAME = 'signins';          // tab name; created automatically
var HEADERS = ['time', 'username', 'event', 'device', 'user agent', 'language', 'received'];

/**
 * Optional shared token. Leave it empty to accept every post (as before), or set
 * it to a random string AND put the same value in docs/data/config.js → token.
 * It is not real security (the value is visible in the site's source), but it
 * makes junk posts from strangers who merely found the URL pointless.
 */
var TOKEN = '';

function doGet() {
  return ContentService.createTextOutput('RoboCL collector is running');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json({ ok: false, error: 'busy' });
  }
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(raw);
    if (TOKEN && String(data.token || '') !== TOKEN) {
      return json({ ok: false, error: 'token' });        // not from our site
    }
    var row = [
      data.ts ? new Date(Number(data.ts)) : new Date(),
      String(data.username || ''),
      String(data.type || ''),
      String(data.device || ''),
      String(data.user_agent || ''),
      String(data.lang || ''),
      new Date()
    ];
    appendRow(row);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function appendRow(row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow(row);
  // keep the newest first in a second tab for easy reading
  var view = ss.getSheetByName('all users') || null;
  if (!view) {
    view = ss.insertSheet('all users');
    view.appendRow(['username', 'signed up', 'last seen', 'sign-ins', 'failed attempts']);
    view.getRange(1, 1, 1, 5).setFontWeight('bold');
    view.setFrozenRows(1);
    view.setColumnWidth(1, 160);
  }
  refreshSummary(view, sh);
}

/** rebuild the "all users" tab: one row per username with counts */
function refreshSummary(view, sh) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var rows = sh.getRange(2, 1, last - 1, 6).getValues();
  var byUser = {};
  rows.forEach(function (r) {
    var name = String(r[1] || '').trim();
    if (!name) return;
    var key = name.toLowerCase();
    var when = r[0] instanceof Date ? r[0].getTime() : new Date(r[0]).getTime();
    var ev = String(r[2] || '');
    var u = byUser[key] || (byUser[key] = { name: name, signup: 0, last: 0, signins: 0, failed: 0 });
    if (ev === 'signup') u.signup = u.signup || when;
    if (ev === 'signin') u.signins++;
    if (ev === 'signin_failed') u.failed++;
    if (when > u.last) u.last = when;
  });
  var out = Object.keys(byUser).sort(function (a, b) {
    return (byUser[b].last || 0) - (byUser[a].last || 0);
  }).map(function (k) {
    var u = byUser[k];
    return [u.name, u.signup ? new Date(u.signup) : '', u.last ? new Date(u.last) : '', u.signins, u.failed];
  });
  view.getRange(2, 1, Math.max(view.getMaxRows() - 1, out.length), 5).clearContent();
  if (out.length) {
    view.getRange(2, 1, out.length, 5).setValues(out);
    view.getRange(2, 2, out.length, 2).setNumberFormat('yyyy-mm-dd hh:mm');
  }
}

/** run this once from the editor to check the wiring */
function testInsert() {
  appendRow([new Date(), 'test-user', 'signup', 'desktop', 'Apps Script testInsert', 'km', new Date()]);
  Logger.log('row added — look at the "' + SHEET_NAME + '" tab');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
