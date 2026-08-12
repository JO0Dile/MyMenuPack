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

  // Up to a few real majors from inside a college, for the picker tile's
  // preview rows — every plan (built-in and community) lives in the same
  // AAUP_IMPORTED store, so this is one lookup, not two. Distinct majors
  // stay distinct entries here even when several share a college (e.g. AI &
  // Robotics and Data Science both under "AI and Data Science") — nothing
  // here collapses two majors into one row.
  function majorsForCollege(uniId, collegeId){
    var imported = importedPlans();
    var keyFn = window.AAUP_IMPORTED && window.AAUP_IMPORTED.collegeKeyForPlan;
    var nameFn = window.AAUP_IMPORTED && window.AAUP_IMPORTED.nameParts;
    var out = [];
    Object.keys(imported).forEach(function(id){
      var p = imported[id];
      if(!p || !p.majorName || (p.university || 'aaup') !== uniId) return;
      if((keyFn ? keyFn(p) : 'custom:' + uniId + ':unspecified') !== collegeId) return;
      var courses = Array.isArray(p.courses) ? p.courses : [];
      var cr = courses.length ? courses.reduce(function(sum, c){ return sum + (parseFloat(c.creditHours) || 0); }, 0) : null;
      var en = nameFn ? nameFn(p.majorName.en) : { big: p.majorName.en || '', small: '' };
      var ar = nameFn ? nameFn(p.majorName.ar) : { big: p.majorName.ar || '', small: '' };
      out.push({
        en: en.big + (en.small ? ' ' + en.small : ''),
        ar: (ar.big || en.big) + (ar.small ? ' ' + ar.small : ''),
        cr: cr
      });
    });
    return out;
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
    el.style.display = 'flex';
    var uni = window.APP_UNIVERSITIES[state.university];
    var html = '<button type="button" onclick="AAUP_HOME.showUniversities()">🏠 Home</button>';
    if(state.college){
      var college = collegesForUniversity(state.university)[state.college];
      var name = collegeDisplayName(college);
      html += '<span class="hb-sep">/</span><button type="button" onclick="AAUP_HOME.showColleges(\'' + state.university + '\')">' + (uni ? uni.icon + ' ' + uni.shortName : state.university) + '</button>';
      html += '<span class="hb-sep">/</span><span class="hb-current">' + name.en + '</span>';
    } else {
      html += '<span class="hb-sep">/</span><span class="hb-current">' + (uni ? uni.icon + ' ' + uni.name.en : state.university) + '</span>';
    }
    el.innerHTML = html;
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
    if(step === 'universities'){
      intro.innerHTML = '<strong>Choose your university</strong>, then your college, then your study plan. <span style="opacity:.75;">Unofficial student project — always confirm with your academic advisor.</span>';
    } else if(step === 'colleges'){
      intro.innerHTML = '<strong>Choose your college / faculty.</strong> <span style="opacity:.75;">Don’t see it yet? Create a plan below and it gets its own tile.</span>';
    } else {
      intro.innerHTML = '<strong>Choose a study plan</strong> to view its full four-year course map, prerequisites, and electives. <span style="opacity:.75;">Unofficial student project — always confirm with your academic advisor.</span>';
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

  var COLLEGE_PREVIEW_N = 3;

  function renderColleges(uniId){
    var grid = document.getElementById('homeCollegeGrid');
    if(!grid) return;
    var colleges = collegesForUniversity(uniId);
    var ids = Object.keys(colleges);
    var esc = window.__escapeHtml;
    var tiles = ids.map(function(cid){
      var c = colleges[cid];
      var name = collegeDisplayName(c);
      var majors = majorsForCollege(uniId, cid);
      var shown = majors.slice(0, COLLEGE_PREVIEW_N);
      var rest = majors.length - shown.length;
      var previewHTML = shown.map(function(m){
        return '<div class="pc-major-row"><span class="pc-major-name">' + esc(m.en) + '</span>' +
          '<span class="pc-major-cr">' + (m.cr != null ? m.cr + 'H' : '') + '</span></div>';
      }).join('') + (rest > 0 ? '<div class="pc-major-more">+ ' + rest + ' more →</div>' : '');
      // Registered colleges (APP_COLLEGES) carry their own icon; a college
      // that only exists because a student's custom plan named it (no
      // registered entry) falls back to a plain building.
      return '<div class="plan-card" onclick="AAUP_HOME.showPlans(\'' + uniId + '\',\'' + cid.replace(/'/g, "\\'") + '\')" role="button" tabindex="0">' +
        '<span class="home-tile-badge">' + c.count + ' plan' + (c.count === 1 ? '' : 's') + '</span>' +
        '<div class="pc-icon">' + window.AAUP_ICONS.markup(c, { size: 26, fallback: '🏫' }) + '</div>' +
        '<h2 style="font-size:14.5px;">' + name.en + '</h2>' +
        '<p style="direction:rtl;">' + name.ar + '</p>' +
        (previewHTML ? '<div class="pc-major-list">' + previewHTML + '</div>' : '') +
        (c.count ? '<div class="pc-cta">View plans →</div>' : '<div class="pc-cta home-tile-empty">No plans yet</div>') +
        '</div>';
    }).join('');
    var uni = window.APP_UNIVERSITIES[uniId];
    tiles += '<div class="new-plan-card" onclick="AAUP_HOME.startNewPlan(\'' + uniId + '\')" role="button" tabindex="0">' +
      '<span class="npc-plus">+</span>' +
      '<p class="npc-label">Don’t see your college? Add a plan and it’ll get its own tile.</p></div>';
    grid.innerHTML = ids.length
      ? tiles
      : '<p class="home-step-empty-note">No colleges registered for ' + (uni ? uni.name.en : uniId) + ' yet.</p>' + tiles;
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
        '<div class="hr-kicker">Continue · تابع</div>' +
        // info.name (from planDisplayInfo) is already HTML-escaped once by
        // the sync sanitizer — esc()'ing it again would show a literal "&amp;".
        '<div class="hr-name">' + (info.name || prefix) + '</div>' +
        (pct !== null
          ? '<div class="hr-sub">' + pct + '% complete · مكتمل</div><div class="hr-progress"><span style="width:' + pct + '%;"></span></div>'
          : '<div class="hr-sub">Jump back in · العودة إلى خطتك</div>') +
      '</div>' +
      '<div class="hr-go">→</div>';
    card.style.display = 'flex';
    var go = function(){ if(window.AAUP_DASHBOARD){ window.AAUP_DASHBOARD.open(prefix); } };
    card.onclick = go;
    card.onkeydown = function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } };
  }

  function showUniversities(){
    state.university = null; state.college = null;
    renderResumeCard();
    renderUniversities();
    renderBreadcrumb();
    showStep('universities');
    if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.startWhenClear('home'); }
  }

  function showColleges(uniId){
    state.university = uniId; state.college = null;
    renderColleges(uniId);
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
    }
  };

  function init(){ showUniversities(); }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
