# Deploying StudyPlan — free hosting, step by step

Three pieces, three places, all on free tiers with no credit card required:

| Piece | Where | Why |
|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | Free tier doesn't expire (Render's free Postgres does, after 30 days) |
| API (`server/`) | [Render](https://render.com) | One-click deploy from the `render.yaml` already in this repo |
| Frontend (`web/`) | GitHub Pages | Already wired up — `.github/workflows/pages.yml` deploys it on every push to `main` |

Total cost: **$0**. The tradeoff: Render's free web service spins down after
15 minutes of no traffic, so the first request after a quiet period takes
~30–50 seconds to wake up (then it's fast again). Fine for a student project;
not fine if you ever need it always-instant, at which point Render's paid
tier removes the spin-down.

## 1. Database — Neon

1. Sign up at [neon.tech](https://neon.tech) (no card needed) and create a
   project.
2. Create a database (any name — `studyplan` is fine).
3. Copy the connection string Neon shows you. It already includes
   `?sslmode=require`, which Prisma needs — use it exactly as given. Use the
   **direct** connection string, not the pooled one: this API is a normal
   persistent Node process, not a serverless function, so it doesn't need
   PgBouncer pooling.
4. Keep that string handy for step 2.4 below.

## 2. API — Render

1. Sign up at [render.com](https://render.com) (no card needed for the free
   tier).
2. **New → Blueprint**, connect this GitHub repo. Render reads
   [`render.yaml`](render.yaml) at the repo root and proposes one service:
   `studyplan-api`.
3. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are generated for you
   automatically (`generateValue: true` in the blueprint) — nothing to do
   there.
4. Two values need to be filled in by hand (the blueprint marks them
   `sync: false` on purpose, since they're either a secret or specific to
   your GitHub username):
   - `DATABASE_URL` — the Neon connection string from step 1.
   - `CORS_ORIGINS` — your Pages URL, e.g. `https://YOUR-USERNAME.github.io`
     (scheme + host only, no path — that's all a CORS origin ever is, so you
     don't need to wait for the frontend to actually be live first).
5. **Apply**. Render builds and deploys. On boot it automatically runs
   `prisma migrate deploy` (applies the schema) and `node prisma/seed.js`
   (loads everything under `data/`) before starting the server — both are
   safe to re-run on every deploy, so there's no separate one-off step to
   remember.
6. Once it's live, confirm with:
   ```
   curl https://studyplan-api.onrender.com/api/universities
   ```
   (use whatever URL Render actually assigned — it's shown at the top of the
   service's dashboard page).

## 3. Frontend — GitHub Pages

1. Open `web/src/js/config.js` and replace the placeholder with your real
   Render URL from step 2.6:
   ```js
   window.__API_BASE__ = 'https://studyplan-api.onrender.com/api';
   ```
2. Commit and push to `main`. `.github/workflows/pages.yml` picks it up
   automatically — no manual "enable Pages" step, the workflow does that
   itself on first run.
3. Your site is live at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

## Updating data later

`server`'s start command re-runs the seed on every deploy, so editing a JSON
file under `data/` and pushing to `main` is enough — Render redeploys,
re-seeds (idempotent — upserts on slug, doesn't duplicate), and the change is
live within a minute or two.
