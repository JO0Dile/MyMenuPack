# Admin Mode

Edit the published catalogue — universities, majors, courses, prerequisites,
logos, icons — from inside the app, without touching a file or running a build.

**It is optional.** With no Worker deployed, Admin Mode still loads, says it has
no API configured, and nothing else about the app changes. Students never see it
either way.

---

## How a change reaches a student

```
Admin dashboard  →  admin Worker  →  commit into data/
                                  →  CI rebuilds web/plans.json
                                  →  GitHub Pages redeploys
                                  →  every student, on their next load
```

There is no database. `data/` remains the single source of truth, so nothing is
duplicated, every edit is a real commit with a message, and a mistake is undone
with `git revert`. The honest cost is latency: a change is live in **about a
minute**, not instantly.

### Students who customised a plan are not overwritten

If someone edited their own copy of a plan and you then publish a change to it,
their copy is **not** replaced. They get a dialog listing exactly what changed —
courses added or removed, credit hours, moved semesters, prerequisites — and
choose **Apply changes to my plan** or **Keep my current version**. Declining is
remembered, so the same version never asks twice.

Presentation is treated differently on purpose. Icons, logos, blurbs and
university details are not student-editable, so they refresh silently with no
prompt even on a customised plan.

---

## Setup (once)

### 1. Generate your credentials

```bash
python3 tools/hash-admin-password.py
```

It asks for a password twice and prints two lines: `ADMIN_PASSWORD_HASH` and a
fresh `SESSION_SECRET`. The password itself is never stored, never sent, and
never written to a file — only the PBKDF2-SHA256 hash of it.

### 2. Create a GitHub token

GitHub → Settings → Developer settings → **Fine-grained personal access token**

- Repository access: **only this repository**
- Permissions: **Contents → Read and write**

That is the whole scope it needs. It cannot touch any other repo, and it lives
only inside the Worker.

### 3. Deploy the Worker

Create a Cloudflare Worker named `studyplan-admin`, paste in
[`cloudflare-worker.js`](cloudflare-worker.js), Deploy. Then under
**Settings → Variables and Secrets**:

| Name | Type | Value |
|---|---|---|
| `ADMIN_USERNAME` | Variable | whatever you want to type |
| `ADMIN_PASSWORD_HASH` | **Secret** | from step 1 |
| `SESSION_SECRET` | **Secret** | from step 1 |
| `GITHUB_TOKEN` | **Secret** | from step 2 |
| `REPO_OWNER` | Variable | `JO0Dile` |
| `REPO_NAME` | Variable | `MyMenuPack` |
| `REPO_BRANCH` | Variable | `main` |
| `ALLOWED_ORIGIN` | Variable | `https://jo0dile.github.io` |

The three marked **Secret** are encrypted by Cloudflare and cannot be read back,
including by you. That is the point.

### 4. Point the app at it

`web/js/01-catalogue.js` already contains:

```js
window.APP_ADMIN_URL = 'https://studyplan-admin.pmhtrfalab999.workers.dev';
```

Change it only if you named the Worker something else.

### 5. Check it

Open `https://jo0dile.github.io/MyMenuPack/#admin`. The sign-in screen reports
what it can see before you type anything:

- *Connected to JO0Dile/MyMenuPack on main* — ready.
- *…has no credentials set* — step 3 is incomplete.
- *…no GitHub token configured* — sign-in will work but saving will not.
- *Could not reach the admin Worker* — step 3 was never deployed, or the URL in
  step 4 is wrong.

---

## Getting in

Two ways, both deliberate:

- **`#admin`** on the end of the app URL.
- **Developer Panel → 🛡 Admin Mode** (the panel opens after clicking the
  Developer link three times).

Neither is discoverable by accident, and neither grants anything: the password
is checked on the server, and every single request that changes data carries a
signed session token that the Worker re-verifies. Publishing the Worker URL is
harmless.

---

## What you can change

| Section | Covers |
|---|---|
| **Dashboard** | Counts, which repo and branch, how updates propagate |
| **Universities** | Name, Arabic name, short name, description, website, logo, icon, faculties, publish/unpublish |
| **Majors / Plans** | Name, subtitle, faculty, description, icon, image, degree hours; add and delete |
| **Courses** | Code, name, Arabic name, credit hours, category, year, semester; add and delete |
| **Prerequisites** | Add and remove pairs, with a server-side loop check |
| **Study Plan** | Move courses between years and semesters; add and remove years and summer terms |
| **Assets** | Upload, preview, replace and delete images |
| **Settings** | Session info, how to change the password, how to revoke access |

A major's metadata, courses, prerequisites and semester layout are all one file
(`data/<uni>/majors/<slug>.json`), so those four sections are views of a single
object and one **Save major** writes all of them together. A course move and a
prerequisite change can never land half-applied.

### Icons and logos

Three layers, tried in order, all optional:

1. **Uploaded image** — Assets → upload → paste the path into a logo or icon field.
2. **Built-in icon** — the picker shows the whole set as pictures.
3. **Emoji** — the original fallback, never removed.

Uploads are committed to `web/assets/uploads/` and deploy with the app, so an
uploaded logo still shows when the student is offline.

### Deleting

- **Deleting a major** removes the file. Recoverable with `git revert`.
- **Unpublishing a university** sets `"published": false`. Its majors stay in
  `data/`, exactly as authored, and come back when you publish it again — which
  is why the delete button unpublishes rather than deleting a folder of work.

---

## Security

- The password is stored **only** as a PBKDF2-SHA256 hash (600,000 iterations,
  random salt). The Worker cannot recover it and neither can anyone who reads
  its configuration.
- Sign-in returns an **HMAC-signed token** with an 8-hour expiry, kept in
  `sessionStorage` so closing the tab ends the session. There is no session
  store to steal.
- **Every** request that changes anything re-verifies that token before the
  route is even chosen. Nothing in the dashboard authorizes itself.
- Every payload is **re-validated on the server** against the real schema:
  slug shapes, credit-hour ranges, unknown categories, prerequisites pointing at
  courses that do not exist, and prerequisite cycles. The dashboard's checks are
  a convenience; these are the guarantee.
- **SVG uploads carrying `<script>` or event handlers are rejected**, not
  sanitized — a half-cleaned SVG served from the app's own origin would be a
  stored XSS against every user.
- The GitHub token never reaches a browser.
- Login is delayed a fixed 400 ms whether it succeeds or fails, which slows
  online guessing without affecting you.

**To revoke access immediately** — a lost laptop, a shared password — replace
`SESSION_SECRET` in the Worker. Every signed-in session stops working at once.

---

## Limits

| Thing | Limit | Why |
|---|---|---|
| Uploaded image | 512 KB | A logo, not a photograph |
| Major JSON | 400 KB | Comfortably larger than the biggest real plan |
| Session | 8 hours | Long enough for a working day |
| Propagation | ~1 minute | CI rebuild plus Pages deploy |

All of it fits inside Cloudflare's free tier, and nothing here can start
charging you.

---

## One admin

There is one username and one password, because this is one person's project.
Multiple admins with separate logins would need a user store, which would need a
database, which is the thing this design exists to avoid. If that changes, the
place to add it is `verifyPassword()` and `requireAdmin()` — everything else
already goes through them.
