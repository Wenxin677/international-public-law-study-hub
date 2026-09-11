/* Sanity check: the hash shipped in docs/data/config.js accepts the owner's real
   code (passed as an argument) and refuses a wrong one — run after changing it.
   Usage:  node tools/dev/owner_code_check.js "the-owner-code"                   */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = () => { const m = Object.create(null); return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
global.window = global;
global.localStorage = store();
global.sessionStorage = store();
global.navigator = { userAgent: 'node-check' };
global.crypto = crypto.webcrypto;
global.TextEncoder = require('util').TextEncoder;
global.location = { href: 'http://localhost/x', replace() {} };
global.window.IPL = { state: { lang: 'en' }, t: (k) => k, toast: () => {} };

const cfgSrc = fs.readFileSync(path.resolve(__dirname, '../../docs/data/config.js'), 'utf8');
const m = cfgSrc.match(/adminCodeHash:\s*'([^']*)'/);
global.window.ROBOCL_CONFIG = { adminCodeHash: m ? m[1] : '' };
require(path.resolve(__dirname, '../../docs/assets/js/auth.js'));

const code = process.argv[2];
const A = global.window.IPLAuth;
(async () => {
  const stored = global.window.ROBOCL_CONFIG.adminCodeHash;
  if (!stored) { console.log('✗ no adminCodeHash in config.js — nobody can open admin.html'); process.exit(1); }
  if (!code) { console.log('usage: node tools/dev/owner_code_check.js "<owner code>"'); process.exit(2); }
  const ok = await A.verifyCode(code, stored);
  const bad = await A.verifyCode(code + 'x', stored);
  console.log((ok ? '✓' : '✗') + ' the owner code in config.js accepts the code you typed');
  console.log((!bad ? '✓' : '✗') + ' a wrong code is refused');
  console.log('  format: ' + stored.split('$').slice(0, 2).join('$') + '$…');
  process.exit(ok && !bad ? 0 : 1);
})();
