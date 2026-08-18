// ==========================
// MILESTONES ON THE PROGRESS BAR — the same bar every plan already has at
// the top of the Study Plan, with two things added: tick marks at the
// hour-counts where a real requirement closes out, and a line underneath
// naming the nearest one.
//
// A "gate" here is not invented — it is read straight from the Degree
// Audit's own category totals (js/19-audit.js), so a tick can never point
// at a number the Audit table itself would disagree with. The nearest gate
// is whichever category has the fewest hours left before it is fully
// satisfied; the count of courses named in the caption is a light estimate
// (how many of that category's courses are still not done), not a claim
// about exactly which ones you must take.
// ==========================
(function(){
  'use strict';

  // Every category with hours still left, positioned at the cumulative CH
  // where it would close out — same "total credits already counted, plus
  // this category's own remainder" math the Audit table's own totals use.
  function gatesFor(prefix){
    if(!window.AAUP_AUDIT || !window.AAUP_GPA) return null;
    var rows = window.AAUP_AUDIT.computeAudit(prefix);
    if(!rows.length) return null;
    var doneCrOverall = 0, totalCrOverall = 0;
    rows.forEach(function(r){ doneCrOverall += r.completed; totalCrOverall += r.total; });
    if(!totalCrOverall) return null;

    var page = document.getElementById('page-' + prefix);
    var progress = window.__getProgress ? window.__getProgress() : {};
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};

    var gates = rows.map(function(r){
      var remaining = r.total - r.completed;
      if(remaining <= 0.01) return null;
      var seen = {}, n = 0;
      if(page){
        page.querySelectorAll('.course.' + r.cat + '[id]:not(.course-removed)').forEach(function(el){
          var parts = window.__splitCourseId(el.id);
          var meta = parts && info[parts.slug];
          if(!meta) return;
          var pid = window.AAUP_GPA.primaryId(prefix, parts.slug);
          if(pid !== el.id) return;
          var key = (meta.num && meta.num !== '-') ? meta.num : parts.slug;
          if(seen[key]) return;
          seen[key] = true;
          if(!progress[pid]) n++;
        });
      }
      return { cat: r.cat, atHours: doneCrOverall + remaining, remaining: remaining, courseCount: n };
    }).filter(Boolean).sort(function(a, b){ return a.atHours - b.atHours; });

    return { gates: gates, totalCr: totalCrOverall, doneCr: doneCrOverall };
  }

  function refresh(prefix){
    var page = document.getElementById('page-' + prefix);
    if(!page) return;
    var track = page.querySelector('.progress-widget .pw-track');
    var widget = page.querySelector('.progress-widget');
    if(!track || !widget) return;

    var rtl = page.classList.contains('rtl-mode');
    var data = gatesFor(prefix);

    // Clear any previous pass's ticks/caption before redrawing — refresh()
    // runs after every toggle, and stale ticks left over from a smaller
    // remaining-hours figure would sit at the wrong percentage.
    track.querySelectorAll(':scope > .pw-gate').forEach(function(el){ el.remove(); });
    var oldCaption = widget.querySelector(':scope > .pw-gate-caption');
    if(oldCaption) oldCaption.remove();

    if(!data || !data.gates.length) return;   // nothing left to gate on — fully audited

    // Up to two nearest gates get a tick; the nearest one also gets the
    // caption line, matching what the mockup showed.
    data.gates.slice(0, 2).forEach(function(gate, idx){
      var pct = Math.max(0, Math.min(100, (gate.atHours / data.totalCr) * 100));
      var tick = document.createElement('span');
      tick.className = 'pw-gate' + (idx === 0 ? ' pw-gate-next' : '');
      tick.style.insetInlineStart = pct.toFixed(2) + '%';
      track.appendChild(tick);
    });

    var nearest = data.gates[0];
    var label = window.AAUP_AUDIT.labelFor(prefix, nearest.cat);
    var catTxt = label ? (rtl ? label.ar : label.en) : nearest.cat;
    var courseTxt = nearest.courseCount === 1
      ? (rtl ? 'مساق واحد تقريبًا' : 'about one course')
      : (rtl ? (nearest.courseCount + ' مساقات تقريبًا') : (nearest.courseCount + ' courses, roughly'));
    var hrs = Math.round(nearest.remaining * 10) / 10;
    var caption = document.createElement('p');
    caption.className = 'pw-gate-caption';
    caption.textContent = rtl
      ? (hrs + ' ساعة حتى إغلاق «' + catTxt + '» — ' + courseTxt + '.')
      : (hrs + 'H to close out ' + catTxt + ' — that is ' + courseTxt + '.');
    widget.appendChild(caption);
  }

  window.__refreshMilestones = refresh;
})();
