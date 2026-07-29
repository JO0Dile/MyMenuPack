# StudyPlan API

Backend for the StudyPlan platform: universities, majors, courses,
prerequisites, student progress, and developer imports.

## Status

- [x] Database schema (`prisma/schema.prisma`)
- [x] Folder structure + bootable Express app
- [x] University + major + course read APIs (`web/` runs on these alone —
      no hardcoded plan data anywhere in the frontend)
- [ ] Authentication (register / login / refresh / roles)
- [ ] Import system (validate / apply, versioned)
- [ ] Progress + prerequisite write APIs (student-side edit-mode corrections
      currently live client-side only, in the plan-editor modules under `web/js/`, the same
      way the old `app/plan.html` kept them — this becomes a real sync
      endpoint once auth exists)

## Running it

```bash
npm install
cp .env.example .env      # then fill in — see below
npm run prisma:generate
npm run prisma:migrate    # needs a live Postgres
npm run dev
```

Generate the two JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`GET /health` answers without a database, so you can confirm the app boots
before Postgres is up.

## Design decisions worth knowing

**Prerequisites are groups, not pairs.** Courses inside a `PrerequisiteGroup`
are OR'd; the groups on a course are AND'd. "Needs A and B" is two
single-member groups. This exists because real plans contain both shapes, and
a flat `courseId -> requiredCourseId` table cannot express OR without
misrepresenting the curriculum.

**Corequisites are a `kind`, not a second table.** Lecture/lab pairs and other
متطلب متزامن rules are the same relationship with different timing.

**Grading scales are data.** AAUP alone runs two — Engineering passes D at 60,
the Faculty of AI & Data Science at 50. A scale belongs to a university, is
selected per major, and can be overridden per course.

**Credits and marks are `Decimal`, never `Float`.** GPA is the one number a
student checks against their own transcript; accumulated float error there is
not acceptable.

**`CourseCompletion` is unique on `(userId, courseId)`.** That is what makes
`POST /api/progress/sync` an idempotent upsert, so an offline client retrying a
dropped flush cannot double-apply.

**Config is validated at boot and the process exits if it's wrong.** A missing
JWT secret would otherwise become the string `"undefined"` and every token the
service issues would be forgeable.

**Controllers never touch Prisma; services never touch `req`/`res`.** That
boundary is what keeps the prerequisite engine unit-testable and reusable by a
future recommendation service.

## Frontend

`web/` is the data-driven client. It contains **no** university, major, course,
or prerequisite data — every item it renders is fetched from this API at
runtime, which is the point of the refactor: adding a university is a database
operation, never a code edit.

```bash
cd web && python3 -m http.server 8090   # any static server will do
```

It expects the API at `http://localhost:4010/api` (override with
`window.__API_BASE__`). `CORS_ORIGINS` in the server `.env` must list the
frontend's origin.

`web/js/` keeps completion state in localStorage. That is a cache,
not a source of truth — once the auth and progress endpoints exist it becomes
the offline write queue that flushes to `POST /api/me/progress/sync`. It keys
on the server's course id precisely so that flush needs no migration.
