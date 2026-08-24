// ==========================
// THE TRAVELLING PROGRESS METER
//
// This file used to fold the entire plan header — brand block, title,
// five buttons, legend, two toggles, search, description, progress bar —
// behind one sticky bar with a chevron, plus a row of Y1..Y5 jump tabs and
// two icon chips. That was a lot of machinery to solve "there is too much
// above the courses". The header itself is the smaller problem now: the
// buttons moved to the menu, the toggles are gone, and every year folds on
// its own, so the plan already opens short.
//
// What is left is the one piece worth keeping in view while scrolling: the
// hours meter. It says how far through the degree the student is and what
// the nearest requirement still needs — the two facts that make a course
// card mean something. So it pins to the top and shrinks out of the way,
// dropping its caption and its padding, rather than scrolling off.
//
// The sticking itself is CSS (position:sticky on .progress-widget). All
// this file does is decide when the meter is in its compact form, which
// CSS cannot ask, and it does that from one scroll listener for the app's
// whole lifetime rather than one per plan render — render() replaces the
// plan root wholesale, and a per-root listener would be left holding a
// detached element after the very first re-render.
// ==========================
(function(){
  'use strict';

  // Far enough down that the meter has actually reached the top of the
  // viewport, so it does not shrink while still sitting in the header.
  var COMPACT_AT = 96;

  var watchStarted = false;

  function apply(y){
    var root = document.querySelector('.sheet-plan');
    if(!root || root.offsetParent === null) return;
    root.classList.toggle('pw-stuck', y > COMPACT_AT);
  }

  function watchScroll(){
    if(watchStarted) return;
    watchStarted = true;
    var ticking = false;
    window.addEventListener('scroll', function(){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        ticking = false;
        apply(window.scrollY);
      });
    }, { passive: true });
  }

  function refresh(){
    watchScroll();
    apply(window.scrollY);
  }

  window.__refreshPhoneHeader = refresh;
})();
