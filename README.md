<div align="center">

# 🎓 StudyPlan · خطتي الدراسية

**By students, for students — plan your degree, track your progress.**
**من الطلاب، إلى الطلاب — خطّط لدرجتك وتابع تقدّمك.**

Pick your university → college → study plan, then track every course,
prerequisite, and your GPA — in English or Arabic, on any phone.

### ▶️ **[Open the app](https://jo0dile.github.io/MyMenuPack/)**

</div>

---

## ✨ What it does

- **University → College → Plan** — browse each university's colleges and
  their full course maps.
- **Track your progress** — check off completed courses; your credit-hour
  progress and GPA update automatically.
- **See prerequisites at a glance** — every course shows what it needs and
  what it unlocks, honoring real AND/OR requirement groups (not a flattened
  guess).
- **GPA and assessment-marks breakdown** — driven by each university's own
  grading scale, not a hardcoded curve.
- **Achievements** — derived from whatever plan is actually loaded, so a
  newly added university gets a working set automatically.
- **Bilingual** — the whole interface flips between English and Arabic, with
  full right-to-left layout.
- **Edit mode** — fix a wrong prerequisite line or add a year/summer semester
  yourself; corrections are kept on your device and layered on top of the
  published plan, so they are always yours and always reversible.

> ⚠️ **Unofficial student project — not affiliated with or endorsed by any
> university. Always confirm your plan with your academic advisor.**
> مشروع طلابي غير رسمي — تأكد دائمًا من خطتك مع مرشدك الأكاديمي.

---

## 🏗️ How it's built

```
StudyPlan/
├── web/        — the app itself. Open index.html and it runs: no build
│                 step, no framework, no server.
│   └── plans.json  — every university, college, and study plan, in one file
├── data/       — where plans are authored and reviewed, one file per major
└── tools/      — build-catalogue.py turns data/ into web/plans.json
```

**It works completely offline.** The app, its styles, all its modules, and the
entire study-plan catalogue are cached on your device the first time you open
it — after that it opens with no connection at all. Your progress, grades, and
notes are saved in `localStorage` and never leave your phone.

The only thing that ever goes online is **📨 Contribute**, if you choose to
share a study plan you built. Even then only the *plan* is sent — its courses,
years, and prerequisites — never your name, student ID, GPA, or grades.

---

## ➕ Adding or fixing a study plan

Plans are authored under `data/<university>/majors/<major>.json`, then built
into the single file the app reads:

```bash
python3 tools/build-catalogue.py    # writes web/plans.json
```

Commit both the `data/` change and the regenerated `web/plans.json`. That's the
whole process — there's no database to run and no server to deploy.

---

## 🗺️ Roadmap

- [x] University → College → Plan browsing, 34 plans across 3 universities
- [x] Prerequisite graph, GPA engine, assessment breakdown, achievements
- [x] Full Arabic interface with right-to-left layout
- [x] Works offline; installable as an app
- [ ] Verify every plan against the official university PDFs
- [ ] Confirm official degree credit totals
- [ ] Accounts, so progress can follow a student across devices

---

## 📄 License

Copyright © 2026 **JO0Dile**. All Rights Reserved. See [LICENSE](LICENSE).
