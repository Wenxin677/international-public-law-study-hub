/* ==========================================================================
   core.js — language state, storage, progress model, shared UI helpers
   International Public Law Study Hub
   ========================================================================== */
(function () {
  'use strict';

  const STORE = {
    lang: 'ipl.lang',
    theme: 'ipl.theme',
    progress: 'ipl.progress',
    api: 'ipl.api'
  };

  /* ---------------- i18n ---------------- */
  const I18N = {
    km: {
      'app.name': 'មជ្ឈមណ្ឌលសិក្សា​ច្បាប់​សាធារណៈ​អន្តរជាតិ',
      'app.sub': 'ផ្អែកលើសៀវភៅ និងឯកសារយោង ៣',
      'nav.home': 'ទំព័រដើម',
      'nav.learn': 'មេរៀន',
      'nav.quiz': 'តេស្ត',
      'nav.chat': 'សួរសៀវភៅ',
      'nav.glossary': 'វាក្យសព្ទ',
      'nav.about': 'ប្រភព',
      'lang.km': 'ខ្មែរ',
      'lang.en': 'អង់គ្លេស',
      'lang.both': 'ទាំងពីរ',
      'theme.toggle': 'បញ្ចូល/បិទពន្លឺ',
      'hero.title': 'សិក្សា​ច្បាប់​សាធារណៈ​អន្តរជាតិ',
      'hero.sub': 'រៀនតាមជំពូក និងមេរៀន ធ្វើតេស្តខ្លួនឯង និងសួរបញ្ហាទៅសៀវភៅសិក្សាដោយផ្ទាល់ — គ្រប់ចម្លើយមានទំព័រប្រភព។',
      'hero.cta.learn': 'ចាប់ផ្តើមរៀន',
      'hero.cta.ask': 'សួរសៀវភៅ',
      'stat.pages': 'ទំព័រសៀវភៅ',
      'stat.chapters': 'ជំពូក',
      'stat.lessons': 'មេរៀន',
      'stat.questions': 'សំណួរតេស្ត',
      'stat.terms': 'ពាក្យបច្ចេកទេស',
      'mode.learn.t': 'រៀនតាមមេរៀន',
      'mode.learn.d': 'ជំពូក និងមេរៀន ដែលរៀបចំតាមលំដាប់សៀវភៅ ជាមួយគោលបំណង ចំណុចសំខាន់ ពាក្យបច្ចេកទេស និងសម្រង់ដើម។',
      'mode.quiz.t': 'ធ្វើតេស្តខ្លួនឯង',
      'mode.quiz.d': 'តេស្តខ្លីៗសម្រាប់មេរៀននីមួយៗ និងតេស្តប្រចាំជំពូក ជាមួយចម្លើយពន្យល់ និងទំព័រយោង។',
      'mode.chat.t': 'សួរសៀវភៅ',
      'mode.chat.d': 'សរសេរសំណួរជាភាសាខ្មែរ ឬអង់គ្លេស ហើយទទួលចម្លើយផ្អែកលើអត្ថបទសៀវភៅ និងឯកសារយោង។',
      'mode.gloss.t': 'វាក្យសព្ទច្បាប់',
      'mode.gloss.d': 'ពាក្យបច្ចេកទេសខ្មែរ–អង់គ្លេស ព្រមទាំងនិយមន័យ និងទំព័រដែលពាក្យនោះលេចឡើង។',
      'learn.title': 'មេរៀន',
      'learn.pick': 'ជ្រើសរើសជំពូក ឬមេរៀន',
      'learn.objectives': 'គោលបំណងសិក្សា',
      'learn.keypoints': 'ចំណុចសំខាន់',
      'learn.quotes': 'សម្រង់ពីប្រភព',
      'learn.terms': 'ពាក្យបច្ចេកទេស',
      'learn.quiz': 'តេស្តមេរៀននេះ',
      'learn.mark': 'សម្គាល់ថាបានសិក្សា',
      'learn.marked': 'បានសិក្សា ✓',
      'learn.next': 'មេរៀនបន្ទាប់',
      'learn.prev': 'មេរៀនមុន',
      'learn.pages': 'ទំព័រ',
      'learn.flash': 'ចុចកាតដើម្បីត្រឡប់',
      'learn.empty': 'ជ្រើសរើសមេរៀនមួយនៅខាងឆ្វេង ដើម្បីចាប់ផ្តើម។',
      'quiz.title': 'តេស្ត',
      'quiz.choose': 'ជ្រើសរើសមេរៀន ឬជំពូក',
      'quiz.start': 'ចាប់ផ្តើមតេស្ត',
      'quiz.question': 'សំណួរ',
      'quiz.of': 'ក្នុងចំណោម',
      'quiz.correct': 'ត្រឹមត្រូវ!',
      'quiz.wrong': 'មិនទាន់ត្រូវ',
      'quiz.next': 'សំណួរបន្ទាប់',
      'quiz.finish': 'បញ្ចប់',
      'quiz.retry': 'ធ្វើម្តងទៀត',
      'quiz.review': 'ពិនិត្យចម្លើយ',
      'quiz.score': 'ពិន្ទុ',
      'quiz.answer': 'ចម្លើយ',
      'quiz.explain': 'ពន្យល់',
      'quiz.page': 'ទំព័រ',
      'quiz.askbook': 'សួរសៀវភៅពីរឿងនេះ',
      'quiz.average': 'មធ្យមភាគរបស់អ្នក',
      'quiz.noquiz': 'មេរៀននេះមិនទាន់មានសំណួរតេស្តទេ។',
      'chat.title': 'សួរសៀវភៅ',
      'chat.intro': 'សួរខ្ញុំពីច្បាប់សាធារណៈអន្តរជាតិ — ខ្ញុំឆ្លើយដោយផ្អែកលើសៀវភៅសិក្សា និងឯកសារយោង ហើយបង្ហាញទំព័រប្រភពជានិច្ច។',
      'chat.placeholder': 'សរសេរសំណួររបស់អ្នក… (ឧ. តើអធិបតេយ្យភាពជាអ្វី?)',
      'chat.send': 'ផ្ញើ',
      'chat.thinking': 'កំពុងស្វែងរកក្នុងប្រភព',
      'chat.evidence': 'ភស្តុតាងពីប្រភព',
      'chat.notfound': 'ខ្ញុំរកមិនឃើញចម្លើយសម្រាប់សំណួរនេះនៅក្នុងប្រភពទាំង ៣ ទេ។ សូមព្យាយាមប្រើពាក្យគន្លឹះផ្សេង ឬជ្រើសសំណួរខាងក្រោម។',
      'chat.sources': 'ប្រភពដែលបានរកឃើញ',
      'chat.related': 'មេរៀនដែលពាក់ព័ន្ធ',
      'chat.showtext': 'មើលអត្ថបទដើម',
      'chat.clear': 'សម្អាតការសន្ទនា',
      'chat.suggest': 'សំណួរគំរូ',
      'chat.quizme': 'សំណួរតេស្តសម្រាប់អ្នក',
      'chat.key': 'ភ្ជាប់គំរូ AI (ជាជម្រើស)',
      'chat.keyhelp': 'ដាក់ API key ដើម្បីឱ្យចម្លើយកាន់តែរលូន និងបកប្រែជាភាសាដែលអ្នកចង់បាន។ Key ត្រូវបានរក្សាទុកតែក្នុងកម្មវិធីរុករករបស់អ្នកប៉ុណ្ណោះ។',
      'chat.local': 'របៀបដោយគ្មាន key៖ ស្វែងរកក្នុងអត្ថបទ និងបង្ហាញសម្រង់ពិត',
      'gloss.title': 'វាក្យសព្ទច្បាប់',
      'gloss.search': 'ស្វែងរកពាក្យ (ខ្មែរ ឬអង់គ្លេស)…',
      'gloss.term': 'ពាក្យ',
      'gloss.en': 'អង់គ្លេស',
      'gloss.def': 'និយមន័យ',
      'gloss.chapter': 'ជំពូក',
      'gloss.flashmode': 'របៀបកាតសិក្សា',
      'gloss.listmode': 'របៀបតារាង',
      'gloss.count': 'ពាក្យសរុប',
      'about.title': 'អំពី និងប្រភព',
      'about.sources': 'ប្រភពទាំង ៣',
      'about.method': 'វិធីសាស្ត្រ',
      'about.disclaimer': 'ការប្រកាសដោះសា',
      'about.cite': 'របៀបយោង',
      'progress.title': 'វឌ្ឍនភាព',
      'progress.lessons': 'មេរៀនដែលបានសិក្សា',
      'progress.xp': 'ពិន្ទុ XP',
      'progress.rank': 'កម្រិត',
      'progress.reset': 'កំណត់ឡើងវិញ',
      'progress.streak': 'ថ្ងៃជាប់ៗគ្នា',
      'common.search': 'ស្វែងរក…',
      'common.page': 'ទំព័រ',
      'common.close': 'បិទ',
      'common.copy': 'ចម្លងការយោង',
      'common.copied': 'បានចម្លង!',
      'common.loading': 'កំពុងផ្ទុក…',
      'common.km': 'ខ្មែរ',
      'common.en': 'អង់គ្លេស',
      'common.all': 'ទាំងអស់',
      'common.notes': 'កំណត់សម្គាល់ផ្ទាល់ខ្លួន',
      'common.notes.ph': 'សរសេរកំណត់សម្គាល់សម្រាប់មេរៀននេះ…',
      'foot.disclaimer': 'ឧបករណ៍សិក្សានេះសម្រាប់ការសិក្សាប៉ុណ្ណោះ មិនមែនជាយោបល់ផ្លូវច្បាប់ទេ។ អត្ថបទទាំងអស់ជាកម្មសិទ្ធិរបស់អ្នកនិពន្ធដើម។'
    },
    en: {
      'app.name': 'Public International Law Study Hub',
      'app.sub': 'Built on the textbook + 2 reference documents',
      'nav.home': 'Home',
      'nav.learn': 'Learn',
      'nav.quiz': 'Quiz',
      'nav.chat': 'Ask the Book',
      'nav.glossary': 'Glossary',
      'nav.about': 'Sources',
      'lang.km': 'Khmer',
      'lang.en': 'English',
      'lang.both': 'Both',
      'theme.toggle': 'Toggle light/dark',
      'hero.title': 'Study Public International Law',
      'hero.sub': 'Follow the book chapter by chapter, test yourself with instant explanations, and ask the textbook directly — every answer cites its page.',
      'hero.cta.learn': 'Start learning',
      'hero.cta.ask': 'Ask the book',
      'stat.pages': 'book pages',
      'stat.chapters': 'chapters',
      'stat.lessons': 'lessons',
      'stat.questions': 'quiz questions',
      'stat.terms': 'key terms',
      'mode.learn.t': 'Learn by lesson',
      'mode.learn.d': 'Chapters and lessons in the book’s own order, with objectives, key points, key terms and verbatim quotes.',
      'mode.quiz.t': 'Test yourself',
      'mode.quiz.d': 'Short quizzes per lesson and chapter exams, with explanations and page references.',
      'mode.chat.t': 'Ask the book',
      'mode.chat.d': 'Ask in Khmer or English and get answers grounded in the textbook and reference documents.',
      'mode.gloss.t': 'Legal glossary',
      'mode.gloss.d': 'Khmer–English terms with definitions and the pages where they appear.',
      'learn.title': 'Lessons',
      'learn.pick': 'Pick a chapter or lesson',
      'learn.objectives': 'Learning objectives',
      'learn.keypoints': 'Key points',
      'learn.quotes': 'Quotes from the source',
      'learn.terms': 'Key terms',
      'learn.quiz': 'Quiz this lesson',
      'learn.mark': 'Mark as studied',
      'learn.marked': 'Studied ✓',
      'learn.next': 'Next lesson',
      'learn.prev': 'Previous lesson',
      'learn.pages': 'Pages',
      'learn.flash': 'Tap a card to flip',
      'learn.empty': 'Choose a lesson on the left to begin.',
      'quiz.title': 'Quiz',
      'quiz.choose': 'Choose a lesson or chapter',
      'quiz.start': 'Start quiz',
      'quiz.question': 'Question',
      'quiz.of': 'of',
      'quiz.correct': 'Correct!',
      'quiz.wrong': 'Not quite',
      'quiz.next': 'Next question',
      'quiz.finish': 'Finish',
      'quiz.retry': 'Try again',
      'quiz.review': 'Review answers',
      'quiz.score': 'Score',
      'quiz.answer': 'Answer',
      'quiz.explain': 'Explanation',
      'quiz.page': 'Page',
      'quiz.askbook': 'Ask the book about this',
      'quiz.average': 'Your average',
      'quiz.noquiz': 'This lesson has no quiz questions yet.',
      'chat.title': 'Ask the book',
      'chat.intro': 'Ask me about public international law — I answer from the textbook and the reference documents, and I always show the source page.',
      'chat.placeholder': 'Type your question… (e.g. what is sovereignty?)',
      'chat.send': 'Send',
      'chat.thinking': 'Searching the sources',
      'chat.evidence': 'Evidence from the sources',
      'chat.notfound': 'I could not find this in the three sources. Try different keywords, or pick one of the questions below.',
      'chat.sources': 'Sources found',
      'chat.related': 'Related lessons',
      'chat.showtext': 'Show source text',
      'chat.clear': 'Clear conversation',
      'chat.suggest': 'Example questions',
      'chat.key': 'Connect an AI model (optional)',
      'chat.keyhelp': 'Add an API key for smoother answers and on-the-fly translation. The key is stored only in your browser.',
      'chat.local': 'No-key mode: retrieves passages and shows the real text',
      'gloss.title': 'Legal glossary',
      'gloss.search': 'Search a term (Khmer or English)…',
      'gloss.term': 'Term',
      'gloss.en': 'English',
      'gloss.def': 'Definition',
      'gloss.chapter': 'Chapter',
      'gloss.flashmode': 'Flashcard mode',
      'gloss.listmode': 'Table mode',
      'gloss.count': 'terms',
      'about.title': 'About & sources',
      'about.sources': 'The three sources',
      'about.method': 'Method',
      'about.disclaimer': 'Disclaimer',
      'about.cite': 'How to cite',
      'progress.title': 'Your progress',
      'progress.lessons': 'lessons studied',
      'progress.xp': 'XP earned',
      'progress.rank': 'Rank',
      'progress.reset': 'Reset progress',
      'progress.streak': 'day streak',
      'common.search': 'Search…',
      'common.page': 'Page',
      'common.close': 'Close',
      'common.copy': 'Copy citation',
      'common.copied': 'Copied!',
      'common.loading': 'Loading…',
      'common.km': 'Khmer',
      'common.en': 'English',
      'common.all': 'All',
      'common.notes': 'My notes',
      'common.notes.ph': 'Write your own notes for this lesson…',
      'foot.disclaimer': 'This study tool is for learning only and is not legal advice. All quoted text remains the property of its original authors.'
    }
  };

  const state = {
    lang: localStorage.getItem(STORE.lang) || 'km',
    theme: localStorage.getItem(STORE.theme) || 'dark'
  };

  function t(key) {
    const L = I18N[state.lang] || I18N.en;
    return L[key] || I18N.en[key] || key;
  }

  /* ---------------- progress ---------------- */
  const RANKS = [
    { xp: 0, km: 'អ្នកចាប់ផ្តើម', en: 'Beginner' },
    { xp: 120, km: 'សិស្សច្បាប់', en: 'Law Student' },
    { xp: 320, km: 'អ្នកសិក្សា', en: 'Scholar' },
    { xp: 640, km: 'អ្នកវិភាគ', en: 'Analyst' },
    { xp: 1100, km: 'អ្នកជំនាញ', en: 'Specialist' },
    { xp: 1800, km: 'គ្រូបង្រៀន', en: 'Mentor' }
  ];

  const defaultProgress = () => ({
    lessons: {},          // lessonId -> {ts}
    quiz: {},             // quizId -> {best, total, ts, wrong:[qIndex]}
    xp: 0,
    streak: 0,
    lastDay: null,
    notes: {},            // lessonId -> text
    flashcards: {}        // termKey -> {box, ts}
  });

  function getProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE.progress) || '{}');
      return Object.assign(defaultProgress(), raw);
    } catch (e) {
      return defaultProgress();
    }
  }
  function saveProgress(p) {
    localStorage.setItem(STORE.progress, JSON.stringify(p));
    document.dispatchEvent(new CustomEvent('progress:changed', { detail: p }));
  }
  function addXP(n) {
    const p = getProgress();
    p.xp = (p.xp || 0) + n;
    const today = new Date().toISOString().slice(0, 10);
    if (p.lastDay !== today) {
      const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      p.streak = (p.lastDay === yest) ? (p.streak || 0) + 1 : 1;
      p.lastDay = today;
    }
    saveProgress(p);
    return p;
  }
  function rankFor(xp) {
    let r = RANKS[0];
    RANKS.forEach(function (x) { if (xp >= x.xp) r = x; });
    return r;
  }

  /* ---------------- utils ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money() { return ''; }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function toast(msg) {
    let node = qs('.toast');
    if (!node) { node = el('div', { class: 'toast' }); document.body.appendChild(node); }
    node.textContent = msg;
    node.classList.add('show');
    clearTimeout(node._t);
    node._t = setTimeout(function () { node.classList.remove('show'); }, 2200);
  }
  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast(t('common.copied')); });
    } else {
      const ta = el('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(t('common.copied')); } catch (e) {}
      ta.remove();
    }
  }
  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  /* pick the language variant of a {km,en} object honouring "both" mode */
  function pick(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    const L = lang || state.lang;
    if (L === 'both') return { km: obj.km || '', en: obj.en || '' };
    return obj[L] || obj.en || obj.km || '';
  }
  function bilingual(obj, cls) {
    if (!obj) return '';
    const km = obj.km || '', en = obj.en || '';
    if (state.lang === 'both') {
      if (km && en && km !== en) {
        return '<div class="' + (cls || '') + '"><div class="km">' + esc(km) + '</div><div class="en">' + esc(en) + '</div></div>';
      }
      return '<div class="' + (cls || '') + '">' + esc(km || en) + '</div>';
    }
    return esc(pick(obj));
  }

  /* ---------------- modal ---------------- */
  function modal(title, bodyHtml, footerHtml) {
    let wrap = qs('#modal-backdrop');
    if (!wrap) {
      wrap = el('div', { class: 'modal-backdrop', id: 'modal-backdrop' });
      wrap.innerHTML = '<div class="modal"><header><h3></h3><span class="spacer"></span>' +
        '<button class="icon-btn" data-close aria-label="close">✕</button></header><div class="body"></div></div>';
      document.body.appendChild(wrap);
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap || e.target.hasAttribute('data-close')) wrap.classList.remove('open');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') wrap.classList.remove('open');
      });
    }
    qs('header h3', wrap).textContent = title;
    qs('.body', wrap).innerHTML = bodyHtml;
    wrap.classList.add('open');
    return wrap;
  }

  /* ---------------- header / footer ---------------- */
  function renderChrome(active) {
    document.body.dataset.lang = state.lang;
    document.documentElement.dataset.theme = state.theme;
    const topbar = qs('#topbar');
    if (topbar) {
      topbar.innerHTML =
        '<a class="brand" href="index.html"><span class="mark">ច</span>' +
        '<span>' + esc(t('app.name')) + '<small>' + esc(t('app.sub')) + '</small></span></a>' +
        '<nav class="topnav">' +
        [['index.html', 'nav.home'], ['learn.html', 'nav.learn'], ['quiz.html', 'nav.quiz'],
         ['chat.html', 'nav.chat'], ['glossary.html', 'nav.glossary'], ['about.html', 'nav.about']]
          .map(function (x) {
            return '<a href="' + x[0] + '"' + (active === x[0] ? ' class="active"' : '') + '>' + esc(t(x[1])) + '</a>';
          }).join('') +
        '</nav><span class="spacer"></span>' +
        '<div class="lang-toggle" role="group" aria-label="language">' +
        ['km', 'en', 'both'].map(function (L) {
          return '<button data-lang="' + L + '" aria-pressed="' + (state.lang === L) + '">' + esc(t('lang.' + L)) + '</button>';
        }).join('') +
        '</div>' +
        '<button class="icon-btn" id="theme-btn" title="' + esc(t('theme.toggle')) + '">◐</button>';
      qsa('.lang-toggle button', topbar).forEach(function (b) {
        b.addEventListener('click', function () { setLang(b.dataset.lang); });
      });
      qs('#theme-btn', topbar).addEventListener('click', function () {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORE.theme, state.theme);
        document.documentElement.dataset.theme = state.theme;
      });
    }
    const foot = qs('#footer');
    if (foot) {
      foot.innerHTML = '<div class="wrap"><div>© ' + new Date().getFullYear() + ' · ' +
        esc(t('app.name')) + '</div><div class="small">' + esc(t('foot.disclaimer')) +
        '</div><div class="small"><a href="about.html">' + esc(t('nav.about')) + '</a></div></div>';
    }
  }

  function setLang(L) {
    if (L === state.lang) return;          // nothing to do: avoids a needless reload
    state.lang = L;
    localStorage.setItem(STORE.lang, L);
    window.location.reload();
  }

  /* ---------------- command palette (Ctrl+K) ---------------- */
  function commandPalette(items) {
    let host = qs('#cmd-palette');
    if (!host) {
      host = el('div', { class: 'modal-backdrop', id: 'cmd-palette' });
      host.innerHTML = '<div class="modal" style="max-width:620px"><header><h3>' + esc(t('common.search')) +
        '</h3><span class="spacer"></span><button class="icon-btn" data-close>✕</button></header>' +
        '<div class="body"><input class="search" id="cmd-input" placeholder="' + esc(t('common.search')) +
        '"><div id="cmd-results" style="margin-top:14px"></div></div></div>';
      document.body.appendChild(host);
      host.addEventListener('click', function (e) {
        if (e.target === host || e.target.hasAttribute('data-close')) host.classList.remove('open');
      });
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          host.classList.toggle('open');
          const inp = qs('#cmd-input', host);
          if (host.classList.contains('open') && inp) { inp.focus(); inp.select(); }
        }
        if (e.key === 'Escape') host.classList.remove('open');
      });
    }
    const input = qs('#cmd-input', host);
    const results = qs('#cmd-results', host);
    function render(q) {
      const list = items.filter(function (it) {
        if (!q) return true;
        return (it.text || '').toLowerCase().indexOf(q.toLowerCase()) >= 0;
      }).slice(0, 40);
      results.innerHTML = list.map(function (it) {
        return '<div><a href="' + it.href + '" style="display:block;padding:9px 10px;border-radius:9px">' +
          '<span class="pill">' + esc(it.kind) + '</span> ' + esc(it.text) + '</a></div>';
      }).join('') || '<div class="muted small">—</div>';
    }
    input.addEventListener('input', function () { render(input.value.trim()); });
    render('');
  }

  /* ---------------- error surfacing (a static app should say when it breaks) -- */
  window.addEventListener('error', function (e) {
    try {
      let bar = document.getElementById('err-bar');
      if (!bar) {
        bar = el('div', { id: 'err-bar' });
        bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:200;background:#5a1d24;color:#ffd9de;' +
          'padding:9px 14px;font:13px/1.4 ui-monospace,monospace;border-top:1px solid #a33';
        document.body.appendChild(bar);
      }
      bar.textContent = 'Script error: ' + (e.message || e.error) + ' — reload the page if the app misbehaves.';
    } catch (x) {}
  });

  window.IPL = {
    state: state, t: t, I18N: I18N, STORE: STORE,
    getProgress: getProgress, saveProgress: saveProgress, addXP: addXP, rankFor: rankFor, RANKS: RANKS,
    esc: esc, qs: qs, qsa: qsa, el: el, toast: toast, copyText: copyText, truncate: truncate,
    pick: pick, bilingual: bilingual, modal: modal, renderChrome: renderChrome,
    setLang: setLang, commandPalette: commandPalette
  };
})();
