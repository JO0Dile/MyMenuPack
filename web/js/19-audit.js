// ==========================
// DEGREE AUDIT
// ==========================
(function(){
  var CATEGORY_FALLBACK = {
    skills: { en: 'University Req.', ar: 'متطلب جامعي' },
    core:   { en: 'Specialization Req.', ar: 'متطلب تخصص' },
    math:   { en: 'College Req.', ar: 'متطلب كلية' },
    dept:   { en: 'Specialization Elec.', ar: 'اختياري تخصص' },
    eng:    { en: 'University Req.', ar: 'متطلب جامعي' },
    uni:    { en: 'University Elec.', ar: 'اختياري جامعي' },
    free:   { en: 'Free Elec.', ar: 'اختياري حر' }
  };
  var CATEGORY_ORDER = ['skills','core','math','dept','eng','uni','free'];

  // cs's own legend calls the dept category "Specialized elective" instead
  // of "Department elective" — read whatever label this plan's legend
  // already uses instead of hardcoding one label for every plan.
  function labelFor(prefix, cat){
    var chip = document.querySelector('#' + prefix + '-legend .item .chip.' + cat);
    var span = chip && chip.parentElement.querySelector('.i18n');
    if(span && span.dataset){
      return { en: span.dataset.en || span.textContent.trim(), ar: span.dataset.ar || CATEGORY_FALLBACK[cat].ar };
    }
    return CATEGORY_FALLBACK[cat];
  }

  function computeAudit(prefix){
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var progress = window.__getProgress ? window.__getProgress() : {};
    var statuses = window.AAUP_GPA.loadStatuses();
    var grades = window.AAUP_GPA.loadGrades();
    var required = window.__DEPT_REQUIRED ? window.__DEPT_REQUIRED[prefix] : null;
    var page = document.getElementById('page-' + prefix);
    var courses = page ? Array.prototype.slice.call(page.querySelectorAll('.course[id]:not(.course-removed)')) : [];

    var byCat = {};
    CATEGORY_ORDER.forEach(function(c){ byCat[c] = { total: 0, completed: 0, inProgress: 0, planned: 0 }; });

    // Elective credit unit + pool size, same derivation as the My Progress panel.
    var deptCrCounts = {};
    courses.forEach(function(el){
      if(!el.classList.contains('dept')) return;
      var parts = window.__splitCourseId(el.id);
      var meta = parts && info[parts.slug];
      if(!meta) return;
      if(window.__isSupersededByRetake && parts && window.__isSupersededByRetake(prefix, parts.slug)) return;
      var cr0 = parseFloat(meta.cr) || 0;
      deptCrCounts[cr0] = (deptCrCounts[cr0] || 0) + 1;
    });
    var deptCreditUnit = 3, bestCount = 0;
    Object.keys(deptCrCounts).forEach(function(k){
      if(deptCrCounts[k] > bestCount){ bestCount = deptCrCounts[k]; deptCreditUnit = parseFloat(k); }
    });
    var deptNeededCount = (typeof required === 'number') ? required : Object.keys(deptCrCounts).length;
    var deptNeededCredits = deptNeededCount * deptCreditUnit;

    var seenNum = {};
    courses.forEach(function(el){
      if(el.classList.contains('dept')) return; // dept handled as a pool, below
      var parts = window.__splitCourseId(el.id);
      if(!parts) return;
      if(window.__isSupersededByRetake && window.__isSupersededByRetake(prefix, parts.slug)) return;
      var meta = info[parts.slug];
      if(!meta) return;
      var pid = window.AAUP_GPA.primaryId(prefix, parts.slug);
      if(pid !== el.id) return;
      // Same "-" placeholder caveat as elsewhere: never dedupe generic
      // elective slots on it, only on their own unique slug.
      var dedupeKey = (meta.num && meta.num !== '-') ? meta.num : parts.slug;
      if(seenNum[dedupeKey]) return;
      seenNum[dedupeKey] = true;

      var cat = null;
      for(var i = 0; i < CATEGORY_ORDER.length; i++){
        if(el.classList.contains(CATEGORY_ORDER[i])){ cat = CATEGORY_ORDER[i]; break; }
      }
      if(!cat) return;

      var cr = parseFloat(meta.cr) || 0;
      // Checked "done" tracks whether it was taken — an F grade means it
      // wasn't passed, so it shouldn't count as a satisfied requirement
      // even if the box is ticked.
      var isDone = !!progress[pid] && !window.AAUP_GPA.isNonPassing(grades[pid]);
      var status = statuses[pid];

      byCat[cat].total += cr;
      if(isDone){ byCat[cat].completed += cr; }
      else if(status === 'in_progress'){ byCat[cat].inProgress += cr; }
      else if(status === 'planned'){ byCat[cat].planned += cr; }
    });

    // Dept/elective pool: Required is the target hours (not the whole pool
    // on offer), Completed is capped at that target — same math as the My
    // Progress panel's elective section.
    var deptCompletedCount = 0, deptCompletedCredits = 0;
    courses.forEach(function(el){
      if(!el.classList.contains('dept') || !progress[el.id]) return;
      var parts = window.__splitCourseId(el.id);
      var meta = parts && info[parts.slug];
      if(!meta) return;
      if(window.__isSupersededByRetake && parts && window.__isSupersededByRetake(prefix, parts.slug)) return;
      var pidHere = window.AAUP_GPA.primaryId(prefix, parts.slug);
      if(window.AAUP_GPA.isNonPassing(grades[pidHere])) return; // F/FA/W — taken but not passed, doesn't satisfy the requirement
      deptCompletedCount++;
      deptCompletedCredits += parseFloat(meta.cr) || 0;
    });
    var deptStillNeeded = Math.max(0, deptNeededCount - Math.min(deptCompletedCount, deptNeededCount));
    var deptInProgCount = 0, deptPlannedCount = 0;
    courses.forEach(function(el){
      if(!el.classList.contains('dept') || !!progress[el.id]) return;
      if(deptInProgCount + deptPlannedCount >= deptStillNeeded) return;
      var partsHere = window.__splitCourseId(el.id);
      if(window.__isSupersededByRetake && partsHere && window.__isSupersededByRetake(prefix, partsHere.slug)) return;
      var status = statuses[el.id];
      if(status === 'in_progress'){ deptInProgCount++; }
      else if(status === 'planned'){ deptPlannedCount++; }
    });
    byCat.dept = {
      total: deptNeededCredits,
      completed: Math.min(deptCompletedCredits, deptNeededCredits),
      inProgress: deptInProgCount * deptCreditUnit,
      planned: deptPlannedCount * deptCreditUnit
    };

    // Missing = whatever's left once Completed/In-Progress/Planned are taken
    // out of Required, in that priority order — guarantees every row sums
    // exactly back to Required, with no negative or over-counted cells.
    return CATEGORY_ORDER.map(function(cat){
      var r = byCat[cat];
      var completed = Math.min(r.completed, r.total);
      var inProgress = Math.min(r.inProgress, Math.max(0, r.total - completed));
      var planned = Math.min(r.planned, Math.max(0, r.total - completed - inProgress));
      var missing = Math.max(0, r.total - completed - inProgress - planned);
      return { cat: cat, total: r.total, completed: completed, inProgress: inProgress, planned: planned, missing: missing };
    }).filter(function(r){ return r.total > 0; });
  }

  function renderAuditTable(prefix, rtl){
    var rows = computeAudit(prefix);
    var totalReq = 0, totalC = 0, totalIP = 0, totalP = 0, totalM = 0;
    var thead = rtl
      ? ['الفئة', 'المطلوب', 'مكتمل', 'قيد الإنجاز', 'القادم', 'ناقص']
      : ['Category', 'Required', 'Completed', 'In Progress', 'Planned Next', 'Missing'];
    var html = '<table class="audit-table' + (rtl ? ' rtl' : '') + '"><thead><tr>' +
      thead.map(function(h){ return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function(r){
      var lbl = labelFor(prefix, r.cat);
      totalReq += r.total; totalC += r.completed; totalIP += r.inProgress; totalP += r.planned; totalM += r.missing;
      html += '<tr>' +
        '<td class="cat-name"><span class="audit-cat-dot" style="background:var(--' + r.cat + ')"></span>' + (rtl ? lbl.ar : lbl.en) + '</td>' +
        '<td>' + r.total + 'H</td>' +
        '<td class="col-completed' + (r.completed ? '' : ' zero') + '">' + r.completed + 'H</td>' +
        '<td class="col-inprogress' + (r.inProgress ? '' : ' zero') + '">' + r.inProgress + 'H</td>' +
        '<td class="col-planned' + (r.planned ? '' : ' zero') + '">' + r.planned + 'H</td>' +
        '<td class="col-missing' + (r.missing ? '' : ' zero') + '">' + r.missing + 'H</td>' +
        '</tr>';
    });
    html += '</tbody><tfoot><tr style="font-weight:800;">' +
      '<td>' + (rtl ? 'الإجمالي' : 'Total') + '</td><td>' + totalReq + 'H</td>' +
      '<td class="col-completed">' + totalC + 'H</td><td class="col-inprogress">' + totalIP + 'H</td>' +
      '<td class="col-planned">' + totalP + 'H</td><td class="col-missing">' + totalM + 'H</td>' +
      '</tr></tfoot></table>';
    return html;
  }

  function renderGpaDashboard(prefix, rtl){
    var cum = window.AAUP_GPA.gpaFor(prefix, null);
    var major = window.AAUP_GPA.gpaFor(prefix, function(el){
      return el.classList.contains('core') || el.classList.contains('dept');
    });
    var standing = window.AAUP_GPA.standingFor(cum.gpa);
    var fmt = function(g){ return g === null ? '—' : g.toFixed(2); };
    return '<div class="gpa-dashboard">' +
      '<div class="gpa-card"><div class="gc-num">' + fmt(cum.gpa) + '</div><div class="gc-label">' + (rtl ? 'المعدل التراكمي' : 'Cumulative GPA') + '</div></div>' +
      '<div class="gpa-card"><div class="gc-num">' + fmt(major.gpa) + '</div><div class="gc-label">' + (rtl ? 'معدل التخصص' : 'Major GPA') + '</div></div>' +
      '<div class="gpa-card"><div class="gc-num" style="font-size:14px;padding-top:3px;">' +
        '<span class="standing-badge ' + standing.cls + '">' + (rtl ? standing.ar : standing.label) + '</span></div>' +
        '<div class="gc-label">' + (rtl ? 'الوضع الأكاديمي' : 'Academic Standing') + '</div></div>' +
      '</div>';
  }

  function open(prefix){
    var body = document.getElementById('auditModalBody');
    var overlay = document.getElementById('auditModalOverlay');
    if(!body || !overlay) return;
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    // Planning status (in progress / planned) and a course's FIRST grade
    // still only come from that course's own info popup -- marking something
    // done and picking its assessment marks is a bigger action than belongs
    // in a summary table. Once a grade exists, though, js/51-gpa-studio.js
    // gives a second place to correct it, writing the exact same stored
    // value -- so the sentence below only claims what is still actually true.
    var studioNote = window.AAUP_GPA_STUDIO
      ? (rtl
          ? 'حالة التخطيط والعلامة الأولى تُحدَّدان من نافذة كل مساق؛ يمكنك تعديل العلامات المُدخلة من الجدول أدناه مباشرة.'
          : 'Planning status and a course\u2019s first grade are set from that course\u2019s own info popup; grades already entered can be edited directly below.')
      : (rtl
          ? 'العلامات وحالة التخطيط (قيد الإنجاز / مخطط له) تُحدَّد من نافذة كل مساق.'
          : 'Grades and planning status (in progress / planned) are set from each course\u2019s own info popup.');

    // The dial-and-table layout (js/51-gpa-studio.js) replaces the old flat
    // row of three cards outright rather than sitting next to it — showing
    // the cumulative number twice, in two different-looking widgets on the
    // same screen, is not what was approved and reads as unfinished. If
    // that module is missing for any reason, the original three-card
    // summary is the fallback, not a blank space.
    body.innerHTML =
      '<h2 style="margin-top:0;">📋 ' + (rtl ? 'التدقيق الأكاديمي والمعدل' : 'Degree Audit &amp; GPA') + '</h2>' +
      '<p style="font-size:12px;color:var(--text-dim);margin-top:-8px;">' + studioNote + '</p>' +
      (window.AAUP_GPA_STUDIO ? window.AAUP_GPA_STUDIO.layout(prefix, rtl) : renderGpaDashboard(prefix, rtl)) +
      (window.AAUP_GPA_TARGET
        ? '<div class="gt-section"><h3 style="margin-bottom:6px;">' + window.AAUP_GPA_TARGET.title(rtl) + '</h3>' +
          '<div id="auditGpaTargetBody"></div></div>'
        : '') +
      renderSemesterGpas(prefix, rtl) +
      renderAuditTable(prefix, rtl);
    overlay.classList.add('open');
    if(window.AAUP_GPA_STUDIO) window.AAUP_GPA_STUDIO.bind(prefix, rtl);
    if(window.AAUP_GPA_TARGET) window.AAUP_GPA_TARGET.render(prefix, 'auditGpaTargetBody', rtl);
  }

  // Mirrors a real transcript's structure: each semester's own GPA (which
  // keeps every attempt made that semester, including F's later retaken),
  // alongside the cumulative above (which excludes replaced attempts).
  function renderSemesterGpas(prefix, rtl){
    if(!window.AAUP_GPA.semesterGpas) return '';
    var sems = window.AAUP_GPA.semesterGpas(prefix);
    if(!sems.length) return '';
    var rows = sems.map(function(s){
      return '<div class="dash-next-item"><span>' + (rtl ? s.ar : s.label) + '</span>' +
        '<span><b>' + s.gpa.toFixed(2) + '</b> <span style="opacity:.6;">(' + s.credits + 'H)</span></span></div>';
    }).join('');
    return '<h3 style="margin-bottom:6px;">' + (rtl ? 'معدل كل فصل' : 'GPA by Semester') + '</h3>' +
      '<p class="form-note" style="margin-top:0;">' +
      (rtl
        ? 'معدل الفصل يشمل كل المحاولات في ذلك الفصل (تبقى علامة F في فصلها). المعدل التراكمي أعلاه يستبدل علامة المساق المعاد بعلامة الإعادة.'
        : 'A semester\u2019s GPA keeps every attempt made that semester (an F stays in its semester). The cumulative above replaces a repeated course\u2019s old grade with the retake\u2019s grade \u2014 that\u2019s why a cumulative can be higher than every individual semester.') +
      '</p>' +
      '<div class="dash-next-list" style="margin-bottom:16px;">' + rows + '</div>';
  }

  function bind(){
    var overlay = document.getElementById('auditModalOverlay');
    var closeBtn = document.getElementById('auditModalClose');
    if(!overlay) return;
    var close = function(){ overlay.classList.remove('open'); };
    if(closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    var card = overlay.querySelector('.modal-card');
    if(card) card.addEventListener('click', function(e){ e.stopPropagation(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
  }
  if(document.readyState === 'complete'){ bind(); }
  else { window.addEventListener('load', bind); }

  window.AAUP_AUDIT = { open: open, computeAudit: computeAudit, labelFor: labelFor };
})();
