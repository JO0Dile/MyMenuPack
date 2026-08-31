// ==========================
// LECTURE + LAB, DRAWN AS ONE COURSE
// ==========================
// AAUP registers a lecture and its lab as ONE course — same catalogue
// number, same credit value — and the plan grid draws them as two cards on
// purpose, because they meet at different times. Nothing on screen said they
// were one thing, so a student reading two cards read two courses: two rows
// to tick, two lots of hours, and (before the availability fix) one of them
// apparently takeable without the other.
//
// The two cards keep their own boxes and their own checkboxes — they are
// separate meetings and a student really does attend them separately — and a
// bracket is drawn down the margin spanning both, labelled. It states the
// relationship rather than hinting at it.
//
// Phone only, by CSS: the wrapper is display:contents at wider widths, so
// desktop's grid lays out byte-for-byte as it did before.
(function(){
  'use strict';

  var WRAP_CLASS = 'cp-pair';

  function labSlugOf(row, prefix, slug){
    return row.querySelector('[id="' + prefix + '-c-' + slug + '-lab"]');
  }

  // Within ONE semester row only. A lecture whose lab the plan schedules in a
  // different semester is left alone: joining those would misrepresent when
  // the plan says to take them, and that discrepancy is worth seeing.
  function pairUp(row){
    var cards = Array.prototype.slice.call(row.querySelectorAll(':scope > .course[id]'));
    cards.forEach(function(card){
      if(card.parentNode.classList.contains(WRAP_CLASS)) return;
      var m = card.id.match(/^(.*)-c-(.*)$/);
      if(!m || /-lab$/.test(m[2])) return;              // start from the lecture
      var lab = labSlugOf(row, m[1], m[2]);
      if(!lab || lab.parentNode.classList.contains(WRAP_CLASS)) return;

      var wrap = document.createElement('div');
      wrap.className = WRAP_CLASS;
      card.parentNode.insertBefore(wrap, card);
      wrap.appendChild(card);
      // The lab is moved to sit under its own lecture. A plan can list them
      // apart — the AI & Medical Sciences plan draws "Biology Lab" ABOVE
      // "Biology for Medical Sciences" — and a bracket spanning two cards
      // with something else between them would be drawn around the wrong
      // thing.
      wrap.appendChild(lab);

      var label = document.createElement('span');
      label.className = 'cp-pair-label';
      label.setAttribute('aria-hidden', 'true');
      var pairRtl = row.closest('[dir="rtl"], .rtl-mode') !== null ||
        !!(window.AAUP_LANG && window.AAUP_LANG.isAr());
      label.textContent = pairRtl ? 'مساق واحد' : 'one course';
      wrap.appendChild(label);
      // Said once, properly, for a screen reader — the visual label is a
      // rotated decoration and the bracket itself is not announced at all.
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', label.textContent);
    });
  }

  function apply(root){
    var scope = root || document;
    scope.querySelectorAll('.course-row').forEach(pairUp);
  }

  // js/28-imported.js replaces the whole plan root on things as ordinary as
  // ticking a checkbox, so this cannot be a one-shot pass. Observing the
  // document for new .course-row nodes catches every render path without
  // having to find and hook each one.
  var queued = false;
  function schedule(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(function(){
      queued = false;
      apply();
      // The prerequisite connectors are positioned from real card
      // coordinates, and moving a lab moved some. Harmless on phone (the
      // layer is hidden there) but not on a tablet at this width.
      if(window.__redraw){
        Object.keys(window.__redraw).forEach(function(k){
          try{ window.__redraw[k](); }catch(e){}
        });
      }
    });
  }

  function start(){
    apply();
    new MutationObserver(function(muts){
      for(var i = 0; i < muts.length; i++){
        var added = muts[i].addedNodes;
        for(var j = 0; j < added.length; j++){
          var n = added[j];
          if(n.nodeType !== 1) continue;
          if(n.classList.contains('course-row') || n.querySelector('.course-row')){ schedule(); return; }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if(document.readyState === 'complete'){ start(); }
  else { window.addEventListener('load', start); }

  window.AAUP_COURSE_PAIRS = { apply: apply };
})();
