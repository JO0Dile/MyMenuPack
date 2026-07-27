import { getFeed, getRegistry } from './feed.service.js';

// Deliberately NOT wrapped in { data: ... } like the other endpoints: this is
// consumed directly by the app's own plan-sync module, which reads
// `feed.plans`. Serving the shape it already speaks means that module works
// untouched, with the database behind it instead of a static file.
export async function feed(req, res) {
  res.json(await getFeed());
}

export async function registry(req, res) {
  res.json(await getRegistry());
}
