/**
 * System 3: Concord Agents — Lattice Immune System
 *
 * Agents MAINTAIN the lattice. They are the immune system.
 *
 * Six agent types patrol, verify, test, debate, refresh, and synthesize
 * across the DTU lattice. Each runs on its own interval, records findings,
 * auto-repairs low-severity issues, and logs findings as DTU-shaped records.
 *
 * Agent lifecycle: create → run → pause/resume → destroy
 * Background tick job iterates all active agents whose interval has elapsed.
 *
 * Additive only. One file. Silent failure. All state in-memory.
 */

import crypto from "crypto";

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function nowISO() {
  return new Date().toISOString();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function ageDays(isoDate) {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

// ── Agent Type Definitions ──────────────────────────────────────────────────

export const AGENT_TYPES = Object.freeze({
  PATROL:            "patrol",
  INTEGRITY:         "integrity",
  HYPOTHESIS_TESTER: "hypothesis_tester",
  DEBATE_SIMULATOR:  "debate_simulator",
  FRESHNESS:         "freshness",
  SYNTHESIS:         "synthesis",
});

const AGENT_INTERVALS = Object.freeze({
  patrol:            5 * 60 * 1000,   // 5 min
  integrity:         10 * 60 * 1000,  // 10 min
  hypothesis_tester: 15 * 60 * 1000,  // 15 min
  debate_simulator:  30 * 60 * 1000,  // 30 min
  freshness:         60 * 60 * 1000,  // 1 hour
  synthesis:         30 * 60 * 1000,  // 30 min
});

const TEMPORAL_DOMAINS = Object.freeze([
  "politics", "economics", "technology", "current_events",
]);

const TIMELESS_DOMAINS = Object.freeze([
  "math", "physics", "mathematics", "logic", "geometry",
]);

const MAX_FINDINGS = 100;

// ── In-Memory State ─────────────────────────────────────────────────────────

const agents = new Map();
const findings = new Map();       // agentId → finding[]
const allFindings = [];           // global ordered list
let globalFrozen = false;

// ── Agent Lifecycle ─────────────────────────────────────────────────────────

/**
 * Create and register a new agent.
 *
 * @param {string} type - One of AGENT_TYPES
 * @param {object} [config] - Optional overrides: territory, intervalMs, metadata
 * @returns {{ ok: boolean, agent?: object, error?: string }}
 */
export function createAgent(type, config = {}) {
  try {
    if (!Object.values(AGENT_TYPES).includes(type)) {
      return { ok: false, error: "invalid_agent_type", provided: type };
    }

    const agentId = uid("agent");
    const agent = {
      agentId,
      type,
      territory: config.territory || "*",
      intervalMs: config.intervalMs || AGENT_INTERVALS[type] || 300000,
      status: "active",
      metadata: config.metadata || {},
      createdAt: nowISO(),
      lastRunAt: null,
      runCount: 0,
      findingsCount: 0,
      repairsCount: 0,
    };

    agents.set(agentId, agent);
    findings.set(agentId, []);

    return { ok: true, agent };
  } catch (_err) {
    return { ok: false, error: "create_failed" };
  }
}

/**
 * Run an agent's scan immediately.
 *
 * @param {string} agentId
 * @param {object[]} [dtus] - Array of DTU objects to scan
 * @returns {{ ok: boolean, findings?: object[], error?: string }}
 */
export function runAgent(agentId, dtus = []) {
  try {
    const agent = agents.get(agentId);
    if (!agent) return { ok: false, error: "agent_not_found" };
    if (agent.status !== "active") return { ok: false, error: "agent_not_active" };
    if (globalFrozen) return { ok: false, error: "agents_frozen" };

    // Resolve territory
    const territory = agent.territory;
    const scopedDtus = territory === "*"
      ? dtus
      : dtus.filter(d => matchesTerritory(d, territory));

    // Execute type-specific scan
    let scanResults = [];
    switch (agent.type) {
      case AGENT_TYPES.PATROL:
        scanResults = scanPatrol(scopedDtus, agent);
        break;
      case AGENT_TYPES.INTEGRITY:
        scanResults = scanIntegrity(scopedDtus, agent);
        break;
      case AGENT_TYPES.HYPOTHESIS_TESTER:
        scanResults = scanHypothesisTester(scopedDtus, agent);
        break;
      case AGENT_TYPES.DEBATE_SIMULATOR:
        scanResults = scanDebateSimulator(scopedDtus, agent);
        break;
      case AGENT_TYPES.FRESHNESS:
        scanResults = scanFreshness(scopedDtus, agent);
        break;
      case AGENT_TYPES.SYNTHESIS:
        scanResults = scanSynthesis(scopedDtus, agent);
        break;
      default:
        scanResults = [];
    }

    // Record findings (keep last 100 per agent)
    const agentFindings = findings.get(agentId) || [];
    for (const finding of scanResults) {
      agentFindings.push(finding);
      allFindings.push(finding);

      // Auto-repair low severity
      if (finding.severity === "low" && finding.autoRepair) {
        try {
          applyAutoRepair(finding, dtus);
          finding.repaired = true;
          agent.repairsCount++;
        } catch (_e) {
          finding.repaired = false;
        }
      }
    }

    // Cap per-agent findings
    if (agentFindings.length > MAX_FINDINGS) {
      findings.set(agentId, agentFindings.slice(-MAX_FINDINGS));
    } else {
      findings.set(agentId, agentFindings);
    }

    // Cap global findings
    if (allFindings.length > MAX_FINDINGS * 10) {
      allFindings.splice(0, allFindings.length - MAX_FINDINGS * 5);
    }

    // Update agent metadata
    agent.lastRunAt = nowISO();
    agent.runCount++;
    agent.findingsCount += scanResults.length;

    return { ok: true, findings: scanResults, count: scanResults.length };
  } catch (_err) {
    return { ok: false, error: "run_failed" };
  }
}

/**
 * Pause an active agent.
 *
 * @param {string} agentId
 * @returns {{ ok: boolean, error?: string }}
 */
export function pauseAgent(agentId) {
  try {
    const agent = agents.get(agentId);
    if (!agent) return { ok: false, error: "agent_not_found" };
    agent.status = "paused";
    return { ok: true, agentId, status: "paused" };
  } catch (_err) {
    return { ok: false, error: "pause_failed" };
  }
}

/**
 * Resume a paused agent.
 *
 * @param {string} agentId
 * @returns {{ ok: boolean, error?: string }}
 */
export function resumeAgent(agentId) {
  try {
    const agent = agents.get(agentId);
    if (!agent) return { ok: false, error: "agent_not_found" };
    agent.status = "active";
    return { ok: true, agentId, status: "active" };
  } catch (_err) {
    return { ok: false, error: "resume_failed" };
  }
}

/**
 * Destroy an agent and its findings history.
 *
 * @param {string} agentId
 * @returns {{ ok: boolean, error?: string }}
 */
export function destroyAgent(agentId) {
  try {
    const agent = agents.get(agentId);
    if (!agent) return { ok: false, error: "agent_not_found" };
    agents.delete(agentId);
    findings.delete(agentId);
    return { ok: true, agentId, destroyed: true };
  } catch (_err) {
    return { ok: false, error: "destroy_failed" };
  }
}

/**
 * Get a single agent by ID.
 *
 * @param {string} agentId
 * @returns {{ ok: boolean, agent?: object, error?: string }}
 */
export function getAgent(agentId) {
  try {
    const agent = agents.get(agentId);
    if (!agent) return { ok: false, error: "agent_not_found" };
    return { ok: true, agent };
  } catch (_err) {
    return { ok: false, error: "get_failed" };
  }
}

/**
 * List all registered agents.
 *
 * @returns {{ ok: boolean, agents: object[] }}
 */
export function listAgents() {
  try {
    return { ok: true, agents: Array.from(agents.values()), count: agents.size };
  } catch (_err) {
    return { ok: true, agents: [], count: 0 };
  }
}

/**
 * Get findings for a specific agent.
 *
 * @param {string} agentId
 * @param {number} [limit=50]
 * @returns {{ ok: boolean, findings?: object[], error?: string }}
 */
export function getAgentFindings(agentId, limit = 50) {
  try {
    const agentFinds = findings.get(agentId);
    if (!agentFinds) return { ok: false, error: "agent_not_found" };
    const capped = Math.min(Math.max(1, limit), MAX_FINDINGS);
    return { ok: true, findings: agentFinds.slice(-capped), total: agentFinds.length };
  } catch (_err) {
    return { ok: false, error: "get_findings_failed" };
  }
}

/**
 * Get all findings, optionally filtered by type.
 *
 * @param {string} [type] - Agent type to filter by
 * @param {number} [limit=50]
 * @returns {{ ok: boolean, findings: object[] }}
 */
export function getAllFindings(type, limit = 50) {
  try {
    const capped = Math.min(Math.max(1, limit), MAX_FINDINGS * 5);
    let filtered = allFindings;
    if (type) {
      filtered = allFindings.filter(f => f.agentType === type);
    }
    return { ok: true, findings: filtered.slice(-capped), total: filtered.length };
  } catch (_err) {
    return { ok: true, findings: [], total: 0 };
  }
}

/**
 * Freeze all agents (global pause).
 *
 * @returns {{ ok: boolean }}
 */
export function freezeAllAgents() {
  try {
    globalFrozen = true;
    return { ok: true, frozen: true, agentCount: agents.size };
  } catch (_err) {
    return { ok: false, error: "freeze_failed" };
  }
}

/**
 * Thaw all agents (global resume).
 *
 * @returns {{ ok: boolean }}
 */
export function thawAllAgents() {
  try {
    globalFrozen = false;
    return { ok: true, frozen: false, agentCount: agents.size };
  } catch (_err) {
    return { ok: false, error: "thaw_failed" };
  }
}

/**
 * Background tick job. Iterates all agents, runs any whose interval
 * has elapsed. Silent failure on individual agents.
 *
 * @param {object[]} dtus - Array of DTU objects to scan
 * @returns {{ ok: boolean, ran: string[], skipped: string[] }}
 */
export function agentTickJob(dtus = []) {
  const ran = [];
  const skipped = [];

  try {
    if (globalFrozen) return { ok: true, ran, skipped: Array.from(agents.keys()), frozen: true };

    const now = Date.now();

    for (const [agentId, agent] of agents) {
      try {
        if (agent.status !== "active") {
          skipped.push(agentId);
          continue;
        }

        const lastRun = agent.lastRunAt ? new Date(agent.lastRunAt).getTime() : 0;
        const elapsed = now - lastRun;

        if (elapsed >= agent.intervalMs) {
          const result = runAgent(agentId, dtus);
          if (result.ok) {
            ran.push(agentId);
          } else {
            skipped.push(agentId);
          }
        } else {
          skipped.push(agentId);
        }
      } catch (_err) {
        // Silent failure per agent
        skipped.push(agentId);
      }
    }
  } catch (_err) {
    // Silent failure on entire tick
  }

  return { ok: true, ran, skipped, ranCount: ran.length, skippedCount: skipped.length };
}

/**
 * Get aggregate metrics across all agents.
 *
 * @returns {{ ok: boolean, metrics: object }}
 */
export function getAgentMetrics() {
  try {
    const agentList = Array.from(agents.values());
    const byType = {};
    let totalRuns = 0;
    let totalFindings = 0;
    let totalRepairs = 0;

    for (const agent of agentList) {
      if (!byType[agent.type]) {
        byType[agent.type] = { count: 0, totalRuns: 0, totalFindings: 0, totalRepairs: 0 };
      }
      byType[agent.type].count++;
      byType[agent.type].totalRuns += agent.runCount;
      byType[agent.type].totalFindings += agent.findingsCount;
      byType[agent.type].totalRepairs += agent.repairsCount;
      totalRuns += agent.runCount;
      totalFindings += agent.findingsCount;
      totalRepairs += agent.repairsCount;
    }

    return {
      ok: true,
      metrics: {
        agentCount: agents.size,
        globalFrozen,
        totalRuns,
        totalFindings,
        totalRepairs,
        globalFindingsCount: allFindings.length,
        byType,
      },
    };
  } catch (_err) {
    return { ok: true, metrics: { agentCount: 0, globalFrozen, totalRuns: 0, totalFindings: 0, totalRepairs: 0 } };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCAN IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Patrol Agent — scans DTU clusters for decay, contradiction, staleness.
 * - DTU older than 30 days + authority < 0.5 → "stale_low_authority"
 * - Lineage parent missing → "broken_lineage" (auto-repair)
 */
function scanPatrol(dtus, agent) {
  const results = [];

  // Build ID set for lineage checks
  const dtuIds = new Set();
  for (const dtu of dtus) {
    if (dtu.id) dtuIds.add(dtu.id);
  }

  for (const dtu of dtus) {
    try {
      const age = ageDays(dtu.createdAt || dtu.created_at || dtu.timestamp);
      const authority = typeof dtu.authority === "number" ? dtu.authority : (dtu.coherence || 0.5);

      // Stale + low authority
      if (age > 30 && authority < 0.5) {
        results.push(makeFinding(agent, dtu, "stale_low_authority", "medium",
          `DTU is ${Math.round(age)} days old with authority ${authority.toFixed(2)}`,
          { age: Math.round(age), authority },
          false
        ));
      }

      // Broken lineage
      const parentId = dtu.parentId || dtu.lineage?.parentId || dtu.derivedFrom;
      if (parentId && !dtuIds.has(parentId)) {
        results.push(makeFinding(agent, dtu, "broken_lineage", "low",
          `Parent DTU ${parentId} not found in lattice`,
          { parentId },
          true  // auto-repair
        ));
      }

      // Contradiction flag — DTU with contradiction markers
      if (dtu.contradicts && Array.isArray(dtu.contradicts) && dtu.contradicts.length > 0) {
        const missingContradictions = dtu.contradicts.filter(cId => !dtuIds.has(cId));
        if (missingContradictions.length > 0) {
          results.push(makeFinding(agent, dtu, "orphaned_contradiction", "medium",
            `DTU references ${missingContradictions.length} missing contradiction target(s)`,
            { missingTargets: missingContradictions },
            false
          ));
        }
      }
    } catch (_err) {
      // Silent per-DTU failure
    }
  }

  return results;
}

/**
 * Integrity Agent — verifies lineage chains, cross-references, authority scores.
 * Full lattice scan.
 */
function scanIntegrity(dtus, agent) {
  const results = [];

  // Build lookup
  const byId = new Map();
  for (const dtu of dtus) {
    if (dtu.id) byId.set(dtu.id, dtu);
  }

  for (const dtu of dtus) {
    try {
      // Verify lineage chain (walk up to 10 levels)
      let current = dtu;
      let depth = 0;
      let chainBroken = false;
      while (depth < 10) {
        const parentId = current.parentId || current.lineage?.parentId || current.derivedFrom;
        if (!parentId) break;
        const parent = byId.get(parentId);
        if (!parent) {
          chainBroken = true;
          results.push(makeFinding(agent, dtu, "lineage_chain_broken", "medium",
            `Lineage chain breaks at depth ${depth + 1}, missing ${parentId}`,
            { brokenAt: parentId, depth: depth + 1 },
            false
          ));
          break;
        }
        current = parent;
        depth++;
      }

      // Verify cross-references
      const refs = dtu.references || dtu.crossRefs || [];
      for (const refId of refs) {
        if (!byId.has(refId)) {
          results.push(makeFinding(agent, dtu, "broken_cross_reference", "low",
            `Cross-reference to ${refId} not found`,
            { referenceId: refId },
            true  // auto-repair: mark ref as stale
          ));
        }
      }

      // Recalculate authority score check
      if (typeof dtu.authority === "number") {
        const expectedAuthority = computeExpectedAuthority(dtu, byId);
        const drift = Math.abs(dtu.authority - expectedAuthority);
        if (drift > 0.3) {
          results.push(makeFinding(agent, dtu, "authority_drift", "medium",
            `Authority ${dtu.authority.toFixed(2)} deviates from expected ${expectedAuthority.toFixed(2)} (drift: ${drift.toFixed(2)})`,
            { current: dtu.authority, expected: expectedAuthority, drift },
            false
          ));
        }
      }
    } catch (_err) {
      // Silent per-DTU failure
    }
  }

  return results;
}

/**
 * Hypothesis Tester — takes hypothesis DTUs, attempts to validate/falsify.
 */
function scanHypothesisTester(dtus, agent) {
  const results = [];

  const hypothesisDtus = dtus.filter(d =>
    d.type === "hypothesis" || d.dtuType === "hypothesis" ||
    (d.tags && Array.isArray(d.tags) && d.tags.includes("hypothesis"))
  );

  for (const dtu of hypothesisDtus) {
    try {
      const confidence = typeof dtu.confidence === "number" ? dtu.confidence : (dtu.coherence || 0.5);
      const evidenceCount = Array.isArray(dtu.evidence) ? dtu.evidence.length : 0;
      const age = ageDays(dtu.createdAt || dtu.created_at || dtu.timestamp);

      // Gather evidence assessment
      let evidenceStrength = 0;
      if (evidenceCount > 0) {
        evidenceStrength = Math.min(1, evidenceCount * 0.2);
      }

      // Test: hypothesis with no evidence and high confidence → suspicious
      if (confidence > 0.7 && evidenceCount === 0) {
        results.push(makeFinding(agent, dtu, "unsupported_hypothesis", "medium",
          `Hypothesis has confidence ${confidence.toFixed(2)} but no evidence attached`,
          { confidence, evidenceCount },
          false
        ));
      }

      // Test: old hypothesis never validated
      if (age > 14 && evidenceCount === 0 && confidence < 0.5) {
        results.push(makeFinding(agent, dtu, "stale_hypothesis", "low",
          `Hypothesis is ${Math.round(age)} days old with no evidence — candidate for rejection`,
          { age: Math.round(age), confidence },
          false
        ));
      }

      // Update confidence recommendation based on evidence
      if (evidenceCount > 0) {
        const recommendedConfidence = clamp01(0.3 + evidenceStrength * 0.5);
        if (Math.abs(confidence - recommendedConfidence) > 0.25) {
          const action = recommendedConfidence > confidence ? "promote" : "demote";
          results.push(makeFinding(agent, dtu, `hypothesis_${action}`, "low",
            `Evidence suggests confidence should be ~${recommendedConfidence.toFixed(2)} (currently ${confidence.toFixed(2)})`,
            { currentConfidence: confidence, recommendedConfidence, evidenceCount, action },
            false
          ));
        }
      }
    } catch (_err) {
      // Silent per-DTU failure
    }
  }

  return results;
}

/**
 * Debate Simulator — pits related DTUs against each other.
 * Identifies pairs with contradictory or competing claims.
 */
function scanDebateSimulator(dtus, agent) {
  const results = [];

  // Build tag index for finding related DTUs
  const tagIndex = new Map();  // tag → DTU[]
  for (const dtu of dtus) {
    const tags = Array.isArray(dtu.tags) ? dtu.tags : [];
    for (const tag of tags) {
      if (!tagIndex.has(tag)) tagIndex.set(tag, []);
      tagIndex.get(tag).push(dtu);
    }
  }

  // Find pairs of related DTUs with different positions
  const debatedPairs = new Set();

  for (const [tag, tagDtus] of tagIndex) {
    if (tagDtus.length < 2) continue;

    // Only process first 20 per tag to avoid combinatorial explosion
    const limited = tagDtus.slice(0, 20);

    for (let i = 0; i < limited.length; i++) {
      for (let j = i + 1; j < limited.length; j++) {
        const a = limited[i];
        const b = limited[j];
        const pairKey = [a.id, b.id].sort().join(":");
        if (debatedPairs.has(pairKey)) continue;
        debatedPairs.add(pairKey);

        try {
          const debate = simulateDebate(a, b);

          if (debate.tension > 0.5) {
            results.push(makeFinding(agent, a, "debate_tension", "low",
              `Tension ${debate.tension.toFixed(2)} between DTU ${a.id} and ${b.id} on "${tag}"`,
              {
                opponentId: b.id,
                tag,
                tension: debate.tension,
                winnerId: debate.winnerId,
                synthesis: debate.synthesis,
              },
              false
            ));
          }

          // Propose synthesis when both have merit
          if (debate.tension > 0.3 && debate.tension < 0.8 && debate.synthesisCandidate) {
            results.push(makeFinding(agent, a, "synthesis_proposal", "low",
              `DTUs ${a.id} and ${b.id} may benefit from synthesis on "${tag}"`,
              {
                dtuA: a.id,
                dtuB: b.id,
                tag,
                synthesisReason: debate.synthesis,
              },
              false
            ));
          }
        } catch (_err) {
          // Silent per-pair failure
        }
      }
    }
  }

  return results;
}

/**
 * Freshness Agent — monitors temporal decay.
 * Temporal domains: politics, economics, technology, current_events
 * DTU older than 90 days in temporal domain → "temporal_decay"
 * Timeless knowledge (math, physics) → skip.
 */
function scanFreshness(dtus, agent) {
  const results = [];

  for (const dtu of dtus) {
    try {
      const tags = Array.isArray(dtu.tags) ? dtu.tags : [];
      const domain = dtu.domain || "";

      // Check if timeless — skip these
      const isTimeless = TIMELESS_DOMAINS.some(td =>
        tags.includes(td) || domain.toLowerCase().includes(td)
      );
      if (isTimeless) continue;

      // Check if temporal domain
      const isTemporal = TEMPORAL_DOMAINS.some(td =>
        tags.includes(td) || domain.toLowerCase().includes(td)
      );
      if (!isTemporal) continue;

      const age = ageDays(dtu.createdAt || dtu.created_at || dtu.timestamp);

      if (age > 90) {
        const matchedDomain = TEMPORAL_DOMAINS.find(td =>
          tags.includes(td) || domain.toLowerCase().includes(td)
        );

        results.push(makeFinding(agent, dtu, "temporal_decay", "medium",
          `DTU in temporal domain "${matchedDomain}" is ${Math.round(age)} days old — may be outdated`,
          { age: Math.round(age), domain: matchedDomain },
          false
        ));
      }
    } catch (_err) {
      // Silent per-DTU failure
    }
  }

  return results;
}

/**
 * Synthesis Agent — finds cross-domain connections.
 * Looks for analogies and proposes bridge DTUs.
 */
function scanSynthesis(dtus, agent) {
  const results = [];

  // Build domain clusters
  const domainClusters = new Map();  // domain → DTU[]
  for (const dtu of dtus) {
    const domain = dtu.domain || (Array.isArray(dtu.tags) && dtu.tags[0]) || "general";
    if (!domainClusters.has(domain)) domainClusters.set(domain, []);
    domainClusters.get(domain).push(dtu);
  }

  const domainKeys = Array.from(domainClusters.keys());
  if (domainKeys.length < 2) return results;

  // Compare pairs of domains for cross-domain connections
  for (let i = 0; i < domainKeys.length && i < 10; i++) {
    for (let j = i + 1; j < domainKeys.length && j < 10; j++) {
      try {
        const domainA = domainKeys[i];
        const domainB = domainKeys[j];
        const dtusA = domainClusters.get(domainA);
        const dtusB = domainClusters.get(domainB);

        // Find analogies by comparing tag overlap and content similarity
        const analogies = findAnalogies(dtusA, dtusB, domainA, domainB);

        for (const analogy of analogies) {
          results.push(makeFinding(agent, analogy.dtuA, "cross_domain_analogy", "low",
            `Potential analogy between "${domainA}" DTU ${analogy.dtuA.id} and "${domainB}" DTU ${analogy.dtuB.id}`,
            {
              domainA,
              domainB,
              dtuAId: analogy.dtuA.id,
              dtuBId: analogy.dtuB.id,
              similarity: analogy.similarity,
              sharedTags: analogy.sharedTags,
            },
            false
          ));
        }

        // Propose bridge DTUs when domains have complementary knowledge
        if (dtusA.length > 3 && dtusB.length > 3 && analogies.length > 0) {
          results.push(makeFinding(agent, dtusA[0], "bridge_dtu_proposal", "low",
            `Domains "${domainA}" (${dtusA.length} DTUs) and "${domainB}" (${dtusB.length} DTUs) may benefit from a bridge DTU`,
            {
              domainA,
              domainB,
              analogyCount: analogies.length,
              sizeA: dtusA.length,
              sizeB: dtusB.length,
            },
            false
          ));
        }
      } catch (_err) {
        // Silent per-domain-pair failure
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCAN HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a DTU matches a territory filter.
 */
function matchesTerritory(dtu, territory) {
  if (territory === "*") return true;
  const tags = Array.isArray(dtu.tags) ? dtu.tags : [];
  const domain = dtu.domain || "";
  const scope = dtu.scope || "";
  return tags.includes(territory) || domain === territory || scope === territory;
}

/**
 * Compute expected authority from DTU attributes.
 */
function computeExpectedAuthority(dtu, byId) {
  let score = 0.5;

  // Evidence boosts authority
  const evidenceCount = Array.isArray(dtu.evidence) ? dtu.evidence.length : 0;
  score += Math.min(0.2, evidenceCount * 0.05);

  // Cross-references boost authority
  const refs = dtu.references || dtu.crossRefs || [];
  const validRefs = refs.filter(r => byId.has(r)).length;
  score += Math.min(0.15, validRefs * 0.03);

  // Coherence contributes
  if (typeof dtu.coherence === "number") {
    score += (dtu.coherence - 0.5) * 0.15;
  }

  // Age slightly reduces (older = less authoritative unless refreshed)
  const age = ageDays(dtu.createdAt || dtu.created_at || dtu.timestamp);
  if (age > 60) score -= 0.05;
  if (age > 180) score -= 0.1;

  return clamp01(score);
}

/**
 * Simulate a debate between two DTUs.
 */
function simulateDebate(dtuA, dtuB) {
  const confA = typeof dtuA.confidence === "number" ? dtuA.confidence : (dtuA.coherence || 0.5);
  const confB = typeof dtuB.confidence === "number" ? dtuB.confidence : (dtuB.coherence || 0.5);

  const evidenceA = Array.isArray(dtuA.evidence) ? dtuA.evidence.length : 0;
  const evidenceB = Array.isArray(dtuB.evidence) ? dtuB.evidence.length : 0;

  const authA = typeof dtuA.authority === "number" ? dtuA.authority : 0.5;
  const authB = typeof dtuB.authority === "number" ? dtuB.authority : 0.5;

  // Tension: higher when both are confident but disagree
  const tension = clamp01(Math.abs(confA - confB) * 0.4 + (confA + confB) * 0.3);

  // Score each side
  const scoreA = confA * 0.3 + Math.min(1, evidenceA * 0.2) * 0.4 + authA * 0.3;
  const scoreB = confB * 0.3 + Math.min(1, evidenceB * 0.2) * 0.4 + authB * 0.3;

  const winnerId = scoreA >= scoreB ? dtuA.id : dtuB.id;
  const margin = Math.abs(scoreA - scoreB);

  // Synthesis is a candidate when both have merit
  const synthesisCandidate = margin < 0.2 && tension > 0.3;

  return {
    tension,
    winnerId,
    scoreA,
    scoreB,
    margin,
    synthesisCandidate,
    synthesis: synthesisCandidate
      ? `Both DTUs have comparable strength (margin ${margin.toFixed(2)}) — synthesis may yield stronger combined DTU`
      : null,
  };
}

/**
 * Find analogies between DTUs in two domains.
 */
function findAnalogies(dtusA, dtusB, domainA, domainB) {
  const analogies = [];

  // Limit comparisons
  const limitA = dtusA.slice(0, 15);
  const limitB = dtusB.slice(0, 15);

  for (const a of limitA) {
    for (const b of limitB) {
      try {
        const tagsA = new Set(Array.isArray(a.tags) ? a.tags : []);
        const tagsB = new Set(Array.isArray(b.tags) ? b.tags : []);

        // Shared tags (excluding the domain tags themselves)
        const shared = [];
        for (const tag of tagsA) {
          if (tagsB.has(tag) && tag !== domainA && tag !== domainB) {
            shared.push(tag);
          }
        }

        if (shared.length === 0) continue;

        // Compute similarity
        const union = new Set([...tagsA, ...tagsB]);
        const similarity = shared.length / Math.max(1, union.size);

        if (similarity > 0.15) {
          analogies.push({
            dtuA: a,
            dtuB: b,
            similarity: Math.round(similarity * 1000) / 1000,
            sharedTags: shared,
          });
        }
      } catch (_err) {
        // Silent per-pair failure
      }
    }
  }

  // Return top 5 analogies by similarity
  analogies.sort((a, b) => b.similarity - a.similarity);
  return analogies.slice(0, 5);
}

/**
 * Apply auto-repair for low-severity findings.
 */
function applyAutoRepair(finding, dtus) {
  switch (finding.findingType) {
    case "broken_lineage": {
      // Clear the broken parent reference
      const dtu = dtus.find(d => d.id === finding.dtuId);
      if (dtu) {
        if (dtu.parentId) dtu.parentId = null;
        if (dtu.lineage?.parentId) dtu.lineage.parentId = null;
        if (dtu.derivedFrom) dtu.derivedFrom = null;
        finding.repairAction = "cleared_broken_parent_reference";
      }
      break;
    }
    case "broken_cross_reference": {
      // Mark stale references
      const dtu = dtus.find(d => d.id === finding.dtuId);
      if (dtu && finding.data?.referenceId) {
        const refs = dtu.references || dtu.crossRefs || [];
        const idx = refs.indexOf(finding.data.referenceId);
        if (idx !== -1) {
          refs.splice(idx, 1);
          finding.repairAction = "removed_broken_cross_reference";
        }
      }
      break;
    }
    default:
      // No auto-repair for other types
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINDING FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a standardized finding record.
 */
function makeFinding(agent, dtu, findingType, severity, message, data = {}, autoRepair = false) {
  return {
    findingId: uid("finding"),
    agentId: agent.agentId,
    agentType: agent.type,
    dtuId: dtu.id || null,
    dtuTitle: dtu.title || null,
    findingType,
    severity,          // "low" | "medium" | "high"
    message,
    data,
    autoRepair,
    repaired: false,
    repairAction: null,
    timestamp: nowISO(),
  };
}
