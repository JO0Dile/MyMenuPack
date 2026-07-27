// Progress kept locally for now.
//
// This is a CACHE, not a source of truth: once the auth and progress endpoints
// exist it becomes the offline write queue that flushes to
// POST /api/me/progress/sync. Keying on the server's course id (not a local
// slug) is what makes that flush a straight upsert later with no migration.
const KEY = 'studyplan.progress.v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
function write(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode */ }
}

export const store = {
  isDone: (courseId) => !!read()[courseId],
  toggle(courseId) {
    const m = read();
    if (m[courseId]) delete m[courseId];
    else m[courseId] = { completedAt: new Date().toISOString() };
    write(m);
    return !!m[courseId];
  },
  completedIds: () => new Set(Object.keys(read())),
  clear: () => write({}),
};
