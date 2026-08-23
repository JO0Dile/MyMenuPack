// ==========================
// IMPORTED PLANS (structured renderer)
// ==========================
// A custom plan now registers through window.__registerPlanData(), the
// exact same bridge each built-in major uses — so once its courses render
// as real .course[id] elements inside real .course-row[id] semester
// containers, GPA, Degree Audit, Achievements, the AI Advisor, and the
// drag-and-drop Plan Editor all work on it unmodified. No SVG prerequisite
// diagram (that stays a built-in-major thing — see the Plan Editor's own
// banner for why), but everything else is the real thing, not a mockup.
//
// Backward compatible: a plan imported before this update (raw JSON paste,
// free-text `semester` labels, no `structure`) still renders through the
// original simple grouped-list view further down in this file.
(function(){
  var ICONS = ['🤖','🔒','⚕️','💻','📊','🔬','🎨','📚','⚙️','🌐'];
  // The whole view re-renders (host.innerHTML = ...) on every interaction —
  // checkbox toggle, course add, drag — so anything that would normally
  // live as a DOM class (rtl-mode, legend expanded) has to be tracked here
  // instead, or it silently resets on the very next render.
  var rtlState = {};
  var legendOpen = {};
  var currentOpenPlanId = null;

  // Every one of the ~55 readers below assumes each value here is a plan
  // OBJECT. A single null (or number, or string) entry — which an import, a
  // half-written sync, or a student poking at localStorage can produce — threw
  // "Cannot read properties of null (reading 'university')" out of the home
  // screen's plan walk and took the ENTIRE card grid with it: every other
  // perfectly valid plan disappeared because of one bad sibling. Dropping the
  // unusable entries here, at the single point they are all read from, keeps
  // one corrupt record from costing a student every plan they have.
  function loadImportedPlans(){
    var raw = window.AAUP_STORAGE.getJSON('aaup_importedPlans', {});
    var out = {};
    Object.keys(raw).forEach(function(id){
      var p = raw[id];
      if(p && typeof p === 'object' && !Array.isArray(p)) out[id] = p;
    });
    return out;
  }
  function saveImportedPlans(m){ window.AAUP_STORAGE.setJSON('aaup_importedPlans', m); renderHomeCards(); }

  // Old plans stored majorName.en as a plain string; new ones store
  // {big, small} to match the built-in cards' two-tone title. Reading
  // through this helper means both shapes display correctly everywhere.
  function nameParts(field){
    if(field && typeof field === 'object'){ return { big: field.big || '', small: field.small || '' }; }
    return { big: field || '', small: '' };
  }
  function hasStructure(p){ return !!(p.structure && Array.isArray(p.structure.years) && p.structure.years.length); }

  // Plan strings are sanitized on the way IN — on import, on sync, and again
  // for every stored plan at boot (see the pass at the bottom of this file).
  // These two escape them again on the way OUT, so a plan that reaches
  // storage through some path that skips the sanitizer still cannot put
  // markup on the page. __cleanText is idempotent, so already-clean text
  // renders byte-identical and nothing double-escapes.
  //
  // This is not theoretical: writing a majorName of
  // "<img src=x onerror=…>" straight into storage and calling
  // renderHomeCards() ran the handler, because the card wrote the name into
  // innerHTML raw. It survived only until the next boot re-sanitized it —
  // one page load is plenty.
  function txt(s){
    var v = String(s == null ? '' : s);
    return window.__cleanText ? window.__cleanText(v) : v;
  }
  // A plan id lands inside a JS string inside an HTML attribute, so it needs
  // both escapes: backslash and quote for the JS layer, then HTML for the
  // attribute the browser decodes first.
  function jsAttr(s){
    return txt(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  }

  // Where a plan sits among its faculty's tiles. Empty means unplaced, not
  // zero — zero is a real position that would move the plan to the front.
  function sortOrderOf(p){
    var v = p && p.sortOrder;
    if(v == null || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  // Plans the admin has placed come first, in that order; everything else
  // follows alphabetically. Mirrors the same comparator in the admin Worker
  // and the catalogue build, so all three agree on what students see.
  function compareByDisplayOrder(a, b){
    var ao = sortOrderOf(a), bo = sortOrderOf(b);
    if(ao !== null && bo !== null && ao !== bo) return ao - bo;
    if(ao !== null && bo === null) return -1;
    if(ao === null && bo !== null) return 1;
    return nameParts((a && a.majorName && a.majorName.en) || '').big
      .localeCompare(nameParts((b && b.majorName && b.majorName.en) || '').big);
  }

  function collegeKeyForPlan(p){
    var uniId = p.university || 'aaup';
    // A published plan carries its college's id. Prefer it: matching on the
    // display name breaks the moment a faculty is renamed, and an unmatched
    // name silently dumps the plan into "Other / Community".
    if(p.collegeId && (window.APP_COLLEGES || {})[p.collegeId]) return p.collegeId;
    var enText = ((p.college && p.college.en) || '').trim().toLowerCase();
    var arText = ((p.college && p.college.ar) || '').trim();
    if(enText || arText){
      var regId = Object.keys(window.APP_COLLEGES || {}).filter(function(cid){
        var c = window.APP_COLLEGES[cid];
        if(c.university !== uniId) return false;
        return (enText && (c.name.en || '').trim().toLowerCase() === enText) ||
               (arText && (c.name.ar || '').trim() === arText);
      })[0];
      if(regId) return regId;
      return 'custom:' + uniId + ':' + (enText || arText).replace(/\s+/g, '-');
    }
    return 'custom:' + uniId + ':unspecified';
  }

  // Tapping a plan whose courses are not in yet: say why, rather than opening
  // an empty grid or silently doing nothing.
  function notePending(id){
    var rtl = window.__anyVisiblePageIsRtl ? window.__anyVisiblePageIsRtl() : false;
    if(window.AAUP_CONTRIBUTE && id){
      window.AAUP_CONTRIBUTE.offerToHelp(id);
      return;
    }
    if(window.__showToast){
      window.__showToast(rtl
        ? '\u23f3 هذه الخطة منشورة لكن مساقاتها لم تُدخل بعد.'
        : '\u23f3 This programme is published, but its course list has not been added yet.');
    }
  }

  function renderHomeCards(){
    var rtl = window.__anyVisiblePageIsRtl ? window.__anyVisiblePageIsRtl() : false;
    var container = document.getElementById('importedPlansContainer');
    if(!container) return;
    var plans = loadImportedPlans();
    var sel = (window.AAUP_HOME && window.AAUP_HOME.getSelection) ? window.AAUP_HOME.getSelection() : null;
    var ids = Object.keys(plans).filter(function(id){
      if(!sel || !sel.college) return true;
      var p = plans[id];
      return (p.university || 'aaup') === sel.university && collegeKeyForPlan(p) === sel.college;
    });
    ids.sort(function(a, b){ return compareByDisplayOrder(plans[a], plans[b]); });
    if(ids.length === 0){ container.innerHTML = ''; if(window.AAUP_HOME){ window.AAUP_HOME.refreshPlanEmptyState(); window.AAUP_HOME.refreshCounts(); } return; }
    container.innerHTML = '<div class="plan-grid" style="margin-top:14px;">' + ids.map(function(id){
     try {
      var p = plans[id];
      // A malformed/half-created plan (no name or no course list) must never
      // throw here \u2014 one bad card would abort the whole home render and blank
      // the app. Skip it instead.
      if(!p || !p.majorName || (!p.majorName.en && !p.majorName.ar)) return '';
      var en = nameParts(p.majorName.en);
      var ar = nameParts(p.majorName.ar);
      var courseCount = Array.isArray(p.courses) ? p.courses.length : 0;
      // A plan with no courses yet is a real, published programme whose
      // curriculum has not been transcribed. Opening it shows an empty grid,
      // which reads as "this app is broken" rather than "this plan is not in
      // yet" — so the card says so and does not pretend to be openable.
      var pending = courseCount === 0;
      var bio = pending
        ? (rtl
            ? 'الخطة التفصيلية لم تُضف بعد \u2014 قريبًا.'
            : 'Course list not added yet \u2014 coming soon.')
        : ((p.bio && p.bio.en) || (courseCount + ' courses \u00b7 community-imported major'));
      var uni = (window.APP_UNIVERSITIES || {})[p.university || 'aaup'];
      // Words, not emoji. The badge sat over a card whose every other glyph
      // is drawn, and "✅ Official" next to "👤 User Made" was two unrelated
      // pictures doing the work one word does.
      var origin = p.official ? (p.wasEdited ? (rtl ? 'رسمي (معدّل)' : 'Official · edited') : (rtl ? 'رسمي' : 'Official'))
                              : (p.wasEdited ? (rtl ? 'من طالب (معدّل)' : 'Student · edited') : (rtl ? 'من طالب' : 'Student'));
      var badge = (uni ? txt(uni.shortName) + ' \u00b7 ' : '') + txt(origin);
      // Reuses the exact .plan-card class the four built-in majors use —
      // same icon box, same two-tone title, same dim bio text, same small
      // blue CTA — rather than a bespoke look-alike that has to be kept in
      // sync with it by hand.
      var openAction = pending
        ? 'AAUP_IMPORTED.notePending(\'' + jsAttr(id) + '\')'
        : 'AAUP_DASHBOARD.selectAndOpen(\'' + jsAttr(id) + '\')';
      return '<div class="plan-card' + (pending ? ' plan-card-pending' : '') + '" data-page="' + txt(id) + '" data-imported="1" data-pending="' + (pending ? '1' : '0') + '" data-university="' + txt(p.university || 'aaup') + '" data-college="' + txt(collegeKeyForPlan(p)) + '" data-search-en="' + window.__escapeHtml(en.big + ' ' + en.small) + '" data-search-ar="' + window.__escapeHtml(ar.big + ' ' + ar.small) + '" onclick="' + openAction + '" role="button" tabindex="0">' +
        '<span class="imp-origin-badge">' + badge + '</span>' +
        '<button type="button" class="dev-edit-link" data-dev-edit-btn style="display:none;top:36px;" onclick="event.stopPropagation(); AAUP_IMPORTED.confirmDelete(\'' + id + '\');">' + window.AAUP_ICONS.preview('trash', 12) + 'Delete</button>' +
        '<div class="pc-icon">' + window.AAUP_ICONS.markup(p, { size: 30 }) + '</div>' +
        '<h2>' + txt(en.big) + (en.small ? '<em>' + txt(en.small) + '</em>' : '') + '</h2>' +
        '<p class="pc-bio">' + txt(bio) + '</p>' +
        '<div class="pc-cta">' + (pending
          ? (rtl ? 'قريبًا' : 'Coming soon')
          : (rtl ? 'عرض الخطة ←' : 'View plan →')) + '</div></div>';
     } catch(e){ return ''; }
    }).join('') + '</div>';
    if(window.AAUP_HOME){ window.AAUP_HOME.refreshPlanEmptyState(); window.AAUP_HOME.refreshCounts(); }
  }

  // ---------- registering a plan so every shared feature module can see it ----------
  // ---------- transitive reduction on a chosen prerequisite set ----------
  // If someone checks both "Calculus I" and "Calculus II" as prerequisites,
  // and Calculus II already needs Calculus I, drawing a direct arrow from
  // BOTH is redundant — completing Calculus II already implies Calculus I
  // is done. Keep only the "closest" one(s): any selected course that is
  // itself a (direct or transitive) prerequisite of another selected
  // course gets dropped from the direct-edge set.
  // Same two traps as __registerPlanData in 02-shared-cross.js: `pairs` may not
  // be an array at all, and a course slug of "constructor"/"__proto__"/
  // "toString" collides with an inherited name on a plain {} map, so
  // `needs[b] || []` hands back a function and .push() throws.
  function computeNeedsFromPairs(pairs){
    var needs = Object.create(null);
    (Array.isArray(pairs) ? pairs : []).forEach(function(pair){
      if(!pair || typeof pair !== 'object') return;
      var a = pair[0], b = pair[1];
      if(typeof a !== 'string' || typeof b !== 'string' || !a || !b) return;
      (needs[b] = needs[b] || []).push(a);
    });
    return needs;
  }
  function isAncestorOf(needsMap, ancestor, node, visited){
    visited = visited || {};
    if(visited[node]) return false; // cycle guard
    visited[node] = true;
    var direct = needsMap[node] || [];
    if(direct.indexOf(ancestor) !== -1) return true;
    return direct.some(function(n){ return isAncestorOf(needsMap, ancestor, n, visited); });
  }
  function reduceToDirectPrereqs(selectedSlugs, needsMap){
    return selectedSlugs.filter(function(candidate){
      return !selectedSlugs.some(function(other){
        return other !== candidate && isAncestorOf(needsMap, candidate, other);
      });
    });
  }

  // ---------- cross-plan auto-linking ----------
  // The same real course (same id) can exist in several plans, since it's
  // the same university offering it. If two courses that are ALREADY
  // linked as prerequisite/dependent somewhere else both happen to exist
  // in THIS plan too, that same link should exist here automatically —
  // nobody should have to manually re-declare "Calculus II needs Calculus
  // I" in every single plan that happens to include both.
  //
  // This only ever looks at courses already present in this plan; it
  // never pulls in a course from elsewhere on its own. And it's re-run
  // from scratch on every add/edit rather than trying to track "was this
  // link auto-generated" indefinitely — simpler, and self-correcting: if
  // an edit changes a course's identity enough that it no longer matches
  // anything, the stale auto-link just isn't regenerated.
  function normalizeName(s){ return String(s || '').trim().toLowerCase(); }

  function findAllOtherPlansData(){
    // {prefix: {courseInfo, prereqs}} for every built-in major (already
    // registered) plus every OTHER imported plan (registered on demand,
    // same as the Course Library does, so a plan nobody has opened this
    // session still counts).
    var out = {};
    Object.keys(window.__PLAN_DATA || {}).forEach(function(prefix){ out[prefix] = window.__PLAN_DATA[prefix]; });
    var imported = loadImportedPlans();
    Object.keys(imported).forEach(function(pid){
      if(out[pid]) return;
      if(hasStructure(imported[pid])){
        var info = buildCourseInfo(imported[pid]);
        var needsMap = computeNeedsFromPairs(imported[pid].prerequisites);
        out[pid] = { courseInfo: info, prereqs: imported[pid].prerequisites || [], needsMap: needsMap };
      }
    });
    return out;
  }

  function runAutoLink(planId, slug){
    var plans = loadImportedPlans();
    var p = plans[planId];
    if(!p) return;
    var course = (p.courses || []).filter(function(c){ return c.id === slug; })[0];
    if(!course) return;

    // 1. Undo any PREVIOUS auto-link involving this course — the
    // situation may have changed (an edit, a removal elsewhere) since it
    // was last computed.
    p.autoLinkedPairs = p.autoLinkedPairs || [];
    p.autoLinkedPairs = p.autoLinkedPairs.filter(function(key){
      var parts = key.split('__');
      if(parts[0] === slug || parts[1] === slug){
        p.prerequisites = (p.prerequisites || []).filter(function(pair){
          return !(pair[0] === parts[0] && pair[1] === parts[1]);
        });
        return false;
      }
      return true;
    });

    // 2. Find every prerequisite relationship elsewhere involving a
    // course with this exact id.
    var others = findAllOtherPlansData();
    var candidates = []; // {otherId, direction}
    Object.keys(others).forEach(function(otherPrefix){
      var data = others[otherPrefix];
      (data.prereqs || []).forEach(function(pair){
        if(pair[0] === slug && pair[1] !== slug){ candidates.push({ otherId: pair[1], direction: 'unlocks', srcPrefix: otherPrefix }); }
        if(pair[1] === slug && pair[0] !== slug){ candidates.push({ otherId: pair[0], direction: 'needs', srcPrefix: otherPrefix }); }
      });
    });

    // 3. Only act on a candidate if a course with that SAME id (AND a
    // matching name — the "only if every piece of information matches"
    // safety net) already exists in THIS plan.
    candidates.forEach(function(cand){
      var localOther = (p.courses || []).filter(function(c){ return c.id === cand.otherId; })[0];
      if(!localOther) return;
      var srcInfo = (others[cand.srcPrefix].courseInfo || {})[cand.otherId];
      if(srcInfo && normalizeName(srcInfo.name) !== normalizeName(localOther.name)) return; // names disagree — treat as a different course despite the shared id

      var a = cand.direction === 'needs' ? cand.otherId : slug;
      var b = cand.direction === 'needs' ? slug : cand.otherId;
      var existingNeeds = computeNeedsFromPairs(p.prerequisites);
      // Skip if already linked (directly or transitively) either way —
      // covers "already linked" and "would create a cycle".
      if(isAncestorOf(existingNeeds, a, b) || isAncestorOf(existingNeeds, b, a)) return;
      var key = a + '__' + b;
      if(p.autoLinkedPairs.indexOf(key) !== -1) return;
      p.prerequisites.push([a, b]);
      p.autoLinkedPairs.push(key);
    });

    saveImportedPlans(plans);
  }

  function buildCourseInfo(plan){
    var info = {};
    (plan.courses || []).forEach(function(c){
      info[c.id] = {
        // A course's real catalog code can arrive as either "num" (an older
        // field name still accepted for backward compatibility) or
        // "courseNumber" (the field the plans feed's documented schema and
        // every plan built this session actually use) — without this
        // fallback, every course popup showed "-" instead of its real code
        // even when the plan data had one.
        num: c.num || c.courseNumber || '-', name: c.name, th: '-', pr: '-',
        cr: String(c.creditHours != null ? c.creditHours : 0),
        // The university's requirement bucket for this course, when the
        // published plan says which one it is. Empty for a major no published
        // plan covers; readers fall back to guessing from the visual category.
        req: c.requirement || '',
        prereq: '-', ar: c.ar || c.name
      };
    });
    return info;
  }
  function registerPlan(id, plan){
    if(window.__registerPlanData){
      window.__registerPlanData(id, buildCourseInfo(plan), plan.prerequisites || [],
                                { requirementHours: plan.requirementHours || {} });
    }
  }

  // ---------- progress (shares the SAME storage + object as every built-in major) ----------
  function fullId(planId, slug){ return planId + '-c-' + slug; }
  function isDone(planId, slug){
    var progress = window.__getProgress ? window.__getProgress() : {};
    return !!progress[fullId(planId, slug)];
  }
  function persistProgress(){
    if(!window.__PROGRESS_STORAGE_KEY) return;
    try{ localStorage.setItem(window.__PROGRESS_STORAGE_KEY, JSON.stringify(window.__getProgress())); }catch(e){}
  }
  function isAvailable(planId, slug){
    var data = window.__PLAN_DATA[planId] || {};
    var needs = (data.needsMap && data.needsMap[slug]) || [];
    return needs.every(function(r){ return isDone(planId, r); });
  }
  function toggleCourse(planId, slug){
    var progress = window.__getProgress ? window.__getProgress() : {};
    var data = window.__PLAN_DATA[planId] || {};
    var id = fullId(planId, slug);
    if(progress[id]){
      delete progress[id];
      // Cascade-uncheck: nothing that directly needed this can still count
      // as done once its own prerequisite is undone — same rule the
      // built-in majors already enforce.
      (function cascade(s){
        var deps = (data.unlocksMap && data.unlocksMap[s]) || [];
        deps.forEach(function(d){
          var did = fullId(planId, d);
          if(progress[did]){ delete progress[did]; cascade(d); }
        });
      })(slug);
    } else if(isAvailable(planId, slug)){
      progress[id] = true;
    }
    persistProgress();
  }

  // ---------- structure editing (add/remove year, add/remove summer) ----------
  function yearCourseCount(plan, yearId, semester){
    return (plan.courses || []).filter(function(c){
      return c.yearId === yearId && (semester ? c.semester === semester : true);
    }).length;
  }
  function withPlan(planId, fn){
    var plans = loadImportedPlans();
    var p = plans[planId];
    if(!p) return;
    fn(p, plans);
  }
  function addYear(planId){
    withPlan(planId, function(p, plans){
      var n = p.structure.years.length + 1;
      p.structure.years.push({ id: 'y' + n, hasSummer: false });
      saveImportedPlans(plans);
      render(planId);
    });
  }
  function removeYear(planId, yearId){
    withPlan(planId, function(p, plans){
      if(yearCourseCount(p, yearId) > 0){
        if(window.__showToast){ window.__showToast('🚫 This year still has courses in it — remove or move them first.'); }
        return;
      }
      p.structure.years = p.structure.years.filter(function(y){ return y.id !== yearId; });
      saveImportedPlans(plans);
      render(planId);
    });
  }
  function addSummer(planId, yearId){
    withPlan(planId, function(p, plans){
      var y = p.structure.years.filter(function(yy){ return yy.id === yearId; })[0];
      if(!y) return;
      y.hasSummer = true;
      saveImportedPlans(plans);
      render(planId);
    });
  }
  function removeSummer(planId, yearId){
    withPlan(planId, function(p, plans){
      if(yearCourseCount(p, yearId, 's3') > 0){
        if(window.__showToast){ window.__showToast('🚫 This summer still has courses in it — remove or move them first.'); }
        return;
      }
      var y = p.structure.years.filter(function(yy){ return yy.id === yearId; })[0];
      if(!y) return;
      y.hasSummer = false;
      saveImportedPlans(plans);
      render(planId);
    });
  }

  // ---------- adding a course (form popup, reachable from a "+" card
  // sitting directly inside the semester it will be added to — so where it
  // lands never has to be typed or remembered, just clicked) ----------
  // ---------- removing a course ----------
  function confirmRemoveCourse(planId, slug){
    var plans = loadImportedPlans();
    var p = plans[planId];
    if(!p) return;
    var course = (p.courses || []).filter(function(c){ return c.id === slug; })[0];
    if(!course) return;
    var dependents = (p.prerequisites || []).filter(function(pair){ return pair[0] === slug; }).map(function(pair){ return pair[1]; });
    var dependentNames = dependents.map(function(depSlug){
      var d = (p.courses || []).filter(function(c){ return c.id === depSlug; })[0];
      return d ? d.name : depSlug;
    });
    var msg = 'Remove "' + course.name + '"?' +
      (dependentNames.length ? ' ' + dependentNames.join(', ') + ' currently need it — that prerequisite link will be removed too, not the courses themselves.' : '') +
      ' This can\u2019t be undone.';
    if(window.__showConfirmDialog){
      window.__showConfirmDialog(msg, function(){ removeCourse(planId, slug); });
    } else if(window.confirm(msg)){
      removeCourse(planId, slug);
    }
  }
  function removeCourse(planId, slug){
    var plans = loadImportedPlans();
    var p = plans[planId];
    if(!p) return;
    var name = ((p.courses || []).filter(function(c){ return c.id === slug; })[0] || {}).name || slug;
    p.courses = (p.courses || []).filter(function(c){ return c.id !== slug; });
    // Cascade-clean prerequisite pairs in BOTH directions — otherwise a
    // removed course leaves dangling references (as something's stated
    // prerequisite, or requiring a prerequisite that no longer exists).
    p.prerequisites = (p.prerequisites || []).filter(function(pair){ return pair[0] !== slug && pair[1] !== slug; });
    saveImportedPlans(plans);
    var progress = window.__getProgress ? window.__getProgress() : {};
    delete progress[planId + '-c-' + slug];
    persistProgress();
    if(window.__showToast){ window.__showToast('🗑 Removed "' + name + '".'); }
    render(planId);
  }

  // ---------- duplicate detection ----------
  // Catches the "same real course, entered slightly differently" case —
  // e.g. typing "Calculus-1" as an ID when it's already known as "calc-1",
  // or "Calculus 1" as a name when it's registered as "Calculus I". The
  // official course NUMBER (when given) is the most reliable signal, per
  // the reasoning that two different course codes are never the same
  // course — name/ID matching is a fuzzier, secondary check.
  function normalizeForMatch(s){
    var t = String(s || '').trim().toLowerCase();
    t = t.replace(/\b(i|ii|iii|iv|v)\s*$/i, function(m){
      var map = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' };
      return map[m.trim().toLowerCase()] || m;
    });
    return t.replace(/[^a-z0-9]/g, '');
  }
  function findDuplicateCandidate(nameEn, courseNumber, courseId){
    var known = allKnownCourses();
    if(courseNumber){
      var byNum = known.filter(function(k){ return k.num && k.num !== '-' && k.num === courseNumber; })[0];
      if(byNum) return byNum;
    }
    var byId = known.filter(function(k){ return k.slug === courseId; })[0];
    if(byId) return byId;
    var normTarget = normalizeForMatch(nameEn);
    if(normTarget){
      var byName = known.filter(function(k){ return normalizeForMatch(k.name) === normTarget; })[0];
      if(byName) return byName;
    }
    return null;
  }

  function openCourseCreatePopup(planId, yearId, semester){
    var overlay = document.getElementById('devModalOverlay');
    var body = document.getElementById('devModalBody');
    if(!overlay || !body) return;
    var plans = loadImportedPlans();
    var plan = plans[planId];
    if(!plan) return;
    var rtl = !!rtlState[planId];

    var courseOptions = (plan.courses || []).map(function(c){
      return '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-bottom:5px;">' +
        '<input type="checkbox" value="' + c.id + '" class="ncq-prereq-check"> ' + window.__escapeHtml(rtl && c.ar ? c.ar : c.name) + '</label>';
    }).join('') || '<p class="ex-note">' + (rtl ? 'لا توجد مساقات أخرى بعد \u2014 سيكون هذا الأول.' : 'No other courses yet \u2014 this will be the first one.') + '</p>';

    var categories = ['core','math','dept','eng','uni','free','skills'];
    var categoryLabels = rtl
      ? { core:'إجباري', math:'رياضيات', dept:'اختياري تخصصي', eng:'إنجليزي', uni:'اختياري جامعي', free:'اختياري حر', skills:'متطلب جامعي' }
      : { core:'Core', math:'Math', dept:'Department Elective', eng:'English', uni:'University Elective', free:'Free Elective', skills:'University Requirement' };

    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    body.innerHTML =
      '<h2 class="mh" style="margin-top:0;">' + window.AAUP_ICONS.preview('plus', 20) + (rtl ? 'إضافة مساق' : 'Add Course') + '</h2>' +
      '<div class="form-field-row">' +
        '<div class="form-field"><label for="ncqNameEn">' + (rtl ? 'الاسم (بالإنجليزية)' : 'Name (English)') + '</label><input type="text" id="ncqNameEn" maxlength="80"></div>' +
        '<div class="form-field"><label for="ncqNameAr">' + (rtl ? 'الاسم (بالعربية)' : 'Name (Arabic)') + '</label><input type="text" id="ncqNameAr" maxlength="80"></div>' +
      '</div>' +
      '<div class="form-field-row">' +
        '<div class="form-field"><label for="ncqId">' + (rtl ? 'معرّف المساق' : 'Course ID') + '</label><input type="text" id="ncqId" maxlength="40" placeholder="e.g. intro-stats"></div>' +
        '<div class="form-field"><label for="ncqCredits">' + (rtl ? 'الساعات المعتمدة' : 'Credit Hours') + '</label><input type="number" id="ncqCredits" min="0" step="0.5" value="3"></div>' +
      '</div>' +
      '<div class="form-field-row">' +
        '<div class="form-field"><label for="ncqNumber">' + (rtl ? 'رقم المساق (اختياري)' : 'Course Number (optional)') + '</label><input type="text" id="ncqNumber" maxlength="20" placeholder="e.g. 100411010"></div>' +
        '<div class="form-field"><label for="ncqCategory">' + (rtl ? 'الفئة' : 'Category') + '</label><select id="ncqCategory">' +
          categories.map(function(c){ return '<option value="' + c + '">' + categoryLabels[c] + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      '<p class="form-note">' + (rtl ? 'رقم المساق هو أفضل طريقة لمعرفة ما إذا كان هذا نفس المساق الموجود في مكان آخر \u2014 أدخله إن كنت تعرفه.' : 'The course number is the most reliable way to tell whether this is the same course as one that already exists elsewhere \u2014 fill it in if you know it.') + '</p>' +
      '<div class="form-field"><label>' + (rtl ? 'المتطلبات السابقة (اختياري)' : 'Prerequisites (optional)') + '</label>' +
      '<div style="max-height:140px;overflow-y:auto;background:var(--search-bg);border:1px solid var(--line);border-radius:8px;padding:8px;">' + courseOptions + '</div></div>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="ncqCancel">' + (rtl ? 'إلغاء' : 'Cancel') + '</button>' +
      '<button type="button" class="home-btn" id="ncqCreate" style="border-color:var(--accent);color:var(--text);">' + (rtl ? 'إضافة المساق' : 'Add Course') + '</button></div>' +
      '<div id="ncqMsg"></div>';
    overlay.classList.add('open');

    document.getElementById('ncqCancel').addEventListener('click', function(){ overlay.classList.remove('open'); });
    document.getElementById('ncqCreate').addEventListener('click', function(){
      // __cleanText, not raw: these names go straight into innerHTML-built
      // course cards, popups and the Course Library — typing markup here
      // (or pasting it from somewhere) must render as text, not run.
      var nameEn = window.__cleanText(document.getElementById('ncqNameEn').value.trim());
      var nameAr = window.__cleanText(document.getElementById('ncqNameAr').value.trim());
      var id = document.getElementById('ncqId').value.trim();
      var credits = parseFloat(document.getElementById('ncqCredits').value);
      var category = document.getElementById('ncqCategory').value;
      var courseNumber = window.__cleanText(document.getElementById('ncqNumber').value.trim());
      var msg = document.getElementById('ncqMsg');

      if(!nameEn || !nameAr || !id || isNaN(credits)){
        msg.innerHTML = '<p class="dev-error-msg">' + (rtl ? 'يرجى إدخال الاسم (باللغتين) والمعرّف والساعات المعتمدة.' : 'Please fill in the name (both languages), an ID, and credit hours.') + '</p>';
        return;
      }
      if(!/^[a-z0-9-]+$/.test(id)){
        msg.innerHTML = '<p class="dev-error-msg">' + (rtl ? 'معرّف المساق يمكن أن يحتوي فقط على أحرف إنجليزية صغيرة وأرقام وشرطات.' : 'Course ID can only use lowercase letters, numbers, and hyphens.') + '</p>';
        return;
      }
      var plansNow = loadImportedPlans();
      var p = plansNow[planId];
      if((p.courses || []).some(function(c){ return c.id === id; })){
        msg.innerHTML = '<p class="dev-error-msg">' + (rtl ? 'يوجد مساق بهذا المعرّف بالفعل في هذه الخطة.' : 'A course with that ID already exists in this plan.') + '</p>';
        return;
      }

      var prereqIds = Array.prototype.slice.call(document.querySelectorAll('.ncq-prereq-check:checked')).map(function(cb){ return cb.value; });
      var candidate = findDuplicateCandidate(nameEn, courseNumber, id);
      if(candidate && candidate.name){
        var question = (rtl ? ('يبدو أن هذا قد يكون "' + candidate.name + '"' + (candidate.num && candidate.num !== '-' ? ' (' + candidate.num + ')' : '') + '. هل تريد استخدام تلك التفاصيل بالضبط ليرتبط بشكل صحيح مع نفس المساق في أماكن أخرى؟') : ('This looks like it might already be "' + candidate.name + '"' + (candidate.num && candidate.num !== '-' ? ' (' + candidate.num + ')' : '') + '. Use those exact details instead, so it links up correctly with the same course elsewhere?'));
        if(window.__showConfirmDialog){
          window.__showConfirmDialog(question, function(){
            finalizeCourseCreation(planId, yearId, semester, candidate.name, candidate.ar || nameAr, candidate.slug, parseFloat(candidate.cr) || credits, category, prereqIds, overlay);
          }, false, function(){
            finalizeCourseCreation(planId, yearId, semester, nameEn, nameAr, id, credits, category, prereqIds, overlay);
          });
          return;
        }
      }
      finalizeCourseCreation(planId, yearId, semester, nameEn, nameAr, id, credits, category, prereqIds, overlay);
    });
  }

  function finalizeCourseCreation(planId, yearId, semester, nameEn, nameAr, id, credits, category, prereqIds, overlay){
    var plansNow = loadImportedPlans();
    var p = plansNow[planId];
    if((p.courses || []).some(function(c){ return c.id === id; })){
      if(window.__showToast){ window.__showToast('🚫 A course with that ID already exists in this plan.'); }
      return;
    }
    p.courses.push({ id: id, name: nameEn, ar: nameAr, creditHours: credits, category: category, yearId: yearId, semester: semester });
    p.wasEdited = true;
    p.prerequisites = p.prerequisites || [];
    // Only draw a direct arrow from whichever selected prereqs are NOT
    // themselves already implied by another selected prereq (see the
    // transitive-reduction helpers above) — e.g. picking both Calculus I
    // and Calculus II only draws one arrow, from Calculus II.
    var existingNeeds = computeNeedsFromPairs(p.prerequisites);
    var directPrereqIds = reduceToDirectPrereqs(prereqIds, existingNeeds);
    directPrereqIds.forEach(function(reqId){ p.prerequisites.push([reqId, id]); });
    saveImportedPlans(plansNow);
    runAutoLink(planId, id);
    if(overlay){ overlay.classList.remove('open'); }
    if(window.__showToast){ window.__showToast('✅ Added "' + nameEn + '"'); }
    render(planId);
  }

  function openCourseEditPopup(planId, slug){
    var overlay = document.getElementById('devModalOverlay');
    var body = document.getElementById('devModalBody');
    if(!overlay || !body) return;
    var plans = loadImportedPlans();
    var plan = plans[planId];
    if(!plan) return;
    var course = (plan.courses || []).filter(function(c){ return c.id === slug; })[0];
    if(!course) return;

    var currentNeeds = (plan.prerequisites || []).filter(function(pair){ return pair[1] === slug; }).map(function(pair){ return pair[0]; });
    var courseOptions = (plan.courses || []).filter(function(c){ return c.id !== slug; }).map(function(c){
      var checked = currentNeeds.indexOf(c.id) !== -1 ? ' checked' : '';
      return '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-bottom:5px;">' +
        '<input type="checkbox" value="' + c.id + '" class="ecq-prereq-check"' + checked + '> ' + window.__escapeHtml((!!rtlState[planId] && c.ar) ? c.ar : c.name) + '</label>';
    }).join('') || '<p class="ex-note">' + (!!rtlState[planId] ? 'لا توجد مساقات أخرى لاشتراطها.' : 'No other courses to require.') + '</p>';

    var rtl = !!rtlState[planId];
    var categories = ['core','math','dept','eng','uni','free','skills'];
    var categoryLabels = rtl
      ? { core:'إجباري', math:'رياضيات', dept:'اختياري تخصصي', eng:'إنجليزي', uni:'اختياري جامعي', free:'اختياري حر', skills:'متطلب جامعي' }
      : { core:'Core', math:'Math', dept:'Department Elective', eng:'English', uni:'University Elective', free:'Free Elective', skills:'University Requirement' };

    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    body.innerHTML =
      '<h2 class="mh" style="margin-top:0;">' + window.AAUP_ICONS.preview('pen', 20) + (rtl ? 'تعديل المساق' : 'Edit Course') + '</h2>' +
      '<div class="form-field-row">' +
        '<div class="form-field"><label for="ecqNameEn">' + (rtl ? 'الاسم (بالإنجليزية)' : 'Name (English)') + '</label><input type="text" id="ecqNameEn" maxlength="80" value="' + course.name.replace(/"/g, '&quot;') + '"></div>' +
        '<div class="form-field"><label for="ecqNameAr">' + (rtl ? 'الاسم (بالعربية)' : 'Name (Arabic)') + '</label><input type="text" id="ecqNameAr" maxlength="80" value="' + (course.ar || '').replace(/"/g, '&quot;') + '"></div>' +
      '</div>' +
      '<div class="form-field-row">' +
        '<div class="form-field"><label for="ecqId">' + (rtl ? 'معرّف المساق' : 'Course ID') + '</label><input type="text" id="ecqId" maxlength="40" value="' + course.id + '"></div>' +
        '<div class="form-field"><label for="ecqCredits">' + (rtl ? 'الساعات المعتمدة' : 'Credit Hours') + '</label><input type="number" id="ecqCredits" min="0" step="0.5" value="' + course.creditHours + '"></div>' +
      '</div>' +
      '<div class="form-field"><label for="ecqCategory">' + (rtl ? 'الفئة' : 'Category') + '</label><select id="ecqCategory">' +
        categories.map(function(c){ return '<option value="' + c + '"' + (c === course.category ? ' selected' : '') + '>' + categoryLabels[c] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-field"><label>' + (rtl ? 'المتطلبات السابقة' : 'Prerequisites') + '</label>' +
      '<div style="max-height:140px;overflow-y:auto;background:var(--search-bg);border:1px solid var(--line);border-radius:8px;padding:8px;">' + courseOptions + '</div></div>' +
      '<p class="form-note">' + (rtl ? 'تغيير الاسم أو المعرّف أو الساعات أو الفئة قد يعني أن هذا المساق لن يرتبط تلقائيًا بالمساقات المطابقة في الخطط الأخرى كما كان \u2014 سيُعاد فحصه وفق التفاصيل الجديدة.' : 'Changing the name, ID, credit hours, or category means this may no longer automatically link to matching courses in other plans the way it used to \u2014 it\u2019ll be re-checked against whatever the new details actually match.') + '</p>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="ecqCancel">' + (rtl ? 'إلغاء' : 'Cancel') + '</button>' +
      '<button type="button" class="home-btn" id="ecqSave" style="border-color:var(--accent);color:var(--text);">' + (rtl ? 'حفظ التغييرات' : 'Save Changes') + '</button></div>' +
      '<div id="ecqMsg"></div>';
    overlay.classList.add('open');

    document.getElementById('ecqCancel').addEventListener('click', function(){ overlay.classList.remove('open'); });
    document.getElementById('ecqSave').addEventListener('click', function(){
      // Same reason as the Add Course form: these strings feed innerHTML.
      var nameEn = window.__cleanText(document.getElementById('ecqNameEn').value.trim());
      var nameAr = window.__cleanText(document.getElementById('ecqNameAr').value.trim());
      var newId = document.getElementById('ecqId').value.trim();
      var credits = parseFloat(document.getElementById('ecqCredits').value);
      var category = document.getElementById('ecqCategory').value;
      var msg = document.getElementById('ecqMsg');

      if(!nameEn || !nameAr || !newId || isNaN(credits)){
        msg.innerHTML = '<p class="dev-error-msg">' + (rtl ? 'يرجى إدخال الاسم (باللغتين) والمعرّف والساعات المعتمدة.' : 'Please fill in the name (both languages), an ID, and credit hours.') + '</p>';
        return;
      }
      if(!/^[a-z0-9-]+$/.test(newId)){
        msg.innerHTML = '<p class="dev-error-msg">' + (rtl ? 'معرّف المساق يمكن أن يحتوي فقط على أحرف إنجليزية صغيرة وأرقام وشرطات.' : 'Course ID can only use lowercase letters, numbers, and hyphens.') + '</p>';
        return;
      }
      var plansNow = loadImportedPlans();
      var p = plansNow[planId];
      var target = (p.courses || []).filter(function(c){ return c.id === slug; })[0];
      if(!target) return;
      if(newId !== slug && (p.courses || []).some(function(c){ return c.id === newId; })){
        msg.innerHTML = '<p class="dev-error-msg">' + (rtl ? 'مساق آخر يستخدم هذا المعرّف بالفعل.' : 'Another course already uses that ID.') + '</p>';
        return;
      }

      var idChanged = newId !== slug;
      target.name = nameEn; target.ar = nameAr; target.creditHours = credits; target.category = category;

      // Renaming the id means every reference to the OLD id has to move
      // to the new one, or prerequisite pairs and progress would point at
      // something that no longer exists.
      if(idChanged){
        target.id = newId;
        p.prerequisites = (p.prerequisites || []).map(function(pair){
          return [pair[0] === slug ? newId : pair[0], pair[1] === slug ? newId : pair[1]];
        });
        p.autoLinkedPairs = (p.autoLinkedPairs || []).map(function(key){
          var parts = key.split('__');
          return (parts[0] === slug ? newId : parts[0]) + '__' + (parts[1] === slug ? newId : parts[1]);
        });
        var progress = window.__getProgress ? window.__getProgress() : {};
        if(progress[planId + '-c-' + slug] !== undefined){
          progress[planId + '-c-' + newId] = progress[planId + '-c-' + slug];
          delete progress[planId + '-c-' + slug];
          persistProgress();
        }
      }

      // Fully re-derive this course's DIRECT prerequisites from the
      // current checkbox state, rather than trying to patch the old set —
      // simpler, and correctly drops anything that's no longer checked.
      p.prerequisites = (p.prerequisites || []).filter(function(pair){ return pair[1] !== newId; });
      var checkedIds = Array.prototype.slice.call(document.querySelectorAll('.ecq-prereq-check:checked')).map(function(cb){ return cb.value; });
      var needsNow = computeNeedsFromPairs(p.prerequisites);
      var directIds = reduceToDirectPrereqs(checkedIds, needsNow);
      directIds.forEach(function(reqId){ p.prerequisites.push([reqId, newId]); });

      saveImportedPlans(plansNow);
      runAutoLink(planId, newId);
      overlay.classList.remove('open');
      if(window.__showToast){ window.__showToast('✅ Saved changes to "' + nameEn + '"'); }
      render(planId);
    });
  }

  // ---------- rendering ----------
  var SEMESTER_LABEL = { s1: 'First Semester', s2: 'Second Semester', s3: 'Summer' };

  var SEMESTER_LABEL_AR = { s1: 'الفصل الأول', s2: 'الفصل الثاني', s3: 'الصيفي' };

  // ---------- prerequisite connector lines (generic version of each
  // built-in major's hand-written draw()/bindHover() — those stay hardcoded
  // per major on purpose (see the Plan Editor's banner comment on why),
  // but an imported plan's course set changes at runtime and there can be
  // arbitrarily many of them, so this one has to be a real parameterized
  // function rather than a copy-pasted block per plan. ----------
  var NS = 'http://www.w3.org/2000/svg';
  // Takes already-measured rects (see drawConnectors), so all the reads can
  // be batched before any DOM write instead of thrashing layout per pair.
  function pathBetweenGeneric(f, t, cRect){
    var x1 = f.left - cRect.left + f.width / 2;
    var y1 = f.top - cRect.top + f.height;
    var x2 = t.left - cRect.left + t.width / 2;
    var y2 = t.top - cRect.top;
    var dy = Math.max(28, (y2 - y1) / 2);
    return 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) +
      ' C' + x1.toFixed(1) + ',' + (y1 + dy).toFixed(1) +
      ' ' + x2.toFixed(1) + ',' + (y2 - dy).toFixed(1) +
      ' ' + x2.toFixed(1) + ',' + y2.toFixed(1);
  }
  function initSearch(planId){
    var input = document.getElementById(planId + '-courseSearchInput');
    if(!input || !window.__buildCourseIndex || !window.__attachSearch) return;
    window.__buildCourseIndex(planId); // rebuilt fresh every render, so a just-added course is searchable immediately
    window.__attachSearch({
      input: input,
      box: document.getElementById(planId + '-courseSearchBox'),
      clear: document.getElementById(planId + '-courseSearchClear'),
      dropdown: document.getElementById(planId + '-courseSearchDropdown'),
      getIndex: function(){ return (window.__PLAN_DATA[planId] && window.__PLAN_DATA[planId].index) || []; },
      emptyText: 'No matching course found / لا يوجد مساق مطابق',
      onSelect: function(r){
        input.value = '';
        document.getElementById(planId + '-courseSearchBox').classList.remove('has-value');
        // Same reasoning as the built-in-major search wiring in 03-search.js:
        // a search result now opens the interactive prerequisite map instead
        // of the old scroll-to-and-highlight popup. This is the renderer
        // every real plan (built-in majors included) actually goes through,
        // so this handler — not the one in 03-search.js's initCourseSearch —
        // is the one that fires for a real search in the app.
        if(window.AAUP_PREREQ_GRAPH){ window.AAUP_PREREQ_GRAPH.open(planId, r.slug); }
        else if(window.__selectCourse){ window.__selectCourse(planId, r.slug); }
      }
    });
  }

  function drawConnectors(planId){
    var svg = document.getElementById(planId + '-connectorSvg');
    var container = svg && svg.parentNode; // the .years wrapper
    var data = window.__PLAN_DATA[planId];
    if(!svg || !container || !data) return;
    // Batch reads, then writes — same layout-thrash fix the built-in majors
    // use. Feed plans can be the biggest (Pharmacy is 86 cards), so this is
    // where it matters most.
    var cRect = container.getBoundingClientRect();
    // The whole plan can be off screen — the student navigated Home while a
    // window resize was still pending, say. Every card would then measure as
    // zero-sized and we would wipe a perfectly good set of lines that nothing
    // redraws on the way back. Nothing to measure means nothing to do.
    if(cRect.width <= 0 || cRect.height <= 0) return;
    var w = container.scrollWidth, h = container.scrollHeight;
    var prereqs = data.prereqs || [];
    var rects = {};
    // A course can be in the DOM but have no box on screen: it was removed
    // from the plan (.course-removed), or it sits inside a year that is
    // folded away by "Collapse finished years". Either way its bounding rect
    // collapses to 0,0,0,0 rather than becoming null, and treating that as a
    // real position drew a stray line from the top-left corner of the page to
    // whatever it was still connected to. Measure once, then treat a
    // zero-sized box exactly like a missing element: the edge is dropped and
    // every edge between two courses that ARE on screen still draws.
    function boxOf(id){
      var el = document.getElementById(id);
      if(!el) return null;
      var r = el.getBoundingClientRect();
      return (r.width > 0 && r.height > 0) ? r : null;
    }
    prereqs.forEach(function(pair){
      var a = planId + '-c-' + pair[0], b = planId + '-c-' + pair[1];
      if(!(a in rects)){ rects[a] = boxOf(a); }
      if(!(b in rects)){ rects[b] = boxOf(b); }
    });

    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';
    var old = svg.querySelectorAll('path.edge');
    for(var i = 0; i < old.length; i++){ old[i].parentNode.removeChild(old[i]); }

    var frag = document.createDocumentFragment();
    prereqs.forEach(function(pair){
      var fa = rects[planId + '-c-' + pair[0]], tb = rects[planId + '-c-' + pair[1]];
      if(!fa || !tb) return; // one end may be in a collapsed/removed part of the plan
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', pathBetweenGeneric(fa, tb, cRect));
      p.setAttribute('class', 'edge');
      p.setAttribute('data-from', planId + '-c-' + pair[0]);
      p.setAttribute('data-to', planId + '-c-' + pair[1]);
      p.setAttribute('marker-end', 'url(#' + planId + '-prereqArrow)');
      frag.appendChild(p);
    });
    svg.appendChild(frag);

    bindImportedHover(planId);
  }

  var hoverBoundPlans = {};
  var hoverSequenceTimers = [];
  function clearHoverSequence(){
    hoverSequenceTimers.forEach(function(t){ clearTimeout(t); });
    hoverSequenceTimers = [];
  }
  function importedSemesterOrder(courseId){
    var el = document.getElementById(courseId);
    var row = el && el.closest('.course-row[id]');
    var order = (row && window.AAUP_PLAN_EDITOR) ? window.AAUP_PLAN_EDITOR.orderOfContainerId(row.id) : null;
    return (order === null || order === undefined) ? Infinity : order;
  }
  function handleCourseHoverEnter(planId, courseEl){
    clearHoverSequence();
    var id = courseEl.id;
    var svg = document.getElementById(planId + '-connectorSvg');
    if(!svg) return;
    var paths = Array.prototype.slice.call(svg.querySelectorAll('path.edge'));
    var incoming = [], outgoing = [];
    paths.forEach(function(p){
      if(p.getAttribute('data-to') === id){ incoming.push(p); }
      else if(p.getAttribute('data-from') === id){ outgoing.push(p); }
    });
    if(incoming.length === 0 && outgoing.length === 0) return;

    var hoveredOrder = importedSemesterOrder(id);
    function distance(p, isIncoming){
      var otherId = p.getAttribute(isIncoming ? 'data-from' : 'data-to');
      var otherOrder = importedSemesterOrder(otherId);
      if(otherOrder === Infinity || hoveredOrder === Infinity) return Infinity;
      return Math.abs(hoveredOrder - otherOrder);
    }
    incoming.sort(function(a, b){ return distance(a, true) - distance(b, true); });
    outgoing.sort(function(a, b){ return distance(a, false) - distance(b, false); });
    var sequence = incoming.concat(outgoing);

    sequence.forEach(function(p){
      var len; try{ len = p.getTotalLength(); }catch(e){ len = 2000; }
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
    void svg.getBoundingClientRect();
    requestAnimationFrame(function(){
      paths.forEach(function(p){
        if(sequence.indexOf(p) !== -1){ p.classList.add('active'); }
        else { p.classList.add('dim'); }
      });
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var STEP_MS = reducedMotion ? 0 : 650;
      sequence.forEach(function(p, i){
        var t = setTimeout(function(){
          p.style.strokeDashoffset = 0;
          ['data-from', 'data-to'].forEach(function(attr){
            var otherEl = document.getElementById(p.getAttribute(attr));
            if(otherEl){ otherEl.classList.add('node-active'); }
          });
        }, i * STEP_MS);
        hoverSequenceTimers.push(t);
      });
    });
  }
  function handleCourseHoverLeave(planId){
    clearHoverSequence();
    var svg = document.getElementById(planId + '-connectorSvg');
    if(!svg) return;
    svg.querySelectorAll('path.edge').forEach(function(p){
      p.classList.remove('active');
      p.classList.remove('dim');
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
    });
    document.querySelectorAll('#page-' + planId + ' .course[id]').forEach(function(c){ c.classList.remove('node-active'); });
  }
  var touchHoldTimer = null;
  var touchHoldEl = null;
  var touchHoldStartX = 0, touchHoldStartY = 0;
  function bindImportedHover(planId){
    if(hoverBoundPlans[planId]) return;
    hoverBoundPlans[planId] = true;
    // mouseenter/mouseleave don't bubble, so delegation (needed since
    // course cards are recreated on every render) uses mouseover/mouseout
    // with a relatedTarget check instead, to avoid re-triggering every
    // time the pointer crosses a child element within the same card.
    document.addEventListener('mouseover', function(e){
      var el = e.target.closest && e.target.closest('.course[id]');
      if(!el || el.id.indexOf(planId + '-c-') !== 0) return;
      if(el.contains(e.relatedTarget)) return;
      handleCourseHoverEnter(planId, el);
    });
    document.addEventListener('mouseout', function(e){
      var el = e.target.closest && e.target.closest('.course[id]');
      if(!el || el.id.indexOf(planId + '-c-') !== 0) return;
      if(el.contains(e.relatedTarget)) return;
      handleCourseHoverLeave(planId);
    });
    // Touch devices have no hover — press and hold a course instead. A
    // quick tap still falls through to the normal onclick (toggle/edit);
    // only a sustained, still press starts the trace.
    document.addEventListener('touchstart', function(e){
      var el = e.target.closest && e.target.closest('.course[id]');
      if(!el || el.id.indexOf(planId + '-c-') !== 0) return;
      touchHoldEl = el;
      var t = e.touches && e.touches[0];
      touchHoldStartX = t ? t.clientX : 0;
      touchHoldStartY = t ? t.clientY : 0;
      touchHoldTimer = setTimeout(function(){ handleCourseHoverEnter(planId, el); }, 450);
    }, { passive: true });
    document.addEventListener('touchmove', function(e){
      // Same tolerance as the built-in majors' hold-to-trace: a real finger
      // held "still" always drifts a few pixels, so only an actual
      // scroll/drag past a small radius should cancel the hold — cancelling
      // on any movement at all meant the hold almost never survived to the
      // 450ms mark in real use.
      var t = e.touches && e.touches[0];
      if(!t){ clearTimeout(touchHoldTimer); return; }
      var dx = t.clientX - touchHoldStartX, dy = t.clientY - touchHoldStartY;
      if((dx * dx + dy * dy) > 100){ clearTimeout(touchHoldTimer); }
    });
    document.addEventListener('touchend', function(){
      clearTimeout(touchHoldTimer);
      if(touchHoldEl){ handleCourseHoverLeave(planId); touchHoldEl = null; }
    });
    document.addEventListener('touchcancel', function(){
      clearTimeout(touchHoldTimer);
      if(touchHoldEl){ handleCourseHoverLeave(planId); touchHoldEl = null; }
    });
  }

  // A lecture and its lab are ONE registered course at AAUP: one catalogue
  // number, one credit value, deliberately drawn as two cards. Both cards
  // printed the full figure, so Programming Fundamentals read as 4H and then
  // another 4H — eight hours for a four-hour course, which is exactly what
  // students reported. The totals were already right (they de-duplicate on
  // the catalogue number); only the cards lied.
  //
  // The FIRST card of such a pair keeps the figure. The rest say the hours are
  // part of it, so no card claims hours a second time.
  function pairContinuations(planId){
    var plan = loadImportedPlans()[planId];
    var firstFor = Object.create(null), out = Object.create(null);
    ((plan && plan.courses) || []).forEach(function(c){
      var num = c.courseNumber ? String(c.courseNumber).trim() : '';
      if(!num || num === '-') return;
      if(firstFor[num] === undefined){ firstFor[num] = c.id; return; }
      out[c.id] = true;
    });
    return out;
  }

  function courseCardHtml(planId, c, rtl, yearNum, continuations){
    var done = isDone(planId, c.id);
    var avail = isAvailable(planId, c.id);
    var editing = document.getElementById('page-' + planId) && document.getElementById('page-' + planId).classList.contains('editing');
    var cls = 'course ' + (c.category || 'core') + (done ? ' completed' : '') + (avail || done ? ' available' : '') + (c.isRetake ? ' retake-course' : '');
    var displayName = (rtl && c.ar) ? c.ar : c.name;
    // The old quick "📊 set grade" shortcut for a done course is retired —
    // it shared the same top-right corner as the new checkbox and would
    // visually collide with it. Grade is now set from the full course-
    // details popup (opened by tapping the card), same as every built-in
    // major already works — openGradePrompt() itself is untouched in case
    // anything else still calls it directly.
    var cardButtons = editing
      ? '<div class="imp-card-btn-row">' +
        '<button type="button" class="imp-edit-course-btn" title="Edit course" onclick="event.stopPropagation(); AAUP_IMPORTED.editCoursePrompt(\'' + planId + '\',\'' + c.id + '\');">' + window.AAUP_ICONS.preview('pen', 13) + '</button>' +
        '<button type="button" class="imp-remove-course-btn" title="Remove course" onclick="event.stopPropagation(); AAUP_IMPORTED.confirmRemoveCourse(\'' + planId + '\',\'' + c.id + '\');">✕</button>' +
        '</div>'
      : '';
    var checkboxHtml = editing ? '' :
      '<span class="course-check" role="checkbox" tabindex="0" aria-checked="' + (done ? 'true' : 'false') + '" ' +
      'aria-label="Mark course as completed" onclick="event.stopPropagation(); AAUP_IMPORTED.toggle(\'' + planId + '\',\'' + c.id + '\');" ' +
      'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();event.stopPropagation();AAUP_IMPORTED.toggle(\'' + planId + '\',\'' + c.id + '\');}">✓</span>';
    // The line under the name answers the three things a student checks on
    // every card: which year the plan puts it in, whether they can register
    // for it today, and how many hours it carries. The official course code
    // sits under them because that — not the name — is what gets typed into
    // the registration system.
    var statusTx = done ? (rtl ? 'مُنجز' : 'passed')
      : avail ? (rtl ? 'متاح لك' : 'open to you')
      : (rtl ? 'مغلق لك' : 'closed to you');
    var yearTx = yearNum ? (rtl ? 'سنة ' + yearNum : 'Year ' + yearNum)
      : (rtl ? 'اختياري' : 'Elective');
    var partOfPair = !!(continuations && continuations[c.id]);
    var hoursTx = partOfPair
      ? (rtl ? 'ضمن ' + c.creditHours + ' ساعات' : 'part of ' + c.creditHours + 'H')
      : c.creditHours + 'H';
    var meta = window.__escapeHtml(yearTx + ' · ' + statusTx + ' · ' + hoursTx);
    // Focusable so the plan can be worked from a keyboard: the card itself is
    // a button (Enter opens the details) and the tick inside it is its own
    // control (Space toggles completion) — see js/57-card-input.js.
    var a11y = editing ? '' :
      ' tabindex="0" role="button" aria-label="' +
      window.__escapeHtml(displayName + ' — ' + yearTx + ', ' + statusTx + ', ' + hoursTx) + '"';
    return '<div class="' + cls + '" id="' + fullId(planId, c.id) + '"' + a11y + (editing ? '' : ' onclick="AAUP_IMPORTED.openCourseModal(\'' + planId + '\',\'' + c.id + '\')"') + '>' +
      checkboxHtml +
      cardButtons +
      (c.isRetake ? '<span class="retake-badge">\u21bb ' + (rtl ? 'إعادة' : 'Retake') + '</span>' : '') +
      '<div class="name">' + displayName + '</div>' +
      '<div class="course-meta">' + meta + '</div>' +
      '<div class="course-code">' + window.__escapeHtml(String(c.id)) + '</div>' +
      '</div>';
  }

  function openGradePrompt(planId, slug){
    var overlay = document.getElementById('devModalOverlay');
    var body = document.getElementById('devModalBody');
    if(!overlay || !body) return;
    var plan = loadImportedPlans()[planId];
    var course = plan && (plan.courses || []).filter(function(c){ return c.id === slug; })[0];
    if(!course) return;
    var pid = fullId(planId, slug);
    var grades = window.AAUP_GPA.loadGrades();
    var current = grades[pid] || '';
    var opts = '<option value="">\u2014</option>' + window.AAUP_GPA.GRADE_ORDER.map(function(g){
      return '<option value="' + g + '"' + (g === current ? ' selected' : '') + '>' + window.AAUP_GPA.gradeLabel(g) + '</option>';
    }).join('');
    var rtl = !!rtlState[planId];
    var dispName = rtl && course.ar ? course.ar : course.name;
    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    body.innerHTML =
      '<h2 class="mh" style="margin-top:0;">' + window.AAUP_ICONS.preview('chart', 20) + (rtl ? 'العلامة \u2014 ' : 'Grade \u2014 ') + window.__escapeHtml(dispName) + '</h2>' +
      '<div class="form-field"><label for="impGradeSelect">' + (rtl ? 'العلامة' : 'Grade') + '</label><select id="impGradeSelect">' + opts + '</select>' +
      '<div class="numeric-grade-row">' +
        '<input type="number" min="0" max="100" step="0.1" class="numeric-grade-input" id="impNumericGradeInput" placeholder="' +
        (rtl ? 'أو أدخل العلامة الرقمية (اختياري)' : 'or enter numeric score (optional)') + '">' +
        '<span class="numeric-grade-result" id="impNumericGradeResult"></span>' +
      '</div></div>' +
      '<p class="form-note">' + (rtl ? 'اختيار F يجدول إعادة المساق تلقائيًا في الفصل التالي.' : 'Setting F automatically schedules a retake in the next semester.') + '</p>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="impGradeClose">' + (rtl ? 'إغلاق' : 'Close') + '</button></div>';
    overlay.classList.add('open');
    document.getElementById('impGradeClose').addEventListener('click', function(){ overlay.classList.remove('open'); });
    document.getElementById('impGradeSelect').addEventListener('change', function(e){
      if(window.__applyGradeChange){ window.__applyGradeChange(planId, pid, e.target.value); }
      render(planId);
    });
    var impNumericInput = document.getElementById('impNumericGradeInput');
    var impNumericResult = document.getElementById('impNumericGradeResult');
    var impGradeSelect = document.getElementById('impGradeSelect');
    if(impNumericInput){
      impNumericInput.addEventListener('input', function(){
        var raw = impNumericInput.value;
        var letter = raw === '' ? null : window.AAUP_GPA.letterForScore(raw, planId, pid);
        if(!letter){ impNumericResult.textContent = ''; impNumericResult.classList.remove('ngr-active'); return; }
        impNumericResult.textContent = '→ ' + letter;
        impNumericResult.classList.add('ngr-active');
        impGradeSelect.value = letter;
        if(window.__applyGradeChange){ window.__applyGradeChange(planId, pid, letter); }
        render(planId);
      });
    }
  }

  var IMP_MODAL_LABELS = {
    en: { num: 'Course Number', name: 'Course Name', cr: 'Cr. Hrs.', prereq: 'Prerequisite', th: 'Theoretical', pr: 'Practical' },
    ar: { num: 'رقم المساق', name: 'اسم المساق', cr: 'الساعات المعتمدة', prereq: 'المتطلب السابق', th: 'نظري', pr: 'عملي' }
  };

  // The same course-details popup the 4 built-in majors have (grade,
  // planning status, difficulty, workload, notes, and the University
  // Elective picker) — reused here via window.__renderCourseModalExtras /
  // __bindCourseModalExtras rather than re-implemented, so any future change
  // to that popup (like the elective picker) applies to every plan type at
  // once instead of needing to be built twice.
  function openCourseModal(planId, slug){
    var plan = loadImportedPlans()[planId];
    var course = plan && (plan.courses || []).filter(function(c){ return c.id === slug; })[0];
    if(!course) return;
    var rtl = !!rtlState[planId];
    var L = IMP_MODAL_LABELS[rtl ? 'ar' : 'en'];
    var displayName = (rtl && course.ar) ? course.ar : course.name;
    var info = ((window.__PLAN_DATA[planId] || {}).courseInfo || {})[slug] || {
      num: course.num || course.courseNumber || '-', th: '-', pr: '-', prereq: '-'
    };
    var overlay = document.getElementById('impCourseModalOverlay');
    var body = document.getElementById('impCourseModalBody');
    if(!overlay || !body) return;
    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');

    // The six label/value rows this used to print are still here — they moved
    // into the Details column of the detail panel. What is in front of them now
    // is whether the course is available and why, which is the thing a course
    // is opened to find out. Falls back to the old rows if the module is
    // missing, so the modal degrades rather than blanking.
    // The shared modal card is sized for a short list of rows. The detail
    // panel needs room for two columns on a wide screen, so it says so — via a
    // class rather than :has(), which is not safe to rely on across the phones
    // this has to work on.
    var cardEl = overlay.querySelector('.modal-card');
    if(cardEl) cardEl.classList.toggle('cd-card', !!window.AAUP_COURSE_DETAIL);

    if(window.AAUP_COURSE_DETAIL){
      body.innerHTML = window.AAUP_COURSE_DETAIL.build(planId, slug, course, rtl);
    } else {
      body.innerHTML =
        '<h3>' + window.__escapeHtml(displayName) + '</h3>' +
        '<div class="modal-row"><span class="k">' + L.num + '</span><span class="v">' + window.__escapeHtml(String(info.num || '-')) + '</span></div>' +
        '<div class="modal-row"><span class="k">' + L.name + '</span><span class="v">' + window.__escapeHtml(displayName) + '</span></div>' +
        '<div class="modal-row"><span class="k">' + L.cr + '</span><span class="v">' + window.__escapeHtml(String(course.creditHours != null ? course.creditHours : 0)) + '</span></div>' +
        '<div class="modal-row"><span class="k">' + L.prereq + '</span><span class="v">' + window.__escapeHtml(String(info.prereq || '-')) + '</span></div>' +
        '<div class="modal-row"><span class="k">' + L.th + '</span><span class="v">' + window.__escapeHtml(String(info.th || '-')) + '</span></div>' +
        '<div class="modal-row"><span class="k">' + L.pr + '</span><span class="v">' + window.__escapeHtml(String(info.pr || '-')) + '</span></div>';
    }

    // The grade and planning controls are untouched and still owned by
    // js/21-course-modal-extras.js. They are placed inside the panel rather
    // than appended after it, so the layout keeps them beside the reasoning
    // instead of below a two-column block.
    if(window.__renderCourseModalExtras){
      var slot = body.querySelector('.cd-extras');
      var extrasHTML = window.__renderCourseModalExtras(planId, slug);
      if(slot) slot.innerHTML = extrasHTML; else body.innerHTML += extrasHTML;
    }
    overlay.classList.add('open');
    if(window.__bindCourseModalExtras){
      var extrasEl = body.querySelector('.modal-extras');
      window.__bindCourseModalExtras(planId, slug, extrasEl);
    }
    if(window.AAUP_COURSE_DETAIL && window.AAUP_COURSE_DETAIL.bind){
      window.AAUP_COURSE_DETAIL.bind(planId, slug, body);
    }

    // A prerequisite chip is a course too. Following one is the whole point of
    // drawing the chain, and it beats closing the panel and hunting the grid.
    body.querySelectorAll('[data-goto]').forEach(function(b){
      b.addEventListener('click', function(){
        var next = b.getAttribute('data-goto');
        if(next) openCourseModal(planId, next);
      });
    });
  }

  function closeCourseModal(){
    var overlay = document.getElementById('impCourseModalOverlay');
    if(overlay){ overlay.classList.remove('open'); }
  }

  // One-time wiring for the single shared overlay — backdrop click, Escape,
  // and stopping a click on the card itself from bubbling to the backdrop.
  function bindCourseModal(){
    var overlay = document.getElementById('impCourseModalOverlay');
    if(!overlay || overlay.getAttribute('data-bound')) return;
    overlay.setAttribute('data-bound', '1');
    var card = overlay.querySelector('.modal-card');
    var closeBtn = document.getElementById('impCourseModalClose');
    if(closeBtn){ closeBtn.addEventListener('click', closeCourseModal); }
    overlay.addEventListener('click', function(e){ if(e.target === overlay){ closeCourseModal(); } });
    if(card){ card.addEventListener('click', function(e){ e.stopPropagation(); }); }
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && overlay.classList.contains('open')){ closeCourseModal(); }
    });
  }

  // A Specialization Elective is a CHOICE out of a pool, not a course the
  // plan tells you to take in a given term — the university's own app lists
  // "Spec. Elec." as (Optional) next to the mandatory categories. Showing them
  // inline made a semester look heavier than it is and implied a fixed slot
  // that does not exist, so they are lifted out of the year grid and gathered
  // into one pool block under the years (see electivePoolHtml below).
  function isPoolElective(c){ return c && c.category === 'dept'; }

  function semesterHtml(planId, plan, yearId, semester, editing, rtl, yearNum){
    var pairs = pairContinuations(planId);
    var containerId = planId + '-y' + yearId.replace('y','') + '-s' + semester.replace('s','');
    var courses = (plan.courses || []).filter(function(c){ return c.yearId === yearId && c.semester === semester && !isPoolElective(c); });
    var addCard = editing ? '<div class="imp-add-course-card" onclick="AAUP_IMPORTED.addCoursePrompt(\'' + planId + '\',\'' + yearId + '\',\'' + semester + '\')">+</div>' : '';
    return '<div class="imp-semester-block"><div class="imp-semester-title">' + (rtl ? SEMESTER_LABEL_AR[semester] : SEMESTER_LABEL[semester]) + '</div>' +
      '<div class="course-row" id="' + containerId + '">' +
      courses.map(function(c){ return courseCardHtml(planId, c, rtl, yearNum, pairs); }).join('') + addCard +
      '</div></div>';
  }

  // Courses the plan lists but does not schedule — department and free
  // electives you choose and slot in yourself. They used to be forced into
  // Year 1 Semester 1, which read as "these are all first-semester courses"
  // and made that semester look impossibly heavy. They get their own block,
  // labelled, after the years.
  //
  // Same .course-row / .course markup as a real semester on purpose: ticking
  // one off, its grade, its prerequisite arrows and the degree audit all go
  // through the shared code, which finds courses by id and does not care
  // where on the page they sit.
  var UNSCHEDULED_LABEL = {
    dept: { en: 'Specialization Electives', ar: 'متطلبات التخصص الاختيارية' },
    free: { en: 'Free Electives', ar: 'المتطلبات الحرة' },
    uni:  { en: 'University Electives', ar: 'المتطلبات الجامعية الاختيارية' },
    other:{ en: 'Electives — choose from these', ar: 'مواد اختيارية' }
  };

  function unscheduledHtml(planId, plan, editing, rtl){
    var pairs = pairContinuations(planId);
    // Two sources feed one pool: courses the plan never scheduled, and every
    // specialization elective regardless of the term the data happens to name.
    var loose = (plan.courses || []).filter(function(c){ return !c.yearId || isPoolElective(c); });
    if(!loose.length) return '';

    // Grouped by category so a plan with both department and free electives
    // does not present them as one undifferentiated pile.
    var order = ['dept', 'free', 'uni', 'other'];
    var groups = {};
    loose.forEach(function(c){
      var k = UNSCHEDULED_LABEL[c.category] ? c.category : 'other';
      (groups[k] = groups[k] || []).push(c);
    });

    var html = '<div class="imp-year-block imp-elective-block">' +
      '<div class="imp-year-header"><h3>' +
      (rtl ? 'مواد اختيارية' : 'Electives') +
      ' <span class="imp-optional-tag">' + (rtl ? '(اختياري)' : '(Optional)') + '</span></h3></div>' +
      '<p class="imp-elective-note">' +
      (rtl
        ? 'اختر منها بالعدد الذي تتطلبه خطتك. الخطة لا تحدد لها فصلًا — ضعها في الفصل الذي يناسبك.'
        : 'Pick as many as your plan requires. The plan does not assign these to a semester, so you choose when to take them.') +
      '</p>';

    order.forEach(function(k){
      if(!groups[k]) return;
      var label = UNSCHEDULED_LABEL[k];
      html += '<div class="imp-semester-block"><div class="imp-semester-title">' +
        (rtl ? label.ar : label.en) +
        ' <span class="imp-optional-tag">' + (rtl ? '(اختياري)' : '(Optional)') + '</span>' +
        ' <span class="imp-elective-count">' + groups[k].length + '</span></div>' +
        '<div class="course-row" id="' + planId + '-elective-' + k + '">' +
        groups[k].map(function(c){ return courseCardHtml(planId, c, rtl, null, pairs); }).join('') +
        '</div></div>';
    });
    return html + '</div>';
  }

  function render(id){
    var plans = loadImportedPlans();
    var p = plans[id];
    var host = document.getElementById('importedPlanView');
    if(!p || !host) return;

    if(!hasStructure(p)){ renderLegacy(id, p, host); return; }

    registerPlan(id, p);
    var editing = document.getElementById('page-' + id) ? document.getElementById('page-' + id).classList.contains('editing') : false;
    // Editing a custom plan doesn't need the developer-mode trick — that
    // exists to prevent ACCIDENTAL edits to the four official majors,
    // which every student shares. A custom plan only affects its own
    // creator, so anyone who made one can freely build it out.
    var canEdit = true;
    var rtl = !!rtlState[id];

    var en = nameParts(p.majorName.en), ar = nameParts(p.majorName.ar);
    var bioEn = (p.bio && p.bio.en) || '';

    var totalCr = 0, doneCr = 0;
    if(window.AAUP_AUDIT){
      window.AAUP_AUDIT.computeAudit(id).forEach(function(r){ totalCr += r.total; doneCr += r.completed; });
    }
    var pct = totalCr ? Math.round(doneCr / totalCr * 100) : 0;

    var CATS = ['skills','core','math','dept','eng','uni','free'];
    var CAT_LABELS = {
      skills: ['University Req.','متطلب جامعي'], core: ['Specialization Req.','متطلب تخصص'],
      math: ['College Req.','متطلب كلية'], dept: ['Specialization Elec.','اختياري تخصص'],
      eng: ['University Req.','متطلب جامعي'], uni: ['University Elec.','اختياري جامعي'],
      free: ['Free Elec.','اختياري حر']
    };

    // Same header structure every built-in major uses (brand block, center
    // title with the plan's own icon standing in for the hand-drawn
    // per-major artwork, Arabic block, action buttons) rather than a
    // simplified look-alike.
    // Width and margin live in CSS (.sheet-plan), not in a style attribute:
    // an inline margin beats every stylesheet rule, which is exactly how this
    // page used to slide underneath the fixed sidebar on a laptop-width screen
    // — body.has-sidebar's 230px offset could never win against it.
    var html = '<div class="sheet sheet-plan' + (editing ? ' editing' : '') + (rtl ? ' rtl-mode' : '') + '" id="page-' + id + '"' + (rtl ? ' dir="rtl"' : '') + '>' +
      '<header>' +
      '<div class="brand"><div class="mark" style="display:flex;align-items:center;justify-content:center;font-size:20px;">' + window.AAUP_ICONS.markup(p, { size: 22 }) + '</div>' +
      '<div><h1>' + (function(){ var u = (window.APP_UNIVERSITIES || {})[p.university || 'aaup'] || { name: { en: 'The Arab American University', ar: 'الجامعة العربية الأمريكية' } }; return rtl ? u.name.ar : u.name.en; })() + '</h1><p>' + (rtl ? (p.college && p.college.ar ? p.college.ar : 'كلية غير محددة') : (p.college && p.college.en ? p.college.en : 'Faculty not specified')) + '</p></div></div>' +
      '<div class="title-block"><div class="icon-row">' +
      '<div class="en">' + en.big + (en.small ? '<em>' + en.small + '</em>' : '') + '</div>' +
      '</div></div>' +
      '<div class="ar-block"><div class="ar1">' + ar.big + '</div>' + (ar.small ? '<div class="ar2">' + ar.small + '</div>' : '') + '</div>' +
      '<div class="header-actions">' +
        '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.close()"><span class="home-ic">' + window.AAUP_ICONS.preview('home', 15) + '</span><span class="home-lbl">Home</span></button>' +
        (canEdit ? (editing
          ? '<button type="button" class="home-btn imp-exit-edit-btn" onclick="AAUP_IMPORTED.toggleEdit(\'' + id + '\')" style="border-color:var(--prereq);color:#ff9ecb;">✖ Exit Edit Mode</button>'
          : '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.toggleEdit(\'' + id + '\')">' + window.AAUP_ICONS.preview('pen', 14) + 'Edit Mode</button>') : '') +
        (canEdit ? '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.openLibrary(\'' + id + '\')" title="Browse courses from every plan">' + window.AAUP_ICONS.preview('book', 14) + 'Course Library</button>' : '') +
        (canEdit ? '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.exportPlan(\'' + id + '\')" title="Download this plan to share with someone else">' + window.AAUP_ICONS.preview('download', 14) + 'Export Plan</button>' : '') +
        (canEdit ? '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.submitPlan(\'' + id + '\')" title="Send this plan to the app maintainer so it can be added for everyone">' + window.AAUP_ICONS.preview('mail', 14) + 'Contribute</button>' : '') +
        (p.contributing && window.AAUP_CONTRIBUTE
          ? '<button type="button" class="home-btn" onclick="AAUP_CONTRIBUTE.submit(\'' + id + '\')" style="border-color:var(--accent);color:var(--text);" title="Send what you have added so far — the maintainer can reply here in the app">' + window.AAUP_ICONS.preview('send', 14) + 'Submit contribution</button>'
          : '') +
      '</div></header>' +
      '<div class="legend' + (legendOpen[id] ? ' expanded' : '') + '"><button type="button" class="legend-toggle" onclick="AAUP_IMPORTED.toggleLegend(\'' + id + '\')"><span class="lt-arrow">▶</span><span>' + (rtl ? 'الدليل' : 'Legend') + '</span><span class="lt-hint">' + (legendOpen[id] ? (rtl ? 'اضغط للطي' : 'Tap to collapse') : (rtl ? 'اضغط للعرض' : 'Tap to expand')) + '</span></button>' +
      '<div class="legend-items">' +
      CATS.map(function(c){ return '<span class="item"><span class="chip ' + c + '"></span><span>' + CAT_LABELS[c][rtl ? 1 : 0] + '</span></span>'; }).join('') +
      '<span class="arrow-sample"><span class="ln"></span><span>' + (rtl ? 'متطلب سابق (مرر المؤشر فوق المساق لتتبعه)' : 'Prerequisite (hover a course to trace it)') + '</span></span>' +
      '</div></div>' +
      '<div class="course-search-wrap"><div class="search-box" id="' + id + '-courseSearchBox">' +
      '<span class="search-ic">' + window.AAUP_ICONS.preview('search', 15) + '</span>' +
      '<input type="text" id="' + id + '-courseSearchInput" class="search-input" placeholder="' + (rtl ? 'ابحث عن مساق بالاسم أو الرقم…' : 'Search a course by name or code…') + '" autocomplete="off">' +
      '<button type="button" class="search-clear" id="' + id + '-courseSearchClear" aria-label="Clear">&times;</button>' +
      '</div><div class="search-dropdown" id="' + id + '-courseSearchDropdown"></div></div>' +
      searchHintHtml(id, rtl) +
      '<div class="imp-body-pad">' +
      (bioEn ? '<p class="imp-bio-text" style="font-size:12px;color:var(--text-dim);opacity:.85;">' + txt(rtl && p.bio && p.bio.ar ? p.bio.ar : bioEn) + '</p>' : '') +
      '<div class="progress-widget"><div class="pw-track"><div class="pw-fill" style="width:' + pct + '%;"></div></div>' +
      '<span style="font-size:12px;color:var(--text-dim);white-space:nowrap;">' + doneCr + ' / ' + totalCr + 'H completed (' + pct + '%)</span></div>';

    // Edit mode is where a student is actively rearranging their plan and
    // most wants a quick read on where they stand — the normal view already
    // has this via Degree Audit/GPA one tap away, so these chips are kept
    // out of it rather than shown twice.
    if(editing){
      var editGpa = window.AAUP_GPA ? window.AAUP_GPA.gpaFor(id) : { gpa: null };
      html += '<div class="imp-stat-chips">' +
        '<div class="imp-stat-chip"><span class="imp-stat-num">' + (editGpa && editGpa.gpa != null ? editGpa.gpa.toFixed(2) : '—') + '</span><span class="imp-stat-label">' + (rtl ? 'المعدل التراكمي' : 'GPA') + '</span></div>' +
        '<div class="imp-stat-chip"><span class="imp-stat-num">' + doneCr + '</span><span class="imp-stat-label">' + (rtl ? 'ساعات مكتسبة' : 'Credits Earned') + '</span></div>' +
        '<div class="imp-stat-chip"><span class="imp-stat-num">' + Math.max(0, totalCr - doneCr) + '</span><span class="imp-stat-label">' + (rtl ? 'ساعات متبقية' : 'Remaining') + '</span></div>' +
        '</div>';
    }

    if(canEdit){
      html += '<div class="panel-action-row">' +
        '<button type="button" class="pw-reset" onclick="AAUP_AUDIT.open(\'' + id + '\')">' + window.AAUP_ICONS.preview('clipboard', 14) + 'Degree Audit &amp; GPA</button>' +
        '<button type="button" class="pw-reset" onclick="AAUP_ACHIEVEMENTS.open(\'' + id + '\')">' + window.AAUP_ICONS.preview('trophy', 14) + 'Achievements</button>' +
        '<button type="button" class="pw-reset" onclick="AAUP_ADVISOR.open(\'' + id + '\')">' + window.AAUP_ICONS.preview('brain', 14) + 'Plan My Next Semester</button>' +
        '</div>';
    }

    html += '<div class="years"><svg id="' + id + '-connectorSvg" class="connector-layer" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="' + id + '-prereqArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 Z"></path></marker>' +
      '<marker id="' + id + '-prereqArrowActive" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z"></path></marker></defs></svg>';

    p.structure.years.forEach(function(y, i){
      html += '<div class="imp-year-block"><div class="imp-year-header"><h3>' + (rtl ? 'السنة ' + (i + 1) : 'Year ' + (i + 1)) + '</h3>';
      if(editing){
        html += '<div class="imp-year-actions">' +
          (y.hasSummer
            ? '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.removeSummer(\'' + id + '\',\'' + y.id + '\')">🗑 ' + (rtl ? 'إزالة الصيفي' : 'Remove Summer') + '</button>'
            : '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.addSummer(\'' + id + '\',\'' + y.id + '\')">☀️ ' + (rtl ? 'إضافة صيفي' : 'Add Summer') + '</button>') +
          '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.removeYear(\'' + id + '\',\'' + y.id + '\')">🗑 ' + (rtl ? 'إزالة السنة' : 'Remove Year') + '</button>' +
          '</div>';
      }
      html += '</div>';
      html += semesterHtml(id, p, y.id, 's1', editing, rtl, i + 1);
      html += semesterHtml(id, p, y.id, 's2', editing, rtl, i + 1);
      if(y.hasSummer){ html += semesterHtml(id, p, y.id, 's3', editing, rtl, i + 1); }
      html += '</div>';
    });

    html += unscheduledHtml(id, p, editing, rtl);

    if(editing){
      html += '<div class="imp-structure-actions">' +
        '<button type="button" class="home-btn" onclick="AAUP_IMPORTED.addYear(\'' + id + '\')">➕ ' + (rtl ? 'إضافة سنة' : 'Add Year') + '</button>' +
        '<button type="button" class="home-btn" onclick="AAUP_LINKS.open(\'' + id + '\')">🔗 ' + (rtl ? 'خطوط المتطلبات' : 'Prerequisite lines') + '</button>' +
        '</div>';
    }
    html += '</div>'; // closes .years

    html += '</div></div>';
    host.innerHTML = html;
    drawConnectors(id);
    initSearch(id);

    if(window.AAUP_PLAN_EDITOR){ window.AAUP_PLAN_EDITOR.bindDraggable(id); }
    if(window.AAUP_COMMUNITY){
      window.AAUP_COMMUNITY.refreshAllCommunityBadges();
      if(window.AAUP_COMMUNITY.syncLive) window.AAUP_COMMUNITY.syncLive(id);
    }
    if(window.__refreshCollapse){ window.__refreshCollapse(id); }
    if(window.__refreshWorkloadSummary){ window.__refreshWorkloadSummary(id); }
    if(window.__refreshMilestones){ window.__refreshMilestones(id); }
    if(window.__refreshFocusMode){ window.__refreshFocusMode(id); }
    if(window.__refreshPhoneHeader){ window.__refreshPhoneHeader(id); }
    if(window.__refreshTabBarProgress){ window.__refreshTabBarProgress(id); }
    // Runs against the freshly-rebuilt DOM. The first call per plan (on open)
    // silently seeds already-complete semesters; later ones (after a toggle
    // re-renders) fire confetti for a semester that just became complete.
    if(window.__celebrateCheck){ window.__celebrateCheck(id); }
  }

  function toggle(planId, slug){
    // What was open to the student before, so the announcement below can name
    // what this tick actually changed rather than just saying "done".
    var before = {};
    (window.__openCourses ? window.__openCourses(planId) : []).forEach(function(el){ before[el.id] = true; });
    toggleCourse(planId, slug);
    render(planId);
    announceToggle(planId, slug, before);
  }

  // A tick silently unlocks other courses: the grid repaints, and a screen
  // reader user is told nothing at all. Say the consequence, not the click.
  function announceToggle(planId, slug, before){
    var node = document.getElementById('a11yAnnouncer');
    if(!node) return;
    var plan = loadImportedPlans()[planId];
    var course = plan && (plan.courses || []).filter(function(c){ return c.id === slug; })[0];
    if(!course) return;
    var rtl = window.__isRtl ? window.__isRtl(planId) : false;
    var done = isDone(planId, slug);
    var info = (window.__PLAN_DATA[planId] || {}).courseInfo || {};
    var opened = (window.__openCourses ? window.__openCourses(planId) : []).filter(function(el){
      return !before[el.id];
    }).map(function(el){
      var parts = window.__splitCourseId(el.id);
      var meta = parts && info[parts.slug];
      return meta ? (rtl && meta.ar ? meta.ar : meta.name) : '';
    }).filter(Boolean);

    var name = (rtl && course.ar) ? course.ar : course.name;
    var msg = name + ' — ' + (done ? (rtl ? 'مُنجز' : 'marked passed') : (rtl ? 'غير مُنجز' : 'marked not passed'));
    if(opened.length){
      msg += '. ' + (rtl ? 'أصبح متاحًا الآن: ' : 'Now open to you: ') + opened.slice(0, 4).join(', ') +
        (opened.length > 4 ? (rtl ? ' وغيرها' : ' and more') : '');
    }
    node.textContent = msg;

    // The same news, visibly — only worth a toast when something actually
    // opened up; ticking a leaf course with nothing downstream of it has
    // nothing new to announce on screen either.
    if(done && opened.length && window.__showUnlockToast){
      var title = (rtl ? '✓ ' : '✓ ') + name + ' — ' + (rtl ? 'مُنجز' : 'marked passed');
      var subtitle = (rtl ? 'أصبح متاحًا الآن: ' : 'Now open to you: ') + opened.slice(0, 3).join(', ') +
        (opened.length > 3 ? (rtl ? ' وغيرها' : ' and more') : '');
      window.__showUnlockToast(title, subtitle);
    }
  }

  // Called by the Plan Editor's applyMove() right after a successful drag —
  // updates the ACTUAL yearId/semester on the course (not a separate
  // override), since this plan's whole view regenerates from that data on
  // every interaction. Without this, a drag looked like it worked but
  // reverted the instant anything else re-rendered the view.
  function persistCourseMove(planId, slug, targetContainerId){
    var m = /-y(\d+)-s(\d+)$/.exec(targetContainerId || '');
    if(!m) return;
    var yearId = 'y' + m[1], semester = 's' + m[2];
    var plans = loadImportedPlans();
    var p = plans[planId];
    if(!p) return;
    var course = (p.courses || []).filter(function(c){ return c.id === slug; })[0];
    if(!course) return;
    course.yearId = yearId;
    course.semester = semester;
    saveImportedPlans(plans);
    render(planId);
  }

  function toggleEdit(planId){
    var page = document.getElementById('page-' + planId);
    if(!page) return;
    page.classList.toggle('editing');
    var enteringEdit = page.classList.contains('editing');
    render(planId); // rebuilds the DOM the tour's step targets look for — must happen before starting it
    if(enteringEdit && window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.startWhenClear('planEditor'); }
  }

  function toggleLang(planId){
    rtlState[planId] = !rtlState[planId];
    render(planId);
  }

  function toggleLegend(planId){
    legendOpen[planId] = !legendOpen[planId];
    render(planId);
  }

  // A one-line tip shown until dismissed once, ever — search feels like the
  // only way in otherwise, when scrolling the tree works just as well.
  var SEARCH_HINT_KEY = 'aaup_searchHintSeen';
  function searchHintHtml(id, rtl){
    try{ if(localStorage.getItem(SEARCH_HINT_KEY)) return ''; }catch(e){}
    return '<p class="search-hint" id="' + id + '-searchHint">' + window.AAUP_ICONS.preview('help', 14) + '' +
      (rtl ? 'ابحث عن مساق مباشرة، أو مرر لأسفل فقط — كل شيء قابل للتصفح أيضًا.'
           : 'Search a course directly, or just scroll — everything’s browsable too.') +
      '<button type="button" class="search-hint-x" onclick="AAUP_IMPORTED.dismissSearchHint()" aria-label="Dismiss">&times;</button></p>';
  }
  function dismissSearchHint(){
    try{ localStorage.setItem(SEARCH_HINT_KEY, '1'); }catch(e){}
    document.querySelectorAll('.search-hint').forEach(function(el){ el.remove(); });
  }

  // ---------- legacy renderer (plans imported before this update — free-text
  // semester labels, no window.__registerPlanData registration) ----------
  function computeNeedsLegacy(prereqPairs){
    var needs = Object.create(null);
    (Array.isArray(prereqPairs) ? prereqPairs : []).forEach(function(pair){
      if(!pair || typeof pair !== 'object') return;
      var a = pair[0], b = pair[1];
      if(typeof a !== 'string' || typeof b !== 'string' || !a || !b) return;
      (needs[b] = needs[b] || []).push(a);
    });
    return needs;
  }
  function renderLegacy(id, p, host){
    var progressKey = 'aaup-imported-progress-' + id;
    var progress = {};
    try{ progress = JSON.parse(localStorage.getItem(progressKey) || '{}') || {}; }catch(e){}

    var needs = computeNeedsLegacy(p.prerequisites);
    var bySemester = {};
    p.courses.forEach(function(c){
      var sem = c.semester || 'Unspecified';
      (bySemester[sem] = bySemester[sem] || []).push(c);
    });
    function isDoneLegacy(cid){ return !!progress[cid]; }
    function isAvailableLegacy(cid){
      var reqs = needs[cid] || [];
      return reqs.every(function(r){ return isDoneLegacy(r); });
    }
    var totalCr = window.__planTotalCredits(p);
    var doneCr = window.__planEarnedCredits(p, isDoneLegacy);
    var pct = totalCr ? Math.round(doneCr / totalCr * 100) : 0;
    var en = nameParts(p.majorName.en), ar = nameParts(p.majorName.ar);

    var html = '<div class="sheet sheet-plan sheet-plan-simple">' +
      '<header><div class="header-actions"><button type="button" class="home-btn" onclick="AAUP_IMPORTED.close()"><span>' + window.AAUP_ICONS.preview('home', 15) + '</span><span>Home</span></button></div>' +
      '<h1>' + txt(en.big) + (en.small ? ' ' + txt(en.small) : '') + ' <em style="opacity:.6;font-size:.6em;">' + txt(ar.big) + (ar.small ? ' ' + txt(ar.small) : '') + '</em></h1></header>' +
      '<div class="imp-body-pad">' +
      '<p style="font-size:12px;color:var(--text-dim);">This is a community-imported plan \u2014 a simplified view without the custom prerequisite-arrow diagram the built-in majors have, but progress tracking and prerequisite locking both work normally.</p>' +
      '<div class="progress-widget"><div class="pw-track"><div class="pw-fill" style="width:' + pct + '%;"></div></div>' +
      '<span style="font-size:12px;color:var(--text-dim);white-space:nowrap;">' + doneCr + ' / ' + totalCr + 'H completed (' + pct + '%)</span></div>';

    var community = window.AAUP_COMMUNITY ? window.AAUP_COMMUNITY.loadCommunity() : {};
    Object.keys(bySemester).forEach(function(sem){
      html += '<div class="imp-semester-block"><div class="imp-semester-title">' + sem + '</div><div class="imp-course-grid">';
      bySemester[sem].forEach(function(c){
        var done = isDoneLegacy(c.id);
        var avail = isAvailableLegacy(c.id);
        var locked = !done && !avail;
        var reqNames = (needs[c.id] || []).map(function(rid){
          var rc = p.courses.filter(function(cc){ return cc.id === rid; })[0];
          return rc ? rc.name : rid;
        });
        var entry = community[c.id];
        var communityBadge = '';
        if(entry){
          var avgD = entry.difficultyVotes ? (entry.totalDifficulty / entry.difficultyVotes).toFixed(1) : null;
          if(avgD){ communityBadge += '<span class="meta-badge">⭐' + avgD + '</span>'; }
        }
        html += '<div class="imp-course-card' + (done ? ' completed' : '') + (locked ? ' locked' : '') + '" data-imp-course="' + c.id + '">' +
          '<div class="imp-name">' + c.name + (done ? ' ✓' : '') + '</div>' +
          '<div class="imp-cr">' + c.creditHours + 'H \u00b7 ' + (c.category || '') + '</div>' +
          (locked ? '<div class="imp-lock-note">🔒 Requires: ' + reqNames.join(', ') + '</div>' : '') +
          (communityBadge ? '<div class="course-meta-badges" style="position:static;margin-top:6px;">' + communityBadge + '</div>' : '') +
          '</div>';
      });
      html += '</div></div>';
    });

    html += '</div></div>';
    host.innerHTML = html;

    host.querySelectorAll('[data-imp-course]').forEach(function(el){
      el.addEventListener('click', function(){
        var cid = el.getAttribute('data-imp-course');
        var canToggle = isDoneLegacy(cid) || isAvailableLegacy(cid);
        if(!canToggle) return;
        progress[cid] = !progress[cid];
        try{ localStorage.setItem(progressKey, JSON.stringify(progress)); }catch(e){}
        renderLegacy(id, p, host);
      });
    });
  }

  function open(id){
    var home = document.getElementById('home');
    if(home) home.style.display = 'none';
    (window.__PLANS || ['robotics', 'cybersecurity', 'medical', 'cs']).forEach(function(prefix){
      var el = document.getElementById('page-' + prefix);
      if(el) el.style.display = 'none';
    });
    var host = document.getElementById('importedPlanView');
    host.style.display = 'block';
    currentOpenPlanId = id;
    render(id);
    window.scrollTo(0, 0);
  }
  function close(){
    currentOpenPlanId = null;
    var host = document.getElementById('importedPlanView');
    if(host) host.style.display = 'none';
    if(window.showPage) window.showPage('home');
  }

  // Shares a plan with someone else: just its definition (name, icon, bio,
  // structure, courses, prerequisites) — deliberately NOT wasEdited or any
  // progress data, since a recipient is starting fresh, not inheriting the
  // exporter's personal completion state. The result is exactly what the
  // Developer Panel's "Import Study Plan" box (or someone else's copy of
  // this same app) expects, so the round trip just works.
  // The community pipeline: a student who built a plan for a major (or a
  // whole university) that isn't covered yet sends it to the maintainer,
  // who reviews it and ships it to everyone in the next update. If
  // APP_SUBMIT_URL is configured (a Google Form, server endpoint, etc.)
  // the exported file + that page open together; until then, a dialog
  // explains exactly what to do with the downloaded file so the flow is
  // never a dead end.
  function planBundle(id){
    var plans = loadImportedPlans();
    var p = plans[id];
    if(!p) return null;
    return {
      majorName: p.majorName, icon: p.icon, iconKey: p.iconKey, imageUrl: p.imageUrl, bio: p.bio,
      structure: p.structure, courses: p.courses, prerequisites: p.prerequisites,
      university: p.university || 'aaup', college: p.college
    };
  }

  function submitPlan(id){
    exportPlan(id);
    if(window.APP_SUBMIT_URL){
      // 'noopener' matters even for a developer-configured URL: without it the
      // opened page gets a live window.opener handle back into this one. The
      // app's own Fix analyzer flags exactly this for <a target="_blank">, so
      // the same standard applies here.
      window.open(window.APP_SUBMIT_URL, '_blank', 'noopener');
      if(window.__showToast){ window.__showToast('\ud83d\udce8 Your plan file just downloaded \u2014 attach it in the form that opened.'); }
      return;
    }
    var overlay = document.getElementById('devModalOverlay');
    var body = document.getElementById('devModalBody');
    if(!overlay || !body) return;
    var bundle = planBundle(id);
    var bundleText = bundle ? JSON.stringify(bundle, null, 2) : '';
    // GitHub's own URL-length limits mean a very large plan can't be
    // prefilled into the issue body \u2014 those still work fine via the
    // downloaded file attached by hand, just without the one-click part.
    var canPrefillIssue = !!(window.APP_GITHUB_REPO && bundleText && bundleText.length < 6000);
    var issueUrl = '';
    if(window.APP_GITHUB_REPO){
      var title = 'New study plan submission: ' + id;
      var lines = ['Submitted from the app\u2019s \ud83d\udce8 Contribute button.', ''];
      if(canPrefillIssue){
        lines.push('```json', bundleText, '```');
      } else {
        lines.push('_Plan JSON is too large to prefill here \u2014 attach the downloaded `' + id + '-study-plan.json` file to this issue instead._');
      }
      issueUrl = 'https://github.com/' + window.APP_GITHUB_REPO + '/issues/new?title=' +
        encodeURIComponent(title) + '&body=' + encodeURIComponent(lines.join('\n'));
    }
    body.innerHTML =
      '<h2 style="margin-top:0;">\ud83d\udce8 Thank you for contributing!</h2>' +
      '<p style="font-size:13px;">Your plan\u2019s file was just downloaded.' +
      (issueUrl
        ? ' Open a submission issue below (the plan JSON is ' + (canPrefillIssue ? 'already filled in' : 'too big to prefill \u2014 attach the downloaded file there') + '), or send the <b>.json</b> file to the app maintainer any other way you reached this app.'
        : ' Send that <b>.json</b> file to the app maintainer (however you reached this app \u2014 the group chat, the store listing\u2019s contact email, etc.) and it can be added for every student in a future update.') +
      '</p>' +
      '<p class="form-note">Plans like yours are exactly how majors that aren\u2019t covered yet get covered \u2014 someone who lived that plan writes it down once, and nobody after them has to be lost.</p>' +
      '<div class="form-actions">' +
      (issueUrl ? '<button type="button" class="home-btn" id="submitOpenIssue" style="border-color:var(--accent);color:var(--text);">\ud83d\udc19 Open submission issue</button>' : '') +
      '<button type="button" class="home-btn" id="submitClose">Close</button></div>';
    overlay.classList.add('open');
    document.getElementById('submitClose').addEventListener('click', function(){ overlay.classList.remove('open'); });
    if(document.getElementById('submitOpenIssue')){
      document.getElementById('submitOpenIssue').addEventListener('click', function(){ window.open(issueUrl, '_blank', 'noopener'); });
    }
  }

  function exportPlan(id){
    var bundle = planBundle(id);
    if(!bundle) return;
    var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = id + '-study-plan.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    if(window.__showToast){ window.__showToast('📤 Exported — share this file, or paste its contents into Import Study Plan.'); }
  }

  function confirmDelete(id){
    var plans = loadImportedPlans();
    var p = plans[id];
    if(!p) return;
    var en = nameParts(p.majorName.en);
    var name = en.big || id;
    var msg = 'Delete "' + name + '"? This removes the plan itself and everyone\u2019s progress in it. This can\u2019t be undone.';
    if(window.__showConfirmDialog){
      window.__showConfirmDialog(msg, function(){ deletePlan(id); });
    } else if(window.confirm(msg)){
      deletePlan(id);
    }
  }
  function deletePlan(id){
    var plans = loadImportedPlans();
    delete plans[id];
    saveImportedPlans(plans);
    try{ localStorage.removeItem('aaup-imported-progress-' + id); }catch(e){}
    if(window.__PLAN_DATA){ delete window.__PLAN_DATA[id]; }
    if(window.AAUP_STORAGE){
      var overrides = window.AAUP_STORAGE.getJSON('aaup_semesterOverrides', {});
      delete overrides[id];
      window.AAUP_STORAGE.setJSON('aaup_semesterOverrides', overrides);
    }
    if(window.__showToast){ window.__showToast('🗑 Plan deleted.'); }
    close();
  }

  // ---------- Course Library: browse every course that already exists,
  // across every built-in major and every other custom plan, for reference
  // while building this one — e.g. checking whether "Discrete Math"
  // already exists somewhere before typing it in again with a slightly
  // different id. Read-only; it doesn't add anything to the plan by
  // itself. ----------
  // Just the plan's name. planLabel() below appends the "small" subtitle so
  // two plans sharing a big name stay distinguishable in a dropdown — but on
  // the Library's own heading that subtitle is the degree line ("B.Sc. · 121
  // CH (as stated) · Program 29033"), which wrapped the title onto three
  // lines to tell a student which plan they are already inside.
  function planTitle(prefix){
    var label = planLabel(prefix);
    var cut = label.indexOf(' — ');
    return cut === -1 ? label : label.slice(0, cut);
  }

  function planLabel(prefix){
    var BUILT_IN = { robotics: 'AI & Robotics', cybersecurity: 'AI & Cybersecurity', medical: 'AI & Medical Sciences', cs: 'Computer Science' };
    if(BUILT_IN[prefix]) return BUILT_IN[prefix];
    var plans = loadImportedPlans();
    var p = plans[prefix];
    if(p){
      // Append the "small" subtitle when present so two plans that share a
      // big name (e.g. this app's built-in "Computer Science" and a feed
      // plan called "Computer Science — Minor: ...") don't render as
      // identical, indistinguishable entries in this dropdown.
      var parts = nameParts(p.majorName.en);
      var big = parts.big || prefix;
      return parts.small ? (big + ' — ' + parts.small) : big;
    }
    return prefix;
  }
  function allKnownCourses(){
    // Built-in majors register themselves at page load; an imported plan
    // only registers once it's actually been opened this session — make
    // sure every one of them is registered here too, or the library would
    // silently miss any custom plan nobody has visited yet.
    var imported = loadImportedPlans();
    Object.keys(imported).forEach(function(pid){
      if(!window.__PLAN_DATA[pid] && hasStructure(imported[pid])){ registerPlan(pid, imported[pid]); }
    });
    var out = [];
    var data = window.__PLAN_DATA || {};
    Object.keys(data).forEach(function(prefix){
      var info = data[prefix].courseInfo || {};
      Object.keys(info).forEach(function(slug){
        out.push({ prefix: prefix, slug: slug, name: info[slug].name, ar: info[slug].ar,
                    cr: info[slug].cr, num: info[slug].num, req: info[slug].req || '' });
      });
    });
    return out;
  }
  // Same order and wording the Degree Audit and My Path use (js/53-roadmap.js
  // BUCKET_ORDER / BUCKET_META), so a bucket is named identically wherever a
  // student meets it.
  var LIB_BUCKET_ORDER = ['univReq', 'univElec', 'colgReq', 'specReq', 'specElec', 'freeElec', 'supportCourses'];
  var LIB_BUCKET_LABEL = {
    univReq: 'Univ. Req.', univElec: 'Univ. Elec.', colgReq: 'Colg. Req.',
    specReq: 'Spec. Req.', specElec: 'Spec. Elec.', freeElec: 'Free Elec.',
    supportCourses: 'Support', _none: 'Not categorised'
  };

  function openLibrary(currentPlanId){
    var overlay = document.getElementById('devModalOverlay');
    var body = document.getElementById('devModalBody');
    if(!overlay || !body) return;
    var courses = allKnownCourses();
    var prefixes = {};
    courses.forEach(function(c){ prefixes[c.prefix] = true; });
    var prefixList = Object.keys(prefixes).sort(function(a, b){ return planLabel(a).localeCompare(planLabel(b)); });

    function showPicker(){
      body.innerHTML =
        '<h2 class="mh" style="margin-top:0;">' + window.AAUP_ICONS.preview('book', 20) + 'Course Library</h2>' +
        '<p class="form-note" style="margin-top:-6px;">Choose a study plan to browse its courses.</p>' +
        (currentPlanId ? '<p class="form-note" style="margin-top:-2px;">Currently in <b>' + window.__escapeHtml(planLabel(currentPlanId)) + '</b>.</p>' : '') +
        '<div class="form-field"><label for="libPlanSelect">Study plan</label><select id="libPlanSelect">' +
        '<option value="">— choose a plan —</option>' +
        prefixList.map(function(pref){ return '<option value="' + pref + '">' + planLabel(pref) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-actions"><button type="button" class="home-btn" id="libClose">Close</button></div>';
      overlay.classList.add('open');
      document.getElementById('libClose').addEventListener('click', function(){ overlay.classList.remove('open'); });
      document.getElementById('libPlanSelect').addEventListener('change', function(e){
        if(e.target.value){ showBrowse(e.target.value); }
      });
    }

    // Opening the Library from inside a plan used to land on an empty "choose
    // a study plan" dropdown — asking a question the student had already
    // answered by being there. Go straight to their plan's courses; the
    // "Choose a different plan" button at the top is how they get to another.
    function start(){
      if(currentPlanId && prefixes[currentPlanId]){ showBrowse(currentPlanId); }
      else { showPicker(); }
    }

    function showBrowse(browsePrefix){
      var list = courses.filter(function(c){ return c.prefix === browsePrefix; });
      var currentIsSame = browsePrefix === currentPlanId;

      // Shelves, not one undifferentiated scroll. A plan's courses are
      // grouped by the requirement each one satisfies — the university's own
      // taxonomy, now that every course carries it — so browsing answers the
      // question a student actually arrives with ("what counts as a Spec.
      // Elec.?") instead of making them read 130 rows to find out. Each shelf
      // states its own count and hours, and courses whose plan published no
      // requirement data fall into one honest "Not categorised" shelf rather
      // than being silently assigned to a bucket nobody said they were in.
      function shelvesFor(filtered){
        var byBucket = {};
        filtered.forEach(function(c){
          var k = LIB_BUCKET_ORDER.indexOf(c.req) !== -1 ? c.req : '_none';
          (byBucket[k] = byBucket[k] || []).push(c);
        });
        return LIB_BUCKET_ORDER.concat(['_none']).filter(function(k){
          return byBucket[k] && byBucket[k].length;
        }).map(function(k){
          var items = byBucket[k];
          var hours = items.reduce(function(a, c){ return a + (Number(c.cr) || 0); }, 0);
          return { key: k, label: LIB_BUCKET_LABEL[k], items: items, hours: hours };
        });
      }

      function rowHtml(c){
        return '<div class="lib-row">' +
          '<span class="lib-row-name">' + window.__escapeHtml(c.name) +
            ' <span class="lib-row-meta">' + c.slug + ' · ' + c.cr + 'H</span></span>' +
          (currentIsSame ? '' : '<button type="button" class="home-btn lib-add-btn" data-slug="' + c.slug + '">➕ Add</button>') +
          '</div>';
      }

      function renderList(filterText){
        var f = (filterText || '').toLowerCase();
        // Match the course code as well as the name — the code is what a
        // student has in front of them on a registration screen.
        var filtered = list.filter(function(c){
          return !f || c.name.toLowerCase().indexOf(f) !== -1 || String(c.slug).toLowerCase().indexOf(f) !== -1;
        });
        if(filtered.length === 0){ return '<p class="ex-note">No matching courses.</p>'; }
        var shelves = shelvesFor(filtered);
        // One shelf and nothing to compare it against is not a shelf — that
        // is the flat list this replaced, with a redundant header on top.
        if(shelves.length === 1){ return shelves[0].items.map(rowHtml).join(''); }
        return shelves.map(function(sh){
          return '<div class="lib-shelf">' +
            '<div class="lib-shelf-head">' +
              '<span class="lib-shelf-label">' + sh.label + '</span>' +
              '<span class="lib-shelf-count">' + sh.items.length + ' · ' + sh.hours + 'H</span>' +
            '</div>' +
            '<div class="lib-shelf-body">' + sh.items.map(rowHtml).join('') + '</div>' +
            '</div>';
        }).join('');
      }

      body.innerHTML =
        '<h2 class="mh" style="margin-top:0;">' + window.AAUP_ICONS.preview('book', 20) + window.__escapeHtml(planTitle(browsePrefix)) + '</h2>' +
        '<button type="button" class="home-btn" id="libBack" style="margin-bottom:10px;">' + window.AAUP_ICONS.preview('shuffle', 14) + 'Change plan</button>' +
        (currentIsSame ? '<p class="form-note">This is the plan you\u2019re already editing.</p>' : '') +
        '<div class="form-field"><input type="text" id="libSearch" placeholder="Search by name or course code…"></div>' +
        '<div id="libList" class="lib-list"></div>' +
        '<div class="form-actions"><button type="button" class="home-btn" id="libClose">Close</button></div>';
      document.getElementById('libList').innerHTML = renderList('');
      overlay.classList.add('open');

      document.getElementById('libBack').addEventListener('click', showPicker);
      document.getElementById('libClose').addEventListener('click', function(){ overlay.classList.remove('open'); });
      document.getElementById('libSearch').addEventListener('input', function(e){
        document.getElementById('libList').innerHTML = renderList(e.target.value);
        bindAddButtons();
      });
      bindAddButtons();

      function bindAddButtons(){
        document.querySelectorAll('.lib-add-btn').forEach(function(btn){
          btn.addEventListener('click', function(){
            var slug = btn.getAttribute('data-slug');
            var course = list.filter(function(c){ return c.slug === slug; })[0];
            if(course){ showTargetPicker(course); }
          });
        });
      }
    }

    function showTargetPicker(course){
      var plans = loadImportedPlans();
      var target = plans[currentPlanId];
      if(!target || !hasStructure(target)){ overlay.classList.remove('open'); return; }
      var alreadyExists = (target.courses || []).some(function(c){ return c.id === course.slug; });

      var yearOptions = target.structure.years.map(function(y, i){
        return '<option value="' + y.id + '|s1">Year ' + (i + 1) + ' — First Semester</option>' +
          '<option value="' + y.id + '|s2">Year ' + (i + 1) + ' — Second Semester</option>' +
          (y.hasSummer ? '<option value="' + y.id + '|s3">Year ' + (i + 1) + ' — Summer</option>' : '');
      }).join('');

      body.innerHTML =
        '<h2 class="mh" style="margin-top:0;">' + window.AAUP_ICONS.preview('plus', 20) + 'Add "' + course.name + '"</h2>' +
        (alreadyExists
          ? '<p class="dev-error-msg">This plan already has a course with the same ID (' + course.slug + '). Adding it again isn\u2019t possible from here — check the plan first.</p>' +
            '<div class="form-actions"><button type="button" class="home-btn" id="libTargetBack">← Back</button></div>'
          : '<div class="form-field"><label for="libTargetSem">Add to which semester?</label><select id="libTargetSem">' + yearOptions + '</select></div>' +
            '<p class="form-note">Same name, ID, category, and credit hours as the original — prerequisites aren\u2019t copied, since they depend on what already exists in this plan.</p>' +
            '<div class="form-actions"><button type="button" class="home-btn" id="libTargetBack">← Back</button>' +
            '<button type="button" class="home-btn" id="libTargetConfirm" style="border-color:var(--accent);color:var(--text);">Add to Plan</button></div>');
      overlay.classList.add('open');

      document.getElementById('libTargetBack').addEventListener('click', function(){ showBrowse(course.prefix); });
      var confirmBtn = document.getElementById('libTargetConfirm');
      if(confirmBtn){
        confirmBtn.addEventListener('click', function(){
          var parts = document.getElementById('libTargetSem').value.split('|');
          var plansNow = loadImportedPlans();
          var p = plansNow[currentPlanId];
          var info = (window.__PLAN_DATA[course.prefix] || {}).courseInfo || {};
          var srcInfo = info[course.slug] || {};
          p.courses.push({
            id: course.slug, name: course.name, ar: srcInfo.ar || course.name,
            creditHours: parseFloat(course.cr) || 0, category: srcInfo.category || inferCategoryFromCard(course.prefix, course.slug),
            yearId: parts[0], semester: parts[1]
          });
          p.wasEdited = true;
          p.prerequisites = p.prerequisites || [];
          saveImportedPlans(plansNow);
          runAutoLink(currentPlanId, course.slug);
          overlay.classList.remove('open');
          if(window.__showToast){ window.__showToast('✅ Added "' + course.name + '" to this plan'); }
          render(currentPlanId);
        });
      }
    }

    function inferCategoryFromCard(prefix, slug){
      var el = document.getElementById(prefix + '-c-' + slug);
      if(!el) return 'core';
      var known = ['core','math','dept','eng','uni','free','skills'];
      for(var i = 0; i < known.length; i++){ if(el.classList.contains(known[i])) return known[i]; }
      return 'core';
    }

    start();
  }

  window.AAUP_IMPORTED = {
    open: open, close: close, renderHomeCards: renderHomeCards, loadImportedPlans: loadImportedPlans,
    saveImportedPlans: saveImportedPlans, toggle: toggle, toggleEdit: toggleEdit,
    addYear: addYear, removeYear: removeYear, addSummer: addSummer, removeSummer: removeSummer,
    addCoursePrompt: openCourseCreatePopup, ICONS: ICONS, nameParts: nameParts, hasStructure: hasStructure,
    compareByDisplayOrder: compareByDisplayOrder,
    confirmDelete: confirmDelete, deletePlan: deletePlan,
    toggleLang: toggleLang, toggleLegend: toggleLegend, openLibrary: openLibrary,
    dismissSearchHint: dismissSearchHint,
    persistCourseMove: persistCourseMove, confirmRemoveCourse: confirmRemoveCourse, removeCourse: removeCourse,
    // Programmatic course creation, for callers that already have every field
    // and do not want the popup — the assistant (js/46-assistant-ai.js) after
    // a student has confirmed the change. Deliberately the SAME function the
    // popup itself submits to, so a course added by the assistant gets the
    // identical duplicate-id check, transitive prerequisite reduction,
    // auto-link pass, and re-render. `overlay` is null: there is no dialog to
    // close. Do not reimplement this elsewhere; that is how two ways of
    // adding a course start behaving differently.
    addCourseDirect: function (planId, yearId, semester, nameEn, nameAr, id, credits, category, prereqIds) {
      return finalizeCourseCreation(planId, yearId, semester, nameEn, nameAr, id,
                                    credits, category, prereqIds || [], null);
    },
    exportPlan: exportPlan, submitPlan: submitPlan, editCoursePrompt: openCourseEditPopup, runAutoLink: runAutoLink,
    planBundle: planBundle,
    refresh: render, openGradePrompt: openGradePrompt, collegeKeyForPlan: collegeKeyForPlan,
    // Re-measure and redraw the prerequisite lines without rebuilding the
    // plan. Folding/unfolding a year (js/05-collapse-finished-years.js)
    // reflows the grid under the connector layer, and a full render() there
    // would throw away scroll position and the search box's state.
    redrawConnectors: drawConnectors,
    openCourseModal: openCourseModal,
    notePending: notePending
  };

  // If the person somehow navigates to a built-in plan while an imported
  // one is open, make sure the imported view gets tucked away too.
  var _origShowPage = window.showPage;
  if(typeof _origShowPage === 'function'){
    window.showPage = function(id){
      var host = document.getElementById('importedPlanView');
      if(host && id !== '__imported__'){ host.style.display = 'none'; }
      return _origShowPage(id);
    };
  }

  var resizeT = null;
  window.addEventListener('resize', function(){
    if(!currentOpenPlanId) return;
    var host = document.getElementById('importedPlanView');
    if(!host || host.style.display === 'none') return;
    if(resizeT) clearTimeout(resizeT);
    resizeT = setTimeout(function(){ drawConnectors(currentOpenPlanId); }, 120);
  });

  function init(){
    // One-time cleanup of plans saved BEFORE imports were sanitized —
    // anything already sitting in storage with markup in its names gets
    // the same escape-and-reslugify pass new imports now get at the door.
    // __sanitizeImportedPlan is idempotent, so on every later boot this
    // finds nothing to change and skips the write entirely.
    try{
      if(window.__sanitizeImportedPlan){
        var stored = loadImportedPlans();
        var before = JSON.stringify(stored);
        Object.keys(stored).forEach(function(pid){
          stored[pid] = window.__sanitizeImportedPlan(stored[pid]);
        });
        if(JSON.stringify(stored) !== before){ saveImportedPlans(stored); }
      }
    }catch(e){ /* never let a migration failure stop the app from loading */ }
    bindCourseModal();
    renderHomeCards();
  }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
