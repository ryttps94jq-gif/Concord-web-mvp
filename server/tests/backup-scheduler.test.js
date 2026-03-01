import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createBackupScheduler } from "../lib/backup-scheduler.js";

describe("backup-scheduler", () => {
  let db;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  function createScheduler(opts = {}) {
    return createBackupScheduler(db, {
      schedule: "0 */6 * * *",
      s3Enabled: false,
      dataDir: "/tmp/test-data",
      ...opts,
    });
  }

  // ── Scheduler start/stop lifecycle ─────────────────────────────────

  describe("start/stop lifecycle", () => {
    it("starts and reports running status", () => {
      const scheduler = createScheduler();
      scheduler.start();

      const status = scheduler.getStatus();
      assert.equal(status.schedulerRunning, true);

      scheduler.stop();
    });

    it("stops and reports not running", () => {
      const scheduler = createScheduler();
      scheduler.start();
      scheduler.stop();

      const status = scheduler.getStatus();
      assert.equal(status.schedulerRunning, false);
    });

    it("handles double start gracefully", () => {
      const scheduler = createScheduler();
      scheduler.start();
      scheduler.start(); // Should warn but not throw

      const status = scheduler.getStatus();
      assert.equal(status.schedulerRunning, true);

      scheduler.stop();
    });

    it("handles stop without start gracefully", () => {
      const scheduler = createScheduler();
      // Should not throw
      scheduler.stop();
    });

    it("handles rapid start/stop cycles", () => {
      const scheduler = createScheduler();
      for (let i = 0; i < 5; i++) {
        scheduler.start();
        scheduler.stop();
      }
      const status = scheduler.getStatus();
      assert.equal(status.schedulerRunning, false);
    });
  });

  // ── CRON expression parsing ────────────────────────────────────────

  describe("CRON expression parsing", () => {
    it("accepts standard CRON expression", () => {
      const scheduler = createScheduler({ schedule: "0 */6 * * *" });
      const status = scheduler.getStatus();
      assert.equal(status.schedule, "0 */6 * * *");
    });

    it("accepts every-minute expression", () => {
      const scheduler = createScheduler({ schedule: "* * * * *" });
      const status = scheduler.getStatus();
      assert.equal(status.schedule, "* * * * *");
    });

    it("falls back to default on invalid CRON", () => {
      // Invalid expression — should fall back to "0 */6 * * *"
      const scheduler = createScheduler({ schedule: "invalid cron" });
      // Scheduler should still be usable
      const status = scheduler.getStatus();
      assert.ok(status.schedule); // Will be the fallback
    });

    it("handles ranges in CRON fields", () => {
      const scheduler = createScheduler({ schedule: "0 9-17 * * 1-5" });
      const status = scheduler.getStatus();
      assert.equal(status.schedule, "0 9-17 * * 1-5");
    });

    it("handles lists in CRON fields", () => {
      const scheduler = createScheduler({ schedule: "0 6,12,18 * * *" });
      const status = scheduler.getStatus();
      assert.equal(status.schedule, "0 6,12,18 * * *");
    });
  });

  // ── Status reporting ───────────────────────────────────────────────

  describe("getStatus", () => {
    it("returns comprehensive status object", () => {
      const scheduler = createScheduler();
      const status = scheduler.getStatus();

      assert.equal(typeof status.healthy, "boolean");
      assert.equal(typeof status.status, "string");
      assert.equal(typeof status.schedulerRunning, "boolean");
      assert.equal(typeof status.schedule, "string");
      assert.equal(typeof status.s3Enabled, "boolean");
      assert.equal(typeof status.backupInProgress, "boolean");
      assert.ok(status.age);
      assert.ok(status.counts);
    });

    it("reports 'unknown' status when no backups exist", () => {
      const scheduler = createScheduler();
      const status = scheduler.getStatus();
      assert.equal(status.status, "unknown");
      assert.equal(status.age.human, "never");
    });

    it("reports s3Enabled=false by default", () => {
      const scheduler = createScheduler();
      const status = scheduler.getStatus();
      assert.equal(status.s3Enabled, false);
    });

    it("reports s3Enabled=true when configured", () => {
      const scheduler = createScheduler({ s3Enabled: true });
      const status = scheduler.getStatus();
      assert.equal(status.s3Enabled, true);
    });

    it("reports zero counts initially", () => {
      const scheduler = createScheduler();
      const status = scheduler.getStatus();
      assert.equal(status.counts.total, 0);
      assert.equal(status.counts.failed, 0);
      assert.equal(status.counts.successful, 0);
    });
  });

  // ── History tracking ───────────────────────────────────────────────

  describe("getHistory", () => {
    it("returns empty history initially", () => {
      const scheduler = createScheduler();
      const { history, total } = scheduler.getHistory();
      assert.deepEqual(history, []);
      assert.equal(total, 0);
    });

    it("respects limit and offset", () => {
      const scheduler = createScheduler();
      // Manually insert some history records
      db.exec(`
        CREATE TABLE IF NOT EXISTS backup_history (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          db_size_bytes INTEGER,
          compressed_size_bytes INTEGER,
          artifacts_size_bytes INTEGER,
          s3_key TEXT,
          s3_etag TEXT,
          integrity_check TEXT,
          duration_ms INTEGER,
          error TEXT,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          metadata TEXT
        )
      `);

      for (let i = 0; i < 5; i++) {
        db.prepare(
          "INSERT INTO backup_history (id, type, status, started_at) VALUES (?, ?, ?, ?)"
        ).run(`bak_${i}`, "local", "completed", new Date().toISOString());
      }

      const result = scheduler.getHistory({ limit: 2, offset: 1 });
      assert.equal(result.history.length, 2);
      assert.equal(result.total, 5);
    });

    it("filters by type", () => {
      const scheduler = createScheduler();
      scheduler.getStatus(); // ensure table

      db.prepare(
        "INSERT INTO backup_history (id, type, status, started_at) VALUES (?, ?, ?, ?)"
      ).run("bak_local", "local", "completed", new Date().toISOString());
      db.prepare(
        "INSERT INTO backup_history (id, type, status, started_at) VALUES (?, ?, ?, ?)"
      ).run("bak_s3", "s3", "completed", new Date().toISOString());

      const result = scheduler.getHistory({ type: "local" });
      assert.equal(result.total, 1);
      assert.equal(result.history[0].type, "local");
    });

    it("filters by status", () => {
      const scheduler = createScheduler();
      scheduler.getStatus(); // ensure table

      db.prepare(
        "INSERT INTO backup_history (id, type, status, started_at) VALUES (?, ?, ?, ?)"
      ).run("bak_ok", "local", "completed", new Date().toISOString());
      db.prepare(
        "INSERT INTO backup_history (id, type, status, started_at) VALUES (?, ?, ?, ?)"
      ).run("bak_fail", "local", "failed", new Date().toISOString());

      const result = scheduler.getHistory({ status: "failed" });
      assert.equal(result.total, 1);
      assert.equal(result.history[0].status, "failed");
    });
  });

  // ── Backup age alerting ────────────────────────────────────────────

  describe("backup age alerting", () => {
    it("reports healthy when recent backup exists", () => {
      const scheduler = createScheduler({ alertThresholdMs: 24 * 60 * 60 * 1000 });
      scheduler.getStatus(); // ensure table

      const recentTime = new Date().toISOString();
      db.prepare(
        "INSERT INTO backup_history (id, type, status, started_at, completed_at) VALUES (?, ?, ?, ?, ?)"
      ).run("bak_recent", "local", "completed", recentTime, recentTime);

      const status = scheduler.getStatus();
      assert.equal(status.status, "healthy");
      assert.equal(status.healthy, true);
    });

    it("reports warning when backup is moderately old", () => {
      const thresholdMs = 12 * 60 * 60 * 1000; // 12 hours
      const scheduler = createScheduler({ alertThresholdMs: thresholdMs });
      scheduler.getStatus(); // ensure table

      // 18 hours ago — between threshold and 2x threshold
      const oldTime = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
      db.prepare(
        "INSERT INTO backup_history (id, type, status, started_at, completed_at) VALUES (?, ?, ?, ?, ?)"
      ).run("bak_old", "local", "completed", oldTime, oldTime);

      const status = scheduler.getStatus();
      assert.equal(status.status, "warning");
      assert.equal(status.healthy, false);
    });

    it("reports critical when backup is very old", () => {
      const thresholdMs = 12 * 60 * 60 * 1000;
      const scheduler = createScheduler({ alertThresholdMs: thresholdMs });
      scheduler.getStatus(); // ensure table

      // 30 hours ago — beyond 2x threshold
      const veryOldTime = new Date(
        Date.now() - 30 * 60 * 60 * 1000
      ).toISOString();
      db.prepare(
        "INSERT INTO backup_history (id, type, status, started_at, completed_at) VALUES (?, ?, ?, ?, ?)"
      ).run("bak_critical", "local", "completed", veryOldTime, veryOldTime);

      const status = scheduler.getStatus();
      assert.equal(status.status, "critical");
      assert.equal(status.healthy, false);
    });
  });

  // ── null DB handling ───────────────────────────────────────────────

  describe("null DB handling", () => {
    it("works with null database", () => {
      const scheduler = createBackupScheduler(null, {
        schedule: "0 */6 * * *",
      });
      const history = scheduler.getHistory();
      assert.deepEqual(history.history, []);
      assert.equal(history.total, 0);
    });
  });

  // ── Table creation ─────────────────────────────────────────────────

  describe("table creation", () => {
    it("creates backup_history table via getStatus", () => {
      const freshDb = new Database(":memory:");
      const scheduler = createBackupScheduler(freshDb, {
        schedule: "0 */6 * * *",
      });
      scheduler.getStatus();

      const tables = freshDb
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='backup_history'"
        )
        .all();
      assert.equal(tables.length, 1);
    });
  });
});
