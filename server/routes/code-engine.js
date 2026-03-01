/**
 * Code Engine Routes — Concord Self-Expanding Code Engine API
 *
 * Exposes the code engine pipeline: repository ingestion, pattern extraction,
 * Mega DTU compression, autonomous lens generation, and error learning.
 *
 * Routes:
 *   GET  /api/code-engine/stats              — Engine statistics
 *   POST /api/code-engine/ingest             — Ingest a repository
 *   GET  /api/code-engine/repositories       — List repositories
 *   GET  /api/code-engine/repositories/:id   — Get repository details
 *   GET  /api/code-engine/patterns           — Search/list patterns
 *   GET  /api/code-engine/patterns/:id       — Get pattern details
 *   POST /api/code-engine/compress           — Compress patterns to Mega DTU
 *   GET  /api/code-engine/megas              — List Mega DTUs
 *   GET  /api/code-engine/megas/:id          — Get Mega DTU details
 *   POST /api/code-engine/generate-lens      — Generate a lens from patterns
 *   GET  /api/code-engine/generations        — List lens generations
 *   GET  /api/code-engine/generations/:id    — Get generation details
 *   POST /api/code-engine/errors             — Record a production error
 *   GET  /api/code-engine/errors             — List errors with filters
 */

import { asyncHandler } from "../lib/async-handler.js";
import { createCodeEngine } from "../lib/code-engine.js";
import { ValidationError } from "../lib/errors.js";

/**
 * Register code engine routes on the Express app.
 *
 * @param {import('express').Express} app - Express application
 * @param {object} deps - Dependencies
 * @param {import('better-sqlite3').Database} deps.db - SQLite database
 */
export default function registerCodeEngineRoutes(app, { db }) {
  const engine = createCodeEngine(db);

  const PREFIX = "/api/code-engine";

  // ── GET /api/code-engine/stats — Engine statistics ──────────────────

  app.get(`${PREFIX}/stats`, asyncHandler(async (_req, res) => {
    const stats = engine.getStats();
    res.json({ ok: true, ...stats });
  }));

  // ── POST /api/code-engine/ingest — Ingest a repository ─────────────

  app.post(`${PREFIX}/ingest`, asyncHandler(async (req, res) => {
    const { url, options } = req.body || {};

    if (!url) {
      throw new ValidationError("url is required", { field: "url" });
    }

    const result = engine.ingestRepository(url, options || {});
    res.status(201).json({ ok: true, ...result });
  }));

  // ── GET /api/code-engine/repositories — List repositories ──────────

  app.get(`${PREFIX}/repositories`, asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = engine.listRepositories({ limit, offset });
    res.json({ ok: true, ...result });
  }));

  // ── GET /api/code-engine/repositories/:id — Repository details ─────

  app.get(`${PREFIX}/repositories/:id`, asyncHandler(async (req, res) => {
    const repo = engine.getRepository(req.params.id);
    res.json({ ok: true, repository: repo });
  }));

  // ── GET /api/code-engine/patterns — Search/list patterns ───────────

  app.get(`${PREFIX}/patterns`, asyncHandler(async (req, res) => {
    const query = {
      category: req.query.category || undefined,
      language: req.query.language || undefined,
      keyword: req.query.keyword || req.query.q || undefined,
      repositoryId: req.query.repositoryId || req.query.repoId || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };

    const result = engine.searchPatterns(query);
    res.json({ ok: true, ...result });
  }));

  // ── GET /api/code-engine/patterns/:id — Pattern details ────────────

  app.get(`${PREFIX}/patterns/:id`, asyncHandler(async (req, res) => {
    const pattern = engine.getPattern(req.params.id);
    res.json({ ok: true, pattern });
  }));

  // ── POST /api/code-engine/compress — Compress to Mega DTU ──────────

  app.post(`${PREFIX}/compress`, asyncHandler(async (req, res) => {
    const { topic, minPatterns, category, eliteCount } = req.body || {};

    if (!topic) {
      throw new ValidationError("topic is required", { field: "topic" });
    }

    const mega = engine.compressToMega(topic, {
      minPatterns: minPatterns ? Number(minPatterns) : undefined,
      category: category || undefined,
      eliteCount: eliteCount ? Number(eliteCount) : undefined,
    });

    res.status(201).json({ ok: true, mega });
  }));

  // ── GET /api/code-engine/megas — List Mega DTUs ────────────────────

  app.get(`${PREFIX}/megas`, asyncHandler(async (req, res) => {
    const result = engine.listMegas({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ ok: true, ...result });
  }));

  // ── GET /api/code-engine/megas/:id — Mega DTU details ──────────────

  app.get(`${PREFIX}/megas/:id`, asyncHandler(async (req, res) => {
    const mega = engine.getMega(req.params.id);
    res.json({ ok: true, mega });
  }));

  // ── POST /api/code-engine/generate-lens — Generate a lens ──────────

  app.post(`${PREFIX}/generate-lens`, asyncHandler(async (req, res) => {
    const { request, constraints } = req.body || {};

    if (!request) {
      throw new ValidationError("request is required", { field: "request" });
    }

    const generation = engine.generateLens(request, constraints || {});
    const statusCode = generation.status === "completed" ? 201 : 200;
    res.status(statusCode).json({ ok: true, generation });
  }));

  // ── GET /api/code-engine/generations — List lens generations ───────

  app.get(`${PREFIX}/generations`, asyncHandler(async (req, res) => {
    const result = engine.listGenerations({
      status: req.query.status || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ ok: true, ...result });
  }));

  // ── GET /api/code-engine/generations/:id — Generation details ──────

  app.get(`${PREFIX}/generations/:id`, asyncHandler(async (req, res) => {
    const generation = engine.getGeneration(req.params.id);
    res.json({ ok: true, generation });
  }));

  // ── POST /api/code-engine/errors — Record a production error ───────

  app.post(`${PREFIX}/errors`, asyncHandler(async (req, res) => {
    const { lensId, errorType, stackTrace, context } = req.body || {};

    if (!errorType) {
      throw new ValidationError("errorType is required", { field: "errorType" });
    }

    const error = engine.recordError(lensId || null, {
      errorType,
      stackTrace: stackTrace || null,
      context: context || {},
    });

    res.status(201).json({ ok: true, error });
  }));

  // ── GET /api/code-engine/errors — List errors with filters ─────────

  app.get(`${PREFIX}/errors`, asyncHandler(async (req, res) => {
    const result = engine.listErrors({
      lensId: req.query.lensId || undefined,
      errorType: req.query.errorType || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ ok: true, ...result });
  }));
}
