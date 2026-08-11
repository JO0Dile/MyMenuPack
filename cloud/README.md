# Cloud Sync

Sign in with an email and password, and a student's selected plan, progress,
grades, and any custom-built plans follow them to a new phone or browser.

**It is optional.** With no Worker deployed, the app works exactly as it
always has — everything stays in the browser's own storage, and the "Cloud
Sync" section in Settings just says it isn't configured.

---

## How it works

```
Sign up / sign in  →  this Worker  →  D1 `users` row + a session token
Sync push / pull    →  this Worker  →  D1 `sync_state` row (one JSON blob per user)
```

This is the **only** Worker in this project backed by a real database.
`admin/`, `ai/`, and `collector/` are all stateless — GitHub or nothing is
their datastore. Real multi-device accounts need somewhere to keep a
password hash and a synced blob that isn't any one device's own storage, so
this Worker uses [Cloudflare D1](https://developers.cloudflare.com/d1/) —
free, serverless SQLite, on the same platform as the rest of this project's
infrastructure.

The synced blob is exactly the shape `AAUP_STORAGE` already keeps in
`localStorage` — selected plan, progress checkmarks, grades, custom plans —
just mirrored under one account instead of one device.

---

## Setup (once)

### 1. Create the database

```bash
npx wrangler d1 create studyplan-cloud
```

This prints a `database_id` — keep it, the Worker's D1 binding needs it.

### 2. Apply the schema

```bash
npx wrangler d1 execute studyplan-cloud --remote --file=cloud/schema.sql
```

Two tables: `users` (email + password hash, nothing else) and `sync_state`
(one JSON blob per user). See the comments in `schema.sql` for why they're
split.

### 3. Deploy the Worker

Create a Cloudflare Worker named `studyplan-cloud`, paste in
[`cloudflare-worker.js`](cloudflare-worker.js), Deploy. Then:

- **Settings → Bindings → D1 Database** — bind it as `DB`, pointing at the
  database from step 1.
- **Settings → Variables and Secrets**:

| Name | Type | Value |
|---|---|---|
| `SESSION_SECRET` | **Secret** | any long random string — generate one the same way as admin's (`python3 tools/hash-admin-password.py` prints one, or use the keygen page). **Do not reuse admin's `SESSION_SECRET`.** They sign different kinds of tokens; sharing the value means a leak of one lets someone forge the other. |
| `ALLOWED_ORIGIN` | Variable | `https://jo0dile.github.io` — same format as the admin Worker's; comma-separate to allow more than one. |

### 4. Point the app at it

`web/js/01-catalogue.js` already contains:

```js
window.APP_CLOUD_URL = 'https://studyplan-cloud.pmhtrfalab999.workers.dev';
```

Change it only if you named the Worker something else. Leave it `''` to
keep Cloud Sync off entirely.

### 5. Check it

Open `<worker-url>/api/health` — `{"ok":true}` means the address is right.
Then try signing up for a real account in the app's Settings → Cloud Sync.

---

## What is deliberately NOT in this v1

**Password reset.** Recovering a forgotten password requires sending an
email, which needs its own free-tier provider (e.g. Resend) wired into this
Worker — a real but separate piece of setup, left for later rather than
blocking sign-up on it. Today, a student who forgets their password has to
sign up again with a new email; nothing about their old account is
recoverable, and the Sign In form's "forgot password" link says so plainly
rather than pretending to work. If this bothers you before an email
provider is wired up, `DELETE /api/account` at least lets a student clear
the old one out.

**Rate limiting beyond the login delay.** Every login attempt costs a fixed
400ms (same trick as the admin Worker), which blunts scripted guessing but
is not a real per-IP limiter — that needs Cloudflare KV or Turnstile, not
added here to keep the v1 scope to what a database-backed account system
strictly needs.

---

## Security model

Same approach as `admin/cloudflare-worker.js`, adapted for many users
instead of one:

- Passwords are never stored — only a PBKDF2-SHA256 hash (600,000
  iterations, random salt per user).
- A wrong password and a nonexistent email return the **identical** error,
  in the **same** amount of time (a dummy hash is verified against even
  when no such user exists) — so a login attempt's timing can't be used to
  discover which emails are registered.
- Sign-in returns an HMAC-signed session token (30-day expiry) carrying the
  user's id and a `token_version`. Every route re-checks the token against
  the live database row on every request — a token isn't just verified
  cryptographically, its version has to still match.
- **Changing the password bumps `token_version`**, which invalidates every
  *other* signed-in device's token immediately, with no server-side session
  store to maintain. The device making the change gets a fresh token in the
  same response so it isn't logged out by its own action.
- A sync push carries the client's last-known `updatedAt`. If the row moved
  since (synced from a second device first), the push is refused with a 409
  and the server's current copy attached — the same "this changed since you
  opened it" pattern the admin catalogue editor already uses — rather than
  one device silently overwriting another's progress.
- Every reply is `Cache-Control: no-store`; every payload is size-capped
  before it is even parsed.

## Limits

| Thing | Limit | Why |
|---|---|---|
| Password | 8–200 characters | Long enough to matter, short enough to type on a phone |
| Synced data | 2 MB | One student's whole local state, generously |
| Session | 30 days | "Stay signed in," not a work session — unlike the 8-hour admin session |

All of it fits inside Cloudflare's free tier (D1's free tier is 5 GB and 5
million reads/day — several orders of magnitude past what a study-plan
app's sync traffic will ever reach).
