/* ==========================================================================
   core.js — app shell for RoboCL · Public International Law Study Hub
   Two languages only (km / en), auth-aware chrome, progress, motion helpers.
   ========================================================================== */
(function () {
  'use strict';

  const STORE = {
    lang: 'robo.lang',
    theme: 'robo.theme',
    progress: 'robo.progress',
    api: 'robo.api',
    session: 'robo.session',
    accounts: 'robo.accounts',
    events: 'robo.events',
    chats: 'robo.chats',
    notes: 'robo.notes',
    seen: 'robo.seen'
  };

  /* Every storage touch goes through these. Blocked or denied storage (private
     browsing, sandboxed iframes, storage turned off) must degrade to defaults —
     an exception here would kill the shell before window.IPL exists. */
  function sGet(key, dflt) {
    try { const v = localStorage.getItem(key); return v == null ? (dflt === undefined ? null : dflt) : v; }
    catch (e) { return dflt === undefined ? null : dflt; }
  }
  function sSet(key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }
  function sDel(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function sJSON(key, dflt) {
    try { const v = JSON.parse(sGet(key, 'null')); return v == null ? dflt : v; }
    catch (e) { return dflt; }
  }

  /* the language for THIS page: an explicit ?_l= wins (so shared and deep links
     actually work), then the remembered choice */
  function bootLang() {
    try {
      const q = new URLSearchParams(location.search).get('_l');
      if (q === 'en' || q === 'km') return q;
    } catch (e) {}
    return sGet(STORE.lang, 'km') === 'en' ? 'en' : 'km';
  }
  const state = {
    lang: bootLang(),
    theme: sGet(STORE.theme, 'dark') === 'light' ? 'light' : 'dark'
  };
  /* ?_l= has been consumed — keep the address bar and the Back button clean */
  try {
    const _u = new URL(location.href);
    if (_u.searchParams.has('_l') && window.history && history.replaceState) {
      _u.searchParams.delete('_l');
      history.replaceState(null, '', _u.pathname + (_u.search || '') + _u.hash);
    }
  } catch (e) {}

  /* ------------------------------------------------------------ i18n */
  const I18N = {
    km: {
      'app.name': 'RoboCL',
      'app.sub': 'ច្បាប់សាធារណៈអន្តរជាតិ',
      'app.tag': 'គ្រូបង្រៀន AI សម្រាប់ច្បាប់សាធារណៈអន្តរជាតិ',
      'nav.home': 'ទំព័រដើម',
      'nav.dashboard': 'ផ្ទាំងគ្រប់គ្រង',
      'nav.learn': 'មេរៀន',
      'nav.quiz': 'តេស្ត',
      'nav.teacher': 'គ្រូ AI',
      'nav.library': 'សៀវភៅ',
      'nav.glossary': 'វាក្យសព្ទ',
      'nav.about': 'អំពី',
      'nav.account': 'គណនី',
      'nav.admin': 'ទិន្នន័យអ្នកប្រើ',
      'lang.km': 'ខ្មែរ',
      'lang.en': 'English',
      'lang.label': 'ភាសា',
      'theme.toggle': 'ប្តូរពន្លឺ',
      'menu.profile': 'គណនីរបស់ខ្ញុំ',
      'menu.progress': 'វឌ្ឍនភាព',
      'menu.signout': 'ចាកចេញ',
      'menu.signin': 'ចូលប្រើ',
      'user.guest': 'ភ្ញៀវ',

      'landing.eyebrow': 'សិក្សាដោយគ្រូ AI',
      'landing.h1a': 'រៀន',
      'landing.h1b': 'ច្បាប់សាធារណៈអន្តរជាតិ',
      'landing.lede': 'សៀវភៅសិក្សាខ្មែរ បំប្លែងទៅជាមេរៀន ៣៣, សំណួរតេស្ត ២៣៨ និងគ្រូ AI ដែលឆ្លើយដោយយោងទំព័រពិតប្រាកដក្នុងសៀវភៅ។',
      'landing.cta.start': 'ចាប់ផ្តើមឥតគិតថ្លៃ',
      'landing.cta.signin': 'មានគណនីរួចហើយ',
      'landing.cta.tour': 'មើលអ្វីដែលមាន',
      'landing.note': 'បង្កើតគណនីដោយឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់ប៉ុណ្ណោះ — គ្មានអ៊ីមែល គ្មានការទូទាត់។',
      'landing.demo.q': 'តើអធិបតេយ្យភាពជាអ្វី?',
      'landing.demo.think': 'កំពុងស្វែងរកក្នុងសៀវភៅ…',
      'landing.demo.a': 'អធិបតេយ្យភាព គឺជាអំណាចខ្ពស់បំផុតរបស់រដ្ឋនៅក្នុងទឹកដីរបស់ខ្លួន និងភាពស្មើគ្នានៅលើឆាកអន្តរជាតិ។',
      'landing.demo.cite': 'សៀវភៅ ទំព័រ ៤៥',
      'landing.quick.eyebrow': 'សម្រាប់អ្នកប្រើថ្មី',
      'landing.quick.title': 'ចាប់ផ្តើមក្នុង ៣ ជំហាន',
      'landing.quick.sub': 'មិនត្រូវការចំណេះដឹងមុនទេ — គ្រាន់តែចុចមើលបាន។',
      'landing.quick.1': '១. អានមេរៀន',
      'landing.quick.1d': 'មេរៀនខ្លីៗ ៣៣ មានសង្ខេបងាយយល់ និងសម្រង់ពីសៀវភៅ។',
      'landing.quick.2': '២. ធ្វើតេស្តខ្លួនឯង',
      'landing.quick.2d': 'សំណួរ ២៣៨ ជាមួយការពន្យល់ និងទំព័រយោង។',
      'landing.quick.3': '៣. សួរគ្រូ AI',
      'landing.quick.3d': 'សួរអ្វីក៏បាន — គាត់ឆ្លើយ ហើយបង្ហាញទំព័រក្នុងសៀវភៅ។',
      'landing.quick.go': 'បើក',
      'landing.stat.pages': 'ទំព័រសៀវភៅ',
      'landing.stat.chapters': 'ជំពូក',
      'landing.stat.lessons': 'មេរៀន',
      'landing.stat.questions': 'សំណួរតេស្ត',
      'landing.stat.terms': 'ពាក្យបច្ចេកទេស',
      'landing.stat.sources': 'ឯកសារប្រភព',

      'landing.tour.eyebrow': 'អ្វីដែលមានក្នុងគេហទំព័រ',
      'landing.tour.title': 'ជំនួយការសិក្សាទាំង ៥',
      'landing.tour.sub': 'គ្រប់មុខងារធ្វើការលើទូរស័ព្ទ និងកុំព្យូទ័រ ហើយអាចប្រើបានទាំងភាសាខ្មែរ និងអង់គ្លេស។',
      'landing.f1.t': 'គ្រូ AI ឈ្មោះ RoboCL',
      'landing.f1.d': 'សួរបានគ្រប់ពេល ដូចកំពុងសួរគ្រូ — ឆ្លើយជាជំហានៗ ពន្យល់ លើកឧទាហរណ៍ ហើយប្រាប់ទំព័រក្នុងសៀវភៅជានិច្ច។',
      'landing.f2.t': 'មេរៀនតាមសៀវភៅ',
      'landing.f2.d': 'ជំពូក ១០ និងមេរៀន ៣៣ តាមលំដាប់សៀវភៅ ជាមួយគោលបំណង ចំណុចសំខាន់ សម្រង់ដើម និងកាតពាក្យ។',
      'landing.f3.t': 'តេស្តខ្លួនឯង',
      'landing.f3.d': 'សំណួរ ២៣៨ សម្រាប់មេរៀននីមួយៗ ជំពូក ឬតេស្តចម្រុះ — មានការពន្យល់ និងទំព័រយោងភ្លាមៗ។',
      'landing.f4.t': 'សៀវភៅ និងឯកសារដើម',
      'landing.f4.d': 'អានសៀវភៅសិក្សាទំព័រម្តងមួយ, មើលឯកសារ PDF ដើម និងមើលគំរូទំព័រពិត។',
      'landing.f5.t': 'វាក្យសព្ទច្បាប់',
      'landing.f5.d': 'ពាក្យបច្ចេកទេស ១៩៣ ខ្មែរ–អង់គ្លេស ជាមួយនិយមន័យ និងទំព័រដែលពាក្យនោះលេចឡើង។',
      'landing.steps.eyebrow': 'របៀបប្រើ',
      'landing.steps.title': 'ចាប់ផ្តើមក្នុង ៤ ជំហាន',
      'landing.s1.t': 'បង្កើតគណនី',
      'landing.s1.d': 'ឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់ប៉ុណ្ណោះ។ បន្ទាប់មកអ្នកចូលបានភ្លាម។',
      'landing.s2.t': 'ជ្រើសរើសមេរៀន',
      'landing.s2.d': 'ចាប់ផ្តើមពីជំពូក ១ ឬបន្តពីកន្លែងដែលអ្នកឈប់ — វឌ្ឍនភាពត្រូវបានរក្សាទុក។',
      'landing.s3.t': 'សួរគ្រូ AI',
      'landing.s3.d': 'ពេលមិនយល់ សួរ RoboCL ភ្លាម។ វានឹងរកក្នុងសៀវភៅ ហើយបង្ហាញទំព័រដែលត្រូវអាន។',
      'landing.s4.t': 'តេស្តខ្លួនឯង',
      'landing.s4.d': 'ធ្វើតេស្តមេរៀននីមួយៗ ដើម្បីដឹងថាអ្នកចាំបានឬអត់ មុនពេលប្រឡង។',
      'landing.sources.title': 'ប្រភពទាំង ៣ ដែលប្រើ',
      'landing.sources.sub': 'គ្រប់ចម្លើយ និងសម្រង់ក្នុងគេហទំព័រមកពីឯកសារទាំងនេះតែប៉ុណ្ណោះ — គ្មានការប្រឌិតឡើយ។',
      'landing.faq.title': 'សំណួរញឹកញាប់',
      'landing.q1': 'តើត្រូវការអ៊ីមែលដើម្បីចុះឈ្មោះទេ?',
      'landing.a1': 'ទេ។ គ្រាន់តែឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់ប៉ុណ្ណោះ។ លេខសម្ងាត់ត្រូវបានធ្វើកូដនៅក្នុងកម្មវិធីរុករករបស់អ្នក មិនរក្សាទុកជាអក្សរធម្មតាទេ។',
      'landing.q2': 'តើអាចប្រើដោយគ្មានអ៊ីនធឺណិតទេ?',
      'landing.a2': 'បាន។ បើអ្នកទាញយកឯកសារគេហទំព័រ មេរៀន តេស្ត វាក្យសព្ទ និងគ្រូ AI ដំណើរការក្នុងកម្មវិធីរុករកតែម្តង។',
      'landing.q3': 'តើគ្រូ AI ប្រឌិតចម្លើយទេ?',
      'landing.a3': 'ទេ។ RoboCL ស្វែងរកក្នុងអត្ថបទសៀវភៅ និងឯកសារយោង ហើយលើកសម្រង់ដើមជាមួយលេខទំព័រ។ បើរកមិនឃើញ វានិយាយត្រង់ៗថារកមិនឃើញ។',
      'landing.q4': 'តើប្រើជាភាសាអង់គ្លេសទាំងអស់បានទេ?',
      'landing.a4': 'បាន។ ចុចប៊ូតុងភាសានៅខាងលើ រួចជ្រើសរើស English — ចំណុចប្រទាក់ទាំងមូល និងមេរៀននឹងប្តូរជាភាសាអង់គ្លេស។',
      'landing.cta.title': 'ចាប់ផ្តើមសិក្សាថ្ងៃនេះ',
      'landing.cta.sub': 'គណនីឥតគិតថ្លៃ។ វឌ្ឍនភាពរបស់អ្នកត្រូវបានរក្សាទុកដោយស្វ័យប្រវត្តិ។',

      'auth.signin': 'ចូលប្រើ',
      'auth.signup': 'បង្កើតគណនី',
      'auth.welcome': 'សូមស្វាគមន៍មកវិញ',
      'auth.welcome.new': 'បង្កើតគណនីថ្មី',
      'auth.username': 'ឈ្មោះអ្នកប្រើ',
      'auth.username.ph': 'ឧ. panha',
      'auth.password': 'លេខសម្ងាត់',
      'auth.password.ph': 'យ៉ាងតិច ៨ តួអក្សរ',
      'auth.confirm': 'បញ្ជាក់លេខសម្ងាត់',
      'auth.remember': 'ចងចាំខ្ញុំនៅក្នុងឧបករណ៍នេះ',
      'auth.have': 'មានគណនីរួចហើយ?',
      'auth.havenot': 'មិនទាន់មានគណនី?',
      'auth.only': 'គ្រាន់តែឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់ — គ្មានអ៊ីមែលទេ។',
      'auth.benefit.1': 'មេរៀន ៣៣ ជាមួយសម្រង់ពីសៀវភៅពិត',
      'auth.benefit.2': 'សំណួរតេស្ត ២៣៨ ជាមួយការពន្យល់',
      'auth.benefit.3': 'គ្រូ AI RoboCL ឆ្លើយដោយយោងទំព័រ',
      'auth.benefit.4': 'សៀវភៅ និងឯកសារដើមអានបានទាំងអស់',
      'auth.err.short.user': 'ឈ្មោះអ្នកប្រើត្រូវមានយ៉ាងតិច ៣ តួអក្សរ (a-z, 0-9, _)។',
      'auth.err.short.pass': 'លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ។',
      'auth.err.long.pass': 'លេខសម្ងាត់វែងពេក (អតិបរមា ១២៨ តួអក្សរ)។',
      'auth.err.locked': 'ព្យាយាមច្រើនដងពេក — សូមរង់ចាំប្រហែល ១០ នាទី រួចព្យាយាមម្តងទៀត។',
      'auth.err.match': 'លេខសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ។',
      'auth.err.taken': 'ឈ្មោះអ្នកប្រើនេះមានគេប្រើរួចហើយ។',
      'auth.err.bad': 'ឈ្មោះអ្នកប្រើ ឬលេខសម្ងាត់មិនត្រឹមត្រូវ។',
      'auth.err.empty': 'សូមបំពេញព័ត៌មានទាំងអស់។',
      'auth.strength': 'កម្រិតលេខសម្ងាត់',
      'auth.created': 'គណនីបានបង្កើតជោគជ័យ! សូមស្វាគមន៍',
      'auth.signedin': 'ចូលប្រើបានជោគជ័យ',
      'auth.signedout': 'អ្នកបានចាកចេញ',
      'auth.need': 'សូមចូលប្រើជាមុនសិន ដើម្បីមើលទំព័រនេះ។',
      'auth.showpass': 'បង្ហាញលេខសម្ងាត់',
      'auth.localnote': 'គណនីត្រូវបានរក្សាទុកនៅក្នុងកម្មវិធីរុករកនេះ ដោយលេខសម្ងាត់ធ្វើកូដសុវត្ថិភាព (PBKDF2)។',
      'auth.consent': 'ឈ្មោះអ្នកប្រើ និងពេលវេលាចូលប្រើរបស់អ្នក ត្រូវបានកត់ត្រាទុកសម្រាប់ម្ចាស់វេបសាយ (លេខសម្ងាត់មិនត្រូវបានកត់ត្រាទេ)។',
      'auth.consent.short': 'ព័ត៌មានចូលប្រើត្រូវបានកត់ត្រា',
      'auth.err.offline': 'គណនីនេះស្ថិតក្នុងមូលដ្ឋានទិន្នន័យអនឡាញ — ត្រូវការអ៊ីនធឺណិតដើម្បីចូលប្រើ។',

      'dash.hi': 'សូមស្វាគមន៍',
      'dash.sub': 'នេះជាវឌ្ឍនភាពរបស់អ្នកថ្ងៃនេះ។',
      'dash.continue': 'បន្តការសិក្សា',
      'dash.pickup': 'បន្តពីមេរៀនដែលអ្នកឈប់',
      'dash.fresh': 'ចាប់ផ្តើមមេរៀនដំបូង',
      'dash.progress': 'វឌ្ឍនភាពសិក្សា',
      'dash.chapters': 'ជំពូកទាំងអស់',
      'dash.quick': 'ធ្វើអ្វីបន្ទាប់?',
      'dash.q.learn': 'អានមេរៀនមួយ',
      'dash.q.quiz': 'ធ្វើតេស្តខ្លី',
      'dash.q.teacher': 'សួរគ្រូ RoboCL',
      'dash.q.library': 'បើកសៀវភៅ',
      'dash.studied': 'បានសិក្សា',
      'dash.best': 'ពិន្ទុល្អបំផុត',
      'dash.streak': 'ថ្ងៃជាប់ៗគ្នា',
      'dash.rank': 'កម្រិត',
      'dash.reset': 'កំណត់វឌ្ឍនភាពឡើងវិញ',
      'dash.notes': 'កំណត់សម្គាល់របស់ខ្ញុំ',

      'learn.title': 'មេរៀន',
      'learn.sub': 'ជំពូក ១០ · មេរៀន ៣៣ · តាមលំដាប់សៀវភៅ',
      'learn.pick': 'ជ្រើសរើសមេរៀន',
      'learn.inshort': 'សង្ខេបខ្លី',
      'learn.inshort.sub': 'គំនិតសំខាន់ៗ ក្នុងប៉ុន្មានបន្ទាត់ខ្លីៗ',
      'learn.inshort.ask': 'ពន្យល់ឲ្យសាមញ្ញ៖ ',
      'learn.explainsimple': 'ពន្យល់បន្ថែម',
      'learn.objectives': 'គោលបំណងសិក្សា',
      'learn.chapter': 'ជំពូក',
      'learn.pages': 'ទំព័រ',
      'learn.plain': 'ពន្យល់ងាយៗ',
      'learn.progress': 'វឌ្ឍនភាពជំពូក',
      'learn.viewerNote': 'កម្មវិធីរុករកបង្ហាញឯកសារ PDF នេះ។ របារខាងលើរាប់ផ្នែក និងទំព័រដែលអ្នកបានមើលរួច។',
      'learn.viewPDF': 'ឯកសារ PDF',
      'learn.slides': 'ស្លាយ',
      'learn.slide': 'ស្លាយ',
      'learn.bookPage': 'ទំព័រសៀវភៅ',
      'learn.wholeChapter': 'អានជំពូកទាំងមូល',
      'learn.guide': 'រៀនបន្តិចម្តងៗ',
      'learn.guideHint': 'ចុច «បន្ត» ដើម្បីទៅចំណុចបន្ទាប់ (ឬប្រើគ្រាប់ចុច ← →)។',
      'learn.guideDone': 'អបអរសាទរ! អ្នកបានរៀនមេរៀននេះចប់ហើយ។',
      'learn.next': 'បន្ត',
      'learn.back': 'ត្រឡប់',
      'learn.finish': 'ចប់មេរៀន',
      'learn.kObjective': 'គោលបំណង',
      'learn.kExplanation': 'ពន្យល់',
      'learn.kKeypoint': 'ចំណុចសំខាន់',
      'learn.lessonStart': 'ចាប់ផ្តើមមេរៀន',
      'learn.inChapter': 'ក្នុងជំពូក',
      'learn.studied': 'បានរៀនរួច',
      'learn.keypoints': 'ចំណុចសំខាន់',
      'learn.quotes': 'សម្រង់ពីសៀវភៅ',
      'learn.terms': 'ពាក្យបច្ចេកទេស',
      'learn.quiz': 'ធ្វើតេស្តមេរៀននេះ',
      'learn.ask': 'សួរគ្រូ AI ពីមេរៀននេះ',
      'learn.mark': 'សម្គាល់ថាបានសិក្សា',
      'learn.marked': 'បានសិក្សា ✓',
      'learn.next': 'មេរៀនបន្ទាប់',
      'learn.prev': 'មេរៀនមុន',
      'learn.pages': 'ទំព័រ',
      'learn.flash': 'ចុចកាតដើម្បីត្រឡប់',
      'learn.empty': 'ជ្រើសរើសមេរៀនមួយដើម្បីចាប់ផ្តើម។',
      'learn.notes': 'កំណត់សម្គាល់ផ្ទាល់ខ្លួន',
      'learn.notes.ph': 'សរសេរអ្វីដែលអ្នកចង់ចាំពីមេរៀននេះ…',
      'learn.saved': 'បានរក្សាទុក',
      'learn.copy': 'ចម្លងការយោង',
      'learn.print': 'បោះពុម្ព',
      'learn.readsource': 'អានក្នុងសៀវភៅ',

      'quiz.title': 'តេស្ត',
      'quiz.sub': 'សំណួរ ២៣៨ · ពន្យល់ភ្លាមៗ · ទំព័រយោង',
      'quiz.choose': 'ជ្រើសរើសអ្វីដែលអ្នកចង់តេស្ត',
      'quiz.mixed': 'តេស្តចម្រុះ ១០ សំណួរ',
      'quiz.mixed.d': 'សំណួរចៃដន្យពីគ្រប់ជំពូក — ល្អសម្រាប់ពិនិត្យមុនប្រឡង។',
      'quiz.start': 'ចាប់ផ្តើម',
      'quiz.question': 'សំណួរ',
      'quiz.of': 'ក្នុងចំណោម',
      'quiz.correct': 'ត្រឹមត្រូវ!',
      'quiz.wrong': 'មិនទាន់ត្រូវ',
      'quiz.next': 'សំណួរបន្ទាប់',
      'quiz.finish': 'មើលលទ្ធផល',
      'quiz.retry': 'ធ្វើម្តងទៀត',
      'quiz.review': 'ពិនិត្យចម្លើយ',
      'quiz.score': 'ពិន្ទុ',
      'quiz.answer': 'ចម្លើយត្រឹមត្រូវ',
      'quiz.explain': 'ពន្យល់',
      'quiz.page': 'ទំព័រ',
      'quiz.questions': 'សំណួរ',
      'quiz.ask': 'សួរគ្រូ AI ពីសំណួរនេះ',
      'quiz.best': 'ល្អបំផុត',
      'quiz.repeat': 'លទ្ធផលមិនប្រសើរជាងមុន — មិនបាន XP ថ្មីទេ។ ខិតខំឲ្យលើសកំណត់ចាស់ដើម្បីទទួលបានបន្ថែម។',
      'quiz.again': 'តេស្តម្តងទៀត',
      'quiz.perfect': 'ល្អឥតខ្ចោះ! អ្នកពូកែណាស់។',
      'quiz.good': 'ល្អណាស់! បន្តបែបនេះ។',
      'quiz.keep': 'មិនអីទេ — អានមេរៀនម្តងទៀត រួចព្យាយាមម្តងទៀត។',
      'quiz.noquiz': 'មេរៀននេះមិនទាន់មានសំណួរទេ។',
      'quiz.lesson': 'មេរៀន',
      'quiz.chapter': 'ជំពូក',

      'teacher.title': 'គ្រូ AI RoboCL',
      'teacher.sub': 'សួរបានគ្រប់ពេល — ចម្លើយមកពីសៀវភៅ និងឯកសារយោងជាមួយលេខទំព័រ',
      'teacher.placeholder': 'សួរគ្រូ RoboCL អំពីច្បាប់សាធារណៈអន្តរជាតិ…',
      'teacher.send': 'ផ្ញើ',
      'teacher.newchat': 'ការសន្ទនាថ្មី',
      'teacher.history': 'ការសន្ទនាមុនៗ',
      'teacher.nohistory': 'មិនទាន់មានការសន្ទនាទេ',
      'teacher.you': 'អ្នក',
      'teacher.intro': 'សូមស្វាគមន៍! ខ្ញុំជា RoboCL គ្រូបង្រៀនច្បាប់សាធារណៈអន្តរជាតិរបស់អ្នក។ សួរខ្ញុំអំពីសៀវភៅសិក្សា ឬឯកសារយោង — ខ្ញុំនឹងពន្យល់ជាជំហានៗ ហើយបង្ហាញទំព័រដែលត្រូវអានជានិច្ច។',
      'teacher.hint': 'RoboCL អានតែឯកសារប្រភពទាំង ៣ ប៉ុណ្ណោះ។ បើរកមិនឃើញ វានឹងប្រាប់ត្រង់ៗ។',
      'teacher.thinking': 'RoboCL កំពុងគិត',
      'teacher.step1': 'កំពុងអានសំណួររបស់អ្នក',
      'teacher.step2': 'កំពុងស្វែងរកក្នុងសៀវភៅ និងឯកសារ',
      'teacher.step3': 'កំពុងប្រៀបធៀបអត្ថបទដែលរកឃើញ',
      'teacher.step4': 'កំពុងរៀបចំចម្លើយជាជំហានៗ',
      'teacher.step5': 'កំពុងពិនិត្យលេខទំព័រ',
      'teacher.answer': 'ចម្លើយ',
      'teacher.why': 'ហេតុអ្វីបានជាដូច្នេះ',
      'teacher.evidence': 'អត្ថបទដើមពីសៀវភៅ',
      'teacher.remember': 'ចាំចំណុចនេះ',
      'teacher.check': 'សាកល្បងខ្លួនឯង',
      'teacher.related': 'មេរៀនពាក់ព័ន្ធ',
      'teacher.fromLesson': 'មេរៀនដែលពាក់ព័ន្ធ:',
      'teacher.sources': 'ប្រភពដែលបានប្រើ',
      'teacher.notfound': 'ខ្ញុំរកមិនឃើញរឿងនេះក្នុងឯកសារប្រភពទេ។ សូមព្យាយាមសួរខុសគ្នា ឬជ្រើសរើសសំណួរគំរូខាងក្រោម។',
      'teacher.closest': 'ខ្ញុំមិនឃើញចម្លើយផ្ទាល់ទេ ប៉ុន្តែនេះជាអត្ថបទជិតបំផុតក្នុងសៀវភៅ៖',
      'teacher.showtext': 'មើលអត្ថបទទាំងមូល',
      'teacher.copy': 'ចម្លងចម្លើយ',
      'teacher.clear': 'លុបការសន្ទនា',
      'teacher.simpler': 'ពន្យល់ងាយជាង',
      'teacher.example': 'សុំឧទាហរណ៍',
      'teacher.quizme': 'សួរខ្ញុំសំណួរមួយ',
      'teacher.more': 'ប្រាប់បន្ថែម',
      'teacher.suggest': 'សំណួរគំរូ',
      'teacher.side': 'ការសន្ទនា',
      'teacher.sent': 'សំណួរបានផ្ញើ',

      'lib.title': 'សៀវភៅ និងឯកសារប្រភព',
      'lib.sub': 'អានសៀវភៅសិក្សា និងឯកសារយោងទាំងអស់នៅក្នុងគេហទំព័រនេះ',
      'lib.pick': 'ជ្រើសរើសឯកសារ',
      'lib.pages': 'ទំព័រ',
      'lib.page': 'ទំព័រ',
      'lib.loading': 'កំពុងផ្ទុក…',
      'lib.of': 'ក្នុងចំណោម',
      'lib.prev': 'ទំព័រមុន',
      'lib.next': 'ទំព័របន្ទាប់',
      'lib.view.text': 'អានជាអក្សរ',
      'lib.view.pdf': 'ឯកសារ PDF ដើម',
      'lib.view.shots': 'គំរូទំព័រពិត',
      'lib.open': 'បើកអាន',
      'lib.download': 'ទាញយក PDF',
      'lib.chapter': 'ជំពូក',
      'lib.gotopage': 'ទៅទំព័រ…',
      'lib.zoom': 'ចុចដើម្បីពង្រីក',
      'lib.fit': 'ការបង្ហាញ',
      'lib.fit.width': 'តាមទទឹងទំព័រ',
      'lib.fit.page': 'តាមទំព័រពេញ',
      'lib.newtab': 'បើកក្នុងផ្ទាំងថ្មី',
      'lib.pdf.loading': 'កំពុងផ្ទុក PDF…',
      'lib.pdf.blocked': 'កម្មវិធីរុករកនេះមិនអាចបង្ហាញ PDF ក្នុងទំព័របានទេ។ សូមបើក ឬទាញយកវាជំនួសវិញ។',
      'lib.kbhint': 'ចុច ← → ដើម្បីប្តូរទំព័រ',
      'lib.note': 'ឯកសារនេះជាកម្មសិទ្ធិរបស់អ្នកនិពន្ធ — ប្រើសម្រាប់ការសិក្សា។',
      'lib.textonly': 'ឯកសារនេះមានតែជាអក្សរប៉ុណ្ណោះ។',

      'gloss.title': 'វាក្យសព្ទច្បាប់',
      'gloss.sub': 'ពាក្យបច្ចេកទេស ខ្មែរ–អង្គគ្លេស ជាមួយនិយមន័យ និងទំព័រ',
      'gloss.search': 'ស្វែងរកពាក្យ (ខ្មែរ ឬអង់គ្លេស)…',
      'gloss.flash': 'របៀបកាត',
      'gloss.table': 'របៀបតារាង',
      'gloss.count': 'ពាក្យ',
      'gloss.def': 'និយមន័យ',
      'gloss.where': 'កន្លែងដែលពាក្យលេចឡើង',
      'gloss.empty': 'រកមិនឃើញពាក្យនេះទេ។',

      'about.title': 'អំពីគម្រោងនេះ',
      'about.made.by': 'បង្កើតដោយ',
      'about.role': 'អ្នកបង្កើត និងអ្នករចនា',
      'about.withai': 'បង្កើតឡើងដោយមនុស្ស + AI',
      'about.ai.text': 'គេហទំព័រនេះត្រូវបានសាងសង់ឡើងដោយ Sok Panha ជាមួយជំនួយពី AI — កូដ ការរចនា និងការសង្គ្រោះអត្ថបទខ្មែរពី PDF។',
      'about.story.title': 'រឿងនៃការបង្កើត',
      'about.tech.title': 'បច្ចេកវិទ្យាដែលប្រើ',
      'about.sources.title': 'ប្រភពឯកសារ',
      'about.method.title': 'វិធីសាស្ត្រ',
      'about.method.text': 'អត្ថបទខ្មែរក្នុង PDF ដើមមានបញ្ហាកូដ (ហ្វុន Word 2000)។ យើងសង្គ្រោះវាដោយប្រៀបធៀបរូបរាងអក្សរនីមួយៗជាមួយហ្វុន KhmerOS ក្នុងកុំព្យូទ័រ រួចរៀបលំដាប់អក្សរខ្មែរឡើងវិញ។ គ្រប់សម្រង់ក្នុងគេហទំព័រនេះត្រូវបានផ្ទៀងផ្ទាត់ថាដូចអត្ថបទដើម ១០០%។',
      'about.license': 'អាជ្ញាបណ្ណ និងសិទ្ធិ',
      'about.contact': 'ទំនាក់ទំនង',
      'about.disclaimer': 'ឧបករណ៍នេះសម្រាប់ការសិក្សាប៉ុណ្ណោះ មិនមែនជាយោបល់ផ្លូវច្បាប់ទេ។',
      'about.report': 'រកឃើញបញ្ហា? សូមប្រាប់យើង',

      'admin.title': 'ទិន្នន័យអ្នកប្រើ',
      'admin.sub': 'បញ្ជីគណនី និងកំណត់ត្រាការចូលប្រើ',
      'admin.code': 'កូដអ្នកគ្រប់គ្រង',
      'admin.enter': 'បើក',
      'admin.wrong': 'កូដមិនត្រឹមត្រូវ។',
      'admin.codelocked': 'បញ្ចូលកូដខុសច្រើនដងពេក — សូមរង់ចាំ ៥ នាទី។',
      'admin.users': 'គណនី',
      'admin.events': 'កំណត់ត្រាការចូលប្រើ',
      'admin.export': 'ទាញយក CSV',
      'admin.copy': 'ចម្លងទិន្នន័យ',
      'admin.none': 'មិនទាន់មានគណនីទេ។',
      'admin.cloud': 'ការប្រមូលទិន្នន័យ',
      'admin.collector.sheet': 'ភ្ជាប់ Google Sheet',
      'admin.collector.supabase': 'ភ្ជាប់ Supabase',
      'admin.collector.local': 'ក្នុងឧបករណ៍នេះតែប៉ុណ្ណោះ',
      'admin.test': 'ផ្ញើជួរសាកល្បង',
      'admin.tested': 'បានផ្ញើ! សូមពិនិត្យ Google Sheet របស់អ្នក',
      'admin.notest': 'មិនទាន់ភ្ជាប់ការប្រមូលទិន្នន័យទេ',
      'admin.opencollector': 'បើកតារាងទិន្នន័យ',
      'admin.db': 'មូលដ្ឋានទិន្នន័យគណនី',
      'admin.dbOn': 'ភ្ជាប់មូលដ្ឋានទិន្នន័យរួចរាល់',
      'admin.dbOff': 'មិនទាន់ភ្ជាប់មូលដ្ឋានទិន្នន័យ',
      'admin.loadacc': 'ទាញយកគណនីទាំងអស់ពីមូលដ្ឋានទិន្នន័យ',
      'admin.dbfail': 'មិនអាចភ្ជាប់មូលដ្ឋានទិន្នន័យបានទេ',
      'admin.dbnote': 'គណនីទាំងអស់ពីគ្រប់ឧបករណ៍ស្ថិតក្នុងមូលដ្ឋានទិន្នន័យ។ លេខសម្ងាត់ត្រូវបានធ្វើកូដ bcrypt នៅក្នុងមូលដ្ឋានទិន្នន័យ ហើយមិនអាចមើលឃើញឡើយ។',
      'admin.loaded': 'បានទាញយក',
      'admin.lock': 'ចាក់សោ',
      'admin.locked': 'បានចាក់សោទំព័រនេះ',
      'admin.owner': 'ចូលប្រើជាម្ចាស់គេហទំព័រ',
      'admin.ownernote': 'គណនីម្ចាស់ត្រូវបានផ្ទៀងផ្ទាត់នៅក្នុងមូលដ្ឋានទិន្នន័យ។ សូមប្រើឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់របស់អ្នក។',
      'admin.ownerhint': 'គណនីត្រូវមានសិទ្ធិ is_admin នៅក្នុងមូលដ្ឋានទិន្នន័យ។ មើល tools/supabase-accounts.sql។',
      'admin.ownerdenied': 'គណនីនេះមិនមានសិទ្ធិអ្នកគ្រប់គ្រងទេ។',
      'admin.dblocked': 'បញ្ចូលលេខសម្ងាត់ម្ចាស់ខុសច្រើនដងពេក — សូមរង់ចាំ ១៥ នាទី ឬលុបកំណត់ត្រា admin_denied ក្នុង SQL Editor សិន។',
      'admin.needcreds': 'សូមបញ្ចូលឈ្មោះ និងលេខសម្ងាត់ម្ចាស់។',
      'admin.nodb': 'មិនទាន់មានប្រព័ន្ធទិន្នន័យភ្ជាប់ទេ — បង្ហាញតែទិន្នន័យក្នុងកម្មវិធីរុករកនេះ។',
      'admin.setup': 'កំណត់កូដអ្នកគ្រប់គ្រងជាមុន',
      'admin.setuptext': 'ដើម្បីការពារទំព័រនេះ សូមបង្កើតកូដផ្ទាល់ខ្លួន រួចដាក់តែកូដហាស (hash) ក្នុងឯកសារកំណត់។',
      'admin.setupwhy': 'ដូច្នេះកូដពិតមិនបង្ហាញនៅក្នុងកូដប្រភពដែលគេមើលឃើញទេ។',
      'admin.hashnote': 'កូដអ្នកគ្រប់គ្រងត្រូវបានផ្ទៀងផ្ទាត់តាមកូដហាស។ នេះជាការការពារជាមូលដ្ឋានប៉ុណ្ណោះ មិនមែនជាសុវត្ថិភាពពិតប្រាកដទេ — ទិន្នន័យដែលបង្ហាញស្ថិតក្នុងកម្មវិធីរុករកនេះតែប៉ុណ្ណោះ។ សម្រាប់ទិន្នន័យសំខាន់ សូមប្រើប្រព័ន្ធទិន្នន័យ។ លេខសម្ងាត់អ្នកប្រើមិនអាចមើលឃើញឡើយ។',
      'admin.localonly': 'ទិន្នន័យខាងក្រោមមកពីកម្មវិធីរុករកនេះតែប៉ុណ្ណោះ។ ដើម្បីប្រមូលពីគ្រប់ឧបករណ៍ (ទូរស័ព្ទ កុំព្យូទ័រ) ត្រូវភ្ជាប់ Google Sheet ឬ Supabase — មើល tools/google-sheet-collector.gs និង docs/data/config.js។',

      'common.page': 'ទំព័រ',
      'common.close': 'បិទ',
      'common.cancel': 'បោះបង់',
      'common.save': 'រក្សាទុក',
      'common.print': 'បោះពុម្ព',
      'common.saved': 'បានរក្សាទុក',
      'common.copy': 'ចម្លង',
      'common.copied': 'បានចម្លង!',
      'common.loading': 'កំពុងផ្ទុក…',
      'common.search': 'ស្វែងរក…',
      'common.all': 'ទាំងអស់',
      'common.reset': 'កំណត់ឡើងវិញ',
      'common.done': 'រួចរាល់',
      'common.back': 'ត្រឡប់',
      'common.next': 'បន្ទាប់',
      'common.skip': 'រំលង',
      'common.of': 'ក្នុងចំណោម',
      'common.yes': 'យល់ព្រម',
      'common.no': 'ទេ',
      'foot.rights': 'ឧបករណ៍សិក្សាសម្រាប់ការសិក្សាប៉ុណ្ណោះ។ អត្ថបទទាំងអស់ជាកម្មសិទ្ធិរបស់អ្នកនិពន្ធ។',
      'foot.made': 'បង្កើតដោយ',
      'foot.with': 'ជាមួយ AI',
      'a11y.skip': 'លោតទៅខ្លឹមសារសំខាន់',
      'err.msg': 'មានបញ្ហាបច្ចេកទេសមួយ។ សូមផ្ទុកទំព័រឡើងវិញ បើទំព័រមិនដំណើរការត្រឹមត្រូវ។',
      'err.storage': 'មិនអាចរក្សាទុកបានទេ — ទំហំផ្ទុកក្នុងកម្មវិធីរុករកពេញ ឬត្រូវបានបិទ។',
      'auth.err.user.chars': 'ឈ្មោះអ្នកប្រើត្រូវមាន ៣–២០ តួអក្សរ ហើយប្រើបានតែអក្សរ លេខ ចំណុច និងសញ្ញា _ ប៉ុណ្ណោះ។',
      'auth.forgot': 'ភ្លេចលេខសម្ងាត់?',
      'auth.forgot.t': 'គណនីដែលភ្លេចលេខសម្ងាត់',
      'auth.forgot.d': 'គណនីនៅលើឧបករណ៍នេះមិនអាចដូរលេខសម្ងាត់ដោយស្វ័យប្រវត្តិបានទេ ព្រោះលេខសម្ងាត់មិនត្រូវបានរក្សាទុក។ បើអ្នកមិនអាចចូលប្រើបាន សូមបង្កើតគណនីថ្មី ឬសម្អាតទិន្នន័យឧបករណ៍នេះ (ប្រវត្តិសិក្សាទាំងអស់នឹងត្រូវលុប)។',
      'auth.forgot.clear': 'សម្អាតគណនី និងប្រវត្តិក្នុងឧបករណ៍នេះ',
      'auth.forgot.confirm': 'លុបគណនី និងប្រវត្តិសិក្សាទាំងអស់ក្នុងឧបករណ៍នេះមែនទេ?',
      'auth.forgot.done': 'ទិន្នន័យឧបករណ៍នេះត្រូវបានសម្អាតរួចរាល់។',
      'auth.engine.db': 'គណនីរួមគ្នាតាមពពក',
      'auth.engine.sheet': 'ព័ត៌មានចូលប្រើត្រូវបានកត់ត្រា',
      'auth.engine.local': 'រក្សាទុកក្នុងឧបករណ៍នេះ',
      'admin.testsent': 'បានផ្ញើទៅឧបករណ៍ប្រមូលហើយ — កម្មវិធីរុករកមិនអាចបញ្ជាក់បានទេ សូមបើក Google Sheet ដើម្បីផ្ទៀងផ្ទាត់។',
      'cmd.hint': 'វាយដើម្បីស្វែងរកមេរៀន ពាក្យ ឬទំព័រ',
      'cmd.none': 'រកមិនឃើញទេ'
    },
    en: {
      'app.name': 'RoboCL',
      'app.sub': 'Public International Law',
      'app.tag': 'Your AI teacher for public international law',
      'nav.home': 'Home',
      'nav.dashboard': 'Dashboard',
      'nav.learn': 'Lessons',
      'nav.quiz': 'Quiz',
      'nav.teacher': 'AI Teacher',
      'nav.library': 'Textbook',
      'nav.glossary': 'Glossary',
      'nav.about': 'About',
      'nav.account': 'Account',
      'nav.admin': 'User data',
      'lang.km': 'ខ្មែរ',
      'lang.en': 'English',
      'lang.label': 'Language',
      'theme.toggle': 'Toggle theme',
      'menu.profile': 'My account',
      'menu.progress': 'My progress',
      'menu.signout': 'Sign out',
      'menu.signin': 'Sign in',
      'user.guest': 'Guest',

      'landing.eyebrow': 'Learn with an AI teacher',
      'landing.h1a': 'Study',
      'landing.h1b': 'Public International Law',
      'landing.lede': 'The Khmer textbook turned into 33 lessons, 238 quiz questions and an AI teacher that always answers with the real page in the book.',
      'landing.cta.start': 'Start free',
      'landing.cta.signin': 'I have an account',
      'landing.cta.tour': 'See what is inside',
      'landing.note': 'Sign up with just a username and password — no email, no payment.',
      'landing.demo.q': 'What is sovereignty?',
      'landing.demo.think': 'searching the book…',
      'landing.demo.a': 'Sovereignty is a state’s supreme authority inside its own territory, and its equality on the international stage.',
      'landing.demo.cite': 'Book page 45',
      'landing.quick.eyebrow': 'New here?',
      'landing.quick.title': 'Start in three steps',
      'landing.quick.sub': 'No prior knowledge needed — just tap and read.',
      'landing.quick.1': '1. Read a lesson',
      'landing.quick.1d': '33 short lessons, each with a plain-language summary and quotes from the book.',
      'landing.quick.2': '2. Test yourself',
      'landing.quick.2d': '238 questions with explanations and the page to check.',
      'landing.quick.3': '3. Ask RoboCL',
      'landing.quick.3d': 'Ask anything — it answers and shows the page it came from.',
      'landing.quick.go': 'Open',
      'landing.stat.pages': 'book pages',
      'landing.stat.chapters': 'chapters',
      'landing.stat.lessons': 'lessons',
      'landing.stat.questions': 'quiz questions',
      'landing.stat.terms': 'key terms',
      'landing.stat.sources': 'source documents',

      'landing.tour.eyebrow': 'What is inside',
      'landing.tour.title': 'Five study tools',
      'landing.tour.sub': 'Everything works on phones and computers, in Khmer or English.',
      'landing.f1.t': 'RoboCL, your AI teacher',
      'landing.f1.d': 'Ask any time like you would ask a teacher — it answers step by step, explains, gives examples and always shows the page in the book.',
      'landing.f2.t': 'Lessons in book order',
      'landing.f2.d': '10 chapters and 33 lessons with objectives, key points, verbatim quotes and flashcard terms.',
      'landing.f3.t': 'Test yourself',
      'landing.f3.d': '238 questions per lesson, per chapter or mixed — with instant explanations and page references.',
      'landing.f4.t': 'The textbook and its sources',
      'landing.f4.d': 'Read the textbook page by page, open the original PDFs and see real page samples.',
      'landing.f5.t': 'Legal glossary',
      'landing.f5.d': '193 Khmer–English legal terms with definitions and the pages where they appear.',
      'landing.steps.eyebrow': 'How to use it',
      'landing.steps.title': 'Start in four steps',
      'landing.s1.t': 'Create an account',
      'landing.s1.d': 'Only a username and password. You are in immediately after that.',
      'landing.s2.t': 'Pick a lesson',
      'landing.s2.d': 'Start at chapter 1 or continue where you stopped — your progress is saved.',
      'landing.s3.t': 'Ask the AI teacher',
      'landing.s3.d': 'When something is unclear, ask RoboCL. It searches the book and shows the page to read.',
      'landing.s4.t': 'Quiz yourself',
      'landing.s4.d': 'Take the quizzes to check what you remember before an exam.',
      'landing.sources.title': 'The three sources it is built on',
      'landing.sources.sub': 'Every answer and quote in this app comes only from these documents — nothing invented.',
      'landing.faq.title': 'Common questions',
      'landing.q1': 'Do I need an email to sign up?',
      'landing.a1': 'No. Just a username and password. The password is hashed inside your browser and never stored as plain text.',
      'landing.q2': 'Does it work offline?',
      'landing.a2': 'Yes. If you download the site files, lessons, quizzes, glossary and the AI teacher all run in your browser.',
      'landing.q3': 'Does the AI teacher make things up?',
      'landing.a3': 'No. RoboCL retrieves from the textbook and reference documents and quotes the original text with its page number. When it cannot find something, it says so.',
      'landing.q4': 'Can I use it entirely in English?',
      'landing.a4': 'Yes. Use the language switch at the top and choose English — the whole interface and the lessons follow.',
      'landing.cta.title': 'Start studying today',
      'landing.cta.sub': 'Free account. Your progress is saved automatically.',

      'auth.signin': 'Sign in',
      'auth.signup': 'Create account',
      'auth.welcome': 'Welcome back',
      'auth.welcome.new': 'Create your account',
      'auth.username': 'Username',
      'auth.username.ph': 'e.g. panha',
      'auth.password': 'Password',
      'auth.password.ph': 'at least 8 characters',
      'auth.confirm': 'Confirm password',
      'auth.remember': 'Remember me on this device',
      'auth.have': 'Already have an account?',
      'auth.havenot': 'No account yet?',
      'auth.only': 'Just a username and password — no email needed.',
      'auth.benefit.1': '33 lessons with real quotes from the book',
      'auth.benefit.2': '238 quiz questions with explanations',
      'auth.benefit.3': 'RoboCL, the AI teacher, citing pages',
      'auth.benefit.4': 'The textbook and source documents to read',
      'auth.err.short.user': 'Username must be at least 3 characters (a-z, 0-9, _).',
      'auth.err.short.pass': 'Password must be at least 8 characters.',
      'auth.err.long.pass': 'That password is too long (128 characters maximum).',
      'auth.err.locked': 'Too many attempts — please wait about 10 minutes and try again.',
      'auth.err.match': 'The two passwords do not match.',
      'auth.err.taken': 'That username is already taken.',
      'auth.err.bad': 'Wrong username or password.',
      'auth.err.empty': 'Please fill in everything.',
      'auth.strength': 'Password strength',
      'auth.created': 'Account created! Welcome',
      'auth.signedin': 'Signed in successfully',
      'auth.signedout': 'You have signed out',
      'auth.need': 'Please sign in first to open this page.',
      'auth.showpass': 'Show password',
      'auth.localnote': 'Accounts are kept in this browser, with passwords hashed using PBKDF2.',
      'auth.consent': 'Your username and sign-in times are recorded for the site owner (your password is not recorded).',
      'auth.consent.short': 'Sign-ins are recorded',
      'auth.err.offline': 'This account lives in the online database — an internet connection is needed to sign in.',

      'dash.hi': 'Welcome',
      'dash.sub': 'Here is where you are today.',
      'dash.continue': 'Continue studying',
      'dash.pickup': 'Pick up where you stopped',
      'dash.fresh': 'Start the first lesson',
      'dash.progress': 'Your progress',
      'dash.chapters': 'All chapters',
      'dash.quick': 'What next?',
      'dash.q.learn': 'Read a lesson',
      'dash.q.quiz': 'Take a quiz',
      'dash.q.teacher': 'Ask RoboCL',
      'dash.q.library': 'Open the textbook',
      'dash.studied': 'lessons studied',
      'dash.best': 'best score',
      'dash.streak': 'day streak',
      'dash.rank': 'Rank',
      'dash.reset': 'Reset progress',
      'dash.notes': 'My notes',

      'learn.title': 'Lessons',
      'learn.sub': '10 chapters · 33 lessons · in the book’s own order',
      'learn.pick': 'Choose a lesson',
      'learn.inshort': 'In short',
      'learn.inshort.sub': 'The key idea in a few short lines',
      'learn.inshort.ask': 'Explain this simply: ',
      'learn.explainsimple': 'Explain this to me',
      'learn.objectives': 'Learning objectives',
      'learn.chapter': 'Chapter',
      'learn.pages': 'Pages',
      'learn.plain': 'In plain words',
      'learn.progress': 'Chapter progress',
      'learn.viewerNote': 'Your browser shows the PDF itself. The bar above counts the parts and the pages you have been through.',
      'learn.viewPDF': 'PDF',
      'learn.slides': 'slides',
      'learn.slide': 'Slide',
      'learn.bookPage': 'book page',
      'learn.wholeChapter': 'Read the whole chapter',
      'learn.guide': 'Learn it step by step',
      'learn.guideHint': 'Click Next for the next point (or use the ← → keys).',
      'learn.guideDone': 'Well done — you have been through this whole lesson.',
      'learn.next': 'Next',
      'learn.back': 'Back',
      'learn.finish': 'Finish',
      'learn.kObjective': 'Objective',
      'learn.kExplanation': 'Explanation',
      'learn.kKeypoint': 'Key point',
      'learn.lessonStart': 'Start of the lesson',
      'learn.inChapter': 'in this chapter',
      'learn.studied': 'Marked as studied',
      'learn.keypoints': 'Key points',
      'learn.quotes': 'Quotes from the book',
      'learn.terms': 'Key terms',
      'learn.quiz': 'Quiz this lesson',
      'learn.ask': 'Ask the AI teacher about this',
      'learn.mark': 'Mark as studied',
      'learn.marked': 'Studied ✓',
      'learn.next': 'Next lesson',
      'learn.prev': 'Previous lesson',
      'learn.pages': 'Pages',
      'learn.flash': 'Tap a card to flip',
      'learn.empty': 'Choose a lesson to begin.',
      'learn.notes': 'My notes',
      'learn.notes.ph': 'Write what you want to remember from this lesson…',
      'learn.saved': 'Saved',
      'learn.copy': 'Copy citation',
      'learn.print': 'Print',
      'learn.readsource': 'Read it in the book',

      'quiz.title': 'Quiz',
      'quiz.sub': '238 questions · instant explanations · page references',
      'quiz.choose': 'Choose what to practise',
      'quiz.mixed': 'Mixed quiz — 10 questions',
      'quiz.mixed.d': 'Random questions from every chapter — good for exam revision.',
      'quiz.start': 'Start',
      'quiz.question': 'Question',
      'quiz.of': 'of',
      'quiz.correct': 'Correct!',
      'quiz.wrong': 'Not quite',
      'quiz.next': 'Next question',
      'quiz.finish': 'See result',
      'quiz.retry': 'Try again',
      'quiz.review': 'Review answers',
      'quiz.score': 'Score',
      'quiz.answer': 'Correct answer',
      'quiz.explain': 'Explanation',
      'quiz.page': 'Page',
      'quiz.questions': 'questions',
      'quiz.ask': 'Ask the AI teacher about this',
      'quiz.best': 'Best',
      'quiz.repeat': 'No new XP — this run did not beat your best. Improve on it to earn more.',
      'quiz.again': 'Retake',
      'quiz.perfect': 'Perfect! Well done.',
      'quiz.good': 'Good work — keep going.',
      'quiz.keep': 'No problem — read the lesson again and retry.',
      'quiz.noquiz': 'This lesson has no questions yet.',
      'quiz.lesson': 'lesson',
      'quiz.chapter': 'chapter',

      'teacher.title': 'RoboCL — AI Teacher',
      'teacher.sub': 'Ask anything — answers come from the book and sources with page numbers',
      'teacher.placeholder': 'Ask RoboCL about public international law…',
      'teacher.send': 'Send',
      'teacher.newchat': 'New chat',
      'teacher.history': 'Previous chats',
      'teacher.nohistory': 'No conversations yet',
      'teacher.you': 'You',
      'teacher.intro': 'Welcome! I am RoboCL, your public international law teacher. Ask me about the textbook or the reference documents — I explain step by step and always show the page to read.',
      'teacher.hint': 'RoboCL only reads the three source documents. If something is not there, it will say so.',
      'teacher.thinking': 'RoboCL is thinking',
      'teacher.step1': 'Reading your question',
      'teacher.step2': 'Searching the textbook and sources',
      'teacher.step3': 'Comparing the passages found',
      'teacher.step4': 'Building the answer step by step',
      'teacher.step5': 'Checking the page numbers',
      'teacher.answer': 'Answer',
      'teacher.why': 'Why this is so',
      'teacher.evidence': 'Original text from the book',
      'teacher.remember': 'Remember this',
      'teacher.check': 'Check yourself',
      'teacher.related': 'Related lessons',
      'teacher.fromLesson': 'From the lesson:',
      'teacher.sources': 'Sources used',
      'teacher.notfound': 'I could not find this in the source documents. Try asking differently, or pick a sample question below.',
      'teacher.closest': 'I do not have a direct answer, but this is the closest text in the book:',
      'teacher.showtext': 'Show the full text',
      'teacher.copy': 'Copy answer',
      'teacher.clear': 'Clear conversation',
      'teacher.simpler': 'Explain simpler',
      'teacher.example': 'Give an example',
      'teacher.quizme': 'Quiz me on this',
      'teacher.more': 'Tell me more',
      'teacher.suggest': 'Sample questions',
      'teacher.side': 'Chats',
      'teacher.sent': 'Question sent',

      'lib.title': 'Textbook & sources',
      'lib.sub': 'Read the textbook and every reference document inside the app',
      'lib.pick': 'Choose a document',
      'lib.pages': 'pages',
      'lib.page': 'Page',
      'lib.loading': 'Loading…',
      'lib.of': 'of',
      'lib.prev': 'Previous page',
      'lib.next': 'Next page',
      'lib.view.text': 'Read as text',
      'lib.view.pdf': 'Original PDF',
      'lib.view.shots': 'Real page samples',
      'lib.open': 'Open',
      'lib.download': 'Download PDF',
      'lib.chapter': 'Chapter',
      'lib.gotopage': 'Go to page…',
      'lib.zoom': 'Click to zoom',
      'lib.fit': 'Display',
      'lib.fit.width': 'Fit width',
      'lib.fit.page': 'Fit page',
      'lib.newtab': 'Open in a new tab',
      'lib.pdf.loading': 'Loading the PDF…',
      'lib.pdf.blocked': 'This browser cannot show a PDF inside the page. Open or download it instead.',
      'lib.kbhint': 'Use ← → to turn pages',
      'lib.note': 'The documents belong to their authors — used here for study.',
      'lib.textonly': 'This document is available as text only.',

      'gloss.title': 'Legal glossary',
      'gloss.sub': 'Khmer–English legal terms with definitions and pages',
      'gloss.search': 'Search a term (Khmer or English)…',
      'gloss.flash': 'Flashcards',
      'gloss.table': 'Table',
      'gloss.count': 'terms',
      'gloss.def': 'Definition',
      'gloss.where': 'Appears in',
      'gloss.empty': 'No term matches that.',

      'about.title': 'About this project',
      'about.made.by': 'Created by',
      'about.role': 'Creator & designer',
      'about.withai': 'Made by a human + AI',
      'about.ai.text': 'This site was built by Sok Panha with the help of AI — the code, the design and the recovery of the Khmer text from the PDF.',
      'about.story.title': 'How it was built',
      'about.tech.title': 'Technology used',
      'about.sources.title': 'Source documents',
      'about.method.title': 'Method',
      'about.method.text': 'The Khmer text inside the original PDF has a broken encoding (a Word 2000 font). We recovered it by matching every glyph shape against the KhmerOS fonts on the machine, then rebuilt Khmer logical order. Every quote in this site is verified to match the original source.',
      'about.license': 'Licence & rights',
      'about.contact': 'Contact',
      'about.disclaimer': 'This tool is for study only and is not legal advice.',
      'about.report': 'Found a problem? Tell us',

      'admin.title': 'User data',
      'admin.sub': 'Accounts and sign-in records',
      'admin.code': 'Admin code',
      'admin.enter': 'Open',
      'admin.wrong': 'Wrong code.',
      'admin.codelocked': 'Too many wrong codes — please wait 5 minutes.',
      'admin.users': 'Accounts',
      'admin.events': 'Sign-in records',
      'admin.export': 'Download CSV',
      'admin.copy': 'Copy data',
      'admin.none': 'No accounts yet.',
      'admin.cloud': 'Collection',
      'admin.collector.sheet': 'Google Sheet connected',
      'admin.collector.supabase': 'Supabase connected',
      'admin.collector.local': 'This device only',
      'admin.test': 'Send a test row',
      'admin.tested': 'Sent! Check your Google Sheet.',
      'admin.notest': 'No collector connected yet',
      'admin.opencollector': 'Open the collected data',
      'admin.db': 'Account database',
      'admin.dbOn': 'Account database connected',
      'admin.dbOff': 'No account database',
      'admin.loadacc': 'Load every account from the database',
      'admin.dbfail': 'Could not reach the database',
      'admin.dbnote': 'Every account from every device lives in the database. Passwords are bcrypt-hashed inside it and cannot be read by anyone.',
      'admin.loaded': 'Loaded',
      'admin.lock': 'Lock',
      'admin.locked': 'This page is locked again',
      'admin.owner': 'Sign in as the owner',
      'admin.ownernote': 'Your owner account is verified inside the database — use your own username and password.',
      'admin.ownerhint': 'The account must be flagged is_admin in the database. See tools/supabase-accounts.sql.',
      'admin.ownerdenied': 'That account is not an owner account.',
      'admin.dblocked': 'Too many wrong owner passwords — wait 15 minutes, or clear the admin_denied rows in the SQL editor.',
      'admin.needcreds': 'Enter the owner username and password.',
      'admin.nodb': 'No database is connected — showing this browser\'s records only.',
      'admin.setup': 'Set an owner code first',
      'admin.setuptext': 'To protect this page, make up your own code and put only its PBKDF2 hash into the settings file.',
      'admin.setupwhy': 'That way the real code never appears in the published source.',
      'admin.hashnote': 'The owner code is checked against a hash. It is a convenience gate only, not real security — the data shown lives in this browser. Use the database for anything sensitive. User passwords are never readable.',
      'admin.localonly': 'The table below comes from THIS browser only. To collect sign-ups from every device (phones, other computers), connect a Google Sheet or Supabase — see tools/google-sheet-collector.gs and docs/data/config.js.',

      'common.page': 'Page',
      'common.close': 'Close',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.print': 'Print',
      'common.saved': 'Saved',
      'common.copy': 'Copy',
      'common.copied': 'Copied!',
      'common.loading': 'Loading…',
      'common.search': 'Search…',
      'common.all': 'All',
      'common.reset': 'Reset',
      'common.done': 'Done',
      'common.back': 'Back',
      'common.next': 'Next',
      'common.skip': 'Skip',
      'common.of': 'of',
      'common.yes': 'Yes',
      'common.no': 'No',
      'foot.rights': 'A study tool for learning only. All quoted text remains the property of its authors.',
      'foot.made': 'Made by',
      'foot.with': 'with AI',
      'a11y.skip': 'Skip to content',
      'err.msg': 'Something went wrong. Reload the page if it stops working.',
      'err.storage': 'Could not save — this browser’s storage is full or turned off.',
      'auth.err.user.chars': 'Username must be 3–20 characters, using only letters, numbers, dot and underscore.',
      'auth.forgot': 'Forgot your password?',
      'auth.forgot.t': 'Forgotten password',
      'auth.forgot.d': 'Accounts on this device cannot have their password changed for you, because the password itself is never stored. If you cannot sign in, create a new account — or clear this device’s data (all study progress will be deleted).',
      'auth.forgot.clear': 'Clear the accounts and history on this device',
      'auth.forgot.confirm': 'Delete every account and all study progress on this device?',
      'auth.forgot.done': 'This device’s data has been cleared.',
      'auth.engine.db': 'Accounts shared in the cloud',
      'auth.engine.sheet': 'Sign-ins are collected',
      'auth.engine.local': 'Stored on this device',
      'admin.testsent': 'Sent to the collector — the browser cannot confirm it; open the Google Sheet to check.',
      'cmd.hint': 'Type to search lessons, terms or pages',
      'cmd.none': 'Nothing found'
    }
  };

  function t(key, fallback) {
    const L = I18N[state.lang] || I18N.en;
    return (L[key] != null ? L[key] : (I18N.en[key] != null ? I18N.en[key] : (fallback != null ? fallback : key)));
  }

  /* single-language picker: {km,en} -> string in the active language */
  function pick(obj, lang) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    const L = lang || state.lang;
    return (obj[L] || obj.en || obj.km || '') + '';
  }
  /* html-escaped pick */
  function T(obj) { return esc(pick(obj)); }
  /* a {km,en} pair that has content in the other language too */
  function Tboth(obj) {
    if (!obj) return '';
    const other = state.lang === 'km' ? 'en' : 'km';
    return obj[other] ? esc(obj[other]) : '';
  }

  /* ------------------------------------------------------------ progress */
  const RANKS = [
    { xp: 0, km: 'អ្នកចាប់ផ្តើម', en: 'Beginner' },
    { xp: 120, km: 'សិស្សច្បាប់', en: 'Law Student' },
    { xp: 320, km: 'អ្នកសិក្សា', en: 'Scholar' },
    { xp: 640, km: 'អ្នកវិភាគ', en: 'Analyst' },
    { xp: 1100, km: 'អ្នកជំនាញ', en: 'Specialist' },
    { xp: 1800, km: 'គ្រូបង្រៀន', en: 'Mentor' }
  ];
  function blankProgress() {
    return { lessons: {}, quiz: {}, xp: 0, streak: 0, lastDay: null, notes: {} };
  }
  /* progress belongs to the account, not to the browser: two students on one
     device must never see each other's marks, notes or scores */
  function progressKey() {
    let u = 'guest';
    try {
      const s = window.IPLAuth && window.IPLAuth.session ? window.IPLAuth.session() : null;
      if (s && s.u) u = String(s.u).toLowerCase();
    } catch (e) {}
    return STORE.progress + '.' + u;
  }
  function getProgress() {
    const raw = sJSON(progressKey(), {});
    const p = Object.assign(blankProgress(), raw && typeof raw === 'object' ? raw : {});
    /* never trust the shape of long-lived storage: one bad value must not
       disable lessons, quizzes or notes for ever */
    if (!p.lessons || typeof p.lessons !== 'object') p.lessons = {};
    if (!p.quiz || typeof p.quiz !== 'object') p.quiz = {};
    if (!p.notes || typeof p.notes !== 'object') p.notes = {};
    p.xp = Number(p.xp) || 0;
    p.streak = Number(p.streak) || 0;
    return p;
  }
  function saveProgress(p) {
    /* a silent failure here would make "saved" a lie — say so instead */
    if (!sSet(progressKey(), JSON.stringify(p))) toast(t('err.storage'), 4000);
    document.dispatchEvent(new CustomEvent('progress:changed', { detail: p }));
    return p;
  }
  /* one-time: adopt the old single-slot progress for whoever is signed in */
  function migrateProgress() {
    const legacy = sGet(STORE.progress, null);
    if (!legacy) return;
    let signedIn = false;
    try { signedIn = !!(window.IPLAuth && window.IPLAuth.session && window.IPLAuth.session()); } catch (e) {}
    if (!signedIn) return;                     /* wait until we know where it belongs */
    if (sGet(progressKey(), null) == null) sSet(progressKey(), legacy);
    sDel(STORE.progress);
  }
  function addXP(n) {
    const p = getProgress();
    p.xp = (p.xp || 0) + n;
    const today = new Date().toISOString().slice(0, 10);
    if (p.lastDay !== today) {
      const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      p.streak = p.lastDay === yest ? (p.streak || 0) + 1 : 1;
      p.lastDay = today;
    }
    return saveProgress(p);
  }
  function rankFor(xp) {
    let r = RANKS[0];
    RANKS.forEach(function (x) { if (xp >= x.xp) r = x; });
    return r;
  }
  /* every write also goes to the database when the student is signed in to one;
     progress.js owns that, and a failure there never blocks the local save */
  function sync(kind, payload) {
    try { if (window.IPLProgress) window.IPLProgress.push(kind, payload); } catch (e) {}
  }
  function markStudied(id) {
    const p = getProgress();
    if (!p.lessons[id]) { p.lessons[id] = { ts: Date.now() }; p.xp = (p.xp || 0) + 10; saveProgress(p); }
    sync('studied', { lesson: id });
    return p;
  }
  /* XP is earned by improving, not by grinding the same quiz again */
  function saveQuizResult(id, best, total, wrong) {
    const p = getProgress();
    const prev = p.quiz[id];
    const better = !prev || best > prev.best;
    p.quiz[id] = { best: Math.max(best, prev ? prev.best : 0), total: total, ts: Date.now(), wrong: wrong || [] };
    let gained = 0;
    if (better) gained = Math.round((best / Math.max(1, total)) * 20);
    p.xp = (p.xp || 0) + gained;
    saveProgress(p);
    sync('quiz', { lesson: id, best: p.quiz[id].best, total: total });
    return { gained: gained, better: better };
  }
  function getNotes(id) { return (getProgress().notes || {})[id] || ''; }
  function setNotes(id, text) {
    const p = getProgress();
    p.notes = p.notes || {};
    if (text) p.notes[id] = text; else delete p.notes[id];
    saveProgress(p);
    sync('notes', { lesson: id, body: text || '' });
  }

  /* ------------------------------------------------------------ utils */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  /* RFC-4180 cell: quote when needed and neutralise spreadsheet formulas, so an
     exported CSV cannot execute anything when it is opened in Excel/Sheets */
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    const c0 = s.charCodeAt(0);
    // spreadsheet-formula guard: = + - @ TAB
    if (c0 === 61 || c0 === 43 || c0 === 45 || c0 === 64 || c0 === 9) s = "'" + s;
    // RFC-4180: quote when the cell contains a quote, comma or line break
    let needsQuote = false;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 34 || c === 44 || c === 10 || c === 13) { needsQuote = true; break; }
    }
    if (needsQuote) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function csvRow(cells) { return cells.map(csvCell).join(','); }
  function toast(msg, ms) {
    let node = qs('.toast');
    if (!node) {
      node = el('div', { class: 'toast' });
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.textContent = msg;
    node.classList.add('show');
    clearTimeout(node._t);
    node._t = setTimeout(function () { node.classList.remove('show'); }, ms || 2200);
  }
  function copyText(text) {
    const done = function () { toast(t('common.copied')); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = el('textarea'); ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    ta.remove();
  }
  function download(name, text, mime) {
    const type = mime || 'text/plain;charset=utf-8';
    /* Excel reads a BOM-less CSV as ANSI, which turns Khmer text into mojibake */
    const body = /csv/.test(type) ? '\uFEFF' + text : text;
    const blob = new Blob([body], { type: type });
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString(state.lang === 'km' ? 'km-KH' : 'en-GB', opts);
  }

  /* ------------------------------------------------------------ motion helpers */
  function reveal() {
    const nodes = qsa('.reveal');
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('shown'); }); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    nodes.forEach(function (n) { io.observe(n); });
  }
  function countUp(node) {
    const target = parseFloat(node.dataset.count || '0');
    if (!target) { node.textContent = '0'; return; }
    const dur = 820, t0 = performance.now();
    const step = function (now) {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      node.textContent = Math.round(target * eased).toLocaleString(state.lang === 'km' ? 'km-KH' : 'en-GB');
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function counters() {
    const nodes = qsa('[data-count]');
    if (!nodes.length) return;
    const fill = function (n) { n.textContent = (+n.dataset.count).toLocaleString(state.lang === 'km' ? 'km-KH' : 'en-GB'); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { nodes.forEach(fill); return; }
    if (!('IntersectionObserver' in window)) { nodes.forEach(countUp); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); } });
    }, { threshold: .4 });
    nodes.forEach(function (n) { io.observe(n); });
    /* never leave a tile stuck at 0 if the observer never fires */
    setTimeout(function () { nodes.forEach(function (n) { if (n.textContent === '0') fill(n); }); }, 2600);
  }
  function stagger(container) {
    qsa(':scope > *', container).forEach(function (n, i) { n.style.setProperty('--i', i); });
    container.classList.add('stagger');
  }
  function splashOff() {
    const s = qs('#splash');
    if (!s) return;
    s.classList.add('hide');
    setTimeout(function () { s.remove(); }, 320);
  }

  /* ------------------------------------------------------------ modal */
  let modalReturnFocus = null;
  function modalFocusables(wrap) {
    return qsa('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', wrap)
      .filter(function (n) { return n.getClientRects().length > 0; });
  }
  function modal(title, bodyHtml, footHtml) {
    let wrap = qs('#modal-backdrop');
    if (!wrap) {
      wrap = el('div', { class: 'modal-backdrop', id: 'modal-backdrop' });
      wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<header><h3 id="modal-title"></h3><span class="spacer"></span>' +
        '<button class="icon-btn" data-close></button></header><div class="body"></div><div class="foot" hidden></div></div>';
      document.body.appendChild(wrap);
      qs('[data-close]', wrap).setAttribute('aria-label', t('common.close'));
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap || e.target.closest('[data-close]')) closeModal();
      });
      document.addEventListener('keydown', function (e) {
        if (!wrap.classList.contains('open')) return;
        if (e.key === 'Escape') { closeModal(); return; }
        if (e.key !== 'Tab') return;
        /* keep the keyboard inside the dialog while it is open */
        const f = modalFocusables(wrap);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }
    qs('header h3', wrap).textContent = title;
    qs('.body', wrap).innerHTML = bodyHtml;
    const foot = qs('.foot', wrap);
    if (footHtml) { foot.innerHTML = footHtml; foot.hidden = false; } else { foot.innerHTML = ''; foot.hidden = true; }
    if (!wrap.classList.contains('open')) modalReturnFocus = document.activeElement;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
    /* move focus into the dialog so keyboard/SR users land in the right place */
    setTimeout(function () {
      const f = modalFocusables(wrap);
      const target = f.filter(function (n) { return !n.hasAttribute('data-close'); })[0] || f[0];
      if (target) target.focus();
    }, 30);
    return wrap;
  }
  function closeModal() {
    const w = qs('#modal-backdrop');
    if (!w) return;
    w.classList.remove('open');
    document.body.style.overflow = '';
    if (modalReturnFocus && modalReturnFocus.focus) { try { modalReturnFocus.focus(); } catch (e) {} }
    modalReturnFocus = null;
  }

  /* ------------------------------------------------------------ shell */
  const NAV = [
    ['dashboard.html', 'nav.dashboard', '🏠'],
    ['learn.html', 'nav.learn', '📘'],
    ['quiz.html', 'nav.quiz', '🎯'],
    ['teacher.html', 'nav.teacher', '🤖'],
    ['library.html', 'nav.library', '📚'],
    ['glossary.html', 'nav.glossary', '🔖']
  ];

  function setLang(L) {
    if (L !== 'km' && L !== 'en') return;
    if (L === state.lang) return;
    sSet(STORE.lang, L);
    state.lang = L;
    const url = new URL(location.href);
    url.searchParams.set('_l', L);
    location.replace(url.toString());
  }

  function renderChrome(active) {
    document.body.dataset.lang = state.lang;
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.lang = state.lang === 'km' ? 'km' : 'en';
    applyI18n();
    const auth = window.IPLAuth;
    const sess = auth && auth.session ? auth.session() : null;

    const top = qs('#topbar');
    if (top) {
      const navHtml = NAV.map(function (x) {
        return '<a href="' + x[0] + '"' + (active === x[0] ? ' class="active"' : '') + '>' + esc(t(x[1])) + '</a>';
      }).join('');
      top.innerHTML =
        '<button class="icon-btn" id="nav-burger" aria-label="menu">☰</button>' +
        '<a class="brand" href="' + (sess ? 'dashboard.html' : 'index.html') + '">' +
        '<img src="assets/img/logo.png?v=20260912b" alt="RoboCL"><span class="txt"><b>' + esc(t('app.name')) + '</b><small>' + esc(t('app.sub')) + '</small></span></a>' +
        '<span class="spacer"></span>' +
        '<nav class="topnav">' + navHtml + '</nav>' +
        '<div class="lang-toggle" role="group" aria-label="' + esc(t('lang.label')) + '">' +
        ['km', 'en'].map(function (L) {
          return '<button data-lang="' + L + '" aria-pressed="' + (state.lang === L) + '">' + esc(t('lang.' + L)) + '</button>';
        }).join('') + '</div>' +
        '<button class="icon-btn" id="theme-btn" title="' + esc(t('theme.toggle')) + '" aria-label="' + esc(t('theme.toggle')) + '">' +
        (state.theme === 'dark' ? '☀' : '☾') + '</button>' +
        '<div class="acct">' +
        '<button class="acct-btn" id="acct-btn" aria-haspopup="true">' +
        (sess ? '<span class="av">' + esc((sess.u || '?').slice(0, 1).toUpperCase()) + '</span><span class="nm">' + esc(sess.u) + '</span>'
              : '<span class="av">?</span><span class="nm">' + esc(t('menu.signin')) + '</span>') +
        '</button>' +
        '<div class="menu" id="acct-menu">' +
        (sess
          ? '<a href="dashboard.html">🏠 ' + esc(t('nav.dashboard')) + '</a>' +
            '<a href="about.html">ℹ️ ' + esc(t('nav.about')) + '</a>' +
            '<hr><button data-act="signout">⏏ ' + esc(t('menu.signout')) + '</button>'
          : '<a href="signin.html">🔑 ' + esc(t('auth.signin')) + '</a>' +
            '<a href="signin.html#signup">✨ ' + esc(t('auth.signup')) + '</a>') +
        '</div></div>';
    }

    /* drawer for small screens */
    if (top && !qs('#drawer')) {
      const back = el('div', { class: 'drawer-backdrop', id: 'drawer-backdrop' });
      const dr = el('div', { class: 'drawer', id: 'drawer' });
      dr.innerHTML = '<div class="row" style="margin-bottom:14px"><img src="assets/img/logo.png?v=20260912b" alt="" style="width:38px;border-radius:50%">' +
        '<div><b>' + esc(t('app.name')) + '</b><div class="small faint">' + esc(t('app.sub')) + '</div></div></div>' +
        NAV.map(function (x) {
          return '<a href="' + x[0] + '"' + (active === x[0] ? ' class="active"' : '') + '>' + x[2] + ' ' + esc(t(x[1])) + '</a>';
        }).join('') +
        '<hr><a href="index.html">🌐 ' + esc(t('nav.home')) + '</a>' +
        '<a href="about.html">ℹ️ ' + esc(t('nav.about')) + '</a>' +
        (sess ? '<a href="admin.html">📊 ' + esc(t('nav.admin')) + '</a><button class="btn ghost block" data-act="signout">⏏ ' + esc(t('menu.signout')) + '</button>'
              : '<a href="signin.html">🔑 ' + esc(t('auth.signin')) + '</a>');
      document.body.appendChild(back);
      document.body.appendChild(dr);
      const open = function (v) { dr.classList.toggle('open', v); back.classList.toggle('open', v); };
      back.addEventListener('click', function () { open(false); });
      qsa('a', dr).forEach(function (a) { a.addEventListener('click', function () { open(false); }); });
      window.__drawer = open;
    }

    /* footer */
    const foot = qs('#footer');
    if (foot) {
      foot.innerHTML = '<div class="wrap">' +
        '<div class="footbrand"><img src="assets/img/logo.png?v=20260912b" alt=""><div><b>' + esc(t('app.name')) + '</b>' +
        '<div class="small">© ' + new Date().getFullYear() + ' · ' + esc(t('app.sub')) + '</div></div></div>' +
        '<span class="spacer"></span>' +
        '<span class="made-by">' + esc(t('foot.made')) + ' <b>Sok Panha</b> <span class="spark">✦</span> ' + esc(t('foot.with')) + '</span>' +
        '<div class="small" style="flex-basis:100%">' + esc(t('foot.rights')) + ' · <a href="about.html">' + esc(t('nav.about')) + '</a></div>' +
        '</div>';
    }

    /* wire shell interactions */
    qsa('.lang-toggle button', top || document).forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.dataset.lang); });
    });
    const tb = qs('#theme-btn');
    if (tb) tb.addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      sSet(STORE.theme, state.theme);
      document.documentElement.dataset.theme = state.theme;
      tb.textContent = state.theme === 'dark' ? '☀' : '☾';
    });
    const ab = qs('#acct-btn'), menu = qs('#acct-menu');
    if (ab && menu) {
      ab.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('open'); });
      document.addEventListener('click', function () { menu.classList.remove('open'); });
    }
    const burger = qs('#nav-burger');
    if (burger) burger.addEventListener('click', function () { if (window.__drawer) window.__drawer(true); });
    document.addEventListener('click', function (e) {
      const b = e.target.closest('[data-act="signout"]');
      if (!b) return;
      if (window.IPLAuth) window.IPLAuth.signout();
    });
  }

  /* bind static markup to the dictionary: [data-t], [data-t-ph], [data-t-title] */
  function applyI18n(root) {
    const scope = root || document;
    qsa('[data-t]', scope).forEach(function (n) { n.textContent = t(n.dataset.t); });
    qsa('[data-t-ph]', scope).forEach(function (n) { n.setAttribute('placeholder', t(n.dataset.tPh)); });
    qsa('[data-t-title]', scope).forEach(function (n) { n.setAttribute('title', t(n.dataset.tTitle)); });
  }

  /* pages that need an account: call IPL.guard() at the top of the page script */
  function guard() {
    const auth = window.IPLAuth;
    /* fail closed: without the auth module we cannot know who this is, so send
       them to the sign-in page instead of rendering an unprotected shell */
    if (!auth) { location.replace('signin.html'); return false; }
    if (auth.session()) return true;
    const next = location.pathname.split('/').pop() + location.search + location.hash;
    location.replace('signin.html?next=' + encodeURIComponent(next));
    return false;
  }

  /* ------------------------------------------------------------ command palette */
  let cmdProvider = null;
  /* the shell ships a provider of its own so Ctrl+K works on EVERY page, not
     just the three that used to register one */
  function defaultCmdItems() {
    const D = window.IPL_DATA || {};
    const items = [];
    (D.lessons || []).forEach(function (l) {
      items.push({ kind: t('quiz.lesson'), text: pick(l.title), href: 'learn.html#' + l.id });
    });
    (D.glossary || []).forEach(function (g) {
      items.push({ kind: t('nav.glossary'), text: (g.km || '') + ' — ' + (g.en || ''), href: 'glossary.html#t=' + encodeURIComponent(g.km || '') });
    });
    (D.chapters || []).forEach(function (c) {
      items.push({ kind: t('nav.quiz'), text: pick(c.title), href: 'quiz.html#chapter=' + c.id });
    });
    NAV.forEach(function (n) { items.push({ kind: t('common.all'), text: t(n[1]), href: n[0] }); });
    return items;
  }
  function commandPalette(getItems) {
    if (typeof getItems === 'function') cmdProvider = getItems;
    if (!cmdProvider) cmdProvider = defaultCmdItems;
    let host = qs('#cmd-palette');
    if (!host) {
      host = el('div', { class: 'modal-backdrop', id: 'cmd-palette' });
      host.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cmd-title" style="max-width:640px">' +
        '<header><h3 id="cmd-title">' + esc(t('common.search')) +
        '</h3><span class="spacer"></span><button class="icon-btn" data-close></button></header>' +
        '<div class="body"><input class="input" id="cmd-input" aria-label="' + esc(t('common.search')) +
        '" placeholder="' + esc(t('cmd.hint')) + '" autocomplete="off">' +
        '<div class="cmd-results" id="cmd-results" role="list"></div></div></div>';
      document.body.appendChild(host);
      qs('[data-close]', host).setAttribute('aria-label', t('common.close'));
      host.addEventListener('click', function (e) {
        if (e.target === host || e.target.closest('[data-close]')) host.classList.remove('open');
      });
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          host.classList.toggle('open');
          const inp = qs('#cmd-input', host);
          if (host.classList.contains('open')) {
            /* start from a clean query: the results must always match what is shown */
            inp.value = '';
            render('');
            setTimeout(function () { inp.focus(); }, 30);
          }
        }
        if (e.key === 'Escape') host.classList.remove('open');
      });
    }
    const input = qs('#cmd-input', host), results = qs('#cmd-results', host);
    function render(q) {
      const items = (cmdProvider() || []);
      const needle = (q || '').toLowerCase();
      const list = items.filter(function (it) {
        if (!needle) return true;
        return (it.text || '').toLowerCase().indexOf(needle) >= 0;
      }).slice(0, 30);
      results.innerHTML = list.map(function (it) {
        return '<a href="' + esc(it.href) + '" role="listitem"><span class="pill">' + esc(it.kind) + '</span><span>' + esc(it.text) + '</span></a>';
      }).join('') || '<div class="muted small" style="padding:10px">' + esc(t('cmd.none')) + '</div>';
    }
    commandPalette.render = render;
    if (!input._wired) {
      input.addEventListener('input', function () { render(input.value.trim()); });
      input._wired = true;
    }
    render(input.value.trim());
  }

  /* ------------------------------------------------------------ global error bar */
  window.addEventListener('error', function (e) {
    try {
      /* genuine uncaught script errors only — a missing image or font must not
         tell the visitor the page is broken */
      const src = e.filename || (e.target && e.target.tagName === 'SCRIPT' ? (e.target.src || '') : '');
      const msg = e.message || (e.error && e.error.message);
      if (!src || !msg) return;
      let bar = document.getElementById('err-bar');
      if (!bar) {
        bar = el('div', { id: 'err-bar' });
        bar.setAttribute('role', 'alert');
        document.body.appendChild(bar);
      }
      bar.textContent = t('err.msg');
      bar.setAttribute('title', String(msg));
    } catch (x) {}
  });

  /* keyboard users should be able to skip the navigation on every page */
  function skipLink() {
    const main = qs('main');
    if (!main || qs('#skip-link')) return;
    if (!main.id) main.id = 'main';
    const a = el('a', { class: 'sr-only skip-link', href: '#main', id: 'skip-link', text: t('a11y.skip') });
    document.body.insertBefore(a, document.body.firstChild);
  }

  /* hide the splash as soon as the page is usable — no artificial delay */
  document.addEventListener('DOMContentLoaded', function () {
    splashOff();
    skipLink();
    migrateProgress();
    /* Ctrl+K on every page: the shell supplies a default item list, and a page
       can upgrade it by calling commandPalette() with its own */
    commandPalette();
    /* signed in to a database account? bring this device's progress together with
       the database's copy, then tell the page so it can re-read if it shows stats */
    if (window.IPLProgress) {
      window.IPLProgress.pull().then(function (synced) {
        if (!synced) return;
        try { document.dispatchEvent(new CustomEvent('robo:progress')); } catch (e) {}
      });
    }
  });
  window.addEventListener('load', splashOff);
  setTimeout(splashOff, 900);

  window.IPL = {
    state: state, t: t, pick: pick, T: T, Tboth: Tboth, I18N: I18N, STORE: STORE, NAV: NAV,
    esc: esc, qs: qs, qsa: qsa, el: el, toast: toast, copyText: copyText, download: download,
    truncate: truncate, fmtDate: fmtDate, modal: modal, closeModal: closeModal,
    csvCell: csvCell, csvRow: csvRow,
    sGet: sGet, sSet: sSet, sDel: sDel,
    getProgress: getProgress, saveProgress: saveProgress, addXP: addXP, rankFor: rankFor, RANKS: RANKS,
    markStudied: markStudied, saveQuizResult: saveQuizResult, getNotes: getNotes, setNotes: setNotes,
    reveal: reveal, counters: counters, stagger: stagger, splashOff: splashOff,
    renderChrome: renderChrome, applyI18n: applyI18n, setLang: setLang, guard: guard, commandPalette: commandPalette
  };
})();
