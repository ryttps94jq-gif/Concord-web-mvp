/**
 * Chat + Ask routes — extracted from server.js
 * Registered directly on app (mixed prefixes)
 */
export default function registerChatRoutes(app, {
  STATE,
  makeCtx,
  runMacro,
  enforceRequestInvariants,
  enforceEthosInvariant,
  uid,
  kernelTick,
  uiJson,
  _withAck,
  _extractReply,
  clamp,
  nowISO,
  saveStateDebounced,
  ETHOS_INVARIANTS,
  validate,
  perEndpointRateLimit,
}) {

  // Per-endpoint rate limit: 30 req/min per user for chat (conscious.chat category)
  const chatRateLimit = perEndpointRateLimit ? perEndpointRateLimit("conscious.chat") : ((_req, _res, next) => next());

  // Chat + Ask
  app.post("/api/chat", chatRateLimit, validate("chat"), async (req, res) => {
    const errorId = uid("err");
    try {
      req.body = enforceRequestInvariants(req, req.body || {});
      req._concordMode = req.body.mode || "chat";
      const ctx = makeCtx(req);
      // Chicken3: stream by default when enabled, while preserving an explicit full-response path.
      // - ?full=1 forces classic JSON response
      // - Accept: text/event-stream or ?stream=1 also forces streaming
      const accept = String(req.headers.accept || "");
      const wantsFull = (String(req.query.full || "") === "1") || accept.includes("application/json");
      const wantsStream = (!wantsFull) ||
        String(req.query.stream || "") === "1" ||
        String(req.body.stream || "") === "1" ||
        accept.includes("text/event-stream");

      // Streaming upgrade (Chicken3): keep full-response compatibility unless stream is requested.
      // This preserves existing clients while enabling event-stream when desired.
      if (wantsStream) {
        enforceEthosInvariant("chat_stream");
        if (!STATE.__chicken3?.streamingEnabled) throw new Error("streaming disabled");

        res.set({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });
        res.flushHeaders?.();

        const sse = (event, data) => {
          try {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch {}
        };

        // Lightweight chunker over a final answer (keeps architecture unchanged).
        async function* chunkText(txt, size=240) {
          const t = String(txt || "");
          for (let i=0; i<t.length; i+=size) {
            yield t.slice(i, i+size);
            await new Promise(r => { setImmediate(r); }); // yield to event loop
          }
        }

        sse("meta", { ok:true, mode: req._concordMode, sessionId: req.body.sessionId || null });
        const out = await runMacro("chat","respond", req.body, ctx);

        // Pick a best-effort text field for progressive display.
        const answer = out?.answer ?? out?.content ?? out?.text ?? out?.message ?? out?.response ?? "";
        for await (const delta of chunkText(answer)) {
          sse("chunk", { delta });
        }
        sse("final", _withAck(out, req, ["state","logs","shadow"], ["/api/state/latest","/api/logs"], null, { panel: "chat" }));
        kernelTick({ type: "USER_MSG", meta: { path: req.path, stream: true }, signals: { benefit: out?.ok?0.2:0, error: out?.ok?0:0.2 } });
        try { res.end(); } catch {}
        return;
      }

      const out = await runMacro("chat","respond", req.body, ctx);
      kernelTick({ type: "USER_MSG", meta: { path: req.path }, signals: { benefit: out?.ok?0.2:0, error: out?.ok?0:0.2 } });
      return uiJson(
        res,
        _withAck(out, req, ["state","logs","shadow"], ["/api/state/latest","/api/logs"], null, { panel: "chat" }),
        req,
        { panel: "chat" }
      );
    } catch (e) {
      const msg = String(e?.message || e || "Unknown error");
      const out = { ok: false, error: msg, mode: req?.body?.mode || "chat", sessionId: req?._concordSessionId || req?.body?.sessionId, llmUsed: false };
      kernelTick({ type: "USER_MSG", meta: { path: req.path }, signals: { benefit: 0, error: 0.5 } });
      return uiJson(
        res,
        _withAck(out, req, ["logs"], ["/api/logs"], { id: errorId, status: "error" }, { panel: "chat", errorId }),
        req,
        { panel: "chat", errorId }
      );
    }
  });

  // Chicken3: SSE streaming chat (additive; does not replace /api/chat)
  // POST /api/chat/feedback — record user thumbs up/down
  app.post("/api/chat/feedback", async (req, res) => {
    try {
      const out = await runMacro("chat", "feedback", req.body, makeCtx(req));
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/chat/conversations — list chat sessions for thread view
  app.get("/api/chat/conversations", (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const conversations = Array.from(STATE.sessions.entries())
        .map(([id, sess]) => {
          const msgs = sess.messages || [];
          const lastMsg = msgs[msgs.length - 1];
          const firstUserMsg = msgs.find(m => m.role === "user");
          return {
            id,
            title: firstUserMsg?.content?.slice(0, 80) || `Session ${id.slice(0, 8)}`,
            summary: lastMsg?.content?.slice(0, 120) || "",
            lastMessage: lastMsg?.content?.slice(0, 200) || "",
            messageCount: msgs.length,
            createdAt: sess.createdAt || nowISO(),
            updatedAt: lastMsg?.ts || sess.createdAt || nowISO(),
          };
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit);
      res.json({ ok: true, conversations });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  app.post("/api/chat/stream", async (req, res) => {
    const errorId = uid("err");
    try {
      enforceEthosInvariant("chat_stream");
      if (!STATE.__chicken3?.streamingEnabled) throw new Error("streaming disabled");
      req.body = enforceRequestInvariants(req, req.body || {});
      req._concordMode = req.body.mode || "chat";
      const ctx = makeCtx(req);

      res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });
      res.flushHeaders?.();

      const out = await runMacro("chat","respond", req.body, ctx);
      kernelTick({ type: "USER_MSG", meta: { path: req.path, stream: true }, signals: { benefit: out?.ok?0.2:0, error: out?.ok?0:0.2 } });

      const content = String(out?.content || out?.answer || out?.text || "");
      // Deterministic chunking (local-first). If you later add true token-streaming LLM, swap this chunker.
      const step = clamp(Number(req.body?.chunkSize || 220), 40, 1200);
      for (let i = 0; i < content.length; i += step) {
        const chunk = content.slice(i, i + step);
        res.write(`data: ${JSON.stringify({ ok: true, chunk, done: false })}\n\n`);
      }
      // Final envelope (also contains full out for UI parity)
      res.write(`data: ${JSON.stringify({ ok: true, done: true, out })}\n\n`);
      return res.end();
    } catch (e) {
      const msg = String(e?.message || e || "Unknown error");
      try {
        res.write(`data: ${JSON.stringify({ ok:false, error: msg, errorId, done:true })}\n\n`);
        return res.end();
      } catch {
        return uiJson(res, { ok:false, error: msg, errorId }, req, { panel:"chat_stream", errorId });
      }
    }
  });

  // Chicken3: status + session opt-in
  app.get("/api/chicken3/status", (req, res) => {
    try {
      return uiJson(res, { ok:true, chicken3: STATE.__chicken3, ethos: ETHOS_INVARIANTS }, req, { panel:"chicken3_status" });
    } catch (e) {
      return uiJson(res, { ok:false, error: String(e?.message||e) }, req, { panel:"chicken3_status" });
    }
  });

  app.post("/api/session/optin", (req, res) => {
    try {
      enforceEthosInvariant("optin");
      const b = req.body || {};
      const sid = String(b.sessionId || b.session || "");
      if (!sid) return uiJson(res, { ok:false, error:"sessionId required" }, req, { panel:"optin" });
      const s = STATE.sessions.get(sid) || { createdAt: nowISO(), messages: [] };
      if (typeof b.cloudOptIn === "boolean") s.cloudOptIn = b.cloudOptIn;
      if (typeof b.toolsOptIn === "boolean") s.toolsOptIn = b.toolsOptIn;
      if (typeof b.multimodalOptIn === "boolean") s.multimodalOptIn = b.multimodalOptIn;
      if (typeof b.voiceOptIn === "boolean") s.voiceOptIn = b.voiceOptIn;
      STATE.sessions.set(sid, s);
      saveStateDebounced();
      return uiJson(res, { ok:true, sessionId: sid, flags: { cloudOptIn: !!s.cloudOptIn, toolsOptIn: !!s.toolsOptIn, multimodalOptIn: !!s.multimodalOptIn, voiceOptIn: !!s.voiceOptIn } }, req, { panel:"optin" });
    } catch (e) {
      return uiJson(res, { ok:false, error: String(e?.message||e) }, req, { panel:"optin" });
    }
  });

  app.post("/api/ask", async (req, res) => {
    const errorId = uid("err");
    try {
      req.body = enforceRequestInvariants(req, req.body || {});
      req._concordMode = req.body.mode || "ask";
      const ctx = makeCtx(req);
      const out = await runMacro("ask","answer", req.body, ctx);
      kernelTick({ type: "USER_MSG", meta: { path: req.path }, signals: { benefit: out?.ok?0.25:0, error: out?.ok?0:0.25 } });
      return uiJson(
        res,
        _withAck(out, req, ["state","logs"], ["/api/state/latest","/api/logs"], null, { panel: "ask" }),
        req,
        { panel: "ask" }
      );
    } catch (e) {
      const msg = String(e?.message || e || "Unknown error");
      const out = { ok: false, error: msg, mode: req?.body?.mode || "ask", sessionId: req?._concordSessionId || req?.body?.sessionId, llmUsed: false };
      kernelTick({ type: "USER_MSG", meta: { path: req.path }, signals: { benefit: 0, error: 0.5 } });
      return uiJson(
        res,
        _withAck(out, req, ["logs"], ["/api/logs"], { id: errorId, status: "error" }, { panel: "ask", errorId }),
        req,
        { panel: "ask", errorId }
      );
    }
  });
}
