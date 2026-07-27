// Prerequisite logic, kept apart from rendering so it can be unit-tested and
// so the same rules can later be checked server-side without duplicating them.
//
// The group shape is honoured exactly as the API sends it: ANY option inside a
// group satisfies that group, and EVERY group must be satisfied. Collapsing
// that to a flat list would turn an OR into an AND and tell a student they are
// blocked when they are not.

export function groupSatisfied(group, completedIds) {
  return group.anyOf.some((opt) => completedIds.has(opt.id));
}

export function isAvailable(course, completedIds) {
  return (course.prerequisites || []).every((g) => groupSatisfied(g, completedIds));
}

// The courses still blocking this one, so the UI can name them rather than
// just greying the card out.
export function missingFor(course, completedIds) {
  return (course.prerequisites || [])
    .filter((g) => !groupSatisfied(g, completedIds))
    .map((g) => ({ kind: g.kind, anyOf: g.anyOf }));
}

export function summarise(courses, completedIds) {
  let totalCredits = 0, doneCredits = 0, done = 0, available = 0;
  for (const c of courses) {
    totalCredits += c.credits || 0;
    if (completedIds.has(c.id)) {
      done++;
      doneCredits += c.credits || 0;
    } else if (isAvailable(c, completedIds)) {
      available++;
    }
  }
  return {
    total: courses.length,
    done,
    available,
    totalCredits,
    doneCredits,
    percent: totalCredits ? Math.round((doneCredits / totalCredits) * 100) : 0,
  };
}
