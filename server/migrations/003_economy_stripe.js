// migrations/003_economy_stripe.js
// Stripe integration tables: webhook idempotency + Connect accounts.

export const id = "003";
export const name = "economy_stripe";

export function up(db) {
  db.exec(`
    -- Webhook idempotency: prevents double-processing of Stripe events.
    CREATE TABLE IF NOT EXISTS stripe_events_processed (
      event_id    TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Stripe Connect accounts linked to Concord users.
    CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL UNIQUE,
      stripe_account_id   TEXT NOT NULL,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user ON stripe_connected_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_stripe_accounts_stripe ON stripe_connected_accounts(stripe_account_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS stripe_connected_accounts;
    DROP TABLE IF EXISTS stripe_events_processed;
  `);
}
