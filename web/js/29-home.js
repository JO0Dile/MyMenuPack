// ==========================
// HOME — University -> College -> Plan drill-down
// ==========================
// Three-step picker built from window.APP_UNIVERSITIES / window.APP_COLLEGES
// plus whatever plans actually reference them (the four built-in
// .plan-card[data-page][data-university][data-college] elements, and every
// AAUP_IMPORTED-managed custom plan). A college with zero plans still gets
// a tile ("no plans here yet") instead of disappearing, so the shape of a
// university can exist before every one of its plans does.
(function(){
  var state = { university: null, college: null };

  function importedPlans(){
    return (window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()) || {};
  }

  function builtInCards(){
    // Exclude imported/feed plan cards ([data-imported]) — they live inside
    // #homeStepPlans too, but they're already accounted for via importedPlans()
    // below. Without :not([data-imported]) every feed plan gets counted twice
    // in the university/college badges (and filtered redundantly), which showed
    // up as a college with one plan reading "2 plans".
    return Array.prototype.slice.call(document.querySelectorAll('#homeStepPlans .plan-card[data-page]:not([data-imported])'));
  }

  // One flat list of {university, college, collegeMeta} across every plan
  // (built-in + imported) — the single source every count/grid below reads.
  function allPlanMeta(){
    var list = builtInCards().map(function(el){
      return { university: el.dataset.university, college: el.dataset.college, collegeMeta: null };
    });
    var imported = importedPlans();
    var keyFn = window.AAUP_IMPORTED && window.AAUP_IMPORTED.collegeKeyForPlan;
    Object.keys(imported).forEach(function(id){
      var p = imported[id];
      list.push({
        university: p.university || 'aaup',
        college: keyFn ? keyFn(p) : 'custom:' + (p.university || 'aaup') + ':unspecified',
        collegeMeta: p.college || null
      });
    });
    return list;
  }

  function countForUniversity(uniId){
    return allPlanMeta().filter(function(m){ return m.university === uniId; }).length;
  }

  function collegesForUniversity(uniId){
    var out = {};
    Object.keys(window.APP_COLLEGES || {}).forEach(function(cid){
      var c = window.APP_COLLEGES[cid];
      if(c.university !== uniId) return;
      // Carries all three icon layers, not just the emoji: this object is what
      // the tile renders from, so anything dropped here is invisible downstream.
      out[cid] = { id: cid, name: c.name, icon: c.icon, iconKey: c.iconKey,
                   imageUrl: c.imageUrl, count: 0 };
    });
    allPlanMeta().filter(function(m){ return m.university === uniId; }).forEach(function(m){
      if(!out[m.college]){ out[m.college] = { id: m.college, name: m.collegeMeta, count: 0 }; }
      out[m.college].count++;
    });
    return out;
  }

  // The picker is the first screen a student sees, and it was entirely in
  // English no matter what the language switch said: the faculty tiles' own
  // headings, their screen-reader labels, the plan counts, the header chips
  // and the "Add a plan" tile. `ar()` is the same question js/09-language.js
  // answers everywhere else.
  function ar(){ return !!(window.AAUP_LANG && window.AAUP_LANG.isAr()); }

  // "N plans" in a language where the plural is not "add an s". Arabic
  // counts one, two, a few (3-10) and many (11+) differently, and getting
  // that wrong is the difference between a sentence and a label.
  function planCountLabel(n){
    n = n || 0;
    if(!ar()) return n === 1 ? '1 plan' : n + ' plans';
    if(n === 0) return 'لا توجد خطط';
    if(n === 1) return 'خطة واحدة';
    if(n === 2) return 'خطتان';
    if(n <= 10) return n + ' خطط';
    return n + ' خطة';
  }

  function collegeDisplayName(college){
    if(college && college.name && (college.name.en || college.name.ar)){
      return { en: college.name.en || college.name.ar, ar: college.name.ar || college.name.en };
    }
    return { en: 'Other / Community', ar: 'أخرى / مجتمعية' };
  }

  function renderBreadcrumb(){
    var el = document.getElementById('homeBreadcrumb');
    if(!el) return;
    if(!state.university){ el.style.display = 'none'; el.innerHTML = ''; return; }
    var only = soleUniversity();
    // With one university the faculty list IS the top of the app, so it needs
    // no crumb of its own and nothing above it to go back to.
    if(only && !state.college){ el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'flex';
    var uni = window.APP_UNIVERSITIES[state.university];
    var A = ar();
    var home = only
      ? '<button type="button" onclick="AAUP_HOME.showColleges(\'' + state.university + '\')">' +
        window.AAUP_ICONS.preview('home', 15) + ' ' + (uni ? uni.shortName : (A ? 'الرئيسية' : 'Home')) + '</button>'
      : '<button type="button" onclick="AAUP_HOME.showUniversities()">' +
        window.AAUP_ICONS.preview('home', 15) + ' ' + (A ? 'الرئيسية' : 'Home') + '</button>';
    var html = home;
    if(state.college){
      var college = collegesForUniversity(state.university)[state.college];
      var name = collegeDisplayName(college);
      if(!only){
        html += '<span class="hb-sep">/</span><button type="button" onclick="AAUP_HOME.showColleges(\'' + state.university + '\')">' + (uni ? uni.icon + ' ' + uni.shortName : state.university) + '</button>';
      }
      html += '<span class="hb-sep">/</span><span class="hb-current">' +
        (A ? (name.ar || name.en) : name.en) + '</span>';
    } else {
      html += '<span class="hb-sep">/</span><span class="hb-current">' +
        (uni ? uni.icon + ' ' + (A ? (uni.name.ar || uni.name.en) : uni.name.en) : state.university) + '</span>';
    }
    el.innerHTML = html;
  }

  // The app ships one university. Birzeit and Al-Salem stay in data/, reviewed
  // and version-controlled, but unpublished — so the first screen was a grid
  // with a single tile on it, and every student paid a tap to pick the only
  // option there was. When there is exactly one, it is not a choice: the app
  // opens on its faculties instead. Publish a second university and the picker
  // comes back on its own, with nothing to change here.
  function soleUniversity(){
    var ids = Object.keys(window.APP_UNIVERSITIES || {});
    return ids.length === 1 ? ids[0] : null;
  }

  function showStep(step){
    document.getElementById('homeStepUniversities').style.display = step === 'universities' ? 'block' : 'none';
    document.getElementById('homeStepColleges').style.display = step === 'colleges' ? 'block' : 'none';
    document.getElementById('homeStepPlans').style.display = step === 'plans' ? 'block' : 'none';
    // The resume card belongs only on the top-level step (it lives outside
    // the three step containers, so it has to be toggled explicitly).
    var resume = document.getElementById('homeResumeCard');
    if(resume && step !== 'universities'){ resume.style.display = 'none'; }
    var intro = document.getElementById('homeIntroText');
    if(!intro) return;
    // One short line per step. These used to run to two sentences each, with
    // the advisor disclaimer repeated on two of them — students said the app
    // had "A LOT OF TEXT". The disclaimer now lives once, in the footer.
    var A = ar();
    if(step === 'universities'){
      intro.innerHTML = '<strong>' + (A ? 'اختر جامعتك.' : 'Pick your university.') + '</strong>';
    } else if(step === 'colleges'){
      intro.innerHTML = '<strong>' + (A ? 'اختر كليتك.' : 'Pick your faculty.') + '</strong>';
    } else {
      intro.innerHTML = '<strong>' + (A ? 'اختر تخصصك.' : 'Pick your major.') + '</strong>';
    }
  }

  function renderUniversities(){
    var grid = document.getElementById('homeUniversityGrid');
    if(!grid) return;
    var ids = Object.keys(window.APP_UNIVERSITIES || {});
    grid.innerHTML = ids.map(function(uid){
      var u = window.APP_UNIVERSITIES[uid];
      var count = countForUniversity(uid);
      return '<div class="plan-card" onclick="AAUP_HOME.showColleges(\'' + uid + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\')AAUP_HOME.showColleges(\'' + uid + '\')">' +
        '<span class="home-tile-badge">' + count + ' plan' + (count === 1 ? '' : 's') + '</span>' +
        '<div class="pc-icon">' + window.AAUP_ICONS.markup(u, { size: 30, label: u.shortName }) + '</div>' +
        '<h2>' + u.name.en + '<em>' + u.shortName + '</em></h2>' +
        '<p style="direction:rtl;">' + u.name.ar + '</p>' +
        // The description was editable in Admin Mode and displayed nowhere, so
        // writing one had no visible effect at all. Only shown when set, so a
        // university without one looks exactly as it did before.
        (u.description
          ? '<p class="pc-uni-desc">' + window.__escapeHtml(u.description) + '</p>'
          : '') +
        '<div class="pc-cta">Browse colleges →</div></div>';
    }).join('');
  }

  function renderColleges(uniId){
    var grid = document.getElementById('homeCollegeGrid');
    if(!grid) return;
    var colleges = collegesForUniversity(uniId);
    var ids = Object.keys(colleges);
    var esc = window.__escapeHtml;
    // A faculty tile is a signpost, not a summary. It used to carry a badge, an
    // icon, two names, three major names with their credit hours, "+5 more →"
    // AND "View plans →" — eight lines each, sixteen of them, all of it
    // repeating what the very next screen says in full. Icon, name, count.
    var tiles = ids.map(function(cid){
      var c = colleges[cid];
      var name = collegeDisplayName(c);
      // Registered colleges (APP_COLLEGES) carry their own icon; a college
      // that only exists because a student's custom plan named it (no
      // registered entry) falls back to a plain building.
      // A registered faculty with nothing behind it yet still gets a tile —
      // APP_COLLEGES lists it — but its count is dimmed rather than sitting in
      // the accent colour, so "0" doesn't read as something worth tapping.
      var plans = planCountLabel(c.count);
      return '<div class="plan-card plan-card-faculty" onclick="AAUP_HOME.showPlans(\'' + uniId + '\',\'' + cid.replace(/'/g, "\\'") + '\')" role="button" tabindex="0"' +
        ' aria-label="' + esc(ar() ? (name.ar || name.en) : name.en) + ', ' + plans + '">' +
        '<div class="pc-icon">' + window.AAUP_ICONS.markup(c, { size: 26, fallback: '🏫' }) + '</div>' +
        // In Arabic the Arabic name is the heading and the English is the
        // second line. Both names are always shown — a student who knows the
        // faculty by its English name should still find it — but the one they
        // read first is the one in the language they chose.
        '<div class="pc-faculty-body">' +
          (ar()
            ? '<h2 style="direction:rtl;">' + esc(name.ar || name.en) + '</h2>' +
              (name.ar ? '<p>' + esc(name.en) + '</p>' : '')
            : '<h2>' + esc(name.en) + '</h2>' +
              (name.ar ? '<p style="direction:rtl;">' + esc(name.ar) + '</p>' : '')) +
        '</div>' +
        '<span class="pc-faculty-count' + (c.count ? '' : ' pc-faculty-count-none') +
          '" aria-hidden="true" title="' + plans + '">' +
          (c.count || 0) + '</span>' +
        '</div>';
    }).join('');
    var uni = window.APP_UNIVERSITIES[uniId];
    tiles += '<div class="new-plan-card" onclick="AAUP_HOME.startNewPlan(\'' + uniId + '\')" role="button" tabindex="0">' +
      '<span class="npc-plus">+</span>' +
      '<p class="npc-label">' + (ar() ? 'أضف خطة' : 'Add a plan') + '</p></div>';
    grid.innerHTML = ids.length
      ? tiles
      : '<p class="home-step-empty-note">' + (ar()
          ? 'لا توجد كليات مسجّلة لـ ' + (uni ? (uni.name.ar || uni.name.en) : uniId) + ' بعد.'
          : 'No colleges registered for ' + (uni ? uni.name.en : uniId) + ' yet.') + '</p>' + tiles;
  }

  function updatePlansEmptyState(){
    var anyBuiltInVisible = builtInCards().some(function(el){ return el.style.display !== 'none'; });
    var importedHost = document.getElementById('importedPlansContainer');
    var anyImportedVisible = !!(importedHost && importedHost.querySelector('.plan-card'));
    var note = document.getElementById('homePlansEmptyNote');
    if(note){ note.style.display = (!anyBuiltInVisible && !anyImportedVisible) ? 'block' : 'none'; }
  }

  function filterBuiltInCards(){
    builtInCards().forEach(function(el){
      var match = !state.college || (el.dataset.university === state.university && el.dataset.college === state.college);
      el.style.display = match ? '' : 'none';
    });
    updatePlansEmptyState();
  }

  // Quick-resume card — the last plan the student actually opened is
  // already remembered (AAUP_DASHBOARD keeps aaup_selectedPlan), so offer a
  // one-tap jump straight back into it instead of making a returning user
  // walk University -> College -> Plan every single time. Only shown on the
  // top-level step, and only when that remembered plan still exists.
  function renderResumeCard(){
    var card = document.getElementById('homeResumeCard');
    if(!card) return;
    var dash = window.AAUP_DASHBOARD;
    var prefix = dash && dash.getSelected ? dash.getSelected() : null;
    var known = false;
    if(prefix){
      if(dash.isImportedPlan && dash.isImportedPlan(prefix)){
        known = !!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[prefix]);
      } else {
        known = !!document.getElementById('page-' + prefix);
      }
    }
    if(!prefix || !known){ card.style.display = 'none'; card.innerHTML = ''; card.onclick = null; return; }

    var info = dash.planDisplayInfo ? dash.planDisplayInfo(prefix) : { icon: '🎓', name: prefix };
    var pct = dash.planPercent ? dash.planPercent(prefix) : null;
    card.innerHTML =
      '<div class="hr-icon">' + window.AAUP_ICONS.markup(info, { size: 24 }) + '</div>' +
      '<div class="hr-body">' +
        // One language, not both at once. This card said "Continue · تابع"
        // and "45% complete · مكتمل" to everyone, which is twice as much
        // text as anyone needed and half of it in the wrong language.
        '<div class="hr-kicker">' + (ar() ? 'تابع' : 'Continue') + '</div>' +
        // info.name (from planDisplayInfo) is already HTML-escaped once by
        // the sync sanitizer — esc()'ing it again would show a literal "&amp;".
        '<div class="hr-name">' + (info.name || prefix) + '</div>' +
        (pct !== null
          ? '<div class="hr-sub">' + (ar() ? pct + '٪ مكتمل' : pct + '% complete') +
            '</div><div class="hr-progress"><span style="width:' + pct + '%;"></span></div>'
          : '<div class="hr-sub">' + (ar() ? 'العودة إلى خطتك' : 'Jump back in') + '</div>') +
      '</div>' +
      '<div class="hr-go">→</div>';
    card.style.display = 'flex';
    var go = function(){ if(window.AAUP_DASHBOARD){ window.AAUP_DASHBOARD.open(prefix); } };
    card.onclick = go;
    card.onkeydown = function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } };
  }

  var visitCounted = false;
  function renderHeaderStats(){
    if(!visitCounted){ visitCounted = true; bumpVisits(); maybeOfferInstall(); }
    var el = document.getElementById('homeHeaderStats');
    if(!el) return;
    var uniCount = Object.keys(window.APP_UNIVERSITIES || {}).length;
    var planCount = allPlanMeta().length;
    var faculties = Object.keys(collegesForUniversity(soleUniversity() || state.university) || {}).length;
    var A = ar();
    el.innerHTML =
      '<span>' + window.AAUP_ICONS.preview('book', 13) +
        (A ? planCount + ' خطة دراسية' : planCount + ' study plan' + (planCount === 1 ? '' : 's')) + '</span>' +
      // "1 university" is not a fact worth a chip when there is no university
      // to choose. On one university it reports the faculties instead, which
      // IS what the screen below is about.
      (uniCount === 1
        ? (faculties ? '<span>' + window.AAUP_ICONS.preview('university', 13) +
            (A ? faculties + ' كلية' : faculties + ' facult' + (faculties === 1 ? 'y' : 'ies')) + '</span>' : '')
        : '<span>' + window.AAUP_ICONS.preview('cap', 13) +
            (A ? uniCount + ' جامعات' : uniCount + ' universities') + '</span>') +
      // 10 · Offline-first is this app's best feature and it was invisible.
      // This REPLACES the old static "Free & offline" chip rather than sitting
      // next to it — two chips saying the same thing is worse than one — and
      // it changes wording the moment the connection actually drops, which is
      // the one moment the claim is worth reading.
      '<span class="offline-note" id="homeOfflineNote"></span>';
    syncOfflineNote();
  }

  // Reads navigator.onLine, which is only ever a hint — the browser says
  // "online" for a captive portal that serves nothing. That is fine here: the
  // claim being made is about this app, and this app genuinely does work
  // either way, so the worst case is a true statement in the wrong tense.
  // ============================================================
  // 50 · ASK TO BE INSTALLED
  //
  // This used to hold the beforeinstallprompt event and pop a yes/no offer on
  // the third visit, then never ask again. All of that now lives in
  // js/89-install.js, because the offer is made in three places rather than
  // one and the state behind it — held / installed / iOS-manual / impossible —
  // is the same state in all three. What is left here is the visit counter,
  // which nothing else owns.
  var VISITS_KEY = 'aaup_visits';

  function bumpVisits(){
    try{
      var n = (parseInt(localStorage.getItem(VISITS_KEY), 10) || 0) + 1;
      localStorage.setItem(VISITS_KEY, String(n));
      return n;
    }catch(e){ return 0; }
  }
  function maybeOfferInstall(){
    if(window.AAUP_INSTALL) window.AAUP_INSTALL.refresh();
  }

  function syncOfflineNote(){
    var el = document.getElementById('homeOfflineNote');
    if(!el) return;
    var A = ar();
    var off = (typeof navigator !== 'undefined') && navigator.onLine === false;
    el.classList.toggle('is-offline', off);
    el.textContent = off
      ? (A ? 'أنت دون اتصال — كل شيء هنا يعمل' : 'Offline — everything here still works')
      : (A ? 'مجاني ويعمل بدون إنترنت' : 'Free, and works offline');
  }
  if(typeof window !== 'undefined'){
    window.addEventListener('online', syncOfflineNote);
    window.addEventListener('offline', syncOfflineNote);
  }

  function showUniversities(){
    var only = soleUniversity();
    if(only){ showColleges(only); return; }
    state.university = null; state.college = null;
    renderResumeCard();
    renderUniversities();
    renderHeaderStats();
    renderBreadcrumb();
    showStep('universities');
    if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.startWhenClear('home'); }
  }

  function showColleges(uniId){
    state.university = uniId; state.college = null;
    renderResumeCard();
    renderColleges(uniId);
    renderHeaderStats();
    renderBreadcrumb();
    showStep('colleges');
  }

  function showPlans(uniId, collegeId){
    state.university = uniId; state.college = collegeId;
    filterBuiltInCards();
    if(window.AAUP_IMPORTED){ window.AAUP_IMPORTED.renderHomeCards(); }
    renderBreadcrumb();
    showStep('plans');
  }

  function startNewPlan(uniId){
    state.university = uniId;
    if(window.AAUP_PLAN_EDITOR){ window.AAUP_PLAN_EDITOR.openNewPlanDialog(); }
  }

  window.AAUP_HOME = {
    showUniversities: showUniversities,
    showColleges: showColleges,
    showPlans: showPlans,
    startNewPlan: startNewPlan,
    getSelection: function(){ return { university: state.university, college: state.college }; },
    refreshPlanEmptyState: updatePlansEmptyState,
    refreshCounts: function(){
      if(document.getElementById('homeStepUniversities').style.display !== 'none'){ renderUniversities(); }
      if(state.university && document.getElementById('homeStepColleges').style.display !== 'none'){ renderColleges(state.university); }
      renderHeaderStats();
    }
  };

  function init(){ showUniversities(); }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
