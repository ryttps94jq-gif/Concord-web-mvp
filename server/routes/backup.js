/**
 * Backup Admin Routes — Concord Cognitive Engine
 *
 * Admin-only API for managing backups: trigger, list, restore, monitor health.
 * Integrates with the backup scheduler for automated backups and S3 offsite storage.
 *
 * Routes:
 *   GET  /api/admin/backups          — List backup history
 *   POST /api/admin/backups/run      — Trigger immediate backup
 *   GET  /api/admin/backups/status   — Get backup health status
 *   GET  /api/admin/backups/s3/list  — List S3 backups
 *   POST /api/admin/backups/restore  — Trigger restore from specific backup
 */

import { asyncHandler } from "../lib/async-handler.js";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, "..", "scripts");

/**
 * Register backup admin routes.
 *
 * @param {import('express').Express} app - Express application
 * @param {object} deps - Dependencies
 * @param {Function} deps.requireRole - Role-checking middleware
 * @param {object} deps.backupScheduler - Backup scheduler instance
 * @param {import('better-sqlite3').Database} deps.db - SQLite database
 */
export default function registerBackupRoutes(app, { requireRole, backupScheduler, db }) {
  // All backup admin routes require owner or admin role
  const adminOnly = requireRole("owner", "admin");

  // ── GET /api/admin/backups — List backup history ──────────────────
  app.get("/api/admin/backups", adminOnly, asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const type = req.query.type || undefined;
    const status = req.query.status || undefined;

    if (!backupScheduler) {
      return res.json({
        ok: true,
        history: [],
        total: 0,
        warning: "Backup scheduler not initialized",
      });
    }

    const result = backupScheduler.getHistory({ limit, offset, type, status });
    return res.json({ ok: true, ...result });
  }));

  // ── POST /api/admin/backups/run — Trigger immediate backup ────────
  app.post("/api/admin/backups/run", adminOnly, asyncHandler(async (req, res) => {
    if (!backupScheduler) {
      return res.status(503).json({
        ok: false,
        error: "Backup scheduler not initialized",
      });
    }

    const result = await backupScheduler.runNow();
    return res.json(result);
  }));

  // ── GET /api/admin/backups/status — Get backup health ─────────────
  app.get("/api/admin/backups/status", adminOnly, asyncHandler(async (req, res) => {
    if (!backupScheduler) {
      return res.json({
        ok: true,
        healthy: false,
        status: "not_initialized",
        schedulerRunning: false,
        warning: "Backup scheduler not initialized",
      });
    }

    const status = backupScheduler.getStatus();

    // Also count local backup files
    let localFiles = { db: 0, artifacts: 0, totalSizeBytes: 0 };
    try {
      const { stdout } = await execFileAsync("bash", ["-c",
        `ls -la "${process.env.DATA_DIR || "/data"}/backups/" 2>/dev/null | wc -l && ` +
        `ls "${process.env.DATA_DIR || "/data"}/backups/"concord-*.db.gz 2>/dev/null | wc -l && ` +
        `ls "${process.env.DATA_DIR || "/data"}/backups/"artifacts-*.tar.gz 2>/dev/null | wc -l && ` +
        `du -sb "${process.env.DATA_DIR || "/data"}/backups/" 2>/dev/null | cut -f1`
      ], { timeout: 5000 });

      const lines = stdout.trim().split("\n");
      localFiles.db = parseInt(lines[1], 10) || 0;
      localFiles.artifacts = parseInt(lines[2], 10) || 0;
      localFiles.totalSizeBytes = parseInt(lines[3], 10) || 0;
    } catch {
      // Non-fatal — directory may not exist yet
    }

    return res.json({
      ok: true,
      ...status,
      localFiles,
    });
  }));

  // ── GET /api/admin/backups/s3/list — List S3 backups ──────────────
  app.get("/api/admin/backups/s3/list", adminOnly, asyncHandler(async (req, res) => {
    const bucket = process.env.AWS_BUCKET;
    if (!bucket) {
      return res.json({
        ok: true,
        s3Configured: false,
        backups: [],
        warning: "AWS_BUCKET not configured — S3 offsite backup disabled",
      });
    }

    try {
      const { stdout } = await execFileAsync("bash", [
        path.join(SCRIPTS_DIR, "restore-s3.sh"),
        "--list",
      ], {
        env: { ...process.env },
        timeout: 30_000,
      });

      // Parse the list output into structured data
      const lines = stdout.split("\n").filter(l => l.trim());
      const backups = [];
      let section = "";

      for (const line of lines) {
        if (line.includes("Database backups:")) {
          section = "db";
          continue;
        }
        if (line.includes("Artifact backups:")) {
          section = "artifacts";
          continue;
        }
        if (line.startsWith("[") || line.startsWith("─") || line.startsWith("Available")) {
          continue;
        }

        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("(none)")) {
          backups.push({
            type: section,
            name: trimmed,
            timestamp: trimmed.replace(/concord-|artifacts-|\.db\.gz|\.tar\.gz/g, "").trim(),
          });
        }
      }

      return res.json({
        ok: true,
        s3Configured: true,
        bucket,
        backups,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: `Failed to list S3 backups: ${err.message}`,
      });
    }
  }));

  // ── POST /api/admin/backups/restore — Trigger restore ─────────────
  app.post("/api/admin/backups/restore", requireRole("owner"), asyncHandler(async (req, res) => {
    const { timestamp, source } = req.body || {};

    if (!timestamp && source !== "latest") {
      return res.status(400).json({
        ok: false,
        error: "Either 'timestamp' (e.g. '20240101_120000') or source: 'latest' is required",
      });
    }

    const restoreSource = source || "local";
    const isS3 = restoreSource === "s3";

    // Validate timestamp format if provided
    if (timestamp && !/^\d{8}_\d{6}$/.test(timestamp)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid timestamp format. Expected: YYYYMMDD_HHMMSS (e.g. 20240101_120000)",
      });
    }

    try {
      let scriptPath;
      let args;

      if (isS3) {
        if (!process.env.AWS_BUCKET) {
          return res.status(400).json({
            ok: false,
            error: "AWS_BUCKET not configured — cannot restore from S3",
          });
        }
        scriptPath = path.join(SCRIPTS_DIR, "restore-s3.sh");
        args = timestamp ? [timestamp] : [];
      } else {
        scriptPath = path.join(SCRIPTS_DIR, "restore.sh");
        if (timestamp) {
          args = [`concord-${timestamp}.db.gz`];
        } else {
          args = [];
        }
      }

      const { stdout, stderr } = await execFileAsync("bash", [scriptPath, ...args], {
        env: { ...process.env },
        timeout: 5 * 60 * 1000, // 5 minute timeout for restores
        maxBuffer: 10 * 1024 * 1024,
      });

      // Record restore in backup_history
      if (db && backupScheduler) {
        try {
          const restoreId = `rst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
          db.prepare(`
            INSERT INTO backup_history
              (id, type, status, started_at, completed_at, metadata)
            VALUES
              (@id, @type, @status, @started_at, @completed_at, @metadata)
          `).run({
            id: restoreId,
            type: "restore",
            status: "completed",
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            metadata: JSON.stringify({
              source: restoreSource,
              timestamp: timestamp || "latest",
              triggeredBy: req.user?.id || "admin",
            }),
          });
        } catch {
          // Non-fatal — restore succeeded even if history recording fails
        }
      }

      return res.json({
        ok: true,
        message: "Restore completed successfully",
        source: restoreSource,
        timestamp: timestamp || "latest",
        output: stdout.split("\n").filter(l => l.startsWith("[Restore]") || l.startsWith("[S3-Restore]")),
        warnings: stderr ? stderr.split("\n").filter(Boolean).slice(0, 5) : [],
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: `Restore failed: ${err.message}`,
        stderr: err.stderr?.split("\n").filter(Boolean).slice(0, 10) || [],
      });
    }
  }));
}
