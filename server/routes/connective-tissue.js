/**
 * Connective Tissue Routes
 *
 * Unified API surface that wires the economy engine into every lens.
 * Covers: tipping, bounties, merit credit, DTU creation/publish/list,
 * CRETI scoring, DTU compression, fork mechanism, preview system,
 * cross-lens search, emergent/bot auth, and loan eligibility.
 */

import { Router } from "express";
import {
  tipContent, postBounty, claimBounty,
  awardMeritCredit, getMeritCredit, checkLoanEligibility,
  purchaseDTU,
} from "../economy/lens-economy-wiring.js";
import {
  createDTU, listDTU, recalculateCRETI,
  compressToDMega, compressToHyper,
  forkDTU, getForkTree, getDTUPreview,
  searchDTUs,
} from "../economy/dtu-pipeline.js";
import {
  registerEmergent, registerBot, authenticateBot,
  checkLensAccess, listEntities,
} from "../economy/emergent-auth.js";

export default function connectiveTissueRoutes(db) {
  const router = Router();

  // ── TIPPING ────────────────────────────────────────────────────────

  router.post("/tip", (req, res) => {
    const { tipperId, creatorId, contentId, contentType, lensId, amount } = req.body;
    const result = tipContent(db, {
      tipperId, creatorId, contentId, contentType, lensId, amount,
      requestId: req.requestId, ip: req.ip,
    });
    res.json(result);
  });

  // ── BOUNTIES ───────────────────────────────────────────────────────

  router.post("/bounties", (req, res) => {
    const { posterId, title, description, lensId, amount, tags, expiresAt } = req.body;
    const result = postBounty(db, {
      posterId, title, description, lensId, amount, tags, expiresAt,
      requestId: req.requestId, ip: req.ip,
    });
    res.json(result);
  });

  router.post("/bounties/:bountyId/claim", (req, res) => {
    const { claimerId, posterId, solutionDtuId } = req.body;
    const result = claimBounty(db, {
      bountyId: req.params.bountyId, claimerId, posterId, solutionDtuId,
      requestId: req.requestId, ip: req.ip,
    });
    res.json(result);
  });

  router.get("/bounties", (req, res) => {
    const { lensId, status, limit, offset } = req.query;
    let sql = "SELECT * FROM bounties WHERE 1=1";
    const params = [];
    if (lensId) { sql += " AND lens_id = ?"; params.push(lensId); }
    if (status) { sql += " AND status = ?"; params.push(status); }
    else { sql += " AND status = 'OPEN'"; }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit) || 50, parseInt(offset) || 0);
    const bounties = db.prepare(sql).all(...params);
    res.json({ ok: true, bounties, count: bounties.length });
  });

  // ── MERIT CREDIT ───────────────────────────────────────────────────

  router.get("/merit/:userId", (req, res) => {
    const result = getMeritCredit(db, req.params.userId);
    res.json({ ok: true, ...result });
  });

  router.get("/loan-eligibility/:userId", (req, res) => {
    const result = checkLoanEligibility(db, req.params.userId);
    res.json({ ok: true, ...result });
  });

  // ── DTU CREATION & PUBLICATION ─────────────────────────────────────

  router.post("/dtu/create", (req, res) => {
    const result = createDTU(db, req.body);
    res.json(result);
  });

  router.post("/dtu/list", (req, res) => {
    const result = listDTU(db, req.body);
    res.json(result);
  });

  router.post("/dtu/purchase", (req, res) => {
    const { buyerId, dtuId, sellerId, amount, lensId } = req.body;
    const result = purchaseDTU(db, {
      buyerId, dtuId, sellerId, amount, lensId,
      requestId: req.requestId, ip: req.ip,
    });
    res.json(result);
  });

  // ── CRETI SCORING ──────────────────────────────────────────────────

  router.get("/dtu/:dtuId/creti", (req, res) => {
    const result = recalculateCRETI(db, req.params.dtuId);
    res.json(result);
  });

  router.post("/dtu/:dtuId/creti/recalculate", (req, res) => {
    const result = recalculateCRETI(db, req.params.dtuId);
    res.json(result);
  });

  // ── DTU COMPRESSION ────────────────────────────────────────────────

  router.post("/dtu/compress/mega", (req, res) => {
    const result = compressToDMega(db, req.body);
    res.json(result);
  });

  router.post("/dtu/compress/hyper", (req, res) => {
    const result = compressToHyper(db, req.body);
    res.json(result);
  });

  // ── FORK MECHANISM ─────────────────────────────────────────────────

  router.post("/dtu/fork", (req, res) => {
    const result = forkDTU(db, req.body);
    res.json(result);
  });

  router.get("/dtu/:dtuId/forks", (req, res) => {
    const result = getForkTree(db, req.params.dtuId);
    res.json(result);
  });

  // ── PREVIEW SYSTEM ─────────────────────────────────────────────────

  router.get("/dtu/:dtuId/preview", (req, res) => {
    const result = getDTUPreview(db, req.params.dtuId);
    res.json(result);
  });

  // ── CROSS-LENS SEARCH ─────────────────────────────────────────────

  router.get("/search", (req, res) => {
    const { q, lensId, tier, minCreti, maxPrice, sortBy, limit, offset } = req.query;
    const result = searchDTUs(db, {
      query: q, lensId, tier,
      minCreti: minCreti ? parseInt(minCreti) : 0,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      sortBy: sortBy || "creti_score",
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  });

  // ── EMERGENT / BOT AUTH ────────────────────────────────────────────

  router.post("/emergent/register", (req, res) => {
    const result = registerEmergent(db, req.body);
    res.json(result);
  });

  router.post("/bot/register", (req, res) => {
    const result = registerBot(db, req.body);
    res.json(result);
  });

  router.post("/bot/auth", (req, res) => {
    const result = authenticateBot(db, req.body.apiKey);
    res.json(result);
  });

  router.get("/entity/:entityId/access/:lensId", (req, res) => {
    const result = checkLensAccess(db, req.params.entityId, req.params.lensId);
    res.json(result);
  });

  router.get("/entities", (req, res) => {
    const { substrate, status, limit, offset } = req.query;
    const result = listEntities(db, {
      substrate, status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  });

  return router;
}
