/**
 * Sovereign Decree Extension — Emergent Systems (Systems 1–12)
 *
 * Additive router that wires all 13 emergent systems into sovereign decree handling.
 * Mounted alongside existing sovereign router. Silent failure throughout.
 *
 * Pattern: POST /api/sovereign-emergent/decree { action, target, data }
 */
import express from "express";
import crypto from "crypto";

const SOVEREIGN_USERNAME = process.env.SOVEREIGN_USERNAME || "dutch";

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function nowISO() {
  return new Date().toISOString();
}

function getSTATE() {
  if (globalThis._concordSTATE) return globalThis._concordSTATE;
  if (globalThis.STATE) return globalThis.STATE;
  return null;
}

function createSovereignDTU(STATE, action, input, output) {
  if (!STATE || !STATE.dtus) return null;
  try {
    const dtu = {
      id: uid("dtu"),
      type: "sovereign_action",
      title: `Sovereign: ${action}`,
      human: { summary: `Sovereign decree: ${action}` },
      machine: { kind: "sovereign_action", action, input: input || {}, output: typeof output === "object" ? output : { result: output } },
      source: "sovereign",
      authority: { model: "sovereign", score: 1.0 },
      tags: ["sovereign", "emergent-systems", action],
      tier: "shadow",
      scope: "local",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    STATE.dtus.set(dtu.id, dtu);
    try { if (typeof globalThis.saveStateDebounced === "function") globalThis.saveStateDebounced(); } catch { /* silent */ }
    try { if (typeof globalThis.realtimeEmit === "function") globalThis.realtimeEmit("dtu:created", { dtu: { id: dtu.id, type: dtu.type, tags: dtu.tags } }); } catch { /* silent */ }
    return dtu;
  } catch { return null; }
}

// ── Lazy-load modules (silent failure if not yet written) ──────────────────

async function loadModule(path) {
  try { return await import(path); } catch { return null; }
}

export default function createSovereignEmergentRouter({ STATE }) {
  const router = express.Router();

  // Sovereign auth middleware
  function requireSovereign(req, res, next) {
    const user = req.user?.username || req.user?.handle || req.user?.id || req.session?.user?.username || "";
    const role = req.user?.role || "";
    if (user === SOVEREIGN_USERNAME || role === "owner") return next();
    return res.status(403).json({ ok: false, error: "sovereign access required" });
  }

  router.use(requireSovereign);

  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/sovereign-emergent/decree — Extended decree handler
  // ════════════════════════════════════════════════════════════════════════════
  router.post("/decree", async (req, res) => {
    const S = STATE || getSTATE();
    if (!S) return res.json({ ok: false, error: "STATE not available" });

    const { action, target, data } = req.body || {};
    if (!action) return res.status(400).json({ ok: false, error: "action required" });

    let result;

    try {
      switch (action) {

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 1: PLANETARY INGEST ENGINE
        // ══════════════════════════════════════════════════════════════════════

        case "ingest": {
          const mod = await loadModule("../emergent/ingest-engine.js");
          if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
          const url = target || data?.url;
          if (!url) return res.json({ ok: false, error: "url required" });
          result = mod.submitUrl("sovereign", url, "sovereign");
          break;
        }

        case "ingest-queue": {
          const mod = await loadModule("../emergent/ingest-engine.js");
          if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
          result = { ok: true, queue: mod.getQueue() };
          break;
        }

        case "ingest-stats": {
          const mod = await loadModule("../emergent/ingest-engine.js");
          if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
          result = { ok: true, stats: mod.getIngestStats() };
          break;
        }

        case "ingest-allowlist": {
          const mod = await loadModule("../emergent/ingest-engine.js");
          if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
          if (data?.action === "add" && data?.domain) {
            mod.addToAllowlist(data.domain);
            result = { ok: true, added: data.domain };
          } else if (data?.action === "remove" && data?.domain) {
            mod.removeFromAllowlist(data.domain);
            result = { ok: true, removed: data.domain };
          } else {
            result = { ok: true, allowlist: mod.getAllowlist() };
          }
          break;
        }

        case "ingest-block": {
          const mod = await loadModule("../emergent/ingest-engine.js");
          if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
          if (!data?.domain) return res.json({ ok: false, error: "data.domain required" });
          mod.addToBlocklist(data.domain);
          result = { ok: true, blocked: data.domain };
          break;
        }

        case "ingest-flush": {
          const mod = await loadModule("../emergent/ingest-engine.js");
          if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
          result = mod.flushQueue();
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 2: HLR / HLM ENGINE
        // ══════════════════════════════════════════════════════════════════════

        case "reason": {
          const mod = await loadModule("../emergent/hlr-engine.js");
          if (!mod) return res.json({ ok: false, error: "hlr-engine not available" });
          const topic = target || data?.topic;
          if (!topic) return res.json({ ok: false, error: "topic required" });
          result = mod.runHLR({ topic, question: data?.question, context: data?.context, relatedDTUs: data?.relatedDTUs, depth: data?.depth || "normal", mode: data?.mode || "deductive" });
          break;
        }

        case "reason-mode": {
          const mod = await loadModule("../emergent/hlr-engine.js");
          if (!mod) return res.json({ ok: false, error: "hlr-engine not available" });
          result = { ok: true, modes: mod.REASONING_MODES };
          break;
        }

        case "reason-traces": {
          const mod = await loadModule("../emergent/hlr-engine.js");
          if (!mod) return res.json({ ok: false, error: "hlr-engine not available" });
          result = { ok: true, traces: mod.listTraces(Number(data?.limit) || 20) };
          break;
        }

        case "map": {
          const mod = await loadModule("../emergent/hlm-engine.js");
          if (!mod) return res.json({ ok: false, error: "hlm-engine not available" });
          const dtus = S.dtus ? Array.from(S.dtus.values()) : [];
          result = { ok: true, ...mod.runHLMPass(dtus) };
          break;
        }

        case "map-gaps": {
          const mod = await loadModule("../emergent/hlm-engine.js");
          if (!mod) return res.json({ ok: false, error: "hlm-engine not available" });
          const dtus = S.dtus ? Array.from(S.dtus.values()) : [];
          const clusters = mod.clusterAnalysis(dtus);
          result = { ok: true, gaps: mod.gapAnalysis(clusters) };
          break;
        }

        case "map-topology": {
          const mod = await loadModule("../emergent/hlm-engine.js");
          if (!mod) return res.json({ ok: false, error: "hlm-engine not available" });
          const dtus = S.dtus ? Array.from(S.dtus.values()) : [];
          result = { ok: true, topology: mod.topologyMap(dtus) };
          break;
        }

        case "map-redundancies": {
          const mod = await loadModule("../emergent/hlm-engine.js");
          if (!mod) return res.json({ ok: false, error: "hlm-engine not available" });
          const dtus = S.dtus ? Array.from(S.dtus.values()) : [];
          result = { ok: true, redundancies: mod.redundancyDetection(dtus) };
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 3: CONCORD AGENTS
        // ══════════════════════════════════════════════════════════════════════

        case "agent-create": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          const type = target || data?.type;
          if (!type) return res.json({ ok: false, error: "type required" });
          result = mod.createAgent(type, data?.config || {});
          break;
        }

        case "agent-list": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          result = { ok: true, agents: mod.listAgents() };
          break;
        }

        case "agent-status": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          if (!target) return res.json({ ok: false, error: "target (agent id) required" });
          const agent = mod.getAgent(target);
          if (!agent) return res.json({ ok: false, error: `Agent ${target} not found` });
          result = { ok: true, agent };
          break;
        }

        case "agent-pause": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.pauseAgent(target);
          break;
        }

        case "agent-resume": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.resumeAgent(target);
          break;
        }

        case "agent-destroy": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.destroyAgent(target);
          break;
        }

        case "agent-findings": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          if (target) {
            result = { ok: true, findings: mod.getAgentFindings(target, Number(data?.limit) || 50) };
          } else {
            result = { ok: true, findings: mod.getAllFindings(data?.type, Number(data?.limit) || 50) };
          }
          break;
        }

        case "agents-freeze": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          result = mod.freezeAllAgents();
          break;
        }

        case "agents-thaw": {
          const mod = await loadModule("../emergent/agent-system.js");
          if (!mod) return res.json({ ok: false, error: "agent-system not available" });
          result = mod.thawAllAgents();
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 4: HYPOTHESIS ENGINE
        // ══════════════════════════════════════════════════════════════════════

        case "hypothesis": case "hypothesis-create": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          const statement = target || data?.statement;
          if (!statement) return res.json({ ok: false, error: "statement required" });
          result = mod.proposeHypothesis(statement, data?.domain, data?.priority);
          break;
        }

        case "hypotheses": case "hypothesis-list": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          result = { ok: true, hypotheses: mod.listHypotheses(target || data?.status) };
          break;
        }

        case "hypo-status": case "hypothesis-status": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          if (!target) return res.json({ ok: false, error: "target (hypothesis id) required" });
          const hypo = mod.getHypothesis(target);
          if (!hypo) return res.json({ ok: false, error: `Hypothesis ${target} not found` });
          result = { ok: true, hypothesis: hypo };
          break;
        }

        case "hypo-evidence": case "hypothesis-evidence": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          const side = data?.side || "for";
          result = mod.addEvidence(target, side, data?.dtuId || uid("dtu"), Number(data?.weight) || 0.5, data?.summary || "Evidence");
          break;
        }

        case "hypo-test": case "hypothesis-test": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          if (data?.testId && data?.result) {
            result = mod.updateTestResult(target, data.testId, data.result);
          } else if (data?.description) {
            result = mod.addTest(target, data.description);
          } else {
            return res.json({ ok: false, error: "data.testId+result or data.description required" });
          }
          break;
        }

        case "hypo-confirm": case "hypothesis-confirm": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.confirmHypothesis(target);
          break;
        }

        case "hypo-reject": case "hypothesis-reject": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.rejectHypothesis(target, data?.reason || "Sovereign rejection");
          break;
        }

        case "hypo-refine": case "hypothesis-refine": {
          const mod = await loadModule("../emergent/hypothesis-engine.js");
          if (!mod) return res.json({ ok: false, error: "hypothesis-engine not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          if (!data?.statement) return res.json({ ok: false, error: "data.statement required" });
          result = mod.refineHypothesis(target, data.statement);
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 5: RESEARCH JOBS
        // ══════════════════════════════════════════════════════════════════════

        case "research": {
          const mod = await loadModule("../emergent/research-jobs.js");
          if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
          const topic = target || data?.topic;
          if (!topic) return res.json({ ok: false, error: "topic required" });
          result = mod.submitResearchJob(topic, { depth: "normal", ...data?.config });
          break;
        }

        case "research-deep": {
          const mod = await loadModule("../emergent/research-jobs.js");
          if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
          const topic = target || data?.topic;
          if (!topic) return res.json({ ok: false, error: "topic required" });
          result = mod.submitResearchJob(topic, { depth: "deep", ...data?.config });
          break;
        }

        case "research-queue": {
          const mod = await loadModule("../emergent/research-jobs.js");
          if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
          result = { ok: true, jobs: mod.listResearchJobs(data?.status) };
          break;
        }

        case "research-status": {
          const mod = await loadModule("../emergent/research-jobs.js");
          if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          const job = mod.getResearchJob(target);
          if (!job) return res.json({ ok: false, error: `Job ${target} not found` });
          result = { ok: true, job };
          break;
        }

        case "research-cancel": {
          const mod = await loadModule("../emergent/research-jobs.js");
          if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.cancelResearchJob(target);
          break;
        }

        case "research-results": {
          const mod = await loadModule("../emergent/research-jobs.js");
          if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = { ok: true, results: mod.getResearchResults(target) };
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 6: QUEST ENGINE
        // ══════════════════════════════════════════════════════════════════════

        case "quest-create": {
          const mod = await loadModule("../emergent/quest-engine.js");
          if (!mod) return res.json({ ok: false, error: "quest-engine not available" });
          const title = target || data?.title;
          if (!title) return res.json({ ok: false, error: "title required" });
          result = mod.createQuest(title, data || {});
          break;
        }

        case "quest-list": {
          const mod = await loadModule("../emergent/quest-engine.js");
          if (!mod) return res.json({ ok: false, error: "quest-engine not available" });
          result = { ok: true, quests: mod.listQuests(data) };
          break;
        }

        case "quest-status": {
          const mod = await loadModule("../emergent/quest-engine.js");
          if (!mod) return res.json({ ok: false, error: "quest-engine not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          const quest = mod.getQuest(target);
          if (!quest) return res.json({ ok: false, error: `Quest ${target} not found` });
          result = { ok: true, quest };
          break;
        }

        case "quest-release": {
          const mod = await loadModule("../emergent/quest-engine.js");
          if (!mod) return res.json({ ok: false, error: "quest-engine not available" });
          if (!target || !data?.insightId) return res.json({ ok: false, error: "target and data.insightId required" });
          result = mod.releaseInsight(target, data.insightId);
          break;
        }

        case "quests-active": {
          const mod = await loadModule("../emergent/quest-engine.js");
          if (!mod) return res.json({ ok: false, error: "quest-engine not available" });
          result = { ok: true, quests: mod.getActiveQuests() };
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 7: CRI (CONCORD RESEARCH INSTITUTES)
        // ══════════════════════════════════════════════════════════════════════

        case "cri-create": {
          const mod = await loadModule("../emergent/cri-system.js");
          if (!mod) return res.json({ ok: false, error: "cri-system not available" });
          const name = target || data?.name;
          if (!name) return res.json({ ok: false, error: "name required" });
          result = mod.createCRI(name, data?.domain || "general");
          break;
        }

        case "cri-list": {
          const mod = await loadModule("../emergent/cri-system.js");
          if (!mod) return res.json({ ok: false, error: "cri-system not available" });
          result = { ok: true, cris: mod.listCRIs() };
          break;
        }

        case "cri-status": {
          const mod = await loadModule("../emergent/cri-system.js");
          if (!mod) return res.json({ ok: false, error: "cri-system not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.getCRIStatus(target);
          break;
        }

        case "cri-summit": {
          const mod = await loadModule("../emergent/cri-system.js");
          if (!mod) return res.json({ ok: false, error: "cri-system not available" });
          if (!target) return res.json({ ok: false, error: "target (criId) required" });
          result = mod.scheduleSummit(target, data?.title || "Sovereign Summit", data?.participants || [], data?.agenda || []);
          break;
        }

        case "cri-add-member": {
          const mod = await loadModule("../emergent/cri-system.js");
          if (!mod) return res.json({ ok: false, error: "cri-system not available" });
          if (!target || !data?.entityId) return res.json({ ok: false, error: "target and data.entityId required" });
          result = mod.addMember(target, data.entityId, data?.role || "contributor");
          break;
        }

        case "cri-program": {
          const mod = await loadModule("../emergent/cri-system.js");
          if (!mod) return res.json({ ok: false, error: "cri-system not available" });
          if (!target || !data?.title) return res.json({ ok: false, error: "target and data.title required" });
          result = mod.createProgram(target, data.title, data?.lead || "sovereign");
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 8: MICROBOND GOVERNANCE
        // ══════════════════════════════════════════════════════════════════════

        case "bond-create": {
          const mod = await loadModule("../emergent/microbond-governance.js");
          if (!mod) return res.json({ ok: false, error: "microbond-governance not available" });
          const title = target || data?.title;
          if (!title) return res.json({ ok: false, error: "title required" });
          result = mod.createBond(title, data?.description, data?.category, data?.financial, data?.governance);
          break;
        }

        case "bonds": {
          const mod = await loadModule("../emergent/microbond-governance.js");
          if (!mod) return res.json({ ok: false, error: "microbond-governance not available" });
          result = { ok: true, bonds: mod.listBonds(target || data?.status) };
          break;
        }

        case "bond-status": {
          const mod = await loadModule("../emergent/microbond-governance.js");
          if (!mod) return res.json({ ok: false, error: "microbond-governance not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          const bond = mod.getBond(target);
          if (!bond) return res.json({ ok: false, error: `Bond ${target} not found` });
          result = { ok: true, bond };
          break;
        }

        case "bond-simulate": {
          const mod = await loadModule("../emergent/microbond-governance.js");
          if (!mod) return res.json({ ok: false, error: "microbond-governance not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.simulateBond(target);
          break;
        }

        case "bond-vote": {
          const mod = await loadModule("../emergent/microbond-governance.js");
          if (!mod) return res.json({ ok: false, error: "microbond-governance not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          const vote = data?.vote || "for";
          result = mod.voteBond(target, "sovereign", vote);
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 9: C-NET FEDERATION
        // ══════════════════════════════════════════════════════════════════════

        case "federation-status": {
          const mod = await loadModule("../emergent/cnet-federation.js");
          if (!mod) return res.json({ ok: false, error: "cnet-federation not available" });
          result = mod.getFederationStatus();
          break;
        }

        case "federation-publish": {
          const mod = await loadModule("../emergent/cnet-federation.js");
          if (!mod) return res.json({ ok: false, error: "cnet-federation not available" });
          if (!target) return res.json({ ok: false, error: "target (dtuId) required" });
          result = mod.publishDTU(target, data?.consentFlags);
          break;
        }

        case "federation-subscribe": {
          const mod = await loadModule("../emergent/cnet-federation.js");
          if (!mod) return res.json({ ok: false, error: "cnet-federation not available" });
          const domain = target || data?.domain;
          if (!domain) return res.json({ ok: false, error: "domain required" });
          result = mod.subscribeDomain(domain, data?.config);
          break;
        }

        case "federation-peers": {
          const mod = await loadModule("../emergent/cnet-federation.js");
          if (!mod) return res.json({ ok: false, error: "cnet-federation not available" });
          result = { ok: true, peers: mod.getPeers() };
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 10: BREAKTHROUGH CLUSTERS
        // ══════════════════════════════════════════════════════════════════════

        case "cluster-init": {
          const mod = await loadModule("../emergent/breakthrough-clusters.js");
          if (!mod) return res.json({ ok: false, error: "breakthrough-clusters not available" });
          const clusterId = target || data?.clusterId;
          if (!clusterId) return res.json({ ok: false, error: "clusterId required" });
          result = mod.initCluster(clusterId);
          break;
        }

        case "cluster-status": {
          const mod = await loadModule("../emergent/breakthrough-clusters.js");
          if (!mod) return res.json({ ok: false, error: "breakthrough-clusters not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.getClusterStatus(target);
          break;
        }

        case "cluster-research": {
          const mod = await loadModule("../emergent/breakthrough-clusters.js");
          if (!mod) return res.json({ ok: false, error: "breakthrough-clusters not available" });
          if (!target) return res.json({ ok: false, error: "target required" });
          result = mod.triggerClusterResearch(target);
          break;
        }

        case "clusters": {
          const mod = await loadModule("../emergent/breakthrough-clusters.js");
          if (!mod) return res.json({ ok: false, error: "breakthrough-clusters not available" });
          result = { ok: true, clusters: mod.listClusters() };
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 11: PHYSICAL DTU SCHEMA
        // ══════════════════════════════════════════════════════════════════════

        case "physical-dtu-types": {
          const mod = await loadModule("../emergent/physical-dtu.js");
          if (!mod) return res.json({ ok: false, error: "physical-dtu not available" });
          result = { ok: true, types: mod.listPhysicalDTUTypes() };
          break;
        }

        case "physical-dtu-create": {
          const mod = await loadModule("../emergent/physical-dtu.js");
          if (!mod) return res.json({ ok: false, error: "physical-dtu not available" });
          const kind = target || data?.kind;
          if (!kind) return res.json({ ok: false, error: "kind required" });
          switch (kind) {
            case "movement": result = mod.createMovementDTU(data); break;
            case "craft": result = mod.createCraftDTU(data); break;
            case "observation": result = mod.createObservationDTU(data); break;
            case "spatial": result = mod.createSpatialDTU(data); break;
            default: result = { ok: false, error: `Unknown physical DTU kind: ${kind}` };
          }
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // SYSTEM 12: EMERGENT BODY INSTANTIATION
        // ══════════════════════════════════════════════════════════════════════

        case "body": {
          const mod = await loadModule("../emergent/body-instantiation.js");
          if (!mod) return res.json({ ok: false, error: "body-instantiation not available" });
          if (target) {
            const body = mod.getBody(target);
            if (!body) {
              // Auto-instantiate if not found
              const newBody = mod.instantiateBody(target);
              result = { ok: true, body: { ...newBody, organs: Object.fromEntries(newBody.organs) }, created: true };
            } else {
              result = { ok: true, body: { ...body, organs: Object.fromEntries(body.organs) } };
            }
          } else {
            result = { ok: true, bodies: mod.listBodies() };
          }
          break;
        }

        case "bodies": {
          const mod = await loadModule("../emergent/body-instantiation.js");
          if (!mod) return res.json({ ok: false, error: "body-instantiation not available" });
          result = { ok: true, bodies: mod.listBodies() };
          break;
        }

        case "body-compare": {
          const mod = await loadModule("../emergent/body-instantiation.js");
          if (!mod) return res.json({ ok: false, error: "body-instantiation not available" });
          if (!target || !data?.entity2) return res.json({ ok: false, error: "target and data.entity2 required" });
          result = mod.compareEntities(target, data.entity2);
          break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // COUNCIL DECISIONS (for council console UI)
        // ══════════════════════════════════════════════════════════════════════

        case "council-decisions": {
          // Return recent DTUs that went through council evaluation
          const decisions = [];
          if (S.dtus) {
            for (const dtu of S.dtus.values()) {
              if (dtu.tags?.includes("council-evaluated") || dtu.machine?.councilVotes) {
                decisions.push(dtu);
              }
            }
          }
          decisions.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          result = { ok: true, decisions: decisions.slice(0, Number(data?.limit) || 50), count: decisions.length };
          break;
        }

        default:
          result = { ok: false, error: `Unknown emergent action: ${action}` };
      }
    } catch (e) {
      result = { ok: false, error: String(e?.message || e) };
    }

    // Create sovereign audit DTU for every decree
    createSovereignDTU(S, action, { target, data }, result);

    return res.json(result);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // REST API Endpoints (for direct access)
  // ════════════════════════════════════════════════════════════════════════════

  // Ingest endpoints (tier-gated via query param)
  router.post("/ingest/submit", async (req, res) => {
    try {
      const mod = await loadModule("../emergent/ingest-engine.js");
      if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
      const { url, tier } = req.body || {};
      if (!url) return res.status(400).json({ ok: false, error: "url required" });
      const userId = req.user?.id || req.user?.username || "anonymous";
      result = mod.submitUrl(userId, url, tier || "free");
      return res.json(result);
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  router.get("/ingest/queue", async (_req, res) => {
    try {
      const mod = await loadModule("../emergent/ingest-engine.js");
      if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
      return res.json({ ok: true, queue: mod.getQueue() });
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  router.get("/ingest/stats", async (_req, res) => {
    try {
      const mod = await loadModule("../emergent/ingest-engine.js");
      if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
      return res.json({ ok: true, stats: mod.getIngestStats() });
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  router.get("/ingest/allowlist", async (_req, res) => {
    try {
      const mod = await loadModule("../emergent/ingest-engine.js");
      if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
      return res.json({ ok: true, allowlist: mod.getAllowlist() });
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  router.get("/ingest/status/:id", async (req, res) => {
    try {
      const mod = await loadModule("../emergent/ingest-engine.js");
      if (!mod) return res.json({ ok: false, error: "ingest-engine not available" });
      const status = mod.getIngestStatus(req.params.id);
      if (!status) return res.json({ ok: false, error: "not found" });
      return res.json({ ok: true, status });
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  // Research endpoints
  router.post("/research/submit", async (req, res) => {
    try {
      const mod = await loadModule("../emergent/research-jobs.js");
      if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
      const { topic, config } = req.body || {};
      if (!topic) return res.status(400).json({ ok: false, error: "topic required" });
      return res.json(mod.submitResearchJob(topic, config || {}));
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  router.get("/research/queue", async (_req, res) => {
    try {
      const mod = await loadModule("../emergent/research-jobs.js");
      if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
      return res.json({ ok: true, jobs: mod.listResearchJobs() });
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  router.get("/research/:id", async (req, res) => {
    try {
      const mod = await loadModule("../emergent/research-jobs.js");
      if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
      const job = mod.getResearchJob(req.params.id);
      if (!job) return res.json({ ok: false, error: "not found" });
      return res.json({ ok: true, job });
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  router.get("/research/:id/report", async (req, res) => {
    try {
      const mod = await loadModule("../emergent/research-jobs.js");
      if (!mod) return res.json({ ok: false, error: "research-jobs not available" });
      const report = mod.getResearchReport(req.params.id);
      if (!report) return res.json({ ok: false, error: "not found" });
      return res.json({ ok: true, report });
    } catch (e) { return res.json({ ok: false, error: String(e?.message || e) }); }
  });

  return router;
}
