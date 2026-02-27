/**
 * Migration 017 — API Billing System
 *
 * Tables:
 *  - api_keys                API key registry tied to Concord accounts
 *  - api_usage_log           Per-call metering log
 *  - api_monthly_usage       Aggregated monthly usage for free allowance tracking
 *  - api_balance_alerts      Developer-configured balance/spend alerts
 *  - api_fee_distribution    Fee split tracking per API call
 */

export function up(db) {
  db.exec(`
    -- API keys
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      name TEXT,
      status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'expired')),
      tier TEXT DEFAULT 'free_tier'
        CHECK (tier IN ('free_tier', 'standard', 'enterprise')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      total_calls INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash
      ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user
      ON api_keys(user_id);

    -- API usage log
    CREATE TABLE IF NOT EXISTS api_usage_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      api_key_hash TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      category TEXT NOT NULL
        CHECK (category IN ('read', 'write', 'compute', 'storage', 'cascade')),
      cost REAL NOT NULL DEFAULT 0,
      balance_after REAL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_user
      ON api_usage_log(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_api_usage_category
      ON api_usage_log(category, created_at);
    CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint
      ON api_usage_log(endpoint, created_at);

    -- Monthly usage aggregates (for free allowance tracking)
    CREATE TABLE IF NOT EXISTS api_monthly_usage (
      user_id TEXT NOT NULL,
      month TEXT NOT NULL,
      reads INTEGER DEFAULT 0,
      writes INTEGER DEFAULT 0,
      computes INTEGER DEFAULT 0,
      storage_calls INTEGER DEFAULT 0,
      cascades INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      PRIMARY KEY (user_id, month)
    );

    -- Balance alerts
    CREATE TABLE IF NOT EXISTS api_balance_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      alert_type TEXT NOT NULL
        CHECK (alert_type IN ('low_balance', 'high_spend', 'tier_change', 'free_exhausted')),
      threshold REAL,
      webhook_url TEXT,
      email_enabled INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_alerts_user
      ON api_balance_alerts(user_id);

    -- Fee distribution tracking (API-specific)
    CREATE TABLE IF NOT EXISTS api_fee_distribution (
      id TEXT PRIMARY KEY,
      source_usage_id TEXT NOT NULL,
      treasury_amount REAL NOT NULL,
      infra_amount REAL NOT NULL,
      payroll_amount REAL NOT NULL,
      ops_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_fee_dist_source
      ON api_fee_distribution(source_usage_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS api_fee_distribution;
    DROP TABLE IF EXISTS api_balance_alerts;
    DROP TABLE IF EXISTS api_monthly_usage;
    DROP TABLE IF EXISTS api_usage_log;
    DROP TABLE IF EXISTS api_keys;
  `);
}
