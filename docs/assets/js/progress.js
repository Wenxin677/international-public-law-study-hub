/* ==========================================================================
   progress.js — keeps a signed-in student's progress and notes in the database

   How it behaves
     · Not signed in, no database configured, or the request fails  →  the app
       keeps using its own on-device copy (localStorage), exactly as before.
       Nothing here can lose work you already did in the browser.
     · Signed in to a database account  →  every note, "studied" mark and quiz
       result is also written to the database by session token, so reopening the
       site on another device brings it along (pull on load, push on change).

   The database never trusts a username from the browser: the token decides whose
   rows are read or written, so a student can only ever touch their own.
   ========================================================================== */
(function () {
  'use strict';
  /* NB: window.IPLAuth must be resolved when a function RUNS, not when this file
     loads. progress.js is loaded before auth.js on some pages, and capturing it
     here left `A` undefined, so every page threw
     "Cannot read properties of undefined (reading 'sessionToken')". */
  const auth = () => window.IPLAuth || null;

  /** local progress may be ahead of the database: merge, never overwrite */
  function mergeRows(rows) {
    const I = window.IPL;
    const p = I.getProgress();
    p.lessons = p.lessons || {};
    p.quiz = p.quiz || {};
    (rows || []).forEach(function (r) {
      if (!r || !r.lesson) return;
      if (r.studied && !p.lessons[r.lesson]) p.lessons[r.lesson] = { ts: Date.parse(r.updated) || Date.now() };
      const q = p.quiz[r.lesson];
      if (r.best != null && (!q || r.best > q.best)) {
        p.quiz[r.lesson] = { best: r.best, total: r.total || (q && q.total) || 0, ts: Date.parse(r.updated) || Date.now(), wrong: (q && q.wrong) || [] };
      }
    });
    I.saveProgress(p);
    return p;
  }

  /** notes from the database fill only the lessons this device has empty */
  function mergeNotes(rows) {
    const I = window.IPL;
    const p = I.getProgress();
    p.notes = p.notes || {};
    (rows || []).forEach(function (r) {
      if (r && r.lesson && r.body && !p.notes[r.lesson]) p.notes[r.lesson] = r.body;
    });
    I.saveProgress(p);
  }

  /** push one change up; silently a no-op when there is no database session */
  function push(kind, payload) {
    const A = auth();
    const token = A && A.sessionToken ? A.sessionToken() : null;
    if (!token || !A.dbReady || !A.dbReady()) return false;
    try {
      if (kind === 'studied') {
        A.call('robo_progress_put', { p_token: token, p_lesson: payload.lesson, p_studied: true }).catch(function () {});
      } else if (kind === 'quiz') {
        A.call('robo_progress_put', { p_token: token, p_lesson: payload.lesson, p_best: payload.best, p_total: payload.total }).catch(function () {});
      } else if (kind === 'notes') {
        A.call('robo_notes_put', { p_token: token, p_lesson: payload.lesson, p_body: payload.body }).catch(function () {});
      }
      return true;
    } catch (e) { return false; }
  }

  /** bring this device's picture together with the database's */
  async function pull() {
    const A = auth();
    const token = A && A.sessionToken ? A.sessionToken() : null;
    if (!token || !A.dbReady || !A.dbReady()) return false;
    try {
      const prog = await A.call('robo_progress_get', { p_token: token });
      if (prog && prog.ok) mergeRows(prog.progress);
      const notes = await A.call('robo_notes_get', { p_token: token });
      if (notes && notes.ok) mergeNotes(notes.notes);
      /* whatever this device has that the database does not gets pushed up */
      const p = window.IPL.getProgress();
      Object.keys(p.notes || {}).forEach(function (id) { push('notes', { lesson: id, body: p.notes[id] }); });
      Object.keys(p.lessons || {}).forEach(function (id) { push('studied', { lesson: id }); });
      Object.keys(p.quiz || {}).forEach(function (id) {
        const q = p.quiz[id];
        if (q && q.best != null) push('quiz', { lesson: id, best: q.best, total: q.total });
      });
      return true;
    } catch (e) { return false; }
  }

  window.IPLProgress = { push: push, pull: pull };
})();
