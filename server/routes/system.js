/**
 * System routes — extracted from server.js
 * Covers: health, ready, metrics, status, backup, time, weather, state/latest,
 *         LLM pipeline, quality-pipeline, root, stats, health/capabilities,
 *         health/deep, api/metrics (chicken2), DTU paginated, openapi, docs,
 *         search/indexed, search/dsl, search/reindex, global/search
 */
module.exports = function registerSystemRoutes(app, {
  STATE,
  makeCtx,
  runMacro,
  requireRole,
  db,
  MACROS,
  VERSION,
  PORT,
  NODE_ENV,
  LLM_READY,
  OPENAI_MODEL_FAST,
  OPENAI_MODEL_SMART,
  SEED_INFO,
  STATE_DISK,
  USE_SQLITE_STATE,
  ENV_VALIDATION,
  AUTH_MODE,
  CAPS,
  METRICS,
  JWT_SECRET,
  AUTH_USES_JWT,
  AUTH_USES_APIKEY,
  AuthDB,
  rateLimiter,
  helmet,
  normalizeText,
  nowISO,
  clamp,
  dtusArray,
  isShadowDTU,
  saveStateDebounced: _saveStateDebounced,
  listDomains,
  getLLMPipelineStatus,
  setLLMPipelineMode,
  llmPipeline,
  getTimeInfo,
  getWeather,
  createBackup,
  listBackups,
  restoreBackup,
  ensureOrganRegistry,
  ensureQueues,
  _getPatternHistory,
  classifyDomain,
  _inferQueryIntent,
  CRETI_PROJECTION_RULES,
  searchIndexed,
  paginateResults,
  auditLog: _auditLog
}) {

  // ---- Root ----
  app.get("/", (req, res) => res.json({ ok:true, name:"Concord v2 Macro\u2011Max", version: VERSION }));

  // ---- Health & Readiness ----
  app.get("/health", (req, res) => {
    const checks = { server: true };
    let healthy = true;
    if (db) {
      try {
        const row = db.prepare("SELECT 1 AS ok").get();
        checks.database = Boolean(row?.ok);
      } catch {
        checks.database = false;
        healthy = false;
      }
    } else {
      checks.database = "no_db";
    }
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1048576);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1048576);
    checks.memoryMB = { used: heapUsedMB, total: heapTotalMB };
    if (heapUsedMB > 1700) {
      checks.memoryPressure = true;
      healthy = false;
    }
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "degraded",
      version: VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks
    });
  });

  app.get("/ready", (req, res) => {
    const checks = {
      state: STATE.dtus !== null,
      macros: MACROS.size > 0
    };
    if (db) {
      try {
        db.prepare("SELECT 1").get();
        checks.database = true;
      } catch {
        checks.database = false;
      }
    }
    const ready = Object.values(checks).every(v => v === true || v === "no_db");
    res.status(ready ? 200 : 503).json({
      ready,
      checks,
      version: VERSION
    });
  });

  app.get("/metrics", async (req, res) => {
    if (!METRICS.enabled || !METRICS.registry) {
      return res.status(501).json({ ok: false, error: "Metrics not enabled" });
    }
    try {
      res.set("Content-Type", METRICS.registry.contentType);
      res.end(await METRICS.registry.metrics());
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message) });
    }
  });

  // ---- Backup ----
  app.post("/api/backup", requireRole("owner", "admin"), async (req, res) => {
    const result = await createBackup(req.body.name);
    res.json(result);
  });
  app.get("/api/backups", requireRole("owner", "admin"), (req, res) => {
    res.json(listBackups());
  });
  app.post("/api/backup/restore", requireRole("owner"), async (req, res) => {
    const result = await restoreBackup(req.body.path || req.body.name);
    res.json(result);
  });

  // ---- Status ----
  app.get("/api/status", (req, res) => {
    const base = {
      ok: true,
      version: VERSION,
      nodeEnv: NODE_ENV,
      uptime: process.uptime(),
      llmReady: LLM_READY,
      counts: {
        dtus: STATE.dtus.size,
        wrappers: STATE.wrappers.size,
        layers: STATE.layers.size,
        personas: STATE.personas.size,
      },
      sims: STATE.lastSim ? 1 : 0,
    };
    const isAuthed = req.user || req.apiKeyUser;
    if (isAuthed) {
      Object.assign(base, {
        port: PORT,
        openaiModel: { fast: OPENAI_MODEL_FAST, smart: OPENAI_MODEL_SMART },
        macroDomains: listDomains(),
        crawlQueue: STATE.crawlQueue.length,
        settings: STATE.settings,
        seed: SEED_INFO,
        stateDisk: STATE_DISK,
        infrastructure: {
          database: { type: db ? "sqlite" : "json", ready: Boolean(db) },
          stateBackend: { type: USE_SQLITE_STATE ? "sqlite" : "json" },
          auth: {
            mode: AUTH_MODE,
            totalUsers: AuthDB.getUserCount(),
            jwtConfigured: Boolean(JWT_SECRET),
            usesJwt: AUTH_USES_JWT,
            usesApiKey: AUTH_USES_APIKEY
          },
          security: {
            csrfEnabled: NODE_ENV === "production",
            rateLimitEnabled: Boolean(rateLimiter),
            helmetEnabled: Boolean(helmet)
          },
          envValidation: ENV_VALIDATION,
          llmPipeline: getLLMPipelineStatus(),
          capabilities: CAPS
        }
      });
    }
    res.json(base);
  });

  // ---- LLM Pipeline API ----
  app.get("/api/llm/status", (req, res) => {
    res.json({ ok: true, ...getLLMPipelineStatus() });
  });
  app.post("/api/llm/generate", async (req, res) => {
    const { prompt, mode, temperature, maxTokens } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ ok: false, error: "prompt required" });
    }
    const result = await llmPipeline(prompt, { mode, temperature, maxTokens });
    res.json(result);
  });
  app.post("/api/llm/mode", requireRole("owner", "admin"), (req, res) => {
    const { mode } = req.body || {};
    const result = setLLMPipelineMode(mode);
    res.json(result);
  });

  // ---- Quality Pipeline ----
  app.get("/api/quality-pipeline/status", (req, res) => {
    const sessionId = req.query.sessionId || "";
    const shadowCount = STATE.shadowDtus ? STATE.shadowDtus.size : 0;
    const patternShadows = Array.from(STATE.shadowDtus?.values() || []).filter(s => s?.machine?.kind === "pattern_shadow").length;
    const history = sessionId ? _getPatternHistory(sessionId) : [];
    res.json({
      ok: true,
      pipeline: {
        version: "1.0.0",
        patterns: {
          P1: { name: "Shadow DTU Distillation", alwaysRun: false, condition: "shadow DTU matches exist" },
          P2: { name: "CRETI Projection", alwaysRun: true, condition: "always" },
          P3: { name: "Linguistic Spine Rewrite", alwaysRun: false, condition: "non-default style/affect" },
          P4: { name: "Multi-Lens Convergence", alwaysRun: false, condition: "multi-domain query" },
          P5: { name: "Contradiction Pre-Resolution", alwaysRun: false, condition: "conflict detected in set" },
          P6: { name: "Resonance-Weighted Micro-Prompt", alwaysRun: true, condition: "always" }
        },
        shadowDtus: { total: shadowCount, patternShadows },
        sessionHistory: history,
        maxConcurrent: 3,
        backendEnhancements: ["coherenceAudit", "shadowPromotion", "crispnessDecay"]
      }
    });
  });

  app.post("/api/quality-pipeline/preview", (req, res) => {
    try {
      const { query, sessionId, mode } = req.body || {};
      if (!query) return res.json({ ok: false, error: "Missing query" });
      const sid = sessionId || "preview";
      const pseudoDtu = { title: String(query).slice(0, 100), human: { summary: String(query).slice(0, 300) }, tags: [] };
      const domain = classifyDomain(pseudoDtu);
      const intent = _inferQueryIntent(query, mode || "explore");
      const history = _getPatternHistory(sid);
      res.json({
        ok: true,
        preview: {
          queryIntent: intent,
          domain,
          recentPatterns: history,
          projectionRules: CRETI_PROJECTION_RULES[intent] || CRETI_PROJECTION_RULES.default
        }
      });
    } catch (e) {
      res.json({ ok: false, error: String(e?.message || e) });
    }
  });

  // ---- Time (authoritative; never uses LLM) ----
  app.get("/api/time", (req, res) => {
    try {
      const tz = String(req.query.tz || "America/New_York");
      return res.json({ ok:true, ...getTimeInfo(tz) });
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  // ---- Weather (authoritative; cached; never uses LLM) ----
  app.get("/api/weather", async (req, res) => {
    try {
      const location = String(req.query.location || req.query.q || "Poughkeepsie, NY");
      const tz = String(req.query.tz || "America/New_York");
      const out = await getWeather(location, { timeZone: tz });
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  // ---- State Snapshot ----
  app.get("/api/state/latest", (req, res) => {
    try {
      const sessionId = normalizeText(req.query.sessionId || "default");
      const sess = STATE.sessions.get(sessionId) || { createdAt: null, messages: [] };
      const lastMessages = (sess.messages || []).slice(-20);
      const latestDTUs = dtusArray().slice(0, 10).map(d => ({
        id: d.id,
        title: d.title,
        tier: d.tier,
        tags: d.tags || [],
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }));
      res.json({
        ok: true,
        sessionId,
        session: { createdAt: sess.createdAt || null, turns: lastMessages.length },
        lastMessages,
        latestDTUs,
        lastSim: STATE.lastSim || null,
        settings: STATE.settings
      });
    } catch (e) {
      res.json({ ok: false, error: String(e?.message || e) });
    }
  });

  // ---- Chicken2 Metrics ----
  app.get("/api/metrics", (req, res) => {
    ensureOrganRegistry();
    ensureQueues();
    const c2 = STATE.__chicken2 || {};
    res.json({ ok:true, metrics: c2.metrics, lastProof: c2.lastProof, recentLogs: (c2.logs||[]).slice(-50) });
  });

  // ---- Health Capabilities ----
  app.get("/api/health/capabilities", (req, res) => {
    ensureOrganRegistry();
    ensureQueues();
    const cap = {
      version: VERSION,
      llmReady: LLM_READY,
      dtus: STATE.dtus.size,
      wrappers: STATE.wrappers.size,
      layers: STATE.layers.size,
      personas: STATE.personas.size,
      sessions: STATE.sessions.size,
      organs: STATE.organs.size,
      growth: STATE.growth,
      abstraction: STATE.abstraction,
    };
    res.json({ ok:true, capabilities: cap });
  });

  // ---- Stats ----
  app.get("/api/stats", (req, res) => {
    const stats = {
      dtus: {
        total: STATE.dtus.size,
        byTier: {
          regular: dtusArray().filter(d => d.tier === "regular").length,
          mega: dtusArray().filter(d => d.tier === "mega").length,
          hyper: dtusArray().filter(d => d.tier === "hyper").length,
          shadow: STATE.shadowDtus.size
        }
      },
      sessions: {
        total: STATE.sessions.size,
        active: Array.from(STATE.sessions.values()).filter(s => {
          const last = (s.messages || [])[s.messages.length - 1];
          return last && (Date.now() - new Date(last.ts).getTime()) < 3600000;
        }).length
      },
      organs: {
        total: STATE.organs.size,
        healthy: Array.from(STATE.organs.values()).filter(o => o.status === "alive").length
      },
      growth: STATE.growth,
      abstraction: {
        enabled: STATE.abstraction.enabled,
        metrics: STATE.abstraction.metrics,
        ledger: STATE.abstraction.ledger
      },
      queues: Object.fromEntries(
        Object.entries(STATE.queues || {}).map(([k, v]) => [k, v.length])
      ),
      jobs: {
        total: STATE.jobs.size,
        queued: Array.from(STATE.jobs.values()).filter(j => j.status === "queued").length,
        running: Array.from(STATE.jobs.values()).filter(j => j.status === "running").length,
        succeeded: Array.from(STATE.jobs.values()).filter(j => j.status === "succeeded").length,
        failed: Array.from(STATE.jobs.values()).filter(j => j.status === "failed").length
      }
    };
    return res.json({ ok: true, stats });
  });

  // ---- Health API ----
  app.get("/api/health", (req, res) => {
    const health = {
      status: "healthy",
      version: VERSION,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: nowISO(),
      checks: {
        state: STATE ? "ok" : "error",
        dtus: STATE.dtus.size > 0 ? "ok" : "warning",
        llm: LLM_READY ? "ok" : "disabled",
        organs: STATE.organs.size > 0 ? "ok" : "warning",
        growth: STATE.growth ? "ok" : "warning"
      }
    };
    const hasErrors = Object.values(health.checks).some(v => v === "error");
    health.status = hasErrors ? "unhealthy" : "healthy";
    return res.status(hasErrors ? 503 : 200).json(health);
  });

  app.get("/api/health/deep", (req, res) => {
    const checks = [];
    checks.push({
      name: "state_integrity",
      status: STATE && typeof STATE === "object" ? "pass" : "fail",
      details: { hasState: !!STATE }
    });
    const allPassed = checks.every(c => c.status === "pass");
    return res.status(allPassed ? 200 : 503).json({
      ok: allPassed,
      status: allPassed ? "healthy" : "unhealthy",
      checks,
      timestamp: nowISO()
    });
  });

  // ---- DTU Paginated ----
  app.get("/api/dtus/paginated", (req, res) => {
    const page = clamp(Number(req.query.page || 1), 1, 10000);
    const pageSize = clamp(Number(req.query.pageSize || 20), 1, 100);
    const tier = req.query.tier || null;
    const tag = req.query.tag || null;
    let dtus = dtusArray();
    if (tier) dtus = dtus.filter(d => d.tier === tier);
    if (tag) dtus = dtus.filter(d => (d.tags || []).includes(tag));
    const result = paginateResults(dtus, { page, pageSize });
    return res.json({ ok: true, ...result });
  });

  // ---- Search (indexed, DSL, reindex, global) ----
  app.get("/api/search/indexed", (req, res) => {
    const q = String(req.query.q || "");
    const limit = clamp(Number(req.query.limit || 20), 1, 100);
    const results = searchIndexed(q, { limit });
    return res.json({ ok: true, query: q, results, count: results.length });
  });

  app.get("/api/search/dsl", async (req, res) => {
    const out = await runMacro("search", "query", { q: req.query.q, limit: req.query.limit }, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/search/reindex", async (req, res) => {
    const out = await runMacro("search", "reindex", {}, makeCtx(req));
    return res.json(out);
  });

  app.get("/api/global/search", (req, res) => {
    const query = String(req.query.q || "").trim();
    const scope = String(req.query.scope || "all");
    const limit = clamp(Number(req.query.limit || 20), 1, 100);
    if (!query) return res.json({ ok: true, results: [], query: "", count: 0 });
    const results = [];
    if (scope === "all" || scope === "dtus") {
      const indexed = searchIndexed(query, { limit, minScore: 0.01 });
      for (const dtu of indexed) {
        results.push({
          id: dtu.id,
          type: "dtu",
          title: dtu.title || "Untitled",
          excerpt: dtu.human?.summary || dtu.cretiHuman || (dtu.core?.definitions || []).slice(0, 1).join("") || "",
          tier: dtu.tier || "regular",
          tags: (dtu.tags || []).slice(0, 5),
          createdAt: dtu.createdAt,
          score: dtu._searchScore || 0
        });
      }
    }
    if (scope === "all" || scope === "tags") {
      const qLower = query.toLowerCase();
      const tagCounts = new Map();
      for (const dtu of dtusArray()) {
        if (isShadowDTU(dtu)) continue;
        for (const tag of (dtu.tags || [])) {
          if (tag.toLowerCase().includes(qLower)) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
      }
      const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      for (const [tag, count] of sortedTags) {
        results.push({
          id: `tag:${tag}`,
          type: "tag",
          title: tag,
          excerpt: `${count} DTU${count !== 1 ? "s" : ""} tagged`,
          score: count / 100
        });
      }
    }
    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return res.json({ ok: true, results: results.slice(0, limit), query, count: results.length });
  });
};
