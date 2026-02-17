/**
 * Migration Runner for Concord Cognitive Engine.
 *
 * Manages a `_migrations` tracking table and applies numbered migration files
 * in order inside transactions.  Designed to be idempotent: running it multiple
 * times is always safe because only pending migrations are executed.
 *
 * Each migration file must export:
 *   { id: '001', name: 'initial_schema', up(db) {...}, down(db) {...} }
 *
 * Usage (programmatic):
 *   import { runMigrations } from './migrations/runner.js';
 *   const result = runMigrations(db);
 *   // => { applied: ['000_baseline_auth', ...], alreadyRun: ['001_core_tables', ...] }
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = __dirname; // migration files live alongside runner.js

/**
 * Ensure the `_migrations` tracking table exists.
 * This table records every migration that has been successfully applied.
 *
 * Also handles migration from the legacy `schema_version` table used by
 * the previous migration runner.  If `schema_version` exists and `_migrations`
 * is empty, we copy the records across so previously-applied migrations are
 * not re-run.
 */
function ensureTrackingTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Legacy bridge: import rows from the old schema_version table (if present)
  try {
    const hasLegacy = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
      )
      .get();

    if (hasLegacy) {
      const migrationsEmpty =
        db.prepare("SELECT COUNT(*) as cnt FROM _migrations").get().cnt === 0;

      if (migrationsEmpty) {
        const legacyRows = db
          .prepare("SELECT version, name, applied_at FROM schema_version ORDER BY version")
          .all();

        if (legacyRows.length > 0) {
          const insert = db.prepare(
            "INSERT OR IGNORE INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)"
          );
          const tx = db.transaction(() => {
            for (const row of legacyRows) {
              // schema_version stored integer versions; pad to 3 digits for the new id format
              const id = String(row.version).padStart(3, "0");
              insert.run(id, row.name, row.applied_at);
            }
          });
          tx();
          console.log(
            `[Migrate] Imported ${legacyRows.length} record(s) from legacy schema_version table`
          );
        }
      }
    }
  } catch {
    // If anything goes wrong reading the legacy table, just proceed normally.
    // The worst case is migrations re-run with IF NOT EXISTS, which is safe.
  }
}

/**
 * Return the set of migration IDs that have already been applied.
 */
function getAppliedIds(db) {
  const rows = db.prepare("SELECT id FROM _migrations ORDER BY id").all();
  return new Set(rows.map((r) => r.id));
}

/**
 * Discover migration files on disk.
 *
 * Files must match the pattern NNN_name.js (e.g. 001_core_tables.js).
 * They are returned sorted by their numeric prefix.
 */
function discoverMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.js$/.test(f) && f !== "runner.js")
    .sort();
}

/**
 * Run all pending migrations against the provided better-sqlite3 database.
 *
 * @param {import('better-sqlite3').Database} db - An open better-sqlite3 instance.
 * @returns {{ applied: string[], alreadyRun: string[] }}
 */
export async function runMigrations(db) {
  ensureTrackingTable(db);

  const appliedIds = getAppliedIds(db);
  const files = discoverMigrations();

  const applied = [];
  const alreadyRun = [];

  for (const file of files) {
    const migrationPath = path.join(MIGRATIONS_DIR, file);
    const mod = await import(`file://${migrationPath}`);

    // Validate required exports
    if (typeof mod.up !== "function") {
      throw new Error(`Migration ${file} is missing a required 'up' export`);
    }

    const migrationId = mod.id || file.slice(0, 3);
    const migrationName = mod.name || file.replace(/^\d{3}_/, "").replace(/\.js$/, "");
    const label = `${migrationId}_${migrationName}`;

    if (appliedIds.has(migrationId)) {
      alreadyRun.push(label);
      continue;
    }

    console.log(`[Migrate] Applying ${file} ...`);

    // Run the migration inside a transaction so it either fully applies or
    // rolls back entirely.  The tracking row is inserted in the same
    // transaction to guarantee atomicity.
    const tx = db.transaction(() => {
      mod.up(db);
      db.prepare(
        "INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, datetime('now'))"
      ).run(migrationId, migrationName);
    });
    tx();

    applied.push(label);
    console.log(`[Migrate] Applied  ${file}`);
  }

  if (applied.length > 0) {
    console.log(`[Migrate] ${applied.length} migration(s) applied.`);
  } else {
    console.log("[Migrate] Schema is up to date — no pending migrations.");
  }

  return { applied, alreadyRun };
}

/**
 * Return status information about all known migrations.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ applied: Array<{id: string, name: string, applied_at: string}>, pending: string[] }}
 */
export async function getMigrationStatus(db) {
  ensureTrackingTable(db);

  const appliedRows = db
    .prepare("SELECT id, name, applied_at FROM _migrations ORDER BY id")
    .all();

  const appliedIds = new Set(appliedRows.map((r) => r.id));
  const files = discoverMigrations();
  const pending = [];

  for (const file of files) {
    const migrationPath = path.join(MIGRATIONS_DIR, file);
    const mod = await import(`file://${migrationPath}`);
    const migrationId = mod.id || file.slice(0, 3);
    if (!appliedIds.has(migrationId)) {
      pending.push(file);
    }
  }

  return { applied: appliedRows, pending };
}
