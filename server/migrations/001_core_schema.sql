CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  scopes TEXT NOT NULL DEFAULT '["read","write"]',
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  label TEXT,
  key_hash TEXT NOT NULL,
  key_prefix TEXT,
  scopes TEXT NOT NULL DEFAULT '["read"]',
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT,
  refresh_token_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dtus (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  title TEXT NOT NULL,
  body_json TEXT NOT NULL DEFAULT '{}',
  tags_json TEXT NOT NULL DEFAULT '[]',
  type TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dtu_versions (
  id TEXT PRIMARY KEY,
  dtu_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (dtu_id) REFERENCES dtus(id) ON DELETE CASCADE,
  UNIQUE(dtu_id, version)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS artifact_versions (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  storage_uri TEXT,
  sha256 TEXT,
  size_bytes INTEGER,
  mime_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  UNIQUE(artifact_id, version)
);

CREATE TABLE IF NOT EXISTS artifact_links (
  id TEXT PRIMARY KEY,
  from_kind TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_artifact_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (to_artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lens_items (
  id TEXT PRIMARY KEY,
  lens_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  owner_user_id TEXT,
  added_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(lens_id, artifact_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  owner_user_id TEXT,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error_json TEXT,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS job_artifacts (
  job_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY(job_id, artifact_id, role),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  license_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS marketplace_listing_assets (
  listing_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  PRIMARY KEY(listing_id, artifact_id),
  FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  actor_user_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  request_id TEXT,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  path TEXT,
  method TEXT,
  status_code INTEGER,
  details TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_dtus_updated_at ON dtus(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_updated_at ON artifacts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_created_at ON marketplace_listings(created_at DESC);
