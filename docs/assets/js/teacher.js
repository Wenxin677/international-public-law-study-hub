/* ==========================================================================
   teacher.js — RoboCL, the AI teacher
   A Claude-style chat over the app's own retrieval engine.  Nothing is
   invented: every claim in an answer is either a verbatim passage from a
   source document, or a key point / term definition authored from it.
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, S = window.IPLSearch, D = window.IPL_DATA;
  const t = I.t, esc = I.esc, qs = I.qs, qsa = I.qsa;

  const SRC = {
    textbook: { km: 'សៀវភៅសិក្សា', en: 'Textbook', cite: 'ឡាយ រត្តនា, ច្បាប់សាធារណៈអន្តរជាតិ (២០២១)', citeEn: 'Lay Rottana, International Public Law (2021)' },
    eccc: { km: 'ច្បាប់អេស៊ីស៊ីស៊ី', en: 'ECCC Law', cite: 'ECCC Law (2004)', citeEn: 'ECCC Law (2004)' },
    paris: { km: 'អនុសញ្ញាប៉ារីស', en: 'Paris Convention', cite: 'Paris Convention (1883/1979)', citeEn: 'Paris Convention (1883/1979)' }
  };

  const SUGGEST = {
    km: ['តើអធិបតេយ្យភាពជាអ្វី?', 'ប្រភពនៃច្បាប់អន្តរជាតិមានអ្វីខ្លះ?',
         'តើរដ្ឋមួយត្រូវមានលក្ខណៈវិនិច្ឆ័យអ្វីខ្លះ?',
         'តើកិច្ចព្រមព្រៀងទីក្រុងប៉ារីសឆ្នាំ១៩៩១ កំណត់អ្វី?',
         'តើសន្ធិសញ្ញាគឺជាអ្វី?', 'ពន្យល់ពីការទទួលស្គាល់រដ្ឋ'],
    en: ['What is sovereignty?', 'What are the sources of international law?',
         'What are the criteria of statehood?', 'What did the 1991 Paris Peace Agreements establish?',
         'What is a treaty under the Vienna Convention?', 'Explain recognition of states']
  };

  const VOICE = {
    km: {
      short: 'ជាសង្ខេប',
      why: 'ហេតុអ្វីបានជាដូច្នេះ',
      book: 'អត្ថបទដើមពីសៀវភៅ',
      remember: 'ចាំចំណុចនេះ',
      check: 'សាកល្បងខ្លួនឯង',
      related: 'មេរៀនពាក់ព័ន្ធ',
      sources: 'ប្រភពដែលបានប្រើ',
      closest: 'ខ្ញុំមិនឃើញចម្លើយផ្ទាល់ក្នុងសៀវភៅទេ ប៉ុន្តែនេះជាអត្ថបទជិតបំផុត៖',
      notfound: 'ខ្ញុំរកមិនឃើញរឿងនេះក្នុងឯកសារប្រភពទេ។ សូមសាកសួរខុសគ្នា ឬជ្រើសសំណួរគំរូខាងក្រោម។',
      found: 'ខ្ញុំរកឃើញអត្ថបទ',
      passages: 'កន្លែង',
      simHint: 'ខ្ញុំនិយាយខ្លីៗ ងាយយល់ជាងមុន៖',
      exHint: 'នេះជាឧទាហរណ៍ពីសៀវភៅ៖',
      moreHint: 'នេះជាចំណុចបន្ថែមពីសៀវភៅ៖',
      quizHint: 'សាកឆ្លើយសំណួរនេះ៖',
      fromLesson: 'មេរៀន'
    },
    en: {
      short: 'In short',
      why: 'Why this is so',
      book: 'Original text from the book',
      remember: 'Remember this',
      check: 'Check yourself',
      related: 'Related lessons',
      sources: 'Sources used',
      closest: 'I have no direct answer in the book, but this is the closest text:',
      notfound: 'I could not find this in the source documents. Try asking differently, or pick a sample question below.',
      found: 'I found',
      passages: 'passages',
      simHint: 'Here it is in simpler words:',
      exHint: 'Here is an example from the book:',
      moreHint: 'Here is more from the book:',
      quizHint: 'Try answering this:',
      fromLesson: 'Lesson'
    }
  };

  const state = { busy: false, chatId: null, msgs: [], stepTimer: null };

  /* ---------------------------------------------------------------- storage */
  function chatKey() {
    const s = window.IPLAuth && window.IPLAuth.session();
    return 'robo.chats.' + (s ? s.u.toLowerCase() : 'guest');
  }
  function allChats() {
    try { return JSON.parse(localStorage.getItem(chatKey()) || '[]'); } catch (e) { return []; }
  }
  function saveChats(list) {
    try { localStorage.setItem(chatKey(), JSON.stringify(list.slice(0, 40))); } catch (e) {}
  }
  function currentChat() {
    const list = allChats();
    return list.filter(function (c) { return c.id === state.chatId; })[0] || null;
  }
  function persist() {
    const list = allChats();
    const idx = list.findIndex(function (c) { return c.id === state.chatId; });
    const title = (state.msgs.filter(function (m) { return m.role === 'user'; })[0] || {}).text || t('teacher.newchat');
    const rec = { id: state.chatId, title: String(title).slice(0, 62), ts: Date.now(), msgs: state.msgs };
    if (idx >= 0) list[idx] = rec; else list.unshift(rec);
    saveChats(list);
    renderChatList();
  }

  /* ---------------------------------------------------------------- retrieval */
  function strongEnough(res) { return res.length && res[0].score > 1.15; }

  function collect(query) {
    const passages = S.searchCorpus(query, { limit: 8 });
    const docs = S.searchDocs(query, { limit: 8 });
    return { passages: passages, docs: docs, strong: strongEnough(passages) };
  }

  /* split a passage into the sentences that answer the question best */
  function evidenceFrom(passage, query, n) {
    return S.bestSentences(passage.chunk.text, query, n || 3).join(' ').trim();
  }

  function lessonOf(docs) {
    const d = docs.filter(function (x) { return x.doc.kind === 'lesson'; })[0];
    return d ? d.doc.lesson : null;
  }
  function termsOf(docs, n) {
    return docs.filter(function (x) { return x.doc.kind === 'term'; }).slice(0, n || 3).map(function (x) { return x.doc; });
  }

  /* ---------------------------------------------------------------- answer shape */
  function buildAnswer(query, kind) {
    const L = I.state.lang;
    const V = VOICE[L];
    const ctx = collect(kind === 'example' ? query + ' ឧទាហរណ៍ example' : query);
    const lesson = lessonOf(ctx.docs);
    const terms = termsOf(ctx.docs, 3);
    const out = { found: ctx.strong || !!lesson, query: query, kind: kind || 'normal', sections: [] };

    if (!ctx.strong && !lesson && !terms.length) {
      out.found = false;
      out.sections.push({ type: 'say', text: V.notfound });
      out.related = ctx.docs.filter(function (d) { return d.doc.kind === 'lesson'; })
        .map(function (d) { return d.doc.lesson; }).slice(0, 3);
      return out;
    }

    /* 1. the short answer: a glossary definition if we have one, else the book's own sentence */
    let short = '';
    if (terms.length && kind !== 'example') {
      const tm = terms[0];
      const def = L === 'km' ? (tm.defKm || tm.defEn) : (tm.defEn || tm.defKm);
      const head = L === 'km' ? tm.km : (tm.en || tm.km);
      short = (head ? head + ' — ' : '') + (def || '');
    }
    if (!short && ctx.passages.length) {
      short = evidenceFrom(ctx.passages[0], query, 2);
    }
    if (short) out.sections.push({ type: 'short', label: V.short, text: short });
    else out.sections.push({ type: 'say', text: V.closest });

    /* 2. why / explanation, from authored key points */
    if (kind !== 'example') {
      const pts = lesson ? ((L === 'km' ? lesson.keyPoints.km : lesson.keyPoints.en) || []).slice(0, 4) : [];
      if (pts.length) out.sections.push({ type: 'points', label: V.why, items: pts, lesson: lesson });
    }

    /* 3. verbatim evidence */
    const evCount = kind === 'more' ? 3 : (kind === 'example' ? 2 : 2);
    const evidence = ctx.passages.slice(0, Math.max(1, evCount)).map(function (p) {
      return {
        src: p.chunk.src, page: p.chunk.page, lang: p.chunk.lang,
        text: evidenceFrom(p, query, kind === 'example' ? 4 : 3),
        full: p.chunk.text
      };
    });
    if (evidence.length) out.sections.push({ type: 'evidence', label: V.book, items: evidence });

    /* 4. remember: a real key point or term, never invented */
    const remind = [];
    if (pts0(lesson, L).length) remind.push(pts0(lesson, L)[0]);
    if (terms[1]) {
      const tm = terms[1];
      const d = L === 'km' ? (tm.defKm || tm.defEn) : (tm.defEn || tm.defKm);
      if (d) remind.push((L === 'km' ? tm.km : (tm.en || tm.km)) + ': ' + d);
    }
    if (remind.length) out.sections.push({ type: 'remember', label: V.remember, items: remind.slice(0, 2) });

    /* 5. check yourself: a real quiz question, or a question built from a real term */
    const quizLesson = lesson || (ctx.docs.filter(function (d) { return d.doc.kind === 'lesson'; })[0] || {}).doc;
    const quiz = quizLesson && quizLesson.lesson ? (quizLesson.lesson.quiz || [])[0] : null;
    if (quiz) out.sections.push({ type: 'check', label: V.check, quiz: quiz, lesson: quizLesson.lesson });
    else if (terms[0]) {
      const tm = terms[0];
      out.sections.push({
        type: 'say', label: V.check,
        text: L === 'km' ? 'តើអ្នកអាចពន្យល់ពី «' + tm.km + '» ដោយពាក្យរបស់អ្នកបានទេ?'
                        : 'Can you explain “' + (tm.en || tm.km) + '” in your own words?'
      });
    }

    out.evidence = evidence;
    out.related = ctx.docs.filter(function (d) { return d.doc.kind === 'lesson' && d.doc.lesson; })
      .map(function (d) { return { lesson: d.doc.lesson, score: d.score }; }).slice(0, 3);
    out.hits = ctx.passages.length;
    out.pages = ctx.passages.slice(0, 4).map(function (p) { return p.chunk.page; });
    return out;
  }
  function pts0(lesson, L) {
    if (!lesson || !lesson.keyPoints) return [];
    return (L === 'km' ? lesson.keyPoints.km : lesson.keyPoints.en) || [];
  }

  /* ---------------------------------------------------------------- rendering */
  function srcLabel(src) { const s = SRC[src] || { km: src, en: src }; return I.state.lang === 'km' ? s.km : s.en; }
  function pageLabel(p) { return (I.state.lang === 'km' ? 'ទំព័រ ' : 'p. ') + p; }

  function citeBtn(src, page) {
    return '<button class="cite" data-cite="' + esc(src) + '" data-page="' + page + '">' +
      esc(srcLabel(src)) + ' · ' + pageLabel(page) + '</button>';
  }

  function sectionHtml(sec) {
    if (!sec) return '';
    const L = I.state.lang;
    if (sec.type === 'short') {
      return '<h4>' + esc(sec.label) + '</h4><p class="lead" data-type="' + esc(sec.label) + '">' + esc(sec.text) + '</p>';
    }
    if (sec.type === 'say') {
      return (sec.label ? '<h4>' + esc(sec.label) + '</h4>' : '') + '<p>' + esc(sec.text) + '</p>';
    }
    if (sec.type === 'points') {
      let h = '<h4>' + esc(sec.label) + '</h4><ul>';
      sec.items.forEach(function (p) { h += '<li>' + esc(p) + '</li>'; });
      h += '</ul>';
      if (sec.lesson) h += '<div class="cite-list"><a class="cite" href="learn.html#' + sec.lesson.id + '">' +
        esc(t('teacher.fromLesson')) + ' ' + esc(I.pick(sec.lesson.title)) + '</a></div>';
      return h;
    }
    if (sec.type === 'evidence') {
      let h = '<h4>' + esc(sec.label) + '</h4>';
      sec.items.forEach(function (e) {
        h += '<div class="quote">' + esc(I.truncate(e.text, 620)) +
          '<span class="src">' + esc(srcLabel(e.src)) + ' · ' + pageLabel(e.page) + '</span></div>';
        h += '<div class="cite-list">' + citeBtn(e.src, e.page) +
          '<button class="cite" data-full="' + esc(e.src) + '" data-page="' + e.page + '">' + esc(t('teacher.showtext')) + '</button></div>';
      });
      return h;
    }
    if (sec.type === 'remember') {
      let h = '<h4>' + esc(sec.label) + '</h4><ul>';
      sec.items.forEach(function (p) { h += '<li>' + esc(p) + '</li>'; });
      return h + '</ul>';
    }
    if (sec.type === 'check' && sec.quiz) {
      const q = sec.quiz;
      const opts = (q.options && (q.options[L] || q.options.en || q.options.km)) || [];
      return '<h4>' + esc(sec.label) + '</h4>' + I.T(q.q) +
        '<div class="options" data-mini="1" data-answer="' + (q.answer || 0) + '" style="margin-top:10px">' +
        opts.map(function (o, i) {
          return '<button class="option" data-opt="' + i + '"><span class="key">' + (i + 1) + '</span><span>' + esc(o) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="explain" hidden>' + I.T(q.explain) +
        (q.page ? '<div class="small muted" style="margin-top:6px">' + esc(t('quiz.page')) + ' ' + q.page + '</div>' : '') + '</div>';
    }
    return '';
  }

  function answerHtml(ans) {
    let h = '';
    ans.sections.forEach(function (sec, i) {
      h += '<div class="sec" data-sec="' + i + '">' + sectionHtml(sec) + '</div>';
    });
    if (ans.related && ans.related.length) {
      h += '<div class="sec"><h4>' + esc(t('teacher.related')) + '</h4><div class="cite-list">' +
        ans.related.map(function (r) {
          return '<a class="cite" href="learn.html#' + r.lesson.id + '">' + esc(I.pick(r.lesson.title)) + '</a>';
        }).join('') + '</div></div>';
    }
    h += '<div class="answer-actions">' +
      '<button data-act="simpler">💡 ' + esc(t('teacher.simpler')) + '</button>' +
      '<button data-act="example">📎 ' + esc(t('teacher.example')) + '</button>' +
      '<button data-act="more">➕ ' + esc(t('teacher.more')) + '</button>' +
      '<button data-act="quizme">🎯 ' + esc(t('teacher.quizme')) + '</button>' +
      '<button data-act="copy">⧉ ' + esc(t('teacher.copy')) + '</button>' +
      '</div>';
    return h;
  }

  /* ---------------------------------------------------------------- messages */
  function msgNode(role, html, opts) {
    const wrap = I.el('div', { class: 'msg ' + role });
    if (role === 'bot') {
      wrap.innerHTML = '<div class="av"><img src="assets/img/logo.png?v=20260912b" alt="RoboCL"></div><div class="body">' +
        '<div class="who-line">RoboCL</div>' + (html || '') + '</div>';
    } else {
      const s = window.IPLAuth && window.IPLAuth.session();
      wrap.innerHTML = '<div class="av">' + esc(((s && s.u) || 'U').slice(0, 1).toUpperCase()) + '</div><div class="body">' + esc(html) + '</div>';
    }
    if (opts && opts.id) wrap.dataset.id = opts.id;
    return wrap;
  }

  function push(role, html, opts) {
    const thread = qs('#thread');
    const node = msgNode(role, html, opts);
    thread.appendChild(node);
    scrollDown();
    return node;
  }
  function scrollDown() {
    const sc = qs('#chat-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function thinkingNode() {
    const steps = ['teacher.step1', 'teacher.step2', 'teacher.step3', 'teacher.step4', 'teacher.step5'];
    const html =
      '<div class="thinking" id="thinking">' +
      '<div class="th-head"><span>' + esc(t('teacher.thinking')) + '</span><span class="dots"><i></i><i></i><i></i></span></div>' +
      '<ol>' + steps.map(function (s, i) {
        return '<li data-step="' + i + '"><span class="st">' + (i === 0 ? '◐' : '○') + '</span><span data-label="' + s + '">' + esc(t(s)) + '</span></li>';
      }).join('') + '</ol><div class="bar"><i></i></div></div>';
    const node = push('bot', html);
    return node;
  }

  /* advance the visible thinking steps; returns when the last one is done */
  function runSteps(node, ctx, cb) {
    const list = qsa('#thinking li', node);
    const labels = { 'teacher.step2': true };
    let i = 0;
    const next = function () {
      if (i > 0) {
        const prev = list[i - 1];
        if (prev) { prev.classList.remove('now'); prev.classList.add('done'); qs('.st', prev).textContent = '✓'; }
      }
      if (i >= list.length) { cb(); return; }
      const li = list[i];
      li.classList.add('now');
      qs('.st', li).textContent = '◐';
      if (i === 1 && ctx && ctx.hits != null) {
        const lab = qs('[data-label]', li);
        lab.textContent = t('teacher.step2') + ' · ' + ctx.hits + ' ' + (I.state.lang === 'km' ? 'កន្លែង' : 'passages');
      }
      i++;
      state.stepTimer = setTimeout(next, i === 1 ? 280 : 210);
    };
    next();
  }

  /* reveal the answer progressively: type the short answer, then pop the rest */
  function streamAnswer(node, ans, done) {
    const body = qs('.body', node);
    const html = answerHtml(ans);
    body.innerHTML = '<div class="who-line">RoboCL</div><div class="wrapanswer"></div><div class="answer-actions"></div>';
    const host = qs('.wrapanswer', body);
    const actions = qs('.answer-actions', body);

    /* build the section nodes but keep them hidden until revealed */
    const tmp = I.el('div', {}, html);
    const secs = qsa('.sec', tmp);
    actions.innerHTML = qs('.answer-actions', tmp).innerHTML;
    const shortP = qs('.lead', tmp);

    node.classList.add('streaming');
    node.setAttribute('aria-busy', 'true');
    let k = 0;
    let typed = false;
    const reveal = function () {
      if (k >= secs.length) {
        node.classList.remove('streaming');
        node.setAttribute('aria-busy', 'false');
        wireAnswer(node);
        if (done) done();
        return;
      }
      const sec = secs[k++];
      host.appendChild(sec);
      /* type out the short-answer paragraph wherever it lands: follow-ups put a
         hint section in front of it, so "first section" is not good enough */
      if (!typed && shortP && sec.contains(shortP)) {
        typed = true;
        const target = qs('.lead', sec);
        const text = target.textContent;
        target.textContent = '';
        let ci = 0;
        const speed = text.length > 220 ? 9 : 15;
        const tick = function () {
          ci += 2;
          target.textContent = text.slice(0, ci);
          scrollDown();
          if (ci < text.length) setTimeout(tick, speed);
          else { setTimeout(reveal, 130); }
        };
        tick();
      } else {
        scrollDown();
        setTimeout(reveal, 110);
      }
    };
    reveal();
  }

  /* ---------------------------------------------------------------- wiring */
  function wireAnswer(node) {
    qsa('[data-cite]', node).forEach(function (b) {
      b.addEventListener('click', function () { showPage(b.dataset.cite, b.dataset.page); });
    });
    qsa('[data-full]', node).forEach(function (b) {
      b.addEventListener('click', function () { showPage(b.dataset.full, b.dataset.page, true); });
    });
    qsa('[data-mini]', node).forEach(function (box) {
      const ans = parseInt(box.dataset.answer || '0', 10);
      qsa('.option', box).forEach(function (o) {
        o.addEventListener('click', function () {
          const i = parseInt(o.dataset.opt, 10);
          qsa('.option', box).forEach(function (x) { x.disabled = true; });
          if (i === ans) { o.classList.add('correct'); I.addXP(3); }
          else { o.classList.add('wrong'); qsa('.option', box)[ans].classList.add('reveal'); }
          const ex = node.querySelector('.explain');
          if (ex) ex.hidden = false;
        });
      });
    });
    qsa('.answer-actions button', node).forEach(function (b) {
      b.addEventListener('click', function () {
        const a = b.dataset.act;
        if (a === 'copy') {
          I.copyText(node.querySelector('.body').innerText.trim());
        } else if (a === 'simpler') {
          followUp('simpler', lastQuery(node));
        } else if (a === 'example') {
          followUp('example', lastQuery(node));
        } else if (a === 'more') {
          followUp('more', lastQuery(node));
        } else if (a === 'quizme') {
          quizMe();
        }
      });
    });
  }
  function lastQuery(node) {
    const idx = state.msgs.map(function (m) { return m.role; }).lastIndexOf('user');
    return (state.msgs[idx] || {}).text || '';
  }

  function showPage(src, page, full) {
    const text = (D && D.corpusByPage) ? D.corpusByPage(src, page) : '';
    I.modal(srcLabel(src) + ' · ' + pageLabel(page),
      '<div class="small faint" style="margin-bottom:8px">' + esc(t('teacher.evidence')) + '</div>' +
      '<div class="reader-page ' + (src === 'textbook' ? 'km' : '') + '">' + esc(text || '—') + '</div>' +
      '<div class="row" style="margin-top:14px"><a class="btn sm" href="library.html#' + src + '=' + page + '">' + esc(t('lib.open')) + '</a>' +
      '<button class="btn sm" data-close>' + esc(t('common.close')) + '</button></div>');
  }

  /* ---------------------------------------------------------------- ask */
  async function ask(query, opts) {
    opts = opts || {};
    if (!query || !query.trim() || state.busy) return;
    if (!opts.silent) {
      push('user', query);
      state.msgs.push({ role: 'user', text: query, ts: Date.now() });
    }
    state.busy = true;
    qs('#send-btn').disabled = true;

    const node = thinkingNode();
    const kind = opts.kind || 'normal';

    /* the retrieval happens while the steps animate, so both feel instant */
    let ans = null;
    try { ans = buildAnswer(query, kind); } catch (e) { ans = { sections: [{ type: 'say', text: t('teacher.notfound') }], found: false, related: [] }; }

    runSteps(node, { hits: ans.hits || 0 }, function () {
      const thinking = qs('#thinking', node);
      if (thinking) thinking.remove();
      if (kind === 'simpler' || kind === 'example' || kind === 'more') {
        const hint = kind === 'simpler' ? VOICE[I.state.lang].simHint : (kind === 'example' ? VOICE[I.state.lang].exHint : VOICE[I.state.lang].moreHint);
        ans.sections.unshift({ type: 'say', text: hint });
      }
      streamAnswer(node, ans, function () {
        state.msgs.push({ role: 'bot', text: node.querySelector('.body').innerText.slice(0, 4000), ts: Date.now() });
        persist();
        if (ans.found) I.addXP(2);
        state.busy = false;
        qs('#send-btn').disabled = false;
      });
    });
  }

  function followUp(kind, query) {
    if (!query) return;
    /* the question is already in the thread — don't repeat it as a new turn */
    ask(query, { kind: kind, silent: true });
  }

  function quizMe() {
    const all = (D && D.allLessons()) || [];
    if (!all.length) return;
    const lesson = all[Math.floor(Math.random() * all.length)];
    const qs_ = (lesson.quiz || []).filter(Boolean);
    if (!qs_.length) return;
    const q = qs_[Math.floor(Math.random() * qs_.length)];
    const node = push('bot', '');
    const L = I.state.lang;
    const opts = (q.options && (q.options[L] || q.options.en || q.options.km)) || [];
    qs('.body', node).innerHTML = '<div class="who-line">RoboCL</div>' +
      '<h4>' + esc(t('teacher.quizme')) + '</h4>' + I.T(q.q) +
      '<div class="options" data-mini="1" data-answer="' + (q.answer || 0) + '" style="margin-top:10px">' +
      opts.map(function (o, i) {
        return '<button class="option" data-opt="' + i + '"><span class="key">' + (i + 1) + '</span><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="explain" hidden>' + I.T(q.explain) +
      '<div class="cite-list" style="margin-top:8px"><a class="cite" href="learn.html#' + lesson.id + '">' +
      esc(t('teacher.fromLesson')) + ' ' + esc(I.pick(lesson.title)) + '</a>' + (q.page ? citeBtn('textbook', q.page) : '') + '</div></div>';
    wireAnswer(node);
    scrollDown();
    state.msgs.push({ role: 'bot', text: '[quiz] ' + I.pick(q.q), ts: Date.now() });
    persist();
  }

  /* ---------------------------------------------------------------- sidebar */
  function renderChatList() {
    const host = qs('#chat-list');
    if (!host) return;
    const list = allChats().filter(function (c) { return c.msgs && c.msgs.length; });
    if (!list.length) { host.innerHTML = '<div class="small faint" style="padding:8px 10px">' + esc(t('teacher.nohistory')) + '</div>'; return; }
    host.innerHTML = list.map(function (c) {
      return '<button data-chat="' + esc(c.id) + '"' + (c.id === state.chatId ? ' class="active"' : '') + '>💬 ' + esc(I.truncate(c.title, 28)) + '</button>';
    }).join('');
    qsa('[data-chat]', host).forEach(function (b) {
      b.addEventListener('click', function () { openChat(b.dataset.chat); });
    });
  }

  function newChat() {
    state.chatId = 'c' + Date.now().toString(36);
    state.msgs = [];
    qs('#thread').innerHTML = '';
    emptyState();
    renderChatList();
    if (window.innerWidth <= 860) toggleSide(false);
  }

  function openChat(id) {
    const rec = allChats().filter(function (c) { return c.id === id; })[0];
    if (!rec) return;
    state.chatId = rec.id;
    state.msgs = rec.msgs || [];
    const thread = qs('#thread');
    thread.innerHTML = '';
    state.msgs.forEach(function (m) {
      const n = m.role === 'user' ? msgNode('user', m.text) : msgNode('bot', '<p>' + esc(m.text) + '</p>');
      thread.appendChild(n);
    });
    renderChatList();
    scrollDown();
    if (window.innerWidth <= 860) toggleSide(false);
  }

  function toggleSide(v) {
    const side = qs('#chat-side'), back = qs('#side-back');
    if (side) side.classList.toggle('open', v);
    if (back) back.classList.toggle('open', v);
    const tgl = qs('#side-toggle');
    if (tgl) tgl.setAttribute('aria-expanded', v ? 'true' : 'false');
    /* the panel is off-canvas when closed: keep it out of the tab order and of
       the accessibility tree so focus cannot land on something invisible */
    if (side) {
      side.setAttribute('aria-hidden', v ? 'false' : 'true');
      if (window.matchMedia && window.matchMedia('(max-width: 860px)').matches) {
        side.style.visibility = v ? 'visible' : 'hidden';
      } else {
        side.style.visibility = '';
      }
    }
  }

  /* ---------------------------------------------------------------- empty state */
  function emptyState() {
    const thread = qs('#thread');
    const sug = SUGGEST[I.state.lang] || SUGGEST.en;
    thread.innerHTML =
      '<div class="empty-chat">' +
      '<img src="assets/img/logo.png?v=20260912b" alt="RoboCL">' +
      '<h2>' + esc(t('teacher.title')) + '</h2>' +
      '<p>' + esc(t('teacher.intro')) + '</p>' +
      '<div class="suggest-row" style="justify-content:center">' +
      sug.map(function (q) { return '<button data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') +
      '</div>' +
      '<div class="small faint" style="margin-top:16px">' + esc(t('teacher.hint')) + '</div>' +
      '</div>';
    qsa('[data-q]', thread).forEach(function (b) {
      b.addEventListener('click', function () { ask(b.dataset.q); });
    });
  }

  /* ---------------------------------------------------------------- init */
  function init() {
    const side = qs('#chat-side');
    if (side) {
      side.innerHTML =
        '<div class="side-top"><img class="robo" src="assets/img/logo.png?v=20260912b" alt=""><div class="who"><b>RoboCL</b><span>' + esc(t('teacher.sub')) + '</span></div></div>' +
        '<button class="btn primary block" id="new-chat">＋ ' + esc(t('teacher.newchat')) + '</button>' +
        '<div class="small faint" style="margin:8px 4px 2px">' + esc(t('teacher.history')) + '</div>' +
        '<div class="chat-list" id="chat-list"></div>' +
        '<hr><a class="btn ghost block sm" href="library.html" style="justify-content:flex-start">📚 ' + esc(t('nav.library')) + '</a>';
    }
    const back = I.el('div', { class: 'drawer-backdrop', id: 'side-back' });
    document.body.appendChild(back);
    back.addEventListener('click', function () { toggleSide(false); });

    state.chatId = 'c' + Date.now().toString(36);
    renderChatList();
    emptyState();

    qs('#new-chat').addEventListener('click', newChat);
    const sideToggle = qs('#side-toggle');
    if (sideToggle) {
      sideToggle.setAttribute('aria-expanded', 'false');
      sideToggle.setAttribute('aria-controls', 'chat-side');
      sideToggle.addEventListener('click', function () { toggleSide(!qs('#chat-side').classList.contains('open')); });
    }
    /* announce the conversation, and let Escape close the history panel */
    const threadEl = qs('#thread');
    if (threadEl) threadEl.setAttribute('aria-live', 'polite');
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && qs('#chat-side') && qs('#chat-side').classList.contains('open')) toggleSide(false);
    });
    toggleSide(false);

    const ta = qs('#chat-text');
    const send = qs('#send-btn');
    ta.setAttribute('aria-label', t('teacher.placeholder'));
    send.setAttribute('aria-label', t('teacher.send'));
    const grow = function () { ta.style.height = 'auto'; ta.style.height = Math.min(190, ta.scrollHeight) + 'px'; };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fire(); }
    });
    send.addEventListener('click', fire);
    function fire() {
      const v = ta.value.trim();
      if (!v) return;
      ta.value = ''; grow();
      ask(v);
    }
    const clear = qs('#clear-btn');
    if (clear) clear.addEventListener('click', function () { newChat(); I.toast(t('teacher.clear')); });

    /* if the user arrived with a question in the URL, ask it straight away */
    const m = location.search.match(/[?&]q=([^&]+)/);
    if (m) { const q = decodeURIComponent(m[1].replace(/\+/g, ' ')); setTimeout(function () { ask(q); }, 220); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!I.guard()) return;
    I.renderChrome('teacher.html');
    init();
  });
})();
