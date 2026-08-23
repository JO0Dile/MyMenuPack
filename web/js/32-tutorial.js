// ==========================
// ONBOARDING TOUR — first-time spotlight walkthroughs
// ==========================
// Three short, independent tours (Home, Dashboard, Study Plan page), each
// auto-played exactly once per browser (localStorage-gated) the first time
// its screen is reached, and replayable anytime from Settings. Intentionally
// several short tours triggered where each screen actually appears, rather
// than one long forced tour up front — a student who never opens a Study
// Plan page yet shouldn't have to click through a step explaining one.
(function(){
  var KEY_PREFIX = 'aaup_tut_';
  var active = null; // { id, steps, index }

  function done(id){
    try{ return localStorage.getItem(KEY_PREFIX + id) === '1'; }catch(e){ return true; }
  }
  function markDone(id){
    try{ localStorage.setItem(KEY_PREFIX + id, '1'); }catch(e){}
  }
  function clearDone(id){
    try{ localStorage.removeItem(KEY_PREFIX + id); }catch(e){}
  }

  // The one element every plan page (built-in or imported) currently on
  // screen — used to scope step targets so a hidden major elsewhere in the
  // DOM never gets matched instead of the one actually visible.
  function visiblePlanRoot(){
    var candidates = document.querySelectorAll('.plan-page, #importedPlanView');
    for(var i = 0; i < candidates.length; i++){
      if(candidates[i].offsetParent !== null) return candidates[i];
    }
    return document;
  }
  function nth(list, i){ return list && list[i] ? list[i] : null; }

  // The custom/imported plan editor always renders into this one fixed
  // host regardless of which plan is open — unlike visiblePlanRoot()'s
  // built-in majors, there's only ever one candidate, so this just needs
  // to confirm it's actually the thing on screen right now.
  function importedEditRoot(){
    var host = document.getElementById('importedPlanView');
    return (host && host.offsetParent !== null) ? host : document;
  }

  // A course guaranteed to have at least one prerequisite connection —
  // needed for the interactive hold-to-trace step, since holding a course
  // with zero connections draws nothing and the step would never complete.
  function aConnectedCourse(){
    var root = visiblePlanRoot();
    var svg = root.querySelector('.connector-layer');
    var edge = svg && svg.querySelector('path.edge[data-to]');
    var id = edge && edge.getAttribute('data-to');
    return (id && document.getElementById(id)) || root.querySelector('.course[id]');
  }

  var TOURS = {
    home: [
      { target: '#homeSearchBox',
        title: 'Already know your major?',
        text: 'Search it by name — that goes straight to its plan.' },
      // Was '#homeUniversityGrid .plan-card', which stopped existing when the
      // single-university picker was removed. A step whose target is gone
      // renders nothing, so this tour ran as one step captioned "3 / 3".
      { target: function(){ return document.querySelector('#homeCollegeGrid .plan-card'); },
        title: 'Faculty, then major',
        text: 'Pick your faculty, then your major. Two taps.' },
      { target: '[onclick*="openSettings"]',
        title: 'Settings',
        text: 'Backups, theme, and profiles on this device.' }
    ],
    dashboard: [
      { target: function(){ return nth(document.querySelectorAll('#dashboard .dash-card'), 0); },
        title: 'Progress',
        text: 'Completed credit hours out of everything required for your degree.' },
      { target: function(){ return nth(document.querySelectorAll('#dashboard .dash-card'), 1); },
        title: 'GPA',
        text: 'Enter grades for a course from its info popup on the Study Plan page — your GPA updates here automatically.' },
      { target: function(){ return document.querySelector('#dashboard .dash-quicklink[onclick*="AAUP_ACHIEVEMENTS"]'); },
        title: 'Achievements',
        text: 'Small goals that unlock as you go — tap here to see all of them for this major. Go ahead, try it.' },
      { target: function(){ return nth(document.querySelectorAll('#dashboard .dash-card'), 3); },
        title: 'What Can I Take Next',
        text: 'Courses whose prerequisites you’ve already checked off — a quick answer to "what am I actually allowed to register for."' },
      { target: function(){ return nth(document.querySelectorAll('#dashboard .dash-actions .home-btn'), 1); },
        title: 'My Study Plan',
        text: 'The full four-year course map — prerequisites, electives, and where every course you’ve completed slots in.' }
    ],
    studyplan: [
      { target: function(){
          var legend = visiblePlanRoot().querySelector('.legend');
          // Once expanded, spotlight the whole panel (not just the header)
          // so the newly-revealed color key is actually inside the lit-up
          // area instead of sitting in the dimmed backdrop underneath it.
          return (legend && legend.classList.contains('expanded')) ? legend : visiblePlanRoot().querySelector('.legend-toggle');
        },
        title: 'Legend',
        text: 'Every color on this page means something — university requirement, elective, core course, etc. Tap it to see what’s what.',
        interactive: true,
        watchTarget: function(){ return visiblePlanRoot().querySelector('.legend'); },
        interactionClass: 'expanded',
        reflowDelay: 320 }, // matches .legend-items' own max-height transition, so the panel has finished growing before it's measured
      { target: function(){ return visiblePlanRoot().querySelector('.course'); },
        title: 'Courses',
        text: 'Tap a course to see its details and prerequisites, or check the box once you’ve completed it — that’s what feeds Progress and GPA on your Dashboard.' },
      { target: aConnectedCourse,
        title: 'Trace prerequisites',
        text: 'Press and hold this course (or hover it on a computer) — the lines connecting it to what it needs, and what it unlocks, light up. Go ahead, try it — Next will be waiting whenever you are.',
        interactive: true },
      { target: function(){ return visiblePlanRoot().querySelector('.course-search-wrap .search-box'); },
        title: 'Search a course',
        text: 'Find any course on this page by name or course number instead of hunting through every semester. Try typing one now.',
        noDim: true, // its results dropdown renders below the spotlighted box, in territory a dark backdrop would otherwise hide
        avoidBelow: function(){ return visiblePlanRoot().querySelector('.course-search-wrap .search-dropdown.open'); },
        watchReflow: function(){ return visiblePlanRoot().querySelector('.course-search-wrap .search-dropdown'); } }
    ],
    // Edit Mode on a student's OWN custom/imported plan — no developer
    // password involved, since only its own creator can ever reach it (see
    // the "canEdit = true" comment in AAUP_IMPORTED.render). Steps that open
    // one of the shared devModalOverlay dialogs (Add Course, Course
    // Library, Edit Course) need no special handling here at all: the same
    // pause-while-a-real-modal-is-open / resume-and-advance-on-close
    // machinery below (see anyOtherModalOpen) already covers any
    // .modal-overlay, automatically. Move/Add Year/Remove are left
    // descriptive rather than gated on a specific gesture — forcing an
    // exact drag destination is fragile, and forcing a real delete on
    // someone's own data is actively bad UX; the layer being pass-through
    // means they're all genuinely tappable/draggable live regardless.
    planEditor: [
      { target: function(){ return importedEditRoot().querySelector('.imp-exit-edit-btn'); },
        title: 'Edit Mode',
        text: 'This is YOUR plan — nothing here is shared with anyone until you choose to Export or Contribute it. Add, remove, and rearrange courses freely; everything saves automatically as you go, no separate Save button.' },
      { target: function(){ return importedEditRoot().querySelector('.imp-add-course-card'); },
        title: 'Add a course',
        text: 'Tap + in any semester to add a course by hand — name, credit hours, category, even its prerequisites. Try it now.' },
      { target: function(){ return importedEditRoot().querySelector('.home-btn[onclick*="openLibrary"]'); },
        title: 'Course Library',
        text: 'Or skip the typing — copy a course straight from an official plan (or someone else’s) instead of entering it by hand. Go ahead, try it.' },
      { target: function(){ return importedEditRoot().querySelector('.imp-edit-course-btn'); },
        title: 'Edit a course',
        text: 'Tap the pencil on any course to fix its name, credit hours, or category later — nothing here is permanent.' },
      { target: function(){ return importedEditRoot().querySelector('.course[id]'); },
        title: 'Move a course',
        text: 'Press and hold a course, then drag it to a different semester — the app checks prerequisites for you and warns if the new order would break something. Give it a try.' },
      { target: function(){ return importedEditRoot().querySelector('.imp-structure-actions .home-btn'); },
        title: 'Add a Year',
        text: 'Need more than what’s here? Add another year any time — each year can also get a Summer semester from its own header, and both can be removed again just as easily.' },
      { target: function(){ return importedEditRoot().querySelector('.imp-remove-course-btn'); },
        title: 'Remove a course',
        text: 'The ✕ on a course removes it — you’ll always get an “are you sure” first, and this can’t be undone once confirmed.' },
      { target: function(){ return importedEditRoot().querySelector('.imp-exit-edit-btn'); },
        title: 'All done?',
        text: 'Tap here whenever you’re finished editing. There’s nothing left to save — it already has been, the whole time.' }
    ],
    // Developer Edit Mode on an OFFICIAL major (robotics/cybersecurity/
    // medical/cs) — deliberately much smaller than planEditor above: no
    // add/remove/course-editing exists here on purpose (see AAUP_PLAN_EDITOR
    // — only drag-to-reorder), since this changes what every student using
    // that shared plan sees, not just the person editing it.
    devEdit: [
      { target: function(){ return visiblePlanRoot().querySelector('.emb-exit'); },
        title: 'Developer Edit Mode',
        text: 'This edits the OFFICIAL shared plan every student sees — changes here affect everyone, not just you. There’s no add or remove here on purpose, only reordering, so the course list itself always stays exactly what the university publishes.' },
      { target: function(){ return visiblePlanRoot().querySelector('.course[id]'); },
        title: 'Move a course',
        text: 'Press and hold, then drag any course to a different semester. Prerequisites are checked automatically — moving something before what it needs, or after what needs it, gets rejected. A same-semester conflict (a retake case) asks to confirm instead.' },
      { target: function(){ return visiblePlanRoot().querySelector('.emb-exit'); },
        title: 'Exit',
        text: 'Tap here when you’re done — every move is already saved as you make it.' }
    ]
  };

  function resolve(step){
    return typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
  }

  // For steps marked interactive: true — rather than just describing the
  // gesture, wait for the user to actually perform it (detected via a class
  // the real feature already adds — 'node-active' for the hold-to-trace
  // course, 'expanded' for the legend panel) and switch Next from "Skip" to
  // its normal label once it happens. Deliberately does NOT auto-advance —
  // an earlier version did, on a fixed timer, and that took the decision of
  // "I'm done looking" away from the student. Skip stays tappable the whole
  // time regardless, so the step can never soft-lock the tour for someone
  // whose device/input doesn't cooperate.
  var interactiveObserver = null;
  function stopWatchingInteractive(){
    if(interactiveObserver){ interactiveObserver.disconnect(); interactiveObserver = null; }
  }
  function watchInteractive(step, el){
    stopWatchingInteractive();
    var watchEl = (step.watchTarget && step.watchTarget()) || el;
    if(!watchEl) return;
    var cls = step.interactionClass || 'node-active';
    interactiveObserver = new MutationObserver(function(){
      if(watchEl.classList.contains(cls)){
        stopWatchingInteractive();
        if(!active) return;
        active._interactionDone = true;
        // Some interactions (the legend panel expanding) change size over a
        // CSS transition rather than instantly — reflowDelay lets that
        // finish before the spotlight/tooltip are re-measured, so they land
        // on the settled size instead of the mid-animation one.
        setTimeout(function(){ if(active) render(); }, step.reflowDelay || 0);
      }
    });
    interactiveObserver.observe(watchEl, { attributes: true, attributeFilter: ['class'] });
  }

  // For steps whose target reveals more content without necessarily
  // "completing" anything (the search dropdown appearing as you type) —
  // just reposition the tooltip when that content's own open/closed state
  // changes, no Skip/Next relabeling involved.
  var reflowObserver = null;
  function stopWatchingReflow(){
    if(reflowObserver){ reflowObserver.disconnect(); reflowObserver = null; }
  }
  function watchReflow(getEl){
    stopWatchingReflow();
    var el = getEl();
    if(!el) return;
    reflowObserver = new MutationObserver(function(){ if(active) render(); });
    reflowObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function render(){
    if(!active) return;
    var step = active.steps[active.index];
    var el = step && resolve(step);
    if(!el || el.offsetParent === null){
      // Not on screen. This used to advance() past it, which left the index
      // walking over steps nobody saw while the denominator still counted
      // them: the Home tour opens on a screen where its first two targets no
      // longer exist, so the one step a student actually got was captioned
      // "3 / 3". Dropping it from the list instead keeps the numbering
      // describing the tour that is really being shown.
      active.steps.splice(active.index, 1);
      if(active.index >= active.steps.length){ finish(); return; }
      render();
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        // Re-check: two frames is enough time for finish() to have run (e.g.
        // a rapid plan switch) and cleared `active` out from under this
        // already-scheduled callback — without this guard the stale closure
        // crashes reading .steps/.index off a null `active`.
        if(!active) return;
        var r = el.getBoundingClientRect();
        var pad = 6;
        var spot = document.getElementById('tutSpotlight');
        spot.style.top = Math.max(0, r.top - pad) + 'px';
        spot.style.left = Math.max(0, r.left - pad) + 'px';
        spot.style.width = (r.width + pad * 2) + 'px';
        spot.style.height = (r.height + pad * 2) + 'px';
        spot.classList.toggle('no-dim', !!(step.interactive || step.noDim));

        document.getElementById('tutTitle').textContent = step.title;
        document.getElementById('tutText').textContent = step.text;
        document.getElementById('tutProgress').textContent = (active.index + 1) + ' / ' + active.steps.length;
        var waitingOnInteraction = !!(step.interactive && !active._interactionDone);
        // Both buttons used to read "Skip" while a step waited on an
        // interaction — one meaning "skip this step", the other "skip the
        // whole tour", with nothing distinguishing them. The primary keeps
        // its normal label: pressing it moves on without doing the gesture,
        // which is what skipping the step already meant.
        document.getElementById('tutNext').textContent =
          (active.index === active.steps.length - 1) ? 'Got it!' : 'Next';
        document.getElementById('tutNext').classList.toggle('tut-next-waiting', waitingOnInteraction);

        if(step.interactive){
          if(active._watchedIndex !== active.index){
            active._watchedIndex = active.index;
            active._interactionDone = false;
            watchInteractive(step, el);
          }
        } else {
          stopWatchingInteractive();
        }
        if(step.watchReflow){ watchReflow(step.watchReflow); } else { stopWatchingReflow(); }

        var tip = document.getElementById('tutTooltip');
        tip.style.left = '';
        var tipWidth = 300;
        var left = r.left + r.width / 2 - tipWidth / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - tipWidth - 12));
        tip.style.left = left + 'px';
        // Some steps invite an interaction that reveals content BELOW the
        // spotlighted element itself (a search dropdown) — avoidBelow, when
        // it returns that now-open content, extends the "clear zone" the
        // tooltip must sit under so it doesn't land on top of it.
        var belowEdge = r.bottom;
        if(step.avoidBelow){
          var extra = step.avoidBelow();
          if(extra && extra.offsetParent !== null){
            belowEdge = Math.max(belowEdge, extra.getBoundingClientRect().bottom);
          }
        }
        // Vertical placement used a fixed 180px guess for "is there room
        // below" and never clamped the result, so a tooltip taller than the
        // guess — or one on a phone, where the floating tab bar owns the
        // last ~90px — was positioned partly or entirely under the edge of
        // the screen with its buttons unreachable. Measure the tooltip, ask
        // whether it actually fits, and clamp into the visible band either
        // way.
        var tipH = tip.offsetHeight;
        var bar = document.getElementById('sbTabBar');
        var barTop = (bar && bar.offsetParent !== null) ? bar.getBoundingClientRect().top : window.innerHeight;
        var bottomLimit = Math.min(window.innerHeight, barTop) - 12;
        var below = belowEdge + pad + 12;
        var above = r.top - pad - 12 - tipH;
        var top;
        if(below + tipH <= bottomLimit){ top = below; }
        else if(above >= 12){ top = above; }
        else {
          // Fits nowhere clear of the target — take whichever side has more
          // room and clamp, so it is always fully on screen and tappable.
          top = (bottomLimit - belowEdge) >= r.top ? below : above;
        }
        tip.style.top = Math.max(12, Math.min(top, bottomLimit - tipH)) + 'px';
      });
    });
  }

  function reflow(){ if(active) render(); }

  function advance(){
    if(!active) return;
    stopWatchingInteractive();
    active.index++;
    if(active.index >= active.steps.length){ finish(); return; }
    render();
  }

  function finish(){
    if(!active) return;
    stopWatchingInteractive();
    stopWatchingReflow();
    markDone(active.id);
    document.getElementById('tutLayer').classList.remove('open', 'paused');
    window.removeEventListener('resize', reflow);
    window.removeEventListener('scroll', reflow, true);
    paused = false;
    active = null;
  }

  // Every step's spotlighted element is genuinely tappable (see the
  // pointer-events comment on .tut-layer in the stylesheet) — a step's own
  // text ("tap a course to see its details") is telling the student to do
  // that right now. When that tap opens a REAL modal (course details,
  // achievements, etc.) underneath this layer, fighting it with a dark
  // overlay and a spotlight pointing at now-covered coordinates is worse
  // than just getting out of the way: hide the tour layer for as long as
  // that modal stays open, then treat closing it as "step done" and move
  // on, same reward-the-interaction logic the hold-to-trace step already
  // uses.
  var paused = false;
  function anyOtherModalOpen(){
    return !!document.querySelector('.modal-overlay.open:not(#tutLayer)');
  }
  // Runs on every real DOM class-change while a tour is active — modal
  // open/close is the common case, but it's also the one place broad
  // enough to catch a step's target disappearing for some OTHER reason
  // with nothing to pause for, e.g. a step whose whole point is "tap this
  // real button" and that real button's own action (Exit Edit Mode) is
  // exactly what removes it from the page. render() already has the "my
  // target is gone, skip it" self-heal (needed for the tour-to-tour case
  // in start() above) — it just needs a trigger beyond the tour's own
  // scroll/resize/step-change calls to notice something changed for a
  // reason that had nothing to do with this tour at all.
  function checkTutorialHealth(){
    if(!active) return;
    var blocked = anyOtherModalOpen();
    if(blocked && !paused){
      paused = true;
      document.getElementById('tutLayer').classList.add('paused');
      return;
    }
    if(!blocked && paused){
      paused = false;
      document.getElementById('tutLayer').classList.remove('paused');
      advance();
      return;
    }
    var step = active.steps[active.index];
    var el = step && resolve(step);
    if(!el || el.offsetParent === null){ advance(); }
  }
  // Coalesced to at most one check per animation frame — the interactive
  // trace step alone can fire dozens of class-attribute mutations in a
  // single burst (every related SVG path + course node), and this only
  // ever needs to notice things settling, not react to each one.
  var healthCheckScheduled = false;
  function scheduleHealthCheck(){
    if(healthCheckScheduled) return;
    healthCheckScheduled = true;
    requestAnimationFrame(function(){ healthCheckScheduled = false; checkTutorialHealth(); });
  }
  var tutorialWatcher = new MutationObserver(function(){ scheduleHealthCheck(); });
  tutorialWatcher.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

  function start(id){
    // A tour step's target can be genuinely tapped now (see the
    // pointer-events comment above), and some of those taps navigate to a
    // whole different page instead of opening a modal — "My Study Plan" on
    // the last dashboard step, for one. That page transition itself calls
    // startWhenClear() for the NEXT tour in the very same synchronous tick,
    // before the tutorialWatcher below ever gets a chance to fire and finish()
    // the old one — so without this check, a still-"active" dashboard tour
    // would permanently block the study-plan tour from ever starting.
    // Detect it here instead: if the previous tour's own current-step
    // target is no longer on screen, its page is gone — treat that exactly
    // like the student finished it themselves.
    if(active && active.id !== id){
      var staleStep = active.steps[active.index];
      var staleEl = staleStep && resolve(staleStep);
      if(!staleEl || staleEl.offsetParent === null){ finish(); }
    }
    if(active || done(id)) return;
    var steps = TOURS[id];
    if(!steps || !steps.length) return;
    active = { id: id, steps: steps, index: 0 };
    document.getElementById('tutLayer').classList.add('open');
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, true);
    render();
  }

  // A tour shouldn't start behind, or on top of, the welcome dialog or any
  // other modal — wait until nothing's blocking, then go.
  function startWhenClear(id){
    if(done(id)) return;
    var tries = 0;
    (function attempt(){
      tries++;
      var blocked = document.querySelector('.modal-overlay.open, #studentInfoOverlay.open');
      if(blocked && tries < 20){ setTimeout(attempt, 400); return; }
      start(id);
    })();
  }

  function replay(id){
    finish();
    clearDone(id);
    setTimeout(function(){ start(id); }, 50);
  }

  function bind(){
    var next = document.getElementById('tutNext');
    var skip = document.getElementById('tutSkip');
    if(next) next.addEventListener('click', advance);
    if(skip) skip.addEventListener('click', finish);
  }
  if(document.readyState === 'complete'){ bind(); }
  else { window.addEventListener('load', bind); }

  window.AAUP_TUTORIAL = { start: start, startWhenClear: startWhenClear, replay: replay, hasSeen: done };
})();
