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
      Array.prototype.slice.call(root.querySelectorAll('.imp-year-block')).forEach(function(yb){
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
      timelineParts.push(
        '<div class="ro-node-wrap">' +
          '<div class="ro-node ro-node-' + st + '"></div>' +
          '<div class="ro-node-label">' + esc(y.label || ((rtl ? 'سنة ' : 'Year ') + (i + 1))) + '</div>' +
          '<div class="ro-node-sub">' + (STATUS_LABEL[st] ? esc(STATUS_LABEL[st]) : (chSum ? Math.round(chSum) + ' CH' : '')) + '</div>' +
        '</div>'
      );
      timelineParts.push('<div class="ro-connector ro-connector-' + st + '"></div>');
    });
    timelineParts.push(
      '<div class="ro-node-wrap">' +
        '<div class="ro-node ro-node-future ro-node-grad"></div>' +
        '<div class="ro-node-label">' + (rtl ? 'التخرج' : 'Graduate') + '</div>' +
        '<div class="ro-node-sub">' + (totalCr ? (Math.round(totalCr) + ' CH') : '') + '</div>' +
      '</div>'
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
      timelineHTML + cardsHTML +
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
    overlay.classList.add('open');
    markSeen(prefix);
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
