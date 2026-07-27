// Edit mode: student-owned corrections layered on top of the API data.
//
// This mirrors what app/plan.html's edit mode already did — moves,
// added/removed years and summers, and prerequisite-line fixes are corrections
// a student makes on THEIR OWN device, not writes to the shared database.
// They live in localStorage and are re-applied over the fetched plan on every
// render. Nothing here ever calls the API; that only becomes meaningful once
// accounts and a sync endpoint exist, which is deliberately a later step.
const KEY = 'studyplan.edits.v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
function write(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode */ }
}
function empty() {
  return { moves: {}, structure: { extraYears: 0, summers: [] }, addedPrereqs: [], removedPrereqs: [], syncedPairs: {} };
}
function isEmpty(e) {
  return !Object.keys(e.moves).length && !e.structure.extraYears && !e.structure.summers.length
    && !e.addedPrereqs.length && !e.removedPrereqs.length && !Object.keys(e.syncedPairs).length;
}

function forMajor(majorId) {
  const e = read()[majorId];
  if (!e) return empty();
  // Defensive against a future shape change reading an older blob.
  return { ...empty(), ...e, structure: { ...empty().structure, ...(e.structure || {}) } };
}
function saveForMajor(majorId, e) {
  const m = read();
  if (isEmpty(e)) delete m[majorId];
  else m[majorId] = e;
  write(m);
}

export function hasAny(majorId) { return !isEmpty(forMajor(majorId)); }

export function resetAll(majorId) {
  const m = read();
  delete m[majorId];
  write(m);
}

const pairKey = (a, b) => `${a}__${b}`;

// ---------- semester ordering ----------
// Three slots per year (1, 2, summer=3), so a course's position is one
// comparable integer: y1s1=1, y1s2=2, y1s3=3, y2s1=4, ...
export function orderOf(year, semester) {
  if (year == null || semester == null) return null;
  return (year - 1) * 3 + semester;
}

// ---------- moves ----------
export function moveCourse(majorId, courseId, year, semester) {
  const e = forMajor(majorId);
  e.moves[courseId] = { year, semester };
  saveForMajor(majorId, e);
}
export function clearMove(majorId, courseId) {
  const e = forMajor(majorId);
  delete e.moves[courseId];
  saveForMajor(majorId, e);
}

// ---------- synced pairs (retake exception) ----------
export function isSynced(majorId, reqId, depId) {
  return !!forMajor(majorId).syncedPairs[pairKey(reqId, depId)];
}
export function markSynced(majorId, reqId, depId) {
  const e = forMajor(majorId);
  e.syncedPairs[pairKey(reqId, depId)] = true;
  saveForMajor(majorId, e);
}

// ---------- structure (extra years / summer semesters) ----------
export function structureFor(majorId) { return forMajor(majorId).structure; }

export function addYear(majorId) {
  const e = forMajor(majorId);
  e.structure.extraYears += 1;
  saveForMajor(majorId, e);
}
export function removeYear(majorId) {
  const e = forMajor(majorId);
  e.structure.extraYears = Math.max(0, e.structure.extraYears - 1);
  saveForMajor(majorId, e);
}
export function addSummer(majorId, year) {
  const e = forMajor(majorId);
  if (!e.structure.summers.includes(year)) e.structure.summers.push(year);
  saveForMajor(majorId, e);
}
export function removeSummer(majorId, year) {
  const e = forMajor(majorId);
  e.structure.summers = e.structure.summers.filter((y) => y !== year);
  saveForMajor(majorId, e);
}

// ---------- prerequisite line edits ----------
export function addedPrereqs(majorId) { return forMajor(majorId).addedPrereqs; }
export function removedPrereqs(majorId) { return forMajor(majorId).removedPrereqs; }

export function addLine(majorId, fromId, toId) {
  const e = forMajor(majorId);
  const k = pairKey(fromId, toId);
  // Adding back a line that was previously removed just cancels the removal,
  // so the overlay never grows both an addition and a removal for one pair.
  const removedIdx = e.removedPrereqs.findIndex(([f, t]) => pairKey(f, t) === k);
  if (removedIdx !== -1) e.removedPrereqs.splice(removedIdx, 1);
  else if (!e.addedPrereqs.some(([f, t]) => pairKey(f, t) === k)) e.addedPrereqs.push([fromId, toId]);
  saveForMajor(majorId, e);
}
export function removeLine(majorId, fromId, toId) {
  const e = forMajor(majorId);
  const k = pairKey(fromId, toId);
  const addedIdx = e.addedPrereqs.findIndex(([f, t]) => pairKey(f, t) === k);
  if (addedIdx !== -1) e.addedPrereqs.splice(addedIdx, 1);
  else if (!e.removedPrereqs.some(([f, t]) => pairKey(f, t) === k)) e.removedPrereqs.push([fromId, toId]);
  saveForMajor(majorId, e);
}
export function resetLines(majorId) {
  const e = forMajor(majorId);
  e.addedPrereqs = [];
  e.removedPrereqs = [];
  saveForMajor(majorId, e);
}

// A course's own list of what it needs, flattened to pairs [reqId, depId],
// after the current overlay — the graph used for cycle checks and for
// building the effective prerequisite groups below.
function flatPairs(courses) {
  const pairs = [];
  for (const c of courses) {
    for (const g of c.prerequisites || []) {
      for (const o of g.anyOf) pairs.push([o.id, c.id]);
    }
  }
  return pairs;
}

// Would ADDING a from->to edge close a loop? Walks forward from `to` along
// "unlocks" edges (built from the courses' OWN current prerequisites, i.e.
// before this new edge); if that walk reaches `from`, `to` is already an
// upstream requirement of `from`, so requiring `from` before `to` too would
// make both permanently unavailable.
export function wouldCycle(courses, fromId, toId) {
  if (fromId === toId) return true;
  const unlocks = new Map();
  for (const [req, dep] of flatPairs(courses)) {
    if (!unlocks.has(req)) unlocks.set(req, []);
    unlocks.get(req).push(dep);
  }
  const seen = new Set();
  const stack = [toId];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === fromId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of unlocks.get(cur) || []) if (!seen.has(next)) stack.push(next);
  }
  return false;
}

// ---------- applying the overlay ----------
// Takes the raw API course list for a major and returns a new list with
// moves and prerequisite-line edits folded in. Structure (extra years/
// summers) is NOT part of this — that only adds empty slots to render into,
// which app.js handles directly against structureFor().
export function applyEdits(courses, majorId) {
  const e = forMajor(majorId);
  let out = courses.map((c) => ({
    ...c,
    prerequisites: (c.prerequisites || []).map((g) => ({ ...g, anyOf: [...g.anyOf] })),
  }));

  for (const c of out) {
    const mv = e.moves[c.id];
    if (mv) { c.year = mv.year; c.semester = mv.semester; }
  }

  if (e.removedPrereqs.length) {
    const removed = new Set(e.removedPrereqs.map(([f, t]) => pairKey(f, t)));
    for (const c of out) {
      c.prerequisites = c.prerequisites
        .map((g) => ({ ...g, anyOf: g.anyOf.filter((o) => !removed.has(pairKey(o.id, c.id))) }))
        .filter((g) => g.anyOf.length > 0);
    }
  }

  if (e.addedPrereqs.length) {
    const byId = new Map(out.map((c) => [c.id, c]));
    for (const [fromId, toId] of e.addedPrereqs) {
      const to = byId.get(toId), from = byId.get(fromId);
      if (!to || !from) continue;
      if (to.prerequisites.some((g) => g.anyOf.some((o) => o.id === fromId))) continue;
      to.prerequisites = [...to.prerequisites, {
        kind: 'PREREQUISITE', label: null,
        anyOf: [{ id: from.id, slug: from.slug, code: from.code, name: from.name, nameAr: from.nameAr }],
      }];
    }
  }

  return out;
}

// ---------- move validation ----------
// courses must already have edits applied (effective positions), so this
// checks against what the student actually sees. Returns:
//   { ok: true }
//   { ok: false, hard: true, reason }              — never allowed
//   { ok: false, hard: false, syncReq, syncDep, reason } — allowed if confirmed
export function validateMove(courses, courseId, targetYear, targetSemester, majorId) {
  const targetOrder = orderOf(targetYear, targetSemester);
  if (targetOrder == null) {
    return { ok: false, hard: true, reason: { en: 'Not a valid semester slot.', ar: 'ليس فصلاً دراسيًا صالحًا.' } };
  }
  const byId = new Map(courses.map((c) => [c.id, c]));
  const course = byId.get(courseId);
  if (!course) return { ok: true };
  const nameOf = (c, rtl) => (rtl && c.nameAr) ? c.nameAr : c.name;

  // ---- this course's own requirements: each group needs SOME option at or
  // before the target (an OR group is only actually blocking if every one of
  // its options is later than the target) ----
  for (const g of course.prerequisites || []) {
    const positioned = g.anyOf
      .map((o) => ({ opt: o, order: orderOf(byId.get(o.id)?.year, byId.get(o.id)?.semester) }))
      .filter((x) => x.order != null);
    if (!positioned.length) continue;
    const best = Math.min(...positioned.map((x) => x.order));
    if (best > targetOrder) {
      const reqNames = g.anyOf.map((o) => o.name).join(' / ');
      const reqNamesAr = g.anyOf.map((o) => o.nameAr || o.name).join(' / ');
      return { ok: false, hard: true, reason: {
        en: `Needs "${reqNames}" to come first — that's currently in a later semester.`,
        ar: `يحتاج إلى "${reqNamesAr}" أولًا — وهو حاليًا في فصل لاحق.`,
      } };
    }
    if (best === targetOrder) {
      const atTarget = positioned.filter((x) => x.order === targetOrder);
      const unsynced = atTarget.filter((x) => !isSynced(majorId, x.opt.id, courseId));
      if (unsynced.length) {
        const reqOpt = unsynced[0].opt;
        return { ok: false, hard: false, syncReq: reqOpt.id, syncDep: courseId, reason: {
          en: `"${course.name}" normally needs "${reqOpt.name}" finished first. This is only valid if a student is retaking "${reqOpt.name}" at the same time.`,
          ar: `"${course.name}" يحتاج عادةً إلى إنهاء "${reqOpt.nameAr || reqOpt.name}" أولًا. هذا صالح فقط إذا كان الطالب يعيد "${reqOpt.nameAr || reqOpt.name}" في نفس الوقت.`,
        } };
      }
    }
  }

  // ---- courses that depend on this one: only a real conflict if the
  // dependent's group has no OTHER already-earlier option to rely on ----
  for (const dep of courses) {
    if (dep.id === courseId) continue;
    for (const g of dep.prerequisites || []) {
      if (!g.anyOf.some((o) => o.id === courseId)) continue;
      const depOrder = orderOf(dep.year, dep.semester);
      if (depOrder == null) continue;
      const altOk = g.anyOf.some((o) => {
        if (o.id === courseId) return false;
        const oc = byId.get(o.id);
        const oOrder = oc ? orderOf(oc.year, oc.semester) : null;
        return oOrder != null && oOrder <= depOrder;
      });
      if (altOk) continue;
      if (targetOrder > depOrder) {
        return { ok: false, hard: true, reason: {
          en: `"${dep.name}" needs this course first — it's currently in an earlier semester.`,
          ar: `"${dep.nameAr || dep.name}" يحتاج إلى هذا المساق أولًا — وهو حاليًا في فصل سابق.`,
        } };
      }
      if (targetOrder === depOrder && !isSynced(majorId, courseId, dep.id)) {
        return { ok: false, hard: false, syncReq: courseId, syncDep: dep.id, reason: {
          en: `"${dep.name}" normally needs "${course.name}" finished first. This is only valid if a student is retaking "${course.name}" at the same time.`,
          ar: `"${dep.nameAr || dep.name}" يحتاج عادةً إلى إنهاء "${course.name}" أولًا. هذا صالح فقط إذا كان الطالب يعيد "${course.name}" في نفس الوقت.`,
        } };
      }
    }
  }

  return { ok: true };
}
