<div align="center">

# 🎓 StudyPlan · خطتي الدراسية

**By students, for students — plan your degree, track your progress.**
**من الطلاب، إلى الطلاب — خطّط لدرجتك وتابع تقدّمك.**

Pick your university → major, then track every course, prerequisite, and
your GPA — in English or Arabic, on any phone.

</div>

---

## ✨ What it does

- **University → Major → Plan** — browse each university's majors and their
  full course maps.
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
  official plan, never sent back to the shared database.

> ⚠️ **Unofficial student project — not affiliated with or endorsed by any
> university. Always confirm your plan with your academic advisor.**
> مشروع طلابي غير رسمي — تأكد دائمًا من خطتك مع مرشدك الأكاديمي.

---

## 🏗️ Architecture

```
StudyPlan/
├── web/       — the frontend. No hardcoded course/university data at all;
│                every screen fetches from the API at runtime.
├── server/    — REST API (Node/Express) + the Prisma schema/seed for
│                PostgreSQL, the single source of truth.
├── data/      — source JSON per university/major that seeds the database.
└── docs/      — screenshots and other reference material.
```

There used to be a single hardcoded `app/plan.html` with every course,
university, and prerequisite baked into the page. It's gone — everything it
knew is now in PostgreSQL, served through `server/`, and rendered by `web/`
with zero embedded data. See `server/README.md` for the API's design
decisions (why prerequisites are groups and not pairs, why grading scales
are data, why credits are `Decimal`, etc.).

**Your own progress still stays on your device.** Completion, grades, and
edit-mode corrections are saved in `localStorage` — nothing personal is
uploaded. Accounts and cross-device sync are planned next (see Roadmap).

---

## 🚀 Running it locally

You need a PostgreSQL database, the API, and a static file server for the
frontend.

```bash
# 1. API
cd server
npm install
cp .env.example .env      # fill in DATABASE_URL + generate the JWT secrets
                           # (see server/README.md)
npm run prisma:generate
npm run prisma:migrate
node prisma/seed.js       # loads everything under data/ into the database
npm run dev                # http://localhost:4010

# 2. Frontend, in another terminal
cd web
python3 -m http.server 8090   # any static server works
```

Open `http://localhost:8090`. It talks to the API at
`http://localhost:4010/api` by default (override with `window.__API_BASE__`
if you're hosting it elsewhere); `CORS_ORIGINS` in the API's `.env` must
list the frontend's origin.

## ➕ Adding or fixing a university's data

Edit or add the relevant JSON under `data/<university>/` (see the existing
entries for the shape), then re-run `node prisma/seed.js` from `server/` —
seeding is idempotent, so running it again just applies your changes. A
proper authenticated import flow for non-technical maintainers is on the
roadmap below; until then, this is the path.

---

## 🗺️ Roadmap

- [x] University, major, course, and prerequisite data in PostgreSQL —
      nothing hardcoded in the frontend
- [x] GPA engine, assessment breakdown, achievements, Arabic UI, edit mode
      ported to `web/`
- [x] Old hardcoded `app/` implementation removed
- [ ] Authentication (accounts, so progress isn't tied to one device)
- [ ] Progress sync (the offline-first `localStorage` cache already keys on
      the server's course id, specifically so this is a straight upsert)
- [ ] Developer/admin import system for adding universities without editing
      JSON by hand

---

## 📄 License

Copyright © 2026 **JO0Dile**. All Rights Reserved. See [LICENSE](LICENSE).
