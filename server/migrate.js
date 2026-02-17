/**
 * Migration CLI & re-export for Concord Cognitive Engine.
 *
 * Delegates all real work to ./migrations/runner.js.  This file serves as:
 *   1. The CLI entry point   (`node migrate.js`, `node migrate.js --status`)
 *   2. The import alias used by server.js
 *
 * Usage:
 *   node migrate.js            # Apply all pending migrations
 *   node migrate.js --status   # Show which migrations have been applied
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  runMigrations,
  getMigrationStatus,
} from "./migrations/runner.js";

// Re-export so server.js can `import { runMigrations } from "./migrate.js"`
export { runMigrations, getMigrationStatus };

// ---------------------------------------------------------------------------
// CLI mode — only activates when this file is executed directly
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const isCli =
  process.argv[1] &&
  (process.argv[1] === __filename ||
    process.argv[1].endsWith("migrate.js"));

if (isCli) {
  const __dirname = path.dirname(__filename);
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
  const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "concord.db");

  let Database;
  try {
    Database = (await import("better-sqlite3")).default;
  } catch {
    console.error("[Migrate] better-sqlite3 is not installed — cannot run migrations.");
    process.exit(1);
  }

  // Open (or create) the database
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  try {
    if (process.argv.includes("--status")) {
      // --status: display migration status
      const status = await getMigrationStatus(db);

      console.log("\n=== Migration Status ===\n");

      if (status.applied.length > 0) {
        console.log("Applied migrations:");
        for (const m of status.applied) {
          console.log(`  [x] ${m.id}_${m.name}  (applied ${m.applied_at})`);
        }
      } else {
        console.log("No migrations have been applied yet.");
      }

      if (status.pending.length > 0) {
        console.log(`\nPending migrations (${status.pending.length}):`);
        for (const f of status.pending) {
          console.log(`  [ ] ${f}`);
        }
      } else {
        console.log("\nAll migrations are up to date.");
      }

      console.log();
    } else {
      // Default: run all pending migrations
      const result = await runMigrations(db);

      if (result.applied.length === 0) {
        console.log("[Migrate] Nothing to do — all migrations already applied.");
      } else {
        console.log(`[Migrate] Done. Applied: ${result.applied.join(", ")}`);
      }
    }
  } catch (e) {
    console.error("[Migrate] Fatal error:", e.message);
    process.exit(1);
  } finally {
    db.close();
  }
}
