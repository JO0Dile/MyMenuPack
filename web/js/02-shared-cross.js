/* =============================================================================
   SHARED CROSS-PAGE GLOBALS
   showPage() and toggleLang() are called from plain onclick="" attributes
   all over the markup (nav buttons, plan cards, course-modal links), so they
   stay as true globals rather than being wrapped in a module IIFE.
   window.__registerPlanData() is the one bridge between each major's own
   script block (section c) and every later shared feature module: it hands
   over that major's COURSE_INFO/PREREQS so GPA, the Degree Audit, the Plan
   Editor, etc. never need their own copy of the same data.
   ============================================================================= */

// Shared HTML-escaping helper. Most of this file interpolates the user's
// OWN localStorage data into innerHTML, which is a non-issue (self-XSS at
// worst — a user can only attack their own browser with their own data).
// It stops being a non-issue the moment plan text can arrive from someone
// ELSE's browser — which is exactly what the online plans feed and the
// "Contribute" pipeline do (see AAUP_HOME / APP_PLANS_FEED_URL). Every
// place that ingests a plan FROM that feed escapes text fields through
// this before they ever reach an innerHTML template.
window.__escapeHtml = function(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch];
  });
};
// Exact inverse of __escapeHtml's five entities — nothing more. Exists so
// __cleanText below can be IDEMPOTENT: text that's already been escaped
// once (a plan exported from this app, then re-imported) gets unescaped
// back to its raw form before being escaped again, instead of turning
// "&" into "&amp;amp;" a little more on every export→import round trip.
window.__unescapeHtml = function(s){
  return String(s == null ? '' : s)
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
};
window.__cleanText = function(s){
  return window.__escapeHtml(window.__unescapeHtml(s));
};
// The app's three semester slots are s1, s2, and s3 (summer). "summer" is
// accepted everywhere as a friendly alias for s3, so a hand-written plan or
// a feed submission can spell it the obvious way and still land in the
// summer semester instead of silently not rendering. Defined top-level (not
// inside a sanitizer) so both the import and online-sync paths can rely on
// it regardless of which runs first on a given load.
window.__normalizeSemester = function(s){
  if(s === 'summer' || s === 's3') return 's3';
  return (s === 's2') ? 's2' : 's1';
};
// The same escape-and-reslugify treatment AAUP_SYNC applies to plans that
// arrive over the network, for plans that arrive any OTHER way: pasted
// into the Developer Panel, restored from a "progress backup" file, or
// originally created by typing into the Add Course / New Plan forms.
// Those paths used to be trusted on the reasoning that a file the user
// personally opened is their own problem ("self-XSS at worst") — but the
// Export and Contribute buttons exist precisely so students SEND each
// other these files, which makes an imported plan attacker-controlled in
// practice, and its strings feed the same innerHTML render paths as
// everything else. Idempotent (see __cleanText), so already-clean plans
// pass through byte-identical and re-sanitizing is always safe.
window.__sanitizeImportedPlan = function(p){
  if(!p || typeof p !== 'object') return p;
  var clean = window.__cleanText;
  function safeId(s, fallback){
    var str = String(s == null ? '' : s);
    // Already-safe ids pass through VERBATIM — collapsing hyphen runs
    // would silently rename e.g. the "calc-1--retake" ids the retake
    // scheduler creates, orphaning the progress and grades keyed on them.
    if(/^[a-z0-9-]+$/.test(str)) return str;
    var out = str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return out || fallback || ('x-' + Math.random().toString(36).slice(2, 8));
  }
  var normalizeSemester = window.__normalizeSemester;
  function cleanName(n){
    if(n == null) return n;
    if(typeof n === 'object') return { big: clean(n.big || ''), small: clean(n.small || '') };
    return clean(n);
  }
  var CATS = ['skills','core','math','dept','eng','uni','free'];
  if(p.majorName){
    p.majorName = { en: cleanName(p.majorName.en), ar: cleanName(p.majorName.ar) };
  }
  if(p.icon != null){ p.icon = String(p.icon).slice(0, 8); }
  if(p.bio && typeof p.bio === 'object'){ p.bio = { en: clean(p.bio.en || ''), ar: clean(p.bio.ar || '') }; }
  if(p.college && typeof p.college === 'object'){ p.college = { en: clean(p.college.en || ''), ar: clean(p.college.ar || '') }; }
  if(p.university != null && !(window.APP_UNIVERSITIES && window.APP_UNIVERSITIES[p.university])){ p.university = 'aaup'; }
  if(p.structure && Array.isArray(p.structure.years)){
    p.structure.years = p.structure.years.map(function(y){
      return { id: safeId(y && y.id, 'y1'), hasSummer: !!(y && y.hasSummer) };
    });
  }
  if(Array.isArray(p.courses)){
    p.courses = p.courses.slice(0, 400).map(function(c){
      if(!c || typeof c !== 'object') return null;
      var out = {
        id: safeId(c.id),
        name: clean(c.name || c.id || ''),
        ar: clean(c.ar || ''),
        creditHours: Math.max(0, Math.min(20, Number(c.creditHours) || 0)),
        category: CATS.indexOf(c.category) !== -1 ? c.category : 'core',
        // The renderer's summer slot is 's3'; a plan (or feed submission) may
        // spell it the friendlier "summer" — normalize so it lands in the
        // summer semester instead of silently not rendering.
        semester: normalizeSemester(c.semester)
      };
      if(c.yearId != null){ out.yearId = safeId(c.yearId, 'y1'); }
      if(c.courseNumber != null){ out.courseNumber = clean(c.courseNumber).slice(0, 30); }
      if(c.num != null){ out.num = clean(c.num).slice(0, 30); }
      if(c.isRetake){ out.isRetake = true; }
      return out;
    }).filter(function(c){ return !!c; });
  }
  if(Array.isArray(p.prerequisites)){
    p.prerequisites = p.prerequisites.slice(0, 800).map(function(pair){
      return Array.isArray(pair) ? [safeId(pair[0]), safeId(pair[1])] : null;
    }).filter(function(pair){ return pair && pair[0] && pair[1]; });
  }
  return p;
};

function showPage(id){
  document.getElementById('home').style.display = (id === 'home') ? 'block' : 'none';
  ['robotics','cybersecurity','medical','cs'].forEach(function(p){
    var el = document.getElementById('page-' + p);
    if(el) el.style.display = (id === p) ? 'block' : 'none';
  });
  if(id !== 'home' && window.__redraw && window.__redraw[id]){
    window.__redraw[id]();
  }
  if(id !== 'home' && window.__applyRemovedCourses){ window.__applyRemovedCourses(id); }
  if(id !== 'home' && window.__refreshCollapse){ window.__refreshCollapse(id); }
  if(id !== 'home' && window.__refreshWorkloadSummary){ window.__refreshWorkloadSummary(id); }
  // Seed the semester-completion celebration set for this plan so opening it
  // never fires confetti for semesters that were already finished.
  if(id !== 'home' && window.__celebrateCheck){ window.__celebrateCheck(id); }
  window.scrollTo(0, 0);
}
window.showPage = showPage;

function toggleLang(prefix){
  var page = document.getElementById('page-' + prefix);
  if(!page) return;
  var isAr = !page.classList.contains('rtl-mode');
  page.classList.toggle('rtl-mode', isAr);
  page.setAttribute('dir', isAr ? 'rtl' : 'ltr');

  page.querySelectorAll('[data-ar]').forEach(function(el){
    if(!el.dataset.en){ el.dataset.en = el.textContent; }
    el.textContent = isAr ? el.dataset.ar : el.dataset.en;
  });
  page.querySelectorAll('[data-ar-html]').forEach(function(el){
    if(!el.dataset.enHtml){ el.dataset.enHtml = el.innerHTML; }
    el.innerHTML = isAr ? el.dataset.arHtml : el.dataset.enHtml;
  });

  var label = document.getElementById(prefix + '-langToggleLabel');
  if(label){ label.textContent = isAr ? 'English' : 'العربية'; }

  if(window.__redraw && window.__redraw[prefix]){
    window.__redraw[prefix]();
  }
}
window.toggleLang = toggleLang;

/* Registry that each plan's script fills in with its COURSE_INFO / PREREQS.
   The main search/highlight/popup logic (added later in the document) reads
   this once everything has registered. */
window.__PLAN_DATA = window.__PLAN_DATA || {};

/* ---- Student corrections to the prerequisite arrows ----------------------
   The published plans are transcribed by hand from university PDFs, so a line
   can be missed or read wrong. Rather than making a student wait for a new app
   release, this overlay lets them add a missing arrow or remove a wrong one —
   on the OFFICIAL built-in plans too, not just their own imported ones. It is
   stored separately from the plan itself and applied on top at registration
   time, so the shipped data stays untouched and every edit is individually
   reversible (and survives an app update that rewrites the base plan).
   Read with raw localStorage on purpose: plan scripts register long before
   AAUP_STORAGE is defined further down the file. */
window.__PREREQ_EDITS_KEY = 'aaup_prereqEdits';
window.__prereqPairKey = function(a, b){ return a + '|' + b; };
window.__loadPrereqEdits = function(){
  try{ return JSON.parse(localStorage.getItem(window.__PREREQ_EDITS_KEY) || '{}') || {}; }
  catch(e){ return {}; }
};
window.__savePrereqEdits = function(m){
  try{ localStorage.setItem(window.__PREREQ_EDITS_KEY, JSON.stringify(m)); }catch(e){}
};
window.__applyPrereqEdits = function(prefix, basePrereqs){
  // basePrereqs arrives from stored/imported plan data, so it is not
  // guaranteed to be an array at all — `.slice`/`.filter` on an object threw
  // and took the whole plan render down with it.
  if(!Array.isArray(basePrereqs)) basePrereqs = [];
  var edits = window.__loadPrereqEdits()[prefix];
  if(!edits) return basePrereqs.slice();
  var removed = {};
  (edits.removed || []).forEach(function(k){ removed[k] = true; });
  var out = basePrereqs.filter(function(pair){
    return !removed[window.__prereqPairKey(pair[0], pair[1])];
  });
  var seen = {};
  out.forEach(function(pair){ seen[window.__prereqPairKey(pair[0], pair[1])] = true; });
  (edits.added || []).forEach(function(pair){
    if(!pair || !pair[0] || !pair[1]) return;
    var k = window.__prereqPairKey(pair[0], pair[1]);
    if(seen[k]) return;
    seen[k] = true;
    out.push([pair[0], pair[1]]);
  });
  return out;
};

window.__registerPlanData = function(prefix, courseInfo, prereqs){
  var base = Array.isArray(prereqs) ? prereqs : [];
  var effective = window.__applyPrereqEdits(prefix, base);
  // Object.create(null), not {}. Course slugs are data — an imported plan can
  // name a course "constructor", "__proto__", "toString" or "valueOf", and on a
  // normal object `needsMap[b] || []` then returned the INHERITED function
  // instead of a fresh array, so `.push()` threw and the entire study plan
  // rendered zero courses. A prototype-less map has no inherited names to
  // collide with. Every reader here uses `map[key] || []`, which is unaffected.
  var needsMap = Object.create(null), unlocksMap = Object.create(null);
  effective.forEach(function(pair){
    // Non-pair junk (strings, numbers, nulls, objects) survives inside an
    // otherwise valid array; indexing those yields undefined rather than a slug.
    if(!pair || typeof pair !== 'object') return;
    var a = pair[0], b = pair[1];
    if(typeof a !== 'string' || typeof b !== 'string' || !a || !b) return;
    (unlocksMap[a] = unlocksMap[a] || []).push(b);
    (needsMap[b] = needsMap[b] || []).push(a);
  });
  window.__PLAN_DATA[prefix] = {
    courseInfo: courseInfo,
    prereqs: effective,
    // The plan exactly as shipped/imported, kept so a student's overlay can be
    // recomputed (or cleared back to official) without a page reload.
    basePrereqs: base,
    needsMap: needsMap,
    unlocksMap: unlocksMap
  };
};

// Re-applies the overlay onto the untouched base data and repaints the arrows.
window.__rebuildPlanData = function(prefix){
  var d = window.__PLAN_DATA[prefix];
  if(!d) return;
  window.__registerPlanData(prefix, d.courseInfo, d.basePrereqs || d.prereqs);
  if(window.__redraw && window.__redraw[prefix]){ window.__redraw[prefix](); }
  else if(window.AAUP_IMPORTED && window.AAUP_IMPORTED.refresh){ window.AAUP_IMPORTED.refresh(prefix); }
};

// The courses a student could actually register for right now: prerequisites
// satisfied AND not already passed.
//
// This exists because ".course.available" does NOT mean that. A completed
// course keeps the available class (it is, after all, still unlocked), so
// every feature that recommended "what's next" by reading that class alone
// recommended work the student had already finished — the advisor filled a
// whole 18-hour semester with it, and the dashboard's next-up list and its
// "N more available" / "x of y CH" counters were inflated the same way.
// One definition, one place to fix, three call sites that agree.
window.__openCourses = function(prefix){
  var page = document.getElementById('page-' + prefix);
  if(!page) return [];
  var progress = window.__getProgress ? window.__getProgress() : {};
  return Array.prototype.slice.call(page.querySelectorAll('.course.available[id]:not(.course-removed)'))
    .filter(function(el){ return !progress[el.id]; });
};

// What the arrow-drawing code should iterate. Falls back to the plan's own
// hard-coded list if registration hasn't happened yet for any reason.
window.__livePrereqs = function(prefix, fallback){
  var d = window.__PLAN_DATA[prefix];
  return (d && d.prereqs) || fallback || [];
};
