import * as service from './major.service.js';

export async function get(req, res) {
  res.json({ data: await service.getMajor(req.params.id) });
}
export async function courses(req, res) {
  res.json({ data: await service.listCourses(req.params.id) });
}
export async function byUniversity(req, res) {
  res.json({ data: await service.listByUniversitySlug(req.params.slug) });
}
