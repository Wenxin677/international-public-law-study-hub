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

  /* language set once on load; two options only */
  const state = {
    lang: localStorage.getItem(STORE.lang) === 'en' ? 'en' : 'km',
    theme: localStorage.getItem(STORE.theme) || 'dark'
  };

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
      'auth.password.ph': 'យ៉ាងតិច ៦ តួអក្សរ',
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
      'auth.err.short.pass': 'លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។',
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
      'learn.objectives': 'គោលបំណងសិក្សា',
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
      'quiz.ask': 'សួរគ្រូ AI ពីសំណួរនេះ',
      'quiz.best': 'ល្អបំផុត',
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
      'lib.note': 'ឯកសារនេះជាកម្មសិទ្ធិរបស់អ្នកនិពន្ធ — ប្រើសម្រាប់ការសិក្សា។',
      'lib.textonly': 'សៀវភៅដើមមិនអាចដាក់ជា PDF បានទេ (រក្សាសិទ្ធិ) ដូច្នេះយើងអានជាអក្សរដែលសង្គ្រោះចេញពីសៀវភៅ។',

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
      'admin.users': 'គណនី',
      'admin.events': 'កំណត់ត្រាការចូលប្រើ',
      'admin.export': 'ទាញយក CSV',
      'admin.copy': 'ចម្លងទិន្នន័យ',
      'admin.none': 'មិនទាន់មានគណនីទេ។',
      'admin.cloud': 'ការភ្ជាប់ពពក',
      'admin.localonly': 'ទិន្នន័យនេះមកពីកម្មវិធីរុករកនេះតែប៉ុណ្ណោះ។ ដើម្បីប្រមូលពីគ្រប់ឧបករណ៍ ត្រូវភ្ជាប់ Supabase (មើល tools/supabase.sql)។',

      'common.page': 'ទំព័រ',
      'common.close': 'បិទ',
      'common.cancel': 'បោះបង់',
      'common.save': 'រក្សាទុក',
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
      'auth.password.ph': 'at least 6 characters',
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
      'auth.err.short.pass': 'Password must be at least 6 characters.',
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
      'learn.objectives': 'Learning objectives',
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
      'quiz.ask': 'Ask the AI teacher about this',
      'quiz.best': 'Best',
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
      'lib.note': 'The documents belong to their authors — used here for study.',
      'lib.textonly': 'The textbook PDF is not published (copyright), so it is read as the text recovered from it.',

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
      'admin.users': 'Accounts',
      'admin.events': 'Sign-in records',
      'admin.export': 'Download CSV',
      'admin.copy': 'Copy data',
      'admin.none': 'No accounts yet.',
      'admin.cloud': 'Cloud sync',
      'admin.localonly': 'This data comes from this browser only. To collect from every device, connect Supabase (see tools/supabase.sql).',

      'common.page': 'Page',
      'common.close': 'Close',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
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
  function getProgress() {
    try { return Object.assign(blankProgress(), JSON.parse(localStorage.getItem(STORE.progress) || '{}')); }
    catch (e) { return blankProgress(); }
  }
  function saveProgress(p) {
    localStorage.setItem(STORE.progress, JSON.stringify(p));
    document.dispatchEvent(new CustomEvent('progress:changed', { detail: p }));
    return p;
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
  function markStudied(id) {
    const p = getProgress();
    if (!p.lessons[id]) { p.lessons[id] = { ts: Date.now() }; p.xp = (p.xp || 0) + 10; saveProgress(p); }
    return p;
  }
  function saveQuizResult(id, best, total, wrong) {
    const p = getProgress();
    const prev = p.quiz[id];
    p.quiz[id] = { best: Math.max(best, prev ? prev.best : 0), total: total, ts: Date.now(), wrong: wrong || [] };
    const gained = Math.round((best / Math.max(1, total)) * 20);
    p.xp = (p.xp || 0) + gained;
    saveProgress(p);
    return { gained: gained, better: !prev || best > prev.best };
  }
  function getNotes(id) { return (getProgress().notes || {})[id] || ''; }
  function setNotes(id, text) {
    const p = getProgress();
    p.notes = p.notes || {};
    if (text) p.notes[id] = text; else delete p.notes[id];
    saveProgress(p);
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
  function toast(msg, ms) {
    let node = qs('.toast');
    if (!node) { node = el('div', { class: 'toast' }); document.body.appendChild(node); }
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
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
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
  function modal(title, bodyHtml, footHtml) {
    let wrap = qs('#modal-backdrop');
    if (!wrap) {
      wrap = el('div', { class: 'modal-backdrop', id: 'modal-backdrop' });
      wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><header><h3></h3><span class="spacer"></span>' +
        '<button class="icon-btn" data-close aria-label="close">✕</button></header><div class="body"></div><div class="foot" hidden></div></div>';
      document.body.appendChild(wrap);
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap || e.target.closest('[data-close]')) close();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }
    function close() { wrap.classList.remove('open'); document.body.style.overflow = ''; }
    qs('header h3', wrap).textContent = title;
    qs('.body', wrap).innerHTML = bodyHtml;
    const foot = qs('.foot', wrap);
    if (footHtml) { foot.innerHTML = footHtml; foot.hidden = false; } else { foot.innerHTML = ''; foot.hidden = true; }
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
    return wrap;
  }
  function closeModal() {
    const w = qs('#modal-backdrop');
    if (w) { w.classList.remove('open'); document.body.style.overflow = ''; }
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
    localStorage.setItem(STORE.lang, L);
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
        '<img src="assets/img/logo.png" alt="RoboCL"><span class="txt"><b>' + esc(t('app.name')) + '</b><small>' + esc(t('app.sub')) + '</small></span></a>' +
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
      dr.innerHTML = '<div class="row" style="margin-bottom:14px"><img src="assets/img/logo.png" alt="" style="width:38px;border-radius:50%">' +
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
        '<div class="footbrand"><img src="assets/img/logo.png" alt=""><div><b>' + esc(t('app.name')) + '</b>' +
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
      localStorage.setItem(STORE.theme, state.theme);
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
    if (!auth) return true;
    if (auth.session()) return true;
    const next = location.pathname.split('/').pop() + location.search + location.hash;
    location.replace('signin.html?next=' + encodeURIComponent(next));
    return false;
  }

  /* ------------------------------------------------------------ command palette */
  function commandPalette(getItems) {
    let host = qs('#cmd-palette');
    if (!host) {
      host = el('div', { class: 'modal-backdrop', id: 'cmd-palette' });
      host.innerHTML = '<div class="modal" style="max-width:640px"><header><h3>' + esc(t('common.search')) +
        '</h3><span class="spacer"></span><button class="icon-btn" data-close>✕</button></header>' +
        '<div class="body"><input class="input" id="cmd-input" placeholder="' + esc(t('cmd.hint')) + '" autocomplete="off">' +
        '<div class="cmd-results" id="cmd-results"></div></div></div>';
      document.body.appendChild(host);
      host.addEventListener('click', function (e) {
        if (e.target === host || e.target.closest('[data-close]')) host.classList.remove('open');
      });
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          host.classList.toggle('open');
          const inp = qs('#cmd-input', host);
          if (host.classList.contains('open')) { render(''); setTimeout(function () { inp.focus(); }, 30); }
        }
        if (e.key === 'Escape') host.classList.remove('open');
      });
    }
    const input = qs('#cmd-input', host), results = qs('#cmd-results', host);
    function render(q) {
      const items = (getItems() || []);
      const list = items.filter(function (it) {
        if (!q) return true;
        return (it.text || '').toLowerCase().indexOf(q.toLowerCase()) >= 0;
      }).slice(0, 30);
      results.innerHTML = list.map(function (it) {
        return '<a href="' + it.href + '"><span class="pill">' + esc(it.kind) + '</span><span>' + esc(it.text) + '</span></a>';
      }).join('') || '<div class="muted small" style="padding:10px">' + esc(t('cmd.none')) + '</div>';
    }
    input.addEventListener('input', function () { render(input.value.trim()); });
    render('');
  }

  /* ------------------------------------------------------------ global error bar */
  window.addEventListener('error', function (e) {
    try {
      let bar = document.getElementById('err-bar');
      if (!bar) { bar = el('div', { id: 'err-bar' }); document.body.appendChild(bar); }
      bar.textContent = 'Script error: ' + (e.message || e.error) + ' — reload if the page misbehaves.';
    } catch (x) {}
  });

  /* hide the splash as soon as the page is usable — no artificial delay */
  document.addEventListener('DOMContentLoaded', function () { splashOff(); });
  window.addEventListener('load', splashOff);
  setTimeout(splashOff, 900);

  window.IPL = {
    state: state, t: t, pick: pick, T: T, Tboth: Tboth, I18N: I18N, STORE: STORE, NAV: NAV,
    esc: esc, qs: qs, qsa: qsa, el: el, toast: toast, copyText: copyText, download: download,
    truncate: truncate, fmtDate: fmtDate, modal: modal, closeModal: closeModal,
    getProgress: getProgress, saveProgress: saveProgress, addXP: addXP, rankFor: rankFor, RANKS: RANKS,
    markStudied: markStudied, saveQuizResult: saveQuizResult, getNotes: getNotes, setNotes: setNotes,
    reveal: reveal, counters: counters, stagger: stagger, splashOff: splashOff,
    renderChrome: renderChrome, applyI18n: applyI18n, setLang: setLang, guard: guard, commandPalette: commandPalette
  };
})();
