// ==========================
// COURSE CARD INPUT — keyboard and touch.
//
// Two ways into the same two actions, for people the mouse-and-tap path
// leaves out.
//
// Keyboard: every card is now a real button (tabindex + role, set in
// js/28-imported.js). Enter opens the course details; Space marks the course
// passed and Space again marks it back. Before this, only the small tick was
// reachable by Tab — so a keyboard user could tick a course off but could
// never open one to read its prerequisites, grade or description.
//
// Touch: swipe a card right to mark it passed, left to undo — the gesture
// phones already taught everyone. The tick stays exactly where it was for
// anyone who prefers to aim at it.
//
// Both go through AAUP_IMPORTED.toggle / openCourseModal, the same entry
// points a click uses, so grades, achievements, connectors and the degree
// audit all update the way they already do. Nothing here knows about them.
// ==========================
(function(){
  var SWIPE_MIN = 46;    // px of travel before it counts as a swipe
  var SWIPE_MAX_OFF = 34; // px of vertical drift allowed — beyond it, it's a scroll

  function planAndSlug(card){
    if(!card || !card.id || !window.__splitCourseId) return null;
    var parts = window.__splitCourseId(card.id);
    if(!parts || !parts.prefix || !parts.slug) return null;
    // Only imported plans are driven from here; a built-in page has its own
    // handlers and must not get a second one.
    if(!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[parts.prefix])) return null;
    return parts;
  }
  function isEditing(card){
    var page = card.closest('.sheet, .plan-page');
    return !!(page && page.classList.contains('editing'));
  }
  function toggle(card){
    var p = planAndSlug(card);
    if(!p || isEditing(card)) return false;
    window.AAUP_IMPORTED.toggle(p.prefix, p.slug);
    return true;
  }

  // ---------------------------------------------------------------- keyboard
  document.addEventListener('keydown', function(e){
    var card = e.target && e.target.classList && e.target.classList.contains('course') ? e.target : null;
    if(!card) return;
    if(e.key === 'Enter'){
      var p = planAndSlug(card);
      if(!p || isEditing(card)) return;
      e.preventDefault();
      window.AAUP_IMPORTED.openCourseModal(p.prefix, p.slug);
    } else if(e.key === ' ' || e.key === 'Spacebar'){
      // Space is the page-scroll key, so only swallow it when this really is
      // a course card that we are about to act on.
      if(toggle(card)) e.preventDefault();
    }
  });

  // ------------------------------------------------------------------- touch
  var startX = 0, startY = 0, tracking = null;

  document.addEventListener('touchstart', function(e){
    if(e.touches.length !== 1) return;
    var card = e.target.closest && e.target.closest('.course[id]');
    if(!card || isEditing(card)) return;
    // The tick has its own tap target; a swipe that starts on it is still a
    // swipe, but a tap on it must stay a tap, which its own handler does.
    tracking = card;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function(e){
    if(!tracking || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - startX;
    var dy = Math.abs(e.touches[0].clientY - startY);
    if(dy > SWIPE_MAX_OFF){ clear(); return; }   // they're scrolling, not swiping
    // Follow the finger a little so the gesture is discoverable — capped, so
    // the card never leaves its slot in the grid.
    var shown = Math.max(-70, Math.min(70, dx));
    tracking.style.transform = 'translateX(' + shown + 'px)';
    tracking.classList.toggle('swipe-pass', dx >= SWIPE_MIN);
    tracking.classList.toggle('swipe-undo', dx <= -SWIPE_MIN);
  }, { passive: true });

  function clear(){
    if(tracking){
      tracking.style.transform = '';
      tracking.classList.remove('swipe-pass', 'swipe-undo');
    }
    tracking = null;
  }

  document.addEventListener('touchend', function(e){
    if(!tracking) return;
    var card = tracking;
    var dx = (e.changedTouches[0] ? e.changedTouches[0].clientX : startX) - startX;
    var dy = Math.abs((e.changedTouches[0] ? e.changedTouches[0].clientY : startY) - startY);
    clear();
    if(dy > SWIPE_MAX_OFF || Math.abs(dx) < SWIPE_MIN) return;
    var done = card.classList.contains('completed');
    // Right marks passed, left marks not passed. Swiping the way it already
    // is does nothing rather than flipping it back, so a stray swipe across a
    // finished row can't quietly un-finish it.
    if((dx > 0 && done) || (dx < 0 && !done)) return;
    // A swipe was a deliberate action, not a tap — stop the click that the
    // browser synthesizes from opening the course details on top of it.
    var swallow = function(ev){ ev.stopPropagation(); ev.preventDefault(); };
    card.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(function(){ card.removeEventListener('click', swallow, true); }, 400);
    toggle(card);
  }, { passive: true });

  document.addEventListener('touchcancel', clear, { passive: true });
})();
