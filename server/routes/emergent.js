/**
 * Emergent Agent Governance API routes — extracted from server.js
 * Mounted at /api/emergent
 */
const express = require("express");

module.exports = function createEmergentRouter({ makeCtx, runMacro }) {
  const router = express.Router();

  // Emergent management
  router.post("/register", async (req, res) => {
    const out = await runMacro("emergent", "register", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/list", async (req, res) => {
    const out = await runMacro("emergent", "list", req.query || {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/:id", async (req, res) => {
    const out = await runMacro("emergent", "get", { id: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.post("/:id/deactivate", async (req, res) => {
    const out = await runMacro("emergent", "deactivate", { id: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  // Dialogue sessions
  router.post("/session/create", async (req, res) => {
    const out = await runMacro("emergent", "session.create", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/session/turn", async (req, res) => {
    const out = await runMacro("emergent", "session.turn", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/session/complete", async (req, res) => {
    const out = await runMacro("emergent", "session.complete", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/session/:id", async (req, res) => {
    const out = await runMacro("emergent", "session.get", { sessionId: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.post("/session/run", async (req, res) => {
    const out = await runMacro("emergent", "session.run", req.body, makeCtx(req));
    return res.json(out);
  });

  // Governance / promotion
  router.post("/review", async (req, res) => {
    const out = await runMacro("emergent", "review", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/specialize", async (req, res) => {
    const out = await runMacro("emergent", "specialize", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/outreach", async (req, res) => {
    const out = await runMacro("emergent", "outreach", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/consent/check", async (req, res) => {
    const out = await runMacro("emergent", "consent.check", req.body, makeCtx(req));
    return res.json(out);
  });

  // Growth
  router.post("/growth/patterns", async (req, res) => {
    const out = await runMacro("emergent", "growth.patterns", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/growth/distill", async (req, res) => {
    const out = await runMacro("emergent", "growth.distill", req.body, makeCtx(req));
    return res.json(out);
  });

  // Audit / status
  router.get("/status", async (req, res) => {
    const out = await runMacro("emergent", "status", {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/gate/trace", async (req, res) => {
    const out = await runMacro("emergent", "gate.trace", req.query || {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/bundle/:id", async (req, res) => {
    const out = await runMacro("emergent", "bundle.get", { bundleId: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.get("/patterns", async (req, res) => {
    const out = await runMacro("emergent", "patterns", req.query || {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/reputation/:id", async (req, res) => {
    const out = await runMacro("emergent", "reputation", { emergentId: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.get("/schema", async (req, res) => {
    const out = await runMacro("emergent", "schema", {}, makeCtx(req));
    return res.json(out);
  });

  // Lattice operations (READ / PROPOSE / COMMIT)
  router.get("/lattice/read/:id", async (req, res) => {
    const out = await runMacro("emergent", "lattice.read", { dtuId: req.params.id, readerId: req.query.readerId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/lattice/staging/:id", async (req, res) => {
    const out = await runMacro("emergent", "lattice.readStaging", { proposalId: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.get("/lattice/query", async (req, res) => {
    const out = await runMacro("emergent", "lattice.query", req.query || {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/lattice/propose/dtu", async (req, res) => {
    const out = await runMacro("emergent", "lattice.proposeDTU", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/lattice/propose/edit", async (req, res) => {
    const out = await runMacro("emergent", "lattice.proposeEdit", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/lattice/propose/edge", async (req, res) => {
    const out = await runMacro("emergent", "lattice.proposeEdge", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/lattice/commit", async (req, res) => {
    const out = await runMacro("emergent", "lattice.commit", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/lattice/reject", async (req, res) => {
    const out = await runMacro("emergent", "lattice.reject", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/lattice/proposals", async (req, res) => {
    const out = await runMacro("emergent", "lattice.proposals", req.query || {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/lattice/metrics", async (req, res) => {
    const out = await runMacro("emergent", "lattice.metrics", {}, makeCtx(req));
    return res.json(out);
  });

  // Edge semantics
  router.post("/edge/create", async (req, res) => {
    const out = await runMacro("emergent", "edge.create", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/edge/:id", async (req, res) => {
    const out = await runMacro("emergent", "edge.get", { edgeId: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.get("/edge/query", async (req, res) => {
    const out = await runMacro("emergent", "edge.query", req.query || {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/edge/:id/update", async (req, res) => {
    const out = await runMacro("emergent", "edge.update", { edgeId: req.params.id, ...req.body }, makeCtx(req));
    return res.json(out);
  });

  router.post("/edge/:id/remove", async (req, res) => {
    const out = await runMacro("emergent", "edge.remove", { edgeId: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.get("/edge/neighborhood/:nodeId", async (req, res) => {
    const out = await runMacro("emergent", "edge.neighborhood", { nodeId: req.params.nodeId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/edge/paths", async (req, res) => {
    const out = await runMacro("emergent", "edge.paths", { fromId: req.query.fromId, toId: req.query.toId, maxDepth: req.query.maxDepth ? parseInt(req.query.maxDepth) : undefined }, makeCtx(req));
    return res.json(out);
  });

  router.get("/edge/metrics", async (req, res) => {
    const out = await runMacro("emergent", "edge.metrics", {}, makeCtx(req));
    return res.json(out);
  });

  // Activation / attention
  router.post("/activation/activate", async (req, res) => {
    const out = await runMacro("emergent", "activation.activate", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/activation/spread", async (req, res) => {
    const out = await runMacro("emergent", "activation.spread", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/activation/working-set/:sessionId", async (req, res) => {
    const out = await runMacro("emergent", "activation.workingSet", { sessionId: req.params.sessionId, k: req.query.k ? parseInt(req.query.k) : undefined }, makeCtx(req));
    return res.json(out);
  });

  router.get("/activation/global", async (req, res) => {
    const out = await runMacro("emergent", "activation.global", { k: req.query.k ? parseInt(req.query.k) : undefined }, makeCtx(req));
    return res.json(out);
  });

  router.post("/activation/decay", async (req, res) => {
    const out = await runMacro("emergent", "activation.decay", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/activation/metrics", async (req, res) => {
    const out = await runMacro("emergent", "activation.metrics", {}, makeCtx(req));
    return res.json(out);
  });

  // Conflict-safe merge
  router.post("/merge/apply", async (req, res) => {
    const out = await runMacro("emergent", "merge.apply", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/merge/resolve", async (req, res) => {
    const out = await runMacro("emergent", "merge.resolve", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/merge/conflicts/:dtuId", async (req, res) => {
    const out = await runMacro("emergent", "merge.conflicts", { dtuId: req.params.dtuId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/merge/timestamps/:dtuId", async (req, res) => {
    const out = await runMacro("emergent", "merge.timestamps", { dtuId: req.params.dtuId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/merge/metrics", async (req, res) => {
    const out = await runMacro("emergent", "merge.metrics", {}, makeCtx(req));
    return res.json(out);
  });

  // Lattice journal
  router.post("/journal/append", async (req, res) => {
    const out = await runMacro("emergent", "journal.append", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/journal/by-type/:eventType", async (req, res) => {
    const out = await runMacro("emergent", "journal.byType", { eventType: req.params.eventType, ...req.query }, makeCtx(req));
    return res.json(out);
  });

  router.get("/journal/by-entity/:entityId", async (req, res) => {
    const out = await runMacro("emergent", "journal.byEntity", { entityId: req.params.entityId, ...req.query }, makeCtx(req));
    return res.json(out);
  });

  router.get("/journal/by-session/:sessionId", async (req, res) => {
    const out = await runMacro("emergent", "journal.bySession", { sessionId: req.params.sessionId, ...req.query }, makeCtx(req));
    return res.json(out);
  });

  router.get("/journal/recent", async (req, res) => {
    const out = await runMacro("emergent", "journal.recent", { count: req.query.count ? parseInt(req.query.count) : undefined }, makeCtx(req));
    return res.json(out);
  });

  router.get("/journal/explain/:dtuId", async (req, res) => {
    const out = await runMacro("emergent", "journal.explain", { dtuId: req.params.dtuId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/journal/metrics", async (req, res) => {
    const out = await runMacro("emergent", "journal.metrics", {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/journal/compact", async (req, res) => {
    const out = await runMacro("emergent", "journal.compact", req.body, makeCtx(req));
    return res.json(out);
  });

  // Livable reality
  router.get("/reality/continuity/:emergentId", async (req, res) => {
    const out = await runMacro("emergent", "reality.continuity", { emergentId: req.params.emergentId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/reality/cost/:emergentId", async (req, res) => {
    const out = await runMacro("emergent", "reality.cost", { emergentId: req.params.emergentId, domain: req.query.domain }, makeCtx(req));
    return res.json(out);
  });

  router.post("/reality/consequences", async (req, res) => {
    const out = await runMacro("emergent", "reality.consequences", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/reality/needs", async (req, res) => {
    const out = await runMacro("emergent", "reality.needs", {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/reality/suggest/:emergentId", async (req, res) => {
    const out = await runMacro("emergent", "reality.suggest", { emergentId: req.params.emergentId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/reality/sociality", async (req, res) => {
    const out = await runMacro("emergent", "reality.sociality", { emergentA: req.query.emergentA, emergentB: req.query.emergentB }, makeCtx(req));
    return res.json(out);
  });

  router.get("/reality/explain/proposal/:proposalId", async (req, res) => {
    const out = await runMacro("emergent", "reality.explainProposal", { proposalId: req.params.proposalId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/reality/explain/trust/:dtuId", async (req, res) => {
    const out = await runMacro("emergent", "reality.explainTrust", { dtuId: req.params.dtuId }, makeCtx(req));
    return res.json(out);
  });

  router.get("/reality/belonging/:emergentId", async (req, res) => {
    const out = await runMacro("emergent", "reality.belonging", { emergentId: req.params.emergentId }, makeCtx(req));
    return res.json(out);
  });

  // Cognition scheduler
  router.post("/scheduler/item", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.createItem", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/scan", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.scan", {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/scheduler/queue", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.queue", {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/dequeue", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.dequeue", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/expire", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.expire", {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/rescore", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.rescore", {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/weights", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.updateWeights", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/scheduler/budget", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.budget", {}, makeCtx(req));
    return res.json(out);
  });

  router.get("/scheduler/budget/check", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.checkBudget", req.query || {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/budget/update", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.updateBudget", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/allocate", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.allocate", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/scheduler/allocation/:id", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.allocation", { allocationId: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  router.get("/scheduler/active", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.active", {}, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/turn", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.recordTurn", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/proposal", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.recordProposal", req.body, makeCtx(req));
    return res.json(out);
  });

  router.post("/scheduler/complete", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.complete", req.body, makeCtx(req));
    return res.json(out);
  });

  router.get("/scheduler/completed", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.completed", { limit: req.query.limit ? parseInt(req.query.limit) : undefined }, makeCtx(req));
    return res.json(out);
  });

  router.get("/scheduler/metrics", async (req, res) => {
    const out = await runMacro("emergent", "scheduler.metrics", {}, makeCtx(req));
    return res.json(out);
  });

  return router;
};
