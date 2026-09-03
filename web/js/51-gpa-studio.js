// ==========================
// GPA STUDIO
// ==========================
// Replaces the Degree Audit modal's flat row of three summary cards
// (Cumulative / Major / Standing) with a two-column layout — an editable
// grade table on one side, a GPA dial and a reach-a-target tool on the
// other — matching the approved mockup rather than a looser reskin of the
// old three-card row.
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
      title: 'Your grades', hint: 'Set or change any grade below and the dial updates immediately.',
      term: 'Term', course: 'Course', ch: 'CH', grade: 'Grade', pts: 'Points',
      excluded: 'excluded — retaken', none: 'Not counted',
      empty: 'Nothing finished yet — mark a course done on your plan and it appears here to grade.',
      goPlan: 'Enter marks from my plan',
      project: 'Reach a target GPA', projectHint: 'Uses your real credit hours and this plan’s required total — not a guess.',
      target: 'Target cumulative GPA', remaining: 'Credit hours remaining',
      need: function(grade, n){ return 'Average at least ' + grade + ' across the remaining ' + n + ' CH.'; },
      already: 'Already on track — even a weak average the rest of the way keeps you above this target.',
      unreachable: 'Not reachable by averaging a single letter grade across the remaining hours.',
      done: 'Nothing left — this plan’s credit hours are already accounted for.',
      cumulative: 'Cumulative', outOf: 'OUT OF 4.00', thisSemester: 'This semester',
      majorGpa: 'Major GPA', gradedHours: 'Graded hours', qualityPoints: 'Quality points',
      standing: 'Class standing', noGrades: 'No grades yet',
      clearGrade: 'No grade — clear this one',
      pick: 'Set grade', change: 'Change', changed: 'changed',
      noGrade: 'no grade yet',
      faNote: 'FA is an absence fail and counts as an F. W is a withdrawal and is not counted at all.'
    },
    ar: {
      title: 'علاماتك', hint: 'أدخل أو غيّر أي علامة أدناه وستتحدث الدائرة فوراً.',
      term: 'الفصل', course: 'المساق', ch: 'س.م', grade: 'العلامة', pts: 'النقاط',
      excluded: 'مستبعدة — أُعيد أخذه', none: 'غير محتسبة',
      empty: 'ما خلّصت إشي بعد — علّم مساقًا كمنجز في خطتك ليظهر هنا لتضع علامته.',
      goPlan: 'أدخل العلامات من خطتي',
      project: 'الوصول إلى معدل مستهدف', projectHint: 'يعتمد على ساعاتك الفعلية وإجمالي هذه الخطة — وليس تخميناً.',
      target: 'المعدل التراكمي المستهدف', remaining: 'الساعات المتبقية',
      need: function(grade, n){ return 'حافظ على معدل ' + grade + ' على الأقل خلال الساعات المتبقية (' + n + ' س.م).'; },
      already: 'أنت على المسار الصحيح بالفعل — حتى بمعدل ضعيف فيما تبقى ستبقى فوق هذا الهدف.',
      unreachable: 'غير قابل للتحقيق بمعدل علامة واحدة عبر الساعات المتبقية.',
      done: 'لم يتبق شيء — ساعات هذه الخطة مكتملة العدد بالفعل.',
      cumulative: 'التراكمي', outOf: 'من أصل 4.00', thisSemester: 'هذا الفصل',
      majorGpa: 'معدل التخصص', gradedHours: 'الساعات المُقيَّمة', qualityPoints: 'نقاط الجودة',
      standing: 'الوضع الأكاديمي', noGrades: 'لا توجد علامات بعد',
      clearGrade: 'بلا علامة — امسح هاي',
      pick: 'ضع العلامة', change: 'غيّر', changed: 'تغيّرت',
      noGrade: 'بلا علامة بعد',
      faNote: 'FA رسوب بسبب الغياب وبتحتسب زي F. أما W فهي انسحاب وما بتتحسب أبدًا.'
    }
  };

  // Same population gpaFor() counts (graded, passing-or-F, primary half of a
  // pair, retake-aware), but per row instead of summed — grouped by the same
  // .course-row year/semester regex js/18-gpa.js's semesterGpas() uses, so a
  // term label here can never disagree with the one in the panel below it.
  // The id'd rows give a compact "Y2 · S1"; a pinned card carries the long
  // "Year 2 · Second Semester" it shows on the plan. Same column, so the
  // long one is shortened to match rather than sitting next to it in a
  // different shape.
  function shortWhere(where){
    if(!where) return '';
    return where
      .replace(/Year\s+(\d+)/i, 'Y$1')
      .replace(/First Semester/i, 'S1')
      .replace(/Second Semester/i, 'S2');
  }

  function gradedRows(prefix){
    var page = document.getElementById('page-' + prefix);
    if(!page) return [];
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var progress = window.__getProgress ? window.__getProgress() : {};
    var grades = window.AAUP_GPA.loadGrades();
    var rows = [], seenNum = {};

    // Every course row on the page, not just the ones carrying an id: the
    // zero-hour requirements are pinned above Year 1 in a row that has none
    // (js/28-imported.js), and scanning only id'd rows dropped them out of
    // this table entirely. Their term comes from the card's own data-where,
    // which is exactly where the plan scheduled them.
    Array.prototype.slice.call(page.querySelectorAll('.course-row')).forEach(function(row){
      var m = row.id ? /-y(\d+)-s(\d+)$/.exec(row.id) : null;
      var rowTerm = m ? ('Y' + m[1] + ' · ' + (m[2] === '3' ? 'Summer' : 'S' + m[2])) : '';
      row.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
        var term = rowTerm || shortWhere(el.getAttribute('data-where'));
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
        // A course marked done but never graded used to be dropped here, and
        // that is what made two screens necessary: the popup was the only
        // place a FIRST grade could be set, and this table only edited ones
        // that already existed. A row appears for every finished course now,
        // with an empty grade cell that is the same control as a filled one —
        // so either screen sets it and either screen changes it, writing the
        // same stored value. In-progress courses are still not listed: the
        // app does not let an unfinished course carry a grade, and this does
        // not invent an exception to that.
        var g = grades[pid];

        var excluded = false;
        if(window.__isSupersededByRetake && window.__isSupersededByRetake(prefix, parts.slug)){
          var retakeSlug = window.AAUP_RETAKES ? window.AAUP_RETAKES.retakeSlugFor(prefix, parts.slug) : null;
          var retakeGrade = retakeSlug ? grades[prefix + '-c-' + retakeSlug] : null;
          excluded = window.AAUP_GPA.isRealGrade(retakeGrade);
        }
        rows.push({
          pid: pid, name: meta.name, nameAr: meta.ar, code: meta.num,
          cr: parseFloat(meta.cr) || 0, grade: g, term: term, excluded: excluded
        });
      });
    });
    return rows;
  }

  // Which courses this student has touched since the screen opened. Setting a
  // grade rebuilds the whole modal, so a row cannot remember anything itself —
  // and after four or five edits "which ones did I just do?" is a real
  // question with no way to answer it. Module-level, and cleared only when
  // the screen is opened fresh rather than re-rendered by an edit.
  var changed = Object.create(null);
  function clearChanged(){ changed = Object.create(null); }

  function pointsCell(row, t){
    if(row.excluded) return '<span class="gs-excluded">' + t.excluded + '</span>';
    // No grade yet is not the same as a grade that earns nothing, and
    // "Not counted" on an empty row read as a verdict on the course.
    if(row.grade == null || row.grade === '') return '<span class="gs-excluded">\u2014</span>';
    // `in` here matched inherited names like "constructor", which then
    // multiplied credit hours by a function and printed NaN into the table.
    if(!window.AAUP_GPA.isRealGrade(row.grade)) return '<span class="gs-excluded">' + t.none + '</span>';
    return (window.AAUP_GPA.GRADE_POINTS[row.grade] * row.cr).toFixed(2);
  }

  function tableHTML(prefix, rtl){
    var t = T[rtl ? 'ar' : 'en'];
    var rows = gradedRows(prefix);
    if(!rows.length){
      // Grades are entered from a course, not from here, so with none entered
      // this screen was a dead end: it explained where to go and gave no way
      // to go there. The button is the whole point of the empty state.
      return '<div class="gs-block"><div class="gs-lbl">' + t.title + '</div>' +
        '<p class="gs-empty">' + t.empty + '</p>' +
        '<button type="button" class="gs-goplan" data-gs-goplan="' + esc(prefix) + '">' +
          (window.AAUP_ICONS ? window.AAUP_ICONS.preview('planpin', 16) : '') + t.goPlan +
        '</button></div>';
    }
    // 5 · CHIPS, NOT A NATIVE SELECT.
    // On Android a <select> throws a full-screen list over the app to choose
    // one of twelve values, so setting a semester's grades meant twelve
    // round trips through a modal that covers the table you are working
    // from. A wrapped row of chips is one tap, keeps the table visible, and
    // sits where the thumb already is. Still a real radio group, so it is
    // keyboard- and screen-reader-operable exactly as the select was.
    //
    // A chip shows the grade and NOTHING else. The first version of this
    // reused gradeLabel(), which returns "FA — Absence fail (counts as F)"
    // for the select — a sentence inside a 30px chip, wrapped one character
    // per line, in a 64px table column that was sized for the select it
    // replaced. Every course row came out about a thousand pixels tall. The
    // sentence is a footnote under the grid now, and it is said once instead
    // of once per course.
    var chipsFor = function(pid, current){
      var one = function(val, label, title, cls){
        var on = val === current;
        return '<button type="button" class="gs-grade-chip' + (cls ? ' ' + cls : '') +
          (on ? ' is-on' : '') + '" role="radio" aria-checked="' + (on ? 'true' : 'false') +
          '" title="' + esc(title) + '" aria-label="' + esc(title) + '"' +
          ' data-pid="' + esc(pid) + '" data-grade="' + esc(val) + '">' + esc(label) + '</button>';
      };
      return '<div class="gs-grade-chips" role="radiogroup">' +
        window.AAUP_GPA.GRADE_ORDER.map(function(g){
          return one(g, window.AAUP_GPA.gradeShort(g), window.AAUP_GPA.gradeLabel(g),
                     window.AAUP_GPA.isFailGrade && window.AAUP_GPA.isFailGrade(g) ? 'is-fail' : '');
        }).join('') +
        one('', '\u2014', t.clearGrade, 'gs-grade-none') +
      '</div>';
    };
    // ONE COURSE OPEN AT A TIME.
    //
    // Every course used to carry its own permanently-expanded grid of
    // fourteen chips. Correct per row, unusable as a list: forty courses came
    // to roughly eight thousand pixels of scrolling to reach the one grade a
    // student actually came here to change, and thirteen of every fourteen
    // chips on screen were for courses they were not editing.
    //
    // A row is now a summary — the course, its hours, the grade it already
    // has, the points that grade earns. Tapping it opens the chips underneath
    // it, and opening one closes whichever was open before. Picking a grade
    // closes the row, because the next thing a student does is the next
    // course, not a second look at this one.
    //
    // The grade stays readable in the closed row, so the whole record can
    // still be scanned without opening anything — which is what a screen
    // called "Your grades" is mostly for.
    var body = rows.map(function(r){
      var name = rtl && r.nameAr ? r.nameAr : r.name;
      var has = r.grade != null && r.grade !== '';
      return '<div class="gs-row' + (r.excluded ? ' gs-row-excluded' : '') + '" data-gs-row="' + esc(r.pid) + '">' +
        '<button type="button" class="gs-head" data-gs-toggle="' + esc(r.pid) + '"' +
          ' aria-expanded="false" aria-controls="gsp-' + esc(r.pid) + '">' +
          '<span class="gs-head-main">' +
            '<span class="gs-head-name">' + name + '</span>' +
            '<span class="gs-code">' + esc(r.code) + ' · ' + esc(r.term) + ' · ' + r.cr + esc(t.ch) + '</span>' +
          '</span>' +
          '<span class="gs-head-right">' +
            // What you changed on this visit, so a run of edits can be
            // checked afterwards instead of remembered.
            (changed[r.pid] ? '<span class="gs-head-changed">' + esc(t.changed) + '</span>' : '') +
            (has
              ? '<span class="gs-head-grade' + (window.AAUP_GPA.isFailGrade && window.AAUP_GPA.isFailGrade(r.grade) ? ' is-fail' : '') + '">' +
                  esc(window.AAUP_GPA.gradeShort(r.grade)) + '</span>'
              : '<span class="gs-head-set">' + esc(t.pick) + '</span>') +
            '<span class="gs-head-pts">' + pointsCell(r, t) + '</span>' +
          '</span>' +
        '</button>' +
        '<div class="gs-panel" id="gsp-' + esc(r.pid) + '" hidden>' + chipsFor(r.pid, r.grade) + '</div>' +
      '</div>';
    }).join('');
    return '<div class="gs-block">' +
      '<div class="gs-lbl">' + t.title + '</div>' +
      '<p class="gs-hint">' + t.hint + '</p>' +
      '<div class="gs-list">' + body + '</div>' +
      // Said once, under the list, instead of inside every FA and W chip on
      // every course.
      '<p class="gs-foot">' + t.faNote + '</p></div>';
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

    return '<div class="gs-card gs-project">' +
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

  // The dial card — the right-hand column of the mockup this replaces. The
  // ring itself is CSS, not an image or a canvas: a conic-gradient stopped
  // at gpa/4 of the circle, same technique used for the progress rings
  // elsewhere in the app (Achievements, the home-screen preview), so it
  // matches how a "percentage as a ring" already looks in this codebase
  // rather than introducing a second visual language for the same idea.
  function dialCardHTML(prefix, rtl){
    var t = T[rtl ? 'ar' : 'en'];
    var cum = window.AAUP_GPA.gpaFor(prefix, null);
    var major = window.AAUP_GPA.gpaFor(prefix, function(el){
      return el.classList.contains('core') || el.classList.contains('dept');
    });
    var standing = window.AAUP_GPA.standingFor(cum.gpa);
    var sems = window.AAUP_GPA.semesterGpas ? window.AAUP_GPA.semesterGpas(prefix) : [];
    // Chronological order, same as the panel below this one — the last
    // entry with hours in it is the most recently graded term, used as a
    // stand-in for "this semester" rather than assuming today's date.
    var current = sems.length ? sems[sems.length - 1] : null;
    var fmt = function(g){ return g === null || g === undefined ? '—' : g.toFixed(2); };
    var pct = cum.gpa == null ? 0 : Math.max(0, Math.min(100, cum.gpa / 4 * 100));
    var points = cum.gpa == null ? 0 : cum.gpa * cum.credits;

    var rows = [
      [t.thisSemester, current ? fmt(current.gpa) : '—'],
      [t.majorGpa, fmt(major.gpa)],
      [t.gradedHours, cum.credits || 0],
      [t.qualityPoints, points.toFixed(1)]
    ];

    return '<div class="gs-card gs-dial-card">' +
      '<div class="gs-lbl">' + t.cumulative + '</div>' +
      '<div class="gs-dial" style="background:conic-gradient(var(--accent) 0% ' + pct + '%, rgba(255,255,255,.09) ' + pct + '% 100%);">' +
        '<div class="gs-dial-inner"><b>' + fmt(cum.gpa) + '</b><span>' + t.outOf + '</span></div>' +
      '</div>' +
      rows.map(function(r){
        return '<div class="gs-kv"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>';
      }).join('') +
      '<div class="gs-kv"><span>' + t.standing + '</span>' +
        '<span class="standing-badge ' + standing.cls + '">' + (rtl ? standing.ar : standing.label) + '</span></div>' +
      '</div>';
  }

  // Table (left) + dial and projection (right), in that order in the
  // markup so a screen reader or a narrow viewport meets the grades before
  // the summary of them — the grid only reorders them side by side once
  // there is room.
  // Below 720px the table and the dial/projection column swipe side by
  // side (scroll-snap, no JS needed for the gesture itself) instead of
  // stacking vertically — on a phone the dial otherwise sits a full scroll
  // beneath a possibly-long grade table. The dots are decorative sync only;
  // scroll-snap already does the actual paging.
  function layoutHTML(prefix, rtl){
    // With no grades entered there is nothing to swipe between and nothing
    // to project from: the dial reads "—", the projection has no cumulative
    // GPA to work off, and the two swipe dots point at a second panel that
    // is empty. All of it collapses to one short card that says where
    // grades come from and offers the way there, and the requirement
    // breakdown below becomes the first real thing on the screen — which
    // with nothing entered yet is the thing worth looking at anyway.
    if(!gradedRows(prefix).length){
      return '<div class="gs-layout gs-layout-empty" id="gsLayout">' +
        '<div class="gs-col-main">' + tableHTML(prefix, rtl) + '</div>' +
        '</div>';
    }
    return '<div class="gs-swipe-dots" aria-hidden="true"><span class="active"></span><span></span></div>' +
      '<div class="gs-layout" id="gsLayout">' +
      '<div class="gs-col-main">' + tableHTML(prefix, rtl) + '</div>' +
      '<div class="gs-col-side">' + dialCardHTML(prefix, rtl) + projectionHTML(prefix, rtl) + '</div>' +
      '</div>';
  }

  // Whether this plan has any graded course yet — the audit screen asks so it
  // can drop the "how to edit a grade" line when there is none to edit.
  // "Are there grades" and "are there rows" stopped being the same question
  // once ungraded finished courses joined the table. The dial, the target
  // calculator and the Degree Audit's own note all mean the first one.
  function hasGrades(prefix){
    return gradedRows(prefix).some(function(r){
      return window.AAUP_GPA.isRealGrade(r.grade);
    });
  }

  function bindSwipeDots(){
    var layout = document.getElementById('gsLayout');
    var dots = document.querySelectorAll('.gs-swipe-dots span');
    if(!layout || dots.length < 2) return;
    layout.addEventListener('scroll', function(){
      var idx = layout.scrollLeft > layout.clientWidth / 2 ? 1 : 0;
      dots.forEach(function(d, i){ d.classList.toggle('active', i === idx); });
    }, { passive: true });
  }

  function nearestGradeAtLeast(points){
    var order = window.AAUP_GPA.GRADE_ORDER.filter(function(g){ return window.AAUP_GPA.isRealGrade(g); });
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
    // One open at a time. Opening a row closes whichever was open, so the
    // list never grows past one course's worth of chips.
    document.querySelectorAll('[data-gs-toggle]').forEach(function(head){
      head.addEventListener('click', function(){
        var pid = head.getAttribute('data-gs-toggle');
        var panel = document.getElementById('gsp-' + pid);
        var opening = panel && panel.hidden;
        document.querySelectorAll('.gs-panel').forEach(function(p2){ p2.hidden = true; });
        document.querySelectorAll('[data-gs-toggle]').forEach(function(h2){
          h2.setAttribute('aria-expanded', 'false');
          h2.closest('.gs-row').classList.remove('is-open');
        });
        if(opening){
          panel.hidden = false;
          head.setAttribute('aria-expanded', 'true');
          head.closest('.gs-row').classList.add('is-open');
          // Bring the whole row into view — the chips open BELOW the header,
          // so a row tapped near the bottom of the screen would otherwise
          // expand entirely off it.
          panel.scrollIntoView({ block: 'nearest' });
        }
      });
    });
    document.querySelectorAll('.gs-grade-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        var pid = chip.getAttribute('data-pid');
        var val = chip.getAttribute('data-grade');
        var grades = window.AAUP_GPA.loadGrades();
        // Pressing the grade already set clears it, which is what the "—"
        // option did and is the only way back to ungraded from a chip row.
        if(val && grades[pid] !== val){ grades[pid] = val; } else { delete grades[pid]; }
        window.AAUP_GPA.saveGrades(grades);
        changed[pid] = true;
        // Rebuilds the whole modal from the same open() the Dashboard link
        // already calls, so the summary cards, the semester panel, the audit
        // table and this table all recompute from the one save — there is no
        // partial-refresh path here to fall out of sync with the others.
        if(window.AAUP_AUDIT && window.AAUP_AUDIT.open) window.AAUP_AUDIT.open(prefix);
      });
    });
    document.querySelectorAll('[data-gs-goplan]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var pid = btn.getAttribute('data-gs-goplan');
        var ov = document.getElementById('auditModalOverlay');
        if(ov) ov.classList.remove('open');
        if(window.AAUP_DASHBOARD) window.AAUP_DASHBOARD.openStudyPlan(pid);
      });
    });
  }

  window.AAUP_GPA_STUDIO = {
    layout: layoutHTML,
    hasGrades: hasGrades,
    // Called by js/19-audit.js when the screen is opened from outside, so the
    // "changed" marks belong to one sitting rather than accumulating forever.
    resetChanged: clearChanged,
    bind: function(prefix, rtl){ bindTable(prefix); bindProjection(rtl); bindSwipeDots(); }
  };
})();
