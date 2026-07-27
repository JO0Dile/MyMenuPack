// ==========================
// COURSE MODAL EXTRAS (grade + planning-status controls, injected into the
// existing per-course info popup rather than adding a new one)
// ==========================
(function(){
  // Which university a plan prefix belongs to, so the University Elective
  // picker offers that university's real course pool (built-in majors are
  // always AAUP; an imported/feed plan carries its own university field).
  function planUniversity(prefix){
    var BUILT_IN = { robotics: 1, cybersecurity: 1, medical: 1, cs: 1 };
    if(BUILT_IN[prefix]) return 'aaup';
    var imported = (window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans) ? window.AAUP_IMPORTED.loadImportedPlans() : {};
    var p = imported[prefix];
    return (p && p.university) || 'aaup';
  }
  // Only the plain "uni-elective-N" pool slot gets the real-course picker —
  // free/dept/spec elective pools aren't university-wide catalogs, so there's
  // no single real list to offer for them; they keep the free-text field.
  function univElectivePool(prefix, slug){
    if(!/^uni-elective-\d+$/.test(slug)) return null;
    var pool = window.APP_UNIV_ELECTIVES && window.APP_UNIV_ELECTIVES[planUniversity(prefix)];
    return (pool && pool.length) ? pool : null;
  }

  function electivePickerListHtml(pool, rtl, hasCurrent){
    var esc = window.__escapeHtml;
    var searchHtml = '<input type="text" class="search-input" id="electivePickerSearch" placeholder="' +
      (rtl ? 'ابحث عن مادة…' : 'Search courses…') + '" autocomplete="off" style="margin-bottom:8px;width:100%;">';
    var clearHtml = hasCurrent
      ? '<button type="button" class="elective-pick-option elective-pick-clear" data-code="" data-en="">✕ ' + (rtl ? 'إلغاء الاختيار' : 'Clear selection') + '</button>'
      : '';
    var itemsHtml = pool.map(function(c){
      return '<button type="button" class="elective-pick-option" data-code="' + esc(c.code) + '" data-en="' + esc(c.en) + '">' +
        '<span class="epo-code">' + esc(c.code) + '</span><span class="epo-name">' + esc(c.en) + '</span></button>';
    }).join('');
    return searchHtml + clearHtml +
      '<div class="elective-pick-options" id="electivePickerOptions">' + itemsHtml + '</div>' +
      '<p class="ex-note" id="electivePickerEmpty" style="display:none;">' + (rtl ? 'لا توجد نتائج' : 'No matching courses') + '</p>';
  }

  // AAUP's own portal shows a course's mark broken into whatever components
  // the instructor set (mid-term, lab, quiz, assignment...), each out of a
  // teacher-chosen max — never one flat "your score is X" number, and never
  // the final exam mark itself. This mirrors that instead of asking for a
  // single 0-100 figure: an open-ended list of {label, score, max} rows the
  // student builds up as their own results come in, summed into a running
  // percentage that resolves to a letter the same way a single score would.
  // Final Exam is deliberately NOT a preset here — AAUP never shows that
  // mark (uni rules), so a student normally can't know it to type it in.
  // The remaining share of the 100-point total is worked out automatically
  // instead (see assessmentTotals/assessmentSummaryHtml below). A student
  // who genuinely does know it (asked the instructor directly) can still
  // add it as a plain "Other" row with their own label — nothing blocks
  // that — it's just not offered as a quick-add suggestion.
  var ASSESSMENT_PRESETS_EN = ['Mid Term', 'Lab', 'Quiz', 'Assignment'];
  var ASSESSMENT_PRESETS_AR = { 'Mid Term': 'نصفي', 'Lab': 'مختبر', 'Quiz': 'كويز', 'Assignment': 'واجب' };

  function assessmentRowHtml(row, idx, rtl){
    var esc = window.__escapeHtml;
    return '<div class="assessment-row" data-idx="' + idx + '">' +
      '<input type="text" class="ar-label" data-idx="' + idx + '" maxlength="40" value="' + esc(row.label || '') + '" placeholder="' +
        (rtl ? 'اسم التقييم' : 'Label') + '">' +
      '<input type="number" class="ar-score" data-idx="' + idx + '" min="0" step="0.1" value="' + (row.score === '' || row.score == null ? '' : esc(String(row.score))) + '" placeholder="' + (rtl ? 'علامتك' : 'Score') + '">' +
      '<span class="ar-sep">/</span>' +
      '<input type="number" class="ar-max" data-idx="' + idx + '" min="0" step="0.1" value="' + (row.max === '' || row.max == null ? '' : esc(String(row.max))) + '" placeholder="' + (rtl ? 'من' : 'Max') + '">' +
      '<button type="button" class="ar-remove" data-idx="' + idx + '" aria-label="' + (rtl ? 'حذف' : 'Remove') + '">×</button>' +
      '</div>';
  }

  function assessmentRowsHtml(rows, rtl){
    if(!rows.length){
      return '<p class="ex-note assessment-empty">' + (rtl
        ? 'لا توجد تفاصيل تقييم بعد — أضف نصفي، مختبر، كويز، واجب... حسب ما يضعه أستاذ المساق.'
        : 'No assessment details yet — add Mid Term, Lab, Quiz, Assignment... whatever your instructor actually uses.') + '</p>';
    }
    return rows.map(function(row, idx){ return assessmentRowHtml(row, idx, rtl); }).join('');
  }

  // Every component's max is already expressed as its own share of the
  // course's 100-point total (Mid Term /35, Quiz /20 — not each out of a
  // separate 100), so the running total is simply the earned points so far
  // (sumScore), out of however much of the 100 has been accounted for
  // (sumMax) — the rest (100 - sumMax) is implicitly whatever the final
  // exam is worth, which this never asks the student to type in directly.
  // Partial rows (missing score or max) are silently skipped rather than
  // treated as zero, so an in-progress entry doesn't tank the total.
  function assessmentTotals(rows){
    var sumScore = 0, sumMax = 0, any = false;
    rows.forEach(function(row){
      var s = parseFloat(row.score), m = parseFloat(row.max);
      if(isNaN(s) || isNaN(m) || m <= 0) return;
      sumScore += s; sumMax += m; any = true;
    });
    var remaining = Math.max(0, Math.round((100 - sumMax) * 10) / 10);
    return { sumScore: sumScore, sumMax: sumMax, any: any, remaining: remaining, complete: any && sumMax >= 100 };
  }

  function rangesFor(prefix, pid){
    var scale = window.AAUP_GPA.numericScaleFor(prefix, pid);
    return scale === 'ai' ? window.AAUP_GPA.AI_NUMERIC_GRADE_RANGES : window.AAUP_GPA.ENGINEERING_NUMERIC_GRADE_RANGES;
  }

  // Ascending real-letter tiers (D up to A) for whichever pass-mark scale
  // this course uses — F is excluded, it's never a "goal" to project toward.
  function gradeTiersAscending(prefix, pid){
    return rangesFor(prefix, pid).filter(function(r){ return r.grade !== 'F'; }).slice().reverse();
  }

  function round1(n){ return Math.round(n * 10) / 10; }

  // The running total is NEVER auto-applied to the official grade — a
  // mid-term-only total isn't the final grade, and AAUP itself never shows
  // the final exam mark (uni rules). While incomplete (remaining > 0) this
  // instead shows: current points, what's left for the final, and — the
  // AAUP-style projection — what score is needed on that remaining share to
  // reach each grade tier ("secured" if already guaranteed regardless of the
  // final, "not reachable" if even a perfect final can't get there). Once
  // every component including the final is entered (sumMax >= 100) it
  // resolves to a real letter the student can apply. currentLetter (from the
  // grade dropdown) additionally powers a reverse lookup: if the student
  // already knows their official letter grade but not their raw final exam
  // mark, this works out the range that final must have fallen in.
  function assessmentSummaryHtml(rows, prefix, pid, rtl, currentLetter){
    var esc = window.__escapeHtml;
    var t = assessmentTotals(rows);
    if(!t.any){
      return { html: '<p class="ex-note assessment-empty-total">' + (rtl
        ? 'أضف علامة وحدًا أقصى لحساب مجموعك الحالي.'
        : 'Add a score and a max to calculate your running total.') + '</p>', letter: null };
    }

    if(t.complete){
      var letter = window.AAUP_GPA.letterForScore(t.sumScore, prefix, pid);
      var totalText = (rtl ? 'المجموع: ' : 'Total: ') + round1(t.sumScore) + '/100' + (letter ? (' → ' + letter) : '');
      return { html: '<p class="assessment-total">' + esc(totalText) + '</p>', letter: letter };
    }

    var soFarText = (rtl
      ? 'حتى الآن: ' + t.sumScore + '/100 — تبقّى ' + t.remaining + ' للنهائي'
      : 'So far: ' + t.sumScore + '/100 — ' + t.remaining + ' left for the final');

    var needItems = gradeTiersAscending(prefix, pid).map(function(tier){
      var needed = tier.min - t.sumScore;
      var status;
      if(needed <= 0){ status = rtl ? 'مضمونة ✓' : 'secured ✓'; }
      else if(needed > t.remaining + 1e-9){ status = rtl ? 'غير ممكنة' : 'not reachable'; }
      else { status = (rtl ? 'تحتاج ' : 'need ') + round1(needed) + '/' + t.remaining; }
      return '<li><b>' + esc(tier.grade) + '</b>: ' + esc(status) + '</li>';
    }).join('');

    var reverseHtml = '';
    if(currentLetter && t.remaining > 0){
      var tierMatch = rangesFor(prefix, pid).filter(function(r){ return r.grade === currentLetter; })[0];
      if(tierMatch){
        var lo = Math.max(0, tierMatch.min - t.sumScore);
        var hi = Math.min(t.remaining, tierMatch.max - t.sumScore);
        if(hi >= 0 && lo <= t.remaining && lo <= hi){
          var reverseText = rtl
            ? 'بناءً على علامتك الرسمية (' + currentLetter + ')، كانت علامة النهائي بين ' + round1(lo) + '/' + t.remaining + ' و' + round1(hi) + '/' + t.remaining + '.'
            : 'Based on your official grade (' + currentLetter + '), your final exam was between ' + round1(lo) + '/' + t.remaining + ' and ' + round1(hi) + '/' + t.remaining + '.';
          reverseHtml = '<p class="assessment-reverse">' + esc(reverseText) + '</p>';
        }
      }
    }

    return {
      html: '<p class="assessment-total">' + esc(soFarText) + '</p>' +
        '<ul class="assessment-need-list">' + needItems + '</ul>' +
        reverseHtml,
      letter: null
    };
  }

  function render(prefix, slug){
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var meta = info[slug];
    if(!meta) return '';
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    var pid = window.AAUP_GPA.primaryId(prefix, slug);
    var isLabHalf = pid !== (prefix + '-c-' + slug);

    if(isLabHalf){
      return '<div class="modal-extras"><p class="ex-note">' +
        (rtl
          ? 'العلامة وحالة التخطيط لهذا المساق تُسجَّل ضمن نافذة مساق المحاضرة المرتبط بمختبره.'
          : 'Grade and planning status for this course are recorded under its paired lecture entry.') +
        '</p></div>';
    }

    var progress = window.__getProgress ? window.__getProgress() : {};
    var isDone = !!progress[pid];

    var nameFieldHtml = '';
    var electivePool = univElectivePool(prefix, slug);
    if(electivePool){
      var poolCustomNames = window.AAUP_PERSONAL.loadCustomNames();
      var poolCurrentName = poolCustomNames[pid] || '';
      nameFieldHtml = '<div class="form-field elective-picker-field" style="margin-bottom:14px;">' +
        '<label>' + (rtl ? 'ما هو المساق الذي أخذته فعليًا؟' : 'What course did you actually take?') + '</label>' +
        '<button type="button" id="electivePickerBtn" class="home-btn" data-placeholder="' + window.__escapeHtml(rtl ? 'اضغط لاختيار مادتك الاختيارية' : 'Tap to choose your elective') + '" style="width:100%;justify-content:space-between;">' +
        '<span id="electivePickerBtnLabel">' + (poolCurrentName ? window.__escapeHtml(poolCurrentName) : (rtl ? 'اضغط لاختيار مادتك الاختيارية' : 'Tap to choose your elective')) + '</span>' +
        '<span aria-hidden="true">▾</span></button>' +
        '<div class="elective-picker-list" id="electivePickerList" style="display:none;">' +
        electivePickerListHtml(electivePool, rtl, !!poolCurrentName) +
        '</div>' +
        '</div>';
    } else if(window.AAUP_PERSONAL.isGenericElectiveSlot(slug)){
      var customNames = window.AAUP_PERSONAL.loadCustomNames();
      var currentName = customNames[pid] || '';
      // Free electives can be almost any course from any department, so
      // there's no full catalog to offer — this is just a handful of
      // reported ones as autocomplete suggestions on top of the free-text
      // field, which stays exactly as it was either way.
      var isFreeElective = /^free-elective-\d+$/.test(slug);
      var freeElectiveSuggestions = (isFreeElective && window.APP_FREE_ELECTIVE_SUGGESTIONS) ? (window.APP_FREE_ELECTIVE_SUGGESTIONS[prefix] || []) : [];
      var suggestionsListId = 'freeElectiveSuggestions-' + pid.replace(/[^a-zA-Z0-9_-]/g, '');
      var datalistHtml = freeElectiveSuggestions.length
        ? '<datalist id="' + suggestionsListId + '">' + freeElectiveSuggestions.map(function(s){ return '<option value="' + window.__escapeHtml(s) + '">'; }).join('') + '</datalist>'
        : '';
      nameFieldHtml = '<div class="form-field" style="margin-bottom:14px;">' +
        '<label for="electiveNameInput">' + (rtl ? 'ما هو المساق الذي أخذته فعليًا؟' : 'What course did you actually take?') + '</label>' +
        '<input type="text" id="electiveNameInput" maxlength="120" value="' + currentName.replace(/"/g, '&quot;') + '" placeholder="' +
        (rtl ? 'مثال: مقدمة في الفلسفة' : 'e.g. Introduction to Philosophy') + '"' +
        (freeElectiveSuggestions.length ? ' list="' + suggestionsListId + '"' : '') + '>' +
        datalistHtml +
        '</div>';
    }

    var statuses = window.AAUP_GPA.loadStatuses();
    var currentStatus = isDone ? 'done' : (statuses[pid] || '');
    var statusOptions = [
      { v: '', en: 'Not planned', ar: 'غير مخطط' },
      { v: 'planned', en: '📌 Planned next semester', ar: '📌 مخطط للفصل القادم' },
      { v: 'in_progress', en: '📖 In progress this semester', ar: '📖 قيد الإنجاز هذا الفصل' },
      { v: 'done', en: '✅ Done / Completed', ar: '✅ مكتمل' }
    ];
    var statusHtml = statusOptions.map(function(o){
      // "Done" isn't a button to click — it reflects the completion
      // checkbox automatically, so clicking it here wouldn't make sense
      // (checking the box is what sets it).
      var isDoneOption = o.v === 'done';
      return '<button type="button" class="status-btn' + (currentStatus === o.v ? ' active' : '') + (isDoneOption ? ' status-btn-auto' : '') + '"' +
        (isDoneOption ? ' disabled' : ' data-status="' + o.v + '"') + '>' +
        (rtl ? o.ar : o.en) + '</button>';
    }).join('');

    var gradeHtml;
    if(isDone){
      var grades = window.AAUP_GPA.loadGrades();
      var currentGrade = grades[pid] || '';
      var opts = '<option value="">—</option>' + window.AAUP_GPA.GRADE_ORDER.map(function(g){
        return '<option value="' + g + '"' + (g === currentGrade ? ' selected' : '') + '>' + window.AAUP_GPA.gradeLabel(g) + '</option>';
      }).join('');
      // Optional alternate entry: build up the same assessment breakdown
      // AAUP's own portal shows (mid-term / lab / quiz / assignment, each
      // out of whatever max the instructor set) and it resolves to the
      // correct official letter automatically, rather than working the
      // letter out by hand. The pass-mark scale (Engineering = 60, AI
      // college = 50) is a per-course toggle, not tied to any other course.
      var scale = window.AAUP_GPA.numericScaleFor(prefix, pid);
      var breakdownAll = window.AAUP_GPA.loadAssessmentBreakdown();
      var rows = breakdownAll[pid] || [];
      var summary = assessmentSummaryHtml(rows, prefix, pid, rtl, currentGrade || null);
      gradeHtml = '<div class="modal-row-block"><span class="k">' + (rtl ? 'العلامة' : 'Grade') + '</span>' +
        '<select class="grade-select" id="courseGradeSelect">' + opts + '</select>' +
        '<div class="pass-mark-toggle" id="passMarkToggle">' +
          '<span class="pm-label">' + (rtl ? 'علامة النجاح' : 'Pass mark') + '</span>' +
          '<button type="button" class="pm-btn' + (scale === 'engineering' ? ' active' : '') + '" data-scale="engineering">60 (' + (rtl ? 'هندسة' : 'Engineering') + ')</button>' +
          '<button type="button" class="pm-btn' + (scale === 'ai' ? ' active' : '') + '" data-scale="ai">50 (' + (rtl ? 'ذكاء اصطناعي' : 'AI') + ')</button>' +
        '</div>' +
        '<div class="assessment-breakdown" id="assessmentBreakdown">' +
          '<div class="assessment-rows" id="assessmentRows">' + assessmentRowsHtml(rows, rtl) + '</div>' +
          '<div class="assessment-quick-add" id="assessmentQuickAdd">' +
            ASSESSMENT_PRESETS_EN.map(function(p){
              return '<button type="button" class="aq-btn" data-preset="' + p + '">+ ' + (rtl ? ASSESSMENT_PRESETS_AR[p] : p) + '</button>';
            }).join('') +
            '<button type="button" class="aq-btn" data-preset="">+ ' + (rtl ? 'آخر' : 'Other') + '</button>' +
          '</div>' +
          '<div class="assessment-summary" id="assessmentSummary">' + summary.html + '</div>' +
          '<div class="assessment-total-row">' +
            '<button type="button" class="aq-apply-btn" id="assessmentApplyBtn" style="display:' + (summary.letter ? 'inline-block' : 'none') + ';">' +
              (rtl ? 'استخدمها كعلامتي ↑' : 'Use as my grade ↑') +
            '</button>' +
          '</div>' +
        '</div>' +
        '</div>';
    } else {
      gradeHtml = '<div class="modal-row-block"><span class="k">' + (rtl ? 'العلامة' : 'Grade') + '</span>' +
        '<p class="ex-note">' + (rtl ? 'أكمل هذا المساق أولًا لإدخال علامة.' : 'Mark this course complete to enter a grade.') + '</p></div>';
    }

    var ratings = window.AAUP_PERSONAL.loadRatings();
    var r = ratings[pid] || {};
    var starsHtml = '';
    for(var i = 1; i <= 5; i++){
      starsHtml += '<span class="star' + (i <= (r.difficulty || 0) ? ' filled' : '') + '" data-value="' + i + '">' +
        (i <= (r.difficulty || 0) ? '★' : '☆') + '</span>';
    }
    var workloadLevels = [
      { v: 'Easy', cls: 'wb-easy', en: 'Easy', ar: 'سهل' },
      { v: 'Medium', cls: 'wb-medium', en: 'Medium', ar: 'متوسط' },
      { v: 'Hard', cls: 'wb-hard', en: 'Hard', ar: 'صعب' }
    ];
    var workloadHtml = workloadLevels.map(function(w){
      return '<button type="button" class="status-btn workload-btn ' + w.cls + (r.workload === w.v ? ' active' : '') + '" data-workload="' + w.v + '">' +
        (rtl ? w.ar : w.en) + '</button>';
    }).join('');

    var notes = window.AAUP_PERSONAL.loadNotes();
    var noteText = notes[pid] || '';

    var removed = window.AAUP_REMOVED && window.AAUP_REMOVED.isRemoved(prefix, slug);
    var removeHtml = '<div class="modal-row-block modal-remove-block">' +
      '<button type="button" class="course-remove-btn' + (removed ? ' is-restore' : '') + '" id="courseRemoveBtn">' +
        (removed
          ? (rtl ? '↩︎ إعادة المساق إلى خطتي' : '↩︎ Restore to my plan')
          : (rtl ? '🗑 إزالة المساق من خطتي' : '🗑 Remove from my plan')) +
      '</button>' +
      '<p class="ex-note">' + (removed
        ? (rtl ? 'هذا المساق مُزال حاليًا ولا يُحتسب ضمن متطلباتك.' : "This course is currently removed and isn't counted toward your requirements.")
        : (rtl ? 'أزِله إن كنت قد تجاوزته أو لم تأخذه (مثل الإنجليزية المتوسطة) — لن يُحتسب ضمن متطلباتك.' : "Remove it if you tested out of it or never took it (e.g. Intermediate English) — it won't count toward your requirements.")) +
      '</p></div>';

    return '<div class="modal-extras" data-pid="' + pid + '" data-slug="' + slug + '">' +
      nameFieldHtml +
      '<div class="modal-row-block"><span class="k">' + (rtl ? 'حالة التخطيط' : 'Planning status') + '</span>' +
      '<div class="status-btn-group">' + statusHtml + '</div></div>' +
      gradeHtml +
      '<div class="modal-row-block"><span class="k">' + (rtl ? 'مستوى الصعوبة' : 'Difficulty') + '</span>' +
      '<div class="star-rating" id="difficultyStars">' + starsHtml + '</div></div>' +
      '<div class="modal-row-block"><span class="k">' + (rtl ? 'عبء العمل' : 'Workload') + '</span>' +
      '<div class="workload-btn-group">' + workloadHtml + '</div></div>' +
      '<div class="modal-row-block"><span class="k">📝 ' + (rtl ? 'ملاحظاتي' : 'My notes') + '</span>' +
      '<textarea class="notes-textarea" id="courseNotesTextarea" maxlength="2000" rows="3" placeholder="' +
      (rtl ? 'ملاحظات شخصية عن هذا المساق…' : 'Personal notes about this course…') + '">' + noteText + '</textarea></div>' +
      removeHtml +
      '</div>';
  }

  function bind(prefix, slug, containerEl){
    // The 4 built-in majors each have their own static "#{prefix}-
    // courseModalBody" overlay; every imported/feed plan shares ONE overlay
    // instead (there's no way to pre-build a static one per plan id), so its
    // caller passes the container element directly rather than relying on
    // this id lookup.
    var container = containerEl || document.querySelector('#' + prefix + '-courseModalBody .modal-extras');
    if(!container) return;
    var pid = container.getAttribute('data-pid');
    if(!pid) return;

    var nameInput = container.querySelector('#electiveNameInput');
    if(nameInput){
      nameInput.addEventListener('input', function(){
        var names = window.AAUP_PERSONAL.loadCustomNames();
        if(nameInput.value.trim()){ names[pid] = nameInput.value; } else { delete names[pid]; }
        window.AAUP_PERSONAL.saveCustomNames(names);
        window.AAUP_PERSONAL.refreshCard(prefix, slug);
      });
    }

    // ---- University Elective picker: tap the button to reveal a real,
    // searchable list of that university's actual elective courses instead
    // of typing a name in free-text. ----
    var pickerBtn = container.querySelector('#electivePickerBtn');
    var pickerList = container.querySelector('#electivePickerList');
    if(pickerBtn && pickerList){
      pickerBtn.addEventListener('click', function(){
        var opening = pickerList.style.display === 'none';
        pickerList.style.display = opening ? 'block' : 'none';
        if(opening){
          var search = pickerList.querySelector('#electivePickerSearch');
          if(search){ search.value = ''; search.focus(); }
          pickerList.querySelectorAll('.elective-pick-option').forEach(function(o){ o.style.display = ''; });
          var empty = pickerList.querySelector('#electivePickerEmpty');
          if(empty){ empty.style.display = 'none'; }
        }
      });

      var searchInput = pickerList.querySelector('#electivePickerSearch');
      if(searchInput){
        searchInput.addEventListener('input', function(){
          var q = searchInput.value.trim().toLowerCase();
          var options = pickerList.querySelectorAll('.elective-pick-option:not(.elective-pick-clear)');
          var anyVisible = false;
          options.forEach(function(o){
            var hay = (o.getAttribute('data-en') + ' ' + o.getAttribute('data-code')).toLowerCase();
            var match = !q || hay.indexOf(q) !== -1;
            o.style.display = match ? '' : 'none';
            if(match) anyVisible = true;
          });
          var empty = pickerList.querySelector('#electivePickerEmpty');
          if(empty){ empty.style.display = anyVisible ? 'none' : 'block'; }
        });
      }

      pickerList.querySelectorAll('.elective-pick-option').forEach(function(opt){
        opt.addEventListener('click', function(){
          var en = opt.getAttribute('data-en');
          var names = window.AAUP_PERSONAL.loadCustomNames();
          if(en){ names[pid] = en; } else { delete names[pid]; }
          window.AAUP_PERSONAL.saveCustomNames(names);
          window.AAUP_PERSONAL.refreshCard(prefix, slug);
          var label = pickerBtn.querySelector('#electivePickerBtnLabel');
          if(label){
            label.textContent = en || pickerBtn.getAttribute('data-placeholder') || label.textContent;
          }
          pickerList.style.display = 'none';
        });
      });
    }

    container.querySelectorAll('.status-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var statuses = window.AAUP_GPA.loadStatuses();
        var val = btn.getAttribute('data-status');
        if(val){ statuses[pid] = val; } else { delete statuses[pid]; }
        window.AAUP_GPA.saveStatuses(statuses);
        container.querySelectorAll('.status-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    var gradeSelect = container.querySelector('#courseGradeSelect');
    if(gradeSelect){
      gradeSelect.addEventListener('change', function(){
        if(window.__applyGradeChange){ window.__applyGradeChange(prefix, pid, gradeSelect.value); }
        // Picking a letter directly (e.g. copying it from an official
        // transcript) also feeds the reverse final-exam-range lookup below.
        if(typeof refreshAssessmentTotal === 'function'){ refreshAssessmentTotal(); }
      });
    }

    // Pass-mark scale toggle (Engineering 60 / AI college 50) — independent
    // per course, flips which numeric table the assessment total below (and
    // the shared numeric input in the legacy imported-plan prompt) resolves
    // against.
    var passMarkToggle = container.querySelector('#passMarkToggle');
    if(passMarkToggle){
      passMarkToggle.querySelectorAll('.pm-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          var overrides = window.AAUP_GPA.loadPassMarkOverrides();
          overrides[pid] = btn.getAttribute('data-scale');
          window.AAUP_GPA.savePassMarkOverrides(overrides);
          passMarkToggle.querySelectorAll('.pm-btn').forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
          refreshAssessmentTotal();
        });
      });
    }

    // Assessment breakdown: an open-ended list of {label, score, max} rows
    // building up a running total, rather than one flat numeric score —
    // matches how AAUP's own portal actually shows a course's marks
    // (mid-term/lab/quiz/assignment, each out of an instructor-chosen max,
    // final exam never shown). The total is a PREVIEW only; it's never
    // auto-applied to the official grade (a mid-term-only total isn't the
    // final grade) — the student applies it explicitly once confident it's
    // complete, via the "Use as my grade" button.
    var assessRowsEl = container.querySelector('#assessmentRows');
    var assessSummaryEl = container.querySelector('#assessmentSummary');
    var assessApplyBtn = container.querySelector('#assessmentApplyBtn');
    var rtlBind = window.__isRtl ? window.__isRtl(prefix) : false;
    var pendingLetter = null;

    function currentRows(){
      var all = window.AAUP_GPA.loadAssessmentBreakdown();
      return all[pid] || [];
    }
    function saveRows(rows){
      var all = window.AAUP_GPA.loadAssessmentBreakdown();
      if(rows.length){ all[pid] = rows; } else { delete all[pid]; }
      window.AAUP_GPA.saveAssessmentBreakdown(all);
    }
    function refreshAssessmentTotal(){
      var rows = currentRows();
      var currentLetter = gradeSelect ? (gradeSelect.value || null) : null;
      var result = assessmentSummaryHtml(rows, prefix, pid, rtlBind, currentLetter);
      if(assessSummaryEl){ assessSummaryEl.innerHTML = result.html; }
      pendingLetter = result.letter;
      if(assessApplyBtn){ assessApplyBtn.style.display = pendingLetter ? 'inline-block' : 'none'; }
    }
    function bindRowInputs(){
      if(!assessRowsEl) return;
      assessRowsEl.querySelectorAll('.ar-label, .ar-score, .ar-max').forEach(function(inp){
        inp.addEventListener('input', function(){
          var idx = parseInt(inp.getAttribute('data-idx'), 10);
          var rows = currentRows();
          if(!rows[idx]) return;
          if(inp.classList.contains('ar-label')){ rows[idx].label = inp.value; }
          else if(inp.classList.contains('ar-score')){ rows[idx].score = inp.value; }
          else if(inp.classList.contains('ar-max')){ rows[idx].max = inp.value; }
          saveRows(rows);
          refreshAssessmentTotal();
        });
      });
      assessRowsEl.querySelectorAll('.ar-remove').forEach(function(btn){
        btn.addEventListener('click', function(){
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var rows = currentRows();
          rows.splice(idx, 1);
          saveRows(rows);
          assessRowsEl.innerHTML = assessmentRowsHtml(rows, rtlBind);
          bindRowInputs();
          refreshAssessmentTotal();
        });
      });
    }
    bindRowInputs();

    var quickAddEl = container.querySelector('#assessmentQuickAdd');
    if(quickAddEl){
      quickAddEl.querySelectorAll('.aq-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          var rows = currentRows();
          rows.push({ label: btn.getAttribute('data-preset') || '', score: '', max: '' });
          saveRows(rows);
          assessRowsEl.innerHTML = assessmentRowsHtml(rows, rtlBind);
          bindRowInputs();
          refreshAssessmentTotal();
          var newScoreInput = assessRowsEl.querySelector('.assessment-row[data-idx="' + (rows.length - 1) + '"] .ar-score');
          if(newScoreInput){ newScoreInput.focus(); }
        });
      });
    }

    if(assessApplyBtn && gradeSelect){
      assessApplyBtn.addEventListener('click', function(){
        if(!pendingLetter) return;
        gradeSelect.value = pendingLetter;
        if(window.__applyGradeChange){ window.__applyGradeChange(prefix, pid, pendingLetter); }
      });
    }

    var starEls = container.querySelectorAll('#difficultyStars .star');
    starEls.forEach(function(star){
      star.addEventListener('click', function(){
        var val = parseInt(star.getAttribute('data-value'), 10);
        var ratings = window.AAUP_PERSONAL.loadRatings();
        var current = (ratings[pid] || {}).difficulty || 0;
        var next = (current === val) ? 0 : val; // clicking the active top star clears it
        ratings[pid] = ratings[pid] || {};
        ratings[pid].difficulty = next;
        window.AAUP_PERSONAL.saveRatings(ratings);
        starEls.forEach(function(s){
          var v = parseInt(s.getAttribute('data-value'), 10);
          s.classList.toggle('filled', v <= next);
          s.textContent = v <= next ? '★' : '☆';
        });
        window.AAUP_PERSONAL.refreshCard(prefix, slug);
      });
    });

    container.querySelectorAll('.workload-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var val = btn.getAttribute('data-workload');
        var ratings = window.AAUP_PERSONAL.loadRatings();
        ratings[pid] = ratings[pid] || {};
        var current = ratings[pid].workload;
        ratings[pid].workload = (current === val) ? null : val; // click active level to clear it
        window.AAUP_PERSONAL.saveRatings(ratings);
        container.querySelectorAll('.workload-btn').forEach(function(b){ b.classList.remove('active'); });
        if(ratings[pid].workload) btn.classList.add('active');
        window.AAUP_PERSONAL.refreshCard(prefix, slug);
      });
    });

    var notesArea = container.querySelector('#courseNotesTextarea');
    if(notesArea){
      notesArea.addEventListener('input', function(){
        var notes = window.AAUP_PERSONAL.loadNotes();
        if(notesArea.value.trim()){ notes[pid] = notesArea.value; } else { delete notes[pid]; }
        window.AAUP_PERSONAL.saveNotes(notes);
        window.AAUP_PERSONAL.refreshCard(prefix, slug);
      });
    }

    var removeBtn = container.querySelector('#courseRemoveBtn');
    if(removeBtn && window.AAUP_REMOVED){
      removeBtn.addEventListener('click', function(){
        var slugForRemove = container.getAttribute('data-slug') || slug;
        var currentlyRemoved = window.AAUP_REMOVED.isRemoved(prefix, slugForRemove);
        window.AAUP_REMOVED.setRemoved(prefix, slugForRemove, !currentlyRemoved);
        // Close the popup — the card it described is now hidden (or back).
        var ov = container.closest('.modal-overlay');
        if(ov){ ov.classList.remove('open'); }
        else {
          var openOv = document.querySelector('.modal-overlay.open, #impCourseModalOverlay.open');
          if(openOv){ openOv.classList.remove('open'); }
        }
      });
    }
  }

  window.__renderCourseModalExtras = render;
  window.__bindCourseModalExtras = bind;
})();
