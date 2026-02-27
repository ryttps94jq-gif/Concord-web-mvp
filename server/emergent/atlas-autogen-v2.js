/**
 * Concord Global Atlas — Autogen Engine v2 (Domain-Weighted)
 *
 * Domain-aware synthesis that respects epistemic rules.
 * Generates cross-domain DTUs without mixing lanes incorrectly.
 * Recursion + spam + dedupe + cycle controls enforced.
 */

import crypto from "crypto";
import { getAtlasState, areDomainsCompatible, computeAtlasScores } from "./atlas-epistemic.js";
import { createAtlasDtu, contentHash, addAtlasLink } from "./atlas-store.js";
import { detectLineageCycle, findNearDuplicates, checkContentHashDedup } from "./atlas-antigaming.js";

// ── Autogen Configuration ────────────────────────────────────────────────

const AUTOGEN_V2_CONFIG = {
  // Depth and branch caps — GPU: deeper exploration, more branching
  MAX_GENERATION_DEPTH: 50,
  MAX_CHILDREN_PER_PARENT: 8,
  MAX_NEW_DTUS_PER_RUN: 25,
  MAX_NEW_DTUS_PER_DAY: 1000,
  MAX_RUN_DURATION_MS: 120000,

  // Quality floors
  MIN_INPUT_CONFIDENCE: 0.3,
  QUALITY_FLOOR_BASE: 0.4,
  QUALITY_FLOOR_DEPTH_PENALTY: 0.02, // floor increases with depth

  // Dedupe
  SIMILARITY_THRESHOLD: 0.65,

  // Confidence weights for input selection
  FACTUAL_WEIGHT: 0.6,
  STRUCTURAL_WEIGHT: 0.3,
  RECENCY_WEIGHT: 0.1,
};

// ── Daily Counter ────────────────────────────────────────────────────────

let dailyAutogenCount = 0;
let dailyResetAt = Date.now() + 86400000;

function getDailyBudget() {
  if (Date.now() > dailyResetAt) {
    dailyAutogenCount = 0;
    dailyResetAt = Date.now() + 86400000;
  }
  return { used: dailyAutogenCount, max: AUTOGEN_V2_CONFIG.MAX_NEW_DTUS_PER_DAY, remaining: AUTOGEN_V2_CONFIG.MAX_NEW_DTUS_PER_DAY - dailyAutogenCount };
}

// ── Autogen Run Object ───────────────────────────────────────────────────

function createAutogenRun(initiator, domainTarget, budget = {}) {
  return {
    runId: `autogen_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    initiator,
    domainTarget,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "RUNNING",

    budget: {
      maxDtus: budget.maxDtus || AUTOGEN_V2_CONFIG.MAX_NEW_DTUS_PER_RUN,
      maxTokens: budget.maxTokens || 10000,
      maxTimeMs: budget.maxTimeMs || AUTOGEN_V2_CONFIG.MAX_RUN_DURATION_MS,
    },

    guardConfig: {
      depthCap: budget.depthCap || AUTOGEN_V2_CONFIG.MAX_GENERATION_DEPTH,
      branchCap: budget.branchCap || AUTOGEN_V2_CONFIG.MAX_CHILDREN_PER_PARENT,
      dedupeThreshold: AUTOGEN_V2_CONFIG.SIMILARITY_THRESHOLD,
      qualityFloor: AUTOGEN_V2_CONFIG.QUALITY_FLOOR_BASE,
    },

    outputs: [],
    trace: [],
    metrics: {
      candidatesGenerated: 0,
      candidatesAccepted: 0,
      candidatesRejected: 0,
      dedupeHits: 0,
      cyclePrevented: 0,
      qualityFiltered: 0,
    },
  };
}

// ── Input Selection (domain-aware) ───────────────────────────────────────

/**
 * Select input DTUs for synthesis based on domain, confidence, diversity.
 */
export function selectInputDtus(STATE, query = {}) {
  const atlas = getAtlasState(STATE);
  const { domainType, epistemicClass, topic, maxInputs = 20 } = query;

  let candidates = [];

  // Start from domain/class filtered set
  if (domainType) {
    const domainSet = atlas.byDomainType.get(domainType);
    if (domainSet) {
      for (const id of domainSet) {
        const dtu = atlas.dtus.get(id);
        if (dtu && dtu.status !== "QUARANTINED" && dtu.status !== "DEPRECATED") {
          candidates.push(dtu);
        }
      }
    }
  } else if (epistemicClass) {
    const classSet = atlas.byEpistemicClass.get(epistemicClass);
    if (classSet) {
      for (const id of classSet) {
        const dtu = atlas.dtus.get(id);
        if (dtu && dtu.status !== "QUARANTINED" && dtu.status !== "DEPRECATED") {
          candidates.push(dtu);
        }
      }
    }
  } else {
    // All non-quarantined DTUs
    for (const dtu of atlas.dtus.values()) {
      if (dtu.status !== "QUARANTINED" && dtu.status !== "DEPRECATED") {
        candidates.push(dtu);
      }
    }
  }

  // Filter by minimum confidence
  candidates = candidates.filter(d => d.scores.confidence_overall >= AUTOGEN_V2_CONFIG.MIN_INPUT_CONFIDENCE);

  // Topic filter (if provided)
  if (topic) {
    const topicLower = topic.toLowerCase();
    candidates = candidates.filter(d =>
      d.title?.toLowerCase().includes(topicLower) ||
      d.tags?.some(t => t.toLowerCase().includes(topicLower)) ||
      d.claims?.some(c => c.text?.toLowerCase().includes(topicLower))
    );
  }

  // Score and rank
  const scored = candidates.map(dtu => {
    const age = (Date.now() - new Date(dtu.updatedAt).getTime()) / (86400000 * 30); // months
    const recencyScore = Math.max(0, 1 - age * 0.1);

    const score =
      dtu.scores.confidence_factual * AUTOGEN_V2_CONFIG.FACTUAL_WEIGHT +
      dtu.scores.credibility_structural * AUTOGEN_V2_CONFIG.STRUCTURAL_WEIGHT +
      recencyScore * AUTOGEN_V2_CONFIG.RECENCY_WEIGHT;

    return { dtu, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Diversity: ensure no single author dominates
  const selected = [];
  const authorCounts = new Map();
  const maxPerAuthor = Math.ceil(maxInputs / 3);

  for (const { dtu, score } of scored) {
    if (selected.length >= maxInputs) break;
    const author = dtu.author?.userId || "unknown";
    const count = authorCounts.get(author) || 0;
    if (count >= maxPerAuthor) continue;
    authorCounts.set(author, count + 1);
    selected.push({ dtu, score });
  }

  return {
    ok: true,
    inputs: selected.map(s => s.dtu),
    scores: selected.map(s => ({ dtuId: s.dtu.id, score: s.score })),
    totalCandidates: candidates.length,
    selected: selected.length,
  };
}

// ── Domain Mixing Rules ──────────────────────────────────────────────────

/**
 * Check if a set of input DTUs can be mixed for synthesis.
 * Returns compatible groups and warnings.
 */
function checkDomainMixing(inputDtus) {
  const classes = new Set(inputDtus.map(d => d.epistemicClass));
  const warnings = [];
  const incompatible = [];

  const classArray = Array.from(classes);
  for (let i = 0; i < classArray.length; i++) {
    for (let j = i + 1; j < classArray.length; j++) {
      if (!areDomainsCompatible(classArray[i], classArray[j])) {
        incompatible.push({ a: classArray[i], b: classArray[j] });
        warnings.push(`${classArray[i]} and ${classArray[j]} are not compatible for direct synthesis`);
      }
    }
  }

  return {
    compatible: incompatible.length === 0,
    incompatible,
    warnings,
    classes: classArray,
  };
}

// ── Synthesis Engine (deterministic, not LLM-dependent) ──────────────────

/**
 * Build a candidate Atlas DTU from a set of input DTUs.
 * Keeps claim lanes separate: facts vs interpretations vs model outputs.
 */
function synthesizeCandidate(inputDtus, domainTarget, run) {
  const _now = new Date().toISOString();

  // Separate claims by type
  const factClaims = [];
  const interpClaims = [];
  const modelClaims = [];

  for (const input of inputDtus) {
    for (const claim of (input.claims || [])) {
      switch (claim.claimType) {
        case "FACT":
        case "SPEC":
        case "PROVENANCE":
          factClaims.push({ ...claim, sourcesDtuId: input.id });
          break;
        case "INTERPRETATION":
        case "RECEPTION":
          interpClaims.push({ ...claim, sourcesDtuId: input.id });
          break;
        case "MODEL_OUTPUT":
        case "HYPOTHESIS":
          modelClaims.push({ ...claim, sourcesDtuId: input.id });
          break;
        default:
          factClaims.push({ ...claim, sourcesDtuId: input.id });
      }
    }
  }

  // Extract common tags
  const tagCounts = new Map();
  for (const input of inputDtus) {
    for (const tag of (input.tags || [])) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const commonTags = Array.from(tagCounts.entries())
    .filter(([, count]) => count >= Math.max(1, inputDtus.length * 0.3))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  // Merge fact claims (deduplicate by text similarity)
  const mergedFacts = deduplicateClaims(factClaims);

  // Keep interpretations separate (never merge into facts)
  const mergedInterps = interpClaims.map(c => ({
    claimId: `c_${crypto.randomBytes(4).toString("hex")}`,
    claimType: "INTERPRETATION",
    text: c.text,
    entities: c.entities || [],
    sources: c.sources || [],
    evidenceTier: "UNCORROBORATED",
    confidence: c.confidence || { factual: 0, structural: 0, overall: 0 },
    dispute: { isDisputed: false, reasons: [] },
  }));

  // Generate title
  const title = generateSynthesisTitle(inputDtus, commonTags, domainTarget);

  // Build assumptions from model claims
  const assumptions = modelClaims.length > 0
    ? modelClaims.map(c => ({
        assumptionId: `a_${crypto.randomBytes(4).toString("hex")}`,
        text: c.text,
        appliesTo: ["MODEL"],
        sensitivity: "MEDIUM",
      }))
    : [];

  // Determine epistemic class (use dominant class from inputs)
  const classCounts = new Map();
  for (const input of inputDtus) {
    const cls = input.epistemicClass;
    classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
  }
  let dominantClass = "EMPIRICAL";
  let maxCount = 0;
  for (const [cls, count] of classCounts) {
    if (count > maxCount) {
      dominantClass = cls;
      maxCount = count;
    }
  }

  const candidate = {
    title,
    tags: ["autogen", "synthesis", ...commonTags],
    domainType: domainTarget || inputDtus[0]?.domainType || "empirical.physics",
    epistemicClass: dominantClass,
    author: { userId: "autogen_v2", display: "Autogen V2", isSystem: true },
    claims: mergedFacts,
    interpretations: mergedInterps,
    assumptions,
    provenance: [],
    links: {
      supports: inputDtus.map(d => ({
        targetDtuId: d.id,
        claimIds: [],
        strength: d.scores?.confidence_overall || 0.5,
      })),
      contradicts: [],
      sameAs: [],
      about: [],
    },
    lineage: {
      origin: "AUTOGEN",
      generationDepth: Math.max(0, ...inputDtus.map(d => (d.lineage?.generationDepth || 0))) + 1,
      parents: inputDtus.map(d => ({ dtuId: d.id, weight: d.scores?.confidence_overall || 0.5 })),
      runId: run.runId,
    },
  };

  return candidate;
}

function deduplicateClaims(claims) {
  const seen = new Map(); // normalized text → claim
  const result = [];

  for (const claim of claims) {
    const normalized = (claim.text || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (normalized.length < 10) continue;

    // Check word overlap with existing
    const words = new Set(normalized.split(" "));
    let isDup = false;
    for (const [existingText, existingClaim] of seen) {
      const existingWords = new Set(existingText.split(" "));
      let overlap = 0;
      for (const w of words) if (existingWords.has(w)) overlap++;
      const jaccard = overlap / (words.size + existingWords.size - overlap);
      if (jaccard > 0.7) {
        // Merge sources into existing
        if (claim.sources?.length > 0) {
          existingClaim.sources = [...(existingClaim.sources || []), ...claim.sources];
        }
        isDup = true;
        break;
      }
    }

    if (!isDup) {
      const newClaim = {
        claimId: `c_${crypto.randomBytes(4).toString("hex")}`,
        claimType: claim.claimType || "FACT",
        text: claim.text,
        entities: claim.entities || [],
        timeRange: claim.timeRange || null,
        numeric: claim.numeric || [],
        sources: claim.sources || [],
        evidenceTier: claim.evidenceTier || "UNCORROBORATED",
        confidence: claim.confidence || { factual: 0, structural: 0, overall: 0 },
        dispute: { isDisputed: false, reasons: [] },
      };
      seen.set(normalized, newClaim);
      result.push(newClaim);
    }
  }

  return result;
}

function generateSynthesisTitle(inputDtus, tags, domainTarget) {
  const titles = inputDtus.map(d => d.title || "").filter(Boolean);
  if (titles.length === 0) return `Synthesis: ${domainTarget || "unknown"}`;

  // Extract common meaningful words from titles
  const wordCounts = new Map();
  for (const title of titles) {
    const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const w of words) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
  }

  const topWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);

  if (topWords.length > 0) {
    return `Synthesis: ${topWords.join(" + ")} (${inputDtus.length} sources)`;
  }
  return `Synthesis: ${tags.slice(0, 2).join(", ")} (${inputDtus.length} sources)`;
}

// ── Run Pipeline ─────────────────────────────────────────────────────────

/**
 * Full autogen v2 pipeline run.
 */
export function runAutogenV2(STATE, options = {}) {
  const atlas = getAtlasState(STATE);
  const budget = getDailyBudget();

  if (budget.remaining <= 0) {
    return { ok: false, error: "Daily autogen budget exhausted", budget };
  }

  const run = createAutogenRun(
    options.initiator || "system",
    options.domainTarget || null,
    options.budget || {}
  );

  atlas.autogenRuns.set(run.runId, run);
  run.trace.push({ stage: "INIT", ts: Date.now(), detail: "Run initialized" });

  // Stage 1: Input Selection
  const inputResult = selectInputDtus(STATE, {
    domainType: options.domainTarget,
    epistemicClass: options.epistemicClass,
    topic: options.topic,
    maxInputs: 20,
  });

  if (!inputResult.ok || inputResult.inputs.length < 2) {
    run.status = "COMPLETED";
    run.completedAt = new Date().toISOString();
    run.trace.push({ stage: "INPUT_SELECTION", ts: Date.now(), detail: "Insufficient inputs" });
    return { ok: true, run, outputs: [], reason: "Insufficient inputs for synthesis" };
  }

  run.trace.push({
    stage: "INPUT_SELECTION",
    ts: Date.now(),
    detail: `Selected ${inputResult.inputs.length} inputs from ${inputResult.totalCandidates} candidates`,
  });

  // Stage 2: Domain Mixing Check
  const mixCheck = checkDomainMixing(inputResult.inputs);
  run.trace.push({
    stage: "DOMAIN_MIXING",
    ts: Date.now(),
    detail: mixCheck.compatible
      ? `All ${mixCheck.classes.length} classes compatible`
      : `Incompatible pairs: ${mixCheck.incompatible.map(p => `${p.a}-${p.b}`).join(", ")}`,
  });

  // If incompatible, split into compatible groups
  let inputGroups;
  if (!mixCheck.compatible) {
    inputGroups = splitIntoCompatibleGroups(inputResult.inputs);
  } else {
    inputGroups = [inputResult.inputs];
  }

  // Stage 3: Generate Candidates
  const candidates = [];
  for (const group of inputGroups) {
    if (group.length < 2) continue;

    // Check depth cap
    const maxDepth = Math.max(0, ...group.map(d => d.lineage?.generationDepth || 0));
    if (maxDepth >= run.guardConfig.depthCap) {
      run.trace.push({ stage: "DEPTH_CHECK", ts: Date.now(), detail: `Depth ${maxDepth} exceeds cap ${run.guardConfig.depthCap}` });
      run.metrics.qualityFiltered++;
      continue;
    }

    // Quality floor increases with depth
    const qualityFloor = AUTOGEN_V2_CONFIG.QUALITY_FLOOR_BASE +
      maxDepth * AUTOGEN_V2_CONFIG.QUALITY_FLOOR_DEPTH_PENALTY;

    const candidate = synthesizeCandidate(group, options.domainTarget, run);
    run.metrics.candidatesGenerated++;

    // Stage 4: Dedupe check
    const hash = contentHash(candidate);
    candidate.lineage = candidate.lineage || {};
    candidate.lineage.hash = hash;

    const hashDedup = checkContentHashDedup(STATE, hash);
    if (hashDedup.isDuplicate) {
      run.trace.push({ stage: "DEDUPE_HASH", ts: Date.now(), detail: `Duplicate hash: ${hashDedup.existingId}` });
      run.metrics.dedupeHits++;
      continue;
    }

    // Near-duplicate check
    const nearDup = findNearDuplicates(STATE, candidate);
    if (nearDup.hasDuplicates) {
      run.trace.push({
        stage: "DEDUPE_SIMILARITY",
        ts: Date.now(),
        detail: `Similar to: ${nearDup.duplicates.map(d => d.existingId).join(", ")}`,
      });
      // Create sameAs link instead of new DTU
      run.metrics.dedupeHits++;
      continue;
    }

    candidates.push({ candidate, qualityFloor, group });
  }

  // Stage 5: Create DTUs
  const outputs = [];
  for (const { candidate, qualityFloor } of candidates) {
    if (outputs.length >= run.budget.maxDtus) break;
    if (dailyAutogenCount >= AUTOGEN_V2_CONFIG.MAX_NEW_DTUS_PER_DAY) break;

    const result = createAtlasDtu(STATE, candidate);
    if (!result.ok) {
      run.trace.push({ stage: "CREATE", ts: Date.now(), detail: `Failed: ${result.error}` });
      run.metrics.candidatesRejected++;
      continue;
    }

    // Check quality floor after scoring
    if (result.scores.confidence_overall < qualityFloor) {
      run.trace.push({
        stage: "QUALITY_GATE",
        ts: Date.now(),
        detail: `Score ${result.scores.confidence_overall} below floor ${qualityFloor}`,
      });
      run.metrics.qualityFiltered++;
      // Remove the created DTU (it doesn't meet quality)
      atlas.dtus.delete(result.dtu.id);
      continue;
    }

    // Check for lineage cycles
    const cycleCheck = detectLineageCycle(STATE, result.dtu.id);
    if (cycleCheck.hasCycle) {
      run.trace.push({ stage: "CYCLE_CHECK", ts: Date.now(), detail: `Cycle detected, removing` });
      run.metrics.cyclePrevented++;
      atlas.dtus.delete(result.dtu.id);
      continue;
    }

    // Output enters as PROPOSED (not directly VERIFIED)
    await_free_promote(STATE, result.dtu.id);

    outputs.push({
      dtuId: result.dtu.id,
      title: result.dtu.title,
      status: result.dtu.status,
      scores: result.scores,
      disposition: "ACCEPTED",
    });

    run.outputs.push({
      dtuId: result.dtu.id,
      disposition: "ACCEPTED",
      reason: "Passed all gates",
    });

    dailyAutogenCount++;
    run.metrics.candidatesAccepted++;
  }

  // Complete run
  run.status = "COMPLETED";
  run.completedAt = new Date().toISOString();
  run.trace.push({
    stage: "COMPLETE",
    ts: Date.now(),
    detail: `Generated ${outputs.length} DTUs from ${inputResult.inputs.length} inputs`,
  });

  atlas.metrics.autogenRuns++;

  return {
    ok: true,
    run,
    outputs,
    metrics: run.metrics,
    budget: getDailyBudget(),
  };
}

// Non-async promote helper (autogen output always enters as PROPOSED if valid)
function await_free_promote(STATE, dtuId) {
  const atlas = getAtlasState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return;

  // Autogen output enters as PROPOSED (not DRAFT)
  if (dtu.status === "DRAFT") {
    const scores = computeAtlasScores(dtu);
    const thresholds_min = 0.3; // lower bar for autogen proposals
    if (scores.credibility_structural >= thresholds_min) {
      atlas.byStatus.get("DRAFT")?.delete(dtu.id);
      dtu.status = "PROPOSED";
      if (!atlas.byStatus.has("PROPOSED")) atlas.byStatus.set("PROPOSED", new Set());
      atlas.byStatus.get("PROPOSED").add(dtu.id);
      dtu.audit.events.push({
        ts: Date.now(),
        actor: "autogen_v2",
        action: "STATUS_CHANGE",
        diff: "DRAFT → PROPOSED (autogen auto-promote)",
      });
    }
  }
}

// ── Group Splitting ──────────────────────────────────────────────────────

function splitIntoCompatibleGroups(dtus) {
  const groups = [];
  const assigned = new Set();

  for (const dtu of dtus) {
    if (assigned.has(dtu.id)) continue;

    const group = [dtu];
    assigned.add(dtu.id);

    for (const other of dtus) {
      if (assigned.has(other.id)) continue;
      if (areDomainsCompatible(dtu.epistemicClass, other.epistemicClass)) {
        group.push(other);
        assigned.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

// ── Get Run Details ──────────────────────────────────────────────────────

export function getAutogenRun(STATE, runId) {
  const atlas = getAtlasState(STATE);
  const run = atlas.autogenRuns.get(runId);
  if (!run) return { ok: false, error: "Run not found" };
  return { ok: true, run };
}

// ── Accept/Merge Autogen Output ──────────────────────────────────────────

export function acceptAutogenOutput(STATE, dtuId, actor = "council") {
  const atlas = getAtlasState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };
  if (dtu.lineage?.origin !== "AUTOGEN") return { ok: false, error: "Not an autogen DTU" };

  dtu.audit.events.push({
    ts: Date.now(),
    actor,
    action: "AUTOGEN_ACCEPTED",
    diff: "Accepted by council/user",
  });

  return { ok: true, dtuId, status: dtu.status };
}

export function mergeAutogenOutput(STATE, sourceDtuId, targetDtuId, actor = "council") {
  return addAtlasLink(STATE, sourceDtuId, targetDtuId, "sameAs", {
    actor,
    strength: 0.9,
  });
}

// ── Confidence Propagation ───────────────────────────────────────────────

/**
 * When DTU A supports B, B's factual confidence is influenced.
 * Propagate only within radius R (2-3 hops). Async and cached.
 * Cycles damped and capped.
 */
export function propagateConfidence(STATE, dtuId, maxHops = 2, dampingFactor = 0.5) {
  const atlas = getAtlasState(STATE);
  const visited = new Set();
  const updates = [];

  function propagate(currentId, hop, influence) {
    if (hop > maxHops || visited.has(currentId)) return;
    visited.add(currentId);

    const dtu = atlas.dtus.get(currentId);
    if (!dtu) return;

    // Find DTUs that this DTU supports
    for (const link of (dtu.links?.supports || [])) {
      const targetDtu = atlas.dtus.get(link.targetDtuId);
      if (!targetDtu || visited.has(link.targetDtuId)) continue;

      const boost = influence * link.strength * dampingFactor;
      if (boost < 0.01) continue; // below threshold

      // Apply small boost to factual confidence
      const oldConfidence = targetDtu.scores.confidence_factual;
      const newConfidence = Math.min(1.0, oldConfidence + boost * 0.1);
      targetDtu.scores.confidence_factual = Math.round(newConfidence * 1000) / 1000;

      // Recompute overall
      const scores = computeAtlasScores(targetDtu);
      targetDtu.scores.confidence_overall = scores.confidence_overall;

      updates.push({
        dtuId: link.targetDtuId,
        oldConfidence,
        newConfidence: targetDtu.scores.confidence_factual,
        boost,
        hop,
      });

      // Continue propagation
      propagate(link.targetDtuId, hop + 1, boost);
    }
  }

  const startDtu = atlas.dtus.get(dtuId);
  if (!startDtu) return { ok: false, error: "DTU not found" };

  propagate(dtuId, 0, startDtu.scores.confidence_overall);

  return {
    ok: true,
    startDtuId: dtuId,
    propagatedTo: updates.length,
    updates,
    maxHops,
    dampingFactor,
  };
}

// ── Autogen Metrics ──────────────────────────────────────────────────────

export function getAutogenV2Metrics(STATE) {
  const atlas = getAtlasState(STATE);
  const runs = Array.from(atlas.autogenRuns.values());
  const completed = runs.filter(r => r.status === "COMPLETED");

  return {
    ok: true,
    totalRuns: runs.length,
    completedRuns: completed.length,
    totalOutputs: completed.reduce((s, r) => s + r.outputs.length, 0),
    dailyBudget: getDailyBudget(),
    aggregateMetrics: completed.reduce((agg, r) => ({
      candidatesGenerated: (agg.candidatesGenerated || 0) + r.metrics.candidatesGenerated,
      candidatesAccepted: (agg.candidatesAccepted || 0) + r.metrics.candidatesAccepted,
      candidatesRejected: (agg.candidatesRejected || 0) + r.metrics.candidatesRejected,
      dedupeHits: (agg.dedupeHits || 0) + r.metrics.dedupeHits,
      cyclePrevented: (agg.cyclePrevented || 0) + r.metrics.cyclePrevented,
      qualityFiltered: (agg.qualityFiltered || 0) + r.metrics.qualityFiltered,
    }), {}),
  };
}
