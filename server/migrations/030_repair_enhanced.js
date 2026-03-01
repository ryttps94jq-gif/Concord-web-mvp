/**
 * Migration 030 — Repair Brain Enhanced (Code DTU Integration)
 *
 * Creates tables for the enhanced repair cortex that leverages code DTU
 * substrate access for monitoring, diagnosis, predictive repair, and
 * knowledge accumulation.
 *
 * Tables created:
 *   - repair_patterns: known failure signatures and their resolutions
 *   - repair_history: log of every repair attempt with outcomes
 *   - repair_predictions: predictive repair entries with confidence and outcomes
 *   - repair_knowledge: accumulated repair wisdom (success/failure counts)
 *   - system_metrics_history: time-series system health metrics
 */

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repair_patterns (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      name TEXT NOT NULL,
      signature TEXT NOT NULL,
      is_healthy INTEGER NOT NULL DEFAULT 0,
      resolution TEXT,
      typical_time_to_failure TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      confidence REAL NOT NULL DEFAULT 0.5,
      source_dtu_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_patterns_category ON repair_patterns(category)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_patterns_subcategory ON repair_patterns(subcategory)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_patterns_severity ON repair_patterns(severity)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_patterns_source ON repair_patterns(source_dtu_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS repair_history (
      id TEXT PRIMARY KEY,
      issue_type TEXT NOT NULL,
      symptoms TEXT NOT NULL DEFAULT '[]',
      severity TEXT NOT NULL DEFAULT 'medium',
      diagnosis TEXT NOT NULL DEFAULT '{}',
      repair_option_used TEXT,
      fix_applied TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      repair_time_ms INTEGER,
      rollback_needed INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_history_type ON repair_history(issue_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_history_success ON repair_history(success)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_history_created ON repair_history(created_at DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS repair_predictions (
      id TEXT PRIMARY KEY,
      predicted_issue TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      time_to_impact TEXT,
      preventive_action TEXT,
      applied INTEGER NOT NULL DEFAULT 0,
      outcome TEXT,
      source_pattern_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (source_pattern_id) REFERENCES repair_patterns(id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_predictions_confidence ON repair_predictions(confidence DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_predictions_applied ON repair_predictions(applied)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_predictions_created ON repair_predictions(created_at DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS repair_knowledge (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      symptoms TEXT NOT NULL DEFAULT '',
      fix_description TEXT NOT NULL DEFAULT '',
      success_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      avg_repair_time_ms REAL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_knowledge_category ON repair_knowledge(category)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_knowledge_type ON repair_knowledge(issue_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repair_knowledge_success ON repair_knowledge(success_count DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_metrics_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      value REAL NOT NULL,
      metadata TEXT DEFAULT '{}',
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_type ON system_metrics_history(metric_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON system_metrics_history(recorded_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_type_recorded ON system_metrics_history(metric_type, recorded_at DESC)`);
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS system_metrics_history");
  db.exec("DROP TABLE IF EXISTS repair_knowledge");
  db.exec("DROP TABLE IF EXISTS repair_predictions");
  db.exec("DROP TABLE IF EXISTS repair_history");
  db.exec("DROP TABLE IF EXISTS repair_patterns");
}
