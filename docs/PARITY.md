# Parity checklist — old `app/plan.html` → current `web/`

**Status: parity reached.** The frontend *is* the original app — all 29 feature
modules, the same CSS, the same renderer — split into `web/index.html` +
`web/css/app.css` + 39 files under `web/js/`, and fed from `web/plans.json`
(built from `data/` by `tools/build-catalogue.py`) instead of from hardcoded
literals.

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
| 3 universities, 6 colleges | ✅ in `data/`, published to `web/plans.json` |
| 34 majors / 1,028 courses / 707 prerequisites | ✅ — was 4 majors / 239 courses |
| 14 full plans recovered from the old plans feed | ✅ `tools/import-legacy-feed.py` |
| 16 listing-only plans | ✅ |
| Plan icon / subtitle / bio / college | ✅ |
| Grading scales (dual AAUP scales) | ✅ served per plan |
| No hardcoded catalogue data in the client | ✅ `web/js/01-catalogue.js` is the only entry point |

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
| 1 | **`degreeHours` is `null` for all 34 majors** | The official totals come from the university PDFs. Null on purpose: `0` would read as "a degree requiring no hours" and quietly corrupt any progress percentage. Set it in `data/<university>/majors/<slug>.json`, then rebuild with `python3 tools/build-catalogue.py`. |
| 2 | **Deployed collector still uses the old path** | The repo's `collector/cloudflare-worker.js` now commits into `data/collected/`, but the Worker running on Cloudflare carries the old code until this file is pasted in again. |
| 3 | Verify every plan against the official university PDFs | The data was migrated faithfully, but faithfulness to the *old app* is not correctness — the source of truth is the PDFs. |
| 4 | Accounts / cross-device progress sync | Progress is per-device `localStorage`. A future account system is a new build, not a revival of the retired server. |
| 5 | Google Play / TWA packaging | Old docs were removed with `app/`. The PWA itself (manifest, service worker, icons) is intact and installable. |

## Operational notes

- **Fully offline after first visit.** The service worker precaches the shell
  and the whole catalogue (`web/plans.json`), so only the very first visit
  needs a connection. The only online feature is Contribute.
- **Publishing data changes**: edit `data/`, run `python3
  tools/build-catalogue.py`, commit both. The Pages workflow deploys `web/` on
  every push to `main`.
