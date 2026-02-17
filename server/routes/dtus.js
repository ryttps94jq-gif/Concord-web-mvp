/**
 * DTU routes — extracted from server.js
 * Registered directly on app (mixed prefixes)
 */
module.exports = function registerDtuRoutes(app, { STATE, makeCtx, runMacro, dtuForClient, dtusArray, _withAck, saveStateDebounced: _saveStateDebounced }) {

  // CRETI-first DTU view (no raw JSON by default)
  app.get("/api/dtu_view/:id", (req, res) => {
    const id = req.params.id;
    const d = STATE.dtus.get(id);
    if (!d) return res.status(404).json({ ok:false, error:"DTU not found" });
    return res.json({ ok:true, dtu: dtuForClient(d, { raw: req.query.raw === "1" }) });
  });


  // DTUs
  app.get("/api/dtus", async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","list",{ q:req.query.q, tier:req.query.tier || "any", limit:req.query.limit, offset:req.query.offset }, ctx);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  });
  app.get("/api/dtus/:id", async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","get",{ id:req.params.id }, ctx);
      if (!out.ok) return res.status(404).json(out);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  });
  app.post("/api/dtus", async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","create", req.body || {}, ctx);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  });
  app.post("/api/dtus/saveSuggested", async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","saveSuggested", req.body || {}, ctx);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  });

  // DTU maintenance
  app.post("/api/dtus/dedupe", async (req,res)=> {
    const out = await runMacro("dtu","dedupeSweep", req.body||{}, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus","state","logs"], ["/api/dtus","/api/state/latest","/api/logs"], null, { panel: "dtus_dedupe" }));
  });
  app.get("/api/megas", (req,res)=> {
    const tier = "mega";
    const out = dtusArray().filter(d => d.tier===tier).sort((a,b)=> (b.updatedAt||b.createdAt||"").localeCompare(a.updatedAt||a.createdAt||""));
    res.json({ ok:true, megas: out });
  });
  app.get("/api/hypers", (req,res)=> {
    const out = dtusArray().filter(d => d.tier==="hyper").sort((a,b)=> (b.updatedAt||b.createdAt||"").localeCompare(a.updatedAt||a.createdAt||""));
    res.json({ ok:true, hypers: out });
  });

  // Extended DTU endpoints
  app.put("/api/dtus/:id", async (req, res) => {
    const out = await runMacro("dtu", "update", { id: req.params.id, ...req.body }, makeCtx(req));
    return res.json(out);
  });

  // PATCH is an alias for PUT — frontend client.ts sends PATCH for partial updates
  app.patch("/api/dtus/:id", async (req, res) => {
    const out = await runMacro("dtu", "update", { id: req.params.id, ...req.body }, makeCtx(req));
    return res.json(out);
  });

  app.delete("/api/dtus/:id", async (req, res) => {
    // Note: You may need to create a dtu.delete macro first
    const out = await runMacro("dtu", "delete", { id: req.params.id }, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/dtus/cluster", async (req, res) => {
    const out = await runMacro("dtu", "cluster", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus"], ["/api/dtus"], null, { panel: "cluster" }));
  });

  app.post("/api/dtus/reconcile", async (req, res) => {
    const out = await runMacro("dtu", "reconcile", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "reconcile" }));
  });

  app.post("/api/dtus/define", async (req, res) => {
    const out = await runMacro("dtu", "define", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus"], ["/api/dtus"], null, { panel: "define" }));
  });

  app.get("/api/dtus/shadow", async (req, res) => {
    const out = await runMacro("dtu", "listShadow", { limit: req.query.limit, q: req.query.q }, makeCtx(req));
    return res.json(out);
  });

  app.post("/api/dtus/gap-promote", async (req, res) => {
    const out = await runMacro("dtu", "gapPromote", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "gap_promote" }));
  });

  app.get("/api/definitions", (req, res) => {
    const dtus = dtusArray().filter(d =>
      (d.tags || []).includes("definition") ||
      /^def(inition)?:/i.test(d.title || "")
    );
    return res.json({ ok: true, definitions: dtus });
  });

  app.get("/api/definitions/:term", (req, res) => {
    const term = String(req.params.term || "").toLowerCase();
    const dtu = dtusArray().find(d =>
      ((d.tags || []).includes("definition") || /^def(inition)?:/i.test(d.title || "")) &&
      (d.meta?.term || "").toLowerCase() === term
    );
    if (!dtu) return res.status(404).json({ ok: false, error: "Definition not found" });
    return res.json({ ok: true, definition: dtu });
  });
};
