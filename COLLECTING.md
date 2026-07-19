# 📥 Auto-collecting plans into GitHub

This sets up the app so that **every college, plan, and course a student
creates is saved into your GitHub repo automatically** — no "submit" button,
no student effort. You review what comes in and promote the good ones to the
live feed.

> **Read this first — the one hard rule.**
> A GitHub Pages site is only static files; the app in the browser **cannot
> write to your repo by itself.** Writing to GitHub needs a token with write
> access. That token must **never** go inside `plan.html` — anyone could open
> the page, read it, and wipe your repo, and GitHub auto-revokes tokens it
> finds in public code anyway. So the app POSTs each plan to a tiny
> **collector** that holds the token privately and does the commit. Setting up
> that collector once is the only piece only you can do.

---

## How it works (the whole picture)

```
Student creates a plan/college/course in the app
        │  (plan structure only — never name, ID, GPA, grades)
        ▼
App quietly POSTs it to your Collector URL   ← APP_COLLECT_URL in plan.html
        │
        ▼
Collector (holds your GitHub token privately)
        │  commits the plan as a file
        ▼
app/plans/collected/<plan-id>.json   ← you review these
        │  you copy the good ones into…
        ▼
app/plans/index.json                 ← the LIVE feed every app reads
```

**Two tiers, on purpose.** Auto-collected plans land in `app/plans/collected/`
— a holding area only you look at. They do **not** appear in students' apps.
You review them and copy the good ones into `app/plans/index.json` (the live
feed) using [MAINTAINING.md](MAINTAINING.md). This keeps junk or abusive
submissions from ever auto-appearing for real students.

**Privacy.** The app sends the same plan-only bundle the manual Contribute
button builds: `majorName`, `icon`, `bio`, `structure`, `courses`,
`prerequisites`, `college`. Never progress, GPA, grades, notes, name, or ID.

---

## Setup — a free Cloudflare Worker (recommended, ~5–10 min, no credit card)

Cloudflare Workers are free, always-on (no cold starts), and can commit to
GitHub with a token that stays server-side.

### Step 1 — Make a GitHub token that can only touch this one repo

1. GitHub → **Settings → Developer settings → Fine-grained personal access
   tokens → Generate new token**.
2. **Repository access → Only select repositories →** pick `MyMenuPack`.
3. **Permissions → Repository permissions → Contents → Read and write.**
   (That's the only permission it needs.)
4. Generate it and **copy the token** — you'll paste it into the Worker's
   secrets in Step 3. Never paste it into any file in the repo.

### Step 2 — Create the Worker

1. Go to **dash.cloudflare.com** → sign up (free) → **Workers & Pages →
   Create → Create Worker**. Give it a name like `plan-collector`, deploy the
   default, then click **Edit code**.
2. Delete the sample code and paste in the entire contents of
   [`collector/cloudflare-worker.js`](collector/cloudflare-worker.js) from
   this repo.
3. Click **Deploy**. Copy the Worker's URL (looks like
   `https://plan-collector.YOURNAME.workers.dev`).

### Step 3 — Give the Worker its secrets

In the Worker's **Settings → Variables and Secrets**, add these (use
**Encrypt** / "Secret" for the token and the collect secret):

| Name | Value |
|---|---|
| `GITHUB_TOKEN` | the fine-grained token from Step 1 (Secret) |
| `REPO_OWNER` | `JO0Dile` |
| `REPO_NAME` | `MyMenuPack` |
| `REPO_BRANCH` | `main` |
| `COLLECT_SECRET` | any word you make up, e.g. `myplans2026` (Secret) — optional but recommended |

Redeploy after adding them.

### Step 4 — Point the app at the Worker

In `app/plan.html`, near the top config block, set:

```js
window.APP_COLLECT_URL = 'https://plan-collector.YOURNAME.workers.dev';
window.APP_COLLECT_SECRET = 'myplans2026'; // must match COLLECT_SECRET above
```

Commit and push. That's it — the app now auto-collects.

### Step 5 — Test it

Open the app, create a new plan with a course or two, wait a few seconds, then
check `app/plans/collected/` in your repo. A file named after your plan's id
should appear. 🎉 (You can delete that test file.)

---

## What you'll see in `collected/`

Each collected plan is one file, `app/plans/collected/<id>.json`, shaped like:

```json
{
  "id": "fine-arts",
  "plan": {
    "majorName": { "en": { "big": "Fine Arts", "small": "" }, "ar": { "big": "الفنون الجميلة", "small": "" } },
    "icon": "🎨",
    "college": { "en": "Faculty of Fine Arts", "ar": "كلية الفنون الجميلة" },
    "structure": { "years": [ ... ] },
    "courses": [ ... ],
    "prerequisites": [ ... ]
  },
  "appVersion": "3.01",
  "submittedAt": "2026-08-01T10:30:00.000Z",
  "collectedAt": "2026-08-01T10:30:02.000Z"
}
```

To publish one to the live feed, copy the inner `plan` object into
`app/plans/index.json` and give it an `id` and `version: 1` — the exact steps
are in [MAINTAINING.md](MAINTAINING.md).

The same plan id sent again just **overwrites** its file with the latest
version (a student refining their plan doesn't pile up duplicates).

---

## Turning it off

Set `window.APP_COLLECT_URL = ''` in `plan.html`, commit, push. The app stops
sending anything immediately. You can pause the Worker in Cloudflare too. When
the app gets big enough that this isn't worth the space, deleting the
`collected/` folder and clearing `APP_COLLECT_URL` cleanly returns you to the
manual Contribute flow — nothing else depends on it.

---

## Alternative host

If you'd rather not use Cloudflare, the app just POSTs JSON `{ id, plan,
appVersion, submittedAt }` with an optional `X-Collect-Secret` header to
whatever URL you set. Any endpoint that can receive that and commit to GitHub
works — e.g. a Google Apps Script web app (uses your Google account, stores
the token in Script Properties) or a Vercel/Netlify function. The Cloudflare
Worker is just the most robust free option. Ask me and I'll write the version
for whichever host you pick.
