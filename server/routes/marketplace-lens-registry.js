/**
 * Marketplace Lens Registry Routes
 *
 * REST API for browsing, searching, and querying the complete
 * 112-lens marketplace ecosystem with DTU types, economics,
 * citation maps, and cross-lens references.
 */

import { Router } from "express";
import {
  seedMarketplaceLensRegistry,
  getMarketplaceLens,
  browseMarketplaceLenses,
  getAllDTUTypes,
  getCitationMap,
  getMarketplaceRegistryStats,
  searchLenses,
  getLensesByCategory,
  getLensesByClassification,
  LENS_CATEGORIES,
} from "../economy/marketplace-lens-service.js";
import {
  getFullLensSpec,
  getFullRegistrySummary,
} from "../lib/marketplace-lens-registry.js";

export default function marketplaceLensRegistryRoutes(db) {
  const router = Router();

  /**
   * GET /api/marketplace-lens-registry/stats
   * Registry-wide statistics: total lenses, DTU types, categories, disrupted industries
   */
  router.get("/stats", (_req, res) => {
    const stats = getMarketplaceRegistryStats();
    res.json(stats);
  });

  /**
   * GET /api/marketplace-lens-registry/categories
   * All lens categories with descriptions
   */
  router.get("/categories", (_req, res) => {
    res.json({ ok: true, categories: LENS_CATEGORIES });
  });

  /**
   * GET /api/marketplace-lens-registry/browse
   * Browse lenses with filters: category, classification, hasMarketplace, search
   */
  router.get("/browse", (req, res) => {
    const { category, classification, marketplace, search, limit, offset } = req.query;
    const result = browseMarketplaceLenses(db, {
      category: category || undefined,
      classification: classification || undefined,
      hasMarketplace: marketplace === "true" || undefined,
      search: search || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(result);
  });

  /**
   * GET /api/marketplace-lens-registry/search
   * Search lenses by keyword (in-memory, faster)
   */
  router.get("/search", (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ ok: true, results: [], count: 0 });

    const results = searchLenses(q);
    res.json({
      ok: true,
      results: results.map(l => ({
        id: l.id,
        name: l.name,
        lensNumber: l.lensNumber,
        category: l.category,
        classification: l.classification,
        uniqueValue: l.uniqueValue,
        dtuCount: l.marketplaceDTUs.length,
      })),
      count: results.length,
    });
  });

  /**
   * GET /api/marketplace-lens-registry/lens/:lensId
   * Full lens detail including all marketplace DTU types
   */
  router.get("/lens/:lensId", (req, res) => {
    const result = getMarketplaceLens(db, req.params.lensId);
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  });

  /**
   * GET /api/marketplace-lens-registry/lens/:lensId/citations
   * Citation map: which lenses this lens cites and which cite it
   */
  router.get("/lens/:lensId/citations", (req, res) => {
    const result = getCitationMap(db, req.params.lensId);
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  });

  /**
   * GET /api/marketplace-lens-registry/dtu-types
   * All DTU types across all marketplace lenses
   */
  router.get("/dtu-types", (_req, res) => {
    const result = getAllDTUTypes(db);
    res.json(result);
  });

  /**
   * GET /api/marketplace-lens-registry/by-category/:category
   * Get all lenses in a category (in-memory lookup)
   */
  router.get("/by-category/:category", (req, res) => {
    const lenses = getLensesByCategory(req.params.category);
    res.json({
      ok: true,
      category: req.params.category,
      lenses: lenses.map(l => ({
        id: l.id,
        name: l.name,
        lensNumber: l.lensNumber,
        classification: l.classification,
        dtuCount: l.marketplaceDTUs.length,
        uniqueValue: l.uniqueValue,
      })),
      count: lenses.length,
    });
  });

  /**
   * GET /api/marketplace-lens-registry/by-classification/:classification
   * Get all lenses with a given classification
   */
  router.get("/by-classification/:classification", (req, res) => {
    const lenses = getLensesByClassification(req.params.classification);
    res.json({
      ok: true,
      classification: req.params.classification,
      lenses: lenses.map(l => ({
        id: l.id,
        name: l.name,
        lensNumber: l.lensNumber,
        category: l.category,
        dtuCount: l.marketplaceDTUs.length,
      })),
      count: lenses.length,
    });
  });

  /**
   * GET /api/marketplace-lens-registry/lens/:lensId/full
   * Full lens spec including marketplace data AND feature specification
   */
  router.get("/lens/:lensId/full", (req, res) => {
    const spec = getFullLensSpec(req.params.lensId);
    if (!spec) return res.status(404).json({ ok: false, error: "lens_not_found" });
    res.json({ ok: true, lens: spec });
  });

  /**
   * GET /api/marketplace-lens-registry/full-summary
   * Combined summary: marketplace registry + feature stats
   */
  router.get("/full-summary", (_req, res) => {
    const summary = getFullRegistrySummary();
    res.json({ ok: true, ...summary });
  });

  /**
   * POST /api/marketplace-lens-registry/seed
   * Seed all 112 lenses into the database (admin only, idempotent)
   */
  router.post("/seed", (req, res) => {
    const result = seedMarketplaceLensRegistry(db);
    res.json(result);
  });

  return router;
}
