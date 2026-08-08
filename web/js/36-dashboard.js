// ==========================
// DASHBOARD
// ==========================
// The landing screen once a plan has been chosen — a summary (progress,
// GPA, achievements, what's next) built entirely from the same modules
// the full study-plan page already uses, rather than a new parallel
// data source. Works for both a built-in major and a custom plan, since
// both register through the same window.__PLAN_DATA bridge.
(function(){
  var BUILT_IN_ICONS = { robotics: '🤖', cybersecurity: '🔒', medical: '⚕️', cs: '💻' };
  var SELECTED_KEY = 'aaup_selectedPlan';

  function isImportedPlan(prefix){
    return !!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[prefix]);
  }

  function planDisplayInfo(prefix){
    if(isImportedPlan(prefix)){
      var p = window.AAUP_IMPORTED.loadImportedPlans()[prefix];
      var en = window.AAUP_IMPORTED.nameParts(p.majorName.en);
      return { icon: p.icon || '🎓', iconKey: p.iconKey || '', imageUrl: p.imageUrl || '',
               name: en.big + (en.small ? ' ' + en.small : '') };
    }
    var page = document.getElementById('page-' + prefix);
    var nameEl = page && page.querySelector('.title-block .en');
    return { icon: BUILT_IN_ICONS[prefix] || '🎓', name: nameEl ? nameEl.textContent : prefix };
  }

  function getSelected(){
    try{ return localStorage.getItem(SELECTED_KEY); }catch(e){ return null; }
  }
  function setSelected(prefix){
    try{ localStorage.setItem(SELECTED_KEY, prefix); }catch(e){}
  }

  function selectAndOpen(prefix){
    setSelected(prefix);
    open(prefix);
  }

  function open(prefix){
    try {
      // Reuse the Imported Plans module's own open() to guarantee full
      // registration/rendering for a custom plan (same code path as
      // actually viewing it), then hide it again immediately — cheaper and
      // far less error-prone than duplicating that registration logic here.
      if(isImportedPlan(prefix)){
        window.AAUP_IMPORTED.open(prefix);
        var importedHost = document.getElementById('importedPlanView');
        if(importedHost) importedHost.style.display = 'none';
      } else if(document.getElementById('page-' + prefix)){
        var homeEl = document.getElementById('home');
        if(homeEl) homeEl.style.display = 'none';
        ['robotics', 'cybersecurity', 'medical', 'cs'].forEach(function(p){
          var el = document.getElementById('page-' + p);
          if(el) el.style.display = 'none';
        });
      } else {
        // Selected plan isn't available right now — a feed plan the sync
        // hasn't loaded yet, or one that was deleted. Never hide Home for
        // something we can't render; just show the picker instead.
        choosePlan();
        return;
      }
      var dash = document.getElementById('dashboard');
      dash.style.display = 'block';
      setSelected(prefix);
      render(prefix);
      if(window.AAUP_SIDEBAR){ window.AAUP_SIDEBAR.show(prefix, 'dashboard'); }
      window.scrollTo(0, 0);
      if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.startWhenClear('dashboard'); }
    } catch(e){
      // A malformed/half-loaded plan must NEVER strand the student on a blank
      // screen (Home was already hidden). Fall back to the picker. This is the
      // root fix for the "home flashes then goes blank on load" report — the
      // saved selected plan auto-opened and its render threw.
      if(window.console && console.error){ console.error('Could not open plan "' + prefix + '":', e); }
      try { choosePlan(); } catch(e2){}
    }
  }

  function openStudyPlan(prefix){
    document.getElementById('dashboard').style.display = 'none';
    if(isImportedPlan(prefix)){ window.AAUP_IMPORTED.open(prefix); }
    else if(window.showPage){ window.showPage(prefix); }
    if(window.AAUP_SIDEBAR){ window.AAUP_SIDEBAR.show(prefix, 'studyplan'); }
    if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.startWhenClear('studyplan'); }
  }

  // Explicitly shows the major-picker regardless of any previously
  // selected plan — the "switch plan" escape hatch. Home ("🏠") elsewhere
  // in the app intentionally does NOT do this once a plan is selected
  // (see the showPage('home') interception below) — this is the one
  // deliberate way back to it.
  function choosePlan(){
    document.getElementById('dashboard').style.display = 'none';
    var importedHost = document.getElementById('importedPlanView');
    if(importedHost) importedHost.style.display = 'none';
    ['robotics', 'cybersecurity', 'medical', 'cs'].forEach(function(p){
      var el = document.getElementById('page-' + p);
      if(el) el.style.display = 'none';
    });
    var homeEl = document.getElementById('home');
    if(homeEl) homeEl.style.display = 'block';
    if(window.AAUP_HOME){ window.AAUP_HOME.showUniversities(); }
    if(window.AAUP_SIDEBAR){ window.AAUP_SIDEBAR.hide(); }
  }

  function render(prefix){
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    var info = planDisplayInfo(prefix);

    var totalCr = 0, doneCr = 0;
    if(window.AAUP_AUDIT){
      window.AAUP_AUDIT.computeAudit(prefix).forEach(function(r){ totalCr += r.total; doneCr += r.completed; });
    }
    var pct = totalCr ? Math.round(doneCr / totalCr * 100) : 0;

    var gpaResult = window.AAUP_GPA ? window.AAUP_GPA.gpaFor(prefix, null) : { gpa: null };
    var standingLabel = null;
    if(gpaResult.gpa != null && window.AAUP_GPA.standingFor){
      var standing = window.AAUP_GPA.standingFor(gpaResult.gpa);
      standingLabel = standing ? (rtl ? standing.ar : standing.en) : null;
    }

    var achv = window.AAUP_ACHIEVEMENTS ? window.AAUP_ACHIEVEMENTS.getUnlockedCount(prefix) : { unlocked: 0, total: 0 };

    var nextCourses = [];
    if(window.AAUP_ADVISOR && window.AAUP_ADVISOR.recommend){
      var rec = window.AAUP_ADVISOR.recommend(prefix);
      nextCourses = (rec.chosen || []).slice(0, 4);
    }
    var courseInfo = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    function nameFor(slug){ var m = courseInfo[slug]; return m ? (rtl ? m.ar : m.name) : slug; }

    var host = document.getElementById('dashboard');
    var html = '<div class="dash-header">' +
      '<div class="dash-title"><span class="dash-icon">' + info.icon + '</span><div><h1>' + info.name + '</h1><p>' + (rtl ? 'لوحة التحكم' : 'Dashboard') + '</p></div></div>' +
      '<div class="dash-actions">' +
        '<button type="button" class="home-btn" onclick="AAUP_DASHBOARD.choosePlan()">🔁 ' + (rtl ? 'تبديل التخصص' : 'Switch Plan') + '</button>' +
        '<button type="button" class="home-btn" onclick="AAUP_DASHBOARD.openStudyPlan(\'' + prefix + '\')">🗺️ ' + (rtl ? 'خطتي الدراسية' : 'My Study Plan') + '</button>' +
      '</div></div>' +
      '<div class="dash-grid">' +
        '<div class="dash-card"><h3>' + (rtl ? 'التقدم' : 'Progress') + '</h3><div class="dash-big">' + pct + '%</div><div class="dash-sub">' + doneCr + ' / ' + totalCr + 'H</div></div>' +
        '<div class="dash-card"><h3>GPA</h3><div class="dash-big">' + (gpaResult.gpa != null ? gpaResult.gpa.toFixed(2) : '\u2014') + '</div><div class="dash-sub">' + (standingLabel || (rtl ? 'لم تُدخل علامات بعد' : 'No grades entered yet')) + '</div></div>' +
        '<div class="dash-card"><h3>' + (rtl ? 'الإنجازات' : 'Achievements') + '</h3><div class="dash-big">' + achv.unlocked + ' / ' + achv.total + '</div><div class="dash-sub">' + (rtl ? 'مُنجَز' : 'unlocked') + '</div></div>' +
      '</div>' +
      '<div class="dash-card" style="margin-bottom:20px;"><h3>' + (rtl ? 'ما الذي يمكنني أخذه الآن؟' : 'What Can I Take Next') + '</h3>' +
      (nextCourses.length
        ? '<div class="dash-next-list">' + nextCourses.map(function(c){ return '<div class="dash-next-item"><span>' + nameFor(c.slug) + '</span><span>' + c.cr + 'H</span></div>'; }).join('') + '</div>'
        : '<p class="ex-note">' + (rtl ? 'لا توجد توصيات متاحة الآن.' : 'No recommendations available right now.') + '</p>') +
      '</div>' +
      '<div class="dash-quicklinks">' +
        '<div class="dash-quicklink" onclick="AAUP_AUDIT.open(\'' + prefix + '\')"><span class="dq-icon">📋</span>' + (rtl ? 'التدقيق الأكاديمي وGPA' : 'Degree Audit & GPA') + '</div>' +
        '<div class="dash-quicklink" onclick="AAUP_ACHIEVEMENTS.open(\'' + prefix + '\')"><span class="dq-icon">🏆</span>' + (rtl ? 'الإنجازات' : 'Achievements') + '</div>' +
        '<div class="dash-quicklink" onclick="AAUP_ADVISOR.open(\'' + prefix + '\')"><span class="dq-icon">🧠</span>' + (rtl ? 'خطط لفصلي القادم' : 'Plan My Next Semester') + '</div>' +
        '<div class="dash-quicklink" onclick="AAUP_DASHBOARD.openStudyPlan(\'' + prefix + '\')"><span class="dq-icon">🗺️</span>' + (rtl ? 'خطتي الدراسية الكاملة' : 'My Full Study Plan') + '</div>' +
      '</div>';
    // Backup nudge: only when there IS meaningful progress to lose, and no
    // backup in the last 30 days (or ever). Quiet one-liner, not a popup —
    // losing a semester of tracked progress hurts more than this line does.
    var lastBackup = 0;
    try{ lastBackup = parseInt(localStorage.getItem('aaup_lastBackup') || '0', 10) || 0; }catch(e){}
    var hasProgress = doneCr > 0;
    if(hasProgress && (Date.now() - lastBackup) > 30 * 24 * 60 * 60 * 1000){
      html += '<p class="form-note" style="text-align:center;margin-top:18px;">💾 ' +
        (rtl ? 'نصيحة: صدّر نسخة احتياطية من تقدمك من الإعدادات — بيانات المتصفح قد تُمسح.' :
               'Tip: export a backup of your progress from Settings \u2014 browser data can be wiped.') + '</p>';
    }
    host.innerHTML = html;
  }

  // showPage('home') now means "take me to my personal landing point" —
  // once a plan is selected, that's the Dashboard, not the major-picker.
  // Every existing "🏠 Home" button across every page already calls
  // showPage('home'), so this one interception point covers all of them
  // without editing each one individually.
  var _origShowPage = window.showPage;
  if(typeof _origShowPage === 'function'){
    window.showPage = function(id){
      if(id === 'home'){
        var selected = getSelected();
        if(selected){ open(selected); return; }
      }
      return _origShowPage(id);
    };
  }

  window.AAUP_DASHBOARD = {
    open: open, selectAndOpen: selectAndOpen, openStudyPlan: openStudyPlan,
    choosePlan: choosePlan, getSelected: getSelected,
    planDisplayInfo: planDisplayInfo, isImportedPlan: isImportedPlan,
    // Best-effort completion percentage for the Home "continue" card.
    // Built-in plan pages are always in the DOM (just hidden) so
    // computeStats works directly; an imported plan that hasn't been
    // opened yet has no rendered page, so fall back to its audit rows,
    // and to null if neither can produce a number.
    planPercent: function(prefix){
      try{
        if(!isImportedPlan(prefix) && window.__computeStats){
          var s = window.__computeStats(prefix);
          if(s && s.totalCredits > 0){ return s.pct; }
        }
        if(window.AAUP_AUDIT && window.AAUP_AUDIT.computeAudit){
          var total = 0, done = 0;
          window.AAUP_AUDIT.computeAudit(prefix).forEach(function(r){ total += r.total; done += r.completed; });
          if(total > 0){ return Math.round(done / total * 100); }
        }
      }catch(e){}
      return null;
    }
  };

  function init(){
    // Record every backup's timestamp so the dashboard can nudge people who
    // have real progress but have never exported it — on a phone, the OS
    // can evict site data; the export file is the only true safety net.
    if(window.AAUP_DATA && !window.AAUP_DATA.__backupWrapped){
      var _origExport = window.AAUP_DATA.exportData;
      window.AAUP_DATA.exportData = function(){
        try{ localStorage.setItem('aaup_lastBackup', String(Date.now())); }catch(e){}
        return _origExport.apply(this, arguments);
      };
      window.AAUP_DATA.__backupWrapped = true;
    }
    var selected = getSelected();
    if(selected && document.getElementById('home').style.display !== 'none'){
      // Returning visit with a plan already chosen — skip the picker
      // entirely rather than making them re-select every time.
      open(selected);
    }
  }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
