/**
 * Migration 020 — Concord Legal Liability Framework
 *
 * Tables:
 *  - user_agreements              Tracks user consent at every touchpoint
 *  - dmca_notices                 DMCA takedown notice processing
 *  - copyright_strikes            Three-strike repeat infringer system
 *  - disputes                     Dispute resolution tracking
 *  - disclaimer_acknowledgments   Per-user per-lens disclaimer acknowledgment
 */

export function up(db) {
  db.exec(`
    -- User agreement tracking
    CREATE TABLE IF NOT EXISTS user_agreements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agreement_type TEXT NOT NULL
        CHECK (agreement_type IN (
          'account_creation', 'first_transaction',
          'first_upload', 'api_creation'
        )),
      version TEXT NOT NULL,
      agreed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agreements_user
      ON user_agreements(user_id);
    CREATE INDEX IF NOT EXISTS idx_agreements_type
      ON user_agreements(agreement_type);

    -- DMCA notices
    CREATE TABLE IF NOT EXISTS dmca_notices (
      id TEXT PRIMARY KEY,
      complainant_name TEXT NOT NULL,
      complainant_email TEXT NOT NULL,
      copyrighted_work TEXT NOT NULL,
      infringing_content_id TEXT NOT NULL,
      good_faith_statement BOOLEAN NOT NULL,
      accuracy_statement BOOLEAN NOT NULL,
      signature TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
        CHECK (status IN (
          'pending', 'reviewed', 'content_removed',
          'counter_filed', 'restored', 'resolved'
        )),
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      resolved_at TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_dmca_status
      ON dmca_notices(status);
    CREATE INDEX IF NOT EXISTS idx_dmca_content
      ON dmca_notices(infringing_content_id);

    -- Copyright strikes
    CREATE TABLE IF NOT EXISTS copyright_strikes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      dmca_notice_id TEXT NOT NULL,
      strike_number INTEGER NOT NULL,
      action_taken TEXT NOT NULL,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      appealed BOOLEAN DEFAULT FALSE,
      appeal_result TEXT,
      FOREIGN KEY (dmca_notice_id) REFERENCES dmca_notices(id)
    );

    CREATE INDEX IF NOT EXISTS idx_strikes_user
      ON copyright_strikes(user_id);

    -- Dispute records
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      dispute_type TEXT NOT NULL
        CHECK (dispute_type IN (
          'copyright', 'derivative_claim',
          'quality', 'fraudulent_listing'
        )),
      reporter_id TEXT NOT NULL,
      reported_content_id TEXT,
      reported_user_id TEXT,
      description TEXT NOT NULL,
      evidence_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'open'
        CHECK (status IN (
          'open', 'under_review', 'mediation',
          'resolved', 'escalated', 'dismissed'
        )),
      resolution TEXT,
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_disputes_status
      ON disputes(status);
    CREATE INDEX IF NOT EXISTS idx_disputes_type
      ON disputes(dispute_type);

    -- Disclaimer acknowledgment tracking
    CREATE TABLE IF NOT EXISTS disclaimer_acknowledgments (
      user_id TEXT NOT NULL,
      lens_id TEXT NOT NULL,
      acknowledged_at TEXT NOT NULL DEFAULT (datetime('now')),
      disclaimer_version TEXT NOT NULL,
      PRIMARY KEY (user_id, lens_id)
    );
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS disclaimer_acknowledgments;
    DROP TABLE IF EXISTS disputes;
    DROP TABLE IF EXISTS copyright_strikes;
    DROP TABLE IF EXISTS dmca_notices;
    DROP TABLE IF EXISTS user_agreements;
  `);
}
