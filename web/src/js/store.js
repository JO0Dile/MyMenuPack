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

  // The full record per course, which computeGpa/earnedCredits consume.
  records: () => new Map(Object.entries(read())),

  setGrade(courseId, grade) {
    const m = read();
    // A grade only exists for a course the student has marked done, so
    // recording one implies completion rather than requiring two clicks.
    if (!m[courseId]) m[courseId] = { completedAt: new Date().toISOString() };
    if (grade) m[courseId].grade = grade;
    else delete m[courseId].grade;
    write(m);
  },

  // Assessment rows per course: [{label, score, max}]. Kept beside the grade
  // rather than inside it because they are the student's own working, not an
  // official mark, and survive independently of whatever letter is recorded.
  rowsFor(courseId) {
    return read()[courseId]?.assessment || [];
  },
  setRows(courseId, rows) {
    const m = read();
    if (!m[courseId]) m[courseId] = { completedAt: new Date().toISOString() };
    if (rows && rows.length) m[courseId].assessment = rows;
    else delete m[courseId].assessment;
    write(m);
  },

  clear: () => write({}),
};
