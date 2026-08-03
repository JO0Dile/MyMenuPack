# Parity checklist — old `app/plan.html` → current `web/`

**Status: parity reached.** The frontend *is* the original app — all 29 feature
modules, the same CSS, the same renderer — split into `web/index.html` +
`web/css/app.css` + 39 files under `web/js/`, and fed from PostgreSQL through
`GET /api/feed` instead of from hardcoded literals.

This file exists because an earlier attempt rewrote the app from scratch,
claimed "feature parity" after porting five features, and shipped a version
missing ~70% of it plus 30 study plans. Nothing here gets ticked without being
checked against the old file, which is still in git:
`git show 5635067:app/plan.html`.

---

## Modules (all 29 present)

Verified by `grep -ho "window\.AAUP_[A-Z_]*" web/js/*.js | sort -u`:

`ACCOUNTS` · `ACHIEVEMENTS` · `ADVISOR` · `AUDIT` · `CELEBRATE` · `COLLECT` ·
`COMMUNITY` · `DASHBOARD` · `DATA` · `DEV` · `FEEDBACK` · `GPA` · `HOME` ·
`IMPORTED` · `LEGEND` · `LINKS` · `ORPHANS` · `OVERVIEW` · `PERSONAL` ·
`PLAN_EDITOR` · `REMOVED` · `RETAKES` · `SIDEBAR` · `STORAGE` · `STRUCTURE` ·
`STUDENT` · `SYNC` · `THEME` · `TUTORIAL`

That covers everything the old app did: the University → College → Plan
drill-down, dashboard, sidebar, prerequisite arrows and hover-trace, course
modal, lecture+lab pair groups, search, legend, collapse-finished-years,
workload summary, removed courses, retakes, GPA + assessment breakdown, degree
audit, notes and difficulty ratings, achievements, confetti and shareable
cards, AI advisor, developer mode, plan editor, overview/print, theme,
accounts, orphan rescue, export/import, tours.

## Data

| Item | Status |
|---|---|
| 3 universities, 6 colleges | ✅ in PostgreSQL |
| 34 majors / 1,028 courses / 707 prerequisites | ✅ — was 4 majors / 239 courses |
| 14 full plans recovered from the old plans feed | ✅ `tools/import-legacy-feed.py` |
| 16 listing-only plans | ✅ |
| Plan icon / subtitle / bio / college | ✅ |
| Grading scales (dual AAUP scales) | ✅ served per plan |
| No hardcoded catalogue data in the client | ✅ `web/js/09-catalogue-bootstrap.js` is the only entry point |

All 30 feed plans were verified present, field by field, by an assertion
suite before the server was retired (6,668 assertions walking the legacy feed
and demanding every plan be present — the completeness check whose absence
caused the original loss). The suite lived in `server/tests/` and left the
tree with it; `data/` is now the reviewed source and `tools/build-catalogue.py`
publishes it to `web/plans.json`.

---

## Genuinely outstanding

| # | Item | Notes |
|---|---|---|
| 1 | **`degreeHours` is `null` for all 34 majors** | The official totals come from the university PDFs. Nullable on purpose: `0` would read as "a degree requiring no hours" and quietly corrupt any progress percentage. Set it in `data/<university>/majors/<slug>.json`, then `cd server && node prisma/seed.js`. |
| 2 | **Contribute / auto-collect is stale** | `APP_COLLECT_URL` in `web/js/01-universities-registry.js` still points at the Cloudflare Worker, but `collector/` was deleted and that Worker commits to `app/plans/collected/`, which no longer exists. Either re-point it at a real import endpoint or turn it off — today it fails silently. |
| 3 | Authentication | Schema ready (`User`, `RefreshToken`). Not built. |
| 4 | Progress sync | Schema ready (`CourseCompletion`, unique on `(userId, courseId)` so a retried flush can't double-apply). Progress is still per-device localStorage. |
| 5 | Developer/admin import system | Schema ready (`ImportBatch`). Adding a university is currently: edit `data/`, re-seed. |
| 6 | Google Play / TWA packaging | Docs were removed with `app/`. The PWA itself (manifest, service worker, icons) is intact and installable. |
| 7 | Offline first-load | The shell caches on demand rather than up front, so a *first* visit needs the network. After that, plans persist in localStorage and the app opens offline. |

## Known operational limits

- **Free Render tier sleeps after 15 min idle**, so the first visit after a
  quiet spell takes ~30–60s. The home screen now says so instead of showing an
  empty grid. Removed by any paid tier, no code change.
- **Seeding only runs when `data/` changes** (`SeedState` fingerprint). It used
  to run on every deploy, which rewrote the database underneath the still-live
  previous container and produced 500s plus half-seeded counts.
