# Parity checklist — old `app/plan.html` → new `web/` + `server/`

This is the **complete** inventory of what the old app did, derived by reading
every module banner and public API in `app/plan.html` at commit `5635067`
(the last commit that touched it) — not from memory.

It exists because the first migration claimed "feature parity" after porting
five features, when the old app had 29 feature modules. That claim was wrong.
Nothing gets marked done here without being checked against the old file.

**Recovering anything:** the whole old app is in git.
`git show 5635067:app/plan.html` and `git show 5635067:app/plans/index.json`.

Status: ✅ done · 🟡 partial (works but reduced) · ❌ missing · ⛔ intentionally dropped

---

## 1. Data (the most urgent gap)

| # | Item | Status | Notes |
|---|---|---|---|
| 1.1 | 3 universities | ✅ | AAUP, Birzeit, AASU seeded |
| 1.2 | 4 built-in AAUP majors (239 courses) | ✅ | robotics, cybersecurity, medical, cs |
| 1.3 | **Colleges registry (University → College → Plan)** | ✅ | `College` model added; 6 colleges seeded |
| 1.4 | **14 full plans from the plans feed (789 courses)** | ✅ | Pharmacy 86, Nursing 65, Financial Engineering 62, Finance & Data Science 59, Computer Networks 56, CS/Cyber Security/Multimedia/Statistics & DS 54 each, AI & Innovation 51, Robotics & Mechatronics (AASU) 50, GIS 50, AI & FinTech 50, Cyber Security (Birzeit) 44 |
| 1.5 | **16 listing-only plans (no course data)** | ✅ | Seeded as majors with zero courses, exactly as the old app carried them |
| 1.6 | Plan icon, subtitle, bio, college per plan | ✅ | Schema fields added and seeded |
| 1.7 | `degreeHours` per major | 🟡 | Now `null` ("not yet known") instead of a misleading `0`; the real totals still come from the official PDFs |

The extractor only ever read the 4 majors hardcoded in `plan.html`. It never
looked at `app/plans/index.json`, which is where the other 30 plans lived.
Recovered by `tools/import-legacy-feed.py`, which reads the feed straight out
of git. **Database now holds 3 universities, 6 colleges, 34 majors, 1,028
courses, 707 prerequisites** (was 4 majors / 239 courses).

`server/tests/verify-legacy-data.js` is the guard against this recurring: it
walks the legacy feed and *demands* every plan be present, so an omission
fails loudly instead of passing quietly. 6,668 assertions.

## 2. Study-plan view

| # | Item | Status |
|---|---|---|
| 2.1 | Course grid by year/semester | ✅ |
| 2.2 | Category colours | ✅ |
| 2.3 | **Prerequisite arrows drawn between courses** | ❌ |
| 2.4 | **Hover / press-and-hold to trace a prerequisite chain** | ❌ |
| 2.5 | **Course info modal (popup with full details)** | ❌ |
| 2.6 | **Lecture+lab pair groups (dashed box)** | ❌ |
| 2.7 | Pair mode toggle ("connect" button per pair) | ❌ |
| 2.8 | **Course search + course index** | ❌ |
| 2.9 | Category legend | ❌ |
| 2.10 | Mobile collapsible legend | ❌ |
| 2.11 | Collapse finished years | ❌ |
| 2.12 | Per-semester workload summary | ❌ |
| 2.13 | Removed courses (drop a course from your own plan) | ❌ |
| 2.14 | Course retakes (F auto-schedules a retake) | ❌ |

## 3. Progress & GPA

| # | Item | Status |
|---|---|---|
| 3.1 | Completion tracking (localStorage) | ✅ |
| 3.2 | Prerequisite cascade / availability | ✅ |
| 3.3 | Credit-hour + elective math | 🟡 elective-pool rules simplified |
| 3.4 | GPA engine (scale-driven) | ✅ |
| 3.5 | Assessment marks breakdown | ✅ |
| 3.6 | **My Progress panel** | ❌ |
| 3.7 | **"What Can I Take Next" chips** | 🟡 count only, no chips |
| 3.8 | Numeric grade table + per-course pass-mark toggle | ❌ |
| 3.9 | **Degree audit** | ❌ |

## 4. Screens & navigation

| # | Item | Status |
|---|---|---|
| 4.1 | **Home: University → College → Plan drill-down** | ❌ flat University → Major |
| 4.2 | **Dashboard** (progress, GPA, achievements, what's next) | ❌ |
| 4.3 | **App sidebar** (persistent nav) | ❌ |
| 4.4 | **Plan overview & print / PDF view** | ❌ |
| 4.5 | "Continue where you left off" | ❌ |
| 4.6 | Onboarding tours (Home, Dashboard, Study Plan) | ❌ |

## 5. Personal data & settings

| # | Item | Status |
|---|---|---|
| 5.1 | Student information | ❌ |
| 5.2 | Notes per course | ❌ |
| 5.3 | Difficulty & workload ratings | ❌ |
| 5.4 | Data export / import / reset | ❌ |
| 5.5 | **Theme (dark / light)** | ❌ dark only |
| 5.6 | **Accounts (multiple student profiles on one device)** | ❌ |
| 5.7 | Leftover-data rescue after a plan update (orphans) | ❌ |
| 5.8 | Personalization (welcome messages) | ❌ |

## 6. Achievements & delight

| # | Item | Status |
|---|---|---|
| 6.1 | Achievement rules + progress hints | ✅ |
| 6.2 | **Confetti on semester/year completion** | ❌ |
| 6.3 | **Shareable achievement card (image)** | ❌ |

## 7. Editing

| # | Item | Status |
|---|---|---|
| 7.1 | Move a course between semesters | 🟡 dropdown, old was drag-and-drop |
| 7.2 | Prerequisite-validated moves + retake sync | ✅ |
| 7.3 | Add/remove years and summer semesters | ✅ |
| 7.4 | Prerequisite line editor | ✅ |
| 7.5 | Undo last move | ❌ |
| 7.6 | Create a new plan (shell) | ❌ |
| 7.7 | Developer mode (hidden unlock) | ❌ |

## 8. Bilingual

| # | Item | Status |
|---|---|---|
| 8.1 | EN/AR interface strings | ✅ |
| 8.2 | RTL layout | ✅ |
| 8.3 | Bilingual course/major names | ✅ |
| 8.4 | Arabic across every screen not yet rebuilt | ❌ blocked on those screens |

## 9. Community & distribution

| # | Item | Status |
|---|---|---|
| 9.1 | Community data (anonymous aggregated course feedback) | ❌ |
| 9.2 | Share feedback (mailto) | ❌ |
| 9.3 | Imported plans (student-built, local) | ❌ |
| 9.4 | Online plan sync from a static feed | ⛔ replaced by the API |
| 9.5 | Auto-collect to GitHub | ⛔ replaced by the planned import system |
| 9.6 | PWA install (manifest + service worker + icons) | ✅ |
| 9.7 | Google Play / TWA packaging | ❌ docs removed with `app/` |

---

## Tally

**Resolved by restoring the app itself.**

Sections 2–9 below were written when `web/` was a from-scratch rewrite that
reimplemented five features. That approach was wrong: it could never reach
"100% like the old app", because it was a different app.

`web/index.html` is now the original `plan.html` — every module, every style,
every interaction — with only its *data source* replaced. The hardcoded course
tables, the four static plan pages, and the four near-identical drawing blocks
(3,204 lines in total) are gone; the catalogue arrives from `GET /api/feed` in
the exact shape the app's own generic renderer already consumed, which is how
the 30 published plans always rendered. Everything else is untouched.

So every ❌ in sections 2–9 that describes a feature of the old app is now
present, because it is literally the same code: prerequisite arrows, course
modal, pair groups, search, dashboard, sidebar, degree audit, theme, accounts,
notes, ratings, export/import, overview/print, confetti, tours, drag-and-drop
editing, the lot.

What genuinely remains:

| Item | Status | Notes |
|---|---|---|
| `degreeHours` per major | 🟡 | `null` until you read the real totals off the official PDFs |
| Online sync from a static feed | ⛔ | replaced by the API — same module, database behind it |
| Auto-collect to GitHub | ⛔ | replaced by the planned import system |
| Google Play / TWA packaging | ❌ | docs removed with `app/`; rebuild when you want to publish |
| Student-created local plans | 🟡 | still work and are never overwritten by the feed; a proper authenticated import flow is the roadmap item |

## Order of work

1. ~~**Data**~~ — ✅ done. All 30 feed plans recovered, colleges modelled,
   1,028 courses seeded and verified by assertion in both directions.
2. **Core plan view** — prerequisite arrows, course modal, pair groups,
   search, legend. This is the app's signature screen.
3. **Navigation** — Home drill-down, dashboard, sidebar, overview/print.
4. **Personal data** — theme, accounts, notes, ratings, export/import.
5. **Delight** — confetti, shareable cards, tours.
