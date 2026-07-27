// Load the extracted JSON in data/ into the database.
//
// This is the migration that makes the database the source of truth. It is
// idempotent — every write is an upsert keyed on the natural identifiers
// (university slug, university+major slug, major+course code) — so it can be
// re-run after re-extracting without duplicating anything.
//
// Prerequisites are rebuilt from scratch on each run rather than upserted.
// They have no natural key of their own (a group is an anonymous AND/OR node),
// so incremental reconciliation would leak orphaned groups over time; deleting
// a major's groups and re-creating them is both simpler and exactly correct.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../data');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function seedUniversity(slug) {
  const uniDir = path.join(DATA, slug);
  const uni = await readJson(path.join(uniDir, 'university.json'));

  const university = await prisma.university.upsert({
    where: { slug: uni.slug },
    create: {
      slug: uni.slug,
      name: uni.name,
      nameAr: uni.nameAr ?? null,
      shortName: uni.shortName ?? null,
      icon: uni.icon ?? null,
      // The extractor deliberately left these null rather than guessing them;
      // '' would be a fabricated value, so null is carried through as-is.
      country: uni.country ?? 'Unknown',
      website: uni.website ?? null,
      logoUrl: uni.logoUrl ?? null,
      description: uni.description ?? null,
    },
    update: {
      name: uni.name,
      nameAr: uni.nameAr ?? null,
      shortName: uni.shortName ?? null,
      icon: uni.icon ?? null,
      website: uni.website ?? null,
    },
  });

  // ---- colleges ----
  const collegeIdBySlug = new Map();
  for (const c of uni.colleges ?? []) {
    const college = await prisma.college.upsert({
      where: { universityId_slug: { universityId: university.id, slug: c.slug } },
      create: {
        universityId: university.id,
        slug: c.slug,
        name: c.name,
        nameAr: c.nameAr ?? null,
        icon: c.icon ?? null,
      },
      update: { name: c.name, nameAr: c.nameAr ?? null, icon: c.icon ?? null },
    });
    collegeIdBySlug.set(c.slug, college.id);
  }

  // ---- grading scales ----
  let rules = { gradingScales: [] };
  try {
    rules = await readJson(path.join(uniDir, 'rules.json'));
  } catch {
    /* a university may legitimately have no rules file yet */
  }

  const scaleBySlug = new Map();
  for (const s of rules.gradingScales ?? []) {
    const scale = await prisma.gradingScale.upsert({
      where: { universityId_name: { universityId: university.id, name: s.name } },
      create: {
        universityId: university.id,
        name: s.name,
        passMark: s.passMark,
        bands: s.bands,
      },
      update: { passMark: s.passMark, bands: s.bands },
    });
    scaleBySlug.set(s.slug, scale.id);
  }

  // ---- majors ----
  let majorFiles = [];
  try {
    majorFiles = (await readdir(path.join(uniDir, 'majors'))).filter((f) => f.endsWith('.json'));
  } catch {
    /* no majors yet */
  }

  const counts = { majors: 0, courses: 0, prereqs: 0 };

  for (const file of majorFiles) {
    const m = await readJson(path.join(uniDir, 'majors', file));

    // Which grading scale applies. Only the AI faculty's own majors use the
    // 50-pass scale; everything else falls back to the engineering one. This
    // mirrors what the app already does and is a default, never an assertion
    // about a specific course.
    const scaleId =
      scaleBySlug.get(m.college === 'aaup-ai-ds' ? 'ai' : 'engineering') ?? null;

    const major = await prisma.major.upsert({
      where: { universityId_slug: { universityId: university.id, slug: m.slug } },
      create: {
        universityId: university.id,
        collegeId: collegeIdBySlug.get(m.college) ?? null,
        slug: m.slug,
        name: m.name,
        nameAr: m.nameAr ?? null,
        subtitle: m.subtitle ?? null,
        subtitleAr: m.subtitleAr ?? null,
        icon: m.icon ?? null,
        bio: m.bio ?? null,
        bioAr: m.bioAr ?? null,
        department: m.college ?? null,
        // Stays null until the real total is read off the official PDF — the
        // credit sum here counts pool electives no student takes all of.
        degreeHours: m.degreeHours ?? null,
        gradingScaleId: scaleId,
      },
      update: {
        collegeId: collegeIdBySlug.get(m.college) ?? null,
        name: m.name,
        nameAr: m.nameAr ?? null,
        subtitle: m.subtitle ?? null,
        subtitleAr: m.subtitleAr ?? null,
        icon: m.icon ?? null,
        bio: m.bio ?? null,
        bioAr: m.bioAr ?? null,
        department: m.college ?? null,
        degreeHours: m.degreeHours ?? null,
        gradingScaleId: scaleId,
      },
    });
    counts.majors++;

    // ---- courses ----
    // Keyed on slug, not code: a lecture and its lab share one catalog number
    // and must stay two distinct rows. Placeholder elective slots keep code
    // null rather than being given an invented number.
    const courseIdBySlug = new Map();
    for (const c of m.courses) {
      const course = await prisma.course.upsert({
        where: { majorId_slug: { majorId: major.id, slug: c.slug } },
        create: {
          majorId: major.id,
          slug: c.slug,
          code: c.code ?? null,
          name: c.name,
          nameAr: c.nameAr ?? null,
          credits: c.credits ?? 0,
          year: c.year ?? null,
          semester: c.semester ?? null,
          category: c.category,
          isElective: !!c.isElective,
          description: c.prerequisiteText ?? null,
        },
        update: {
          code: c.code ?? null,
          name: c.name,
          nameAr: c.nameAr ?? null,
          credits: c.credits ?? 0,
          year: c.year ?? null,
          semester: c.semester ?? null,
          category: c.category,
          isElective: !!c.isElective,
        },
      });
      courseIdBySlug.set(c.slug, course.id);
      counts.courses++;
    }

    // ---- prerequisites ----
    // Rebuilt wholesale: cascade removes this major's options with its groups.
    await prisma.prerequisiteGroup.deleteMany({
      where: { course: { majorId: major.id } },
    });

    // The extracted format is flat pairs, which are pure AND. Each becomes its
    // own single-option group — the shape that lets an OR rule be added later
    // without a migration.
    for (const p of m.prerequisites) {
      const courseId = courseIdBySlug.get(p.forCourse);
      const requiredId = courseIdBySlug.get(p.requires);
      if (!courseId || !requiredId) {
        // Extraction already proved referential integrity, so this would mean
        // the data changed underneath us. Loud, not silent.
        throw new Error(
          `${m.slug}: prerequisite references a missing course (${p.requires} -> ${p.forCourse})`
        );
      }
      await prisma.prerequisiteGroup.create({
        data: {
          courseId,
          kind: 'PREREQUISITE',
          options: { create: [{ requiredCourseId: requiredId }] },
        },
      });
      counts.prereqs++;
    }

    console.log(
      `  ${m.slug.padEnd(15)} ${String(m.courses.length).padStart(3)} courses, ` +
        `${String(m.prerequisites.length).padStart(3)} prerequisites`
    );
  }

  return counts;
}

async function main() {
  const index = await readJson(path.join(DATA, 'universities.json'));
  const totals = { universities: 0, majors: 0, courses: 0, prereqs: 0 };

  for (const u of index.universities) {
    console.log(`\n${u.name} (${u.slug})`);
    const c = await seedUniversity(u.slug);
    totals.universities++;
    totals.majors += c.majors;
    totals.courses += c.courses;
    totals.prereqs += c.prereqs;
  }

  console.log(
    `\nSeeded ${totals.universities} universities, ${totals.majors} majors, ` +
      `${totals.courses} courses, ${totals.prereqs} prerequisites`
  );
}

main()
  .catch((e) => {
    console.error('\nSeed failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
