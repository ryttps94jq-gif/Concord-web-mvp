/**
 * Repair Enhanced Routes — REST API for the Enhanced Repair Brain
 *
 * Exposes the DTU-integrated repair cortex capabilities:
 *   GET  /api/repair-enhanced/status      — current system health + stats
 *   GET  /api/repair-enhanced/predictions — active predictions
 *   GET  /api/repair-enhanced/history     — repair history with outcomes
 *   POST /api/repair-enhanced/diagnose    — manually trigger diagnosis
 *   GET  /api/repair-enhanced/knowledge   — repair knowledge base
 *   GET  /api/repair-enhanced/patterns    — known failure patterns
 *   POST /api/repair-enhanced/patterns    — register a new failure pattern
 *   GET  /api/repair-enhanced/metrics/:type — metric trend data
 */

import { asyncHandler } from "../lib/async-handler.js";
import { createRepairBrain } from "../lib/repair-enhanced.js";

/**
 * Register all repair-enhanced routes on the Express app.
 *
 * @param {import("express").Application} app
 * @param {object} deps
 * @param {import("better-sqlite3").Database} deps.db
 * @param {Function} [deps.requireRole] — middleware for role-based access
 * @param {Function} [deps.log] — structured logger
 */
export default function registerRepairEnhancedRoutes(app, {
  db,
  requireRole = () => (_req, _res, next) => next(),
  log = () => {},
}) {
  let brain;
  try {
    brain = createRepairBrain(db);
  } catch (err) {
    console.warn("[RepairEnhancedRoutes] Failed to create repair brain:", err.message);
  }

  const adminOnly = requireRole("admin");

  // ── GET /api/repair-enhanced/status ────────────────────────────────────
  app.get("/api/repair-enhanced/status", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const health = brain.runHealthCheck();
    const stats = brain.getStats();

    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
      ok: true,
      healthy: health.healthy,
      status: health.healthy ? "healthy" : "degraded",
      uptime: Math.round(process.uptime()),
      lastCheckAt: new Date().toISOString(),
      metrics: {
        memory: {
          current: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
          average: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
          peak: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
          unit: "MB",
        },
        cpu: {
          current: Math.round(cpuUsage.user / 1000),
          average: Math.round((cpuUsage.user + cpuUsage.system) / 2000),
          peak: Math.round((cpuUsage.user + cpuUsage.system) / 1000),
          unit: "ms",
        },
        disk: {
          current: 0, average: 0, peak: 0, unit: "%",
        },
      },
      recentRepairs: [],
      activePredictions: brain.getPredictions({ limit: 5 }).items,
      knowledgeBase: brain.getKnowledge("memory"),
      repairStats: {
        totalRepairs: stats.repairs.total,
        successRate: stats.repairs.successRate,
        avgRepairTime: stats.repairs.avgRepairTimeMs,
        predictionsAccuracy: stats.predictions.total > 0
          ? stats.predictions.active / Math.max(stats.predictions.total, 1)
          : 0,
      },
      health,
      stats,
    });
  }));

  // ── GET /api/repair-enhanced/predictions ───────────────────────────────
  app.get("/api/repair-enhanced/predictions", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const minConfidence = parseFloat(req.query.minConfidence) || 0;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const result = brain.getPredictions({ minConfidence, limit });

    res.json({
      ok: true,
      ...result,
    });
  }));

  // ── GET /api/repair-enhanced/history ───────────────────────────────────
  app.get("/api/repair-enhanced/history", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const success = req.query.filter === "success" ? true
      : req.query.filter === "failure" ? false
      : undefined;

    const result = brain.getHistory({ limit, offset, success });

    res.json({
      ok: true,
      ...result,
    });
  }));

  // ── POST /api/repair-enhanced/diagnose ─────────────────────────────────
  app.post("/api/repair-enhanced/diagnose", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const { issueType, symptoms, autoRepair = false } = req.body || {};

    if (!issueType) {
      return res.status(400).json({
        ok: false,
        error: "Field 'issueType' is required",
      });
    }

    const diagnosis = brain.diagnose(
      issueType,
      Array.isArray(symptoms) ? symptoms : symptoms ? [symptoms] : []
    );

    let repairResult = null;
    if (autoRepair) {
      repairResult = brain.executeRepair(diagnosis);
    }

    res.json({
      ok: true,
      diagnosis,
      repair: repairResult,
    });
  }));

  // ── GET /api/repair-enhanced/knowledge ─────────────────────────────────
  app.get("/api/repair-enhanced/knowledge", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const category = req.query.category || "memory";
    const knowledge = brain.getKnowledge(category);
    const stats = brain.getStats();

    res.json({
      ok: true,
      category,
      knowledge,
      stats,
      categories: brain.PATTERN_CATEGORIES,
    });
  }));

  // ── GET /api/repair-enhanced/patterns ──────────────────────────────────
  app.get("/api/repair-enhanced/patterns", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const filters = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.severity) filters.severity = req.query.severity;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    filters.limit = limit;

    const patterns = brain.getPatterns(filters);

    res.json({
      ok: true,
      ...patterns,
    });
  }));

  // ── POST /api/repair-enhanced/patterns ─────────────────────────────────
  app.post("/api/repair-enhanced/patterns", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const { category, subcategory, name, signature, severity, resolution } = req.body || {};

    const result = brain.registerPattern({
      category,
      subcategory: subcategory || "general",
      name: name || `Pattern: ${category}`,
      signature: signature || "",
      severity: severity || "medium",
      resolution: resolution || "",
    });

    res.status(201).json({
      ok: true,
      message: "Pattern registered",
      ...result,
    });
  }));

  // ── GET /api/repair-enhanced/metrics/:type ─────────────────────────────
  app.get("/api/repair-enhanced/metrics/:type", adminOnly, asyncHandler(async (req, res) => {
    if (!brain) {
      return res.status(503).json({ ok: false, error: "Repair system not initialized" });
    }

    const metricType = req.params.type;
    const hours = parseInt(req.query.hours, 10) || 24;
    const trend = brain.getMetricTrend(metricType, hours);

    res.json({
      ok: true,
      metricType,
      hours,
      trend,
    });
  }));

  log("info", "repair_enhanced_routes_registered", { routes: 8 });
}
