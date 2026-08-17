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

  function bucketOf(el){
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
      block.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
        var b = bucketOf(el);
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

    // An elective pool offers more than the degree requires — this plan lists 4
    // specialization electives but you only take 2. Counting all four made the
    // whole-plan total read 135 CH against a 129 CH degree. Cap the bucket at
    // what is actually required, using the same per-plan count the Degree Audit
    // uses, so the two screens cannot disagree.
    var deptRequired = (window.__DEPT_REQUIRED || {})[prefix];
    if(typeof deptRequired === 'number' && acc.specElec.courses > deptRequired){
      var unit = acc.specElec.hours / acc.specElec.courses;   // even pools: one credit value
      acc.specElec.hours = unit * deptRequired;
      acc.specElec.requiredCount = deptRequired;
      // Earned can never exceed what the requirement is worth.
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

    var totalCr = 0, doneCr = 0;
    if(window.AAUP_AUDIT){
      window.AAUP_AUDIT.computeAudit(prefix).forEach(function(r){ totalCr += r.total; doneCr += r.completed; });
    }
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
      var chSum = y.courses.reduce(function(s, c){ return s + (parseFloat(c.cr) || 0); }, 0);
      // Each node is a button: pressing a year swaps the breakdown below to
      // that year's requirement buckets. That is the whole point of the
      // screen — "what do I still owe, and in which category".
      timelineParts.push(
        '<button type="button" class="ro-node-wrap" data-ro-scope="' + i + '"' +
          ' aria-label="' + esc((rtl ? 'تفصيل ' : 'Breakdown for ') + (y.label || ((rtl ? 'سنة ' : 'Year ') + (i + 1)))) + '">' +
          '<div class="ro-node ro-node-' + st + '"></div>' +
          '<div class="ro-node-label">' + esc(y.label || ((rtl ? 'سنة ' : 'Year ') + (i + 1))) + '</div>' +
          '<div class="ro-node-sub">' + (STATUS_LABEL[st] ? esc(STATUS_LABEL[st]) : (chSum ? Math.round(chSum) + ' CH' : '')) + '</div>' +
        '</button>'
      );
      timelineParts.push('<div class="ro-connector ro-connector-' + st + '"></div>');
    });
    timelineParts.push(
      '<button type="button" class="ro-node-wrap" data-ro-scope="all"' +
        ' aria-label="' + (rtl ? 'تفصيل الخطة كاملة' : 'Breakdown for the whole plan') + '">' +
        '<div class="ro-node ro-node-future ro-node-grad"></div>' +
        '<div class="ro-node-label">' + (rtl ? 'الخطة كاملة' : 'Whole plan') + '</div>' +
        '<div class="ro-node-sub">' + (totalCr ? (Math.round(totalCr) + ' CH') : '') + '</div>' +
      '</button>'
    );
    var timelineHTML = '<div class="ro-timeline">' + timelineParts.join('') + '</div>';

    var cardsHTML = '<div class="ro-cards">' +
      years.map(function(y, i){
        var st = statuses[i];
        var shown = y.courses.slice(0, MAX_PREVIEW);
        var rest = y.courses.length - shown.length;
        return '<div class="ro-card ro-card-' + st + '">' +
          shown.map(function(c){
            return '<div class="ro-course"><span class="ro-course-name">' + esc(c.name) + '</span>' +
              (c.cr !== '' ? '<span class="ro-course-cr">' + esc(c.cr) + '</span>' : '') + '</div>';
          }).join('') +
          (rest > 0 ? '<div class="ro-more">+ ' + rest + (rtl ? ' أخرى' : ' more') + '</div>' : '') +
          (!y.courses.length ? '<p class="ro-empty" style="margin:0;">' + (rtl ? 'لا مساقات بعد' : 'No courses yet') + '</p>' : '') +
        '</div>';
      }).join('') +
      '<div class="ro-card ro-card-grad">' +
        '<div class="ro-course"><span class="ro-course-name" style="font-weight:800;">' + esc(totalCr ? Math.round(totalCr) : '?') + ' ' + (rtl ? 'ساعة معتمدة' : 'credit hours') + '</span></div>' +
        '<div class="ro-course"><span class="ro-course-name">' + (info.name || prefix) + '</span></div>' +
      '</div>' +
    '</div>';

    // info.name (from planDisplayInfo) is already HTML-escaped once by the
    // sync sanitizer — esc()'ing it again turned a real "&" into a literal
    // "&amp;" for majors like "Game Design & Development".
    return '<div class="ro-head">' +
      '<div><h2 style="margin:0;">' + (rtl ? ('مسارك عبر ' + (info.name || prefix)) : ('Your path through ' + (info.name || prefix))) + '</h2>' +
      '<p class="form-note" style="margin-top:4px;">' + (rtl
        ? 'كل مساق، بالترتيب الذي تتطلبه الدرجة — وأين أنت منه الآن.'
        : 'Every course, in the order the degree expects — and where you are on it right now.') + '</p></div>' +
      (uni ? '<div class="ro-uni">AAUPath · ' + esc(uni.name.en) + '</div>' : '') +
      '</div>' +
      timelineHTML +
      '<div class="ro-breakdown" id="roBreakdown">' +
        '<div class="ro-bd-head"><h3 id="roBreakdownTitle">' + (rtl ? 'الخطة كاملة' : 'Whole plan') + '</h3>' +
        '<p class="form-note" style="margin:2px 0 0;">' + (rtl
          ? 'اضغط أي سنة في الشريط أعلاه لعرض تفصيلها.'
          : 'Press any year on the track above to see its breakdown.') + '</p></div>' +
        '<div id="roBreakdownBody">' + breakdownHTML(prefix, null, rtl) + '</div>' +
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
    overlay.classList.add('open');
    markSeen(prefix);
  }
  // Delegated so it survives the breakdown body being replaced on every press.
  function bindScopeTabs(body, prefix, rtl){
    var track = body.querySelector('.ro-timeline');
    var titleEl = body.querySelector('#roBreakdownTitle');
    var bodyEl = body.querySelector('#roBreakdownBody');
    if(!track || !bodyEl) return;
    var select = function(btn){
      var scope = btn.getAttribute('data-ro-scope');
      track.querySelectorAll('[data-ro-scope]').forEach(function(b){ b.classList.remove('ro-node-active'); });
      btn.classList.add('ro-node-active');
      var idx = scope === 'all' ? null : Number(scope);
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
