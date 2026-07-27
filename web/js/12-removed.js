// ==========================
// REMOVED COURSES — a student can drop a course out of their own plan when
// it doesn't apply to them (tested out of Intermediate English, placed
// straight into Advanced, etc.). Removed courses are hidden from the grid
// and, via the .course[id]:not(.course-removed) selector used everywhere,
// excluded from every credit-hour total, requirement count, availability
// check and achievement — as if they were never part of the plan.
// ==========================
(function(){
  var KEY = 'aaup_removedCourses';
  function load(){ return window.AAUP_STORAGE.getJSON(KEY, {}); }
  function save(m){ window.AAUP_STORAGE.setJSON(KEY, m); }
  function keyFor(prefix, slug){
    return window.AAUP_GPA ? window.AAUP_GPA.primaryId(prefix, slug) : (prefix + '-c-' + slug);
  }
  function isRemoved(prefix, slug){ return !!load()[keyFor(prefix, slug)]; }

  // Paint the removed set onto a plan's cards. Uses a plain .course[id]
  // selector (NOT the :not(.course-removed) one) so it can also find and
  // UN-hide a card when restoring. A lecture and its lab share one primary
  // id, so both halves hide/show together.
  function apply(prefix){
    var page = document.getElementById('page-' + prefix);
    if(!page) return;
    var removed = load();
    page.querySelectorAll('.course[id]').forEach(function(el){
      var parts = window.__splitCourseId ? window.__splitCourseId(el.id) : null;
      if(!parts){ return; }
      var pid = keyFor(prefix, parts.slug);
      el.classList.toggle('course-removed', !!removed[pid]);
    });
    // A pair-group (course + lab, dashed box) that just lost a member to
    // removal shouldn't keep showing an empty or half-empty box. Recompute
    // every wrapper's state from how many of its courses are still visible.
    page.querySelectorAll('.pair-group').forEach(function(group){
      var visible = group.querySelectorAll('.course[id]:not(.course-removed)').length;
      group.classList.toggle('pg-empty', visible === 0);
      group.classList.toggle('pg-single', visible === 1);
    });
  }

  function setRemoved(prefix, slug, removed){
    var pid = keyFor(prefix, slug);
    var m = load();
    if(removed){ m[pid] = true; } else { delete m[pid]; }
    save(m);
    apply(prefix);
    if(window.__refreshPlanUI){ window.__refreshPlanUI(prefix); }
    // Removing/restoring a course changes the grid layout (the card
    // disappears, its pair-group wrapper collapses to pg-empty/pg-single)
    // but the prerequisite connector lines are absolute-positioned SVG
    // paths computed once at draw time and never redrawn on their own —
    // left alone they go stale and point at wherever the old layout used
    // to be. Same redraw hook "Collapse finished years" already uses when
    // it changes the layout the same way.
    var isImportedPlan = window.AAUP_DASHBOARD && window.AAUP_DASHBOARD.isImportedPlan && window.AAUP_DASHBOARD.isImportedPlan(prefix);
    if(isImportedPlan && window.AAUP_IMPORTED && window.AAUP_IMPORTED.refresh){ window.AAUP_IMPORTED.refresh(prefix); }
    else if(window.__redraw && window.__redraw[prefix]){ window.__redraw[prefix](); }
  }

  window.__applyRemovedCourses = apply;
  window.AAUP_REMOVED = { isRemoved: isRemoved, setRemoved: setRemoved, apply: apply };
})();
