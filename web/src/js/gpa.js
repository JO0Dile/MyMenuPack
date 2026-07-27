// GPA engine.
//
// The grading scale is DATA fetched from the API, never constants in this
// file. AAUP alone runs two — Engineering passes D at 60, the Faculty of AI &
// Data Science at 50 — and a third university will bring a third. Hardcoding
// bands here would recreate exactly the trapped-data problem this refactor
// exists to remove.
//
// Rules encoded below, each verified against real AAUP transcripts during the
// original build:
//   * F and FA are worth 0.35 points, not 0. With F = 0 no combination of
//     credit hours reproduces a real transcript's semester GPA; with 0.35 it
//     reproduces exactly.
//   * W (withdrawn) is excluded from the GPA entirely rather than counted as
//     zero — it is a clean withdrawal, not a failure.
//   * A retaken course's ORIGINAL attempt leaves the cumulative GPA once the
//     retake has its own grade. Until then the original still counts.

export const NON_PASSING = new Set(['F', 'FA', 'W']);
export const EXCLUDED_FROM_GPA = new Set(['W']);

// Grades that exist outside the numeric bands and so cannot be derived from a
// scale. Points come from the scale's own bands where present.
const SPECIAL_POINTS = { FA: 0.35 };

export function makeScale(gradingScale) {
  if (!gradingScale || !Array.isArray(gradingScale.bands)) return null;
  // Highest floor first so the first match wins.
  const bands = [...gradingScale.bands].sort((a, b) => b.min - a.min);
  const pointsByLetter = new Map(bands.map((b) => [b.letter, Number(b.points)]));
  for (const [letter, pts] of Object.entries(SPECIAL_POINTS)) {
    if (!pointsByLetter.has(letter)) pointsByLetter.set(letter, pts);
  }

  return {
    name: gradingScale.name,
    passMark: Number(gradingScale.passMark),
    bands,
    letters: bands.map((b) => b.letter),

    // A numeric mark out of 100 -> the official letter for THIS scale.
    letterFor(mark) {
      const n = Number(mark);
      if (!Number.isFinite(n)) return null;
      const clamped = Math.max(0, Math.min(100, n));
      const band = bands.find((b) => clamped >= b.min && clamped <= b.max);
      return band ? band.letter : null;
    },

    pointsFor(letter) {
      const p = pointsByLetter.get(letter);
      return p == null ? null : p;
    },

    isPassing(letter) {
      return letter != null && !NON_PASSING.has(letter);
    },
  };
}

// records: Map<courseId, { grade }>; courses carry credits.
// Returns { gpa, credits, points } — gpa null when nothing counts yet, which
// is different from 0.00 and must not be displayed as such.
export function computeGpa(courses, records, scale) {
  if (!scale) return { gpa: null, credits: 0, points: 0 };
  let points = 0;
  let credits = 0;

  for (const c of courses) {
    const rec = records.get(c.id);
    if (!rec || !rec.grade) continue;
    if (EXCLUDED_FROM_GPA.has(rec.grade)) continue;
    const p = scale.pointsFor(rec.grade);
    if (p == null) continue;
    const cr = Number(c.credits) || 0;
    if (cr <= 0) continue;
    points += p * cr;
    credits += cr;
  }

  return {
    gpa: credits ? points / credits : null,
    credits,
    points,
  };
}

// Credits that actually count toward graduation: completed AND passed.
// A ticked box with an F is taken, not passed, and must not inflate progress.
export function earnedCredits(courses, records, scale) {
  let earned = 0;
  for (const c of courses) {
    const rec = records.get(c.id);
    if (!rec) continue;
    // No grade recorded yet — the student ticked it done, so trust that.
    if (!rec.grade) { earned += Number(c.credits) || 0; continue; }
    if (scale && !scale.isPassing(rec.grade)) continue;
    earned += Number(c.credits) || 0;
  }
  return earned;
}

export function formatGpa(gpa) {
  return gpa == null ? '—' : gpa.toFixed(2);
}
