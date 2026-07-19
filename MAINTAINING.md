# 🛠️ Maintainer's guide — running the plans database

This is for **you** (the owner). It explains, in plain steps, how the study
plans get into the app, how to add a new one a student sent you, and how to
update one that's already there. No coding background needed — you're editing
one text file.

If you ever want the exact technical field list, it's in
[`app/plans/README.md`](app/plans/README.md). This guide is the friendly
walkthrough that sits on top of it.

---

## The one-minute mental model

- Every installed copy of the app quietly checks **one file** for new or
  updated plans: **`app/plans/index.json`**.
- That file is just a list of plans. Add a plan to the list → it shows up in
  everyone's app. Bump a plan's `version` number → everyone's app updates its
  copy.
- There is **no server and no database software**. The "database" is literally
  this one JSON file living in the repo. That's the whole system, on purpose —
  nothing to host, nothing that can go down.
- **Nothing personal is ever collected.** Students' progress, GPA, grades, and
  notes stay on their own phones. A submission only ever contains the *plan*:
  its courses, years, and prerequisites.

---

## Two ways plans reach you

1. **Automatic collection (recommended).** With auto-collect turned on, every
   plan/college/course a student builds is saved into `app/plans/collected/`
   in this repo on its own — no submit button. You review those files and
   promote the good ones to the live feed. Full setup:
   [COLLECTING.md](COLLECTING.md). Publishing a collected plan is the same
   copy-into-`index.json` step described below — just copy the inner `plan`
   object out of its `collected/<id>.json` file.
2. **Manual submission.** A student taps **📨 Contribute**, gets a `.json`
   file, and sends it to you (or opens a pre-filled GitHub issue). Same
   destination — you copy it into `index.json`.

Either way, **nothing goes live until you copy it into `index.json`.** That's
deliberate: collected plans sit in a holding area so junk or abusive
submissions never auto-appear for real students.

## Part 1 — A plan reached you (collected or sent). How do I publish it?

Whether it arrived automatically in `app/plans/collected/<id>.json` or a
student sent you a `.json` file, publishing it is the same: copy its plan into
`app/plans/index.json`.

### Step 1 — Open the submission and give it a quick read

Open the `.json` file they sent. You should see their major name, a list of
courses, and prerequisites. Sanity-check it like you would any message from a
stranger: does it look like a real plan, not junk or spam? The app already
strips anything dangerous automatically, so the worst a bad submission can do
is look wrong — but a human glance still saves you from publishing nonsense.

### Step 2 — Open `app/plans/index.json`

That's the list. It looks like this (trimmed):

```json
{
  "updatedAt": "2026-07-19T00:00:00Z",
  "plans": [
    { ...one plan... },
    { ...another plan... }
  ]
}
```

You're going to add the student's plan as one more `{ ... }` block inside the
`"plans": [ ... ]` list.

### Step 3 — Paste the plan in, using this template

Copy this, fill in the real values, and drop it into the `plans` list (put a
comma after the previous plan's closing `}`):

```json
{
  "id": "hearing-speech",
  "version": 1,
  "majorName": {
    "en": { "big": "Hearing and Speech", "small": "Speech-Language Disorders" },
    "ar": { "big": "السمع والنطق", "small": "اضطرابات النطق واللغة" }
  },
  "icon": "🦻",
  "university": "aaup",
  "college": { "en": "Faculty of Allied Medical Sciences", "ar": "كلية العلوم الطبية المساندة" },
  "bio": {
    "en": "One or two sentences describing the program.",
    "ar": "جملة أو جملتان تصفان البرنامج."
  },
  "structure": {
    "years": [
      { "id": "y1", "hasSummer": true },
      { "id": "y2", "hasSummer": false }
    ]
  },
  "courses": [
    { "id": "intro-audiology", "name": "Introduction to Audiology", "ar": "مقدمة في السمعيات", "creditHours": 3, "category": "core", "yearId": "y1", "semester": "s1" },
    { "id": "anatomy",         "name": "Anatomy",                    "ar": "التشريح",           "creditHours": 3, "category": "core", "yearId": "y1", "semester": "s2" },
    { "id": "field-training",  "name": "Field Training",             "ar": "تدريب ميداني",      "creditHours": 2, "category": "core", "yearId": "y1", "semester": "summer" }
  ],
  "prerequisites": [
    ["intro-audiology", "anatomy"]
  ]
}
```

**The rules that matter (read once, then it's easy):**

| Field | What to put |
|---|---|
| `id` | A unique short nickname for the plan (letters and dashes). It's permanent — don't reuse another plan's id. |
| `version` | Start at `1` for a brand-new plan. |
| `icon` | Any single emoji. |
| `university` | `aaup` (the only one right now). |
| `structure.years` | One entry per academic year. `hasSummer: true` if that year has a summer semester. |
| each course `id` | Unique **within that plan** (letters and dashes). |
| `category` | One of: `skills`, `core`, `math`, `dept`, `eng`, `uni`, `free`. |
| `semester` | One of: `s1`, `s2`, `summer`. (Yes, literally the word `summer` for the summer term.) |
| `yearId` | Must match one of the `id`s in `structure.years` (`y1`, `y2`, …). |
| `prerequisites` | A list of `["must-take-first", "then-this"]` pairs, using course ids. |

> **English course + its lab:** if a course has a lab that's taken *with* it but
> gets its **own grade**, give the lab its own course entry (same year and
> semester) with its own `id`. They'll each hold a separate grade in the app.

### Step 4 — Update the date at the top

Change `"updatedAt"` to today's date so it's clear when the feed last changed.
The format is `YYYY-MM-DDT00:00:00Z`, e.g. `"2026-08-01T00:00:00Z"`.

### Step 5 — Save, commit, and push

Commit the change to `app/plans/index.json` and push. Since the site is on
GitHub Pages, within a minute or two every app will pick up the new plan the
next time it checks for updates. **The student does not need to do anything or
resubmit** — it just appears.

### Step 6 — Check it worked

Open the app, go to the university → college, and confirm the new plan shows up
with the right courses (including any summer ones). If a course is missing,
99% of the time it's a typo in `category`, `semester`, or `yearId` — check
those against the rules table above.

---

## Part 2 — Updating a plan that's already in the feed

Say a plan changed (a course moved, credit hours fixed, a new "what to do next"
note).

1. Find that plan's block in `app/plans/index.json`.
2. Make your edits to its courses / prerequisites.
3. **Increase its `version` number by 1** (e.g. `1` → `2`). This is the switch
   that tells every app "there's a newer copy, replace mine."
4. Update `updatedAt`, save, commit, push.

**Important, and by design:** if a student edited that plan themselves inside
the app, *their* version is kept and your update won't overwrite their personal
copy. Their edits always win. New students who never touched it get your
updated version.

---

## Part 3 — First-time checklist (do this once)

There's a clearly-labeled **example plan** already in `app/plans/index.json`
(its id is `example-demo-plan`, icon 🧪, named "Example Program — demo — safe
to delete"). It's there so you can see exactly what a real entry looks like and
watch it appear in the app.

**Once you've seen it show up in the app and you're comfortable with the
format, delete that whole `example-demo-plan` block** so real students don't
see a fake program in their list. Deleting it is the same as any edit: remove
the block, fix the comma, update `updatedAt`, commit, push.

---

## If something looks broken

- **A plan won't appear at all:** the JSON probably has a syntax error (a
  missing comma or bracket). Paste the whole file into any free "JSON
  validator" website — it'll point to the line.
- **A plan appears but a course is missing:** typo in that course's
  `category`, `semester`, or `yearId`. Check the rules table in Part 1.
- **Everyone's still seeing the old version:** they'll pick it up on the next
  update check (startup, or Settings → 🔄 Check for updates). Give it a minute.

That's the whole system. One file, one list, one `version` number per plan.
