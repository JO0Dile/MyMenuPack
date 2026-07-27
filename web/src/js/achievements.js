// Achievements.
//
// Every rule is DERIVED from whatever plan is loaded — course counts, credit
// totals, the years and semesters that actually exist, the categories present.
// Nothing is keyed to a specific major, so a newly imported university gets a
// working achievement set with no code change. Same constraint the grading
// scales are under, and for the same reason.
//
// Locked achievements show their progress rather than hiding it: "3/5
// semesters" tells a student what to aim at; a blank badge tells them nothing.
import { computeGpa, earnedCredits, NON_PASSING } from './gpa.js';

const pct = (a, b) => (b > 0 ? Math.min(1, a / b) : 0);

// A ticked box carrying an F is taken, not passed — the same rule the credit
// totals use. Kept consistent so a student never sees an achievement that
// contradicts their own progress bar.
function passedCourses(courses, records) {
  return courses.filter((c) => {
    const r = records.get(c.id);
    if (!r) return false;
    return !r.grade || !NON_PASSING.has(r.grade);
  });
}

export function compute(courses, records, scale, t) {
  const passed = passedCourses(courses, records);
  const passedIds = new Set(passed.map((c) => c.id));
  const totalCredits = courses.reduce((n, c) => n + (Number(c.credits) || 0), 0);
  const earned = earnedCredits(courses, records, scale);
  const { gpa } = computeGpa(courses, records, scale);
  const out = [];

  out.push({
    id: 'first-course', icon: '🌱', title: t.ach.firstCourse,
    done: passed.length >= 1, progress: pct(passed.length, 1),
    detail: `${passed.length}/1`,
  });

  // Credit milestones as a share of THIS plan, so they scale to any degree.
  for (const share of [0.25, 0.5, 0.75, 1]) {
    const target = Math.round(totalCredits * share);
    out.push({
      id: `credits-${share}`, icon: share === 1 ? '🎓' : '📚',
      title: t.ach.creditShare(Math.round(share * 100)),
      done: target > 0 && earned >= target,
      progress: pct(earned, target), detail: `${earned}/${target}`,
    });
  }

  // Every semester and year that exists in this plan.
  const bucket = (keyFn) => {
    const m = new Map();
    for (const c of courses) {
      const k = keyFn(c);
      if (k == null) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    return m;
  };
  const countComplete = (m) =>
    [...m.values()].filter((l) => l.every((c) => passedIds.has(c.id))).length;

  const bySem = bucket((c) =>
    c.year == null || c.semester == null ? null : `${c.year}-${c.semester}`);
  const semDone = countComplete(bySem);
  out.push({
    id: 'semesters', icon: '📆', title: t.ach.allSemesters,
    done: bySem.size > 0 && semDone === bySem.size,
    progress: pct(semDone, bySem.size), detail: `${semDone}/${bySem.size}`,
  });

  const byYear = bucket((c) => c.year ?? null);
  const yearDone = countComplete(byYear);
  out.push({
    id: 'years', icon: '🏅', title: t.ach.allYears,
    done: byYear.size > 0 && yearDone === byYear.size,
    progress: pct(yearDone, byYear.size), detail: `${yearDone}/${byYear.size}`,
  });

  // One per category actually present — an imported plan with different
  // categories gets its own set automatically.
  for (const [cat, list] of bucket((c) => c.category)) {
    const n = list.filter((c) => passedIds.has(c.id)).length;
    out.push({
      id: `cat-${cat}`, icon: '🗂️',
      title: t.ach.category(t.categories[cat] || cat),
      done: n === list.length, progress: pct(n, list.length),
      detail: `${n}/${list.length}`,
    });
  }

  // Grade quality, only once there is a GPA to speak of.
  if (gpa != null) {
    for (const target of [3, 3.5]) {
      out.push({
        id: `gpa-${target}`, icon: '⭐', title: t.ach.gpaAtLeast(target.toFixed(2)),
        done: gpa >= target, progress: pct(gpa, target), detail: gpa.toFixed(2),
      });
    }
  }

  // The scale's own top letter, so a university grading A+ isn't excluded.
  const topGrade = scale?.letters?.[0] || 'A';
  const topCount = [...records.values()].filter((r) => r.grade === topGrade).length;
  out.push({
    id: 'top-grades', icon: '🌟', title: t.ach.topGrades(topGrade, 5),
    done: topCount >= 5, progress: pct(topCount, 5), detail: `${topCount}/5`,
  });

  return out;
}

export const summary = (list) => ({
  unlocked: list.filter((a) => a.done).length,
  total: list.length,
});
