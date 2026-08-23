// ==========================
// ROADMAP — "Your path through <major>"
// ==========================
// A year-by-year overview of the whole degree in one screen, shown once
// automatically the first time a student opens a plan's Dashboard (an
// orientation step, not a nag — never shown again after that, and always
// reachable afterward from the sidebar or the Dashboard's quicklinks).
// Built the same way js/06-per.js and js/07-plan-overview-print.js already
// group a plan by year: walk the rendered .year-row/.sem (built-in) or
// .imp-year-block/.imp-semester-block (imported) DOM rather than
// re-deriving the grouping from raw data — one source of truth for "what
// year is this course in," the one the page itself is already showing.
(function(){
  var SEEN_PREFIX = 'aaup_roadmapSeen_';
  var MAX_PREVIEW = 4;

  function esc(s){ return window.__escapeHtml ? window.__escapeHtml(String(s)) : String(s); }

  function hasSeen(prefix){
    try{ return localStorage.getItem(SEEN_PREFIX + prefix) === '1'; }catch(e){ return true; }
  }
  function markSeen(prefix){
    try{ localStorage.setItem(SEEN_PREFIX + prefix, '1'); }catch(e){}
  }

  function courseFrom(el, info, progress){
    var parts = window.__splitCourseId ? window.__splitCourseId(el.id) : null;
    if(!parts) return null;
    var meta = info[parts.slug] || {};
    var nameEl = el.querySelector('.name');
    var name = nameEl ? nameEl.textContent.replace(/\s*✓\s*$/, '').trim() : (meta.name || parts.slug);
    return { name: name, cr: meta.cr != null ? meta.cr : '', done: !!progress[el.id] };
  }

  // One row per year: { label, courses: [{name, cr, done}] }. Summer terms
  // and every regular semester within a year are flattened together — the
  // roadmap is a whole-year rollup, not a semester-by-semester one (that's
  // what My Full Study Plan and Overview & Print already do).
  function yearModel(prefix){
    var root = document.getElementById('page-' + prefix);
    if(!root) return [];
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var progress = window.__getProgress ? window.__getProgress() : {};
    var years = [];
    var builtIn = root.querySelectorAll('.year-row');
    if(builtIn.length){
      Array.prototype.slice.call(builtIn).forEach(function(yr){
        var label = (yr.querySelector('.year-badge .label') || {}).textContent || '';
        var courses = [];
        yr.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
          var c = courseFrom(el, info, progress); if(c) courses.push(c);
        });
        years.push({ label: label.replace(/\s+/g, ' ').trim(), courses: courses });
      });
    } else {
      // :not(.imp-elective-block) — the elective pool reuses the year-block
      // markup for its styling, but it is a menu of choices, not a year. It
      // must not appear as an extra node on the timeline between Year 5 and
      // graduation. It is still counted in the whole-plan scope, which walks
      // the page root rather than the year list.
      Array.prototype.slice.call(root.querySelectorAll('.imp-year-block:not(.imp-elective-block)')).forEach(function(yb){
        var label = (yb.querySelector('.imp-year-header h3') || {}).textContent || '';
        var courses = [];
        yb.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
          var c = courseFrom(el, info, progress); if(c) courses.push(c);
        });
        years.push({ label: label.replace(/\s+/g, ' ').trim(), courses: courses });
      });
    }
    return years;
  }

  // ---------------------------------------------------------------
  // Category breakdown ("what do I still owe, by requirement type")
  // ---------------------------------------------------------------
  // The university's own portal shows a degree as a set of requirement
  // buckets — University Req., University Elec., College Req., Spec. Req.,
  // Spec. Elec. — each with hours, earned, remaining and a course count, and
  // each marked Mandatory or Optional. That is the view a student actually
  // plans against, so My Path offers the same rollup: one per year, and one
  // for the whole degree.
  //
  // Two of the app's internal categories ('skills' and 'eng') are both
  // University Requirements and already share a label in the plan legend, so
  // they roll into a single bucket here rather than appearing twice.
  var CAT_BUCKET = {
    skills: 'univReq', eng: 'univReq', uni: 'univElec',
    math: 'colgReq', core: 'specReq', dept: 'specElec', free: 'freeElec'
  };
  var BUCKET_ORDER = ['univReq', 'univElec', 'colgReq', 'specReq', 'specElec', 'freeElec'];
  var BUCKET_META = {
    univReq:  { en: 'Univ. Req.',  ar: 'متطلب جامعي',          optional: false },
    univElec: { en: 'Univ. Elec.', ar: 'اختياري جامعي',        optional: true  },
    colgReq:  { en: 'Colg. Req.',  ar: 'متطلب كلية',           optional: false },
    specReq:  { en: 'Spec. Req.',  ar: 'متطلب تخصص',           optional: false },
    specElec: { en: 'Spec. Elec.', ar: 'اختياري تخصص',         optional: true  },
    freeElec: { en: 'Free Elec.',  ar: 'اختياري حر',           optional: true  }
  };

  // CAT_BUCKET is a GUESS, and it was wrong wherever the two taxonomies do not
  // line up. A course's visual category says what colour its card is; the
  // university's requirement bucket says which requirement it satisfies, and
  // the same colour serves different buckets in different degrees. That is why
  // this screen reported 11 University Requirement hours where the student
  // portal says 14, and why College and Specialization could not be told apart
  // at all — nothing in the data distinguished them.
  //
  // Plans built from a published university plan now carry the real bucket per
  // course (`req`). Use it when it is there; fall back to the colour for majors
  // no published plan covers yet.
  function bucketOf(el, info){
    if(info){
      var parts = window.__splitCourseId ? window.__splitCourseId(el.id) : null;
      var meta = parts ? info[parts.slug] : null;
      if(meta && meta.req && BUCKET_META[meta.req]) return meta.req;
    }
    for(var k in CAT_BUCKET){
      if(Object.prototype.hasOwnProperty.call(CAT_BUCKET, k) && el.classList.contains(k)) return CAT_BUCKET[k];
    }
    return null;
  }

  // scope: null for the whole plan, or a year index for just that year.
  // Reads the rendered page for the same reason yearModel does — the DOM is
  // the one place that already knows which year a course ended up in.
  function categoryModel(prefix, scopeYearIndex){
    var root = document.getElementById('page-' + prefix);
    if(!root) return [];
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var progress = window.__getProgress ? window.__getProgress() : {};

    var blocks;
    if(scopeYearIndex == null){
      blocks = [root];
    } else if(scopeYearIndex === 'electives'){
      // The specialization/free/university elective pool is not a year — the
      // plan does not schedule it — but it IS credit hours you owe, so it
      // gets its own stop on the track rather than vanishing from the total.
      blocks = Array.prototype.slice.call(root.querySelectorAll('.imp-elective-block'));
    } else {
      var all = root.querySelectorAll('.year-row').length
        ? root.querySelectorAll('.year-row')
        : root.querySelectorAll('.imp-year-block:not(.imp-elective-block)');
      blocks = all[scopeYearIndex] ? [all[scopeYearIndex]] : [];
    }

    var acc = {};
    BUCKET_ORDER.forEach(function(k){ acc[k] = { hours: 0, earned: 0, courses: 0, done: 0 }; });

    var seen = {};
    blocks.forEach(function(block){
      // __dedupeForCredit collapses a lecture and its lab — one registered
      // course, one catalogue number, one credit value — into a single entry.
      // Without it this screen counted both halves and reported 137 CH for a
      // 129 CH degree while the Degree Audit, which does dedupe, said 123.
      var countable = window.__dedupeForCredit
        ? window.__dedupeForCredit(prefix, block.querySelectorAll('.course[id]:not(.course-removed)'))
        : Array.prototype.slice.call(block.querySelectorAll('.course[id]:not(.course-removed)'));
      countable.forEach(function(el){
        var b = bucketOf(el, info);
        if(!b) return;
        if(seen[el.id]) return;
        seen[el.id] = true;
        var parts = window.__splitCourseId ? window.__splitCourseId(el.id) : null;
        var meta = parts ? info[parts.slug] : null;
        var cr = meta ? (parseFloat(meta.cr) || 0) : 0;
        acc[b].hours += cr;
        acc[b].courses += 1;
        if(progress[el.id]){ acc[b].earned += cr; acc[b].done += 1; }
      });
    });

    // A bucket is worth what the university REQUIRES, which is not the same as
    // the sum of the cards drawn in it, in both directions:
    //
    //   too many — an elective pool lists every option a student may choose
    //   from. Computer Science draws 16 specialization electives worth 48
    //   hours for a 9-hour requirement.
    //   too few  — a plan can simply be short a slot. GIS drew three 2-hour
    //   University Electives against a requirement of 8.
    //
    // Where the published plan states the hours, they win. This is the whole
    // degree only: a single YEAR is worth exactly the cards sitting in it, so
    // year rollups keep counting cards.
    var required = scopeYearIndex == null
      ? ((window.__PLAN_DATA[prefix] || {}).requirementHours || {}) : {};
    BUCKET_ORDER.forEach(function(k){
      var need = required[k];
      if(typeof need !== 'number' || acc[k].courses === 0) return;
      if(need < acc[k].hours && acc[k].courses > 0){
        // A pool: record how many of the offered courses actually count, so
        // the row can say "pick 3 of 16" instead of silently shrinking.
        var unit = acc[k].hours / acc[k].courses;
        if(unit > 0) acc[k].requiredCount = Math.round(need / unit);
      }
      acc[k].hours = need;
      // Earned can never exceed what the requirement is worth.
      if(acc[k].earned > need) acc[k].earned = need;
      if(acc[k].requiredCount != null && acc[k].done > acc[k].requiredCount){
        acc[k].done = acc[k].requiredCount;
      }
    });

    // Majors with no published plan behind them keep the old per-plan count,
    // which is hand-maintained in web/js/11-module11.js and only ever covered
    // the specialization pool.
    var deptRequired = (window.__DEPT_REQUIRED || {})[prefix];
    if(typeof required.specElec !== 'number' &&
       typeof deptRequired === 'number' && acc.specElec.courses > deptRequired){
      var du = acc.specElec.hours / acc.specElec.courses;   // even pools: one credit value
      acc.specElec.hours = du * deptRequired;
      acc.specElec.requiredCount = deptRequired;
      if(acc.specElec.earned > acc.specElec.hours) acc.specElec.earned = acc.specElec.hours;
      if(acc.specElec.done > deptRequired) acc.specElec.done = deptRequired;
    }

    return BUCKET_ORDER.filter(function(k){ return acc[k].courses > 0; }).map(function(k){
      var a = acc[k];
      return {
        pickOf: a.requiredCount != null ? { need: a.requiredCount, from: a.courses } : null,
        key: k, meta: BUCKET_META[k],
        hours: a.hours, earned: a.earned,
        remaining: Math.max(0, a.hours - a.earned),
        courses: a.courses, done: a.done,
        pct: a.hours > 0 ? Math.round(a.earned / a.hours * 100) : 0
      };
    });
  }

  // The credit hours a single year is worth, counting each registered course
  // once (lecture + lab = one course).
  function yearHours(prefix, yearIndex){
    var rows = categoryModel(prefix, yearIndex);
    var h = 0;
    rows.forEach(function(r){ h += r.hours; });
    return h;
  }

  // What the university says the degree is worth, when the plan carries it.
  function officialHours(prefix){
    var plan = (window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[prefix]) || null;
    var h = plan && parseFloat(plan.degreeHours);
    return (h && isFinite(h) && h > 0) ? h : null;
  }

  // Said out loud when our own course list does not add up to the official
  // total — better an honest "we are 6 hours short of the published plan"
  // than a confident wrong number.
  function planTotalNote(prefix, computed, rtl){
    var official = officialHours(prefix);
    if(!official) return '';
    var diff = Math.round(computed - official);
    if(Math.abs(diff) < 0.5) return '';
    return '<p class="ro-total-note">' + (rtl
      ? ('الخطة الرسمية ' + official + ' ساعة، والمساقات المسجّلة هنا مجموعها ' + Math.round(computed) +
         ' — أي فرق ' + Math.abs(diff) + ' ساعة. قائمة المساقات بحاجة إلى مراجعة.')
      : ('The official degree is ' + official + ' CH; the courses recorded here add up to ' + Math.round(computed) +
         ' — a ' + Math.abs(diff) + ' CH gap. This plan\u2019s course list needs a review.')) + '</p>';
  }

  function breakdownHTML(prefix, scopeYearIndex, rtl){
    var rows = categoryModel(prefix, scopeYearIndex);
    if(!rows.length){
      return '<p class="ro-empty">' + (rtl ? 'لا مساقات في هذا النطاق.' : 'No courses in this scope.') + '</p>';
    }
    var hours = 0, earned = 0, courses = 0;
    rows.forEach(function(r){ hours += r.hours; earned += r.earned; courses += r.courses; });
    var pct = hours > 0 ? Math.round(earned / hours * 100) : 0;
    var remaining = Math.max(0, hours - earned);

    var head =
      '<div class="ro-bd-summary">' +
        '<div class="ro-bd-figures">' +
          '<div class="ro-bd-fig"><span class="ro-bd-fig-label">' + (rtl ? 'الساعات' : 'Hours') + '</span><b>' + Math.round(hours) + '</b></div>' +
          '<div class="ro-bd-fig"><span class="ro-bd-fig-label">' + (rtl ? 'المساقات' : 'Courses') + '</span><b>' + courses + '</b></div>' +
          '<div class="ro-bd-fig"><span class="ro-bd-fig-label">' + (rtl ? 'الفئات' : 'Categories') + '</span><b>' + rows.length + '</b></div>' +
        '</div>' +
        '<div class="ro-bd-ring" style="--ro-pct:' + pct + ';"><span>' + pct + '%</span></div>' +
      '</div>' +
      '<div class="ro-bd-totals">' +
        '<div class="ro-bd-total ro-bd-total-earned"><b>' + Math.round(earned) + '</b><span>' + (rtl ? 'ساعة مكتسبة' : 'Earned Hours') + '</span></div>' +
        '<div class="ro-bd-total ro-bd-total-left"><b>' + Math.round(remaining) + '</b><span>' + (rtl ? 'ساعة متبقية' : 'Remaining Hours') + '</span></div>' +
      '</div>';

    var cards = rows.map(function(r){
      return '<div class="ro-bd-cat">' +
        '<div class="ro-bd-cat-head">' +
          '<span class="ro-bd-cat-name">' + esc(rtl ? r.meta.ar : r.meta.en) + '</span>' +
          '<span class="ro-bd-cat-tag' + (r.meta.optional ? ' ro-bd-cat-tag-opt' : '') + '">' +
            (r.meta.optional ? (rtl ? '(اختياري)' : '(Optional)') : (rtl ? '(إجباري)' : '(Mandatory)')) +
          '</span>' +
          (r.pickOf
            ? '<span class="ro-bd-cat-pick">' + (rtl
                ? ('اختر ' + r.pickOf.need + ' من ' + r.pickOf.from)
                : ('pick ' + r.pickOf.need + ' of ' + r.pickOf.from)) + '</span>'
            : '') +
        '</div>' +
        '<div class="ro-bd-bar"><span style="width:' + r.pct + '%;"></span></div>' +
        '<div class="ro-bd-stats">' +
          '<div><b>' + Math.round(r.hours) + '</b><span>' + (rtl ? 'ساعات' : 'Hours') + '</span></div>' +
          '<div><b>' + Math.round(r.earned) + '</b><span>' + (rtl ? 'مكتسبة' : 'Earned') + '</span></div>' +
          '<div><b>' + Math.round(r.remaining) + '</b><span>' + (rtl ? 'متبقية' : 'Remaining') + '</span></div>' +
          '<div><b>' + r.done + '/' + (r.pickOf ? r.pickOf.need : r.courses) + '</b><span>' + (rtl ? 'مساقات' : 'Courses') + '</span></div>' +
        '</div>' +
      '</div>';
    }).join('');

    return head + '<div class="ro-bd-cats">' + cards + '</div>';
  }

  // done: every course in the year is passed. current: the first
  // not-done year (where the student actually is). future: every year
  // after that. A year with zero courses (a shell added ahead of time)
  // counts as future, not done — nothing to have finished yet.
  function statusFor(years){
    var seenCurrent = false;
    return years.map(function(y){
      if(seenCurrent) return 'future';
      var allDone = y.courses.length > 0 && y.courses.every(function(c){ return c.done; });
      if(allDone) return 'done';
      seenCurrent = true;
      return 'current';
    });
  }

  function layoutHTML(prefix, rtl){
    var years = yearModel(prefix);
    if(!years.length) return '<p class="ro-empty">' + (rtl ? 'لا توجد بيانات لعرضها.' : 'Nothing to show yet.') + '</p>';
    var statuses = statusFor(years);

    var dash = window.AAUP_DASHBOARD;
    var info = dash && dash.planDisplayInfo ? dash.planDisplayInfo(prefix) : { icon: '🎓', name: prefix };
    var uni = (window.APP_UNIVERSITIES || {})[(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[prefix] || {}).university || 'aaup'];

    // info.name is the dashboard's own header string — major name PLUS
    // "B.Sc. · 129 CH · Program 29112" baked on. Right for a page whose own
    // heading is the whole plan; too much for "Your path through ___", which
    // wants just the major's name on its own line, same as My Path's own
    // mockup ("Your path through" / "Artificial Intelligence & Innovation").
    var importedPlan = window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[prefix];
    var majorName = importedPlan && window.AAUP_IMPORTED.nameParts
      ? (window.AAUP_IMPORTED.nameParts(rtl ? importedPlan.majorName.ar : importedPlan.majorName.en).big || info.name || prefix)
      : (info.name || prefix);

    // The header number and the breakdown panel underneath it used to be
    // computed two different ways and disagreed out loud (137 CH in the panel,
    // 123 in the node). Both read categoryModel now. When the plan declares
    // its official degree hours, that wins — it is the number on the
    // university's own page, and a mismatch means our course list is
    // incomplete, which planTotalNote() says in as many words.
    var totalCr = 0, doneCr = 0;
    categoryModel(prefix, null).forEach(function(r){ totalCr += r.hours; doneCr += r.earned; });
    var computedCr = totalCr;
    var official = officialHours(prefix);
    if(official){ totalCr = official; }
    var pct = totalCr ? Math.round(doneCr / totalCr * 100) : 0;
    var gpaResult = window.AAUP_GPA ? window.AAUP_GPA.gpaFor(prefix, null) : { gpa: null };
    var gpaText = gpaResult && gpaResult.gpa != null ? gpaResult.gpa.toFixed(2) : '—';
    var chLeft = Math.max(0, totalCr - doneCr);

    var STATUS_LABEL = {
      done: rtl ? 'منتهية' : 'done',
      current: rtl ? 'أنت هنا' : 'you are here',
      future: null
    };

    var timelineParts = [];
    years.forEach(function(y, i){
      var st = statuses[i];
      // Deduped the same way as the breakdown below — a lecture and its lab
      // are one registered course, so Year 1 read 48 CH when it is 44.
      var chSum = yearHours(prefix, i);
      // Each node is a button. On desktop, pressing a year swaps the shared
      // breakdown panel further down the page to that year's requirement
      // buckets. On phone (see bindScopeTabs) it instead expands the
      // .ro-inline-panel right below THIS card — an accordion, one open at a
      // time, with the chevron flipping to say which — because "press a
      // year, the answer appears somewhere else on the screen" was never
      // the ask; the answer belongs right where you pressed.
      timelineParts.push(
        '<button type="button" class="ro-node-wrap" data-ro-scope="' + i + '"' +
          ' aria-expanded="false"' +
          ' aria-label="' + esc((rtl ? 'تفصيل ' : 'Breakdown for ') + (y.label || ((rtl ? 'سنة ' : 'Year ') + (i + 1)))) + '">' +
          '<div class="ro-node ro-node-' + st + '"></div>' +
          '<div class="ro-node-body">' +
          '<div class="ro-node-label">' + esc(y.label || ((rtl ? 'سنة ' : 'Year ') + (i + 1))) + '</div>' +
          // The status label used to REPLACE the hours, so the year you are
          // actually in was the one year whose size you could not see.
          '<div class="ro-node-sub">' +
            (STATUS_LABEL[st] ? esc(STATUS_LABEL[st]) + (chSum ? ' · ' + Math.round(chSum) + ' CH' : '')
                              : (chSum ? Math.round(chSum) + ' CH' : '')) +
          '</div>' +
          '</div>' +
          '<span class="ro-node-chevron">' + window.AAUP_ICONS.preview('chevron', 16) + '</span>' +
        '</button>' +
        '<div class="ro-inline-panel" data-ro-panel="' + i + '"></div>'
      );
      timelineParts.push('<div class="ro-connector ro-connector-' + st + '"></div>');
    });
    // Electives live outside the year blocks, so a plan like AI & Medical
    // Sciences showed Year 4 as 13 CH while 15 CH of specialization electives
    // belonged to that stage of the degree and appeared nowhere on the track.
    var electiveRows = categoryModel(prefix, 'electives');
    var electiveCr = 0, electivePick = null;
    electiveRows.forEach(function(r){
      electiveCr += r.hours;
      if(r.pickOf) electivePick = r.pickOf;
    });
    if(electiveCr > 0){
      timelineParts.push(
        '<button type="button" class="ro-node-wrap" data-ro-scope="electives"' +
          ' aria-expanded="false"' +
          ' aria-label="' + (rtl ? 'تفصيل المواد الاختيارية' : 'Breakdown for the electives you choose') + '">' +
          '<div class="ro-node ro-node-future"></div>' +
          '<div class="ro-node-body">' +
          '<div class="ro-node-label">' + (rtl ? 'اختيارية' : 'Electives') + '</div>' +
          '<div class="ro-node-sub">' + Math.round(electiveCr) + ' CH' +
            (electivePick ? ' · ' + (rtl
              ? ('اختر ' + electivePick.need + ' من ' + electivePick.from)
              : ('pick ' + electivePick.need + ' of ' + electivePick.from)) : '') +
          '</div>' +
          '</div>' +
          '<span class="ro-node-chevron">' + window.AAUP_ICONS.preview('chevron', 16) + '</span>' +
        '</button>' +
        '<div class="ro-inline-panel" data-ro-panel="electives"></div>'
      );
      timelineParts.push('<div class="ro-connector ro-connector-future"></div>');
    }
    // "Whole plan" is not part of the accordion — the static summary card
    // right after the timeline (see the .ro-breakdown section below) already
    // shows this at all times on phone, so there is nothing here for a press
    // to reveal; on phone this button just scrolls that card into view (see
    // bindScopeTabs). Desktop keeps its original behaviour untouched: this
    // is the shared panel's default selected node.
    timelineParts.push(
      '<button type="button" class="ro-node-wrap ro-node-wrap-plain" data-ro-scope="all"' +
        ' aria-label="' + (rtl ? 'تفصيل الخطة كاملة' : 'Breakdown for the whole plan') + '">' +
        '<div class="ro-node ro-node-future ro-node-grad"></div>' +
        '<div class="ro-node-body">' +
        '<div class="ro-node-label">' + (rtl ? 'الخطة كاملة' : 'Whole plan') + '</div>' +
        '<div class="ro-node-sub">' + (totalCr ? (Math.round(totalCr) + ' CH') : '') + '</div>' +
        '</div>' +
      '</button>'
    );
    var timelineHTML = '<div class="ro-timeline">' + timelineParts.join('') + '</div>';

    // "+ 16 more" was a plain div painted in the accent colour: it looked like
    // a link, and pressing it did nothing. It is a button now and opens the
    // rest of the year in place — which is what anyone pressing it expected.
    var dotCount = years.length + 1; // one dot per year card, plus the grad summary card
    var cardsHTML = '<div class="ro-swipe-dots" id="roCardsDots" aria-hidden="true">' +
        Array.from({ length: dotCount }).map(function(_, i){ return '<span class="' + (i === 0 ? 'active' : '') + '"></span>'; }).join('') +
      '</div>' +
      '<div class="ro-cards" id="roCards">' +
      years.map(function(y, i){
        var st = statuses[i];
        var shown = y.courses.slice(0, MAX_PREVIEW);
        var rest = y.courses.length - shown.length;
        return '<div class="ro-card ro-card-' + st + '" data-ro-card="' + i + '">' +
          y.courses.map(function(c, ci){
            return '<div class="ro-course' + (ci >= MAX_PREVIEW ? ' ro-course-extra' : '') + (c.done ? ' ro-course-done' : '') + '">' +
              '<span class="ro-course-check" aria-hidden="true">' + window.AAUP_ICONS.preview('check', 13) + '</span>' +
              '<span class="ro-course-name">' + esc(c.name) + '</span>' +
              (c.cr !== '' ? '<span class="ro-course-cr">' + esc(c.cr) + '</span>' : '') + '</div>';
          }).join('') +
          (rest > 0
            ? '<button type="button" class="ro-more" data-ro-expand="' + i + '"' +
              ' aria-expanded="false">' +
              '<span class="ro-more-open">+ ' + rest + (rtl ? ' أخرى' : ' more') + '</span>' +
              '<span class="ro-more-close">' + (rtl ? 'إخفاء' : 'Show less') + '</span></button>'
            : '') +
          (!y.courses.length ? '<p class="ro-empty" style="margin:0;">' + (rtl ? 'لا مساقات بعد' : 'No courses yet') + '</p>' : '') +
        '</div>';
      }).join('') +
      '<div class="ro-card ro-card-grad">' +
        '<div class="ro-course"><span class="ro-course-name" style="font-weight:800;">' + esc(totalCr ? Math.round(totalCr) : '?') + ' ' + (rtl ? 'ساعة معتمدة' : 'credit hours') + '</span></div>' +
        '<div class="ro-course"><span class="ro-course-name">' + (info.name || prefix) + '</span></div>' +
      '</div>' +
    '</div>';

    // majorName/info.name (from nameParts()/planDisplayInfo) are already
    // HTML-escaped once by the sync sanitizer — esc()'ing them again turned
    // a real "&" into a literal "&amp;" for majors like "Game Design & Development".
    return '<div class="ro-head">' +
      '<div><p class="ro-plan-label">' + (rtl ? 'مسارك عبر' : 'Your path through') + '</p>' +
      '<h2 style="margin:0;">' + majorName + '</h2>' +
      '<p class="form-note" style="margin-top:4px;">' + (rtl
        ? 'كل مساق، بالترتيب الذي تتطلبه الدرجة — وأين أنت منه الآن.'
        : 'Every course, in the order the degree expects — and where you are on it right now.') + '</p></div>' +
      (uni ? '<div class="ro-uni">AAUPath · ' + esc(uni.name.en) + '</div>' : '') +
      '</div>' +
      timelineHTML +
      '<div class="ro-breakdown" id="roBreakdown">' +
        '<div class="ro-bd-head"><h3 id="roBreakdownTitle">' + (rtl ? 'الخطة كاملة' : 'Whole plan') + '</h3>' +
        // On phone this panel never changes — pressing a year expands its
        // own card in place instead — so the hint has to say that, not the
        // desktop instruction ("press any year to see its breakdown here").
        '<p class="form-note" style="margin:2px 0 0;">' + ((window.matchMedia && window.matchMedia('(max-width:720px)').matches)
          ? (rtl ? 'تفصيل كامل عبر كل فئات المتطلبات.' : 'Your full breakdown across every requirement category.')
          : (rtl ? 'اضغط أي سنة في الشريط أعلاه لعرض تفصيلها.' : 'Press any year on the track above to see its breakdown.')) + '</p></div>' +
        '<div id="roBreakdownBody">' + breakdownHTML(prefix, null, rtl) + '</div>' +
        planTotalNote(prefix, computedCr, rtl) +
      '</div>' +
      cardsHTML +
      '<div class="ro-summary">' +
        '<div class="ro-summary-pct"><b>' + pct + '%</b><span>' + (rtl ? 'مكتمل' : 'complete') + '</span></div>' +
        '<div class="ro-summary-bar"><span style="width:' + pct + '%;"></span></div>' +
        '<div class="ro-summary-stat"><b>' + gpaText + '</b><span>' + (rtl ? 'المعدل' : 'GPA') + '</span></div>' +
        '<div class="ro-summary-stat"><b>' + Math.round(chLeft) + '</b><span>' + (rtl ? 'ساعة متبقية' : 'CH left') + '</span></div>' +
      '</div>';
  }

  function open(prefix){
    var overlay = document.getElementById('roadmapModalOverlay');
    var body = document.getElementById('roadmapModalBody');
    if(!overlay || !body) return;
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    body.innerHTML = layoutHTML(prefix, rtl);
    bindScopeTabs(body, prefix, rtl);
    bindCardSwipeDots(body);
    overlay.classList.add('open');
    markSeen(prefix);
  }
  // .ro-cards is rebuilt fresh on every open() (it lives inside body's own
  // innerHTML, unlike .ro-timeline/#roBreakdownBody which bindScopeTabs
  // rebinds delegated on body itself), so a plain listener here — no
  // once-only guard needed — never goes stale.
  function bindCardSwipeDots(body){
    var cards = body.querySelector('#roCards');
    var dots = body.querySelector('#roCardsDots');
    if(!cards || !dots) return;
    var dotEls = dots.querySelectorAll('span');
    cards.addEventListener('scroll', function(){
      var idx = Math.round(cards.scrollLeft / Math.max(1, cards.clientWidth));
      dotEls.forEach(function(d, i){ d.classList.toggle('active', i === idx); });
    }, { passive: true });
  }
  // Delegated so it survives the breakdown body being replaced on every press.
  function bindScopeTabs(body, prefix, rtl){
    var track = body.querySelector('.ro-timeline');
    var titleEl = body.querySelector('#roBreakdownTitle');
    var bodyEl = body.querySelector('#roBreakdownBody');
    if(!track || !bodyEl) return;
    var isPhone = window.matchMedia && window.matchMedia('(max-width:720px)').matches;

    if(isPhone){
      // Accordion: pressing a year expands the .ro-inline-panel right below
      // THAT card — one open at a time, closing whichever other one was
      // open — instead of a shared panel further down the page changing out
      // from under a press somewhere else on screen. "Whole plan" sits
      // outside the accordion: its own numbers are always on screen already
      // (the static card right after the timeline, #roBreakdown), so a
      // press there just scrolls to it rather than expanding anything.
      track.addEventListener('click', function(e){
        var btn = e.target.closest('[data-ro-scope]');
        if(!btn) return;
        var scope = btn.getAttribute('data-ro-scope');
        if(scope === 'all'){
          if(bodyEl.closest('#roBreakdown')) bodyEl.closest('#roBreakdown').scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        var panel = track.querySelector('.ro-inline-panel[data-ro-panel="' + scope + '"]');
        if(!panel) return;
        var wasOpen = btn.classList.contains('ro-node-open');
        track.querySelectorAll('.ro-node-wrap.ro-node-open').forEach(function(openBtn){
          openBtn.classList.remove('ro-node-open');
          openBtn.setAttribute('aria-expanded', 'false');
          var openPanel = track.querySelector('.ro-inline-panel[data-ro-panel="' + openBtn.getAttribute('data-ro-scope') + '"]');
          if(openPanel) openPanel.classList.remove('ro-inline-panel-open');
        });
        if(!wasOpen){
          btn.classList.add('ro-node-open');
          btn.setAttribute('aria-expanded', 'true');
          if(!panel.__roFilled){
            var idx = scope === 'electives' ? 'electives' : Number(scope);
            panel.innerHTML = breakdownHTML(prefix, idx, rtl);
            panel.__roFilled = true;
          }
          panel.classList.add('ro-inline-panel-open');
        }
      });
      return bindExpandButtons(body);
    }

    var select = function(btn){
      var scope = btn.getAttribute('data-ro-scope');
      track.querySelectorAll('[data-ro-scope]').forEach(function(b){ b.classList.remove('ro-node-active'); });
      btn.classList.add('ro-node-active');
      var idx = scope === 'all' ? null : (scope === 'electives' ? 'electives' : Number(scope));
      bodyEl.innerHTML = breakdownHTML(prefix, idx, rtl);
      if(titleEl){
        var lbl = btn.querySelector('.ro-node-label');
        titleEl.textContent = lbl ? lbl.textContent : (rtl ? 'الخطة كاملة' : 'Whole plan');
      }
    };
    track.addEventListener('click', function(e){
      var btn = e.target.closest('[data-ro-scope]');
      if(btn) select(btn);
    });
    var initial = track.querySelector('[data-ro-scope="all"]');
    if(initial) initial.classList.add('ro-node-active');

    bindExpandButtons(body);
  }

  // "+ N more" opens the rest of that year's swipeable-card course list in
  // place. Bound to the modal body, which SURVIVES a re-render (only its
  // innerHTML is replaced), so it must be bound exactly once — open() can
  // run more than once for the same plan, and two copies of this handler
  // toggled the class on and straight back off, which looked exactly like
  // the button being dead.
  function bindExpandButtons(body){
    if(body.__roExpandBound) return;
    body.__roExpandBound = true;
    body.addEventListener('click', function(e){
      var btn = e.target.closest('[data-ro-expand]');
      if(!btn) return;
      var card = btn.closest('.ro-card');
      if(!card) return;
      var open = card.classList.toggle('ro-card-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function close(){
    var overlay = document.getElementById('roadmapModalOverlay');
    if(overlay){ overlay.classList.remove('open'); }
  }

  // Called from the Dashboard's own open() — auto-shows once per plan,
  // then never again. A plan the student is switching back to (already
  // seen) opens straight to the Dashboard as always.
  function openIfFirstVisit(prefix){
    if(hasSeen(prefix)) return;
    open(prefix);
  }

  function initModalClose(){
    var closeBtn = document.getElementById('roadmapModalClose');
    var overlay = document.getElementById('roadmapModalOverlay');
    if(closeBtn){ closeBtn.addEventListener('click', close); }
    if(overlay){ overlay.addEventListener('click', function(e){ if(e.target === overlay){ close(); } }); }
    // Same keyboard escape hatch the other modals have.
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && overlay && overlay.classList.contains('open')){ close(); } });
  }
  if(document.readyState === 'complete'){ initModalClose(); }
  else { window.addEventListener('load', initModalClose); }

  window.AAUP_ROADMAP = { open: open, close: close, openIfFirstVisit: openIfFirstVisit };
})();
