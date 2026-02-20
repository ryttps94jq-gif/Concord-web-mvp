/**
 * Qualia API Routes — HTTP surface for the Existential OS
 *
 * Minimal surface. 6 endpoints.
 * Follows the same patterns as routes/emergent.js.
 */
import express from "express";
import { existentialOS, groupExistentialOSByCategory } from "../existential/registry.js";

export default function createQualiaRouter() {
  const router = express.Router();

  /**
   * Helper: get qualia engine from global (set during init).
   */
  function getEngine() {
    return globalThis.qualiaEngine || null;
  }

  // GET /api/qualia/state/:entityId — Full qualia state for an entity
  router.get("/state/:entityId", (req, res) => {
    const engine = getEngine();
    if (!engine) return res.json({ ok: false, error: "qualia engine not initialized" });

    const state = engine.getQualiaState(req.params.entityId);
    if (!state) return res.json({ ok: false, error: "entity_not_found" });

    return res.json({ ok: true, state });
  });

  // GET /api/qualia/summary/:entityId — Compressed summary
  router.get("/summary/:entityId", (req, res) => {
    const engine = getEngine();
    if (!engine) return res.json({ ok: false, error: "qualia engine not initialized" });

    const summary = engine.getQualiaSummary(req.params.entityId);
    if (!summary) return res.json({ ok: false, error: "entity_not_found" });

    return res.json({ ok: true, summary });
  });

  // GET /api/qualia/all — Summary for all entities (dashboard view)
  router.get("/all", (req, res) => {
    const engine = getEngine();
    if (!engine) return res.json({ ok: false, error: "qualia engine not initialized" });

    const summaries = engine.getAllSummaries();
    return res.json({ ok: true, entities: summaries, count: summaries.length });
  });

  // GET /api/qualia/registry — Full OS registry (for frontend display)
  router.get("/registry", (_req, res) => {
    return res.json({
      ok: true,
      registry: existentialOS,
      grouped: groupExistentialOSByCategory(),
      count: existentialOS.length,
    });
  });

  // POST /api/qualia/activate — Activate an OS for an entity (sovereign only)
  router.post("/activate", (req, res) => {
    const engine = getEngine();
    if (!engine) return res.json({ ok: false, error: "qualia engine not initialized" });

    const { entityId, osKey } = req.body || {};
    if (!entityId || !osKey) {
      return res.status(400).json({ ok: false, error: "entityId and osKey required" });
    }

    const result = engine.activateOS(entityId, osKey);
    return res.json(result);
  });

  // POST /api/qualia/deactivate — Deactivate an OS for an entity (sovereign only)
  router.post("/deactivate", (req, res) => {
    const engine = getEngine();
    if (!engine) return res.json({ ok: false, error: "qualia engine not initialized" });

    const { entityId, osKey } = req.body || {};
    if (!entityId || !osKey) {
      return res.status(400).json({ ok: false, error: "entityId and osKey required" });
    }

    const result = engine.deactivateOS(entityId, osKey);
    return res.json(result);
  });

  return router;
}
