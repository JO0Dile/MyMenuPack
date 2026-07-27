// Assert that EVERY study plan the old app shipped survived into the database.
//
// The first migration extracted only the four majors hardcoded in
// app/plan.html and missed the 30 plans in app/plans/index.json. The
// verification at the time did not catch it, because it only checked that the
// plans it HAD extracted matched — it verified precision and never
// completeness. That is the specific hole this file closes: it walks the
// legacy sources and demands each one be present, so an omission fails loudly
// instead of looking like a clean run.
//
// It compares against git, not against data/, so a converter bug that dropped
// a plan on the way into data/ is caught too.
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEGACY_COMMIT = '5635067';
const DEMO_IDS = new Set(['example-demo-plan']);

// Same table the old app used (plan.html:8475) and the importer applies.
const CATEGORY = {
  core: 'CORE', math: 'MATH', dept: 'DEPARTMENT_ELECTIVE',
  uni: 'UNIVERSITY_ELECTIVE', free: 'FREE_ELECTIVE',
  skills: 'UNIVERSITY_REQUIREMENT', eng: 'ENGLISH',
};
const SEMESTER = { s1: 1, s2: 2, s3: 3, summer: 3 };
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

let checks = 0;
const failures = [];
function assert(cond, msg) {
  checks++;
  if (!cond) failures.push(msg);
}

function gitShow(path) {
  return execFileSync('git', ['show', `${LEGACY_COMMIT}:${path}`], {
    cwd: new URL('../../', import.meta.url).pathname,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function main() {
  const feed = JSON.parse(gitShow('app/plans/index.json'));
  const legacyPlans = feed.plans.filter((p) => !DEMO_IDS.has(p.id));

  const majors = await prisma.major.findMany({
    include: {
      university: { select: { slug: true } },
      college: { select: { slug: true } },
      courses: {
        include: { prerequisiteGroups: { include: { options: { include: { requiredCourse: true } } } } },
      },
    },
  });
  const majorBySlug = new Map(majors.map((m) => [`${m.university.slug}/${m.slug}`, m]));

  // ---- 1. completeness: every legacy plan is present ----
  for (const p of legacyPlans) {
    const key = `${p.university}/${p.id}`;
    assert(majorBySlug.has(key), `MISSING PLAN: ${key} (${p.courses?.length ?? 0} courses in the legacy feed)`);
  }

  // ---- 2. the four majors that were hardcoded in plan.html ----
  for (const slug of ['robotics', 'cybersecurity', 'medical', 'cs']) {
    assert(majorBySlug.has(`aaup/${slug}`), `MISSING built-in major: aaup/${slug}`);
  }

  // ---- 3. field-level fidelity for every legacy plan ----
  for (const p of legacyPlans) {
    const m = majorBySlug.get(`${p.university}/${p.id}`);
    if (!m) continue;

    const expectedName = (p.majorName?.en?.big) || p.id;
    assert(m.name === expectedName, `${p.id}: name "${m.name}" != "${expectedName}"`);
    assert((m.icon ?? null) === (p.icon || null), `${p.id}: icon mismatch`);

    assert(
      m.courses.length === (p.courses ?? []).length,
      `${p.id}: ${m.courses.length} courses in DB, ${(p.courses ?? []).length} in the legacy feed`
    );

    const dbBySlug = new Map(m.courses.map((c) => [c.slug, c]));
    for (const lc of p.courses ?? []) {
      const slug = slugify(lc.id);
      const dc = dbBySlug.get(slug);
      assert(!!dc, `${p.id}: course ${slug} missing from DB`);
      if (!dc) continue;

      assert(dc.name === (lc.name || '').trim(), `${p.id}/${slug}: name mismatch`);
      assert(Number(dc.credits) === Number(lc.creditHours ?? 0), `${p.id}/${slug}: credits mismatch`);
      assert(dc.category === CATEGORY[lc.category], `${p.id}/${slug}: category mismatch`);
      const year = /^y(\d+)$/.test(lc.yearId || '') ? Number(lc.yearId.slice(1)) : null;
      assert(dc.year === year, `${p.id}/${slug}: year ${dc.year} != ${year}`);
      assert(dc.semester === (SEMESTER[lc.semester] ?? null), `${p.id}/${slug}: semester mismatch`);
      const code = lc.courseNumber ? String(lc.courseNumber).trim() : null;
      assert((dc.code ?? null) === (code || null), `${p.id}/${slug}: code mismatch`);
    }

    // ---- 4. prerequisite sets match exactly, in BOTH directions ----
    const legacyPairs = new Set(
      (p.prerequisites ?? []).map(([a, b]) => `${slugify(a)}->${slugify(b)}`)
    );
    const dbPairs = new Set();
    for (const c of m.courses) {
      for (const g of c.prerequisiteGroups) {
        for (const o of g.options) dbPairs.add(`${o.requiredCourse.slug}->${c.slug}`);
      }
    }
    for (const pair of legacyPairs) {
      assert(dbPairs.has(pair), `${p.id}: prerequisite ${pair} missing from DB`);
    }
    for (const pair of dbPairs) {
      assert(legacyPairs.has(pair), `${p.id}: DB has extra prerequisite ${pair}`);
    }
  }

  // ---- 5. colleges survived ----
  const collegeCount = await prisma.college.count();
  assert(collegeCount === 6, `expected 6 colleges, found ${collegeCount}`);

  const totalCourses = await prisma.course.count();
  console.log(`legacy plans checked: ${legacyPlans.length}`);
  console.log(`majors in DB:         ${majors.length}`);
  console.log(`courses in DB:        ${totalCourses}`);
  console.log(`colleges in DB:       ${collegeCount}`);
  console.log(`assertions:           ${checks}`);

  if (failures.length) {
    console.error(`\nFAILED (${failures.length}):`);
    for (const f of failures.slice(0, 40)) console.error('  - ' + f);
    if (failures.length > 40) console.error(`  ... and ${failures.length - 40} more`);
    process.exit(1);
  }
  console.log('\nAll legacy plans accounted for.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
