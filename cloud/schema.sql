-- Cloud Sync — D1 schema.
--
-- Two tables, on purpose. `users` is identity (email + password hash); it
-- almost never changes. `sync_state` is the one JSON blob a signed-in
-- device pushes and pulls — selected plan, progress, grades, custom plans,
-- everything AAUP_STORAGE already keeps in localStorage under an `aaup_`
-- key. Splitting them means a sync push never touches the row a login
-- verifies against, and deleting an account is one cascading delete.
--
-- Apply with:
--   npx wrangler d1 execute studyplan-cloud --remote --file=cloud/schema.sql
-- (drop --remote for a local dev database).

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  -- Bumped on every password change. Embedded in every session token, so
  -- changing the password invalidates every OTHER signed-in device's token
  -- at once without needing a server-side session store to revoke from.
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
