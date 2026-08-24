// ==========================
// FILTER, INSIDE THE METER
//
// "Show me only what I can take" used to be a switch in a row of its own,
// and it was removed for being a persistent setting answering a momentary
// question. This is the same question asked properly.
//
// It lives in the hours meter, which is the one thing on the plan that
// travels down the page (js/69-phone-header.js pins it and shrinks it), so
// the filter is still there four years down without a second sticky bar
// competing for the top of the screen.
//
// Deliberately NOT persisted — not to localStorage, not to sessionStorage.
// It resets when the plan is reopened, exactly like holding a year to peek
// at it. A filter that is still on tomorrow is how the old switch ended up
// leaving students looking at half a plan and wondering what happened.
//
// The filtering itself is CSS, keyed off one class on the plan root: hide
// the cards that do not match, then :has() hides any semester and any year
// left with nothing in it. That is why a filtered plan shows only the years
// that actually contain something — and why none of it disturbs the fold
// state the student chose, which is still there untouched when the filter
// comes off.
// ==========================
(function(){
  'use strict';

  var MODES = ['all', 'avail', 'locked', 'done'];
  var CLS = { avail: 'plan-f-avail', locked: 'plan-f-locked', done: 'plan-f-done' };
  // What each mode counts as a match — the same three states the CSS keys
  // off, written once so the empty state can never disagree with what is
  // actually on screen.
  var MATCH = {
    avail:  '.course.available:not(.completed)',
    locked: '.course:not(.available):not(.completed)',
    done:   '.course.completed'
  };
  var TX = {
    en: { all: 'All', avail: 'Open to me', locked: 'Locked', done: 'Passed',
          none: {
            avail: 'Nothing is open to you right now — finish something first and this fills up.',
            locked: 'Nothing is locked. Every course in this plan is open to you or already passed.',
            done: 'You have not marked anything as passed yet. Tick a course off and it shows up here.'
          },
          clear: 'Show everything' },
    ar: { all: 'الكل', avail: 'متاح لي', locked: 'مغلق', done: 'منجز',
          none: {
            avail: 'ما في إشي متاح إلك هلأ — خلّص إشي وبتبدا تظهر مساقات هون.',
            locked: 'ما في إشي مغلق. كل مساقات الخطة إما متاحة إلك أو منجزة.',
            done: 'لسا ما علّمت إشي كمنجز. علّم مساق وبيظهر هون.'
          },
          clear: 'اعرض الكل' }
  };

  // Per plan, in memory only. Reopening the plan starts at "all".
  var state = {};

  function root(prefix){ return document.getElementById('page-' + prefix); }
  function rtlFor(prefix){
    var page = root(prefix);
    return !!(page && page.classList.contains('rtl-mode'));
  }

  function apply(prefix){
    var page = root(prefix);
    if(!page) return;
    var mode = state[prefix] || 'all';
    Object.keys(CLS).forEach(function(k){ page.classList.toggle(CLS[k], k === mode); });
    page.classList.toggle('plan-filtering', mode !== 'all');
    var bar = page.querySelector('.pf-bar');
    if(bar){
      bar.querySelectorAll('[data-pf]').forEach(function(b){
        var on = b.getAttribute('data-pf') === mode;
        b.classList.toggle('pf-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
    // A filter that matches nothing leaves a blank plan and no explanation
    // of why — which reads as the app having broken rather than as an
    // honest answer. Say which it is, and offer the way out.
    var years = page.querySelector('.years');
    var empty = page.querySelector('.pf-empty');
    var matches = mode === 'all' ? 1 : page.querySelectorAll(MATCH[mode]).length;
    if(mode !== 'all' && !matches && years){
      if(!empty){
        empty = document.createElement('div');
        empty.className = 'pf-empty';
        years.parentNode.insertBefore(empty, years);
      }
      var t2 = TX[rtlFor(prefix) ? 'ar' : 'en'];
      empty.innerHTML = '<p>' + window.__escapeHtml(t2.none[mode]) + '</p>' +
        '<button type="button" class="home-btn" data-pf="all">' + window.__escapeHtml(t2.clear) + '</button>';
      empty.hidden = false;
    } else if(empty){
      empty.hidden = true;
    }

    // Filtering changes the layout the prerequisite lines were measured
    // against, so they have to be re-measured or they point at gaps.
    try{
      if(window.AAUP_IMPORTED && window.AAUP_IMPORTED.redrawConnectors){
        window.AAUP_IMPORTED.redrawConnectors(prefix);
      }
    }catch(e){}
  }

  function build(prefix){
    var page = root(prefix);
    if(!page) return;
    var meter = page.querySelector('.progress-widget');
    if(!meter || meter.querySelector('.pf-bar')) return;
    var t = TX[rtlFor(prefix) ? 'ar' : 'en'];
    var bar = document.createElement('div');
    bar.className = 'pf-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', rtlFor(prefix) ? 'تصفية الخطة' : 'Filter the plan');
    bar.innerHTML = MODES.map(function(m){
      return '<button type="button" class="pf-chip" data-pf="' + m + '" aria-pressed="false">' +
        window.__escapeHtml(t[m]) + '</button>';
    }).join('');
    meter.appendChild(bar);
    // Bound to the plan root, not the chip bar: the "show everything" button
    // in the empty state uses the same data-pf attribute, and it lives
    // outside the meter. Guarded because render() calls build() again on
    // every checkbox tick, and the root survives... except it does not —
    // render() replaces it — so the guard is per element, not per plan.
    if(page.__pfBound) return;
    page.__pfBound = true;
    page.addEventListener('click', function(e){
      var btn = e.target.closest('[data-pf]');
      if(!btn) return;
      var m = btn.getAttribute('data-pf');
      // Pressing the mode you are already in turns it off, so the way out
      // is the button you came in by rather than a hunt for "All".
      state[prefix] = (state[prefix] === m) ? 'all' : m;
      apply(prefix);
    });
  }

  function refresh(prefix){
    build(prefix);
    apply(prefix);
  }

  // A plan being opened afresh starts unfiltered.
  function reset(prefix){ delete state[prefix]; }

  window.__refreshPlanFilter = refresh;
  window.AAUP_PLAN_FILTER = { refresh: refresh, reset: reset };
})();
