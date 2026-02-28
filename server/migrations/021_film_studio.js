/**
 * Migration 021: Concord Film Studios
 *
 * Extends the creative marketplace with film-specific tables:
 *   - Film DTUs: media-specific metadata (type, duration, resolution, audio/subtitle tracks, stems)
 *   - Film components: decomposed sellable parts that auto-cite parent film
 *   - Series/episode structure: parent-child containers with bundle pricing
 *   - Crew contributions: tagged crew with independent sellable DTUs
 *   - Film preview analytics: drop-off timestamps, conversion tracking
 *   - Film remix tracking: film-specific remix types with lineage
 *   - Watch party sessions: synchronized viewing
 *   - Gift transfers: licensed copy gifting between users
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- Film DTUs — media-specific metadata extension
    -- Extends creative_artifacts with film-specific fields.
    -- Every film DTU references a creative_artifact row.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_dtus (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,

      -- Film type: film, short, series, episode, documentary, music-video
      film_type TEXT NOT NULL
        CHECK (film_type IN ('film','short','series','episode','documentary','music-video')),

      -- Duration
      duration_seconds INTEGER,        -- total runtime
      preview_duration_seconds INTEGER DEFAULT 300, -- free preview (default 5 min)

      -- Resolution
      resolution TEXT
        CHECK (resolution IS NULL OR resolution IN ('720p','1080p','4K','8K')),

      -- Audio tracks (JSON array of track objects)
      -- Each: { id, language, type: "dialogue"|"commentary"|"isolated-score"|"mixed", label }
      audio_tracks_json TEXT NOT NULL DEFAULT '[]',

      -- Subtitle tracks (JSON array of subtitle objects)
      -- Each: { id, language, format: "srt"|"vtt"|"ass", label }
      subtitle_tracks_json TEXT NOT NULL DEFAULT '[]',

      -- Stems: decomposed media components
      -- { video, dialogue, music, foley, vfx_layers }
      stems_json TEXT NOT NULL DEFAULT '{}',

      -- Preview configuration
      preview_type TEXT DEFAULT 'first-5-min'
        CHECK (preview_type IN ('first-5-min','trailer-cut','creator-selected-segment')),
      preview_trailer_dtu_id TEXT,           -- if trailer-cut, references the trailer DTU
      preview_segment_start_ms INTEGER,      -- if creator-selected-segment
      preview_segment_end_ms INTEGER,

      -- Remix permissions
      remix_permissions TEXT DEFAULT 'open'
        CHECK (remix_permissions IN ('open','licensed','restricted')),

      -- Parent citations (JSON array of cited DTU IDs)
      parent_citations_json TEXT NOT NULL DEFAULT '[]',

      -- Series linkage
      series_id TEXT,                        -- if episode, references parent series film_dtu
      season_number INTEGER,
      episode_number INTEGER,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (artifact_id) REFERENCES creative_artifacts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_dtus_artifact
      ON film_dtus(artifact_id);
    CREATE INDEX IF NOT EXISTS idx_film_dtus_creator
      ON film_dtus(creator_id);
    CREATE INDEX IF NOT EXISTS idx_film_dtus_type
      ON film_dtus(film_type);
    CREATE INDEX IF NOT EXISTS idx_film_dtus_series
      ON film_dtus(series_id);
    CREATE INDEX IF NOT EXISTS idx_film_dtus_remix_perms
      ON film_dtus(remix_permissions);

    -- ═══════════════════════════════════════════════════
    -- Film Components — decomposed sellable parts
    -- Each component auto-cites the parent film DTU.
    -- Creator sets individual prices per component.
    -- Components can be sold independently of the full film.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_components (
      id TEXT PRIMARY KEY,
      film_dtu_id TEXT NOT NULL,
      artifact_id TEXT,                      -- references creative_artifacts if listed
      creator_id TEXT NOT NULL,

      component_type TEXT NOT NULL,
      -- Types: full-film, soundtrack, score, dialogue, foley-sfx, scene,
      --   behind-the-scenes, commentary, screenplay, storyboard, vfx-breakdown,
      --   lighting-setup, costume-set-design, stems-package, full-bundle

      label TEXT NOT NULL,
      description TEXT,
      price REAL,
      is_mega INTEGER DEFAULT 0,             -- true for stems-package, full-bundle

      -- For scene components
      scene_number INTEGER,
      scene_start_ms INTEGER,
      scene_end_ms INTEGER,

      -- Marketplace status
      status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft','active','paused','delisted')),

      purchase_count INTEGER DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (film_dtu_id) REFERENCES film_dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_components_film
      ON film_components(film_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_film_components_creator
      ON film_components(creator_id);
    CREATE INDEX IF NOT EXISTS idx_film_components_type
      ON film_components(component_type);
    CREATE INDEX IF NOT EXISTS idx_film_components_status
      ON film_components(status);

    -- ═══════════════════════════════════════════════════
    -- Crew Contributions
    -- Film creator tags crew members and their roles.
    -- Each crew member can independently sell DTUs
    -- from their contribution. Crew DTUs auto-cite parent film.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_crew (
      id TEXT PRIMARY KEY,
      film_dtu_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      -- Roles: director, cinematographer, sound-designer, colorist, editor,
      --   composer, set-designer, costume-designer, stunt-coordinator,
      --   gaffer, vfx-artist, producer, screenwriter

      display_name TEXT,
      revenue_share_pct REAL DEFAULT 0,      -- optional % of film revenue

      created_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (film_dtu_id) REFERENCES film_dtus(id),
      UNIQUE(film_dtu_id, user_id, role)
    );

    CREATE INDEX IF NOT EXISTS idx_film_crew_film
      ON film_crew(film_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_film_crew_user
      ON film_crew(user_id);
    CREATE INDEX IF NOT EXISTS idx_film_crew_role
      ON film_crew(role);

    -- Crew-created sellable DTUs
    CREATE TABLE IF NOT EXISTS film_crew_dtus (
      id TEXT PRIMARY KEY,
      crew_id TEXT NOT NULL,
      film_dtu_id TEXT NOT NULL,
      artifact_id TEXT,                      -- references creative_artifacts if listed
      crew_contribution_type TEXT NOT NULL,
      -- Types per role defined in film-studio-constants.js

      title TEXT NOT NULL,
      description TEXT,
      price REAL,
      status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft','active','paused','delisted')),

      purchase_count INTEGER DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (crew_id) REFERENCES film_crew(id),
      FOREIGN KEY (film_dtu_id) REFERENCES film_dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_crew_dtus_crew
      ON film_crew_dtus(crew_id);
    CREATE INDEX IF NOT EXISTS idx_film_crew_dtus_film
      ON film_crew_dtus(film_dtu_id);

    -- ═══════════════════════════════════════════════════
    -- Series / Episode Structure
    -- Series DTU = parent container
    -- Episode DTUs = children, individually purchasable
    -- Bundle pricing with creator-set discounts
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_series_bundles (
      id TEXT PRIMARY KEY,
      series_dtu_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,

      bundle_type TEXT NOT NULL
        CHECK (bundle_type IN ('per-episode','per-season','per-series')),

      season_number INTEGER,                 -- null for per-series bundles
      bundle_price REAL NOT NULL,
      individual_total REAL,                 -- sum of individual prices for comparison
      discount_pct REAL DEFAULT 0,

      status TEXT DEFAULT 'active'
        CHECK (status IN ('active','paused','delisted')),

      purchase_count INTEGER DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (series_dtu_id) REFERENCES film_dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_bundles_series
      ON film_series_bundles(series_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_film_bundles_creator
      ON film_series_bundles(creator_id);

    -- ═══════════════════════════════════════════════════
    -- Film Preview Analytics
    -- Preview views, drop-off timestamps, conversion rates.
    -- All analytics are DTUs owned by the creator.
    -- Platform cannot sell creator analytics.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_preview_events (
      id TEXT PRIMARY KEY,
      film_dtu_id TEXT NOT NULL,
      viewer_id TEXT,                        -- null for anonymous (zero auth previews)
      session_id TEXT,

      event_type TEXT NOT NULL
        CHECK (event_type IN ('preview_start','preview_drop_off','preview_complete','purchase_prompt_shown','purchase_completed')),

      -- Drop-off tracking
      drop_off_timestamp_ms INTEGER,         -- where the viewer stopped watching
      preview_duration_watched_ms INTEGER,

      -- Geo (region only, no PII)
      region TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (film_dtu_id) REFERENCES film_dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_preview_film
      ON film_preview_events(film_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_film_preview_type
      ON film_preview_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_film_preview_created
      ON film_preview_events(created_at);

    -- ═══════════════════════════════════════════════════
    -- Film Remix Tracking
    -- Film-specific remix types with full lineage.
    -- Remix of remix supported — citation chain tracks
    -- full lineage. Original creator earns at every level.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_remixes (
      id TEXT PRIMARY KEY,
      remix_dtu_id TEXT NOT NULL,             -- the new remix film DTU
      source_dtu_id TEXT NOT NULL,            -- source film DTU being remixed

      remix_type TEXT NOT NULL,
      -- Types: re-cut, commentary-overlay, mashup, soundtrack-replacement,
      --   translation-dub, accessibility-enhancement, parody-comedy,
      --   educational-analysis, vfx-enhancement, alternate-ending, highlight-reel

      transformation_hash TEXT,              -- content hash for transformation check
      transformation_score REAL,             -- 0-1, minimum threshold enforced

      created_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (remix_dtu_id) REFERENCES film_dtus(id),
      FOREIGN KEY (source_dtu_id) REFERENCES film_dtus(id),
      UNIQUE(remix_dtu_id, source_dtu_id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_remixes_remix
      ON film_remixes(remix_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_film_remixes_source
      ON film_remixes(source_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_film_remixes_type
      ON film_remixes(remix_type);

    -- ═══════════════════════════════════════════════════
    -- Watch Party — synchronized viewing sessions
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_watch_parties (
      id TEXT PRIMARY KEY,
      film_dtu_id TEXT NOT NULL,
      host_user_id TEXT NOT NULL,

      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','active','paused','ended')),

      started_at TEXT,
      ended_at TEXT,
      current_position_ms INTEGER DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (film_dtu_id) REFERENCES film_dtus(id)
    );

    CREATE TABLE IF NOT EXISTS film_watch_party_members (
      id TEXT PRIMARY KEY,
      party_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      left_at TEXT,

      FOREIGN KEY (party_id) REFERENCES film_watch_parties(id),
      UNIQUE(party_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_watch_parties_film
      ON film_watch_parties(film_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_film_watch_parties_host
      ON film_watch_parties(host_user_id);
    CREATE INDEX IF NOT EXISTS idx_film_watch_party_members_party
      ON film_watch_party_members(party_id);

    -- ═══════════════════════════════════════════════════
    -- Gift Transfers
    -- Buyer can gift their licensed copy to another user.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_gift_transfers (
      id TEXT PRIMARY KEY,
      license_id TEXT NOT NULL,              -- the usage license being gifted
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      film_dtu_id TEXT NOT NULL,
      message TEXT,

      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','declined','cancelled')),

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,

      FOREIGN KEY (license_id) REFERENCES creative_usage_licenses(id),
      FOREIGN KEY (film_dtu_id) REFERENCES film_dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_gifts_from
      ON film_gift_transfers(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_film_gifts_to
      ON film_gift_transfers(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_film_gifts_film
      ON film_gift_transfers(film_dtu_id);

    -- ═══════════════════════════════════════════════════
    -- Film Discovery Ranking Cache
    -- Computed ranking scores for the discovery algorithm.
    -- Weights are public and auditable.
    -- No paid promotion. No payola. Hardcoded.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS film_discovery_scores (
      film_dtu_id TEXT PRIMARY KEY,

      purchase_volume INTEGER DEFAULT 0,
      citation_count INTEGER DEFAULT 0,
      completion_rate REAL DEFAULT 0,        -- 0-1
      preview_conversion REAL DEFAULT 0,     -- 0-1
      creator_reputation REAL DEFAULT 0,     -- 0-1
      recency_score REAL DEFAULT 0,          -- 0-1

      composite_score REAL DEFAULT 0,        -- weighted combination

      computed_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (film_dtu_id) REFERENCES film_dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_film_discovery_composite
      ON film_discovery_scores(composite_score DESC);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS film_discovery_scores;
    DROP TABLE IF EXISTS film_gift_transfers;
    DROP TABLE IF EXISTS film_watch_party_members;
    DROP TABLE IF EXISTS film_watch_parties;
    DROP TABLE IF EXISTS film_remixes;
    DROP TABLE IF EXISTS film_preview_events;
    DROP TABLE IF EXISTS film_series_bundles;
    DROP TABLE IF EXISTS film_crew_dtus;
    DROP TABLE IF EXISTS film_crew;
    DROP TABLE IF EXISTS film_components;
    DROP TABLE IF EXISTS film_dtus;
  `);
}
