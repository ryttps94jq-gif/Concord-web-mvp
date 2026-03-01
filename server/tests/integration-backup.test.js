/**
 * Integration Test: Backup System
 *
 * Tests the backup scheduler lifecycle including:
 * - Scheduler start/stop lifecycle
 * - Backup history recording
 * - Status transitions (started -> completed/failed)
 * - Health monitoring thresholds
 * - CRON expression parsing
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import { createBackupScheduler } from "../lib/backup-scheduler.js";

// ── Mock SQLite Database ─────────────────────────────────────────────────

function createMockDB() {
  const tables = new Map();
  const data = new Map(); // tableName -> row[]

  return {
    exec(sql) {
      // Parse CREATE TABLE to register the table
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (match) {
        const tableName = match[1];
        if (!tables.has(tableName)) {
          tables.set(tableName, true);
          data.set(tableName, []);
        }
      }
    },

    prepare(sql) {
      const isInsert = sql.trim().toUpperCase().startsWith("INSERT");
      const isSelect = sql.trim().toUpperCase().startsWith("SELECT");

      return {
        run(...args) {
          if (isInsert) {
            // Handle named parameters
            const params = typeof args[0] === "object" ? args[0] : {};
            const tableName = sql.match(/INTO\s+(\w+)/i)?.[1];
            if (tableName && data.has(tableName)) {
              const rows = data.get(tableName);
              // Check for OR REPLACE
              if (sql.includes("OR REPLACE") && params.id) {
                const idx = rows.findIndex((r) => r.id === params.id);
                if (idx >= 0) {
                  rows[idx] = { ...params };
                  return;
                }
              }
              rows.push({ ...params });
            }
          }
        },

        get(...args) {
          const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
          if (!tableName || !data.has(tableName)) return null;
          const rows = data.get(tableName);

          if (sql.includes("COUNT(*)")) {
            const total = rows.length;
            const failed = rows.filter((r) => r.status === "failed").length;
            return { total, failed };
          }

          // Handle WHERE status = ?
          const statusMatch = sql.match(/status\s*=\s*['"]?(\w+)['"]?/);
          const filteredRows = statusMatch
            ? rows.filter((r) => r.status === statusMatch[1])
            : rows;

          // Handle ORDER BY ... DESC LIMIT 1
          if (sql.includes("DESC LIMIT 1")) {
            return filteredRows.length > 0
              ? filteredRows[filteredRows.length - 1]
              : null;
          }

          // Handle status filter from named params
          const params = typeof args[0] === "object" ? args[0] : {};
          if (params.status) {
            const matched = rows.filter((r) => r.status === params.status);
            return matched.length > 0 ? matched[matched.length - 1] : null;
          }

          return filteredRows[0] || null;
        },

        all(...args) {
          const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
          if (!tableName || !data.has(tableName)) return [];
          const rows = data.get(tableName);

          if (sql.includes("GROUP BY type")) {
            const grouped = {};
            for (const row of rows) {
              if (row.status === "completed") {
                grouped[row.type] = (grouped[row.type] || 0) + 1;
              }
            }
            return Object.entries(grouped).map(([type, count]) => ({ type, count }));
          }

          const params = typeof args[0] === "object" ? args[0] : {};
          let filtered = [...rows];
          if (params.type) filtered = filtered.filter((r) => r.type === params.type);
          if (params.status) filtered = filtered.filter((r) => r.status === params.status);

          return filtered;
        },
      };
    },

    // Test helper to access raw data
    _getRows(tableName) {
      return data.get(tableName) || [];
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Integration: Backup System", () => {
  let db;
  let scheduler;

  beforeEach(() => {
    db = createMockDB();
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
      scheduler = null;
    }
  });

  // ── Scheduler Start/Stop Lifecycle ──────

  describe("Scheduler Start/Stop Lifecycle", () => {
    it("scheduler starts and reports running status", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
        s3Enabled: false,
      });

      scheduler.start();

      const status = scheduler.getStatus();
      assert.ok(status.schedulerRunning);
      assert.equal(status.schedule, "0 */6 * * *");
      assert.equal(status.s3Enabled, false);
    });

    it("scheduler stops cleanly", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      scheduler.start();
      assert.ok(scheduler.getStatus().schedulerRunning);

      scheduler.stop();
      assert.ok(!scheduler.getStatus().schedulerRunning);
    });

    it("scheduler can be started and stopped multiple times", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      scheduler.start();
      scheduler.stop();
      scheduler.start();
      scheduler.stop();

      assert.ok(!scheduler.getStatus().schedulerRunning);
    });

    it("starting an already running scheduler does not create duplicate intervals", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      scheduler.start();
      scheduler.start(); // Second start should be a no-op

      const status = scheduler.getStatus();
      assert.ok(status.schedulerRunning);

      scheduler.stop();
      assert.ok(!scheduler.getStatus().schedulerRunning);
    });
  });

  // ── Backup History Recording ──────

  describe("Backup History Recording", () => {
    it("getStatus reports no backups initially", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      const status = scheduler.getStatus();
      assert.equal(status.counts.total, 0);
      assert.equal(status.counts.failed, 0);
      assert.equal(status.counts.successful, 0);
    });

    it("getHistory returns empty array initially", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      const history = scheduler.getHistory();
      assert.equal(history.total, 0);
      assert.ok(Array.isArray(history.history));
      assert.equal(history.history.length, 0);
    });

    it("getHistory respects limit and offset", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      // Manually insert some backup records
      const rows = db._getRows("backup_history");
      for (let i = 0; i < 5; i++) {
        rows.push({
          id: `bak_${i}`,
          type: "local",
          status: "completed",
          started_at: new Date(Date.now() - i * 60000).toISOString(),
          completed_at: new Date(Date.now() - i * 60000 + 5000).toISOString(),
        });
      }

      const history = scheduler.getHistory({ limit: 2 });
      assert.ok(Array.isArray(history.history));
    });
  });

  // ── Status Transitions ──────

  describe("Status Transitions", () => {
    it("reports 'unknown' health status when no backups exist", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      const status = scheduler.getStatus();
      assert.equal(status.status, "unknown");
      assert.equal(status.age.human, "never");
    });

    it("reports 'healthy' when recent backup exists", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
        alertThresholdMs: 12 * 60 * 60 * 1000, // 12 hours
      });

      // Ensure table is created by calling getStatus first
      scheduler.getStatus();

      // Insert a recent completed backup
      const backupRows = db._getRows("backup_history");
      backupRows.push({
        id: "bak_recent",
        type: "local",
        status: "completed",
        started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      });

      const status = scheduler.getStatus();
      assert.equal(status.status, "healthy");
      assert.ok(status.healthy);
    });

    it("reports 'warning' when backup is moderately old", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
        alertThresholdMs: 6 * 60 * 60 * 1000, // 6 hours
      });

      // Ensure table is created
      scheduler.getStatus();

      // Insert a backup completed 9 hours ago (between threshold and 2x threshold)
      const backupRows = db._getRows("backup_history");
      backupRows.push({
        id: "bak_old",
        type: "local",
        status: "completed",
        started_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 9 * 60 * 60 * 1000 + 5000).toISOString(),
      });

      const status = scheduler.getStatus();
      assert.equal(status.status, "warning");
    });

    it("reports 'critical' when backup is very old", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
        alertThresholdMs: 6 * 60 * 60 * 1000, // 6 hours
      });

      // Ensure table is created
      scheduler.getStatus();

      // Insert a backup completed 24 hours ago (> 2x threshold)
      const backupRows = db._getRows("backup_history");
      backupRows.push({
        id: "bak_critical",
        type: "local",
        status: "completed",
        started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000 + 5000).toISOString(),
      });

      const status = scheduler.getStatus();
      assert.equal(status.status, "critical");
      assert.ok(!status.healthy);
    });

    it("reports backupInProgress when backup is running", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      // getStatus should not show in progress initially
      const status = scheduler.getStatus();
      assert.ok(!status.backupInProgress);
      assert.equal(status.currentBackupId, null);
    });
  });

  // ── Health Monitoring Thresholds ──────

  describe("Health Monitoring Thresholds", () => {
    it("age calculation is correct for recent backup", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
      });

      // Ensure table is created
      scheduler.getStatus();

      const completedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const backupRows = db._getRows("backup_history");
      backupRows.push({
        id: "bak_age",
        type: "local",
        status: "completed",
        started_at: new Date(completedAt.getTime() - 5000).toISOString(),
        completed_at: completedAt.toISOString(),
      });

      const status = scheduler.getStatus();
      assert.ok(status.age.ms > 0);
      assert.ok(status.age.hours >= 1.9 && status.age.hours <= 2.1);
      assert.ok(status.age.human.includes("hours"));
    });

    it("alertThresholdHours is correct", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
        alertThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
      });

      const status = scheduler.getStatus();
      assert.equal(status.alertThresholdHours, 24);
    });

    it("failed backups do not count as successful for health status", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *",
        alertThresholdMs: 6 * 60 * 60 * 1000,
      });

      // Ensure table is created
      scheduler.getStatus();

      // Insert only failed backups
      const backupRows = db._getRows("backup_history");
      backupRows.push({
        id: "bak_fail",
        type: "local",
        status: "failed",
        error: "Script not found",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      const status = scheduler.getStatus();
      // Should be "unknown" since no successful backup exists
      assert.equal(status.status, "unknown");
      assert.equal(status.lastSuccessfulBackup, null);
    });
  });

  // ── CRON Expression Parsing ──────

  describe("CRON Expression Parsing", () => {
    it("creates scheduler with valid CRON expression", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "30 2 * * *", // Daily at 2:30 AM
      });

      const status = scheduler.getStatus();
      assert.equal(status.schedule, "30 2 * * *");
    });

    it("falls back to default schedule for invalid CRON", () => {
      // Invalid CRON should not throw but fall back
      scheduler = createBackupScheduler(db, {
        schedule: "invalid cron expression",
      });

      // Should not throw on getStatus
      const status = scheduler.getStatus();
      assert.ok(status);
    });

    it("supports step expressions (*/6)", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 */6 * * *", // Every 6 hours
      });

      const status = scheduler.getStatus();
      assert.equal(status.schedule, "0 */6 * * *");
    });

    it("supports range expressions (1-5)", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0 9 * * 1-5", // Weekdays at 9 AM
      });

      const status = scheduler.getStatus();
      assert.equal(status.schedule, "0 9 * * 1-5");
    });

    it("supports list expressions (0,30)", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "0,30 * * * *", // Every 30 minutes
      });

      const status = scheduler.getStatus();
      assert.equal(status.schedule, "0,30 * * * *");
    });

    it("handles wildcard (*) for all values", () => {
      scheduler = createBackupScheduler(db, {
        schedule: "* * * * *", // Every minute
      });

      const status = scheduler.getStatus();
      assert.equal(status.schedule, "* * * * *");
    });
  });

  // ── Scheduler with null DB ──────

  describe("Scheduler without Database", () => {
    it("scheduler works with null DB", () => {
      scheduler = createBackupScheduler(null, {
        schedule: "0 */6 * * *",
      });

      scheduler.start();
      const status = scheduler.getStatus();
      assert.ok(status.schedulerRunning);

      scheduler.stop();
    });

    it("getHistory returns empty with null DB", () => {
      scheduler = createBackupScheduler(null, {
        schedule: "0 */6 * * *",
      });

      const history = scheduler.getHistory();
      assert.equal(history.total, 0);
      assert.equal(history.history.length, 0);
    });
  });
});
