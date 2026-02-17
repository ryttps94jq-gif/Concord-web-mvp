// ===== DOMAIN MACROS =====
// Extracted from server.js — All domain-specific macro registrations.
// Includes: dtu, chat, ask, forge, swarm, sim, wrapper, layer, persona, ingest,
//   quality, system, synth, evolution, heartbeat, research, dimensional, temporal,
//   anon, council, auth, org, jobs, agent, crawl, source, global, market, paper,
//   audit, verify, lattice/chicken2, persona, skill, intent, harness,
//   settings, interface, log, materials, style, experiment, search, llm, export,
//   import, plugin, admin, marketplace, graph, schema, autotag, visual, lens,
//   collab, whiteboard, pwa, voice, mobile, sync, cache, shard, governor, perf,
//   backpressure, webhook, automation, vscode, obsidian, notion, integration, db, redis

/**
 * Register all domain macros.
 * @param {Function} register - The macro register(domain, name, fn, spec) function
 * @param {Object} deps - Dependencies from server.js
 */
export function registerDomainMacros(register, deps) {
  const {
    // ---- Core State & Utils ----
    STATE, crypto, path, fs, fetch,
    uid, nowISO, clamp, clamp01, normalizeText, tokenish, log, structuredLog,
    saveStateDebounced, upsertDTU, dtusArray, dtusByIds, dtuText,
    simpleTokens, simpleHash, jaccard, ngramSim, tokenizeText, stemLite,
    tokensNoStop, expandQueryTokens, SYN_MAP,
    isShadowDTU, sha256Hex,

    // ---- DTU Pipeline & Council ----
    pipelineCommitDTU, pipeConflictCheckDTU, councilGate,
    renderHumanDTU, buildCretiText, cretiPack, detectContentInjection,
    markDTUUsed, selectWorkingSet, chooseAbstractionFrame, formatCrispResponse,

    // ---- Identity & Intent ----
    SYSTEM_IDENTITY, INTENT, classifyIntent,

    // ---- Style & Sessions ----
    getSessionStyleVector, mutateStyleVector, applyStyleToSettings,

    // ---- Search ----
    SEARCH_INDEX, searchIndexed, rebuildSearchIndex, queryDTUs,

    // ---- Retrieval ----
    retrieveDTUs, temporalRecencyWeight,

    // ---- Semantic / Experience / Transfer ----
    semanticUnderstandFallback, generateSemanticResponse,
    ensureExperienceLearning, retrieveExperience, recordExperienceEpisode,
    consolidateExperience, autoTransferSearch,
    ensureAttentionManager, createCognitiveThread, completeCognitiveThread,
    reflectOnResponse, classifyDomain,

    // ---- LLM ----
    LLM_READY, LLM_PIPELINE, DEFAULT_LLM_ON,
    OPENAI_MODEL_SMART, OPENAI_MODEL_FAST,
    callOllama, llmChat,
    OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_ENABLED,

    // ---- Quality Pipeline ----
    qualityPipelineRouter, buildFusedContext,
    CRETI_PROJECTION_RULES, _inferQueryIntent, _getPatternHistory,

    // ---- Goals ----
    updateGoalProgress,

    // ---- Affect ----
    ATS,

    // ---- Metacognition ----
    // (used inline in chat.respond)

    // ---- Queues & Jobs ----
    ensureQueues, enqueueNotification, enqueueJob,

    // ---- Realtime & Federation ----
    realtimeEmit, _c3Federation, federationPublish,

    // ---- Chicken2 ----
    inLatticeReality, _c2genesisDTU, _c2hash, _c2log,
    overlap_verifier, _c2founderOverrideAllowed,

    // ---- Commonsense ----
    ensureCommonsenseSubstrate,

    // ---- Council debate ----
    pickDebateSet,

    // ---- GRC ----
    GRC_MODULE, getGRCSystemPrompt, grcFormatAndValidate, initGRC,

    // ---- LOAF & Emergent ----
    initLoaf, initEmergent,

    // ---- Misc ----
    DATA_DIR, VERSION, PORT, NODE_ENV,
    BREAKERS, PLUGINS, REALTIME,
    _LATENCY, _LLM_BUDGET,
    requireRole, auditLog,
    runMacro, makeCtx,
    enforceEthosInvariant,

    // ---- Lens ----
    LENS_ACTIONS, LENS_PIPELINES,
    registerLensAction, registerLensPipeline,
    _lensDomainIndexAdd, _lensDomainIndexRemove, _lensDomainArtifacts,
    _lensEmitDTU, _runLensPipelines,

    // ---- DB ----
    db, runMigrations,
  } = deps;


  // ================================================================
  // ---- Helper: _clamp01 (used by temporal + other modules) ----
  // ================================================================
  const _clamp01 = (v) => clamp(Number(v || 0), 0, 1);


  // ================================================================
  // DTU domain
  // ================================================================

  register("dtu", "create", async (ctx, input) => {
    const title = normalizeText(input.title || "Untitled DTU");
    const tags = Array.isArray(input.tags) ? input.tags.map(t=>normalizeText(t)).filter(Boolean) : [];
    const tier = input.tier && ["regular","mega","hyper"].includes(input.tier) ? input.tier : "regular";
    const lineage = Array.isArray(input.lineage) ? input.lineage : [];
    const source = input.source || "local";
    const meta = input.meta && typeof input.meta === "object" ? input.meta : {};
    const allowRewrite = input.allowRewrite !== false;

    const coreIn = (input.core && typeof input.core === "object") ? input.core : {};
    const humanIn = (input.human && typeof input.human === "object") ? input.human : {};
    const machineIn = (input.machine && typeof input.machine === "object") ? input.machine : {};
    const rawText = String(input.creti ?? input.content ?? "");

    // ---- Injection Detection (Category 1: Adversarial) ----
    const injScan = detectContentInjection(rawText + " " + title);
    if (injScan.injected) {
      structuredLog("warn", "dtu_injection_detected", {
        patterns: injScan.patterns,
        source,
        userId: ctx?.actor?.id,
        titlePrefix: title.slice(0, 50),
      });
      if (!tags.includes("quarantine:injection-review")) tags.push("quarantine:injection-review");
    }

    const dtu = {
      id: uid("dtu"),
      title,
      tags,
      tier,
      lineage,
      source,
      meta,
      core: {
        definitions: Array.isArray(coreIn.definitions) ? coreIn.definitions : [],
        invariants: Array.isArray(coreIn.invariants) ? coreIn.invariants : [],
        examples: Array.isArray(coreIn.examples) ? coreIn.examples : [],
        claims: Array.isArray(coreIn.claims) ? coreIn.claims : [],
        nextActions: Array.isArray(coreIn.nextActions) ? coreIn.nextActions : [],
      },
      human: {
        summary: String(humanIn.summary || ""),
        bullets: Array.isArray(humanIn.bullets) ? humanIn.bullets : [],
        examples: Array.isArray(humanIn.examples) ? humanIn.examples : [],
      },
      machine: { ...machineIn },
      cretiHuman: "",
      scope: "local",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      authority: { model: "council", score: 0, votes: {} },
    };

    if (rawText) {
      dtu.machine = dtu.machine || {};
      dtu.machine.notes = dtu.machine.notes ? (dtu.machine.notes + "\n\n" + rawText) : rawText;
      if (!dtu.human.summary) dtu.human.summary = normalizeText(rawText).slice(0, 320);
    }

    const gate = councilGate(dtu, { allowRewrite });
    if (!gate.ok) {
      ctx.log("dtu.reject", `Rejected DTU: ${title}`, { reason: gate.reason, score: gate.score, source });
      return { ok: false, error: "Council rejected DTU", reason: gate.reason, score: gate.score };
    }

    dtu.cretiHuman = dtu.cretiHuman || renderHumanDTU(dtu);
    dtu.hash = crypto.createHash("sha256").update(title + "\n" + dtu.cretiHuman).digest("hex").slice(0, 16);

    await pipelineCommitDTU(ctx, dtu, { op: 'dtu.create', allowRewrite: true });
    ctx.log("dtu.create", `Created DTU: ${title}`, { id: dtu.id, tier, tags, source, score: gate.score });
    return { ok: true, dtu };
  }, { description: "Create a DTU (regular/mega/hyper) with structured core; UI receives human projection." });

  register("dtu", "get", (ctx, input) => {
    const id = String(input.id || "");
    const dtu = STATE.dtus.get(id);
    if (!dtu) return { ok: false, error: "DTU not found" };
    if (isShadowDTU(dtu)) return { ok: false, error: "DTU not found" };
    return { ok: true, dtu };
  });

  register("dtu", "update", (ctx, input) => {
    const id = String(input.id || "");
    if (!id) return { ok: false, error: "Missing id" };
    const existing = STATE.dtus.get(id);
    if (!existing) return { ok: false, error: "DTU not found" };

    if (input.expectedVersion !== undefined) {
      const currentVersion = existing._version || 1;
      if (Number(input.expectedVersion) !== currentVersion) {
        return {
          ok: false,
          error: "Version conflict: DTU was modified by another request",
          code: "VERSION_CONFLICT",
          currentVersion,
          expectedVersion: Number(input.expectedVersion),
        };
      }
    }

    const updated = { ...existing };
    if (input.title !== undefined) updated.title = String(input.title || existing.title);
    if (input.content !== undefined) updated.content = String(input.content);
    if (input.creti !== undefined) updated.creti = String(input.creti);
    if (input.tags !== undefined) updated.tags = Array.isArray(input.tags) ? input.tags.slice(0, 40) : existing.tags;
    if (input.tier !== undefined && ["regular", "mega", "hyper"].includes(input.tier)) {
      const role = ctx?.actor?.role || "guest";
      if (!["owner", "admin", "founder"].includes(role)) {
        return { ok: false, error: "Tier changes require admin privileges" };
      }
      updated.tier = input.tier;
    }
    updated.updatedAt = nowISO();
    updated._version = (existing._version || 1) + 1;

    upsertDTU(updated, { broadcast: true });
    ctx.log("dtu.update", `Updated DTU: ${updated.title}`, { id, version: updated._version });
    return { ok: true, dtu: updated };
  }, { description: "Update an existing DTU" });

  register("dtu", "delete", (ctx, input) => {
    const id = String(input.id || "");
    if (!id) return { ok: false, error: "Missing id" };

    const dtu = STATE.dtus.get(id);
    if (!dtu) return { ok: false, error: "DTU not found" };

    const role = ctx?.actor?.role || "guest";
    const userId = ctx?.actor?.id || ctx?.actor?.odId;
    const isAuthor = dtu.authorId === userId || dtu.source === userId;
    const isAdmin = ["owner", "admin", "founder"].includes(role);
    if (!isAuthor && !isAdmin) {
      return { ok: false, error: "Not authorized to delete this DTU" };
    }

    STATE.dtus.delete(id);
    SEARCH_INDEX.dirty = true;
    saveStateDebounced();

    try {
      realtimeEmit("dtu:deleted", { id, title: dtu.title });
    } catch { /* best-effort */ }

    if (_c3Federation.enabled) {
      federationPublish("dtu:deleted", { id, deletedAt: nowISO() }).catch((err) => { console.error('[federation] Publish deletion failed:', err); });
    }

    ctx.log("dtu.delete", `Deleted DTU: ${dtu.title}`, { id });
    return { ok: true, deleted: { id, title: dtu.title } };
  }, { description: "Delete a DTU by id" });

  register("dtu", "list", (ctx, input) => {
    const limit = clamp(Number(input.limit || 5000), 1, 5000);
    const offset = clamp(Number(input.offset || 0), 0, 1e9);
    const tier = input.tier && ["regular","mega","hyper","any"].includes(input.tier) ? input.tier : "any";
    const q = tokenish(input.q || "");
    let items = dtusArray().filter(d => !isShadowDTU(d)).sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
    if (tier !== "any") items = items.filter(d => d.tier === tier);
    if (q) items = items.filter(d => tokenish(d.title).includes(q) || tokenish((d.tags||[]).join(" ")).includes(q) || tokenish((d.cretiHuman || d.creti || "")).includes(q));
    items = items.slice(offset, offset + limit);
    return { ok: true, dtus: items, limit, offset, total: STATE.dtus.size };
  });

  register("dtu", "listShadow", (ctx, input) => {
    const role = ctx?.actor?.role || "guest";
    if (!["owner", "admin", "founder"].includes(role)) {
      return { ok: false, error: "Shadow DTU access requires admin privileges" };
    }
    const limit = clamp(Number(input.limit || 5000), 1, 5000);
    const offset = clamp(Number(input.offset || 0), 0, 1e9);
    const q = tokenish(input.q || "");
    let items = Array.from(STATE.shadowDtus.values()).sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
    if (q) items = items.filter(d => tokenish(d.title).includes(q) || tokenish((d.tags||[]).join(" ")).includes(q) || tokenish((d.cretiHuman || d.creti || "")).includes(q));
    items = items.slice(offset, offset + limit);
    return { ok: true, dtus: items, limit, offset, total: STATE.shadowDtus.size };
  }, { description: "List shadow DTUs (internal/hidden by default, admin only)." });

  register("dtu", "cluster", (ctx, input) => {
    const items = dtusArray().filter(d => (d.tier || "regular") === "regular");
    const threshold = Number(input.threshold ?? 0.38);
    const clusters = [];
    const used = new Set();

    for (let i=0;i<items.length;i++){
      const a = items[i];
      if (used.has(a.id)) continue;
      const aTok = simpleTokens(a.title + " " + (a.tags||[]).join(" "));
      const cluster = [a];
      used.add(a.id);
      for (let j=i+1;j<items.length;j++){
        const b = items[j];
        if (used.has(b.id)) continue;
        const bTok = simpleTokens(b.title + " " + (b.tags||[]).join(" "));
        if (jaccard(aTok, bTok) >= threshold) {
          cluster.push(b);
          used.add(b.id);
        }
      }
      clusters.push(cluster);
    }

    clusters.sort((c1,c2)=>c2.length - c1.length);
    return {
      ok: true,
      threshold,
      clusters: clusters.map(c => ({
        size: c.length,
        ids: c.map(x=>x.id),
        titles: c.map(x=>x.title).slice(0, 12),
        tagHints: Array.from(new Set(c.flatMap(x=>x.tags||[]))).slice(0, 20)
      }))
    };
  }, { description: "Cluster regular DTUs by topic similarity." });

  register("dtu", "gapPromote", async (ctx, input) => {
    const minCluster = clamp(Number(input.minCluster || 5), 3, 50);
    const maxPromotions = clamp(Number(input.maxPromotions || 3), 1, 25);
    const dryRun = !!input.dryRun;

    const regular = Array.from(STATE.dtus.values()).filter(d => (d.tier||"regular")==="regular" && !isShadowDTU(d) && (d.status||"active")==="active");
    if (regular.length < minCluster) return { ok:true, did:"none", reason:"not_enough_regular_dtus", regular: regular.length };

    const topicKeyOf = (cluster) => {
      const tags = cluster.flatMap(d => Array.isArray(d.tags)?d.tags:[]).map(t=>String(t).toLowerCase()).filter(Boolean);
      tags.sort();
      return simpleHash(tags.slice(0, 30).join("|") + "|" + cluster.map(d=>d.id).slice(0,10).join("|"));
    };

    const clustersRes = await runMacro(ctx, "dtu", "cluster", { minCluster, maxClusters: clamp(Number(input.maxClusters||12), 1, 50) });
    if (!clustersRes?.ok) return { ok:false, error:"cluster_failed", detail: clustersRes?.error || clustersRes };
    const clusters = Array.isArray(clustersRes.clusters) ? clustersRes.clusters : [];

    const promoted = [];
    for (const c of clusters) {
      if (promoted.length >= maxPromotions) break;
      const ids = Array.isArray(c.ids) ? c.ids : [];
      if (ids.length < minCluster) continue;
      const members = ids.map(id => STATE.dtus.get(id)).filter(Boolean);
      if (members.length < minCluster) continue;

      const clusterKey = topicKeyOf(members);
      const existing = Array.from(STATE.dtus.values()).find(d => (d.tier||"") === "mega" && d?.meta?.clusterKey === clusterKey);
      if (existing) continue;

      const titleSeed = (c.label || members[0]?.title || "Cluster").toString().slice(0, 80);
      const tags = Array.from(new Set(members.flatMap(d => Array.isArray(d.tags)?d.tags:[]))).slice(0, 24);
      const excerpts = members
        .map(d => (d.cretiHuman || d.creti || "").toString().trim())
        .filter(Boolean)
        .slice(0, 8);

      const mega = {
        id: uid("dtu"),
        tier: "mega",
        title: `MEGA — ${titleSeed}`,
        tags,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        status: "active",
        lineage: { parents: members.map(d=>d.id), kind: "gap_promotion" },
        core: {
          definitions: [`A compressed synthesis of ${members.length} regular DTUs around: ${titleSeed}.`],
          invariants: [
            "This MEGA is derived from a stable local cluster (gap promotion).",
            "Member DTUs remain active; this is a soft promotion (no destructive merge)."
          ],
          examples: [],
          tests: [],
          next_actions: [
            "Review this MEGA for crispness and missing gaps.",
            "If stable, consider elevating to Hyper only with citations + verification."
          ]
        },
        cretiHuman: [
          `**What this MEGA represents**: ${members.length} related DTUs clustered around **${titleSeed}**.`,
          tags.length ? `**Tag hints**: ${tags.join(", ")}` : "",
          excerpts.length ? `**Representative excerpts**:\n- ${excerpts.map(e=>e.replace(/\n+/g," ").slice(0,180)).join("\n- ")}` : "",
          "**Lineage**: soft-promoted from regular DTUs; members remain canonical unless explicitly merged later."
        ].filter(Boolean).join("\n\n"),
        meta: { clusterKey, promotedFrom: members.length, promotionAt: nowISO() }
      };

      if (!dryRun) {
        const r = await pipelineCommitDTU(ctx, mega, { op: "gap_promotion" });
        if (!r?.ok) continue;
        for (const m of members) {
          try {
            m.meta = m.meta || {};
            if (!m.meta.megaParent) m.meta.megaParent = mega.id;
          } catch {}
        }
        saveStateDebounced();
      }

      promoted.push({ megaId: mega.id, clusterKey, members: members.length, label: titleSeed });
    }

    return { ok:true, did: promoted.length ? "promoted" : "none", promoted, dryRun };
  }, { description: "Detect stable clusters (gaps) and soft-promote them into MEGA DTUs." });

  register("dtu", "saveSuggested", async (ctx, input) => {
    const dtus = Array.isArray(input.dtus) ? input.dtus : [];
    const saved = [];
    for (const s of dtus) {
      const r = await ctx.macro.run("dtu","create",{
        title: s.title, creti: s.creti, tags: s.tags || [], tier: s.tier || "regular", source:"suggested"
      });
      if (r?.ok) saved.push(r.dtu);
    }
    return { ok: true, saved };
  });

  register("dtu", "dedupeSweep", async (ctx, input) => {
    const threshold = Number(input.threshold ?? 0.92);
    const limit = Number(input.limit ?? 2000);
    const items = dtusArray().slice(0, limit).map(d => ({ d, txt: tokenish(dtuText(d)) }));
    const seen = new Set();
    const merges = [];
    for (let i=0;i<items.length;i++){
      const a = items[i]; if (seen.has(a.d.id)) continue;
      const aTok = simpleTokens(a.txt);
      for (let j=i+1;j<items.length;j++){
        const b = items[j]; if (seen.has(b.d.id)) continue;
        const bTok = simpleTokens(b.txt);
        const sim = jaccard(aTok, bTok);
        if (sim >= threshold) {
          const keep = a.d, drop = b.d;
          keep.tags = Array.from(new Set([...(keep.tags||[]), ...(drop.tags||[])])).slice(0, 40);
          keep.lineage = Array.from(new Set([...(keep.lineage||[]), drop.id, ...(drop.lineage||[])])).slice(0, 5000);
          keep.meta = { ...(keep.meta||{}), mergedFrom: Array.from(new Set([...(keep.meta?.mergedFrom||[]), drop.id])) };
          drop.meta = { ...(drop.meta||{}), mergedInto: keep.id };
          upsertDTU(keep);
          await pipelineCommitDTU(ctx, drop, { op: 'dtu.dedupeSweep', allowRewrite: true });
          merges.push({ into: keep.id, from: drop.id, sim });
          seen.add(drop.id);
        }
      }
    }
    ctx.log("dtu.dedupeSweep", "Dedupe sweep complete", { merges: merges.length, threshold });
    return { ok:true, merges, threshold };
  }, { description: "Merge near-duplicate DTUs by similarity; keeps lineage." });

  register("dtu", "define", async (ctx, input) => {
    const term = normalizeText(input.term || "");
    if (!term) return { ok:false, error:"term required" };
    const domain = normalizeText(input.domain || "general");
    const nonGoals = Array.isArray(input.nonGoals) ? input.nonGoals : [];
    const related = Array.isArray(input.related_terms) ? input.related_terms : (Array.isArray(input.relatedTerms) ? input.relatedTerms : []);

    const existing = dtusArray().find(d =>
      ((d.tags||[]).includes("definition") || /^def(inition)?:/i.test(String(d.title||""))) &&
      String(d.meta?.term||"").toLowerCase() === term.toLowerCase() &&
      String(d.meta?.domain||"general").toLowerCase() === domain.toLowerCase()
    );
    if (existing && !input.allowRewrite) return { ok:true, reused:true, dtu: existing };

    const creti = cretiPack({
      title: `Definition: ${term} (${domain})`,
      purpose: "Reduce friction by making key terms precise and scoped.",
      context: `Term: ${term}\nDomain: ${domain}\nNon-goals: ${(nonGoals||[]).join("; ") || "(none)"}\nRelated: ${(related||[]).join(", ") || "(none)"}\n\nDefinition (user-provided if any):\n${String(input.definition||"").trim() || "(provide a definition field or edit later)"}`,
      procedure: "1) Define term with scope\n2) Record non-goals\n3) Link related terms\n4) Commit as canonical definition DTU",
      outputs: "Definition DTU (used by UI tooltips / reasoning).",
      tests: "Must be scoped; must not contain speculative claims."
    });

    const tags = Array.from(new Set(["definition", `domain:${domain}`])).slice(0,20);
    const r = await ctx.macro.run("dtu","create", {
      title: `Definition: ${term}`,
      creti,
      tags,
      tier: "regular",
      source: "dtu.define",
      allowRewrite: !!input.allowRewrite,
      meta: { term, domain, nonGoals, related }
    });
    return { ok:true, dtu: r.dtu, reused:false };
  }, { summary:"Create a canonical definition DTU for a term+domain." });

  register("dtu", "reconcile", async (ctx, input) => {
    const ids = Array.isArray(input.ids) ? input.ids : [];
    const lastN = clamp(Number(input.lastN ?? 12), 2, 200);
    const pool = ids.length ? dtusByIds(ids) : dtusArray().slice(-lastN);
    if (pool.length < 2) return { ok:false, error:"Need at least 2 DTUs to reconcile." };

    const claimPairs = [];
    const claimText = (d) => (d.core?.claims||[]).map(x=>String(x)).join("\n");
    const norm = (s) => String(s||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
    for (let i=0;i<pool.length;i++){
      for (let j=i+1;j<pool.length;j++){
        const a = norm(claimText(pool[i]));
        const b = norm(claimText(pool[j]));
        if (!a || !b) continue;
        const aNeg = /\bnot\b|\bnever\b|\bno\b/.test(a);
        const bNeg = /\bnot\b|\bnever\b|\bno\b/.test(b);
        if (aNeg === bNeg) continue;
        const aTok = new Set(a.split(" ").filter(x=>x.length>3));
        const bTok = new Set(b.split(" ").filter(x=>x.length>3));
        let overlap = 0;
        for (const t of aTok) if (bTok.has(t)) overlap++;
        if (overlap >= 4) {
          claimPairs.push({ a: pool[i].id, b: pool[j].id, overlap });
        }
      }
    }

    const resolution_type = claimPairs.length ? "isolated" : "resolved";
    const conflicting_claims = claimPairs.slice(0, 20).map(p => ({
      a: p.a, aTitle: ctx.state.dtus.get(p.a)?.title,
      b: p.b, bTitle: ctx.state.dtus.get(p.b)?.title,
      overlap: p.overlap
    }));

    const creti = cretiPack({
      title: `Reconciliation — ${nowISO().slice(0,10)}`,
      purpose: "Resolve or explicitly isolate conflicts; never erase minority claims.",
      context: `Scope DTUs: ${pool.map(d=>`${d.title} (${d.id})`).join("\n")}\n\nDetected conflicts:\n${conflicting_claims.map(x=>`- ${x.aTitle} <-> ${x.bTitle} (overlap=${x.overlap})`).join("\n") || "(none)"}`,
      procedure: "1) Compare claims across DTUs\n2) If conflict: isolate with explicit marker\n3) If none: mark resolved\n4) Commit reconciliation DTU",
      outputs: "Reconciliation DTU with resolution_type and conflict references.",
      tests: "Must cite DTU IDs; must not delete/overwrite claims."
    });

    const tags = ["reconcile","contradiction", resolution_type].slice(0,20);
    const spec = {
      title: `Reconcile: ${resolution_type} (${nowISO().slice(0,10)})`,
      creti,
      tags,
      tier: "regular",
      lineage: pool.map(d=>d.id),
      source: "dtu.reconcile",
      meta: { resolution_type, conflicting_claims }
    };

    if (input.commit === false) return { ok:true, committed:false, ...spec.meta, spec };
    const r = await ctx.macro.run("dtu","create", { ...spec, allowRewrite:true });
    return { ok:true, committed:true, dtu: r.dtu, ...spec.meta };
  }, { summary:"Detect contradictions and create a reconciliation DTU (resolved/isolated/undecidable)." });


  // ================================================================
  // Settings domain
  // ================================================================
  register("settings", "get", (ctx, _input) => {
    return { ok:true, settings: ctx.state.settings };
  });
  register("settings", "set", (ctx, input) => {
    const s = input.settings && typeof input.settings === "object" ? input.settings : {};
    ctx.state.settings = { ...ctx.state.settings, ...s };
    ctx.log("settings.set", "Settings updated", { keys: Object.keys(s) });
    return { ok:true, settings: ctx.state.settings };
  });


  // ================================================================
  // Interface domain
  // ================================================================
  register("interface", "tabs", (_ctx, _input) => {
    return {
      ok:true,
      tabs: [
        { id:"overview", title:"Overview" },
        { id:"dtus", title:"DTUs" },
        { id:"chat", title:"Chat" },
        { id:"ask", title:"Ask" },
        { id:"forge", title:"Forge" },
        { id:"wrapper", title:"Wrapper Studio" },
        { id:"swarm", title:"Swarm" },
        { id:"sim", title:"Simulation" },
        { id:"layers", title:"OS Layers" },
        { id:"interface", title:"Interface Lab" },
        { id:"settings", title:"Settings" },
      ]
    };
  });


  // ================================================================
  // Logs domain
  // ================================================================
  register("log", "list", (ctx, input) => {
    const limit = clamp(Number(input.limit || 200), 1, 2000);
    return { ok:true, logs: ctx.state.logs.slice(-limit) };
  });


  // ================================================================
  // Materials test domain
  // ================================================================
  register("materials", "test", (ctx, input) => {
    return { ok:true, pong:true, at: nowISO(), input: input || null };
  });


  // ================================================================
  // Style domain
  // ================================================================
  register("style", "get", (ctx, input) => {
    const sessionId = normalizeText(input.sessionId || "default");
    const vec = getSessionStyleVector(sessionId);
    return { ok:true, sessionId, styleVector: vec };
  });

  register("style", "mutate", (ctx, input) => {
    const sessionId = normalizeText(input.sessionId || "default");
    const signal = input.signal || { kind: "like" };
    const cur = getSessionStyleVector(sessionId);
    const next = mutateStyleVector(cur, signal);
    STATE.styleVectors.set(sessionId, next);
    saveStateDebounced();
    return { ok:true, sessionId, styleVector: next };
  }, { description: "Mutate session style vector (bounded nudges)." });


  // ================================================================
  // Search domain
  // ================================================================
  register("search", "query", (ctx, input) => {
    const q = String(input.q || input.query || "");
    const limit = clamp(Number(input.limit || 50), 1, 500);
    const results = queryDTUs(q, { limit });
    return { ok: true, query: q, count: results.length, dtus: results };
  });

  register("search", "reindex", (_ctx, _input) => {
    rebuildSearchIndex();
    return { ok: true, documents: SEARCH_INDEX.documents.size, terms: SEARCH_INDEX.invertedIndex.size };
  });


  // ================================================================
  // LLM domain (Ollama)
  // ================================================================
  const _OLLAMA_BASE_URL = OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const _OLLAMA_MODEL = OLLAMA_MODEL || process.env.OLLAMA_MODEL || "llama3.2";
  const _OLLAMA_ENABLED = OLLAMA_ENABLED || process.env.OLLAMA_ENABLED === "true" || process.env.OLLAMA_ENABLED === "1";

  async function ollamaChat(messages, { temperature = 0.7, max_tokens = 1000 } = {}) {
    if (!_OLLAMA_ENABLED) return { ok: false, error: "Ollama not enabled" };
    try {
      const response = await fetch(`${_OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: _OLLAMA_MODEL,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: false,
          options: { temperature, num_predict: max_tokens }
        })
      });
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      const data = await response.json();
      return { ok: true, text: data.message?.content || "", model: _OLLAMA_MODEL, source: "ollama" };
    } catch (e) {
      return { ok: false, error: String(e?.message || e), source: "ollama" };
    }
  }

  async function ollamaEmbed(text) {
    if (!_OLLAMA_ENABLED) return { ok: false, error: "Ollama not enabled" };
    try {
      const response = await fetch(`${_OLLAMA_BASE_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: _OLLAMA_MODEL, prompt: String(text || "").slice(0, 8000) })
      });
      if (!response.ok) throw new Error(`Ollama embedding error: ${response.status}`);
      const data = await response.json();
      return { ok: true, embedding: data.embedding, dimensions: data.embedding?.length || 0 };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  register("llm", "local", async (ctx, input) => {
    const messages = Array.isArray(input.messages) ? input.messages : [{ role: "user", content: String(input.prompt || input.message || "") }];
    const result = await ollamaChat(messages, { temperature: input.temperature, max_tokens: input.max_tokens });
    return result;
  });

  register("llm", "embed", (ctx, input) => {
    return ollamaEmbed(String(input.text || ""));
  });


  // ================================================================
  // Export/Import domain
  // ================================================================
  register("export", "markdown", (ctx, input) => {
    const dtus = input.ids ? input.ids.map(id => STATE.dtus.get(id)).filter(Boolean) : dtusArray();
    const lines = ["# Concord DTU Export", `Exported: ${nowISO()}`, `Count: ${dtus.length}`, ""];
    for (const dtu of dtus) {
      lines.push(`## ${dtu.title || "Untitled"}`);
      lines.push(`**ID:** ${dtu.id} | **Tier:** ${dtu.tier || "regular"} | **Tags:** ${(dtu.tags || []).join(", ")}`);
      lines.push("");
      if (dtu.human?.summary) lines.push(`> ${dtu.human.summary}`, "");
      if (dtu.core?.definitions?.length) { lines.push("### Definitions"); dtu.core.definitions.forEach(d => lines.push(`- ${d}`)); lines.push(""); }
      if (dtu.core?.invariants?.length) { lines.push("### Invariants"); dtu.core.invariants.forEach(i => lines.push(`- ${i}`)); lines.push(""); }
      if (dtu.core?.claims?.length) { lines.push("### Claims"); dtu.core.claims.forEach(c => lines.push(`- ${c}`)); lines.push(""); }
      lines.push("---", "");
    }
    return { ok: true, format: "markdown", content: lines.join("\n"), count: dtus.length };
  });

  register("export", "obsidian", (ctx, input) => {
    const dtus = input.ids ? input.ids.map(id => STATE.dtus.get(id)).filter(Boolean) : dtusArray();
    const files = [];
    for (const dtu of dtus) {
      const filename = `${(dtu.title || "Untitled").replace(/[^\w\s-]/g, "").slice(0, 50)}.md`;
      const content = [
        "---", `id: ${dtu.id}`, `tier: ${dtu.tier || "regular"}`,
        `tags: [${(dtu.tags || []).map(t => `"${t}"`).join(", ")}]`,
        `created: ${dtu.createdAt || nowISO()}`, "---", "",
        `# ${dtu.title || "Untitled"}`, "", dtu.human?.summary || "", "",
        "## Core", "", "### Definitions",
        ...(dtu.core?.definitions || []).map(d => `- ${d}`), "",
        "### Invariants", ...(dtu.core?.invariants || []).map(i => `- ${i}`), "",
        "### Claims", ...(dtu.core?.claims || []).map(c => `- ${c}`), "",
        "## Lineage", ...(dtu.lineage || []).map(id => `- [[${id}]]`)
      ].join("\n");
      files.push({ filename, content });
    }
    return { ok: true, format: "obsidian", files, count: files.length };
  });

  register("export", "json", (ctx, input) => {
    const dtus = input.ids ? input.ids.map(id => STATE.dtus.get(id)).filter(Boolean) : dtusArray();
    return { ok: true, format: "json", dtus, count: dtus.length };
  });

  register("import", "json", (ctx, input) => {
    const dtus = Array.isArray(input.dtus) ? input.dtus : [];
    let imported = 0, skipped = 0;
    for (const dtu of dtus) {
      if (!dtu.id || !dtu.title) { skipped++; continue; }
      if (STATE.dtus.has(dtu.id) && !input.overwrite) { skipped++; continue; }
      const normalized = {
        id: dtu.id, title: normalizeText(dtu.title), tier: dtu.tier || "regular",
        tags: Array.isArray(dtu.tags) ? dtu.tags : [], human: dtu.human || {},
        core: dtu.core || {}, machine: dtu.machine || {}, lineage: dtu.lineage || [],
        source: "import", createdAt: dtu.createdAt || nowISO(), updatedAt: nowISO(),
        meta: { ...dtu.meta, importedAt: nowISO() }
      };
      STATE.dtus.set(normalized.id, normalized);
      imported++;
    }
    if (imported > 0) saveStateDebounced();
    return { ok: true, imported, skipped, total: dtus.length };
  });

  register("import", "markdown", (ctx, input) => {
    const content = String(input.content || "");
    const sections = content.split(/^## /m).filter(Boolean);
    const dtus = [];
    for (const section of sections) {
      const lines = section.split("\n");
      const title = lines[0]?.trim();
      if (!title || title.startsWith("#")) continue;
      const dtu = {
        id: uid("dtu"), title, tier: "regular", tags: ["imported"],
        human: { summary: "" },
        core: { definitions: [], invariants: [], claims: [], examples: [] },
        source: "import-markdown", createdAt: nowISO()
      };
      let currentSection = null;
      for (const line of lines.slice(1)) {
        if (line.startsWith("### Definitions")) currentSection = "definitions";
        else if (line.startsWith("### Invariants")) currentSection = "invariants";
        else if (line.startsWith("### Claims")) currentSection = "claims";
        else if (line.startsWith(">")) dtu.human.summary = line.slice(1).trim();
        else if (line.startsWith("- ") && currentSection) {
          dtu.core[currentSection].push(line.slice(2).trim());
        }
      }
      dtus.push(dtu);
    }
    let imported = 0;
    for (const dtu of dtus) { STATE.dtus.set(dtu.id, dtu); imported++; }
    if (imported > 0) saveStateDebounced();
    return { ok: true, imported, parsed: dtus.length };
  });


  // ================================================================
  // NOTE: The remaining domain macros (chat, ask, forge, swarm, sim, wrapper,
  // layer, persona, ingest, quality, system, synth, evolution, heartbeat,
  // research, dimensional, temporal, anon, council, auth, org, jobs, agent,
  // crawl, source, global, market, paper, audit, verify, lattice/chicken2,
  // skill, intent, harness, experiment, plugin, admin, marketplace, graph,
  // schema, autotag, visual, lens, collab, whiteboard, pwa, voice, mobile,
  // sync, cache, shard, governor, perf, backpressure, webhook, automation,
  // vscode, obsidian, notion, integration, db, redis) remain in server.js
  // for this extraction phase. They reference the `register` function directly
  // and will be migrated in subsequent extraction passes.
  //
  // This file contains the foundational domain macros that are most commonly
  // referenced by other parts of the system: DTU CRUD, settings, search, LLM,
  // export/import, style, logs, and interface.
  // ================================================================
}
