// Assessment breakdown.
//
// AAUP's portal never shows a single "your mark is X" figure. It shows the
// components an instructor chose — Mid Term, Lab, Quiz, Assignment — each out
// of a max that instructor set, and it never shows the final exam mark at all
// (university rule). So this models what a student can actually see.
//
// The key modelling decision: each component's max is its own share of the
// course's 100 points (Mid Term /35, Quiz /20 — not each out of 100). The
// running total is therefore raw earned points out of 100, and whatever is
// left unaccounted for (100 - sum of maxes) is the final exam's weight. That
// remainder is DERIVED, never typed in, because the student cannot know it.

export const PRESETS = ['Mid Term', 'Lab', 'Quiz', 'Assignment'];

const round1 = (n) => Math.round(n * 10) / 10;

// Rows missing a score or max are skipped rather than treated as zero, so a
// half-typed row doesn't make the running total collapse.
export function totals(rows) {
  let score = 0, max = 0, any = false;
  for (const r of rows || []) {
    const s = parseFloat(r.score), m = parseFloat(r.max);
    if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0) continue;
    score += s; max += m; any = true;
  }
  return {
    score: round1(score),
    max: round1(max),
    any,
    remaining: round1(Math.max(0, 100 - max)),
    complete: any && max >= 100,
  };
}

// Real letter tiers, lowest first. F is never a target to aim for.
function tiersAscending(scale) {
  return scale.bands.filter((b) => b.letter !== 'F').slice().reverse();
}

// What the student needs on the remaining share to reach each grade.
// "secured" = already guaranteed regardless of the final;
// "unreachable" = even a perfect final cannot get there.
export function projections(rows, scale) {
  const t = totals(rows);
  if (!scale || !t.any || t.complete) return [];
  return tiersAscending(scale).map((band) => {
    const needed = round1(band.min - t.score);
    if (needed <= 0) return { letter: band.letter, status: 'secured' };
    if (needed > t.remaining + 1e-9) return { letter: band.letter, status: 'unreachable' };
    return { letter: band.letter, status: 'needs', needed, outOf: t.remaining };
  });
}

// The inverse: a student who knows their official letter but not the hidden
// final exam mark can be told the range that mark must have fallen in.
export function finalExamRange(rows, scale, letter) {
  const t = totals(rows);
  if (!scale || !letter || !t.any || t.remaining <= 0) return null;
  const band = scale.bands.find((b) => b.letter === letter);
  if (!band) return null;
  const lo = Math.max(0, round1(band.min - t.score));
  const hi = Math.min(t.remaining, round1(band.max - t.score));
  if (hi < 0 || lo > t.remaining || lo > hi) return null;
  return { low: lo, high: hi, outOf: t.remaining };
}

// Only once every component including the final is accounted for does this
// resolve to a real letter. A mid-term-only total is not a course grade and
// must never be presented as one.
export function resolvedLetter(rows, scale) {
  const t = totals(rows);
  if (!scale || !t.complete) return null;
  return scale.letterFor(t.score);
}
