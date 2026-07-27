import * as service from './university.service.js';

// Controllers do HTTP and nothing else: read input, call a service, send JSON.
export async function list(req, res) {
  res.json({ data: await service.listUniversities() });
}

export async function getBySlug(req, res) {
  res.json({ data: await service.getUniversityBySlug(req.params.slug) });
}
