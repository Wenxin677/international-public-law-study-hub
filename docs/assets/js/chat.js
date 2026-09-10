/* ==========================================================================
   chat.js — "Ask the book": grounded retrieval chat + optional LLM mode
   ========================================================================== */
(function () {
  'use strict';
  const I = window.IPL, S = window.IPLSearch;
  const t = I.t, esc = I.esc;

  const SOURCE = {
    textbook: { km: 'សៀវភៅសិក្សា', en: 'Textbook', cite: 'ឡាយ រត្តនា, ច្បាប់សាធារណៈអន្តរជាតិ (២០២១)' , citeEn: 'Lay Rottana, International Public Law (2021)' },
    eccc: { km: 'ច្បាប់អង្គការតុលាការពិសេស', en: 'ECCC Law', cite: 'Law on the Establishment of the Extraordinary Chambers (2004)', citeEn: 'ECCC Law (2004)' },
    paris: { km: 'អនុសញ្ញាប៉ារីស', en: 'Paris Convention', cite: 'Paris Convention for the Protection of Industrial Property (1883/1979)', citeEn: 'Paris Convention (1883/1979)' }
  };

  const SUGGEST = {
    km: ['តើអធិបតេយ្យភាពជាអ្វី?', 'ប្រភពនៃច្បាប់អន្តរជាតិមានអ្វីខ្លះ?',
         'តើរដ្ឋមួយត្រូវមានលក្ខណៈវិនិច្ឆ័យអ្វីខ្លះ?',
         'តើកិច្ចព្រមព្រៀងទីក្រុងប៉ារីសឆ្នាំ១៩៩១ បានកំណត់អ្វី?',
         'តើសន្ធិសញ្ញាអន្តរជាតិគឺជាអ្វី?', 'សួរខ្ញុំសំណួរមួយ'],
    en: ['What is sovereignty?', 'What are the sources of international law?',
         'What are the criteria of statehood?', 'What did the 1991 Paris Peace Agreements establish?',
         'What is a treaty under the Vienna Convention?', 'Quiz me']
  };

  const state = { messages: [], busy: false };

  function shortSrc(c) { return SOURCE[c.src] || { km: c.src, en: c.src }; }
  function srcLabel(c) { return I.state.lang === 'km' ? shortSrc(c).km : shortSrc(c).en; }
  function pageLabel(p) { return (I.state.lang === 'km' ? 'ទំព័រ ' : 'p. ') + p; }

  /* ---------- answer composition (no API key needed) ---------- */
  function compose(query) {
    const passages = S.searchCorpus(query, { limit: 6 });
    const docs = S.searchDocs(query, { limit: 6 });
    const ql = query.toLowerCase();
    const isDef = /ជាអ្វី|អ្វីទៅជា|និយមន័យ|^what (is|are|does)|^define|definition/.test(ql);
    const isList = /មានអ្វីខ្លះ|រាយ|បញ្ជី|what are|list|enumerate|types of|ប្រភេទ/.test(ql);
    const wantsQuiz = /សួរខ្ញុំ|សំណួរ|quiz me|test me|ask me a question/.test(ql);

    if (wantsQuiz) return quizAnswer(docs, passages);

    const blocks = [];
    const best = passages[0];
    const strong = best && best.score > 1.2;

    // 1. a matching glossary term / key point answers definition questions neatly
    if (isDef || isList) {
      const termDocs = docs.filter(function (d) { return d.doc.kind === 'term'; }).slice(0, isDef ? 2 : 0);
      termDocs.forEach(function (d) {
        blocks.push({
          kind: 'definition', score: d.score,
          km: d.doc.km || '', en: d.doc.en || '',
          defKm: d.doc.defKm || '', defEn: d.doc.defEn || '',
          page: d.doc.page, src: d.doc.src || 'textbook', lesson: d.doc.lesson
        });
      });
    }
    if (isList || isDef) {
      const lp = docs.filter(function (d) { return d.doc.kind === 'lesson'; }).slice(0, 1);
      lp.forEach(function (d) {
        blocks.push({
          kind: 'lesson', score: d.score, lesson: d.doc.lesson,
          pointsKm: d.doc.pointsKm || [], pointsEn: d.doc.pointsEn || [],
          title: d.doc.title || {}, page: d.doc.page
        });
      });
    }

    // 2. verbatim evidence
    const evidence = passages.slice(0, strong ? 3 : 1).map(function (p) {
      const sents = S.bestSentences(p.chunk.text, query, 3);
      return {
        kind: 'passage', src: p.chunk.src, page: p.chunk.page, pdf: p.chunk.pdf,
        lang: p.chunk.lang, score: p.score,
        text: sents.join(' '),
        full: p.chunk.text
      };
    });

    return {
      type: 'grounded',
      query: query,
      found: !!strong,
      blocks: blocks,
      evidence: evidence,
      related: docs.filter(function (d) { return d.doc.kind === 'lesson'; })
        .map(function (d) { return { lesson: d.doc.lesson, title: d.doc.title, score: d.score }; }).slice(0, 3)
    };
  }

  function quizAnswer(docs, passages) {
    const lessonDoc = docs.filter(function (d) { return d.doc.kind === 'lesson' && d.doc.lesson; })[0];
    let lesson = lessonDoc && lessonDoc.doc.lesson;
    if (!lesson && window.IPL_DATA) {
      const all = window.IPL_DATA.allLessons();
      lesson = all[Math.floor(Math.random() * all.length)];
    }
    if (!lesson) return { type: 'grounded', found: false, query: '', blocks: [], evidence: [], related: [] };
    const qs = (lesson.quiz || []).filter(function (q) { return q; });
    if (!qs.length) return { type: 'grounded', found: false, query: '', blocks: [], evidence: [], related: [] };
    const q = qs[Math.floor(Math.random() * qs.length)];
    return { type: 'quiz', lesson: lesson, question: q };
  }

  /* ---------- rendering ---------- */
  function citeChip(src, page, full, pdf) {
    return '<button class="cite" data-cite="' + esc(src) + '" data-page="' + page + '">' +
      esc((SOURCE[src] ? (I.state.lang === 'km' ? SOURCE[src].km : SOURCE[src].en) : src)) +
      ' · ' + pageLabel(page) + '</button>';
  }

  function renderAnswer(ans) {
    if (ans.type === 'quiz') {
      const q = ans.question;
      const opts = (q.options && (q.options[I.state.lang] || q.options.en || q.options.km)) || [];
      return '<h4>' + esc(t('chat.quizme') || 'Quiz') + '</h4>' +
        I.bilingual(q.q) +
        '<div class="options" data-quiz-inline="1" data-answer="' + (q.answer || 0) + '" style="margin-top:12px">' +
        opts.map(function (o, i) {
          return '<button class="option" data-opt="' + i + '"><span class="key">' + (i + 1) + '</span><span>' + esc(o) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="explain" hidden>' + I.bilingual(q.explain) +
        (q.page ? '<div class="small muted" style="margin-top:6px">' + esc(t('quiz.page')) + ' ' + q.page + '</div>' : '') +
        '</div>';
    }

    if (!ans.found && !ans.blocks.length) {
      const rel = ans.related.length ? '<div class="cite-list">' + ans.related.map(function (r) {
        return '<a class="cite" href="learn.html#' + r.lesson.id + '">' + esc(I.pick(r.title)) + '</a>';
      }).join('') + '</div>' : '';
      return '<h4>' + esc(t('chat.notfound')) + '</h4>' + rel;
    }

    let html = '';
    const lead = ans.found
      ? { km: 'នេះជាអ្វីដែលប្រភពនិយាយ៖', en: 'Here is what the sources say:' }
      : { km: 'ខ្ញុំមិនប្រាកដថាប្រភពគ្របដណ្តប់រឿងនេះទេ ប៉ុន្តែនេះជាអត្ថបទជិតបំផុត៖',
          en: 'I am not sure the sources cover this directly — here is the closest text:' };
    html += '<div class="small muted" style="margin-bottom:8px">' + esc(I.pick(lead)) + '</div>';

    ans.blocks.forEach(function (b) {
      if (b.kind === 'definition') {
        html += '<div style="margin-bottom:12px"><b class="km">' + esc(b.km) + '</b>' +
          (b.en ? ' <span class="muted">· ' + esc(b.en) + '</span>' : '') +
          (I.state.lang === 'km' && b.defKm ? '<div class="km">' + esc(b.defKm) + '</div>' : '') +
          (I.state.lang !== 'km' && b.defEn ? '<div class="en">' + esc(b.defEn) + '</div>' : '') +
          (b.page ? citeChip(b.src || 'textbook', b.page) : '') + '</div>';
      } else if (b.kind === 'lesson') {
        const pts = I.state.lang === 'km' ? b.pointsKm : b.pointsEn;
        if (pts && pts.length) {
          html += '<ul class="point-list km">' + pts.slice(0, 4).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>';
        }
        if (b.lesson) {
          html += '<div class="cite-list"><a class="cite" href="learn.html#' + b.lesson.id + '">' +
            esc(I.pick(b.title)) + '</a></div>';
        }
      }
    });

    if (ans.evidence.length) {
      html += '<h4 style="margin-top:14px">' + esc(t('chat.evidence')) + '</h4>';
      ans.evidence.forEach(function (e) {
        const isKm = e.lang === 'km';
        html += '<div class="quote">' + esc(I.truncate(e.text, 620)) +
          '<span class="src">' + esc(srcLabel(e)) + ' · ' + pageLabel(e.page) + '</span></div>';
        html += '<div class="cite-list" style="margin:-8px 0 12px">' + citeChip(e.src, e.page) +
          '<button class="cite" data-show="' + esc(e.src) + '" data-page="' + e.page + '">' +
          esc(t('chat.showtext')) + '</button></div>';
      });
    }

    if (I.state.lang === 'en') {
      html += '<div class="small muted" style="margin-top:6px">' +
        esc('Note: the textbook is written in Khmer; passages are quoted in the original. Add an API key below for full English answers and translation.') +
        '</div>';
    }

    if (ans.related && ans.related.length) {
      html += '<div style="margin-top:12px"><div class="small muted">' + esc(t('chat.related')) + '</div>' +
        '<div class="cite-list">' + ans.related.map(function (r) {
          return '<a class="cite" href="learn.html#' + r.lesson.id + '">' + esc(I.pick(r.title)) + '</a>';
        }).join('') + '</div></div>';
    }
    return html;
  }

  /* ---------- LLM mode (optional) ---------- */
  function getApi() {
    try { return JSON.parse(localStorage.getItem(I.STORE.api) || 'null') || null; } catch (e) { return null; }
  }
  function setApi(cfg) {
    if (cfg && cfg.key) localStorage.setItem(I.STORE.api, JSON.stringify(cfg));
    else localStorage.removeItem(I.STORE.api);
  }

  async function askLLM(query) {
    const cfg = getApi();
    if (!cfg || !cfg.key) return null;
    const passages = S.searchCorpus(query, { limit: 6 });
    const docs = S.searchDocs(query, { limit: 4 });
    const ctx = passages.map(function (p, i) {
      return '[' + (i + 1) + '] source=' + (SOURCE[p.chunk.src] ? SOURCE[p.chunk.src].en : p.chunk.src) +
        ', page=' + p.chunk.page + '\n' + p.chunk.text.slice(0, 1400);
    }).join('\n\n---\n\n');
    const lessonCtx = docs.filter(function (d) { return d.doc.kind === 'lesson'; }).slice(0, 2)
      .map(function (d) { return (d.doc.pointsEn || []).join(' | '); }).join('\n');
    const lang = I.state.lang === 'km' ? 'Khmer' : 'English';
    const sys = 'You are a study assistant for a Public International Law course in Cambodia. ' +
      'Answer ONLY from the CONTEXT below. Answer in ' + lang + '. ' +
      'Cite the page number(s) in square brackets after each claim, e.g. [Textbook p.45]. ' +
      'If the context does not contain the answer, say so plainly. Be concise and academic.';
    const user = 'QUESTION: ' + query + '\n\nCONTEXT:\n' + ctx + (lessonCtx ? '\n\nCOURSE NOTES:\n' + lessonCtx : '');
    const url = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        temperature: 0.2
      })
    });
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message.content || '';
    return { text: text, passages: passages };
  }

  /* ---------- view ---------- */
  function bubble(role, html) {
    const div = I.el('div', { class: 'msg ' + role });
    div.innerHTML = '<div class="avatar">' + (role === 'user' ? '?' : 'ច') + '</div><div class="bubble">' + html + '</div>';
    return div;
  }

  function appendMessage(role, html) {
    state.messages.push({ role: role, html: html });
    const log = I.qs('#chat-log');
    const node = bubble(role, html);
    log.appendChild(node);
    node.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return node;
  }

  function wireAnswerHandlers(root) {
    I.qsa('[data-cite]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        const src = b.dataset.cite, page = b.dataset.page;
        const chunks = S.searchCorpus('', { limit: 1 });   // no-op, keeps API shape
        const full = window.IPL_DATA.corpusByPage(src, page);
        I.modal(srcLabel({ src: src }) + ' · ' + pageLabel(page),
          '<div class="small muted" style="margin-bottom:10px">' + esc(full ? '' : '') + '</div>' +
          '<div class="quote" style="border:0;background:transparent;padding:0">' +
          esc(full || '') + '</div>');
      });
    });
    I.qsa('[data-show]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        const full = window.IPL_DATA.corpusByPage(b.dataset.show, b.dataset.page);
        I.modal(srcLabel({ src: b.dataset.show }) + ' · ' + pageLabel(b.dataset.page),
          '<div class="quote" style="border:0;background:transparent;padding:0">' + esc(full || '') + '</div>');
      });
    });
    I.qsa('[data-quiz-inline]', root).forEach(function (box) {
      const ans = parseInt(box.dataset.answer || '0', 10);
      I.qsa('.option', box).forEach(function (o) {
        o.addEventListener('click', function () {
          const i = parseInt(o.dataset.opt, 10);
          I.qsa('.option', box).forEach(function (x) { x.disabled = true; });
          if (i === ans) o.classList.add('correct'); else { o.classList.add('wrong'); I.qsa('.option', box)[ans].classList.add('reveal'); }
          root.querySelector('.explain').hidden = false;
        });
      });
    });
  }

  async function submit(query) {
    if (!query.trim() || state.busy) return;
    state.busy = true;
    appendMessage('user', esc(query));
    const thinking = appendMessage('bot', '<span class="typing"><i></i><i></i><i></i></span> ' + esc(t('chat.thinking')));
    const cfg = getApi();
    try {
      if (cfg && cfg.key) {
        try {
          const out = await askLLM(query);
          const html = '<h4>' + esc(I.state.lang === 'km' ? 'ចម្លើយ (គំរូ AI)' : 'Answer (AI model)') + '</h4>' +
            esc(out.text).replace(/\n/g, '<br>') +
            '<div class="cite-list" style="margin-top:12px">' +
            out.passages.slice(0, 4).map(function (p) { return citeChip(p.chunk.src, p.chunk.page); }).join('') +
            '</div>';
          thinking.querySelector('.bubble').innerHTML = html;
          wireAnswerHandlers(thinking);
          state.messages.push({ role: 'bot', html: html });
          state.busy = false;
          return;
        } catch (e) {
          I.toast('LLM error: ' + e.message + ' — falling back to on-device search');
        }
      }
      const ans = compose(query);
      const html = renderAnswer(ans);
      thinking.querySelector('.bubble').innerHTML = html;
      wireAnswerHandlers(thinking);
      state.messages.push({ role: 'bot', html: html });
      if (ans.found) I.addXP(2);
    } finally {
      state.busy = false;
    }
  }

  function init() {
    const log = I.qs('#chat-log');
    appendMessage('bot', '<h4>' + esc(t('chat.intro')) + '</h4>' +
      '<div class="small muted">' + esc(t('chat.local')) + '</div>');

    const sg = I.qs('#suggest');
    (SUGGEST[I.state.lang] || SUGGEST.en).forEach(function (q) {
      const b = I.el('button', { text: q });
      b.addEventListener('click', function () { submit(q); });
      sg.appendChild(b);
    });

    const ta = I.qs('#chat-text');
    I.qs('#chat-send').addEventListener('click', function () {
      const v = ta.value; ta.value = '';
      submit(v);
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = ta.value; ta.value = ''; submit(v); }
    });
    I.qs('#chat-clear').addEventListener('click', function () {
      log.innerHTML = ''; state.messages = [];
      appendMessage('bot', '<h4>' + esc(t('chat.intro')) + '</h4>');
    });

    // API key panel
    const cfg = getApi() || {};
    I.qs('#api-base').value = cfg.baseUrl || '';
    I.qs('#api-model').value = cfg.model || '';
    I.qs('#api-key').value = cfg.key || '';
    I.qs('#api-save').addEventListener('click', function () {
      const c = {
        baseUrl: I.qs('#api-base').value.trim() || 'https://api.openai.com/v1',
        model: I.qs('#api-model').value.trim() || 'gpt-4o-mini',
        key: I.qs('#api-key').value.trim()
      };
      setApi(c);
      I.toast(c.key ? 'API key saved in this browser' : 'API key cleared');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    I.renderChrome('chat.html');
    init();
  });
})();
