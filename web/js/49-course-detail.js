// ==========================
// COURSE DETAIL
// ==========================
// The panel that opens when a course is tapped, anywhere in the app.
//
// What it replaced was a list of six label/value rows — course number, name,
// credit hours, prerequisite, theoretical, practical — and then the grade
// controls. Every fact was there and none of it answered the question a
// student actually opens a course to ask, which is never "how many theoretical
// hours is this". It is "can I take this, and what happens if I don't".
//
// The prerequisite row was the worst of it. It printed the names of the
// courses this one needs, with no indication of whether you had passed them,
// so the one field that decides whether the course is even available to you
// was the one you had to work out yourself.
//
// So the panel leads with status and reasoning:
//
//   Why you can take this now   — the chain, with each link showing its state
//   What it opens               — what stops being reachable if you skip it
//   Your grade                  — unchanged, still js/21-course-modal-extras.js
//   Details                     — the reference facts, kept, moved to the side
//
// It renders the same on a phone and a desktop: two columns become one, and
// nothing is hidden at the narrow size — a student on a phone between lectures
// is the common case, not the degraded one.
//
// This module only builds markup and answers questions about state. It stores
// nothing and decides nothing: grades, progress and prerequisites all stay
// where they were (js/11-module11.js, js/21-course-modal-extras.js,
// js/02-shared-cross.js), because those are load-bearing and this is a view.
(function(){
  'use strict';

  function esc(s){ return window.__escapeHtml(s == null ? '' : String(s)); }

  var L = {
    en: {
      why: 'Why you can take this now',
      whyLocked: 'Why this is locked',
      whyDone: 'You have passed this',
      opens: 'What it opens',
      noOpens: 'Nothing else in this plan waits on it.',
      noNeeds: 'No prerequisites — you can take this in any term it is offered.',
      details: 'Details',
      ch: 'Credit hours', chShort: 'CH', th: 'Theoretical', pr: 'Practical',
      cat: 'Category', ar: 'Arabic name', code: 'Course code',
      term: 'Planned term', unscheduled: 'not scheduled',
      passed: 'Passed', open: 'Unlocked', locked: 'Locked', progress: 'In progress',
      needAll: 'Still needed:', haveAll: 'All prerequisites passed.',
      opensCount: function(n){ return 'Taking this keeps ' + n + ' later course' + (n === 1 ? '' : 's') + ' on schedule.'; },
      credits: 'Credits', unlocksN: 'Unlocks', status: 'Status',
      viewTree: 'View in course tree'
    },
    ar: {
      why: 'لماذا يمكنك أخذ هذا المساق الآن',
      whyLocked: 'لماذا هذا المساق مغلق',
      whyDone: 'لقد أنجزت هذا المساق',
      opens: 'ماذا يفتح لك',
      noOpens: 'لا يوجد مساق في الخطة ينتظر هذا المساق.',
      noNeeds: 'لا توجد متطلبات سابقة — يمكنك أخذه في أي فصل يُطرح فيه.',
      details: 'التفاصيل',
      ch: 'الساعات المعتمدة', chShort: 'س.م', th: 'نظري', pr: 'عملي',
      cat: 'التصنيف', ar: 'الاسم بالعربية', code: 'رقم المساق',
      term: 'الفصل المقرر', unscheduled: 'غير مجدول',
      passed: 'منجز', open: 'متاح', locked: 'مغلق', progress: 'قيد الدراسة',
      needAll: 'ما زال مطلوباً:', haveAll: 'جميع المتطلبات السابقة منجزة.',
      opensCount: function(n){ return 'أخذه الآن يبقي ' + n + ' مساقاً لاحقاً في موعده.'; },
      credits: 'الساعات', unlocksN: 'يفتح', status: 'الحالة',
      viewTree: 'اعرضه في شجرة المساقات'
    }
  };

  var CATS = {
    en: { skills:'Skills', core:'Core', math:'Math', dept:'Department',
          eng:'English', uni:'University', free:'Free elective' },
    ar: { skills:'مهارات', core:'إجباري', math:'رياضيات', dept:'تخصص',
          eng:'إنجليزي', uni:'متطلب جامعة', free:'متطلب حر' }
  };

  // A course is "passed" if the progress map says so. The id used there is the
  // primary one, because a lecture and its lab share a single grade — asking
  // about the lab half directly would report it unfinished forever.
  function isPassed(prefix, slug){
    var progress = window.__getProgress ? window.__getProgress() : {};
    var pid = (window.AAUP_GPA && window.AAUP_GPA.primaryId)
      ? window.AAUP_GPA.primaryId(prefix, slug)
      : (prefix + '-c-' + slug);
    return !!progress[pid];
  }

  // Returns HTML-safe text: courseInfo (name/ar) already passed through the
  // shared sanitizer's clean()/__cleanText when the plan was registered, so
  // callers must NOT esc() this again — that turned a real "&" into a
  // literal "&amp;" on screen (e.g. "Elementary Probability &amp; Statistics").
  function courseName(prefix, slug, rtl){
    var info = ((window.__PLAN_DATA[prefix] || {}).courseInfo || {})[slug] || {};
    if(rtl && info.ar) return info.ar;
    return info.name || info.en || slug;
  }

  function statusOf(prefix, slug){
    if(isPassed(prefix, slug)) return 'passed';
    var needs = ((window.__PLAN_DATA[prefix] || {}).needsMap || {})[slug] || [];
    var missing = needs.filter(function(n){ return !isPassed(prefix, n); });
    return missing.length ? 'locked' : 'open';
  }

  // Every prerequisite as a chip carrying its own state, so "why is this
  // locked" is answered by looking rather than by reading a paragraph.
  function chainHTML(prefix, slug, rtl, t){
    var needs = ((window.__PLAN_DATA[prefix] || {}).needsMap || {})[slug] || [];
    if(!needs.length) return '<p class="cd-note">' + t.noNeeds + '</p>';
    var missing = needs.filter(function(n){ return !isPassed(prefix, n); });
    var chips = needs.map(function(n){
      var ok = isPassed(prefix, n);
      return '<button type="button" class="cd-chip' + (ok ? ' is-ok' : ' is-missing') + '"' +
        ' data-goto="' + esc(n) + '">' + courseName(prefix, n, rtl) +
        (ok ? ' ✓' : '') + '</button>';
    }).join('');
    return '<p class="cd-note">' + (missing.length
        ? t.needAll + ' <strong>' + missing.map(function(n){ return courseName(prefix, n, rtl); }).join('، ') + '</strong>'
        : t.haveAll) + '</p>' +
      '<div class="cd-chain">' + chips +
      '<span class="cd-arrow">' + (rtl ? '←' : '→') + '</span>' +
      '<span class="cd-chip is-self">' + courseName(prefix, slug, rtl) + '</span></div>';
  }

  function opensHTML(prefix, slug, rtl, t){
    var unlocks = ((window.__PLAN_DATA[prefix] || {}).unlocksMap || {})[slug] || [];
    if(!unlocks.length) return '<p class="cd-note">' + t.noOpens + '</p>';
    return '<p class="cd-note">' + t.opensCount(unlocks.length) + '</p>' +
      '<div class="cd-chain">' + unlocks.map(function(u){
        return '<button type="button" class="cd-chip" data-goto="' + esc(u) + '">' +
          courseName(prefix, u, rtl) + '</button>';
      }).join('') + '</div>';
  }

  function row(k, v){
    if(v == null || v === '' || v === '-') return '';
    return '<div class="cd-row"><span>' + k + '</span><b>' + esc(v) + '</b></div>';
  }

  // Phone-only additions below (catChipHTML/statTilesHTML/miniChainHTML) —
  // desktop keeps the original cd-sub line + chainHTML()/opensHTML() prose
  // as its only content; these are extra markup hidden on desktop by CSS,
  // not a replacement for it, so nothing here needs its own RTL-desktop
  // parity beyond what already exists.
  function catChipHTML(course, cats){
    var cat = course && course.category;
    if(!cat) return '';
    return '<span class="cd-catchip cd-catchip-' + esc(cat) + '">' + esc(cats[cat] || cat) + '</span>';
  }

  function statTilesHTML(prefix, slug, course, t, st){
    var unlocks = ((window.__PLAN_DATA[prefix] || {}).unlocksMap || {})[slug] || [];
    var cr = course && course.creditHours != null ? course.creditHours : null;
    var stLabel = t[st === 'passed' ? 'passed' : st === 'locked' ? 'locked' : 'open'];
    var tiles = [];
    if(cr != null){
      tiles.push('<div class="cd-stat"><div class="cd-stat-n">' + esc(cr) + '</div><div class="cd-stat-l">' + t.credits + '</div></div>');
    }
    tiles.push('<div class="cd-stat"><div class="cd-stat-n">' + unlocks.length + '</div><div class="cd-stat-l">' + t.unlocksN + '</div></div>');
    tiles.push('<div class="cd-stat"><div class="cd-stat-n">' + esc(stLabel) + '</div><div class="cd-stat-l">' + t.status + '</div></div>');
    return '<div class="cd-stats">' + tiles.join('') + '</div>';
  }

  // A compact always-visible chain (just the chips, no paragraph) — the
  // verbose "why locked"/"what it opens" prose moves into the swipeable
  // slides below instead of stacking under this.
  function miniChainHTML(prefix, slug, rtl){
    var needs = ((window.__PLAN_DATA[prefix] || {}).needsMap || {})[slug] || [];
    if(!needs.length) return '';
    var parts = needs.map(function(n){
      var ok = isPassed(prefix, n);
      return '<button type="button" class="cd-prereq-chip' + (ok ? ' is-ok' : '') + '" data-goto="' + esc(n) + '">' +
        courseName(prefix, n, rtl) + '</button>';
    });
    return '<div class="cd-mini-chain">' + parts.join('<span class="cd-prereq-arrow">' + (rtl ? '←' : '→') + '</span>') + '</div>';
  }

  // course is the plan's own record (credit hours, term); info is the
  // registered course table (number, theoretical/practical split, Arabic name).
  function build(prefix, slug, course, rtl){
    var t = L[rtl ? 'ar' : 'en'];
    var cats = CATS[rtl ? 'ar' : 'en'];
    var info = ((window.__PLAN_DATA[prefix] || {}).courseInfo || {})[slug] || {};
    var st = statusOf(prefix, slug);
    var name = courseName(prefix, slug, rtl);
    var stLabel = t[st === 'passed' ? 'passed' : st === 'locked' ? 'locked' : 'open'];

    var term = course && course.yearId
      ? String(course.yearId).toUpperCase() +
        (course.semester ? ' · ' + String(course.semester).toUpperCase() : '')
      : t.unscheduled;

    var whyTitle = st === 'passed' ? t.whyDone : st === 'locked' ? t.whyLocked : t.why;
    var pid = (window.AAUP_GPA && window.AAUP_GPA.primaryId) ? window.AAUP_GPA.primaryId(prefix, slug) : (prefix + '-c-' + slug);

    return '<div class="cd" dir="' + (rtl ? 'rtl' : 'ltr') + '">' +
      '<div class="cd-head">' +
        '<div class="cd-title">' + catChipHTML(course, cats) + '<h3>' + name + '</h3>' +
          '<div class="cd-sub">' +
            [info.num || (course && course.courseNumber), term].filter(Boolean).map(esc).join(' · ') +
          '</div></div>' +
        '<span class="cd-pill cd-' + st + '">' + stLabel + '</span>' +
      '</div>' +
      statTilesHTML(prefix, slug, course, t, st) +
      miniChainHTML(prefix, slug, rtl) +
      '<div class="cd-body">' +
        '<div class="cd-main">' +
          '<div class="cd-slides" id="cdSlides">' +
            '<div class="cd-slide"><div class="cd-sec"><div class="cd-lbl">' + whyTitle + '</div>' +
              chainHTML(prefix, slug, rtl, t) + '</div></div>' +
            '<div class="cd-slide"><div class="cd-sec"><div class="cd-lbl">' + t.opens + '</div>' +
              opensHTML(prefix, slug, rtl, t) + '</div></div>' +
          '</div>' +
          '<div class="cd-swipe-dots" id="cdSlideDots"><span class="on"></span><span></span></div>' +
          '<div class="cd-extras"></div>' +
        '</div>' +
        '<div class="cd-side">' +
          '<div class="cd-lbl">' + t.details + '</div>' +
          row(t.code, info.num || (course && course.courseNumber)) +
          row(t.ch, course && course.creditHours != null ? course.creditHours : null) +
          row(t.th, info.th) +
          row(t.pr, info.pr) +
          row(t.cat, cats[(course && course.category) || ''] || '') +
          (!rtl && info.ar ? row(t.ar, info.ar) : '') +
          row(t.term, term) +
        '</div>' +
      '</div>' +
      '<div class="cd-actions">' +
        '<button type="button" class="cd-action-primary" id="cdViewTree" data-cd-view-tree="' + esc(pid) + '">' + t.viewTree + '</button>' +
      '</div>' +
      '</div>';
  }

  // Wires the swipe-dot indicator for #cdSlides and the "View in course
  // tree" action — called by the caller (js/28-imported.js openCourseModal)
  // right after the built HTML is inserted, same pattern as
  // __bindCourseModalExtras. No-ops harmlessly on desktop: .cd-slides
  // there is a normal stacked block with no scroll, so the scroll listener
  // just never fires.
  function bind(prefix, slug, container){
    if(!container) return;
    var slides = container.querySelector('#cdSlides');
    var dots = container.querySelector('#cdSlideDots');
    if(slides && dots){
      var dotEls = dots.querySelectorAll('span');
      slides.addEventListener('scroll', function(){
        var idx = Math.round(slides.scrollLeft / slides.clientWidth);
        dotEls.forEach(function(d, i){ d.classList.toggle('on', i === idx); });
      });
    }
    var viewTreeBtn = container.querySelector('[data-cd-view-tree]');
    if(viewTreeBtn){
      viewTreeBtn.addEventListener('click', function(){
        var overlay = container.closest('.modal-overlay');
        if(overlay) overlay.classList.remove('open');
        var pid = viewTreeBtn.getAttribute('data-cd-view-tree');
        var el = pid && document.getElementById(pid);
        if(el){
          setTimeout(function(){
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('cd-highlight');
            setTimeout(function(){ el.classList.remove('cd-highlight'); }, 1600);
          }, 50);
        }
      });
    }
  }

  window.AAUP_COURSE_DETAIL = { build: build, bind: bind, status: statusOf, isPassed: isPassed };
})();
