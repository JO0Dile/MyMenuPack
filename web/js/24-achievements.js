// ==========================
// ACHIEVEMENTS (purely cosmetic — never affects progress, credits, or GPA)
// ==========================
(function(){
  var CATS = ['core','math','dept','eng','uni','free','skills'];

  function yearOf(el){
    var row = el.closest('.year-row');
    var span = row && row.querySelector('.year-badge .num span');
    return span ? span.textContent.trim() : null;
  }
  function categoryOf(el){
    for(var i = 0; i < CATS.length; i++){ if(el.classList.contains(CATS[i])) return CATS[i]; }
    return null;
  }

  function allYearCompleted(prefix, yearNum){
    var page = document.getElementById('page-' + prefix);
    if(!page) return false;
    var progress = window.__getProgress();
    var yearCourses = Array.prototype.slice.call(page.querySelectorAll('.course[id]:not(.course-removed)'))
      .filter(function(el){ return yearOf(el) === String(yearNum); });
    if(yearCourses.length === 0) return false;
    return yearCourses.every(function(el){ return !!progress[el.id]; });
  }

  function allCategoryCompleted(prefix, cat){
    var page = document.getElementById('page-' + prefix);
    if(!page) return false;
    var progress = window.__getProgress();
    var els = Array.prototype.slice.call(page.querySelectorAll('.course.' + cat + '[id]'));
    if(els.length === 0) return false;
    return els.every(function(el){ return !!progress[el.id]; });
  }

  // Different plans name their intro programming sequence differently (see
  // cs's progfund1/progfund2/data-structures vs the others' intro-cs/
  // progfund/dsa) — try each known sequence and use whichever this plan
  // actually has, rather than assuming one naming convention everywhere.
  var PROG_SEQUENCES = [['intro-cs', 'progfund', 'dsa'], ['progfund1', 'progfund2', 'data-structures']];
  function findProgSequence(prefix){
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    for(var i = 0; i < PROG_SEQUENCES.length; i++){
      if(PROG_SEQUENCES[i].every(function(s){ return !!info[s]; })){ return PROG_SEQUENCES[i]; }
    }
    return null;
  }
  function progPathApplies(prefix){ return !!findProgSequence(prefix); }
  function progPathDone(prefix){
    var seq = findProgSequence(prefix);
    if(!seq) return false;
    var progress = window.__getProgress();
    return seq.every(function(s){ return !!progress[prefix + '-c-' + s]; });
  }

  // "C++ Hoster" is specific to the plan that actually has a numbered,
  // C++-flagged Programming Fundamentals I/II pair (currently only cs) —
  // shown as "not applicable" elsewhere rather than faked onto a
  // lecture+lab pair that isn't really the same thing.
  function cppHosterApplies(prefix){
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    return !!info['progfund1'] && !!info['progfund2'];
  }
  function cppHosterDone(prefix){
    var progress = window.__getProgress();
    return !!progress[prefix + '-c-progfund1'] && !!progress[prefix + '-c-progfund2'];
  }

  function highSkilledDone(prefix){
    var progress = window.__getProgress();
    return !!progress[prefix + '-c-computer-skills'] && !!progress[prefix + '-c-research-methods'];
  }

  function mathholicDone(prefix){
    if(!allCategoryCompleted(prefix, 'math')) return false;
    var g = window.AAUP_GPA.gpaFor(prefix, function(el){ return el.classList.contains('math'); });
    return g.gpa !== null && g.gpa > 3.5;
  }

  function tenNoFails(prefix){
    var page = document.getElementById('page-' + prefix);
    if(!page) return false;
    var progress = window.__getProgress();
    var grades = window.AAUP_GPA.loadGrades();
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var seenNum = {}, doneCount = 0, hasFail = false;
    page.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
      var parts = window.__splitCourseId(el.id);
      if(!parts) return;
      var meta = info[parts.slug];
      var dedupeKey = (meta && meta.num && meta.num !== '-') ? meta.num : parts.slug;
      if(seenNum[dedupeKey]) return;
      seenNum[dedupeKey] = true;
      if(!progress[el.id]) return;
      doneCount++;
      var pid = window.AAUP_GPA.primaryId(prefix, parts.slug);
      if(window.AAUP_GPA.isFailGrade(grades[pid])) hasFail = true;
    });
    return doneCount >= 10 && !hasFail;
  }

  // Tracked globally (not per-plan) since it's about language use, not a
  // specific major. A plain 5-second poll while any visible page is in
  // Arabic mode — good enough for a cosmetic achievement, no need for
  // anything fancier.
  var ARABIC_TARGET_MS = 5 * 60 * 1000;
  function getArabicMs(){
    try{ return parseInt(localStorage.getItem('aaup_arabicTimeMs') || '0', 10) || 0; }catch(e){ return 0; }
  }
  function arabicLegendDone(){ return getArabicMs() >= ARABIC_TARGET_MS; }
  setInterval(function(){
    var anyArabic = window.__anyVisiblePageIsRtl && window.__anyVisiblePageIsRtl();
    if(!anyArabic) return;
    try{ localStorage.setItem('aaup_arabicTimeMs', String(getArabicMs() + 5000)); }catch(e){}
  }, 5000);

  function studentGender(){
    var info = window.AAUP_STUDENT ? window.AAUP_STUDENT.get() : null;
    return info && info.gender;
  }

  // ---------- progress helpers (for the "N more to go" hint under locked
  // achievements) — each returns { done, total } counted the same way its
  // check() decides done-ness, or null when a numeric hint doesn't apply. ----------
  function countYearCourses(prefix, yearNum){
    var page = document.getElementById('page-' + prefix);
    if(!page) return null;
    var progress = window.__getProgress();
    var els = Array.prototype.slice.call(page.querySelectorAll('.course[id]:not(.course-removed)'))
      .filter(function(el){ return yearOf(el) === String(yearNum); });
    if(!els.length) return null;
    var done = els.filter(function(el){ return !!progress[el.id]; }).length;
    return { done: done, total: els.length };
  }
  function countCategory(prefix, cat){
    var page = document.getElementById('page-' + prefix);
    if(!page) return null;
    var progress = window.__getProgress();
    var els = Array.prototype.slice.call(page.querySelectorAll('.course.' + cat + '[id]'));
    if(!els.length) return null;
    var done = els.filter(function(el){ return !!progress[el.id]; }).length;
    return { done: done, total: els.length };
  }
  function countSlugs(prefix, slugs){
    var progress = window.__getProgress();
    var done = 0;
    slugs.forEach(function(s){ if(progress[prefix + '-c-' + s]) done++; });
    return { done: done, total: slugs.length };
  }
  function creditProgressToward(prefix, targetPct){
    var s = window.__computeStats(prefix);
    if(!s || !s.totalCredits) return null;
    var target = Math.round(s.totalCredits * (targetPct / 100));
    return { done: Math.min(s.doneCredits, target), total: target, unit: 'credit hours' };
  }

  var ACHIEVEMENTS = [
    {
      id: 'year1', icon: '🍄',
      title: { en: 'No Longer a Smurf', ar: 'لم أعد سنفورًا' },
      desc: { en: 'Finish every Year 1 course — welcome to university!', ar: 'أكمل جميع مساقات السنة الأولى — أهلاً بك في الجامعة!' },
      check: function(prefix){ return allYearCompleted(prefix, 1); },
      prog: function(prefix){ return countYearCourses(prefix, 1); }
    },
    {
      id: 'year2', icon: '🥈',
      appliesTo: function(prefix){ return countYearCourses(prefix, 2) !== null; },
      title: { en: 'Sophomore Survivor', ar: 'ناجٍ من السنة الثانية' },
      desc: { en: 'Complete every course in Year 2.', ar: 'أكمل جميع مساقات السنة الثانية.' },
      check: function(prefix){ return allYearCompleted(prefix, 2); },
      prog: function(prefix){ return countYearCourses(prefix, 2); }
    },
    {
      id: 'year3', icon: '🥉',
      appliesTo: function(prefix){ return countYearCourses(prefix, 3) !== null; },
      title: { en: 'Junior Legend', ar: 'أسطورة السنة الثالثة' },
      desc: { en: 'Complete every course in Year 3.', ar: 'أكمل جميع مساقات السنة الثالثة.' },
      check: function(prefix){ return allYearCompleted(prefix, 3); },
      prog: function(prefix){ return countYearCourses(prefix, 3); }
    },
    {
      id: 'year4', icon: '🎓',
      appliesTo: function(prefix){ return countYearCourses(prefix, 4) !== null; },
      title: { en: 'Senior at Last', ar: 'أوشكت على التخرّج' },
      desc: { en: 'Complete every course in Year 4.', ar: 'أكمل جميع مساقات السنة الرابعة.' },
      check: function(prefix){ return allYearCompleted(prefix, 4); },
      prog: function(prefix){ return countYearCourses(prefix, 4); }
    },
    {
      id: 'year5', icon: '🧓',
      appliesTo: function(prefix){ return countYearCourses(prefix, 5) !== null; },
      title: function(gender){
        if(gender === 'Female') return { en: 'Hello Granny', ar: 'أهلاً تيتا' };
        return { en: 'Hello Grandpa', ar: 'أهلاً جدّو' };
      },
      desc: { en: 'Five years in — complete every course in Year 5.', ar: 'خمس سنوات — أكمل جميع مساقات السنة الخامسة.' },
      check: function(prefix){ return allYearCompleted(prefix, 5); },
      prog: function(prefix){ return countYearCourses(prefix, 5); }
    },
    {
      id: 'allmath', icon: '📐',
      title: { en: 'Completed all Math', ar: 'أتقنت الرياضيات' },
      desc: { en: 'Finish every math & statistics course.', ar: 'أكمل جميع مساقات الرياضيات والإحصاء.' },
      check: function(prefix){ return allCategoryCompleted(prefix, 'math'); },
      prog: function(prefix){ return countCategory(prefix, 'math'); }
    },
    {
      id: 'progpath', icon: '💻',
      title: { en: 'Finished Programming Path', ar: 'أتممت مسار البرمجة' },
      desc: { en: 'Complete the intro programming sequence.', ar: 'أكمل تسلسل مساقات البرمجة التأسيسية.' },
      appliesTo: progPathApplies,
      check: progPathDone,
      prog: function(prefix){ var seq = findProgSequence(prefix); return seq ? countSlugs(prefix, seq) : null; }
    },
    {
      id: 'halfway', icon: '🎯',
      title: { en: 'Halfway to Graduation', ar: 'في منتصف الطريق للتخرج' },
      desc: { en: 'Complete 50% of required credit hours.', ar: 'أكمل 50٪ من الساعات المعتمدة المطلوبة.' },
      check: function(prefix){ var s = window.__computeStats(prefix); return s.totalCredits > 0 && s.pct >= 50; },
      prog: function(prefix){ return creditProgressToward(prefix, 50); }
    },
    {
      id: 'gradready', icon: '🎓',
      title: { en: 'Graduation Ready', ar: 'جاهز للتخرج' },
      desc: { en: 'Meet 100% of the graduation requirements.', ar: 'أكمل 100٪ من متطلبات التخرج.' },
      check: function(prefix){ var s = window.__computeStats(prefix); return s.totalCredits > 0 && s.doneCredits >= s.totalCredits; },
      prog: function(prefix){ return creditProgressToward(prefix, 100); }
    },
    {
      id: 'goodstudent', icon: '🌟',
      title: function(gender){
        if(gender === 'Male') return { en: 'Good Boy', ar: 'ولد مجتهد' };
        if(gender === 'Female') return { en: 'Good Girl', ar: 'بنت مجتهدة' };
        return { en: 'Great Student', ar: 'طالب مجتهد' };
      },
      desc: { en: 'Complete 10 courses with no failing grade.', ar: 'أكمل 10 مساقات دون أي علامة راسب.' },
      check: tenNoFails,
      prog: function(prefix){
        // Distinct completed courses (deduped by catalog number, same as the
        // check) capped at the goal of 10.
        var page = document.getElementById('page-' + prefix);
        if(!page) return null;
        var progress = window.__getProgress();
        var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
        var seen = {}, done = 0;
        page.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
          var parts = window.__splitCourseId(el.id);
          if(!parts) return;
          var meta = info[parts.slug];
          var key = (meta && meta.num && meta.num !== '-') ? meta.num : parts.slug;
          if(seen[key] || !progress[el.id]) return;
          seen[key] = true; done++;
        });
        return { done: Math.min(done, 10), total: 10 };
      }
    },
    {
      id: 'arabiclegend', icon: '🕌', global: true,
      title: { en: 'Arabic Legend', ar: 'أسطورة اللغة العربية' },
      desc: { en: 'Browse in Arabic for 5+ total minutes.', ar: 'تصفّح الموقع بالعربية لأكثر من 5 دقائق إجمالًا.' },
      check: arabicLegendDone,
      prog: function(){
        var doneMin = Math.floor(getArabicMs() / 60000);
        var totalMin = Math.floor(ARABIC_TARGET_MS / 60000);
        return { done: Math.min(doneMin, totalMin), total: totalMin, unit: 'minutes' };
      }
    },
    {
      id: 'highskilled', icon: '🖥️',
      title: { en: 'High Skilled Student', ar: 'طالب عالي المهارة' },
      desc: { en: 'Complete Computer Skills & Research Methods.', ar: 'أكمل مهارات حاسوبية وأساسيات مناهج البحث.' },
      check: highSkilledDone,
      prog: function(prefix){ return countSlugs(prefix, ['computer-skills', 'research-methods']); }
    },
    {
      id: 'englishmaster', icon: '🔤',
      title: { en: 'English Master', ar: 'أستاذ اللغة الإنجليزية' },
      desc: { en: 'Complete every English course.', ar: 'أكمل جميع مساقات اللغة الإنجليزية.' },
      check: function(prefix){ return allCategoryCompleted(prefix, 'eng'); },
      prog: function(prefix){ return countCategory(prefix, 'eng'); }
    },
    {
      id: 'mathholic', icon: '🧮',
      title: { en: 'Mathholic', ar: 'مهووس بالرياضيات' },
      desc: { en: 'Finish all math courses with a 3.5+ GPA in them.', ar: 'أكمل كل مساقات الرياضيات بمعدل أعلى من 3.5.' },
      check: mathholicDone,
      prog: function(prefix){ return countCategory(prefix, 'math'); }
    },
    {
      id: 'cpphoster', icon: '⚙️',
      title: { en: 'C++ Hoster', ar: 'محترف ++C' },
      desc: { en: 'Complete Programming Fundamentals I & II.', ar: 'أكمل أساسيات البرمجة 1 و2.' },
      appliesTo: cppHosterApplies,
      check: cppHosterDone,
      prog: function(prefix){ return countSlugs(prefix, ['progfund1', 'progfund2']); }
    }
  ];

  function loadUnlocked(){
    return window.AAUP_STORAGE.getJSON('aaup_achievements', {});
  }
  function saveUnlocked(m){
    window.AAUP_STORAGE.setJSON('aaup_achievements', m);
  }
  function resolveTitle(a, gender){
    return (typeof a.title === 'function') ? a.title(gender) : a.title;
  }

  // Checks every achievement against current data; anything newly true gets
  // permanently recorded (achievements don't get revoked if progress is
  // later undone — that's the normal, expected way gamified badges work).
  // A themed "you finished a whole year" popup that types its message out
  // character-by-character, terminal/code style (per the request: the text
  // appears in a code-writing way). Year 1 is the smurf graduation; later
  // years get their own line, and Year 5 greets the long-hauler as
  // grandpa/granny by gender.
  function showYearCelebration(prefix, yearNum){
    if(typeof document === 'undefined') return;
    // Belt-and-suspenders with the seed guard: a full-screen year overlay must
    // NEVER cover the Home screen or the dashboard (that's what made the app
    // look blank on load). Only celebrate while the student is actually on the
    // plan page they just finished a year in.
    var homeEl = document.getElementById('home');
    if(homeEl && getComputedStyle(homeEl).display !== 'none') return;
    var dashEl = document.getElementById('dashboard');
    if(dashEl && getComputedStyle(dashEl).display !== 'none') return;
    var gender = studentGender();
    var MESSAGES = {
      1: 'Welcome to university.\nCongrats — you are not a smurf anymore.',
      2: 'Second year cleared.\nHalfway to legend — keep pushing.',
      3: 'Third year done.\nThe finish line is in sight.',
      4: 'Senior year complete.\nThe tassel is almost yours.',
      5: 'Five years and still standing.\nHello ' + (gender === 'Female' ? 'granny' : 'grandpa') + ' — respect.'
    };
    var msg = MESSAGES[yearNum];
    if(!msg) return;
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    var ov = document.createElement('div');
    ov.className = 'year-cel-overlay';
    ov.innerHTML =
      '<div class="year-cel-card" role="dialog" aria-modal="true">' +
        '<div class="year-cel-bar"><span class="ycb-dot r"></span><span class="ycb-dot y"></span>' +
          '<span class="ycb-dot g"></span><span class="ycb-title">student@aaup: ~/year-' + yearNum + '</span></div>' +
        '<pre class="year-cel-body"><span class="ycb-run">$ ./finish_year ' + yearNum + '\n</span>' +
          '<span class="year-cel-text"></span><span class="year-cel-cursor">&#9611;</span></pre>' +
        '<button type="button" class="year-cel-close">' + (rtl ? 'إغلاق' : 'close') + '</button>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('open'); });
    var textEl = ov.querySelector('.year-cel-text');
    var btn = ov.querySelector('.year-cel-close');
    function done(){ ov.classList.remove('open'); setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); }, 300); }
    btn.addEventListener('click', done);
    ov.addEventListener('click', function(e){ if(e.target === ov) done(); });
    document.addEventListener('keydown', function esc(e){ if(e.key === 'Escape'){ done(); document.removeEventListener('keydown', esc); } });
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced){ textEl.textContent = msg; return; }
    var i = 0;
    (function type(){
      if(i >= msg.length){ return; }
      var ch = msg.charAt(i); i++;
      textEl.textContent += ch;
      setTimeout(type, ch === '\n' ? 240 : (26 + Math.random() * 42));
    })();
  }
  window.__yearCelebration = showYearCelebration;

  // The first time this runs for a plan (page load, or the first load after
  // new achievements shipped) it must SEED silently — record whatever is
  // already complete without celebrating it. Otherwise a returning student is
  // ambushed on load by toasts, confetti and a full-screen typewriter popup
  // for years they finished sessions ago; stacked across several completed
  // years/plans those opaque overlays covered the entire app and it looked
  // like a blank page. Only genuinely-live completions (a later pass, after a
  // checkbox is ticked) celebrate.
  var _achSeeded = {};
  function refreshUnlocks(prefix){
    var unlocked = loadUnlocked();
    var firstPass = !_achSeeded[prefix];
    _achSeeded[prefix] = true;
    var newly = [];
    ACHIEVEMENTS.forEach(function(a){
      var key = a.global ? a.id : (prefix + ':' + a.id);
      if(unlocked[key]) return;
      if(a.appliesTo && !a.appliesTo(prefix)) return;
      if(a.check(prefix)){
        unlocked[key] = { at: new Date().toISOString() };
        newly.push(a);
      }
    });
    if(newly.length){
      saveUnlocked(unlocked);
      // Seed pass: persist the unlocks above, but celebrate nothing.
      if(firstPass){ return unlocked; }
      // Never let a celebration throw and take the whole app (load) down with
      // it — the unlocks are already saved above regardless.
      try {
        var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
        var gender = studentGender();
        newly.forEach(function(a){
          var t = resolveTitle(a, gender);
          if(window.__showToast){ window.__showToast('🏆 ' + (rtl ? 'إنجاز جديد: ' : 'Achievement unlocked: ') + (rtl ? t.ar : t.en)); }
        });
        // A real "you earned something" moment deserves a little burst.
        if(window.__confetti){ window.__confetti(); }
        // If a whole YEAR just got completed, add the themed typewriter popup
        // on top — for the highest year finished, so multiple newly-detected
        // years (e.g. first load after this update) show only one.
        var YEAR_OF = { year1: 1, year2: 2, year3: 3, year4: 4, year5: 5 };
        var topYear = 0;
        newly.forEach(function(a){ var y = YEAR_OF[a.id] || 0; if(y > topYear) topYear = y; });
        if(topYear){ showYearCelebration(prefix, topYear); }
      } catch(e){ /* celebration is cosmetic; never break the app over it */ }
    }
    return unlocked;
  }

  function getUnlockedCount(prefix){
    var unlocked = refreshUnlocks(prefix);
    var unlockedCount = 0, applicableCount = 0;
    ACHIEVEMENTS.forEach(function(a){
      var applies = !a.appliesTo || a.appliesTo(prefix);
      var key = a.global ? a.id : (prefix + ':' + a.id);
      if(applies) applicableCount++;
      if(applies && unlocked[key]) unlockedCount++;
    });
    return { unlocked: unlockedCount, total: applicableCount };
  }

  function render(prefix){
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    var unlocked = refreshUnlocks(prefix);
    var gender = studentGender();
    var unlockedCount = 0, applicableCount = 0;

    var badges = ACHIEVEMENTS.map(function(a){
      var applies = !a.appliesTo || a.appliesTo(prefix);
      var key = a.global ? a.id : (prefix + ':' + a.id);
      var isUnlocked = applies && !!unlocked[key];
      if(applies) applicableCount++;
      if(isUnlocked) unlockedCount++;
      var title = resolveTitle(a, gender);
      var cls = !applies ? 'na' : (isUnlocked ? 'unlocked' : 'locked');
      var tag = isUnlocked ? ('✓ ' + (rtl ? 'مُنجَز' : 'Unlocked'))
        : (!applies ? (rtl ? 'غير متاح لهذا التخصص' : 'Not applicable here') : '');

      // For a locked-but-applicable achievement with a countable goal, show
      // exactly how much is left plus a small bar — turns a mystery box into
      // something concrete to aim for.
      var progHtml = '';
      if(applies && !isUnlocked && typeof a.prog === 'function'){
        var pr = null;
        try{ pr = a.prog(prefix); }catch(e){ pr = null; }
        if(pr && pr.total > 0 && pr.done < pr.total){
          var remaining = pr.total - pr.done;
          var pctBar = Math.round(pr.done / pr.total * 100);
          var unit;
          if(pr.unit === 'credit hours'){ unit = rtl ? 'ساعة معتمدة' : (remaining === 1 ? 'credit hour' : 'credit hours'); }
          else if(pr.unit === 'minutes'){ unit = rtl ? 'دقيقة' : (remaining === 1 ? 'minute' : 'minutes'); }
          else { unit = rtl ? 'مساقات' : (remaining === 1 ? 'course' : 'courses'); }
          var hintText = rtl
            ? ('باقٍ ' + remaining + ' ' + unit)
            : (remaining + ' more ' + unit + ' to go');
          progHtml =
            '<div class="ab-progress"><div class="ab-progress-track"><span style="width:' + pctBar + '%;"></span></div>' +
            '<div class="ab-progress-text">' + hintText + ' · ' + pr.done + '/' + pr.total + '</div></div>';
        }
      }
      var shareBtn = '';
      if(isUnlocked){
        var majorName = (window.AAUP_DASHBOARD && window.AAUP_DASHBOARD.planDisplayInfo) ? window.AAUP_DASHBOARD.planDisplayInfo(prefix).name : '';
        shareBtn = '<button type="button" class="ab-share" ' +
          'data-ach-icon="' + window.__escapeHtml(a.icon) + '" ' +
          'data-ach-title="' + window.__escapeHtml(rtl ? title.ar : title.en) + '" ' +
          'data-ach-sub="' + window.__escapeHtml(majorName) + '">📤 ' + (rtl ? 'مشاركة' : 'Share') + '</button>';
      }
      return '<div class="achievement-badge ' + cls + '">' +
        '<div class="ab-icon">' + a.icon + '</div>' +
        '<div class="ab-title">' + (rtl ? title.ar : title.en) + '</div>' +
        '<div class="ab-desc">' + (rtl ? a.desc.ar : a.desc.en) + '</div>' +
        progHtml +
        (tag ? '<div class="ab-tag">' + tag + '</div>' : '') +
        shareBtn +
        '</div>';
    }).join('');

    return '<h2 style="margin-top:0;">🏆 ' + (rtl ? 'الإنجازات' : 'Achievements') + '</h2>' +
      '<p class="achievements-summary">' + unlockedCount + ' / ' + applicableCount + ' ' +
      (rtl ? 'إنجازًا محقَّقًا لهذا التخصص' : 'unlocked for this major') + '</p>' +
      '<div class="achievement-grid">' + badges + '</div>';
  }

  function open(prefix){
    var body = document.getElementById('achievementsModalBody');
    var overlay = document.getElementById('achievementsModalOverlay');
    if(!body || !overlay) return;
    body.innerHTML = render(prefix);
    overlay.classList.add('open');
  }

  function bind(){
    var overlay = document.getElementById('achievementsModalOverlay');
    var closeBtn = document.getElementById('achievementsModalClose');
    if(!overlay) return;
    var close = function(){ overlay.classList.remove('open'); };
    if(closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    // NOTE: the modal card deliberately does NOT stopPropagation on clicks.
    // The close handler above only fires when e.target === overlay (the
    // backdrop itself), so inner clicks never close the modal anyway — and a
    // stopPropagation here would swallow the Share button's click before it
    // reached the delegated handler below (that was the "Share does nothing"
    // bug).
    // Delegated so it keeps working after every re-render of the badge grid.
    overlay.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.ab-share');
      if(!btn || !window.AAUP_CELEBRATE) return;
      e.stopPropagation();
      window.AAUP_CELEBRATE.shareAchievement({
        icon: btn.getAttribute('data-ach-icon'),
        title: btn.getAttribute('data-ach-title'),
        subtitle: btn.getAttribute('data-ach-sub'),
        footer: 'University Easy Plans'
      });
    });
  }
  if(document.readyState === 'complete'){ bind(); }
  else { window.addEventListener('load', bind); }

  window.AAUP_ACHIEVEMENTS = { open: open, refreshUnlocks: refreshUnlocks, getUnlockedCount: getUnlockedCount };
})();
