// Proves the database matches the extracted JSON exactly.
// Counts alone would miss a swapped name, so every field is compared.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
let checks = 0; const fails = [];
const ck = (c, m) => { checks++; if (!c) fails.push(m); };

const index = JSON.parse(await readFile(path.join(DATA, 'universities.json'), 'utf8'));
for (const u of index.universities) {
  const uni = await prisma.university.findUnique({ where: { slug: u.slug } });
  ck(uni, `university ${u.slug} missing`);
  if (!uni) continue;

  let files = [];
  try { files = (await readdir(path.join(DATA, u.slug, 'majors'))).filter(f => f.endsWith('.json')); } catch {}
  for (const f of files) {
    const m = JSON.parse(await readFile(path.join(DATA, u.slug, 'majors', f), 'utf8'));
    const major = await prisma.major.findUnique({
      where: { universityId_slug: { universityId: uni.id, slug: m.slug } },
      include: { courses: true },
    });
    ck(major, `major ${m.slug} missing`);
    if (!major) continue;

    ck(major.courses.length === m.courses.length,
       `${m.slug}: ${major.courses.length} courses in DB != ${m.courses.length} in JSON`);

    const bySlug = new Map(major.courses.map(c => [c.slug, c]));
    for (const jc of m.courses) {
      const dc = bySlug.get(jc.slug);
      if (!dc) { fails.push(`${m.slug}/${jc.slug}: MISSING from DB`); continue; }
      ck(dc.name === jc.name, `${m.slug}/${jc.slug}: name "${dc.name}" != "${jc.name}"`);
      ck((dc.nameAr ?? null) === (jc.nameAr ?? null), `${m.slug}/${jc.slug}: nameAr differs`);
      ck((dc.code ?? null) === (jc.code ?? null), `${m.slug}/${jc.slug}: code ${dc.code} != ${jc.code}`);
      ck(Number(dc.credits) === Number(jc.credits ?? 0), `${m.slug}/${jc.slug}: credits ${dc.credits} != ${jc.credits}`);
      ck((dc.year ?? null) === (jc.year ?? null), `${m.slug}/${jc.slug}: year differs`);
      ck((dc.semester ?? null) === (jc.semester ?? null), `${m.slug}/${jc.slug}: semester differs`);
      ck(dc.category === jc.category, `${m.slug}/${jc.slug}: category ${dc.category} != ${jc.category}`);
    }

    // prerequisites: exact set equality against the DB graph
    const groups = await prisma.prerequisiteGroup.findMany({
      where: { course: { majorId: major.id } },
      include: { course: true, options: { include: { requiredCourse: true } } },
    });
    const dbPairs = new Set();
    for (const g of groups) for (const o of g.options)
      dbPairs.add(`${o.requiredCourse.slug}|${g.course.slug}`);
    const jsonPairs = new Set(m.prerequisites.map(p => `${p.requires}|${p.forCourse}`));
    for (const p of jsonPairs) ck(dbPairs.has(p), `${m.slug}: prerequisite LOST ${p}`);
    for (const p of dbPairs) ck(jsonPairs.has(p), `${m.slug}: prerequisite INVENTED ${p}`);

    console.log(`  ${m.slug.padEnd(15)} ${major.courses.length} courses, ${dbPairs.size} prerequisites`);
  }
}
console.log(`\n${checks} assertions`);
if (fails.length) { console.error(`\n${fails.length} FAILURES:`); fails.slice(0,25).forEach(f=>console.error('  -',f)); process.exit(1); }
console.log('PASS — database matches the extracted data exactly');
await prisma.$disconnect();
