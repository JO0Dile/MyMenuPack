import prisma from '../../lib/prisma.js';
import AppError from '../../lib/AppError.js';

// Services return plain data and throw AppError. They never see req/res, which
// is what lets them be reused by the importer and a future recommender.

export async function listUniversities() {
  return prisma.university.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, slug: true, name: true, nameAr: true, country: true,
      logoUrl: true, website: true,
      _count: { select: { majors: true } },
    },
  });
}

export async function getUniversityBySlug(slug) {
  const uni = await prisma.university.findUnique({
    where: { slug },
    include: {
      majors: {
        orderBy: { name: 'asc' },
        select: {
          id: true, slug: true, name: true, nameAr: true,
          department: true, degreeHours: true,
          _count: { select: { courses: true } },
        },
      },
      gradingScales: {
        select: { id: true, name: true, passMark: true, bands: true },
      },
    },
  });
  if (!uni) throw AppError.notFound(`No university with slug "${slug}"`);
  return uni;
}
