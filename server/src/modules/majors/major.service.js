import prisma from '../../lib/prisma.js';
import AppError from '../../lib/AppError.js';

// Prerequisites are returned in the GROUP shape the schema stores, not
// flattened to pairs. Flattening would silently turn an OR ("one of X or Y")
// into an AND, which is the single most damaging thing this API could get
// wrong — a student would be told they're blocked when they aren't.
function shapeCourse(c) {
  return {
    id: c.id,
    slug: c.slug,
    code: c.code,
    name: c.name,
    nameAr: c.nameAr,
    credits: Number(c.credits),
    year: c.year,
    semester: c.semester,
    category: c.category,
    isElective: c.isElective,
    prerequisites: (c.prerequisiteGroups ?? []).map((g) => ({
      kind: g.kind,
      label: g.label,
      // Any one of these satisfies the group; every group must be satisfied.
      anyOf: g.options.map((o) => ({
        id: o.requiredCourse.id,
        slug: o.requiredCourse.slug,
        code: o.requiredCourse.code,
        name: o.requiredCourse.name,
      })),
    })),
  };
}

export async function getMajor(id) {
  const major = await prisma.major.findUnique({
    where: { id },
    include: {
      university: { select: { id: true, slug: true, name: true } },
      gradingScale: { select: { id: true, name: true, passMark: true, bands: true } },
      _count: { select: { courses: true } },
    },
  });
  if (!major) throw AppError.notFound(`No major with id "${id}"`);
  return major;
}

export async function listCourses(majorId) {
  const major = await prisma.major.findUnique({ where: { id: majorId }, select: { id: true } });
  if (!major) throw AppError.notFound(`No major with id "${majorId}"`);

  const courses = await prisma.course.findMany({
    where: { majorId },
    orderBy: [{ year: 'asc' }, { semester: 'asc' }, { name: 'asc' }],
    include: {
      prerequisiteGroups: {
        include: { options: { include: { requiredCourse: true } } },
      },
    },
  });
  return courses.map(shapeCourse);
}

export async function listByUniversitySlug(slug) {
  const uni = await prisma.university.findUnique({ where: { slug }, select: { id: true } });
  if (!uni) throw AppError.notFound(`No university with slug "${slug}"`);
  return prisma.major.findMany({
    where: { universityId: uni.id },
    orderBy: { name: 'asc' },
    select: {
      id: true, slug: true, name: true, nameAr: true,
      department: true, degreeHours: true,
      _count: { select: { courses: true } },
    },
  });
}
