// ==========================
// COURSE CARD LONG-PRESS QUICK ACTIONS (phone only).
//
// Swipe-to-mark/unmark already exists (js/57-card-input.js) — this adds a
// second, longer-hold gesture on the same cards rather than a competing
// implementation of the same one. js/28-imported.js also already owns a
// 450ms hold-to-trace gesture on these exact cards (press-and-hold lights
// up the prerequisite lines). This escalates from that instead of racing
// it: a hold past 450ms shows the trace as it always has, and only a hold
// past this longer threshold — trace already visible — also opens the
// menu, the same "hold longer for more" a phone's own long-press already
// trains people to expect.
//
// Delegated on document rather than bound per-card: js/28-imported.js's own
// render() replaces every course card's DOM node on each re-render (as
// ordinary as toggling a checkbox does), so a per-card listener would go
// stale the moment the very gesture it handles caused a re-render.
//
// Imported plans only — same restriction js/57-card-input.js's swipe and
// keyboard handlers already apply to these exact cards: a built-in major
// has its own handlers and must not get a second one layered on top.
// ==========================
(function(){
  'use strict';

  var LONGPRESS_MS = 900;
  var MOVE_CANCEL = 12;   // px of drift before a hold no longer counts as "still"

  function isPhone(){ return window.innerWidth <= 720; }

  function courseInfo(el){
    // ids are "<planId>-c-<slug>" — planId itself can contain dashes, so
    // anchor on the literal "-c-" separator js/28-imported.js's fullId()
    // always inserts, not on the first dash.
    if(!el.id || el.id.indexOf('-c-') === -1) return null;
    var idx = el.id.indexOf('-c-');
    var planId = el.id.slice(0, idx);
    // Same restriction js/57-card-input.js's swipe/keyboard gestures already
    // apply to these exact cards: a built-in major has its own handlers and
    // must not get a second one layered on top.
    if(!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[planId])) return null;
    return { planId: planId, slug: el.id.slice(idx + 3) };
  }

  var st = null; // { card, startX, startY, timer }

  function clearHold(){
    if(st){ clearTimeout(st.timer); st = null; }
  }

  document.addEventListener('touchstart', function(e){
    if(!isPhone() || e.touches.length !== 1) return;
    var card = e.target.closest('.course[id]');
    if(!card || card.closest('.sheet-plan.editing')) return;
    if(e.target.closest('.course-check')) return;   // already its own tap target
    var t = e.touches[0];
    st = { card: card, startX: t.clientX, startY: t.clientY, timer: null };
    st.timer = setTimeout(function(){
      if(!st) return;
      openQuickActions(st.card);
      if(navigator.vibrate){ try{ navigator.vibrate(12); }catch(err){} }
      st = null;
    }, LONGPRESS_MS);
  }, { passive: true });

  document.addEventListener('touchmove', function(e){
    if(!st) return;
    var t = e.touches[0];
    var dx = t.clientX - st.startX, dy = t.clientY - st.startY;
    if((dx * dx + dy * dy) > MOVE_CANCEL * MOVE_CANCEL) clearHold();
  }, { passive: true });

  document.addEventListener('touchend', clearHold, { passive: true });
  document.addEventListener('touchcancel', clearHold, { passive: true });

  // ---------------------------------------------------------------------
  // The menu itself — mark done/undone, view details, or copy the course
  // code for the university's own registration system, without opening
  // the full detail panel first. One popover, reused for every card;
  // closed by tapping outside it, pressing Escape, or acting on it.
  var menuEl = null;
  function closeQuickActions(){
    if(menuEl){ menuEl.remove(); menuEl = null; }
    document.removeEventListener('click', onOutsideClick, true);
    document.removeEventListener('keydown', onKeydown, true);
  }
  function onOutsideClick(e){ if(menuEl && !menuEl.contains(e.target)) closeQuickActions(); }
  function onKeydown(e){ if(e.key === 'Escape') closeQuickActions(); }

  function openQuickActions(card){
    closeQuickActions();
    var info = courseInfo(card);
    if(!info) return;
    var rtl = card.closest('[dir="rtl"], .rtl-mode') !== null;
    var done = card.classList.contains('completed');
    var nameEl = card.querySelector('.name');
    var codeEl = card.querySelector('.meta');
    var courseName = nameEl ? nameEl.textContent.trim() : '';

    menuEl = document.createElement('div');
    menuEl.className = 'course-qa-menu';
    menuEl.innerHTML =
      '<button type="button" data-qa="toggle">' + (done ? (rtl ? '↺ إلغاء الإنجاز' : '↺ Mark not done') : (rtl ? '✓ إنجاز' : '✓ Mark done')) + '</button>' +
      '<button type="button" data-qa="open">' + (rtl ? '📖 عرض التفاصيل' : '📖 View details') + '</button>' +
      '<button type="button" data-qa="copy">' + (rtl ? '🔗 نسخ اسم المساق' : '🔗 Copy course name') + '</button>';

    var r = card.getBoundingClientRect();
    document.body.appendChild(menuEl);
    var mr = menuEl.getBoundingClientRect();
    var top = Math.min(window.innerHeight - mr.height - 10, r.top + r.height / 2 - mr.height / 2);
    var left = Math.min(window.innerWidth - mr.width - 10, r.right + 8);
    if(left + mr.width > window.innerWidth - 10){ left = Math.max(10, r.left - mr.width - 8); }
    menuEl.style.top = Math.max(10, top) + 'px';
    menuEl.style.left = Math.max(10, left) + 'px';

    menuEl.addEventListener('click', function(e){
      var btn = e.target.closest('[data-qa]');
      if(!btn) return;
      var action = btn.getAttribute('data-qa');
      if(action === 'toggle' && window.AAUP_IMPORTED){ window.AAUP_IMPORTED.toggle(info.planId, info.slug); }
      else if(action === 'open' && window.AAUP_IMPORTED){ window.AAUP_IMPORTED.openCourseModal(info.planId, info.slug); }
      else if(action === 'copy'){
        var text = courseName + (codeEl ? ' (' + codeEl.textContent.trim() + ')' : '');
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(function(){
            if(window.__showToast) window.__showToast(rtl ? '✓ انتسخ' : '✓ Copied');
          }).catch(function(){});
        }
      }
      closeQuickActions();
    });
    // Deferred so the same touchend that triggered the long-press doesn't
    // immediately count as the "outside click" that closes it again.
    setTimeout(function(){
      document.addEventListener('click', onOutsideClick, true);
      document.addEventListener('keydown', onKeydown, true);
    }, 0);
  }
})();
