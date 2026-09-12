/* ==========================================================================
   auth.js — username + password accounts for RoboCL
   · passwords are never stored: only a PBKDF2-SHA256 hash + random salt
   · works offline (file://) via a pure-JS SHA-256 fallback when crypto.subtle
     is unavailable, which is the case for local files in some browsers
   · optional cloud sync (Supabase) so sign-ups/sign-ins reach the owner —
     only the username and the event are sent, never the password or its hash
   ========================================================================== */
(function () {
  'use strict';

  const STORE = { accounts: 'robo.accounts', events: 'robo.events', session: 'robo.session', seen: 'robo.seen' };
  const ITER_PBKDF2 = 120000;
  const ITER_FALLBACK = 8000;      // pure-JS SHA-256 is slower per round

  const CFG = Object.assign({
    /* no defaults that could be mistaken for security: the owner sets these in
       docs/data/config.js (adminCodeHash, never a plaintext code) */
    adminUsers: [],
    adminCodeHash: ''
  }, window.ROBOCL_CONFIG || {});

  const CLOUD = window.ROBOCL_CLOUD || null;
  const SHEET = window.ROBOCL_SHEET || null;
  const DB = window.ROBOCL_DB || null;

  /* ---------------------------------------------------------------- database */
  function dbReady() { return !!(DB && DB.url && DB.key); }
  function lang() { return (window.IPL && window.IPL.state && window.IPL.state.lang) || 'km'; }
  function deviceInfo() { return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'; }
  function userAgent() { return navigator.userAgent.slice(0, 180); }

  async function rpc(fn, args) {
    const url = String(DB.url).replace(/\/+$/, '') + '/rest/v1/rpc/' + fn;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': DB.key,
        'Authorization': 'Bearer ' + DB.key
      },
      body: JSON.stringify(args || {})
    });
    if (!res.ok) throw new Error('database ' + res.status);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : {};
  }

  /* a database account is remembered here by name only — no hash, because the
     password hash stays in the database and is never sent to a browser */
  function cacheServerAccount(username) {
    const accs = accounts();
    const key = String(username).toLowerCase();
    const prev = accs[key] || {};
    accs[key] = {
      u: username, server: true, created: prev.created || Date.now(),
      lastLogin: Date.now(), logins: (prev.logins || 0) + 1, algo: 'bcrypt (database)'
    };
    writeJSON(STORE.accounts, accs);
  }
  function isServerAccount(username) {
    const rec = accounts()[String(username || '').toLowerCase()];
    return !!(rec && rec.server);
  }

  /* ---------------------------------------------------------------- hashing */
  function bytesToHex(b) {
    let s = '';
    for (let i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return s;
  }
  function hexToBytes(h) {
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function randHex(n) {
    const b = new Uint8Array(n);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return bytesToHex(b);
  }
  function newToken() {
    return randHex(16) + '-' + Date.now().toString(36);
  }

  /* compact SHA-256 (fallback for file:// where crypto.subtle is missing) */
  function sha256(ascii) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const utf = unescape(encodeURIComponent(ascii));
    const len = utf.length;
    const words = [];
    for (let i = 0; i < len; i++) words[i >> 2] = (words[i >> 2] || 0) | (utf.charCodeAt(i) << (24 - (i % 4) * 8));
    words[len >> 2] = (words[len >> 2] || 0) | (0x80 << (24 - (len % 4) * 8));
    const total = (((len + 8) >> 6) + 1) * 16;
    while (words.length < total) words.push(0);
    words[total - 1] = len * 8;
    const rr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (let i = 0; i < words.length; i += 16) {
      const w = words.slice(i, i + 16);
      for (let j = 16; j < 64; j++) {
        const s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let j = 0; j < 64; j++) {
        const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [(H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0, (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0];
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  const canPBKDF2 = !!(window.crypto && window.crypto.subtle && window.isSecureContext !== false);

  async function derive(password, saltHex, iter, algo) {
    const enc = new TextEncoder();
    if (algo === 'pbkdf2' && window.crypto && crypto.subtle) {
      try {
        const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: iter, hash: 'SHA-256' }, key, 256);
        return bytesToHex(new Uint8Array(bits));
      } catch (e) { /* fall through to the JS path */ }
    }
    let h = sha256(saltHex + '|' + password);
    for (let i = 0; i < iter; i++) h = sha256(h + '|' + password + '|' + i);
    return h;
  }

  /* ---------------------------------------------------------------- storage */
  function readJSON(key, dflt) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? dflt : v; }
    catch (e) { return dflt; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function accounts() {
    const raw = readJSON(STORE.accounts, {});
    /* never trust the stored shape: drop anything that is not an account record,
       so a hand-edited or corrupted blob cannot break sign-in for everyone */
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    Object.keys(raw).forEach(function (k) {
      const v = raw[k];
      if (!v || typeof v !== 'object' || Array.isArray(v)) return;
      if (!v.u || typeof v.u !== 'string') return;
      out[k] = v;
    });
    return out;
  }
  function events() { return readJSON(STORE.events, []); }

  function logEvent(type, username, extra) {
    const list = events();
    const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    list.push(Object.assign({
      u: username, type: type, ts: Date.now(),
      device: device, ua: navigator.userAgent.slice(0, 120),
      lang: (window.IPL && window.IPL.state && window.IPL.state.lang) || 'km'
    }, extra || {}));
    while (list.length > 400) list.shift();
    writeJSON(STORE.events, list);
    cloud('events', collectorPayload(type, username));
    return list;
  }

  function cloud(table, payload) {
    /* throttle per event type: a sign-up immediately followed by a sign-in should
       still produce two rows, while a stuck loop cannot flood the collector */
    const kind = (payload && payload.type) || 'event';
    const now = Date.now();
    cloud._last = cloud._last || {};
    if (cloud._last[kind] && now - cloud._last[kind] < 700) return false;
    cloud._last[kind] = now;

    /* Google Sheets collector (Apps Script Web App).  Sent as text/plain so the
       browser does not send a CORS preflight, which Apps Script cannot answer.
       mode:'no-cors' makes it a fire-and-forget write — the row still lands. */
    if (SHEET && SHEET.url) {
      try {
        const body = Object.assign({}, payload);
        if (SHEET.token) body.token = SHEET.token;
        fetch(SHEET.url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
          keepalive: true
        }).catch(function () {});
      } catch (e) {}
    }
    if (!CLOUD || !CLOUD.url || !CLOUD.key) return true;
    const url = String(CLOUD.url).replace(/\/+$/, '') + '/rest/v1/' + (CLOUD.table || 'robo_users');
    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CLOUD.key,
          'Authorization': 'Bearer ' + CLOUD.key,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) {}
    return true;
  }

  /* what the collector sends: the username, the event and the device — never a
     password and never its hash */
  function collectorPayload(type, username) {
    return {
      username: username,
      type: type,
      ts: Date.now(),
      device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      user_agent: navigator.userAgent.slice(0, 180),
      lang: (window.IPL && window.IPL.state && window.IPL.state.lang) || 'km'
    };
  }

  /** status for the admin page: which collector, if any, is configured */
  function collectorStatus() {
    if (SHEET && SHEET.url) return { kind: 'sheet', url: SHEET.url };
    if (CLOUD && CLOUD.url && CLOUD.key) return { kind: 'supabase', url: CLOUD.url };
    return { kind: 'local', url: '' };
  }

  /** send one row so the owner can confirm the sheet is receiving */
  function testCollector() {
    const st = collectorStatus();
    if (st.kind === 'local') return false;
    /* bypass the throttle: this is an explicit one-off from the owner */
    cloud._last = {};
    return !!cloud('collector', collectorPayload('test', 'test-row'));
  }

  /* ---------------------------------------------------------------- owner code */
  /** constant-time compare, so the gate cannot be timed */
  function sameSecret(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
  /** Check the owner code against what config.js holds. Prefers the slow PBKDF2
   *  format written by tools/admin_code.py ("pbkdf2$<iter>$<salt>$<hash>"),
   *  and still accepts a plain SHA-256 hex if someone made one that way. */
  async function verifyCode(code, stored) {
    if (!stored || !code) return false;
    const parts = String(stored).split('$');
    if (parts.length === 4 && parts[0] === 'pbkdf2') {
      const iter = parseInt(parts[1], 10) || ITER_PBKDF2;
      const got = await derive(code, parts[2], iter, 'pbkdf2');
      const want = parts[3];
      return !!got && sameSecret(got, want);
    }
    return sameSecret(sha256(code), String(stored));
  }
  const CODE_AFTER = 5;                 // wrong owner codes before a pause
  const CODE_LOCK_MS = 5 * 60 * 1000;
  function codeFailures() { return readJSON('robo.codefails', { count: 0, until: 0 }); }
  function codeLocked() {
    const rec = codeFailures();
    if (rec.until && rec.until < Date.now()) { writeJSON('robo.codefails', { count: 0, until: 0 }); return false; }
    return !!(rec.until && rec.until > Date.now());
  }
  function noteCodeFailure() {
    const rec = codeFailures();
    if (rec.until && rec.until < Date.now()) { rec.count = 0; rec.until = 0; }
    rec.count = (rec.count || 0) + 1;
    if (rec.count >= CODE_AFTER) { rec.until = Date.now() + CODE_LOCK_MS; rec.count = 0; }
    writeJSON('robo.codefails', rec);
    return rec;
  }
  function clearCodeFailures() { writeJSON('robo.codefails', { count: 0, until: 0 }); }

  /* ---------------------------------------------------------------- session */
  function session() {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem(STORE.session) || 'null'); } catch (e) {}
    if (!s) s = readJSON(STORE.session, null);
    if (!s || !s.u || !s.t) return null;
    if (s.exp && s.exp < Date.now()) { signout(); return null; }
    return s;
  }
  function isAdmin() {
    const s = session();
    if (!s) return false;
    return CFG.adminUsers.indexOf(String(s.u).toLowerCase()) >= 0;
  }

  /* ---------------------------------------------------------------- validation */
  const USER_RE = /^[a-zA-Z0-9_.]{3,20}$/;
  const MIN_PASS = 8;                 // was 6 — short passwords are the easiest to guess
  const MAX_PASS = 128;               // refuse absurd input instead of hashing megabytes
  const LOCK_AFTER = 5;               // failed attempts before a temporary lock
  const LOCK_MS = 10 * 60 * 1000;     // 10 minutes

  function validate(username, password, confirm, isNew) {
    if (!username || !password) return { ok: false, msg: 'auth.err.empty' };
    if (!USER_RE.test(username)) {
      /* say what is actually wrong: the length or the characters */
      return { ok: false, msg: String(username).length < 3 ? 'auth.err.short.user' : 'auth.err.user.chars' };
    }
    if (password.length < MIN_PASS) return { ok: false, msg: 'auth.err.short.pass' };
    if (password.length > MAX_PASS) return { ok: false, msg: 'auth.err.long.pass' };
    if (isNew && confirm != null && password !== confirm) return { ok: false, msg: 'auth.err.match' };
    return { ok: true };
  }

  /* ---- brute-force protection for on-device accounts (the database does its own) */
  function failures(username) {
    const all = readJSON('robo.fails', {});
    const rec = all[String(username || '').toLowerCase()];
    if (!rec) return { count: 0, first: 0, until: 0 };
    if (rec.until && rec.until < Date.now()) { delete all[String(username || '').toLowerCase()]; writeJSON('robo.fails', all); return { count: 0, first: 0, until: 0 }; }
    return rec;
  }
  function noteFailure(username) {
    const key = String(username || '').toLowerCase();
    const all = readJSON('robo.fails', {});
    const now = Date.now();
    const rec = all[key] || { count: 0, first: now, until: 0 };
    if (now - rec.first > LOCK_MS) { rec.count = 0; rec.first = now; }
    rec.count++;
    if (rec.count >= LOCK_AFTER) { rec.until = now + LOCK_MS; rec.count = 0; rec.first = now; }
    all[key] = rec;
    writeJSON('robo.fails', all);
    return rec;
  }
  function lockedOut(username) {
    const rec = failures(username);
    return !!(rec.until && rec.until > Date.now());
  }
  function clearFailures(username) {
    const all = readJSON('robo.fails', {});
    delete all[String(username || '').toLowerCase()];
    writeJSON('robo.fails', all);
  }
  function strength(pw) {
    let s = 0;
    if (pw.length >= 8) s += 30;
    if (pw.length >= 12) s += 20;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 20;
    if (/[0-9]/.test(pw)) s += 15;
    if (/[^A-Za-z0-9]/.test(pw)) s += 15;
    return Math.min(100, s);
  }

  /* ---------------------------------------------------------------- api */
  async function signup(username, password, confirm) {
    username = String(username || '').trim();
    const v = validate(username, password, confirm, true);
    if (!v.ok) return { ok: false, msg: v.msg };

    /* the database is the source of truth when it is configured */
    if (dbReady()) {
      try {
        const d = await rpc('robo_signup', {
          p_username: username, p_password: password, p_lang: lang(),
          p_device: deviceInfo(), p_ua: userAgent()
        });
        if (!d || !d.ok) {
          return { ok: false, msg: d && d.error === 'taken' ? 'auth.err.taken' : 'auth.err.short.user' };
        }
        cacheServerAccount(d.username);
        logEvent('signup', d.username, { algo: 'bcrypt (database)' });
        startSession(d.username, true);
        return { ok: true, msg: 'auth.created', user: d.username, db: true };
      } catch (e) {
        /* no connection → fall back to the on-device account below */
      }
    }

    const accs = accounts();
    if (accs[username.toLowerCase()]) return { ok: false, msg: 'auth.err.taken' };
    const algo = canPBKDF2 ? 'pbkdf2' : 'sha256';
    const iter = canPBKDF2 ? ITER_PBKDF2 : ITER_FALLBACK;
    const salt = randHex(16);
    const hash = await derive(password, salt, iter, algo);
    accs[username.toLowerCase()] = {
      u: username, salt: salt, hash: hash, algo: algo, iter: iter,
      created: Date.now(), lastLogin: Date.now(), logins: 1, admin: CFG.adminUsers.indexOf(username.toLowerCase()) >= 0
    };
    writeJSON(STORE.accounts, accs);
    logEvent('signup', username, { algo: algo });
    startSession(username, true);
    return { ok: true, msg: 'auth.created', user: username };
  }

  async function signin(username, password, remember) {
    username = String(username || '').trim();
    if (!username || !password) return { ok: false, msg: 'auth.err.empty' };
    if (lockedOut(username)) return { ok: false, msg: 'auth.err.locked' };

    if (dbReady()) {
      try {
        const d = await rpc('robo_login', {
          p_username: username, p_password: password, p_device: deviceInfo(),
          p_ua: userAgent(), p_lang: lang()
        });
        if (d && d.ok) {
          cacheServerAccount(d.username);
          clearFailures(d.username);
          logEvent('signin', d.username, { algo: 'bcrypt (database)' });
          startSession(d.username, remember !== false);
          return { ok: true, msg: 'auth.signedin', user: d.username, db: true };
        }
        if (d && d.error === 'locked') {
          logEvent('signin_failed', username, { reason: 'locked' });
          return { ok: false, msg: 'auth.err.locked' };
        }
        /* Not in the database — but if this browser already holds a valid account
           from before the database existed, move it across instead of locking the
           person out. The local password must verify first, so a wrong password
           can never create an account, and a name that is already taken in the
           database is refused by robo_signup. */
        const local = accounts()[username.toLowerCase()];
        if (local && !local.server && local.hash) {
          const check = await derive(password, local.salt, local.iter, local.algo);
          if (check === local.hash) {
            try {
              const moved = await rpc('robo_signup', {
                p_username: local.u || username, p_password: password, p_lang: lang(),
                p_device: deviceInfo(), p_ua: userAgent()
              });
              if (moved && moved.ok) {
                cacheServerAccount(moved.username);
                clearFailures(moved.username);
                logEvent('signin', moved.username, { migrated: true });
                startSession(moved.username, remember !== false);
                return { ok: true, msg: 'auth.signedin', user: moved.username, db: true, migrated: true };
              }
            } catch (e) { /* keep the on-device account below */ }
          }
        }
        noteFailure(username);
        logEvent('signin_failed', username, { reason: 'bad_password' });
        return { ok: false, msg: 'auth.err.bad' };
      } catch (e) {
        if (isServerAccount(username)) return { ok: false, msg: 'auth.err.offline' };
        /* otherwise fall through and try an on-device account */
      }
    }

    const accs = accounts();
    const rec = accs[username.toLowerCase()];
    if (!rec) { noteFailure(username); logEvent('signin_failed', username, { reason: 'no_account' }); return { ok: false, msg: 'auth.err.bad' }; }
    if (rec.server) return { ok: false, msg: 'auth.err.offline' };
    const hash = await derive(password, rec.salt, rec.iter, rec.algo);
    if (hash !== rec.hash) { noteFailure(username); logEvent('signin_failed', username, { reason: 'bad_password' }); return { ok: false, msg: 'auth.err.bad' }; }
    rec.lastLogin = Date.now();
    rec.logins = (rec.logins || 1) + 1;
    writeJSON(STORE.accounts, accs);
    clearFailures(username);
    logEvent('signin', rec.u, {});
    startSession(rec.u, remember !== false);
    return { ok: true, msg: 'auth.signedin', user: rec.u };
  }

  function startSession(username, remember) {
    const s = { u: username, t: newToken(), ts: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 14 };
    if (remember) {
      writeJSON(STORE.session, s);                 // durable: this device remembers you
      try { sessionStorage.setItem(STORE.session, JSON.stringify(s)); } catch (e) {}
    } else {
      /* "don't remember me" means the session dies with the tab: sessionStorage
         only, and the durable copy is removed */
      localStorage.removeItem(STORE.session);
      try { sessionStorage.setItem(STORE.session, JSON.stringify(s)); } catch (e) {}
    }
    const accs = accounts();
    if (accs[username.toLowerCase()]) { accs[username.toLowerCase()].lang = (window.IPL && window.IPL.state.lang) || 'km'; writeJSON(STORE.accounts, accs); }
    return s;
  }

  function signout() {
    const s = session();
    if (s) {
      logEvent('signout', s.u, {});
      if (dbReady()) {
        try {
          rpc('robo_logout', { p_username: s.u, p_device: deviceInfo() }).catch(function () {});
        } catch (e) {}
      }
    }
    try { sessionStorage.removeItem(STORE.session); } catch (e) {}
    try { localStorage.removeItem(STORE.session); } catch (e) {}
    if (window.IPL) window.IPL.toast(window.IPL.t('auth.signedout'));
    setTimeout(function () { location.href = 'index.html'; }, 420);
  }

  /* ---------------------------------------------------------------- database admin */
  /** every account in the database — verified by the owner's own password
   *  (the SQL checks that the account is flagged is_admin), so no shared secret
   *  has to be published in this repository. */
  async function dbAccounts(ownerUsername, ownerPassword) {
    if (!dbReady()) return { ok: false, error: 'no_database' };
    if (!ownerUsername || !ownerPassword) return { ok: false, error: 'need_credentials' };
    try {
      const d = await rpc('robo_admin_accounts', {
        p_username: String(ownerUsername).trim(), p_password: ownerPassword
      });
      return d && d.ok ? d : { ok: false, error: (d && d.error) || 'error' };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  /* admin: everything the owner needs, from this browser */
  function report() {
    const accs = accounts(), evs = events();
    return {
      accounts: Object.keys(accs).map(function (k) {
        const a = accs[k];
        return {
          username: a.u, created: a.created, lastLogin: a.lastLogin, logins: a.logins || 0,
          admin: !!a.admin, algo: a.algo, onDevice: !a.server
        };
      }),
      events: evs.slice().reverse(),
      cloud: !!(CLOUD && CLOUD.url && CLOUD.key),
      exportAt: Date.now()
    };
  }
  function toCSV() {
    const r = report();
    const row = (window.IPL && window.IPL.csvRow) ? window.IPL.csvRow : function (cells) {
      return cells.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    };
    const lines = [row(['type', 'username', 'when', 'device', 'detail'])];
    r.accounts.forEach(function (a) {
      lines.push(row(['account', a.username, new Date(a.created).toISOString(), '', 'logins=' + a.logins + ' admin=' + a.admin]));
    });
    r.events.forEach(function (e) {
      lines.push(row([e.type, e.u, new Date(e.ts).toISOString(), e.device || '', e.reason || '']));
    });
    return lines.join('\n');
  }

  window.IPLAuth = {
    session: session, signup: signup, signin: signin, signout: signout,
    isAdmin: isAdmin, validate: validate, strength: strength,
    accounts: accounts, events: events, report: report, toCSV: toCSV,
    config: CFG, cloudEnabled: !!((CLOUD && CLOUD.url && CLOUD.key) || (SHEET && SHEET.url)),
    collectorStatus: collectorStatus, testCollector: testCollector,
    dbReady: dbReady, dbAccounts: dbAccounts, isServerAccount: isServerAccount,
    sha256Hex: sha256, lockedOut: lockedOut,
    verifyCode: verifyCode, codeLocked: codeLocked, noteCodeFailure: noteCodeFailure, clearCodeFailures: clearCodeFailures,
    engine: canPBKDF2 ? 'PBKDF2-SHA256 (120k rounds)' : 'SHA-256 iterated (offline fallback)'
  };
})();
