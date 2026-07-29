import prisma from '../../lib/prisma.js';

// The whole catalogue in the shape the app's own plan renderer already speaks.
//
// This is not a legacy shim. The frontend IS the original app — its generic
// renderer draws any plan from this structure (that is how the 30 published
// plans always rendered), so serving it directly means the database drives the
// real UI with no translation layer and no second rendering path to keep in
// sync. Nothing about the catalogue is hardcoded in the client any more; this
// endpoint is where all of it comes from.

// Inverse of the importer's mapping, which itself came from the app's own
// CATEGORY_FALLBACK table. Round-tripping through these two must be lossless.
const CATEGORY_OUT = {
  CORE: 'core',
  MATH: 'math',
  DEPARTMENT_ELECTIVE: 'dept',
  UNIVERSITY_ELECTIVE: 'uni',
  FREE_ELECTIVE: 'free',
  UNIVERSITY_REQUIREMENT: 'skills',
  ENGLISH: 'eng',
};

function shapePlan(major) {
  // Years/summers are derived from where the courses actually sit rather than
  // stored separately, so the structure can never disagree with the courses.
  const years = new Map();
  for (const c of major.courses) {
    if (c.year == null) continue;
    const id = `y${c.year}`;
    years.set(id, (years.get(id) || false) || c.semester === 3);
  }
  const structure = {
    years: [...years.entries()]
      .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
      .map(([id, hasSummer]) => ({ id, hasSummer })),
  };

  const prerequisites = [];
  for (const c of major.courses) {
    for (const g of c.prerequisiteGroups) {
      for (const o of g.options) prerequisites.push([o.requiredCourse.slug, c.slug]);
    }
  }

  return {
    id: major.slug,
    // Derived from the row's own updatedAt: the client only replaces a stored
    // plan when the feed's version is higher, so a fixed 1 would mean a
    // corrected plan never reached anyone who already had the old one.
    version: Math.floor(major.updatedAt.getTime() / 1000),
    majorName: {
      en: { big: major.name, small: major.subtitle ?? '' },
      ar: { big: major.nameAr ?? '', small: major.subtitleAr ?? '' },
    },
    icon: major.icon ?? '🎓',
    university: major.university.slug,
    college: {
      en: major.college?.name ?? '',
      ar: major.college?.nameAr ?? '',
    },
    // The college SLUG too: the home screen groups plans by college id, and
    // matching on a display name would break the moment one is renamed.
    collegeId: major.college?.slug ?? null,
    bio: { en: major.bio ?? '', ar: major.bioAr ?? '' },
    degreeHours: major.degreeHours ?? null,
    freeElectiveSuggestions: major.freeElectiveSuggestions ?? [],
    gradingScale: major.gradingScale
      ? { name: major.gradingScale.name, passMark: major.gradingScale.passMark, bands: major.gradingScale.bands }
      : null,
    structure,
    courses: major.courses.map((c) => ({
      id: c.slug,
      name: c.name,
      ar: c.nameAr ?? '',
      creditHours: Number(c.credits),
      category: CATEGORY_OUT[c.category] ?? 'core',
      yearId: c.year == null ? null : `y${c.year}`,
      semester: c.semester == null ? null : `s${c.semester}`,
      courseNumber: c.code ?? '',
    })),
    prerequisites,
  };
}

export async function getRegistry() {
  const universities = await prisma.university.findMany({
    orderBy: { name: 'asc' },
    include: { colleges: { orderBy: { name: 'asc' } } },
  });
  return { universities: shapeUniversities(universities), colleges: shapeColleges(universities) };
}

export async function getFeed() {
  const [universities, majors] = await Promise.all([
    prisma.university.findMany({
      orderBy: { name: 'asc' },
      include: { colleges: { orderBy: { name: 'asc' } } },
    }),
    prisma.major.findMany({
      orderBy: { name: 'asc' },
      include: {
        university: { select: { slug: true } },
        college: { select: { slug: true, name: true, nameAr: true } },
        gradingScale: { select: { name: true, passMark: true, bands: true } },
        courses: {
          orderBy: [{ year: 'asc' }, { semester: 'asc' }, { name: 'asc' }],
          include: { prerequisiteGroups: { include: { options: { include: { requiredCourse: true } } } } },
        },
      },
    }),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    universities: shapeUniversities(universities),
    colleges: shapeColleges(universities),
    plans: majors.map(shapePlan),
  };
}

function shapeUniversities(universities) {
  return Object.fromEntries(
    universities.map((u) => [
      u.slug,
      {
        name: { en: u.name, ar: u.nameAr ?? '' },
        shortName: u.shortName ?? u.slug.toUpperCase(),
        icon: u.icon ?? '🎓',
        website: u.website ?? '',
        // The University Elective pool used by the course popup when a
        // generic "uni-elective-N" placeholder is tapped.
        electivePool: u.electivePool ?? [],
      },
    ])
  );
}

function shapeColleges(universities) {
  return Object.fromEntries(
    universities.flatMap((u) =>
      u.colleges.map((c) => [
        c.slug,
        { university: u.slug, icon: c.icon ?? '🎓', name: { en: c.name, ar: c.nameAr ?? '' } },
      ])
    )
  );
}
