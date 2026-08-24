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
    // How much the specialization elective pool is actually worth. Three
    // sources, best first:
    //
    //   1. requirementHours.specElec — the university's published figure, on
    //      plans built from a real catalogue plan.
    //   2. DEPT_REQUIRED — the hand-maintained per-plan count.
    //   3. the number of DISTINCT credit-hour values in the pool, a stand-in
    //      for the number of required courses.
    //
    // (3) is the reason this screen and My Path disagreed. It collapses to 1
    // whenever every slot in a pool costs the same, which is the normal case:
    // GIS and Multimedia each draw six 3-hour slots for an 18-hour
    // requirement and were audited as though only 3 hours were owed, 15 hours
    // short of the degree. The comment on DEPT_REQUIRED has always said so;
    // there was simply nothing better to fall back to until now.
    var planReq = (window.__PLAN_DATA[prefix] || {}).requirementHours || {};
    var deptNeededCredits, deptNeededCount;
    if(typeof planReq.specElec === 'number'){
      deptNeededCredits = planReq.specElec;
      deptNeededCount = deptCreditUnit > 0 ? Math.round(deptNeededCredits / deptCreditUnit) : 0;
    } else {
      deptNeededCount = (typeof required === 'number') ? required : Object.keys(deptCrCounts).length;
      deptNeededCredits = deptNeededCount * deptCreditUnit;
    }

    var seenNum = {};
    var catBucket = {};        // display category -> requirement bucket -> hours drawn
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
      // Which requirement bucket this course's hours belong to, kept per
      // category so the published figures can be shared out correctly below.
      // A single display category can feed TWO buckets: supportCourses and
      // colgReq are both drawn in 'math', and nothing about the card says
      // which is which.
      if(meta.req){
        catBucket[cat] = catBucket[cat] || {};
        catBucket[cat][meta.req] = (catBucket[cat][meta.req] || 0) + cr;
      }
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

    // Required, where the university published a figure. This screen groups by
    // the plan's LEGEND categories while My Path groups by the university's
    // requirement buckets, and for the same reason as the dept pool above, the
    // sum of the cards in a group is not what the group is worth: an advisory
    // plan can schedule a course the requirement tables never list, and a plan
    // can be short a slot. Left alone, this screen and My Path printed
    // different degree totals for ten plans - the exact failure this file's
    // dept-pool handling was written to stop, one row over.
    //
    // The split is done from each course's OWN bucket, not from a category ->
    // bucket table. A table cannot work: 'math' carries both colgReq and
    // supportCourses, and scaling that row to colgReq's figure alone dropped
    // supportCourses outright - eight degrees lost 10 to 24 hours.
    if(Object.keys(planReq).length){
      var drawnPerBucket = {};
      Object.keys(catBucket).forEach(function(cat){
        Object.keys(catBucket[cat]).forEach(function(bkt){
          drawnPerBucket[bkt] = (drawnPerBucket[bkt] || 0) + catBucket[cat][bkt];
        });
      });
      CATEGORY_ORDER.forEach(function(cat){
        var mix = catBucket[cat];
        if(cat === 'dept' || !mix) return;      // dept is settled above
        var settled = 0, unsettled = 0, mixTotal = 0;
        Object.keys(mix).forEach(function(bkt){
          mixTotal += mix[bkt];
          if(typeof planReq[bkt] === 'number' && drawnPerBucket[bkt] > 0){
            // This row's share of the bucket's published hours, in proportion
            // to how much of that bucket it draws.
            settled += planReq[bkt] * (mix[bkt] / drawnPerBucket[bkt]);
          } else {
            unsettled += mix[bkt];              // no published figure: count as drawn
          }
        });
        // Courses with no bucket at all. In a plan with published figures these
        // are inside the published total, not on top of it - Bachelor in Law's
        // ADMINISTRATIVE LAW (1) is scheduled in the university's advisory plan
        // for a 136-hour degree while no requirement table claims it. Adding
        // its hours to a settled row made this screen say 142 where My Path
        // said 136. Where the row has no published figure to sit inside, the
        // hours are all there is, so they stay.
        var noBucket = Math.max(0, byCat[cat].total - mixTotal);
        byCat[cat].total = settled > 0 ? settled + unsettled : unsettled + noBucket;
      });
    }

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

  // Phone-only (see .audit-rings in app.css) — the same six rows the table
  // below states in full, as one glanceable ring per category instead of a
  // row you have to read across five columns of. Purely additive: the
  // table underneath still carries every number (Required/Completed/In
  // Progress/Planned/Missing) exactly as before, this is a summary layer
  // on top of it, not a replacement — nothing a student could read before
  // is unreachable now.
  function auditRingsHtml(rows, prefix, rtl){
    var R = 18, C = Math.round(2 * Math.PI * R * 100) / 100;
    return '<div class="audit-rings">' + rows.map(function(r){
      var lbl = labelFor(prefix, r.cat);
      var pct = r.total ? Math.min(1, r.completed / r.total) : 0;
      var offset = Math.round(C * (1 - pct) * 100) / 100;
      return '<div class="audit-ring-card">' +
        '<svg class="audit-mini-ring" viewBox="0 0 44 44">' +
          '<circle class="track" cx="22" cy="22" r="' + R + '"/>' +
          '<circle class="val" cx="22" cy="22" r="' + R + '" style="stroke:var(--' + r.cat + ');" ' +
            'stroke-dasharray="' + C + '" stroke-dashoffset="' + offset + '"/>' +
        '</svg>' +
        '<div class="ar-lbl">' + (rtl ? lbl.ar : lbl.en) + '</div>' +
        '<div class="ar-frac">' + r.completed + '/' + r.total + 'H</div>' +
      '</div>';
    }).join('') + '</div>';
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
    // Six columns of category data don't fit a phone width even with the
    // header text wrapping to two lines — the table used to just spill past
    // the modal's own edge, widening the whole page (and, with it, throwing
    // off the GPA Studio panels' own swipe-snap sizing above, since their
    // 100% width then resolved against that now-too-wide page). Its own
    // scroll container keeps the overflow local to this table.
    return auditRingsHtml(rows, prefix, rtl) + '<div class="audit-table-wrap">' + html + '</div>';
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

  // The audit and What-if are both about one number: where the GPA is, and
  // where it would be. What-if used to be a menu row of its own; it is now
  // this screen's other mode, drawn into the same body by AAUP_WHATIF.mount.
  var mode = 'now';

  function modeBarHtml(rtl){
    if(!window.AAUP_WHATIF || !window.AAUP_WHATIF.mount) return '';
    var tabs = [
      ['now', rtl ? 'وين أنا' : 'Where I am'],
      ['whatif', rtl ? 'ماذا لو…' : 'What if…']
    ];
    return '<div class="au-modes" role="group">' + tabs.map(function(pair){
      var on = mode === pair[0];
      return '<button type="button" class="au-mode' + (on ? ' au-mode-on' : '') +
        '" data-au-mode="' + pair[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        window.__escapeHtml(pair[1]) + '</button>';
    }).join('') + '</div>';
  }

  function open(prefix, startMode){
    var body = document.getElementById('auditModalBody');
    var overlay = document.getElementById('auditModalOverlay');
    if(!body || !overlay) return;
    if(startMode === 'now' || startMode === 'whatif'){ mode = startMode; }
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    // The sentence that used to sit here explained which screen set a grade
    // and which screen edited one. It was true, and it only had to exist
    // because the two screens did different things: the course popup was the
    // only place a FIRST grade could be entered, and the table below only
    // edited grades that already existed. They do the same thing now
    // (js/51-gpa-studio.js lists every finished course, graded or not), so
    // there is nothing left to explain and the table's own cells are the
    // answer.
    var anyGrades = !window.AAUP_GPA_STUDIO || !window.AAUP_GPA_STUDIO.hasGrades ||
                    window.AAUP_GPA_STUDIO.hasGrades(prefix);

    // The dial-and-table layout (js/51-gpa-studio.js) replaces the old flat
    // row of three cards outright rather than sitting next to it — showing
    // the cumulative number twice, in two different-looking widgets on the
    // same screen, is not what was approved and reads as unfinished. If
    // that module is missing for any reason, the original three-card
    // summary is the fallback, not a blank space.
    var head = '<h2 class="mh" style="margin-top:0;">' + window.AAUP_ICONS.preview('clipboard', 20) +
      (rtl ? 'التدقيق الأكاديمي والمعدل' : 'Degree Audit &amp; GPA') + '</h2>' + modeBarHtml(rtl);

    if(mode === 'whatif'){
      body.innerHTML = head + '<div id="auditWhatIfBody"></div>';
      overlay.classList.add('open');
      bindModes(prefix);
      window.AAUP_WHATIF.mount(prefix, 'auditWhatIfBody');
      return;
    }

    body.innerHTML = head +
      (window.AAUP_GPA_STUDIO ? window.AAUP_GPA_STUDIO.layout(prefix, rtl) : renderGpaDashboard(prefix, rtl)) +
      // "What do I need to reach…" needs a current GPA to answer from. With
      // none it printed its heading over the words "No grades yet." — a
      // second empty state stacked on the one right above it.
      (window.AAUP_GPA_TARGET && anyGrades
        ? '<div class="gt-section"><h3 style="margin-bottom:6px;">' + window.AAUP_GPA_TARGET.title(rtl) + '</h3>' +
          '<div id="auditGpaTargetBody"></div></div>'
        : '') +
      renderSemesterGpas(prefix, rtl) +
      renderAuditTable(prefix, rtl);
    overlay.classList.add('open');
    bindModes(prefix);
    if(window.AAUP_GPA_STUDIO) window.AAUP_GPA_STUDIO.bind(prefix, rtl);
    if(window.AAUP_GPA_TARGET && document.getElementById('auditGpaTargetBody')){
      window.AAUP_GPA_TARGET.render(prefix, 'auditGpaTargetBody', rtl);
    }
  }

  function bindModes(prefix){
    var body = document.getElementById('auditModalBody');
    if(!body) return;
    body.querySelectorAll('[data-au-mode]').forEach(function(b){
      b.addEventListener('click', function(){
        var m = b.getAttribute('data-au-mode');
        if(m === mode) return;
        mode = m;
        open(prefix);
      });
    });
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
