// ==========================
// GPA STUDIO
// ==========================
// Adds an editable grade table and a reach-your-target projection to the
// Degree Audit modal (js/19-audit.js), between the three summary cards it
// already draws and the semester-by-semester breakdown below them.
//
// Before this, the modal said outright that grades are set from each
// course's own info popup — correct, but it meant checking your GPA and
// fixing a misremembered grade were two different screens. Every number
// here comes from window.AAUP_GPA, the same module and the same
// localStorage map the course popup already writes to
// (loadGrades/saveGrades) — this is a second place to edit the one stored
// value, not a second copy of it. Changing a grade here and changing it
// from the course popup can never disagree, because there is only one
// place the grade actually lives.
//
// Two things are deliberately NOT here, because they cannot be answered
// honestly with data the app has:
//   - a per-course GPA-effect figure for a course that has not been taken
//     yet (js/49-course-detail.js and js/50-whats-next.js skip this for
//     the same reason)
//   - grading a course that is only "in progress" — the app does not let
//     a course carry a grade until it is marked done, and this does not
//     invent an exception to that rule.
// The one forward-looking number this DOES offer — what average you would
// need across your remaining hours to reach a target — is real algebra
// over real totals (window.AAUP_AUDIT's own required-hours figure and
// window.AAUP_GPA's own credits-and-points), not a guess.
(function(){
  'use strict';

  function esc(s){ return window.__escapeHtml(s == null ? '' : String(s)); }

  var T = {
    en: {
      title: 'Your grades', hint: 'Change any grade below and the cards above update immediately.',
      term: 'Term', course: 'Course', ch: 'CH', grade: 'Grade', pts: 'Points',
      excluded: 'excluded — retaken', none: 'Not counted',
      empty: 'No graded courses yet. Grades are entered from each course’s own info popup once it is marked done.',
      project: 'Reach a target GPA', projectHint: 'Uses your real credit hours and this plan’s required total — not a guess.',
      target: 'Target cumulative GPA', remaining: 'Credit hours remaining',
      need: function(grade, n){ return 'Average at least ' + grade + ' across the remaining ' + n + ' CH.'; },
      already: 'Already on track — even a weak average the rest of the way keeps you above this target.',
      unreachable: 'Not reachable by averaging a single letter grade across the remaining hours.',
      done: 'Nothing left — this plan’s credit hours are already accounted for.'
    },
    ar: {
      title: 'علاماتك', hint: 'غيّر أي علامة أدناه وستتحدث البطاقات أعلاه فوراً.',
      term: 'الفصل', course: 'المساق', ch: 'س.م', grade: 'العلامة', pts: 'النقاط',
      excluded: 'مستبعدة — أُعيد أخذه', none: 'غير محتسبة',
      empty: 'لا توجد علامات بعد. تُدخَل العلامات من نافذة معلومات كل مساق بعد إنجازه.',
      project: 'الوصول إلى معدل مستهدف', projectHint: 'يعتمد على ساعاتك الفعلية وإجمالي هذه الخطة — وليس تخميناً.',
      target: 'المعدل التراكمي المستهدف', remaining: 'الساعات المتبقية',
      need: function(grade, n){ return 'حافظ على معدل ' + grade + ' على الأقل خلال الساعات المتبقية (' + n + ' س.م).'; },
      already: 'أنت على المسار الصحيح بالفعل — حتى بمعدل ضعيف فيما تبقى ستبقى فوق هذا الهدف.',
      unreachable: 'غير قابل للتحقيق بمعدل علامة واحدة عبر الساعات المتبقية.',
      done: 'لم يتبق شيء — ساعات هذه الخطة مكتملة العدد بالفعل.'
    }
  };

  // Same population gpaFor() counts (graded, passing-or-F, primary half of a
  // pair, retake-aware), but per row instead of summed — grouped by the same
  // .course-row year/semester regex js/18-gpa.js's semesterGpas() uses, so a
  // term label here can never disagree with the one in the panel below it.
  function gradedRows(prefix){
    var page = document.getElementById('page-' + prefix);
    if(!page) return [];
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var progress = window.__getProgress ? window.__getProgress() : {};
    var grades = window.AAUP_GPA.loadGrades();
    var rows = [], seenNum = {};

    Array.prototype.slice.call(page.querySelectorAll('.course-row[id]')).forEach(function(row){
      var m = /-y(\d+)-s(\d+)$/.exec(row.id);
      var term = m ? ('Y' + m[1] + ' · ' + (m[2] === '3' ? 'Summer' : 'S' + m[2])) : '';
      row.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
        var parts = window.__splitCourseId(el.id);
        if(!parts) return;
        var meta = info[parts.slug];
        if(!meta) return;
        var pid = window.AAUP_GPA.primaryId(prefix, parts.slug);
        if(pid !== el.id) return;
        var dedupeKey = (meta.num && meta.num !== '-') ? meta.num : parts.slug;
        if(seenNum[dedupeKey]) return;
        seenNum[dedupeKey] = true;
        if(!progress[pid]) return;
        var g = grades[pid];
        if(g == null) return; // never graded — not "0 grade", just not entered yet

        var excluded = false;
        if(window.__isSupersededByRetake && window.__isSupersededByRetake(prefix, parts.slug)){
          var retakeSlug = window.AAUP_RETAKES ? window.AAUP_RETAKES.retakeSlugFor(prefix, parts.slug) : null;
          var retakeGrade = retakeSlug ? grades[prefix + '-c-' + retakeSlug] : null;
          excluded = !!(retakeGrade && (retakeGrade in window.AAUP_GPA.GRADE_POINTS));
        }
        rows.push({
          pid: pid, name: meta.name, nameAr: meta.ar, code: meta.num,
          cr: parseFloat(meta.cr) || 0, grade: g, term: term, excluded: excluded
        });
      });
    });
    return rows;
  }

  function pointsCell(row, t){
    if(row.excluded) return '<span class="gs-excluded">' + t.excluded + '</span>';
    if(!(row.grade in window.AAUP_GPA.GRADE_POINTS)) return '<span class="gs-excluded">' + t.none + '</span>';
    return (window.AAUP_GPA.GRADE_POINTS[row.grade] * row.cr).toFixed(2);
  }

  function tableHTML(prefix, rtl){
    var t = T[rtl ? 'ar' : 'en'];
    var rows = gradedRows(prefix);
    if(!rows.length){
      return '<div class="gs-block"><div class="gs-lbl">' + t.title + '</div><p class="gs-empty">' + t.empty + '</p></div>';
    }
    var optsFor = function(current){
      return '<option value="">—</option>' + window.AAUP_GPA.GRADE_ORDER.map(function(g){
        return '<option value="' + g + '"' + (g === current ? ' selected' : '') + '>' +
          esc(window.AAUP_GPA.gradeLabel(g)) + '</option>';
      }).join('');
    };
    var body = rows.map(function(r){
      var name = rtl && r.nameAr ? r.nameAr : r.name;
      return '<tr class="' + (r.excluded ? 'gs-row-excluded' : '') + '">' +
        '<td class="gs-term">' + esc(r.term) + '</td>' +
        '<td><strong>' + esc(name) + '</strong><br><span class="gs-code">' + esc(r.code) + '</span></td>' +
        '<td>' + r.cr + '</td>' +
        '<td><select class="gs-grade-select" data-pid="' + esc(r.pid) + '">' + optsFor(r.grade) + '</select></td>' +
        '<td class="gs-pts">' + pointsCell(r, t) + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="gs-block">' +
      '<div class="gs-lbl">' + t.title + '</div>' +
      '<p class="gs-hint">' + t.hint + '</p>' +
      '<div class="gs-table-wrap"><table class="gs-table"><thead><tr>' +
        '<th>' + t.term + '</th><th>' + t.course + '</th><th>' + t.ch + '</th><th>' + t.grade + '</th><th>' + t.pts + '</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  // The one forward-looking figure this offers: real algebra over real
  // totals, not an estimate of anything unknowable. remaining = this plan's
  // whole required credit hours (window.AAUP_AUDIT's own figure) minus the
  // hours already graded (window.AAUP_GPA's own figure) — two numbers the
  // rest of the app already trusts, just subtracted.
  function projectionHTML(prefix, rtl){
    var t = T[rtl ? 'ar' : 'en'];
    if(!window.AAUP_AUDIT || !window.AAUP_AUDIT.computeAudit) return '';
    var cum = window.AAUP_GPA.gpaFor(prefix, null);
    var totalReq = window.AAUP_AUDIT.computeAudit(prefix)
      .reduce(function(sum, r){ return sum + r.total; }, 0);
    var remaining = Math.max(0, Math.round((totalReq - (cum.credits || 0)) * 100) / 100);

    return '<div class="gs-block gs-project">' +
      '<div class="gs-lbl">' + t.project + '</div>' +
      '<p class="gs-hint">' + t.projectHint + '</p>' +
      '<div class="gs-project-row">' +
        '<div class="form-field" style="margin:0;flex:1 1 160px;"><label for="gsTarget">' + t.target + '</label>' +
          '<input type="number" id="gsTarget" min="0" max="4" step="0.01" placeholder="3.50"></div>' +
        '<div class="gs-remaining"><span>' + t.remaining + '</span><b>' + remaining + '</b></div>' +
      '</div>' +
      '<p class="gs-project-result" id="gsProjectResult" data-cum-gpa="' + (cum.gpa == null ? '' : cum.gpa) + '" ' +
        'data-cum-credits="' + (cum.credits || 0) + '" data-remaining="' + remaining + '"></p>' +
      '</div>';
  }

  function nearestGradeAtLeast(points){
    var order = window.AAUP_GPA.GRADE_ORDER.filter(function(g){ return g in window.AAUP_GPA.GRADE_POINTS; });
    var best = null;
    order.forEach(function(g){
      var p = window.AAUP_GPA.GRADE_POINTS[g];
      if(p >= points && (best === null || p < window.AAUP_GPA.GRADE_POINTS[best])) best = g;
    });
    return best;
  }

  function bindProjection(rtl){
    var t = T[rtl ? 'ar' : 'en'];
    var input = document.getElementById('gsTarget');
    var out = document.getElementById('gsProjectResult');
    if(!input || !out) return;
    var run = function(){
      var target = parseFloat(input.value);
      var remaining = parseFloat(out.getAttribute('data-remaining')) || 0;
      var curGpaStr = out.getAttribute('data-cum-gpa');
      var curGpa = curGpaStr === '' ? null : parseFloat(curGpaStr);
      var curCredits = parseFloat(out.getAttribute('data-cum-credits')) || 0;
      if(isNaN(target) || input.value === ''){ out.textContent = ''; return; }
      if(remaining <= 0){ out.textContent = t.done; return; }
      var curPoints = curGpa == null ? 0 : curGpa * curCredits;
      var neededPoints = target * (curCredits + remaining) - curPoints;
      var neededAvg = neededPoints / remaining;
      if(neededAvg <= 0){ out.textContent = t.already; return; }
      var grade = nearestGradeAtLeast(neededAvg);
      out.textContent = grade
        ? t.need(window.AAUP_GPA.gradeLabel(grade), remaining)
        : t.unreachable;
    };
    input.addEventListener('input', run);
  }

  function bindTable(prefix){
    document.querySelectorAll('.gs-grade-select').forEach(function(sel){
      sel.addEventListener('change', function(){
        var pid = sel.getAttribute('data-pid');
        var grades = window.AAUP_GPA.loadGrades();
        if(sel.value){ grades[pid] = sel.value; } else { delete grades[pid]; }
        window.AAUP_GPA.saveGrades(grades);
        // Rebuilds the whole modal from the same open() the Dashboard link
        // already calls, so the summary cards, the semester panel, the audit
        // table and this table all recompute from the one save — there is no
        // partial-refresh path here to fall out of sync with the others.
        if(window.AAUP_AUDIT && window.AAUP_AUDIT.open) window.AAUP_AUDIT.open(prefix);
      });
    });
  }

  window.AAUP_GPA_STUDIO = {
    render: tableHTML,
    renderProjection: projectionHTML,
    bind: function(prefix, rtl){ bindTable(prefix); bindProjection(rtl); }
  };
})();
