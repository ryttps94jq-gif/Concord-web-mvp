/**
 * Operations routes — extracted from server.js
 * Covers: verify, experiments, synth, jobs, agents, ingest, market, global,
 *         proposals, organs, growth, lattice, harness, style, reseed,
 *         abstraction, queues, auth/keys, orgs, research
 * Registered directly on app (mixed prefixes)
 */
module.exports = function registerOperationRoutes(app, {
  STATE,
  makeCtx,
  runMacro,
  _withAck,
  ensureOrganRegistry,
  ensureQueues,
  dtusArray,
  uid,
  sha256Hex,
  nowISO,
  saveStateDebounced,
  requireRole,
  PIPE,
  TEMPORAL_FRAMES,
  pipeListProposals,
  computeAbstractionSnapshot,
  maybeRunLocalUpgrade,
  runAutoPromotion,
  tryLoadSeedDTUs,
  toOptionADTU,
  SEED_INFO,
  kernelTick: _kernelTick,
  uiJson: _uiJson
}) {

  // Organs + Growth endpoints
  app.get("/api/organs", (req, res) => {
    ensureOrganRegistry();
    ensureQueues();
    const organs = Array.from(STATE.organs.values()).map(o => ({
      organId: o.organId,
      resolution: o.resolution,
      maturity: o.maturity,
      wear: o.wear,
      deps: o.deps,
      desc: o.desc
    }));
    res.json({ ok:true, organs });
  });

  app.get("/api/organs/:id", (req, res) => {
    ensureOrganRegistry();
    ensureQueues();
    const id = String(req.params.id || "");
    const o = STATE.organs.get(id);
    if (!o) return res.status(404).json({ ok:false, error: "Organ not found" });
    res.json({ ok:true, organ: o });
  });

  app.get("/api/growth", (req, res) => {
    ensureOrganRegistry();
    ensureQueues();
    res.json({ ok:true, growth: STATE.growth });
  });

  app.get("/api/lattice/beacon", async (req, res) => {
    try{
      const ctx = makeCtx(req);
      const out = await ctx.macro.run("lattice", "beacon", { threshold: req.query.threshold });
      res.json(out);
    } catch(e){
      res.status(500).json({ ok:false, error:String(e?.message||e), meta: e?.meta || null });
    }
  });

  app.post("/api/harness/run", async (req, res) => {
    try{
      const ctx = makeCtx(req);
      const out = await ctx.macro.run("harness", "run", req.body || {});
      res.json(out);
    } catch(e){
      res.status(500).json({ ok:false, error:String(e?.message||e), meta: e?.meta || null });
    }
  });

  // === v3 identity/account + global + marketplace + ingest endpoints (explicit HTTP surface) ===
  // These wrap existing macro domains so frontend can wire cleanly without calling /api/macros/run directly.

  app.post("/api/auth/keys", async (req,res) => {
    try {
      const input = req.body || {};
      return res.json(await runMacro("auth","createApiKey", input, makeCtx(req)));
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  app.post("/api/orgs", async (req,res) => {
    try { return res.json(await runMacro("org","create", req.body||{}, makeCtx(req))); }
    catch (e) { return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
  });

  // --- Research (engine dispatcher) ---
  app.post("/api/research/run", async (req,res) => {
    try {
      const engine = String(req.body?.engine || "math.exec");
      const input = req.body?.input ?? req.body ?? {};
      return res.json(await runMacro("research", engine, input, makeCtx(req)));
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  // --- Ingest (URL/text) ---
  app.post("/api/ingest/url", async (req,res) => {
    try {
      const url = String(req.body?.url||"").trim();
      if (!url) return res.status(400).json({ ok:false, error:"url required" });
      const out = await runMacro("crawl","fetch", { url }, makeCtx(req));
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  app.post("/api/ingest/text", (req,res) => {
    try {
      const text = String(req.body?.text||"").trim();
      const title = String(req.body?.title||"").trim();
      if (!text) return res.status(400).json({ ok:false, error:"text required" });
      // Store as a source-like object in STATE.sources so it can be referenced later by id/hash.
      const id = uid("src");
      const contentHash = sha256Hex(text);
      const src = { id, url: "", fetchedAt: nowISO(), contentHash, title: title || `Text source ${id}`, excerpt: text.slice(0,800), text, meta: { kind:"text", createdAt: nowISO() } };
      STATE.sources.set(id, src);
      return res.json({ ok:true, source: src });
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  // Unified ingest endpoint (handles both text and URL based on input)
  app.post("/api/ingest", async (req, res) => {
    try {
      const { text, url, title, tags, makeGlobal, declaredSourceType } = req.body || {};

      // Determine if this is text or URL ingest
      if (url && String(url).trim()) {
        // URL-based ingest
        const out = await runMacro("crawl", "fetch", {
          url: String(url).trim(),
          tags: tags || [],
          makeGlobal: makeGlobal || false,
          declaredSourceType: declaredSourceType || "url"
        }, makeCtx(req));
        return res.json(out);
      } else if (text && String(text).trim()) {
        // Text-based ingest
        const id = uid("src");
        const contentHash = sha256Hex(String(text).trim());
        const src = {
          id,
          url: "",
          fetchedAt: nowISO(),
          contentHash,
          title: title || `Text source ${id}`,
          excerpt: String(text).slice(0, 800),
          text: String(text).trim(),
          tags: tags || [],
          isGlobal: makeGlobal || false,
          declaredSourceType: declaredSourceType || "text",
          meta: { kind: "text", createdAt: nowISO() }
        };
        STATE.sources.set(id, src);
        saveStateDebounced();
        return res.json({ ok: true, source: src });
      } else {
        return res.status(400).json({ ok: false, error: "Either 'text' or 'url' is required" });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // Queue-based ingest (adds to processing queue)
  app.post("/api/ingest/queue", (req, res) => {
    try {
      const { text, url, title, tags, makeGlobal, declaredSourceType } = req.body || {};

      const queueItem = {
        id: uid("ingest"),
        type: url ? "url" : "text",
        payload: { text, url, title, tags, makeGlobal, declaredSourceType },
        status: "queued",
        createdAt: nowISO(),
        createdBy: req.user?.id || "anon"
      };

      ensureQueues();
      STATE.queues.ingest = STATE.queues.ingest || [];
      STATE.queues.ingest.push(queueItem);
      saveStateDebounced();

      return res.json({ ok: true, queued: true, item: queueItem });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // Jobs status endpoint
  app.get("/api/jobs/status", (req, res) => {
    try {
      const jobs = Array.from(STATE.jobs.values());
      const summary = {
        total: jobs.length,
        queued: jobs.filter(j => j.status === "queued").length,
        running: jobs.filter(j => j.status === "running").length,
        completed: jobs.filter(j => j.status === "completed").length,
        failed: jobs.filter(j => j.status === "failed").length,
        cancelled: jobs.filter(j => j.status === "cancelled").length
      };
      return res.json({
        ok: true,
        summary,
        jobs: jobs.slice(0, 100).map(j => ({
          id: j.id,
          type: j.type,
          status: j.status,
          progress: j.progress || 0,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt
        }))
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // Toggle job enabled/disabled
  app.post("/api/jobs/toggle", (req, res) => {
    try {
      const { job: jobName, enabled } = req.body || {};
      if (!jobName) return res.status(400).json({ ok: false, error: "job name required" });

      // Find jobs matching the name/type
      let toggled = 0;
      for (const [_id, job] of STATE.jobs) {
        if (job.type === jobName || job.name === jobName) {
          job.enabled = enabled !== false;
          job.updatedAt = nowISO();
          toggled++;
        }
      }

      saveStateDebounced();
      return res.json({ ok: true, toggled, enabled: enabled !== false });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // --- Global simulation / publish (explicit) ---
  app.post("/api/global/propose", async (req,res) => {
    try { return res.json(await runMacro("global","propose", req.body||{}, makeCtx(req))); }
    catch (e) { return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
  });

  app.post("/api/global/publish", async (req,res) => {
    try { return res.json(await runMacro("global","publish", req.body||{}, makeCtx(req))); }
    catch (e) { return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
  });

  app.get("/api/global/index", (req,res) => {
    try {
      const byId = STATE.globalIndex?.byId;
      const byHash = STATE.globalIndex?.byHash;
      return res.json({
        ok:true,
        counts: { byId: byId?.size||0, byHash: byHash?.size||0 },
        sample: { ids: byId ? Array.from(byId.keys()).slice(0,50) : [], hashes: byHash ? Array.from(byHash.keys()).slice(0,50) : [] }
      });
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  // --- Marketplace simulation (explicit) ---
  app.post("/api/market/listing", async (req,res) => {
    try { return res.json(await runMacro("market","listingCreate", req.body||{}, makeCtx(req))); }
    catch (e) { return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
  });

  app.get("/api/market/listings", async (req,res) => {
    try {
      const input = { limit: Number(req.query?.limit||50), offset: Number(req.query?.offset||0) };
      return res.json(await runMacro("market","list", input, makeCtx(req)));
    } catch (e) {
      return res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  });

  app.post("/api/market/buy", async (req,res) => {
    try { return res.json(await runMacro("market","buy", req.body||{}, makeCtx(req))); }
    catch (e) { return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
  });

  app.get("/api/market/library", async (req,res) => {
    try { return res.json(await runMacro("market","library", {}, makeCtx(req))); }
    catch (e) { return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
  });

  // Style
  app.get("/api/style/:sessionId", async (req, res) => {
    const out = await runMacro("style", "get", { sessionId: req.params.sessionId }, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/style/mutate", async (req, res) => {
    const out = await runMacro("style", "mutate", req.body, makeCtx(req));
    return res.json(out);
  });

  // Verify endpoints
  app.post("/api/verify/feasibility", async (req, res) => {
    const out = await runMacro("verify", "feasibility", req.body, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/verify/designScore", async (req, res) => {
    const out = await runMacro("verify", "designScore", req.body, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/verify/conflictCheck", async (req, res) => {
    const out = await runMacro("verify", "conflictCheck", req.body, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/verify/stressTest", async (req, res) => {
    const out = await runMacro("verify", "stressTest", req.body, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/verify/deriveSecondOrder", async (req, res) => {
    const out = await runMacro("verify", "deriveSecondOrder", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "derive" }));
  });

  app.post("/api/verify/lineageLink", async (req, res) => {
    const out = await runMacro("verify", "lineageLink", req.body, makeCtx(req));
    return res.json(out);
  });

  // Experiments
  app.post("/api/experiments", async (req, res) => {
    const out = await runMacro("experiment", "log", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "experiment" }));
  });

  app.get("/api/experiments", (req, res) => {
    const experiments = dtusArray().filter(d => (d.tags || []).includes("experiment"));
    return res.json({ ok: true, experiments });
  });

  app.get("/api/experiments/:id", (req, res) => {
    const dtu = STATE.dtus.get(req.params.id);
    if (!dtu || !(dtu.tags || []).includes("experiment")) {
      return res.status(404).json({ ok: false, error: "Experiment not found" });
    }
    return res.json({ ok: true, experiment: dtu });
  });

  // Synth + evolution
  app.post("/api/synth/combine", async (req, res) => {
    const out = await runMacro("synth", "combine", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "synth" }));
  });

  app.post("/api/evolution/dedupe", async (req, res) => {
    const out = await runMacro("evolution", "dedupe", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "evolution_dedupe" }));
  });

  app.post("/api/heartbeat/tick", async (req, res) => {
    const out = await runMacro("heartbeat", "tick", req.body, makeCtx(req));
    return res.json(out);
  });

  // System maintenance
  app.post("/api/system/continuity", async (req, res) => {
    const out = await runMacro("system", "continuity", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "continuity" }));
  });

  app.post("/api/system/gap-scan", async (req, res) => {
    const out = await runMacro("system", "gapScan", req.body, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/system/promotion-tick", async (req, res) => {
    const out = await runMacro("system", "promotionTick", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state", "queues"], ["/api/dtus", "/api/state/latest", "/api/queues"], null, { panel: "promotion" }));
  });

  // Temporal frames
  app.get("/api/temporal/frames", (req, res) => {
    const frames = Object.values(TEMPORAL_FRAMES);
    return res.json({ ok: true, frames });
  });

  // Proposals
  app.get("/api/proposals", (req,res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit||50)));
    res.json({ ok:true, proposals: pipeListProposals(limit), total: PIPE.proposals.size });
  });

  app.get("/api/proposals/:id", (req, res) => {
    const proposal = PIPE.proposals.get(req.params.id);
    if (!proposal) return res.status(404).json({ ok: false, error: "Proposal not found" });
    return res.json({ ok: true, proposal });
  });

  app.post("/api/proposals/:id/approve", (req, res) => {
    const proposal = PIPE.proposals.get(req.params.id);
    if (!proposal) return res.status(404).json({ ok: false, error: "Proposal not found" });

    proposal.status = "approved";
    proposal.approvedAt = nowISO();
    proposal.approvedBy = req.actor?.userId || "anon";
    saveStateDebounced();

    return res.json({ ok: true, proposal });
  });

  app.post("/api/proposals/:id/reject", (req, res) => {
    const proposal = PIPE.proposals.get(req.params.id);
    if (!proposal) return res.status(404).json({ ok: false, error: "Proposal not found" });

    proposal.status = "rejected";
    proposal.rejectedAt = nowISO();
    proposal.rejectedBy = req.actor?.userId || "anon";
    proposal.rejectReason = req.body?.reason || "";
    saveStateDebounced();

    return res.json({ ok: true, proposal });
  });

  // Jobs cancel/retry
  app.post("/api/jobs/:id/cancel", (req, res) => {
    const job = STATE.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: "Job not found" });

    if (job.status === "running") {
      return res.status(400).json({ ok: false, error: "Cannot cancel running job" });
    }

    job.status = "cancelled";
    job.updatedAt = nowISO();
    saveStateDebounced();

    return res.json({ ok: true, job });
  });

  app.post("/api/jobs/:id/retry", (req, res) => {
    const job = STATE.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: "Job not found" });

    if (job.status !== "failed") {
      return res.status(400).json({ ok: false, error: "Can only retry failed jobs" });
    }

    job.status = "queued";
    job.attempts = 0;
    job.lastError = null;
    job.runAt = nowISO();
    job.updatedAt = nowISO();
    saveStateDebounced();

    return res.json({ ok: true, job });
  });

  // Agents
  app.post("/api/agents", async (req, res) => {
    const out = await runMacro("agent", "create", req.body, makeCtx(req));
    return res.json(out);
  });

  app.get("/api/agents", (req, res) => {
    const agents = Array.from(STATE.personas.values()).filter(p =>
      p && p.goal // Simple heuristic: agents have goals
    );
    return res.json({ ok: true, agents });
  });

  app.get("/api/agents/:id", (req, res) => {
    const agent = STATE.personas.get(req.params.id);
    if (!agent || !agent.goal) {
      return res.status(404).json({ ok: false, error: "Agent not found" });
    }
    return res.json({ ok: true, agent });
  });

  app.post("/api/agents/:id/enable", async (req, res) => {
    const out = await runMacro("agent", "enable", { id: req.params.id, enabled: req.body.enabled }, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/agents/:id/tick", async (req, res) => {
    const out = await runMacro("agent", "tick", { id: req.params.id, prompt: req.body.prompt }, makeCtx(req));
    return res.json(out);
  });

  // Reseed
  app.post("/api/reseed", requireRole("owner", "admin"), async (req, res) => {
    try {
      const force = req.body?.force === true;
      if (!force && STATE.dtus.size > 0) {
        return res.json({ ok: false, error: "DTUs already exist. Pass { force: true } to reseed anyway.", currentCount: STATE.dtus.size });
      }
      const seeds = await tryLoadSeedDTUs();
      if (!seeds.length) {
        return res.json({ ok: false, error: SEED_INFO.error || "No seeds found in dtus.js", seedInfo: SEED_INFO });
      }
      let added = 0;
      for (const s of seeds) {
        // Scope Separation: reseeded DTUs enter Global scope (canonical knowledge)
        s.scope = "global";
        const d = toOptionADTU(s);
        if (!STATE.dtus.has(d.id)) {
          STATE.dtus.set(d.id, d);
          added++;
        }
      }
      saveStateDebounced();
      return res.json({ ok: true, added, total: STATE.dtus.size, scope: "global", seedInfo: SEED_INFO });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // Abstraction governor status / controls
  app.get("/api/abstraction", (req, res) => {
    try {
      const snap = computeAbstractionSnapshot();
      res.json({ ok:true, abstraction: { ...STATE.abstraction, metrics: { ...STATE.abstraction.metrics, ...snap } } });
    } catch (e) {
      res.json({ ok:false, error: String(e?.message||e) });
    }
  });

  app.post("/api/abstraction/upgrade", async (req, res) => {
    try {
      // force a local upgrade now
      STATE.abstraction.lastUpgradeAt = null;
      const r = await maybeRunLocalUpgrade();
      res.json({ ok:true, result: r, abstraction: STATE.abstraction });
    } catch (e) {
      res.json({ ok:false, error: String(e?.message||e) });
    }
  });

  // Manual consolidation trigger - creates MEGAs/HYPERs immediately
  app.post("/api/abstraction/consolidate", requireRole("owner", "admin"), async (req, res) => {
    try {
      const { maxMegas = 5, maxHypers = 2, force = false } = req.body || {};

      // Optionally bypass usage requirement for testing/manual consolidation
      if (force) {
        STATE.abstraction.metrics = STATE.abstraction.metrics || {};
        STATE.abstraction.metrics.totalUses = Math.max(STATE.abstraction.metrics.totalUses || 0, 30);
      }

      const ctx = makeCtx(req);
      const result = await runAutoPromotion(ctx, { maxNewMegas: maxMegas, maxNewHypers: maxHypers });

      res.json({
        ok: true,
        result,
        message: result.made?.megas?.length || result.made?.hypers?.length
          ? `Created ${result.made?.megas?.length || 0} MEGAs and ${result.made?.hypers?.length || 0} HYPERs`
          : "No consolidation needed (insufficient clusters or already at budget)"
      });
    } catch (e) {
      res.json({ ok: false, error: String(e?.message || e) });
    }
  });

  // ---- Queues (proposals + maintenance; never flood DTU library) ----
  app.get("/api/queues", (req,res)=>{
    ensureQueues();
    res.json({ ok:true, queues: Object.fromEntries(Object.entries(STATE.queues).map(([k,v])=>[k, v.slice(-500)])) });
  });

  app.post("/api/queues/:queue/propose", (req,res)=>{
    ensureQueues();
    const q = String(req.params.queue||"");
    if (!STATE.queues[q]) return res.status(404).json({ ok:false, error:`Unknown queue: ${q}` });
    const raw = (req.body&&typeof req.body==='object') ? req.body : {};
    const { title, description, content, tags, priority, meta, proposerOrganId, type: itemType } = raw;
    const item = { id: uid(`q_${q}`), createdAt: nowISO(), status: "queued", title, description, content, tags, priority, meta, proposerOrganId, type: itemType };
    STATE.queues[q].push(item);
    saveStateDebounced();
    res.json({ ok:true, item });
  });

  app.post("/api/queues/:queue/decide", async (req,res)=>{
    ensureQueues();
    const q = String(req.params.queue||"");
    if (!STATE.queues[q]) return res.status(404).json({ ok:false, error:`Unknown queue: ${q}` });
    const { id, decision, note } = req.body||{};
    const item = STATE.queues[q].find(x=>x && x.id===id);
    if (!item) return res.status(404).json({ ok:false, error:"Queue item not found" });
    const dec = String(decision||"").toLowerCase();
    if (!['approve','decline','revise','promote'].includes(dec)) return res.status(400).json({ ok:false, error:"decision must be approve/decline/revise/promote" });

    item.status = dec;
    item.decidedAt = nowISO();
    item.decisionNote = note || "";

    // Promotion hook: approved DTU proposals become DTUs (lineage preserved)
    let promoted = null;
    if ((dec==='approve' || dec==='promote') && item.type === 'dtu_proposal' && item.payload && typeof item.payload==='object') {
      const ctx = makeCtx(req);
      const spec = { ...item.payload, source: item.payload.source || `queue.${q}`, allowRewrite: true };
      const r = await runMacro('dtu','create', spec, ctx).catch(e=>({ ok:false, error:String(e?.message||e) }));
      promoted = r;
      item.promoted = r?.ok ? { dtuId: r.id || r.dtu?.id || null } : null;
    }

    saveStateDebounced();
    res.json({ ok:true, item, promoted });
  });
};
