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

Two modules have been added since parity was reached — the built-in assistant
and the Fix panel. They are new features, not restorations, and are listed
separately below so this file keeps meaning what it says.

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

## Added after parity (not part of the old app)

| Module | Files | Notes |
|---|---|---|
| `ASSISTANT_KB` / `ASSISTANT` / `ASSISTANT_UI` | `web/js/41-…`, `42-…`, `43-…` | Offline, deterministic assistant + Guided Mode. No API, no key, no network — it answers only from the knowledge base and live page state, so it cannot fabricate a prerequisite. Also the permanent fallback for the module below. |
| `ASSISTANT_AI` | `web/js/46-assistant-ai.js`, `ai/cloudflare-worker.js` | The online brain: a real model, grounded in the app's own data, able to navigate and run walkthroughs. Opt-in, free-tier only, and its two editing tools can only *propose* — proposals are built by `42-…` so they carry the same prerequisite warnings. |
| `FIX_ANALYZERS` / `FIX` | `web/js/44-…`, `45-…` | Ten analyzers; repairs saved data and the offline cache, reports everything else. Backup + undo + history on every repair. |
| Diagnostics recorder | `web/js/00-diagnostics.js` | Loaded first, before every other script, so it is listening when a module fails on the way in. |
| `ICONS` | `web/js/04-icons.js` | The mark shown for a university, a faculty or a major. Three layers tried in order — an uploaded PNG, one of 24 built-in line icons, then the emoji the app always used — so every layer is optional and nothing that predates it breaks. |
| `ADMIN` | `web/js/48-admin.js`, `admin/cloudflare-worker.js` | Edits the published catalogue. The dashboard is a client, not an authority: the password is verified server-side, every mutating request re-checks a signed token, and every payload is re-validated against the schema before it becomes a commit in `data/`. |

The old `ADVISOR` module is untouched and still does its own job (a
prerequisite-graph-driven next-semester plan). The assistant answers questions;
it does not replace the advisor.

`SYNC` gained a behaviour rather than a module. It always refused to overwrite a
plan a student had edited — but it did so silently, with a toast counting how
many it had skipped, which is not a decision anyone got to make. It now diffs the
two versions and asks: a dialog listing every course added, removed, moved or
re-credited and every prerequisite changed, with **Apply** and **Keep**. A
declined version is remembered so the same question is never asked twice.
Presentation (icons, logos, blurbs) is not student-editable, so it still
refreshes with no prompt.

## Data

| Item | Status |
|---|---|
| 1 published university (AAUP), 4 colleges | ✅ Birzeit and Al-Salem stay in `data/` with `"published": false` — authored and version-controlled, deliberately not shipped |
| 23 published majors / 934 courses / 645 prerequisites | ✅ 11 more majors sit unpublished in `data/` |
| 14 full plans recovered from the old plans feed | ✅ `tools/import-legacy-feed.py` |
| 16 listing-only plans | ✅ |
| Plan icon / subtitle / bio / college | ✅ |
| Grading scales (dual AAUP scales) | ✅ served per plan |
| No hardcoded catalogue data in the client | ✅ `web/js/01-catalogue.js` is the only entry point |
| Per-major icons | ✅ 21 distinct icons across 23 plans; was 5 sharing a generic 🎓 and 4 with none |
| University logo field | ✅ `logoUrl` flows `data/` → `plans.json` → render, uploadable from Admin → Assets |

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
| 2b | **Admin Worker is not deployed yet** | `admin/cloudflare-worker.js` exists and is verified against a mock of its own contract, but until it is pasted into Cloudflare with its four secrets, Admin Mode signs in nowhere. Setup: `admin/README.md`. |
| 2c | **AAUP's official logo is not in the repo** | The field, the pipeline and the uploader are all in place; the image itself is not, because it has to come from the university's own site. Upload it in Admin → Assets and paste the path into the university's logo field. |
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
- **Publishing a data change without a build**: Admin Mode commits to `data/`
  through its Worker and CI does the rebuild, so the two-step flow above is for
  editing files directly — not a second, competing source of truth. Both end in
  the same commit to the same files.
- **Adding a module under `web/js/`** now has three steps, not two: add the
  `<script>` tag to `index.html`, add the file to `CORE` in `web/sw.js`, and
  add its global to `REQUIRED_GLOBALS` in `web/js/44-fix-analyzers.js` if other
  code depends on it. Forgetting the second is silent — the app works until it
  is opened offline — which is why `tools/check-precache.py` runs in CI and the
  Fix panel performs the same comparison at runtime.
