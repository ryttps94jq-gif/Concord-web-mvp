/**
 * Migration 001: Core tables for the "Everything Real" spec.
 *
 * Creates: dtus, dtu_versions, artifacts, artifact_versions, artifact_links,
 *          jobs, job_artifacts, marketplace_listings, marketplace_listing_assets,
 *          entitlements, events, lens_items,
 *          studio_projects, studio_tracks, studio_clips, studio_effect_chains,
 *          studio_renders
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- DTUs (Discrete Thought Units)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS dtus (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      title TEXT NOT NULL DEFAULT 'Untitled',
      body_json TEXT NOT NULL DEFAULT '{}',
      tags_json TEXT NOT NULL DEFAULT '[]',
      visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private','internal','public','marketplace')),
      tier TEXT NOT NULL DEFAULT 'regular'
        CHECK (tier IN ('regular','mega','hyper','shadow')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dtus_owner ON dtus(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_dtus_visibility ON dtus(visibility);
    CREATE INDEX IF NOT EXISTS idx_dtus_created ON dtus(created_at DESC);

    CREATE TABLE IF NOT EXISTS dtu_versions (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      body_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (dtu_id) REFERENCES dtus(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dtu_versions_dtu ON dtu_versions(dtu_id, version);

    -- ═══════════════════════════════════════════════════
    -- Artifacts (durable outputs & uploads)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      type TEXT NOT NULL DEFAULT 'file'
        CHECK (type IN ('file','audio','image','video','document','code','json','analysis','render','master')),
      title TEXT NOT NULL DEFAULT 'Untitled',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private','internal','public','marketplace')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_artifacts_owner ON artifacts(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
    CREATE INDEX IF NOT EXISTS idx_artifacts_created ON artifacts(created_at DESC);

    CREATE TABLE IF NOT EXISTS artifact_versions (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      storage_uri TEXT NOT NULL,
      sha256 TEXT,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact ON artifact_versions(artifact_id, version);

    CREATE TABLE IF NOT EXISTS artifact_links (
      id TEXT PRIMARY KEY,
      from_kind TEXT NOT NULL CHECK (from_kind IN ('dtu','job','listing','project','track')),
      from_id TEXT NOT NULL,
      to_artifact_id TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'output',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (to_artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_artifact_links_from ON artifact_links(from_kind, from_id);
    CREATE INDEX IF NOT EXISTS idx_artifact_links_to ON artifact_links(to_artifact_id);

    -- ═══════════════════════════════════════════════════
    -- Jobs (persistent background work)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      owner_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','completed','failed','cancelled')),
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT,
      error_json TEXT,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
    CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

    CREATE TABLE IF NOT EXISTS job_artifacts (
      job_id TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'output',
      PRIMARY KEY (job_id, artifact_id),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    );

    -- ═══════════════════════════════════════════════════
    -- Marketplace
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      license_id TEXT,
      visibility TEXT NOT NULL DEFAULT 'draft'
        CHECK (visibility IN ('draft','published','archived','removed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_listings_owner ON marketplace_listings(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_listings_visibility ON marketplace_listings(visibility);
    CREATE INDEX IF NOT EXISTS idx_listings_created ON marketplace_listings(created_at DESC);

    CREATE TABLE IF NOT EXISTS marketplace_listing_assets (
      listing_id TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      PRIMARY KEY (listing_id, artifact_id),
      FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements(user_id);
    CREATE INDEX IF NOT EXISTS idx_entitlements_listing ON entitlements(listing_id);

    -- ═══════════════════════════════════════════════════
    -- Global/Lens sync (Option A: mapping table)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS lens_items (
      id TEXT PRIMARY KEY,
      lens_id TEXT NOT NULL,
      artifact_id TEXT,
      dtu_id TEXT,
      owner_user_id TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_lens_items_lens ON lens_items(lens_id);
    CREATE INDEX IF NOT EXISTS idx_lens_items_artifact ON lens_items(artifact_id);
    CREATE INDEX IF NOT EXISTS idx_lens_items_dtu ON lens_items(dtu_id);

    -- ═══════════════════════════════════════════════════
    -- Event log (append-only audit)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      actor_user_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      request_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);

    -- ═══════════════════════════════════════════════════
    -- Studio / Music (persistent project state)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS studio_projects (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      name TEXT NOT NULL DEFAULT 'Untitled Project',
      bpm INTEGER DEFAULT 120,
      key TEXT DEFAULT 'C',
      scale TEXT DEFAULT 'major',
      genre TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_studio_projects_owner ON studio_projects(owner_user_id);

    CREATE TABLE IF NOT EXISTS studio_tracks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Track',
      type TEXT DEFAULT 'audio',
      instrument_id TEXT,
      color TEXT DEFAULT '#4A9EFF',
      volume_db REAL DEFAULT 0.0,
      pan REAL DEFAULT 0.0,
      muted INTEGER DEFAULT 0,
      solo INTEGER DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_studio_tracks_project ON studio_tracks(project_id);

    CREATE TABLE IF NOT EXISTS studio_clips (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      asset_version_id TEXT,
      start_ms INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 4000,
      gain_db REAL DEFAULT 0.0,
      fades_json TEXT NOT NULL DEFAULT '{}',
      name TEXT DEFAULT 'Clip',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES studio_tracks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_studio_clips_track ON studio_clips(track_id);

    CREATE TABLE IF NOT EXISTS studio_effect_chains (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      chain_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES studio_tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS studio_renders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      job_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','completed','failed')),
      format TEXT DEFAULT 'wav',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES studio_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_studio_renders_project ON studio_renders(project_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS studio_renders;
    DROP TABLE IF EXISTS studio_effect_chains;
    DROP TABLE IF EXISTS studio_clips;
    DROP TABLE IF EXISTS studio_tracks;
    DROP TABLE IF EXISTS studio_projects;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS lens_items;
    DROP TABLE IF EXISTS entitlements;
    DROP TABLE IF EXISTS marketplace_listing_assets;
    DROP TABLE IF EXISTS marketplace_listings;
    DROP TABLE IF EXISTS job_artifacts;
    DROP TABLE IF EXISTS jobs;
    DROP TABLE IF EXISTS artifact_links;
    DROP TABLE IF EXISTS artifact_versions;
    DROP TABLE IF EXISTS artifacts;
    DROP TABLE IF EXISTS dtu_versions;
    DROP TABLE IF EXISTS dtus;
  `);
}
