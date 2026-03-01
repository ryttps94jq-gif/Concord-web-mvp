/**
 * Migration 028 — Code Engine
 *
 * Creates tables for the Concord Self-Expanding Code Engine which ingests
 * open source repositories, extracts architectural patterns via AST parsing,
 * compresses code DTUs into Mega wisdom DTUs, and enables autonomous lens
 * generation from learned patterns.
 *
 * Tables created:
 *   - code_repositories: tracked open source repos and their ingestion state
 *   - code_patterns: extracted code patterns with CRETI scores and metadata
 *   - code_megas: compressed Mega DTUs aggregating hundreds of code patterns
 *   - lens_generations: autonomous lens generation requests and their lifecycle
 *   - code_errors: production error tracking for generated lenses with resolutions
 */

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_repositories (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      license TEXT,
      license_mode TEXT DEFAULT 'unknown',
      stars INTEGER DEFAULT 0,
      language TEXT,
      ingested_at TEXT,
      pattern_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_repos_status ON code_repositories(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_repos_language ON code_repositories(language)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_repos_stars ON code_repositories(stars DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_repos_ingested ON code_repositories(ingested_at DESC)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_code_repos_url ON code_repositories(url)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS code_patterns (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      name TEXT NOT NULL,
      language TEXT,
      description TEXT,
      applicability TEXT DEFAULT '[]',
      anti_patterns TEXT DEFAULT '[]',
      pitfalls TEXT DEFAULT '[]',
      performance TEXT DEFAULT '{}',
      source_analysis TEXT DEFAULT '{}',
      creti_c REAL DEFAULT 0,
      creti_r REAL DEFAULT 0,
      creti_e REAL DEFAULT 0,
      creti_t REAL DEFAULT 0,
      creti_i REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (repository_id) REFERENCES code_repositories(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_patterns_repo ON code_patterns(repository_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_patterns_category ON code_patterns(category)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_patterns_subcategory ON code_patterns(category, subcategory)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_patterns_language ON code_patterns(language)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_patterns_name ON code_patterns(name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_patterns_created ON code_patterns(created_at DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS code_megas (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      compressed_from_count INTEGER NOT NULL DEFAULT 0,
      core_insight TEXT,
      pattern_hierarchy TEXT DEFAULT '{}',
      decision_matrix TEXT DEFAULT '{}',
      elite_patterns TEXT DEFAULT '[]',
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_megas_topic ON code_megas(topic)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_megas_created ON code_megas(created_at DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lens_generations (
      id TEXT PRIMARY KEY,
      user_request TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      lens_name TEXT,
      architecture TEXT DEFAULT '{}',
      patterns_used TEXT DEFAULT '[]',
      test_count INTEGER DEFAULT 0,
      deploy_time REAL,
      error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_lens_gen_status ON lens_generations(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_lens_gen_created ON lens_generations(created_at DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS code_errors (
      id TEXT PRIMARY KEY,
      lens_id TEXT,
      error_type TEXT NOT NULL,
      stack_trace TEXT,
      context TEXT DEFAULT '{}',
      resolution TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lens_id) REFERENCES lens_generations(id) ON DELETE SET NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_errors_lens ON code_errors(lens_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_errors_type ON code_errors(error_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_errors_created ON code_errors(created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_code_errors_resolved ON code_errors(resolved_at)`);
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS code_errors");
  db.exec("DROP TABLE IF EXISTS lens_generations");
  db.exec("DROP TABLE IF EXISTS code_megas");
  db.exec("DROP TABLE IF EXISTS code_patterns");
  db.exec("DROP TABLE IF EXISTS code_repositories");
}
