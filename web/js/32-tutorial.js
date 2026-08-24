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

  // The first match that is actually on screen. Several selectors in this
  // file hit a legacy element that is still in the DOM but hidden at the
  // current width — the dashboard keeps its old desktop stat cards behind
  // the phone hero strip, so "#dashboard .dash-card" finds a display:none
  // Progress card long before it finds the one a student can see, and the
  // step was silently dropped for pointing at nothing.
  function firstVisible(sel, root){
    var list = (root || document).querySelectorAll(sel);
    for(var i = 0; i < list.length; i++){
      if(list[i].offsetParent !== null) return list[i];
    }
    return null;
  }

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

  // Calls fn once the page has stopped scrolling — measured, not timed.
  // Reads the target's own position each frame and fires when it has held
  // still for two consecutive frames, with a cap so a page that never
  // settles cannot leave a step hanging.
  function afterScrollSettles(el, fn){
    var MAX_WAIT = 800, started = Date.now();
    var lastTop = null, stable = 0;
    (function tick(){
      var top = Math.round(el.getBoundingClientRect().top);
      stable = (top === lastTop) ? stable + 1 : 0;
      lastTop = top;
      if(stable >= 2 || Date.now() - started > MAX_WAIT){ fn(); return; }
      requestAnimationFrame(tick);
    })();
  }

  // Opens the plan's first year if it is folded, so a step about a course
  // has a course on screen to point at. Idempotent — place() calls prepare()
  // again on every reflow — and it goes through the real toggle rather than
  // stripping the class, so the state is stored and the connectors redraw
  // exactly as they would for a tap.
  function openFirstYear(){
    var root = visiblePlanRoot();
    var block = root.querySelector('.imp-year-block');
    if(!block || !block.classList.contains('year-collapsed')) return;
    var toggle = block.querySelector('.imp-year-toggle');
    if(toggle) toggle.click();
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
    // Rebuilt too. Three of its five steps pointed at .dash-card by index —
    // first, second, fourth — which stopped meaning anything when the
    // dashboard's panels were reordered and folded: two of the five
    // resolved to hidden cards and were dropped, so a "5-step" tour
    // introduced itself as step 1 of 3. Every step here names what it wants
    // rather than counting to it.
    dashboard: [
      { target: function(){ return firstVisible('#dashboard .dash-phone-hero') || firstVisible('#dashboard .dash-card'); },
        title: 'Where you stand',
        text: 'How much of the degree is behind you, your GPA, and the hours still left — the three numbers, in one line.' },
      { target: function(){ return firstVisible('#dashboard .grad-card'); },
        title: 'When do I graduate?',
        text: 'Worked out from the hours you have left and how many you take a semester. Move the slider and the date moves with it.' },
      { target: function(){ return firstVisible('#dashboard .dash-card:not(.grad-card)'); },
        title: 'What can I take next',
        text: 'Courses whose prerequisites you have already ticked off — the answer to "what am I actually allowed to register for", with the reason attached to each one.' },
      { target: function(){ return firstVisible('#dashboard .dash-quicklink'); },
        title: 'Everything else',
        text: 'Your path through the degree, the audit, achievements, next semester — all one tap from here.' },
      { target: function(){ return nth(document.querySelectorAll('#dashboard .dash-actions .home-btn'), 1); },
        title: 'My Study Plan',
        text: 'The whole course map: every year, its prerequisites, and where what you have finished slots in.' }
    ],
    // Rebuilt against the plan page as it now is.    // Rebuilt against the plan page as it now is. Two of these steps used to
    // point at things that no longer exist, and three more pointed INTO a
    // year — which now starts folded, so their targets resolved to hidden
    // cards and the drop-if-hidden rule silently deleted them. That is why a
    // student reported a four-step tour introducing itself as "1 / 2".
    //
    // The course steps carry a prepare() that opens Year 1 first, so the tour
    // puts the screen into the state it is about to describe instead of
    // skipping past whatever is not already showing.
    studyplan: [
      { target: function(){ return visiblePlanRoot().querySelector('.now-tag') || visiblePlanRoot().querySelector('.imp-year-toggle'); },
        title: 'You are here',
        text: 'The plan opens on the semester you are in and marks it. Everything ahead of it is folded away, one bar per year, each saying how far through it you are.' },
      { target: function(){
          var blocks = visiblePlanRoot().querySelectorAll('.imp-year-block.year-collapsed .imp-year-toggle');
          return blocks[0] || visiblePlanRoot().querySelector('.imp-year-toggle');
        },
        title: 'Open a year',
        text: 'Tap a folded year to see inside it. Hold it instead, and everything you cannot take yet fades — what stays lit is what is open to you today.' },
      { prepare: openFirstYear,
        target: function(){ return visiblePlanRoot().querySelector('.imp-year-body .course'); },
        title: 'Courses',
        text: 'Tap a course for its details and prerequisites, or tick the box once you have passed it — that is what feeds Progress and GPA on your Dashboard.' },
      { prepare: openFirstYear,
        target: aConnectedCourse,
        title: 'What connects to what',
        text: 'Press and hold a course. What it needs first lights up in one colour, what it opens up in another. Go ahead, try it.',
        interactive: true },
      { target: function(){ return visiblePlanRoot().querySelector('.pf-bar'); },
        title: 'Ask the whole plan',
        text: 'These filter every year at once — the years with nothing matching drop out entirely. They live in the hours bar, so they are still there when you are four years down the page.' },
      { target: function(){ return visiblePlanRoot().querySelector('.progress-widget'); },
        title: 'Where you are',
        text: 'Hours done out of hours needed, and which requirement is closest to being finished. Scroll down and it comes with you, shrinking out of the way.' },
      { target: function(){ return visiblePlanRoot().querySelector('.course-search-wrap .search-box'); },
        title: 'Search a course',
        text: 'Find any course by name or number instead of opening years looking for it — the year it lives in opens itself. Try typing one now.',
        noDim: true, // its results dropdown renders below the spotlighted box, in territory a dark backdrop would otherwise hide
        avoidBelow: function(){ return visiblePlanRoot().querySelector('.course-search-wrap .search-dropdown.open'); },
        watchReflow: function(){ return visiblePlanRoot().querySelector('.course-search-wrap .search-dropdown'); } },
      { target: function(){ return document.querySelector('#sbTabBar [data-sb-tab="more"]') || document.querySelector('#sbTabBar .sb-tab:last-child'); },
        title: 'Everything else is in here',
        text: 'Your degree audit, achievements, what to take next, the course library — and Edit Mode at the very top, for changing the plan itself.' },
      { target: function(){
          var legend = visiblePlanRoot().querySelector('.legend');
          // Once expanded, spotlight the whole panel (not just the header)
          // so the newly-revealed colour key is inside the lit-up area
          // instead of sitting in the dimmed backdrop underneath it.
          return (legend && legend.classList.contains('expanded')) ? legend : visiblePlanRoot().querySelector('.legend-toggle');
        },
        title: 'Legend',
        text: 'Every colour on this page means something — university requirement, elective, specialization course. Tap it to see which is which.',
        interactive: true,
        watchTarget: function(){ return visiblePlanRoot().querySelector('.legend'); },
        interactionClass: 'expanded',
        reflowDelay: 320 } // matches .legend-items' own max-height transition, so the panel has finished growing before it's measured
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
        text: 'This is YOUR plan — nothing here is shared until you choose to Export or Contribute it, both in the menu under Advanced. Add, remove and rearrange freely; everything saves as you go, with no Save button to remember.' },
      { prepare: openFirstYear,
        target: function(){ return importedEditRoot().querySelector('.imp-year-body .imp-add-course-card'); },
        title: 'Add a course',
        text: 'Tap + in any semester to add a course by hand — name, credit hours, category, even its prerequisites. Try it now.' },
      // The Course Library used to be a button in this header. It is a menu
      // row now, along with everything else that only navigates somewhere,
      // so the step points at the menu rather than at a button that is gone.
      { target: function(){ return document.querySelector('#sbTabBar [data-sb-tab="more"]') || document.querySelector('#sbTabBar .sb-tab:last-child'); },
        title: 'Course Library',
        text: 'Or skip the typing. Advanced → Course Library in the menu copies a course straight out of an official plan, shelf by shelf.' },
      { prepare: openFirstYear,
        target: function(){ return importedEditRoot().querySelector('.imp-year-body .imp-edit-course-btn'); },
        title: 'Edit a course',
        text: 'Tap the pencil on any course to fix its name, credit hours, or category later — nothing here is permanent.' },
      { prepare: openFirstYear,
        target: function(){ return importedEditRoot().querySelector('.imp-year-body .course[id]'); },
        title: 'Move a course',
        text: 'Press and hold a course, then drag it to a different semester — the app checks prerequisites for you and warns if the new order would break something. Give it a try.' },
      // New here: the elective pool is the one place where dragging is not
      // optional. The plan does not schedule these, so nothing knows when a
      // student takes them until they say so.
      { target: function(){ return importedEditRoot().querySelector('.imp-elective-block .course[id]'); },
        title: 'Electives you choose',
        text: 'These have no semester of their own — the plan does not schedule them. Drag one into the semester you actually take it in, and it becomes part of that term. Drag it back here to undo that.' },
      { target: function(){ return importedEditRoot().querySelector('.imp-structure-actions .home-btn'); },
        title: 'Add a Year',
        text: 'Need more than what’s here? Add another year any time — each year can also get a Summer semester from its own header, and both can be removed again just as easily.' },
      { prepare: openFirstYear,
        target: function(){ return importedEditRoot().querySelector('.imp-year-body .imp-remove-course-btn'); },
        title: 'Remove a course',
        text: 'The ✕ on a course takes it out of your plan — you always get an “are you sure” first.' },
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
    // A step may need the screen put in a state before its target exists on
    // it — with every year folded by default, the course steps point at
    // cards inside a closed year, and the drop-if-hidden rule below would
    // quietly delete half the tour. prepare() opens what the step is about
    // to talk about. It must be idempotent: place() runs again on reflow.
    if(step && typeof step.prepare === 'function'){
      try{ step.prepare(); }catch(e){}
    }
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
    // The words go up first, before the scroll. Waiting for the scroll to
    // settle (below) is right for POSITIONING, but writing the text there
    // too meant the card kept the previous step's title and count for the
    // whole of the scroll — pressing Next appeared to do nothing.
    document.getElementById('tutTitle').textContent = step.title;
    document.getElementById('tutText').textContent = step.text;
    document.getElementById('tutProgress').textContent = (active.index + 1) + ' / ' + active.steps.length;
    document.getElementById('tutNext').textContent =
      (active.index === active.steps.length - 1) ? 'Got it!' : 'Next';

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Two animation frames used to be the whole wait. That is fine for a
    // target already on screen and wrong for one that is not: a smooth
    // scroll takes a few hundred milliseconds, so the rect was read while
    // the page was still moving and the spotlight got pinned to where the
    // target HAD been. On a long plan that put it below the fold with its
    // tooltip — and its Next button — off the bottom of the screen.
    //
    // Waiting for the rect to stop changing covers both cases without
    // guessing a duration.
    afterScrollSettles(el, function(){
      (function(){
        // Re-check: enough has happened for finish() to have run (e.g. a
        // rapid plan switch) and cleared `active` out from under this
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

        var waitingOnInteraction = !!(step.interactive && !active._interactionDone);
        // Both buttons used to read "Skip" while a step waited on an
        // interaction — one meaning "skip this step", the other "skip the
        // whole tour", with nothing distinguishing them. The primary keeps
        // its normal label: pressing it moves on without doing the gesture,
        // which is what skipping the step already meant.
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
      })();
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
