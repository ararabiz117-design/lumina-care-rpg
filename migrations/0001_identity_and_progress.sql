PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  picture TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_expiry ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  save_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
