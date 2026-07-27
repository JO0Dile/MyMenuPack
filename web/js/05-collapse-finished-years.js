// ==========================
// COLLAPSE FINISHED YEARS — a "focus on what's left" view. A year every
// course of which is completed folds down to a one-line "all done" strip,
// so a later-year student doesn't scroll past semesters of checked-off
// courses to reach what's current. Works on both built-in majors
// (.year-row) and imported plans (.imp-year-block) through one generic
// pass, and is a no-op (its toggle stays hidden) until at least one year
// is actually finished.
// ==========================
(function(){
  var STATE_KEY = 'aaup_collapseFinished';
  // Years the student manually re-opened this session, so refresh() doesn't
  // immediately re-collapse them out from under a deliberate expand. Keyed
  // by "<prefix>::<year index>". Cleared whenever the master toggle flips.
  var manuallyExpanded = {};

  function isOn(){
    try{ return localStorage.getItem(STATE_KEY) === '1'; }catch(e){ return false; }
  }
  function setOn(v){
    try{ localStorage.setItem(STATE_KEY, v ? '1' : '0'); }catch(e){}
  }

  function rootFor(prefix){ return document.getElementById('page-' + prefix); }
  function isImported(prefix){
    return !!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans && window.AAUP_IMPORTED.loadImportedPlans()[prefix]);
  }
  function yearContainers(root){
    var built = root.querySelectorAll('.year-row');
    if(built.length) return Array.prototype.slice.call(built);
    return Array.prototype.slice.call(root.querySelectorAll('.imp-year-block'));
  }
  function yearIsFinished(yearEl){
    var courses = yearEl.querySelectorAll('.course[id]:not(.course-removed)');
    if(!courses.length) return false;
    for(var i = 0; i < courses.length; i++){
      if(!courses[i].classList.contains('completed')) return false;
    }
    return true;
  }
  function yearLabel(yearEl, rtl, index){
    // Built-in years carry a .year-badge .label; imported ones an
    // .imp-year-header h3. Fall back to a plain "Year N" either way.
    var badge = yearEl.querySelector('.year-badge .label') || yearEl.querySelector('.imp-year-header h3');
    var txt = badge ? badge.textContent.replace(/\s+/g, ' ').trim() : '';
    if(txt) return txt;
    return (rtl ? 'السنة ' : 'Year ') + (index + 1);
  }

  function clearCollapse(root){
    root.classList.remove('finished-collapsed');
    yearContainers(root).forEach(function(y){
      y.classList.remove('year-collapsed');
      var hint = y.querySelector(':scope > .collapse-hint');
      if(hint) hint.remove();
    });
  }

  function applyCollapse(prefix, root, rtl){
    root.classList.add('finished-collapsed');
    yearContainers(root).forEach(function(yearEl, idx){
      var key = prefix + '::' + idx;
      var hint = yearEl.querySelector(':scope > .collapse-hint');
      var finished = yearIsFinished(yearEl);
      if(finished && !manuallyExpanded[key]){
        yearEl.classList.add('year-collapsed');
        if(!hint){
          hint = document.createElement('div');
          hint.className = 'collapse-hint';
          hint.setAttribute('role', 'button');
          hint.setAttribute('tabindex', '0');
          hint.innerHTML = '<span>✓ ' + window.__escapeHtml(yearLabel(yearEl, rtl, idx)) + ' — ' +
            (rtl ? 'كل المساقات مكتملة' : 'all courses completed') + '</span>' +
            '<span class="ch-expand">' + (rtl ? 'إظهار ▾' : 'Show ▾') + '</span>';
          var expand = function(){
            manuallyExpanded[key] = true;
            yearEl.classList.remove('year-collapsed');
            if(hint) hint.remove();
          };
          hint.addEventListener('click', expand);
          hint.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); expand(); } });
          yearEl.insertBefore(hint, yearEl.firstChild);
        }
      } else {
        yearEl.classList.remove('year-collapsed');
        if(hint) hint.remove();
      }
    });
  }

  function anyFinished(root){
    return yearContainers(root).some(yearIsFinished);
  }

  function ensureToggle(prefix, root, rtl){
    var toggle = root.querySelector(':scope .collapse-toggle');
    if(!toggle){
      var anchor = root.querySelector('.course-search-wrap');
      if(!anchor) return null;
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'collapse-toggle';
      anchor.parentNode.insertBefore(toggle, anchor);
      toggle.addEventListener('click', function(){
        var turningOn = !isOn();
        setOn(turningOn);
        manuallyExpanded = {}; // a fresh flip re-evaluates every year
        refresh(prefix);
        // Restore prerequisite connectors when leaving collapse mode: their
        // geometry is stale after years folded/unfolded, so force a redraw.
        if(!turningOn){
          if(isImported(prefix) && window.AAUP_IMPORTED && window.AAUP_IMPORTED.refresh){ window.AAUP_IMPORTED.refresh(prefix); }
          else if(window.__redraw && window.__redraw[prefix]){ window.__redraw[prefix](); }
        }
      });
    }
    var on = isOn();
    toggle.innerHTML =
      '<span>' + (rtl ? '📁 طيّ السنوات المكتملة' : '📁 Collapse finished years') + '</span>' +
      '<span class="ct-state">' + (on ? (rtl ? 'مفعّل' : 'ON') : (rtl ? 'معطّل' : 'OFF')) + '</span>';
    return toggle;
  }

  function refresh(prefix){
    var root = rootFor(prefix);
    if(!root) return;
    var rtl = root.classList.contains('rtl-mode');
    var toggle = ensureToggle(prefix, root, rtl);
    if(!toggle) return;
    // Only offer the control once there's actually something to fold —
    // otherwise it's a button that does nothing.
    toggle.classList.toggle('available', anyFinished(root) || isOn());
    if(isOn()){ applyCollapse(prefix, root, rtl); }
    else { clearCollapse(root); }
  }

  window.__refreshCollapse = refresh;
})();
