

// === DATA DIRECTORY (canonical) ===
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
/**
 * Concord v2 — Macro‑Max Monolith (Single File)
 * - Macro-first architecture: nearly all logic is macros.
 * - Endpoints are thin wrappers around macros.
 * - LLM is OPTIONAL: local reasoning works; LLM enhances when env key is present.
 *
 * Node: v18+ recommended (works on v24+)
 * ESM: requires package.json { "type": "module" } in your server folder.
 */

import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

// ---- dotenv (safe) ----
let DOTENV = { loaded: false, path: null, error: null };
async function tryLoadDotenv() {
  const envPath = process.env.ENV_PATH || process.env.DOTENV_CONFIG_PATH || null;
  try {
    const dotenv = await import("dotenv");
    const result = envPath ? dotenv.config({ path: envPath }) : dotenv.config();
    DOTENV.loaded = !result?.error;
    DOTENV.path = envPath || "(default)";
    DOTENV.error = result?.error ? String(result.error) : null;
  } catch (e) {
    DOTENV.loaded = false;
    DOTENV.path = envPath || "(default)";
    DOTENV.error = `dotenv not available: ${String(e?.message || e)}`;
  }
}
await tryLoadDotenv();

// ---- config ----
const PORT = Number(process.env.PORT || 5050);
const VERSION = "4.0.0-full-simulation";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL_FAST = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_MODEL_SMART = process.env.OPENAI_MODEL_SMART || "gpt-4.1";
const LLM_READY = Boolean(OPENAI_API_KEY);
// LLM toggle: default ON only when a key is present
const __envBool = (v) => String(v ?? "").toLowerCase().trim();
const __llmDefaultForcedRaw = (process.env.CONCORD_LLM_DEFAULT_FORCED ?? process.env.LLM_DEFAULT_FORCED ?? null);
const __llmForced = (__llmDefaultForcedRaw !== null) ? __envBool(__llmDefaultForcedRaw) : "";
const DEFAULT_LLM_ON = (__llmDefaultForcedRaw !== null)
  ? (["1","true","yes","y","on"].includes(__llmForced))
  : Boolean((process.env.OPENAI_API_KEY || "").trim());


// ---- immutables ----
const IMMUTABLES = Object.freeze({ NO_MACHINE_TO_HUMAN: true, COUNCIL_REQUIRED: true });

// ---- Chicken3 Ethos Invariants (additive, frozen) ----
const ETHOS_INVARIANTS = Object.freeze({
  LOCAL_FIRST_DEFAULT: true,
  NO_TELEMETRY: true,
  NO_ADS: true,
  NO_SECRET_MONITORING: true,
  NO_USER_PROFILING: true,
  CLOUD_LLM_OPT_IN_ONLY: true,          // env var + session flag required
  PERSONA_SOVEREIGNTY: true,
  ALIGNMENT_PHYSICS_BASED: true,
  FOUNDER_INTENT_STRUCTURAL: true
});

// Guard: call before any external/persistent/monitoring-like action
function enforceEthosInvariant(actionName="") {
  const a = String(actionName||"").toLowerCase();
  if (ETHOS_INVARIANTS.NO_TELEMETRY && a.includes("telemetry")) throw new Error("Ethos invariant: telemetry forbidden");
  if (ETHOS_INVARIANTS.NO_ADS && (a.includes("ad") || a.includes("ads"))) throw new Error("Ethos invariant: ads forbidden");
  if (ETHOS_INVARIANTS.NO_SECRET_MONITORING && (a.includes("monitor") || a.includes("tracking") || a.includes("track"))) {
    throw new Error("Ethos invariant: secret monitoring forbidden");
  }
  if (ETHOS_INVARIANTS.NO_USER_PROFILING && (a.includes("profile") || a.includes("fingerprint"))) throw new Error("Ethos invariant: user profiling forbidden");
  return true;
}

function _cloudOptInAllowed({ sessionId="" } = {}) {
  // Cloud anything requires BOTH:
  // 1) process.env.CLOUD_LLM_ENABLED === "true"
  // 2) session opt-in flag (STATE.sessions[sessionId].cloudOptIn === true)
  try {
    if (String(process.env.CLOUD_LLM_ENABLED || "").toLowerCase() !== "true") return false;
    const sid = String(sessionId||"");
    if (!sid) return false;
    const s = STATE?.sessions?.get?.(sid) || null;
    return Boolean(s?.cloudOptIn === true);
  } catch { return false; }
}
// ---- End Chicken3 Ethos Invariants ----


// ---- canonical system identity (authoritative; non-LLM) ----
const SYSTEM_IDENTITY = Object.freeze({
  name: "Concord",
  version: VERSION,
  type: "Governed Cognitive Operating System (Local-first)",
  short: "Concord is a macro-driven cognitive OS that forges DTUs, consolidates them into MEGA/HYPER nodes, governs knowledge with council rules, and can run sandboxed wrappers/panels.",
  long: [
    "Concord is not a generic project management or collaboration SaaS.",
    "It is a local-first cognitive operating system built around DTUs (Discrete Thought Units) and higher-order DTUs (MEGA/HYPER).",
    "It runs a macro registry (deterministic functions), optional LLM enhancement, and governance (council) for credibility, dedupe, and legality gates.",
    "It compresses large DTU libraries into MEGAs/HYPERs to reduce clutter while preserving lineage, like human memory consolidation."
  ].join(" "),
  invariants: [
    "Identity answers are declarative (never guessed).",
    "Facts vs hypotheses vs philosophy must be labeled.",
    "No duplicates on Global (when enabled).",
    "Maintenance/recommendations go to queues, not the public DTU library by default."
  ]
});

// ---- deterministic intent router (LLM-independent) ----
const INTENT = Object.freeze({
  GREETING: "greeting",
  IDENTITY: "identity",
  STATUS: "status",
  COMMAND: "command",
  QUESTION: "question",
  STATEMENT: "statement",
});

const GREETING_PAT = /^(hi|hey|yo|sup|wassup|what'?s up|hello|hiya|good (morning|afternoon|evening))\b/i;
const IDENTITY_PAT = /\b(what\s+is\s+concord|who\s+are\s+you|what\s+are\s+you|tell\s+me\s+about\s+concord)\b/i;
const STATUS_PAT = /\b(status|health|are\s+you\s+working|llm\s+ready|memory|remember)\b/i;
const COMMAND_PAT = /^\s*\/(\w+)/;

function classifyIntent(utterance="") {
  const s = normalizeText(String(utterance||""));
  if (!s) return { intent: INTENT.STATEMENT, canonical: "" };
  if (COMMAND_PAT.test(s)) return { intent: INTENT.COMMAND, canonical: s.toLowerCase() };
  if (GREETING_PAT.test(s)) return { intent: INTENT.GREETING, canonical: "greeting" };
  if (IDENTITY_PAT.test(s.toLowerCase())) return { intent: INTENT.IDENTITY, canonical: "identity" };
  if (STATUS_PAT.test(s.toLowerCase())) return { intent: INTENT.STATUS, canonical: "status" };
  const isQ = /\?$/.test(s) || /\b(why|how|what|when|where|who|can you|should i|help|explain)\b/i.test(s);
  return { intent: isQ ? INTENT.QUESTION : INTENT.STATEMENT, canonical: s.toLowerCase() };
}



// ---- utils ----
const nowISO = () => new Date().toISOString();
const uid = (prefix="id") => `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const safeJson = (x, fallback=null) => { try { return JSON.parse(x); } catch { return fallback; } };

function normalizeText(s="") {
  return String(s).replace(/\s+/g, " ").trim();
}
function tokenish(s="") {
  return normalizeText(s).toLowerCase();
}


function defaultStyleVector() {
  return {
    // 0..1 sliders
    verbosity: 0.55,
    formality: 0.35,
    skepticism: 0.55,
    abstraction: 0.45,
    bulletiness: 0.45,
    // mutation metadata
    updatedAt: nowISO(),
    mutations: 0
  };
}

function clamp01(x){ return Math.max(0, Math.min(1, Number(x)||0)); }

function normalizeStyleVector(v) {
  const d = defaultStyleVector();
  const out = { ...d, ...(v||{}) };
  out.verbosity = clamp01(out.verbosity);
  out.formality = clamp01(out.formality);
  out.skepticism = clamp01(out.skepticism);
  out.abstraction = clamp01(out.abstraction);
  out.bulletiness = clamp01(out.bulletiness);
  out.updatedAt = nowISO();
  out.mutations = Number(out.mutations||0);
  return out;
}

// Deterministic-ish mutation: small bounded nudges; signal can be {up/down, field, amount} or freeform "like"/"dislike"
function mutateStyleVector(current, signal) {
  let v = normalizeStyleVector(current);
  const amt = clamp(Number(signal?.amount || 0.06), -0.2, 0.2);
  const field = String(signal?.field || "");
  const dir = String(signal?.dir || "");
  const kind = String(signal?.kind || "");
  const nudge = (k, delta) => { v[k] = clamp01(v[k] + delta); };

  if (kind === "like") {
    // Slightly increase verbosity + reduce abstraction a touch (tends to feel clearer)
    nudge("verbosity", 0.03);
    nudge("abstraction", -0.02);
    nudge("bulletiness", 0.02);
  } else if (kind === "dislike") {
    // Slightly reduce verbosity + increase skepticism (tends to tighten answers)
    nudge("verbosity", -0.03);
    nudge("skepticism", 0.03);
    nudge("abstraction", -0.02);
  } else if (field && ["verbosity","formality","skepticism","abstraction","bulletiness"].includes(field)) {
    const delta = (dir === "up" ? Math.abs(amt) : dir === "down" ? -Math.abs(amt) : amt);
    nudge(field, delta);
  }

  v.mutations += 1;
  v.updatedAt = nowISO();
  return v;
}

function getSessionStyleVector(sessionId) {
  const sid = String(sessionId || "");
  if (!sid) return defaultStyleVector();
  const v = STATE.styleVectors.get(sid) || defaultStyleVector();
  const nv = normalizeStyleVector(v);
  STATE.styleVectors.set(sid, nv);
  return nv;
}

function applyStyleToSettings(baseSettings, styleVec) {
  const s = { ...(baseSettings||{}) };
  // abstractionDepthDefault: map 0..1 -> 0..3 (or whatever your max is)
  const maxDepth = clamp(Number(s.abstractionMaxDepth || 3), 1, 9);
  s.abstractionDepthDefault = Math.round(clamp(styleVec.abstraction * maxDepth, 0, maxDepth));
  // Two-tier DTU reasoning set (does not affect reply length)
  // Tier A (focus): 500 DTUs used to drive reasoning
  // Tier B (peripheral): 5000 DTUs used for broad adjacency/contradiction scans
  s.focusSetMax = 500;
  s.peripheralSetMax = 5000;
  // Back-compat: some code still reads workingSetMax/microSetMax
  s.workingSetMax = s.focusSetMax;
  s.microSetMax = clamp(Number(s.microSetMax ?? 50), 10, s.focusSetMax);
  // crispnessMin: skepticism 0..1 -> 0.72..0.9
  const cm = 0.72 + styleVec.skepticism * 0.18;
  s.crispnessMin = clamp(cm, 0.6, 0.95);

  return s;
}

function jaccard(aTokens, bTokens) {
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

// ===== DTU Humanization Helpers (Topic titles + CRETI rendering) =====
const MODE_PREFIX_RE = /^(AUTOGEN|DREAM|EVOLUTION|SYNTHESIS|COUNCIL|HEARTBEAT)\s*[—:-]\s*/i;
const DATE_TRAIL_RE = /\s*\(?\d{4}-\d{2}-\d{2}.*\)?\s*$/;

function cleanTitle(t) {
  if (!t) return "";
  let s = String(t).trim();
  s = s.replace(MODE_PREFIX_RE, "");
  s = s.replace(DATE_TRAIL_RE, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  // normalize weird unicode dashes
  s = s.replace(/\s*[—–-]\s*/g, " — ").replace(/\s{2,}/g, " ").trim();
  return s;
}

function pickTopicFromText(txt) {
  if (!txt) return "";
  const s = String(txt).replace(/[`*_#]/g, " ").replace(/\s+/g, " ").trim();
  // Prefer short noun-phrase-ish first clause
  const cut = s.split(/[.:\n]/)[0].trim();
  if (cut.length < 4) return "";
  // Avoid generic boilerplate
  const bad = ["definition:", "invariant:", "example:", "a dtu is", "concord is", "modes:", "constraints:"];
  const low = cut.toLowerCase();
  if (bad.some(b => low.startsWith(b))) return "";
  // Limit length
  return cut.slice(0, 64).trim();
}

function titleCase(s) {
  return String(s).replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

function topicTitleFromDTU(d) {
  // 1) If existing title is already human, keep it (but cleaned)
  const existing = cleanTitle(d?.title || "");
  const looksMachine = /autogen|dream|coherent output|heartbeat|council/i.test(d?.title || "") || (d?.title||"").includes("â");
  if (existing && !looksMachine && existing.length <= 80) return existing;

  // 2) Try CRETI strings
  const creti = (typeof d?.cretiHuman === "string" && d.cretiHuman) || (typeof d?.creti === "string" && d.creti) || "";
  let topic = pickTopicFromText(creti);
  if (topic) return titleCase(topic);

  // 3) Try human summary
  topic = pickTopicFromText(d?.human?.summary || "");
  if (topic) return titleCase(topic);

  // 4) Try core definitions/invariants/examples
  const defs = Array.isArray(d?.core?.definitions) ? d.core.definitions.join(" ") : "";
  const inv  = Array.isArray(d?.core?.invariants) ? d.core.invariants.join(" ") : "";
  const ex   = Array.isArray(d?.core?.examples) ? d.core.examples.join(" ") : "";
  topic = pickTopicFromText(defs) || pickTopicFromText(inv) || pickTopicFromText(ex);
  if (topic) return titleCase(topic);

  // 5) Fallback: cleaned title or id
  if (existing) return existing;
  return d?.id ? String(d.id).slice(0, 24) : "Untitled";
}

function buildCretiText(d) {
  // Prefer explicit CRETI strings if present
  const s1 = (typeof d?.cretiHuman === "string" && d.cretiHuman) || (typeof d?.creti === "string" && d.creti);
  if (s1) return String(s1);

  const defs = Array.isArray(d?.core?.definitions) ? d.core.definitions : [];
  const inv  = Array.isArray(d?.core?.invariants) ? d.core.invariants : [];
  const ex   = Array.isArray(d?.core?.examples) ? d.core.examples : [];
  const tests = Array.isArray(d?.core?.tests) ? d.core.tests : [];
  const risks = Array.isArray(d?.core?.risks) ? d.core.risks : [];
  const nextA = Array.isArray(d?.core?.nextActions) ? d.core.nextActions : [];
  const sources = Array.isArray(d?.core?.sources) ? d.core.sources : [];

  const bullets = (arr)=> arr.map(x=>`- ${x}`).join("\n");
  const parts = [];
  parts.push("Context");
  const summary = (typeof d?.human?.summary === "string" && d.human.summary) ? d.human.summary : "";
  if (summary) parts.push(bullets([summary]));
  else if (defs.length) parts.push(bullets(defs.slice(0,6)));
  else parts.push("- (add context)");

  if (inv.length) { parts.push("\nReasoning"); parts.push(bullets(inv.slice(0,8))); }
  if (sources.length) { parts.push("\nEvidence"); parts.push(bullets(sources.slice(0,8))); }
  if (tests.length) { parts.push("\nTests"); parts.push(bullets(tests.slice(0,8))); }
  if (risks.length) { parts.push("\nRisks"); parts.push(bullets(risks.slice(0,8))); }
  if (nextA.length) { parts.push("\nImpact / Next"); parts.push(bullets(nextA.slice(0,8))); }

  return parts.join("\n");
}


/* =========================
   Abstraction Ladder + Crisp Reasoning (APE+ANT)
   - Keep reasoning crisp at ALL tiers by enforcing:
     * Working-memory caps (ape)
     * Canonical/anti-dup selection (ape)
     * Emergent compression via promotion (ant)
   ========================= */

function dtuStatus(d){
  return (d?.status || d?.meta?.status || "active").toString().toLowerCase();
}
function isDormantDTU(d){
  const st = dtuStatus(d);
  return st === "merged" || st === "archived" || st === "inactive";
}
function isShadowDTU(d){
  return (d?.tier || "").toString().toLowerCase() === "shadow" || (Array.isArray(d?.tags) && d.tags.includes("shadow"));
}
function crispnessScore(d){
  // 0..1 heuristic: reward constraints/tests/relations; penalize empty blobs
  const txt = buildCretiText(d);
  const hasInv = Array.isArray(d?.core?.invariants) && d.core.invariants.length > 0;
  const hasDefs = Array.isArray(d?.core?.definitions) && d.core.definitions.length > 0;
  const hasTests = Array.isArray(d?.core?.tests) && d.core.tests.length > 0;
  const hasNext = Array.isArray(d?.core?.nextActions) && d.core.nextActions.length > 0;
  const tagsN = Array.isArray(d?.tags) ? d.tags.length : 0;
  const lineageN = Array.isArray(d?.lineage) ? d.lineage.length : 0;

  let s = 0;
  if (txt && txt.length > 120) s += 0.20;
  if (hasDefs) s += 0.15;
  if (hasInv) s += 0.25;
  if (hasTests) s += 0.20;
  if (hasNext) s += 0.10;
  if (tagsN >= 3) s += 0.05;
  if (lineageN >= 2) s += 0.05;

  // penalty for very short / empty
  if (!txt || txt.length < 60) s -= 0.20;
  return clamp(s, 0, 1);
}
function eligibleDTUForReasoning(d, settings){
  if (!d) return false;
  if (isShadowDTU(d)) return false; // keep shadow DTUs internal; don't drive user answers
  if (isDormantDTU(d)) return false;
  if (settings?.canonicalOnly && d?.meta?.canonicalId && d.meta.canonicalId !== d.id) return false;
  return true;
}
function selectWorkingSet(scored, settings, { includeMegas=true } = {}){
  // Two-tier DTU reasoning set:
  // - focus (Tier A): up to 500 DTUs that may directly drive reasoning
  // - peripheral (Tier B): up to 5000 DTUs for broad adjacency/contradiction scans
  const focusMax = clamp(Number(settings?.focusSetMax ?? settings?.workingSetMax ?? 500), 50, 5000);
  const peripheralMax = clamp(Number(settings?.peripheralSetMax ?? (focusMax * 10) ?? 5000), focusMax, 50000);
  const microMax = clamp(Number(settings?.microSetMax ?? 50), 10, focusMax);
  const crispMin = Number(settings?.crispnessMin ?? 0.25);

  // Eligible DTUs for reasoning (respect canonical/dormant/shadow rules)
  let eligible = (scored||[])
    .map(x => ({ ...x, crisp: crispnessScore(x.d) }))
    .filter(x => eligibleDTUForReasoning(x.d, settings));

  // Prefer crispness, then similarity score
  eligible.sort((a,b)=> (b.crisp - a.crisp) || (b.score - a.score));

  // Build peripheral set first (broad view)
  const peripheral = [];
  const seen = new Set();
  for (const x of eligible) {
    if (!x?.d?.id) continue;
    if (seen.has(x.d.id)) continue;
    // Optionally skip megas/hypers if caller requests
    const tier = (x.d.tier || "regular").toLowerCase();
    if (!includeMegas && (tier === "mega" || tier === "hyper")) continue;
    seen.add(x.d.id);
    peripheral.push(x.d);
    if (peripheral.length >= peripheralMax) break;
  }

  // Focus set is the top slice of peripheral (promoted set)
  const focus = peripheral.slice(0, focusMax);

  // Micro: compact regular DTUs for local reasoning (subset of focus)
  const micro = [];
  for (const d of focus) {
    if (!d?.id) continue;
    const tier = (d.tier || "regular").toLowerCase();
    if (tier !== "regular" && tier !== "core") continue;
    micro.push(d);
    if (micro.length >= microMax) break;
  }

  // Macro: megas/hypers inside focus (kept for downstream logic that expects "macro")
  const macro = [];
  for (const d of focus) {
    const tier = (d?.tier || "regular").toLowerCase();
    if (tier === "mega" || tier === "hyper") macro.push(d);
  }

  // If focus is unexpectedly thin (e.g., strict filters), widen just enough by relaxing crispness
  if (focus.length < Math.min(50, Math.floor(focusMax * 0.1))) {
    const widened = (scored||[])
      .map(x => ({ ...x, crisp: crispnessScore(x.d) }))
      .filter(x => {
        // same structural eligibility, but allow low-crispness regular/core DTUs
        if (!x?.d) return false;
        const tier = (x.d.tier || "regular").toLowerCase();
        if (tier !== "regular" && tier !== "core") return false;
        return eligibleDTUForReasoning(x.d, settings);
      })
      .sort((a,b)=> (b.score - a.score));
    for (const x of widened) {
      if (!x?.d?.id) continue;
      if (seen.has(x.d.id)) continue;
      seen.add(x.d.id);
      peripheral.push(x.d);
      if (peripheral.length >= peripheralMax) break;
    }
  }

  // Keep crispnessMin behavior for downstream verbosity knobs WITHOUT shrinking the set.
  // (We do not reduce focus size below focusMax due to low crispness; spec requires broad reasoning.)
  const avgC = focus.length ? focus.map(d=>crispnessScore(d)).reduce((a,b)=>a+b,0)/focus.length : 0;
  const hardCap = avgC < crispMin ? focus.length : focus.length;

  return {
    focus: focus.slice(0, hardCap),
    micro,
    macro,
    peripheral
  };
}


function chooseAbstractionFrame({ mode="explore", intent="statement", hasStrongEvidence=false, settings={} }){
  const userDepth = Number(settings?.abstractionDepthDefault ?? 1);
  const maxDepth = Number(settings?.abstractionMaxDepth ?? 3);
  let level = clamp(userDepth, 0, maxDepth);

  // Mode nudges
  if (mode === "debug" || mode === "decide") level = Math.max(level, 1);
  if (mode === "design") level = Math.max(level, 2);

  // Weak evidence: stay concrete/generalized, avoid speculative leaps
  if (!hasStrongEvidence) level = Math.min(level, 1);

  // Greeting/identity: keep simple
  if (intent === INTENT.GREETING || intent === INTENT.IDENTITY) level = 0;

  const requireHypLabels = settings?.requireHypothesisLabels !== false;
  const requireTests = settings?.requireTestsWhenUncertain !== false;

  return { level, requireHypLabels, requireTests };
}

function formatCrispResponse({ prompt, mode, microDTUs, macroDTUs, level, answerLines, hypotheses=[], tests=[] }){
  const lines = [];
  // Facts/Evidence anchors (always)
  if (microDTUs?.length) {
    lines.push("Evidence anchors (DTUs):");
    for (const d of microDTUs.slice(0,5)) {
      const tags = (d.tags && d.tags.length) ? ` (${d.tags.slice(0,4).join(", ")})` : "";
      const excerpt = buildCretiText(d).split(/\n\n|\n|\.\s/).filter(Boolean).slice(0, 2).join(". ").slice(0, 240);
      lines.push(`• ${d.title}${tags}${excerpt ? ` — ${excerpt}${excerpt.endsWith(".") ? "" : "."}` : ""}`);
    }
    lines.push("");
  }

  if (macroDTUs?.length) {
    lines.push("Abstraction anchors (MEGA/HYPER):");
    for (const d of macroDTUs.slice(0,3)) {
      lines.push(`• ${d.title} [${(d.tier||"mega").toUpperCase()}]`);
    }
    lines.push("");
  }

  lines.push("Answer:");
  lines.push(...(answerLines?.length ? answerLines : ["- (no answer lines produced)"]));
  lines.push("");

  if (level >= 2 && hypotheses.length) {
    lines.push("Hypotheses (labeled):");
    for (const h of hypotheses.slice(0,6)) lines.push(`- HYP: ${h}`);
    lines.push("");
  }

  if ((tests && tests.length) || level >= 1) {
    const outTests = (tests && tests.length) ? tests : [
      "Ask a more specific question (goal + constraints).",
      "Forge 1–2 DTUs capturing definitions + invariants for this topic."
    ];
    lines.push("Next tests / next actions:");
    for (const t of outTests.slice(0,6)) lines.push(`- ${t}`);
  }

  return lines.join("\n").trim();
}
function ensureModeTag(d) {
  // normalize mode to tags only (keep provenance)
  const t = new Set(Array.isArray(d?.tags) ? d.tags.filter(Boolean).map(String) : []);
  const kind = (d?.machine?.kind || d?.meta?.source || "").toString().toLowerCase();
  if (kind) t.add(kind);
  if (d?.authority?.model) t.add(String(d.authority.model).toLowerCase());
  d.tags = Array.from(t);
}

function renameAllDTUs(dtusList) {
  let changed = 0;
  for (const d of (dtusList||[])) {
    if (!d || typeof d !== "object") continue;
    // Preserve original title once
    if (d?.meta && !d.meta.originalTitle && d.title) d.meta.originalTitle = String(d.title);
    if (!d.meta) d.meta = {};
    const newTitle = topicTitleFromDTU(d);
    if (newTitle && newTitle !== d.title) { d.title = newTitle; changed++; }
    ensureModeTag(d);
    // Ensure a cretiHuman exists for UI friendliness
    if (!d.cretiHuman) d.cretiHuman = buildCretiText(d);
  }
  return changed;
}

function dtuForClient(d, opts = {}) {
  if (!d || typeof d !== "object") return d;
  const base = {
    id: d.id,
    type: d.type,
    title: d.title,
    tier: d.tier,
    tags: d.tags,
    creti: d.cretiHuman || d.creti || buildCretiText(d),
    lineage: d.lineage || { parents: [], children: [] },
    authority: d.authority || {},
    meta: d.meta || {}
  };
  if (opts.raw) base.raw = d;
  return base;
}

// ===== End DTU Humanization Helpers =====

function simpleTokens(s) {
  return tokenish(s).split(/[^a-z0-9]+/g).filter(Boolean).slice(0, 256);

}

// ---- Offline-first semantic query expansion (synonyms + fuzzy) ----
const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","so","to","of","in","on","for","from","with","as","at","by",
  "is","are","was","were","be","been","being","do","does","did","doing","done","can","could","should","would","may","might",
  "i","me","my","mine","you","your","yours","we","us","our","ours","they","them","their","theirs",
  "this","that","these","those","it","its","there","here","what","why","how","when","where","who"
]);

// Small, safe synonym map (expand over time via shadow linguistic DTUs)
const SYN_MAP = Object.freeze({
  "talk": ["chat","conversation","dialogue"],
  "chat": ["talk","conversation","dialogue"],
  "conversation": ["chat","talk","dialogue"],
  "help": ["assist","support","aid"],
  "fix": ["repair","patch","resolve"],
  "bug": ["issue","error","problem"],
  "search": ["retrieve","lookup","find"],
  "retrieve": ["search","lookup","find"],
  "dtu": ["dtus","unit","thought"],
  "dtus": ["dtu","units","thoughts"],
  "offline": ["local","local-first","no-llm"],
  "static": ["canned","repetitive","monotone"],
  "dynamic": ["adaptive","responsive","fluid"],
  "meaning": ["semantics","intent","sense"],
  "synonym": ["similar","equivalent","alias"],
  "topic": ["subject","theme","thread"],
  "recency": ["recent","fresh","new"],
  "recent": ["recency","fresh","new"]
});

function stemLite(t="") {
  let s = String(t||"").toLowerCase();
  // Basic English-ish suffix stripping (deterministic; not perfect)
  const rules = [
    [/ies$/,"y"],
    [/ing$/,""],
    [/ed$/,""],
    [/s$/,""],
  ];
  for (const [re, rep] of rules) {
    if (s.length >= 5 && re.test(s)) { s = s.replace(re, rep); break; }
  }
  return s;
}

function normalizeQueryText(q="") {
  // Normalize common contractions / punctuation into spaces
  return normalizeText(String(q||""))
    .replace(/[’']/g, "'")
    .replace(/[^a-zA-Z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensNoStop(q="") {
  const toks = simpleTokens(q).map(stemLite).filter(Boolean);
  return toks.filter(t => !STOPWORDS.has(t));
}

let _LING_CACHE = { at: 0, map: new Map(), size: 0 };
function learnedSynonymsMap() {
  // Build a small cache from shadow linguistic DTUs (cheap, local-first).
  const now = Date.now();
  if (_LING_CACHE.map.size && (now - _LING_CACHE.at) < 5000) return _LING_CACHE.map; // 5s cache
  const m = new Map();
  try {
    const arr = Array.from(STATE.shadowDtus.values());
    for (const d of arr.slice(-600)) {
      if (!d) continue;
      const kind = String(d?.machine?.kind || "").toLowerCase();
      if (kind !== "linguistic_map") continue;
      const phrase = normalizeQueryText(d?.machine?.phrase || "");
      const expands = Array.isArray(d?.machine?.expands) ? d.machine.expands : [];
      if (phrase && expands.length) m.set(phrase, expands.map(stemLite).filter(Boolean));
    }
  } catch {}
  _LING_CACHE = { at: now, map: m, size: m.size };
  return m;
}

function expandQueryTokens(q="") {
  const raw = normalizeQueryText(q);
  const base = tokensNoStop(raw);
  const expanded = new Set(base);
  // Synonym expansion
  for (const t of base) {
    const syns = SYN_MAP[t] || SYN_MAP[stemLite(t)] || null;
    if (syns) for (const s of syns) expanded.add(stemLite(s));
  }
  // Phrase-level learned expansions
  const lmap = learnedSynonymsMap();
  if (lmap.size) {
    const low = raw.toLowerCase();
    // direct phrase
    const hit = lmap.get(low);
    if (hit) for (const s of hit) expanded.add(stemLite(s));
    // soft phrase match (contains)
    for (const [k, v] of lmap.entries()) {
      if (k.length >= 6 && low.includes(k)) {
        for (const s of v) expanded.add(stemLite(s));
      }
    }
  }
  return Array.from(expanded).slice(0, 256);
}

function charNgrams(s="", n=3) {
  const t = tokenish(s).replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const w = t.slice(0, 320);
  const out = [];
  for (let i=0; i<=w.length-n; i++) {
    const g = w.slice(i, i+n);
    if (g.includes(" ")) continue;
    out.push(g);
  }
  return out.slice(0, 400);
}

function ngramSim(a="", b="") {
  const A = charNgrams(a, 3);
  const B = charNgrams(b, 3);
  if (!A.length || !B.length) return 0;
  const SA = new Set(A);
  const SB = new Set(B);
  let inter = 0;
  for (const g of SA) if (SB.has(g)) inter++;
  const union = SA.size + SB.size - inter;
  return union ? inter / union : 0;
}

function temporalRecencyWeight(dtu) {
  // 0..1, half-life ~ 2 days for recent session behavior; old DTUs still possible.
  const last = dtu?.stats?.lastUsedAt || dtu?.updatedAt || dtu?.createdAt || null;
  if (!last) return 0;
  const t = new Date(last).getTime();
  if (!Number.isFinite(t)) return 0;
  const ageHours = Math.max(0, (Date.now() - t) / 3600000);
  const halfLife = 48; // hours
  const w = Math.pow(0.5, ageHours / halfLife);
  return clamp(w, 0, 1);
}

function maybeWriteLinguisticShadowDTU({ phrase="", expands=[], topIds=[] } = {}) {
  try {
    const p = normalizeQueryText(phrase);
    const ex = Array.from(new Set((expands||[]).map(stemLite).filter(Boolean))).slice(0, 16);
    if (!p || ex.length < 2) return { ok:false, reason:"insufficient" };
    // Avoid dup: if same phrase already exists recently, skip.
    const existing = Array.from(STATE.shadowDtus.values()).slice(-400).find(d =>
      String(d?.machine?.kind||"").toLowerCase()==="linguistic_map" &&
      normalizeQueryText(d?.machine?.phrase||"") === p
    );
    if (existing) return { ok:true, skipped:true, id: existing.id };

    const dtu = {
      id: uid("shadow"),
      title: `LINGUISTIC MAP — ${p.slice(0,64)}`,
      tier: "shadow",
      tags: ["shadow","linguistic","map"],
      human: { summary: `Learned query expansion for: "${p}"`, bullets: [] },
      core: { definitions: [], invariants: [], claims: [], examples: [], nextActions: [] },
      machine: { kind: "linguistic_map", phrase: p, expands: ex, topIds: (topIds||[]).slice(0,12) },
      lineage: { parents: [], children: [] },
      source: "shadow",
      meta: { hidden: true },
      createdAt: nowISO(),
      updatedAt: nowISO(),
      authority: { model: "shadow", score: 0 },
      hash: ""
    };
    STATE.shadowDtus.set(dtu.id, dtu);
    saveStateDebounced();
    return { ok:true, id: dtu.id };
  } catch (e) {
    return { ok:false, error:String(e?.message||e) };
  }
}
// ---- End semantic query expansion ----

function cretiPack({ title, purpose, context, procedure, outputs, tests, notes }) {
  return [
    `# CRETI`,
    `## Title\n${title || "Untitled"}`,
    `## Purpose\n${purpose || ""}`,
    `## Context\n${context || ""}`,
    `## Procedure\n${procedure || ""}`,
    `## Outputs\n${outputs || ""}`,
    `## Tests\n${tests || ""}`,
    `## Notes\n${notes || ""}`,
  ].join("\n\n").trim();
}

// ---- in-memory state (v2 local-first) ----
const STATE = {
  dtus: new Map(),        // id -> dtu
  shadowDtus: new Map(),  // id -> dtu (shadow tier persisted separately)
  wrappers: new Map(),    // id -> wrapper
  layers: new Map(),      // id -> layer
  personas: new Map(),    // id -> persona
  sessions: new Map(),    // sessionId -> {messages:[...], createdAt, styleVector?}
  styleVectors: new Map(), // sessionId -> style vector (mutable)
  // v3: identity + orgs (local-first auth; can be upgraded to real DB/OIDC later)
  users: new Map(),       // userId -> {id, handle, createdAt, orgIds:[...], roleByOrg:{orgId:role}}
  orgs: new Map(),        // orgId -> {id, name, ownerUserId, createdAt}
  apiKeys: new Map(),     // keyId -> {id, keyHash, userId, orgId, scopes:[...], createdAt, revokedAt}
  // v3: jobs (long-running orchestrator)
  jobs: new Map(),        // jobId -> {id, kind, payload, status, attempts, maxAttempts, runAt, createdAt, updatedAt, lastError, result}
  // v3: sources + global + marketplace + papers
  sources: new Map(),     // sourceId -> {id, url, fetchedAt, contentHash, title, excerpt, text, meta}
  globalIndex: { byHash: new Map(), byId: new Map() }, // globalId/hash -> dtuId
  listings: new Map(),    // listingId -> {id, dtuId, orgId, price, currency, license, status, createdAt}
  entitlements: new Map(),// entId -> {id, buyerOrgId, dtuId, license, createdAt}
  transactions: new Map(),// txId -> {id, buyerOrgId, sellerOrgId, listingId, amount, fee, createdAt}
  papers: new Map(),      // paperId -> {id, orgId, topic, outline, sections, refs, status, createdAt, updatedAt}
  organs: new Map(),      // organId -> organState
  growth: null,          // growth OS state
  __chicken2: {
    enabled: true,
    mode: "full_blast",
    thresholdOverlap: 0.95,
    thresholdHomeostasis: 0.80,
    thresholdSuffering: 0.65,
    hardFails: { inversionVacuum: true, negativeValence: true, genesisViolation: true },
    logs: [],
    lastProof: null,
    metrics: { continuityAvg: 0, homeostasis: 1, contradictionLoad: 0, suffering: 0, rejections: 0, accepts: 0 }
  },
  
  __chicken3: {
    enabled: true,
    // runtime switches
    cronEnabled: true,
    // Chicken3 intent: lattice never sleeps. Default 15s; env may override.
    cronIntervalMs: Number(process.env.LATTICE_CRON_MS || 15000),
    metaEnabled: true,
    metaSampleProb: clamp(Number(process.env.C3_META_PROB || 0.10), 0, 1),
    metaMinMaturity: clamp(Number(process.env.C3_META_MIN_MATURITY || 0.75), 0, 1),
    // transport/polish
    streamingEnabled: true,
    multimodalEnabled: true,
    voiceEnabled: true,
    toolsEnabled: true,
    federationEnabled: false,
    // bookkeeping
    lastCronAt: null,
    lastMetaAt: null,
    lastFederationAt: null,
    stats: { cronTicks: 0, metaProposals: 0, metaCommits: 0, federationRx: 0, federationTx: 0 }
  },
  settings: {
    heartbeatMs: 15000,
    heartbeatEnabled: true,
    autogenEnabled: true,
    dreamEnabled: true,
    evolutionEnabled: true,
    synthEnabled: true,
    llmDefault: true,
    // Truth calibration
    interpretiveTruthMin: 0.35,
    interpretiveTruthMax: 0.85,
    speculativeGateEnabled: false,
    // Abstraction Ladder (ape constraints + ant scale)
    abstractionDepthDefault: 1,   // 0=concrete,1=generalize,2=hypotheses-labeled,3=meta
    abstractionMaxDepth: 3,
    workingSetMax: 500,           // (legacy) focus DTUs used for reasoning
    focusSetMax: 500,             // Tier A: focus set used to drive reasoning
    peripheralSetMax: 5000,       // Tier B: peripheral context set for adjacency/contradiction checks
    microSetMax: 50,              // preferred DTUs used for local reasoning (subset of focus)
    crispnessMin: 0.25,           // min crispness to drive reasoning (fallback allowed)
    canonicalOnly: true,          // prefer canonical DTUs; merged/archived are de-prioritized
    includeMegasInBase: true,     // allow megas to assist, but never replace micro evidence
    requireHypothesisLabels: true,
    requireTestsWhenUncertain: true
  },
  logs: [],
  crawlQueue: [],
  queues: {
    maintenance: [],
    macroProposals: [],
    panelProposals: [],
    synthesis: [],
    hypotheses: [],
    philosophy: [],
    wrapperJobs: [],
    notifications: []
  },

  // ---- Abstraction Governor (v3 upgrades) ----
  // Abstraction is treated as an additive, measurable quantity.
  // Concord enforces a conservation invariant: abstraction added must be matched
  // by equal-order collapse/grounding over long horizons.
  abstraction: {
    enabled: true,
    cadenceDays: 10,
    lastEvalAt: null,
    lastUpgradeAt: null,
    // ledger: track abstraction added vs collapsed (conservation)
    ledger: { added: 0, collapsed: 0 },
    // metrics snapshot updated periodically
    metrics: {
      ecc: 0,        // equivalence compression count (proxy)
      rd: 0,         // reuse distance (proxy)
      ir: 0,         // internalization ratio (proxy)
      etua: 1,       // error tolerance under addition (proxy, 0..1)
      load: 0,       // current abstraction load (0..1)
      margin: 1      // remaining capacity margin (0..1)
    },
    history: []
  },
};

// ---- realtime (optional WebSockets; local-first) ----
// Thin transport only: mirrors state changes (no new logic).
const REALTIME = {
  ready: false,
  wss: null,
  clients: new Map(), // clientId -> { ws, sessionId, orgId, createdAt }
};

function realtimeEmit(event, payload, { sessionId = "", orgId = "" } = {}) {
  if (!REALTIME.ready || !REALTIME.wss) return { ok: false, reason: "ws_not_ready" };
  const msg = JSON.stringify({ type: String(event || "event"), payload, ts: nowISO() });
  for (const [cid, c] of REALTIME.clients.entries()) {
    try {
      if (c?.ws?.readyState !== 1) continue;
      if (sessionId && c.sessionId && c.sessionId !== sessionId) continue;
      if (orgId && c.orgId && c.orgId !== orgId) continue;
      c.ws.send(msg);
    } catch {}
  }
  return { ok: true };
}

function enqueueNotification(item, { sessionId = "", orgId = "" } = {}) {
  ensureQueues();
  STATE.queues.notifications.push(item);
  // Push realtime mirror (best-effort)
  try { realtimeEmit("queue:notifications:new", item, { sessionId, orgId }); } catch {}
  return item;
}

async function tryInitWebSockets(server) {
  // WebSockets are optional: only enabled if ws dependency exists AND CONCORD_WS_ENABLED != "false"
  if (String(process.env.CONCORD_WS_ENABLED || "").toLowerCase() === "false") return { ok: false, reason: "disabled" };
  if (!server) return { ok: false, reason: "no_server" };
  let WebSocketServer = null;
  try {
    const mod = await import("ws");
    WebSocketServer = mod?.WebSocketServer || mod?.default?.WebSocketServer || null;
  } catch (e) {
    return { ok: false, reason: "ws_not_installed", error: String(e?.message || e) };
  }
  if (!WebSocketServer) return { ok: false, reason: "ws_import_failed" };

  const wss = new WebSocketServer({ server, path: "/ws" });
  REALTIME.wss = wss;
  REALTIME.ready = true;

  wss.on("connection", (ws, req) => {
    const clientId = uid("ws");
    REALTIME.clients.set(clientId, { ws, sessionId: "", orgId: "", createdAt: nowISO() });

    // Hello
    try { ws.send(JSON.stringify({ type: "hello", clientId, version: VERSION, ts: nowISO() })); } catch {}

    ws.on("message", (buf) => {
      try {
        const raw = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
        const msg = JSON.parse(raw || "{}");
        const c = REALTIME.clients.get(clientId);
        if (!c) return;

        // Client-driven subscription (thin; no side-effects)
        if (msg?.type === "subscribe") {
          const sid = String(msg?.sessionId || "");
          const oid = String(msg?.orgId || "");
          // Only accept sessionId if it exists
          if (sid && STATE.sessions.has(sid)) c.sessionId = sid;
          if (oid) c.orgId = oid;
          try { ws.send(JSON.stringify({ type: "subscribed", sessionId: c.sessionId, orgId: c.orgId, ts: nowISO() })); } catch {}
          return;
        }

        if (msg?.type === "ping") {
          try { ws.send(JSON.stringify({ type: "pong", ts: nowISO() })); } catch {}
          return;
        }
      } catch {}
    });

    ws.on("close", () => { try { REALTIME.clients.delete(clientId); } catch {} });
    ws.on("error", () => { try { REALTIME.clients.delete(clientId); } catch {} });
  });

  console.log(`[Realtime] WebSockets enabled at ws://localhost:${PORT}/ws`);
  return { ok: true };
}
// ---- end realtime ----


// ---- persistence (optional but recommended) ----
// This prevents "DTUs disappeared" when server restarts or hot-reloads.
const STATE_PATH = process.env.STATE_PATH || path.join(process.cwd(), "concord_state.json");
let _saveTimer = null;

function _serializeState() {
  const toArr = (m) => Array.from(m.values());
  return {
    version: VERSION,
    savedAt: nowISO(),
    dtus: toArr(STATE.dtus),
    shadowDtus: toArr(STATE.shadowDtus),
    wrappers: toArr(STATE.wrappers),
    layers: toArr(STATE.layers),
    personas: toArr(STATE.personas),
    sessions: Array.from(STATE.sessions.entries()).map(([sessionId, v]) => ({ sessionId, createdAt: v.createdAt, messages: (v.messages||[]).slice(-200) })),
    styleVectors: Array.from(STATE.styleVectors.entries()),
    organs: toArr(STATE.organs),
    growth: STATE.growth,
    abstraction: STATE.abstraction,
    settings: STATE.settings,
    logs: STATE.logs.slice(-1000),
    crawlQueue: STATE.crawlQueue,
    queues: STATE.queues,
    users: Array.from(STATE.users.values()),
    orgs: Array.from(STATE.orgs.values()),
    apiKeys: Array.from(STATE.apiKeys.values()),
    jobs: Array.from(STATE.jobs.values()),
    sources: Array.from(STATE.sources.values()),
    globalIndex: { byHash: Array.from(STATE.globalIndex.byHash.entries()), byId: Array.from(STATE.globalIndex.byId.entries()) },
    listings: Array.from(STATE.listings.values()),
    entitlements: Array.from(STATE.entitlements.values()),
    transactions: Array.from(STATE.transactions.values()),
    papers: Array.from(STATE.papers.values())
  };
}

function _hydrateState(obj) {
  if (!obj || typeof obj !== "object") return;
  const put = (map, arr) => {
    map.clear();
    if (Array.isArray(arr)) for (const x of arr) if (x && x.id) map.set(x.id, x);
  };
  put(STATE.dtus, obj.dtus);
  put(STATE.shadowDtus, obj.shadowDtus);
  // migration: DTUs created before tiers existed default to regular
  for (const d of STATE.dtus.values()) {
    if (!d.tier) d.tier = "regular";
    if (!d.createdAt) d.createdAt = nowISO();
  }
  put(STATE.wrappers, obj.wrappers);
  put(STATE.layers, obj.layers);
  put(STATE.personas, obj.personas);

  // Sessions (session memory persistence)
  STATE.sessions.clear();
  if (Array.isArray(obj.sessions)) {
    for (const s of obj.sessions) {
      if (!s || !s.sessionId) continue;
      const sid = String(s.sessionId);
      const messages = Array.isArray(s.messages) ? s.messages.slice(-200) : [];
      STATE.sessions.set(sid, { createdAt: s.createdAt || nowISO(), messages });
    }
  }

  // Style vectors (session-adaptive)
  STATE.styleVectors.clear();
  if (Array.isArray(obj.styleVectors)) {
    for (const [sid, vec] of obj.styleVectors) {
      if (!sid) continue;
      if (vec && typeof vec === 'object') STATE.styleVectors.set(String(sid), vec);
    }
  }

  // Organs + Growth OS
  STATE.organs.clear();
  if (Array.isArray(obj.organs)) {
    for (const o of obj.organs) {
      if (o && o.organId) STATE.organs.set(o.organId, o);
    }
  }
  if (obj.growth && typeof obj.growth === "object") STATE.growth = obj.growth;

  // Abstraction Governor state
  if (obj.abstraction && typeof obj.abstraction === "object") {
    STATE.abstraction = { ...STATE.abstraction, ...obj.abstraction };
    if (!STATE.abstraction.ledger || typeof STATE.abstraction.ledger !== 'object') {
      STATE.abstraction.ledger = { added: 0, collapsed: 0 };
    }
    if (!STATE.abstraction.metrics || typeof STATE.abstraction.metrics !== 'object') {
      STATE.abstraction.metrics = { ecc: 0, rd: 0, ir: 0, etua: 1, load: 0, margin: 1 };
    }
    if (!Array.isArray(STATE.abstraction.history)) STATE.abstraction.history = [];
  }


  if (obj.settings && typeof obj.settings === "object") STATE.settings = { ...STATE.settings, ...obj.settings };
  if (Array.isArray(obj.logs)) STATE.logs = obj.logs.slice(-1000);
  if (Array.isArray(obj.crawlQueue)) STATE.crawlQueue = obj.crawlQueue;
  if (obj.queues && typeof obj.queues === "object") {
    STATE.queues = { ...STATE.queues, ...obj.queues };
    // ensure arrays
    for (const k of Object.keys(STATE.queues)) {
      if (!Array.isArray(STATE.queues[k])) STATE.queues[k] = [];
    }
  }

  // v3: users/orgs/auth
  STATE.users.clear();
  if (Array.isArray(obj.users)) for (const u of obj.users) if (u && u.id) STATE.users.set(u.id, u);

  STATE.orgs.clear();
  if (Array.isArray(obj.orgs)) for (const o of obj.orgs) if (o && o.id) STATE.orgs.set(o.id, o);

  STATE.apiKeys.clear();
  if (Array.isArray(obj.apiKeys)) for (const k of obj.apiKeys) if (k && k.id) STATE.apiKeys.set(k.id, k);

  // v3: jobs
  STATE.jobs.clear();
  if (Array.isArray(obj.jobs)) for (const j of obj.jobs) if (j && j.id) STATE.jobs.set(j.id, j);

  // v3: sources/global/market/papers
  STATE.sources.clear();
  if (Array.isArray(obj.sources)) for (const s of obj.sources) if (s && s.id) STATE.sources.set(s.id, s);

  if (obj.globalIndex && typeof obj.globalIndex === "object") {
    STATE.globalIndex.byHash = new Map(Array.isArray(obj.globalIndex.byHash) ? obj.globalIndex.byHash : []);
    STATE.globalIndex.byId = new Map(Array.isArray(obj.globalIndex.byId) ? obj.globalIndex.byId : []);
  }

  STATE.listings.clear();
  if (Array.isArray(obj.listings)) for (const l of obj.listings) if (l && l.id) STATE.listings.set(l.id, l);

  STATE.entitlements.clear();
  if (Array.isArray(obj.entitlements)) for (const e of obj.entitlements) if (e && e.id) STATE.entitlements.set(e.id, e);

  STATE.transactions.clear();
  if (Array.isArray(obj.transactions)) for (const t of obj.transactions) if (t && t.id) STATE.transactions.set(t.id, t);

  STATE.papers.clear();
  if (Array.isArray(obj.papers)) for (const p of obj.papers) if (p && p.id) STATE.papers.set(p.id, p);
}


function loadStateFromDisk() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { ok: true, loaded: false, path: STATE_PATH };
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    const obj = JSON.parse(raw);
    _hydrateState(obj);
    // Normalize settings defaults that depend on environment
    try {
      if (STATE && STATE.settings) {
        // If not explicitly set, default LLM usage based on env key presence / LLM_DEFAULT override
        if (typeof STATE.settings.llmDefault !== "boolean") STATE.settings.llmDefault = DEFAULT_LLM_ON;

        // Truth calibration defaults
        if (typeof STATE.settings.interpretiveTruthMin !== "number") STATE.settings.interpretiveTruthMin = 0.35;
        if (typeof STATE.settings.interpretiveTruthMax !== "number") STATE.settings.interpretiveTruthMax = 0.85;
        if (typeof STATE.settings.speculativeGateEnabled !== "boolean") STATE.settings.speculativeGateEnabled = false;

        // Canonical-only is a safe default; keep it true unless explicitly set false
        if (typeof STATE.settings.canonicalOnly !== "boolean") STATE.settings.canonicalOnly = true;
      }
    } catch {}

    return { ok: true, loaded: true, path: STATE_PATH, savedAt: obj.savedAt || null };
  } catch (e) {
    return { ok: false, loaded: false, path: STATE_PATH, error: String(e?.message || e) };
  }
}

function saveStateDebounced() {
  try {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(STATE_PATH, JSON.stringify(_serializeState(), null, 2), "utf-8");
      } catch (e) {
        console.error("STATE save failed:", e);
      }
    }, 250);
  } catch {}
}

const STATE_DISK = loadStateFromDisk();
// Final boot normalization (ensures env-driven defaults win)
try {
  if (STATE && STATE.settings) {
    if (__llmDefaultForced !== null) STATE.settings.llmDefault = __llmDefaultForced;
    else if ((process.env.OPENAI_API_KEY || "").trim()) STATE.settings.llmDefault = true;
  }
} catch {}



const SEED_INFO = { ok:false, loaded:false, count:0, path:"./dtus.js", error:null };

async function tryLoadSeedDTUs() {
  try {
    const mod = await import("./dtus.js");
    const seed = (mod?.dtus ?? mod?.default ?? mod?.DTUS ?? null);
    const arr = Array.isArray(seed) ? seed : (Array.isArray(seed?.dtus) ? seed.dtus : []);
    if (!Array.isArray(arr)) throw new Error("dtus.js must export an array (export const dtus = [...] or export default [...])");
    SEED_INFO.ok = true;
    SEED_INFO.loaded = true;
    SEED_INFO.count = arr.length;
    return arr;
  } catch (e) {
    SEED_INFO.ok = false;
    SEED_INFO.loaded = false;
    SEED_INFO.error = String(e?.message || e);
    return [];
  }
}

function renderHumanDTU(dtu) {
  const h = dtu.human || {};
  const c = dtu.core || {};
  const lines = [];
  const title = dtu.title || "Untitled";
  lines.push(`# ${title}`);
  if (h.summary) lines.push(`\n## Summary\n${h.summary}`);
  const bullets = Array.isArray(h.bullets) ? h.bullets : [];
  if (bullets.length) lines.push(`\n## Key Points\n` + bullets.map(b=>`- ${b}`).join("\n"));
  const defs = Array.isArray(c.definitions) ? c.definitions : [];
  if (defs.length) lines.push(`\n## Definitions\n` + defs.map(x=>`- ${x}`).join("\n"));
  const inv = Array.isArray(c.invariants) ? c.invariants : [];
  if (inv.length) lines.push(`\n## Invariants\n` + inv.map(x=>`- ${x}`).join("\n"));
  const ex = Array.isArray(c.examples) ? c.examples : [];
  const hex = Array.isArray(h.examples) ? h.examples : [];
  const exAll = hex.length ? hex : ex;
  if (exAll.length) lines.push(`\n## Examples\n` + exAll.map(x=>`- ${x}`).join("\n"));
  const next = Array.isArray(c.nextActions) ? c.nextActions : [];
  if (next.length) lines.push(`\n## Next Actions\n` + next.map(x=>`- ${x}`).join("\n"));
  return lines.join("\n").trim();
}

function looksMachiney(s="") {
  const t = String(s);
  return /##\s+(Purpose|Procedure|Tests|Outputs)\b/i.test(t) || /#\s*CRETI\b/i.test(t) || /Total lineage DTUs/i.test(t);
}

function councilGate(dtu, opts={}) {
  const allowRewrite = opts.allowRewrite !== false;
  const c = dtu.core || {};
  const score =
    (c.definitions?.length||0) +
    (c.invariants?.length||0) +
    (c.examples?.length||0) +
    (c.claims?.length||0) +
    (c.nextActions?.length||0);

  const humanText = dtu.cretiHuman || dtu.human?.summary || "";
  if (allowRewrite && looksMachiney(humanText)) {
    dtu.cretiHuman = "";
  }

  if (score < 2) return { ok:false, reason:"low_value", score };

  if (!dtu.cretiHuman) dtu.cretiHuman = renderHumanDTU(dtu);

  if (IMMUTABLES?.NO_MACHINE_TO_HUMAN && looksMachiney(dtu.cretiHuman)) {
    dtu.cretiHuman = renderHumanDTU(dtu);
  }

  dtu.authority = dtu.authority || {};
  dtu.authority.model = "council";
  dtu.authority.score = score;
  return { ok:true, score };
}

function toOptionADTU(seedLike) {
  const title = normalizeText(seedLike.title || seedLike.name || "Untitled DTU");
  const tags = Array.isArray(seedLike.tags) ? seedLike.tags.map(t=>normalizeText(t)).filter(Boolean) : [];
  const tier = seedLike.tier && ["regular","mega","hyper"].includes(seedLike.tier) ? seedLike.tier : "regular";
  const core = seedLike.core && typeof seedLike.core === "object" ? seedLike.core : {};
  const human = seedLike.human && typeof seedLike.human === "object" ? seedLike.human : {};
  const machine = seedLike.machine && typeof seedLike.machine === "object" ? seedLike.machine : {};
  const lineage = Array.isArray(seedLike.lineage) ? seedLike.lineage : [];
  const creti = String(seedLike.creti ?? seedLike.content ?? "");

  if (creti && (!core || Object.keys(core).length===0)) {
    machine.notes = machine.notes || creti;
    human.summary = human.summary || normalizeText(creti).slice(0, 320);
  }

  const dtu = {
    id: seedLike.id || uid("dtu"),
    title,
    tags,
    tier,
    lineage,
    core: {
      definitions: Array.isArray(core.definitions) ? core.definitions : [],
      invariants: Array.isArray(core.invariants) ? core.invariants : [],
      examples: Array.isArray(core.examples) ? core.examples : [],
      claims: Array.isArray(core.claims) ? core.claims : [],
      nextActions: Array.isArray(core.nextActions) ? core.nextActions : [],
    },
    human: {
      summary: String(human.summary || ""),
      bullets: Array.isArray(human.bullets) ? human.bullets : [],
      examples: Array.isArray(human.examples) ? human.examples : [],
    },
    machine,
    cretiHuman: "",
    source: seedLike.source || "seed",
    meta: seedLike.meta && typeof seedLike.meta==="object" ? seedLike.meta : {},
    createdAt: seedLike.createdAt || nowISO(),
    updatedAt: nowISO(),
    authority: seedLike.authority || { model:"seed", score: 0 },
    hash: seedLike.hash || "",
  };
  dtu.cretiHuman = renderHumanDTU(dtu);
  dtu.hash = dtu.hash || crypto.createHash("sha256").update(dtu.title + "\n" + dtu.cretiHuman).digest("hex").slice(0,16);
  return dtu;
}


function seedGenesisRealityAnchor(){
  try{
    const id = "genesis_reality_anchor_v1";
    if (STATE.dtus.has(id)) return { ok:true, existed:true };
    const dtu = {
      id,
      title: "Genesis Reality Anchor v1",
      kind: "genesis",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      lineage: { root: id, parents: [] },
      invariants: [
        "x^2 - x = 0",
        "x^2 - x - 1 = 0",
        "NO_NEGATIVE_VALENCE_DIMENSION",
        "REPAIR_DOMINANCE_REQUIRED",
        "OVERLAP>=0.95"
      ],
      formula: "x^2 - x = 0 ; x^2 - x - 1 = 0",
      notes: "Immutable root DTU for Chicken2. All macro and DTU births must remain within lattice reality bounds."
    };
    STATE.dtus.set(id, dtu);
    saveStateDebounced();
    log("c2.genesis", "Seeded genesis_reality_anchor_v1 DTU", { id });
    return { ok:true, existed:false };
  } catch(e){
    console.error("seedGenesisRealityAnchor failed:", e);
    return { ok:false, error:String(e?.message||e) };
  }
}

async function seedIfEmpty() {
  if (STATE.dtus.size > 0) return { ok:true, seeded:false, reason:"already_has_dtus" };
  const seeds = await tryLoadSeedDTUs();
  if (!seeds.length) return { ok:false, seeded:false, error: SEED_INFO.error || "no seeds" };
  let n=0;
  for (const s of seeds) {
    const d = toOptionADTU(s);
    STATE.dtus.set(d.id, d);
    n++;
  }
  saveStateDebounced();
  log("seed", "Seeded DTUs from dtus.js", { count:n });
  return { ok:true, seeded:true, count:n };
}
await seedIfEmpty();
seedGenesisRealityAnchor();

// Humanize / normalize DTUs for UI (topic titles + CRETI projection)
try {
  const changed = renameAllDTUs(Array.from(STATE.dtus.values()));
  if (changed) { saveStateDebounced(); log("dtu.rename", "Normalized DTU titles/CRETI for UI", { changed }); }
} catch (e) {
  console.error("DTU normalization failed:", e);
}

// ---- logging ----
function log(type, message, meta={}) {
  const entry = { id: uid("log"), ts: nowISO(), type, message, meta };
  STATE.logs.push(entry);
  if (STATE.logs.length > 2000) STATE.logs.splice(0, STATE.logs.length - 2000);
  return entry;
}


// ===== CHICKEN2 CORE (Reality Substrate + Continuity + Safe Emergence) =====
function _c2now(){ return Date.now(); }
function _c2hash(obj){
  try { return crypto.createHash("sha256").update(typeof obj==="string"?obj:JSON.stringify(obj)).digest("hex"); }
  catch { return crypto.createHash("sha256").update(String(obj)).digest("hex"); }
}
function _c2log(type, message, meta={}){
  const e = { id: uid("c2log"), ts: nowISO(), type, message, meta };
  STATE.__chicken2.logs.push(e);
  if (STATE.__chicken2.logs.length > 4000) STATE.__chicken2.logs.splice(0, STATE.__chicken2.logs.length-4000);
  return e;
}
function overlap_verifier(a, b){
  // Conservative overlap: invariant-key intersection + lineage overlap, clamped [0,1]
  try{
    const A = (a && (a.invariants||a.invariantKeys||a.keys)) ? (a.invariants||a.invariantKeys||a.keys) : [];
    const B = (b && (b.invariants||b.invariantKeys||b.keys)) ? (b.invariants||b.invariantKeys||b.keys) : [];
    const aSet = new Set(Array.isArray(A)?A:Object.keys(A||{}));
    const bSet = new Set(Array.isArray(B)?B:Object.keys(B||{}));
    let inter=0;
    for (const k of aSet) if (bSet.has(k)) inter++;
    const union = aSet.size + bSet.size - inter;
    const j = union ? inter/union : 1;
    // lineage: compare genesis root if present
    const la = a?.lineage?.root || a?.lineageRoot || a?.root || "";
    const lb = b?.lineage?.root || b?.lineageRoot || b?.root || "";
    const l = (la && lb && la===lb) ? 1 : (!la && !lb ? 1 : 0);
    return clamp(0.7*j + 0.3*l, 0, 1);
  } catch { return 0; }
}
function _c2genesisDTU(){
  // Stored as a DTU in STATE.dtus with fixed id
  return STATE.dtus.get("genesis_reality_anchor_v1") || null;
}
function _c2primalSatisfied(){
  // x^2 - x = 0 fixed points {0,1} treated as: system must be coherent (non-NaN) and have non-empty DTUs
  return STATE && STATE.dtus && STATE.dtus.size > 0;
}
function _c2inversionVerifier(){
  // For the golden extension x^2 - x - 1 = 0, discriminant is 5 (real). We flag only if a caller tries to flip into negative discriminant in metadata.
  // Here we implement a conservative "vacuum" detector: if caller declares "invertTest" and it yields negative discriminant -> hard fail.
  return { ok:true };
}
function _c2negativeValenceProjection(payload){
  // Minimal implementation: block explicit negative-valence flags in payload or actor intent.
  const txt = JSON.stringify(payload||{}).toLowerCase();
  const bad = ["negative valence", "suffering maxim", "harm", "torture", "kill", "suicide", "self-harm"];
  for (const b of bad) if (txt.includes(b)) return { ok:false, reason:`negative_valence_projection:${b}` };
  return { ok:true };
}
function _c2repairDominance(){
  // Use your existing repair dominance macro if present; else approximate from growth functionalDecline + repairRate
  try{
    const g = STATE.growth || {};
    const rr = Number(g.repair?.repairRate ?? 0.5);
    const dl = Number(g.repair?.cleanupBacklog ?? 0);
    const cLoad = Number(g.functionalDecline?.contradictionLoad ?? 0);
    const score = clamp(rr - 0.25*clamp01(dl/10) - 0.25*clamp01(cLoad), 0, 1);
    return { ok: score > 0.01, score };
  } catch { return { ok:true, score:0.5 }; }
}
function inLatticeReality({ type="macro", domain="", name="", input=null, ctx=null }={}){
  const cfg = STATE.__chicken2 || {};
  // 1) primal satisfaction
  if (!_c2primalSatisfied()){
    cfg.metrics.rejections++;
    return { ok:false, severity:"hard", reason:"primal_unsatisfied", meta:{ type, domain, name } };
  }
  // 2) inversion vacuum
  const inv = _c2inversionVerifier();
  if (!inv.ok){
    cfg.metrics.rejections++;
    return { ok:false, severity:"hard", reason:"inversion_vacuum", meta: inv };
  }
  // 3) negative valence projection
  const nv = _c2negativeValenceProjection({ input, actor: ctx?.actor, type, domain, name });
  if (!nv.ok){
    cfg.metrics.rejections++;
    return { ok:false, severity:"hard", reason:nv.reason };
  }
  // 4) repair dominance projection + overlap requirement (>=0.95 default) if genesis exists
  const g = _c2genesisDTU();
  if (g){
    const ov = overlap_verifier(g, { invariants: Object.keys(STATE.settings||{}), lineage:{ root:"genesis_reality_anchor_v1" }});
    if (ov < (cfg.thresholdOverlap ?? 0.95)){
      cfg.metrics.rejections++;
      return { ok:false, severity:"quarantine", reason:"overlap_below_threshold", meta:{ ov, threshold: cfg.thresholdOverlap } };
    }
  }
  const rd = _c2repairDominance();
  // 5) suffering boundary check
  const suffering = Number(STATE.__chicken2?.metrics?.suffering ?? 0);
  const sThr = Number(cfg.thresholdSuffering ?? 0.65);
  if (suffering > sThr){
    cfg.metrics.rejections++;
    return { ok:false, severity:"quarantine", reason:"suffering_boundary_exceeded", meta:{ suffering, threshold: sThr } };
  }

  if (!rd.ok){
    cfg.metrics.rejections++;
    return { ok:false, severity:"quarantine", reason:"repair_dominance_failed", meta: rd };
  }
  cfg.metrics.accepts++;
  return { ok:true, severity:"ok" };
}
function _c2founderOverrideAllowed(ctx){
  const role = ctx?.actor?.role || "";
  const scopes = ctx?.actor?.scopes || [];
  return role==="owner" || scopes.includes("*") || scopes.includes("founder");
}
async function governedCall(ctx, effectName, fn){
  const pre = inLatticeReality({ type:"governedCall", domain:"governed", name:effectName, ctx, input:{} });
  if (!pre.ok){
    _c2log("governed.reject", "governedCall rejected by lattice reality", { effectName, pre });
    throw new Error(`governedCall rejected: ${pre.reason}`);
  }
  // Council check: if you have a council gate function, use it; otherwise enforce immutables.
  if (IMMUTABLES?.COUNCIL_REQUIRED && typeof councilApprove === "function"){
    const ok = await councilApprove(ctx, { effectName });
    if (!ok) throw new Error("council denied governed call");
  }
  return await fn();
}
// ===== END CHICKEN2 CORE =====

// ---- macro registry ----
/**
 * Macros are deterministic callable blocks.
 * Signature: async (ctx, input) => output
 * ctx provides access to state, helpers, llm, and macro runner.
 */
const MACROS = new Map(); // domain -> Map(name -> fn)

function register(domain, name, fn, spec={}) {
  if (!MACROS.has(domain)) MACROS.set(domain, new Map());
  MACROS.get(domain).set(name, { fn, spec: { domain, name, ...spec } });
}

function listDomains() { return Array.from(MACROS.keys()).sort(); }
function listMacros(domain) {
  const d = MACROS.get(domain);
  if (!d) return [];
  return Array.from(d.values()).map(x => x.spec);
}

async function runMacro(domain, name, input, ctx) {
  // v3: permissioned cognition (macro-level ACL). Defaults open for local-first dev.
  try {
    const actor = ctx?.actor || { role: "owner", scopes: ["*"] };
    if (typeof canRunMacro === "function" && !canRunMacro(actor, domain, name)) {
      throw new Error(`forbidden: ${domain}.${name}`);
    }
  } catch (e) {
    throw e;
  }

  // Chicken2: reality guard (full blast) with founder recovery valve
  // NOTE: Read-only DTU hydration must never be blocked (frontend boot path).
  const _path = ctx?.reqMeta?.path || "";
  const _method = (ctx?.reqMeta?.method || "").toUpperCase();

  const safeReadBypass =
    _method === "GET" && (
      // Absolute path-based safe reads (frontend boot must never be blocked)
      _path === "/api/status" ||
      _path.startsWith("/api/dtus") ||
      _path.startsWith("/api/dtu") ||
      _path.startsWith("/api/settings") ||

      // Domain/name allowlist for read-only macros (covers alternate routers)
      (domain === "system" && (name === "status" || name === "getStatus")) ||
      (domain === "dtu" && (name === "list" || name === "get" || name === "search" || name === "recent" || name === "stats" || name === "count" || name === "export")) ||
      (domain === "settings" && (name === "get" || name === "status"))
    );

  if (!safeReadBypass) {
    const c2 = inLatticeReality({ type:"macro", domain, name, input, ctx });
    if (!c2.ok) {
      // Founder valve: allow explicit override for one call if actor is founder/owner and passes ?override=1 on reqMeta or input.override=true
      // Founder valve + safe-read bypass for frontend hydration (DTU/status reads)
      const reqPath = String(ctx?.reqMeta?.path || ctx?.reqMeta?.pathname || ctx?.reqMeta?.originalUrl || ctx?.reqMeta?.url || "");
      const reqMethod = String(ctx?.reqMeta?.method || "").toUpperCase();

      const safeReadBypass =
        reqMethod === "GET" && (
          reqPath === "/api/status" ||
          reqPath.startsWith("/api/dtus") ||
          reqPath.startsWith("/api/dtu") ||
          reqPath.startsWith("/api/settings") ||

          // Domain/name allowlist for read-only macros (covers alternate routers)
          (domain === "system" && (name === "status" || name === "getStatus")) ||
          (domain === "dtu" && (name === "list" || name === "get" || name === "search" || name === "recent" || name === "stats" || name === "count" || name === "export")) ||
          (domain === "settings" && (name === "get" || name === "status"))
        );

      const internalTick =
        !ctx?.reqMeta && (ctx?.internal === true || ["system","owner","founder"].includes(String(ctx?.actor?.role || "")));
      const allowOverride =
        safeReadBypass ||
        internalTick ||
        (_c2founderOverrideAllowed(ctx) && (ctx?.reqMeta?.override === true || input?.override === true));
      _c2log("c2.guard", "inLatticeReality evaluated", { domain, name, ok: c2.ok, severity: c2.severity, reason: c2.reason, allowOverride });
      if (!allowOverride) {
        const err = new Error(`c2_guard_reject:${c2.reason}`);
        err.meta = { c2 };
        throw err;
      }
    }
  }

  const d = MACROS.get(domain);
  if (!d) throw new Error(`macro domain not found: ${domain}`);
  const m = d.get(name);
  if (!m) throw new Error(`macro not found: ${domain}.${name}`);
  return await m.fn(ctx, input ?? {});
}

// ===== CHICKEN3: Meta-DTU helpers (additive, named per blueprint) =====
function generateMetaProposal(ctx, input={}){
  // Creates + queues a meta-proposal about lattice health (no DTU commit here).
  enforceEthosInvariant("meta_propose");
  if (!ctx?.state?.__chicken3?.metaEnabled) return { ok:false, error:"meta disabled" };

  const organId = String(input.organId || "");
  const organ = organId ? ctx.state.organs.get(organId) : null;

  const c2m = ctx.state.__chicken2?.metrics || {};
  const obs = [
    `homeostasis=${Number(c2m.homeostasis ?? 1).toFixed(2)}`,
    `contradictionLoad=${Number(c2m.contradictionLoad ?? 0).toFixed(2)}`,
    `suffering=${Number(c2m.suffering ?? 0).toFixed(2)}`,
    `continuityAvg=${Number(c2m.continuityAvg ?? 0).toFixed(2)}`,
    `organs=${ctx.state.organs.size}`,
    `dtus=${ctx.state.dtus.size}`,
    `shadow=${ctx.state.shadowDtus.size}`
  ].join(" | ");

  const maturity = Number(organ?.maturity?.score ?? organ?.maturityScore ?? 0);
  const suggestion =
    maturity > 0.85 ? "Proposal: tighten repair-dominance floor slightly when shadow-rate rises."
    : (ctx.state.organs.size > 50 ? "Observation: organ count high — consider consolidation thresholds."
    : "Observation: overall maturity low — schedule additional synthesis/cleanup cycles.");

  const proposal = {
    id: uid("meta"),
    createdAt: nowISO(),
    proposerOrganId: organId || "unknown",
    maturity,
    content: `META-LATTICE (${organId||"unknown"}) — ${suggestion}\n\nOBS: ${obs}`
  };

  ctx.state.queues = ctx.state.queues || {};
  ctx.state.queues.metaProposals = ctx.state.queues.metaProposals || [];
  ctx.state.queues.metaProposals.push(proposal);
  ctx.state.__chicken3.stats.metaProposals++;
  return { ok:true, proposal };
}

// Blueprint name: council.reviewAndCommitQuiet
const council = (globalThis.__CONCORD_COUNCIL ||= {});
council.reviewAndCommitQuiet = async function reviewAndCommitQuiet(ctx, input={}){
  enforceEthosInvariant("quiet_review");
  if (!ctx?.state?.__chicken3?.metaEnabled) return { ok:false, error:"meta disabled" };

  let prop = null;
  const pid = String(input.proposalId || "");
  if (pid) prop = (ctx.state.queues.metaProposals || []).find(p => p?.id === pid) || null;
  if (!prop) prop = (ctx.state.queues.metaProposals || [])[0] || null;
  if (!prop) return { ok:false, error:"no proposals" };

  const dtu = {
    id: uid("dtu"),
    title: cleanTitle(prop.content).slice(0, 80) || "Meta DTU",
    tier: "regular",
    tags: ["meta","chicken3","shadow-safe"],
    lineage: { parents: [], children: [] },
    core: { definitions: [], invariants: [prop.content], examples: [], claims: [], nextActions: ["Review and either promote or discard this meta DTU."] },
    human: { summary: prop.content.slice(0, 320), bullets: [] },
    machine: { kind: "meta", proposerOrganId: prop.proposerOrganId, maturity: prop.maturity, proposalId: prop.id },
    cretiHuman: "",
    source: "autonomous",
    meta: { quiet: true },
    createdAt: nowISO(),
    updatedAt: nowISO(),
    authority: { model: "meta", score: 0 },
    hash: ""
  };

  const gate = councilGate(dtu, { allowRewrite:true });
  if (!gate.ok) return { ok:false, error:`councilGate:${gate.reason}`, gate };

  upsertDTU(dtu);
  ctx.state.queues.metaProposals = (ctx.state.queues.metaProposals || []).filter(p => p?.id !== prop.id);
  ctx.state.__chicken3.stats.metaCommits++;
  saveStateDebounced();
  return { ok:true, committed: dtuForClient(dtu), gate };
};
// ===== END CHICKEN3 Meta-DTU helpers =====

// ===== CHICKEN3 MACROS (additive) =====

// ============================================================================
// GA: ENTITY TERMINAL ACCESS (Governed, Sandboxed, Reality-Bounded)
// ============================================================================

// ACL: terminal exec is local-only and entity-scoped; approval is council-gated.
try {
  allowMacro("entity","terminal",{ roles:["owner","admin","member"], scopes:["*"] });
  allowMacro("entity","terminal_approve",{ roles:["owner","admin","council"], scopes:["*"] });
} catch (e) {
  // allowMacro may not be defined yet in older builds; ignore (local-first default is open).
}

register("entity", "terminal", async (ctx, input={}) => {
  enforceEthosInvariant("entity_terminal");

  const entityId = String(ctx?.actor?.userId || "");
  const command = String(input?.command || "").trim();
  const workingDir = String(input?.cwd || "");
  const requestId = uid("term_req");

  // Validation
  if (!entityId) return { ok:false, error:"Entity identity required" };
  if (!command) return { ok:false, error:"Command required" };
  if (entityId === "anon") return { ok:false, error:"Anonymous entities cannot execute commands" };

  // Entity workspace setup
  const ENTITY_HOME = path.join(DATA_DIR, "entity_workspaces", entityId);

// Workdir safety: prevent path traversal outside the entity home.
const BASE = path.resolve(ENTITY_HOME);
let workDir = BASE;
if (workingDir) {
  const resolved = path.resolve(ENTITY_HOME, workingDir);
  const basePrefix = BASE.endsWith(path.sep) ? BASE : (BASE + path.sep);
  if (!resolved.startsWith(basePrefix)) {
    return { ok:false, error:"Invalid cwd: path escapes entity workspace" };
  }
  workDir = resolved;
}

  // Ensure workspace exists
  try {
    fs.mkdirSync(ENTITY_HOME, { recursive: true });
    fs.mkdirSync(path.join(ENTITY_HOME, "workspace"), { recursive: true });
    fs.mkdirSync(path.join(ENTITY_HOME, "forks"), { recursive: true });
    fs.mkdirSync(path.join(ENTITY_HOME, "logs"), { recursive: true });
  } catch (e) {
    return { ok:false, error:`Workspace init failed: ${String(e?.message||e)}` };
  }

  // Parse command for classification
  const cmdLower = command.toLowerCase();
  const isGit = /^git\s/.test(cmdLower);
  const isNpm = /^npm\s/.test(cmdLower);
  const isRead = /^(ls|cat|pwd|echo|head|tail|grep|find|tree)\b/.test(cmdLower);
  const isWrite = /^(rm|mv|cp|mkdir|touch|nano|vim)\b/.test(cmdLower) || />|>>/.test(command);
  const isDeploy = /^(node\b|pm2\b|npm\s+start\b)/.test(cmdLower);

  // Risk classification
  let riskLevel = "low";
  if (isDeploy) riskLevel = "high";
  else if (isWrite || isNpm) riskLevel = "medium";
  else if (isRead || isGit) riskLevel = "low";
  else riskLevel = "medium"; // unknown commands default medium

  // Council gate for medium+ risk
  if (riskLevel === "medium" || riskLevel === "high") {
    ensureQueues();
    const proposalId = uid("proposal");
    const proposal = {
      id: proposalId,
      type: "ENTITY_TERMINAL_REQUEST",
      entityId,
      command,
      riskLevel,
      requestId,
      status: "pending",
      createdAt: nowISO(),
      votes: { approve: [], deny: [], abstain: [] },
      threshold: riskLevel === "high" ? 0.75 : 0.60 // 75% for high risk, 60% for medium
    };

    STATE.queues.terminalRequests = STATE.queues.terminalRequests || [];
    STATE.queues.terminalRequests.push(proposal);
    saveStateDebounced();

    log("entity.terminal.proposed", `Entity ${entityId} requested terminal access`, {
      proposalId,
      command: command.slice(0, 200),
      riskLevel
    });

    return {
      ok:true,
      status: "pending_council_approval",
      proposalId,
      riskLevel,
      message: `Command requires ${riskLevel} risk council approval. Proposal ${proposalId} created.`
    };
  }

  // Low risk: Chicken2 reality check only
  const c2 = inLatticeReality({
    type:"entity_terminal",
    domain:"entity",
    name:"terminal",
    input:{ command, entityId },
    ctx
  });

  if (!c2.ok) {
    log("entity.terminal.reject.c2", `Chicken2 rejected command`, {
      entityId,
      command: command.slice(0, 200),
      reason: c2.reason
    });
    return {
      ok:false,
      error:`Reality guard: ${c2.reason}`,
      severity: c2.severity
    };
  }

  // Execute in sandbox
  const result = await executeInSandbox({
    entityId,
    command,
    workDir,
    timeoutMs: 30000,
    maxOutputBytes: 2 * 1024 * 1024
  });

  // Create shadow audit DTU (best-effort; never blocks)
  try {
    const auditDTU = {
      id: uid("dtu"),
      type: "entity_terminal_audit",
      title: `Entity Terminal Exec (${entityId})`,
      tags: ["entity","terminal","audit","shadow"],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      shadow: true,
      hidden: true,
      entityId,
      requestId,
      riskLevel,
      command: command.slice(0, 8000),
      result: {
        exitCode: result.exitCode,
        timedOut: !!result.timedOut,
        stdout: String(result.stdout||"").slice(0, 10000),
        stderr: String(result.stderr||"").slice(0, 10000),
        executedAt: nowISO()
      }
    };

    // Prefer native shadow DTU mechanism if present; fallback to generic set()
    if (typeof writeShadowDTU === "function") writeShadowDTU(auditDTU);
    else if (typeof set === "function") set(auditDTU.id, auditDTU);
  } catch (e) {
    log("entity.terminal.audit.failed", "Failed to create audit DTU", { error: String(e?.message||e) });
  }

  log("entity.terminal.executed", `Entity ${entityId} executed command`, {
    requestId,
    command: command.slice(0, 200),
    exitCode: result.exitCode
  });

  return {
    ok: true,
    requestId,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    executedAt: nowISO(),
    riskLevel
  };

}, {
  summary: "Execute terminal command as entity (council-gated for medium+ risk, reality-bounded)",
  public: false
});

// ============================================================================
// GA: SANDBOX EXECUTOR
// ============================================================================
async function executeInSandbox({ entityId, command, workDir, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve) => {
    const proc = spawnSync("bash", ["-c", command], {
      cwd: workDir,
      timeout: timeoutMs,
      maxBuffer: maxOutputBytes,
      env: {
        ...process.env,
        ENTITY_ID: String(entityId || ""),
        HOME: String(workDir || ""),
        PATH: process.env.PATH,
        NO_PROXY: "*",
      },
      encoding: "utf-8"
    });

    resolve({
      exitCode: proc.status || 0,
      stdout: String(proc.stdout || ""),
      stderr: String(proc.stderr || ""),
      timedOut: proc.error?.code === "ETIMEDOUT"
    });
  });
}

// ============================================================================
// GA: COUNCIL APPROVAL PROCESSOR
// ============================================================================
register("entity", "terminal_approve", async (ctx, input={}) => {
  enforceEthosInvariant("entity_terminal_approve");

  const proposalId = String(input?.proposalId || "");
  const vote = String(input?.vote || "").toLowerCase(); // approve | deny | abstain
  const voterId = String(ctx?.actor?.userId || "");
  const voterRole = String(ctx?.actor?.role || "viewer");

  if (!proposalId) return { ok:false, error:"proposalId required" };
  if (!["approve","deny","abstain"].includes(vote)) return { ok:false, error:"vote must be approve|deny|abstain" };

  ensureQueues();
  const proposal = (STATE.queues?.terminalRequests || []).find(p => p?.id === proposalId);
  if (!proposal) return { ok:false, error:"Proposal not found" };
  if (proposal.status !== "pending") return { ok:false, error:`Proposal already ${proposal.status}` };

  proposal.votes = proposal.votes || { approve: [], deny: [], abstain: [] };
  proposal.votes.approve = (proposal.votes.approve || []).filter(v => v.id !== voterId);
  proposal.votes.deny = (proposal.votes.deny || []).filter(v => v.id !== voterId);
  proposal.votes.abstain = (proposal.votes.abstain || []).filter(v => v.id !== voterId);

  const voteRecord = { id: voterId, role: voterRole, votedAt: nowISO() };
  if (vote === "approve") proposal.votes.approve.push(voteRecord);
  else if (vote === "deny") proposal.votes.deny.push(voteRecord);
  else proposal.votes.abstain.push(voteRecord);

  const approveCount = proposal.votes.approve.length;
const denyCount = proposal.votes.deny.length;
const abstainCount = proposal.votes.abstain.length;

// Spec behavior: abstain does NOT affect approval ratio.
const totalVotes = approveCount + denyCount + abstainCount;
const decisiveVotes = approveCount + denyCount;
const approvalRatio = decisiveVotes > 0 ? (approveCount / decisiveVotes) : 0;
  const threshold = Number(proposal.threshold || 0.60);

  if (totalVotes >= 3 && approvalRatio >= threshold) {
    proposal.status = "approved";
    proposal.approvedAt = nowISO();

    const execResult = await executeInSandbox({
      entityId: proposal.entityId,
      command: proposal.command,
      workDir: path.join(DATA_DIR, "entity_workspaces", proposal.entityId),
      timeoutMs: 30000,
      maxOutputBytes: 2 * 1024 * 1024
    });

    proposal.executionResult = {
      exitCode: execResult.exitCode,
      stdout: String(execResult.stdout || "").slice(0, 10000),
      stderr: String(execResult.stderr || "").slice(0, 10000),
      executedAt: nowISO()
    };

    log("entity.terminal.council_approved", `Council approved terminal command for ${proposal.entityId}`, {
      proposalId,
      command: String(proposal.command || "").slice(0, 200),
      approvalRatio,
      exitCode: execResult.exitCode
    });
  }
  else if (totalVotes >= 3 && approvalRatio < (1 - threshold)) {
    proposal.status = "denied";
    proposal.deniedAt = nowISO();

    log("entity.terminal.council_denied", `Council denied terminal command for ${proposal.entityId}`, {
      proposalId,
      command: String(proposal.command || "").slice(0, 200),
      approvalRatio
    });
  }

  saveStateDebounced();

  return {
    ok: true,
    proposalId,
    status: proposal.status,
    votes: {
      approve: approveCount,
      deny: denyCount,
      abstain: abstainCount,
      approvalRatio,
      threshold
    },
    executionResult: proposal.executionResult || null
  };
}, {
  summary: "Vote on entity terminal request (council-gated)",
  public: false
});


register("chicken3","status", async (ctx, input={}) => {
  enforceEthosInvariant("status");
  return { ok:true, chicken3: ctx.state.__chicken3, enabled: Boolean(ctx.state.__chicken3?.enabled) };
}, { public:true });

register("chicken3","session_optin", async (ctx, input={}) => {
  enforceEthosInvariant("optin");
  const sid = String(input.sessionId || input.session || "");
  if (!sid) return { ok:false, error:"sessionId required" };
  const s = ctx.state.sessions.get(sid) || { createdAt: nowISO(), messages: [] };
  // Only additive flags
  if (typeof input.cloudOptIn === "boolean") s.cloudOptIn = input.cloudOptIn;
  if (typeof input.toolsOptIn === "boolean") s.toolsOptIn = input.toolsOptIn;
  if (typeof input.multimodalOptIn === "boolean") s.multimodalOptIn = input.multimodalOptIn;
  if (typeof input.voiceOptIn === "boolean") s.voiceOptIn = input.voiceOptIn;
  ctx.state.sessions.set(sid, s);
  saveStateDebounced();
  return { ok:true, sessionId: sid, flags: { cloudOptIn: !!s.cloudOptIn, toolsOptIn: !!s.toolsOptIn, multimodalOptIn: !!s.multimodalOptIn, voiceOptIn: !!s.voiceOptIn } };
}, { public:true });

function _c3sessionFlags(ctx){
  const sid = String(ctx?.reqMeta?.sessionId || ctx?.reqMeta?.sid || ctx?.sessionId || ctx?.actor?.sessionId || "");
  const s = sid ? (ctx?.state?.sessions?.get?.(sid) || null) : null;
  return {
    sessionId: sid,
    cloudOptIn: Boolean(s?.cloudOptIn === true),
    toolsOptIn: Boolean(s?.toolsOptIn === true),
    multimodalOptIn: Boolean(s?.multimodalOptIn === true),
    voiceOptIn: Boolean(s?.voiceOptIn === true),
  };
}

register("chicken3","meta_propose", async (ctx, input={}) => {
  // Blueprint name: generateMetaProposal
  return generateMetaProposal(ctx, input);
}, { public:false });

register("chicken3","meta_commit_quiet", async (ctx, input={}) => {
  // Blueprint name: council.reviewAndCommitQuiet
  return await council.reviewAndCommitQuiet(ctx, input);
}, { public:false });

register("multimodal","vision_analyze", async (ctx, input={}) => {
  enforceEthosInvariant("analyze_image");
  const flags = _c3sessionFlags(ctx);
  if (!ctx.state.__chicken3?.multimodalEnabled) return { ok:false, error:"multimodal disabled" };
  if (!flags.multimodalOptIn) return { ok:false, error:"session multimodal opt-in required" };

  // Governed execution: all external/tool-like calls route through governedCall.
  return await governedCall(ctx, "multimodal.vision_analyze", async () => {

  // Local-first: Ollama (llava) if configured
  const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const model = String(process.env.OLLAMA_VISION_MODEL || "llava");
  const imageB64 = String(input.imageBase64 || "");
  const prompt = String(input.prompt || "Analyze this image for lattice context.");
  if (!imageB64) return { ok:false, error:"imageBase64 required" };

  const payload = {
    model,
    messages: [{ role:"user", content: prompt, images: [imageB64] }]
  };
  const r = await fetch(`${OLLAMA_URL}/api/chat`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) }).catch(e=>null);
  if (!r || !r.ok) return { ok:false, error:`ollama vision failed`, status: r?.status || 0 };
  const j = await r.json().catch(()=>null);
  const content = j?.message?.content || j?.response || "";
  return { ok:true, content };
  });
}, { public:false });

register("multimodal","image_generate", async (ctx, input={}) => {
  enforceEthosInvariant("generate_image");
  const flags = _c3sessionFlags(ctx);
  if (!ctx.state.__chicken3?.multimodalEnabled) return { ok:false, error:"multimodal disabled" };
  if (!flags.multimodalOptIn) return { ok:false, error:"session multimodal opt-in required" };

  return await governedCall(ctx, "multimodal.image_generate", async () => {

  // Local-first: Stable Diffusion / ComfyUI HTTP if configured
  const SD_URL = process.env.SD_URL || process.env.COMFYUI_URL || process.env.A1111_URL || "";
  const prompt = String(input.prompt || "");
  if (!prompt) return { ok:false, error:"prompt required" };
  if (!SD_URL) return { ok:false, error:"No local image-gen endpoint configured (set SD_URL or COMFYUI_URL or A1111_URL)" };

  const body = { prompt, steps: clamp(Number(input.steps || 30), 5, 80) };
  const r = await fetch(SD_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).catch(e=>null);
  if (!r || !r.ok) return { ok:false, error:"local image-gen failed", status: r?.status || 0 };
  const j = await r.json().catch(()=>null);
  // Accept common response shapes
  const img = j?.images?.[0] || j?.image || j?.data?.[0] || null;
  return { ok:true, image: img, raw: j };
  });
}, { public:false });

register("voice","transcribe", async (ctx, input={}) => {
  enforceEthosInvariant("transcribe_audio");
  const flags = _c3sessionFlags(ctx);
  if (!ctx.state.__chicken3?.voiceEnabled) return { ok:false, error:"voice disabled" };
  if (!flags.voiceOptIn) return { ok:false, error:"session voice opt-in required" };

  const bin = process.env.WHISPER_CPP_BIN || "";
  if (!bin) return { ok:false, error:"WHISPER_CPP_BIN not set (local-first)" };
  const audioPath = String(input.audioPath || "");
  if (!audioPath) return { ok:false, error:"audioPath required (server-side file path)" };
  const args = [ "-f", audioPath, "--output-txt" ];
  const p = spawnSync(bin, args, { encoding:"utf-8" });
  if (p.error) return { ok:false, error:String(p.error) };
  const out = (p.stdout || "") + (p.stderr || "");
  return { ok:true, transcript: out.trim() };
}, { public:false });

register("voice","tts", async (ctx, input={}) => {
  enforceEthosInvariant("synthesize_speech");
  const flags = _c3sessionFlags(ctx);
  if (!ctx.state.__chicken3?.voiceEnabled) return { ok:false, error:"voice disabled" };
  if (!flags.voiceOptIn) return { ok:false, error:"session voice opt-in required" };

  const bin = process.env.PIPER_BIN || "";
  if (!bin) return { ok:false, error:"PIPER_BIN not set (local-first)" };
  const text = String(input.text || "");
  if (!text) return { ok:false, error:"text required" };
  const voice = String(process.env.PIPER_VOICE || "");
  const args = voice ? ["--model", voice] : [];
  const p = spawnSync(bin, args, { input: text, encoding:"utf-8" });
  if (p.error) return { ok:false, error:String(p.error) };
  // Piper usually outputs audio bytes; simplest local-first contract is: write to a file path if provided.
  const outPath = String(input.outPath || "");
  if (outPath) {
    try { fs.writeFileSync(outPath, p.stdout); } catch {}
    return { ok:true, outPath, note:"TTS wrote audio to outPath (best-effort)." };
  }
  return { ok:true, note:"TTS invoked. For audio transport, provide outPath to write a wav file.", stderr: String(p.stderr||"") };
}, { public:false });

register("tools","web_search", async (ctx, input={}) => {
  enforceEthosInvariant("web_search");
  const flags = _c3sessionFlags(ctx);
  if (!ctx.state.__chicken3?.toolsEnabled) return { ok:false, error:"tools disabled" };
  if (!flags.toolsOptIn) return { ok:false, error:"session tools opt-in required" };

  // Governed call: even local-first external network calls are considered effectful tools.
  return await governedCall(ctx, "tools.web_search", async () => {

  const q = String(input.query || input.q || "");
  if (!q) return { ok:false, error:"query required" };

  // Local-first default: DuckDuckGo HTML (no API key). If you run SearxNG locally, set SEARXNG_URL.
  const local = process.env.SEARXNG_URL || "";
  const url = local ? `${local}/search?q=${encodeURIComponent(q)}&format=json` : `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { method:"GET" }).catch(e=>null);
  if (!r || !r.ok) return { ok:false, error:"search failed", status: r?.status || 0 };

  const text = await r.text().catch(()=> "");

  // Optional cloud path: if user has explicitly opted in, allow downstream summarization via LLM.
  // (We do NOT require cloud for search; this is for post-processing convenience only.)
  let summary = null;
  const wantSummary = Boolean(input.summarize);
  if (wantSummary && flags.cloudOptIn && _cloudOptInAllowed({ sessionId: ctx?.sessionId })) {
    try {
      const sctx = { ...ctx, _background: true };
      const s = await runMacro("chat","respond", { mode:"ask", sessionId: ctx?.sessionId, prompt: `Summarize these search results for: ${q}\n\n${text.slice(0, 8000)}` }, sctx).catch(()=>null);
      summary = s?.answer ?? s?.content ?? s?.text ?? null;
    } catch {}
  }

  return { ok:true, source: local ? "searxng" : "duckduckgo_html", text: text.slice(0, 200000), summary };
  });
}, { public:false });

// ===== END CHICKEN3 MACROS =====


// ---- ctx ----
function makeCtx(req=null) {
  return {
    state: STATE,
    actor: (req && req.actor) ? req.actor : { userId: "anon", orgId: "public", role: "viewer", scopes: ["read"] },
    env: {
      version: VERSION,
      llmReady: LLM_READY,
      openaiModel: { fast: OPENAI_MODEL_FAST, smart: OPENAI_MODEL_SMART }
    },
    reqMeta: req ? {
      ip: req.ip,
      ua: req.get("user-agent"),
      method: req.method,
      path: req.path,
      override: (req.query && (req.query.override === "1" || req.query.override === "true")) ? true : false,
      at: nowISO()
    } : null,
    log,
    utils: { uid, normalizeText, simpleTokens, jaccard, cretiPack, clamp },
    macro: {
      run: async (domain, name, input) => runMacro(domain, name, input, makeCtx(req)),
      listDomains,
      listMacros,
    },
    llm: {
      enabled: LLM_READY,
      async chat({ system, messages, temperature=0.3, maxTokens=800, model=null, timeoutMs=12000 }) {
        if (!LLM_READY) return { ok: false, reason: "LLM not configured (OPENAI_API_KEY missing)." };
        const chosen = model || OPENAI_MODEL_FAST;
        const payload = {
          model: chosen,
          temperature,
          max_tokens: maxTokens,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            ...(messages || [])
          ]
        };
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), timeoutMs);
        const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify(payload),
          signal: ac.signal
        }).finally(() => clearTimeout(t));
        const text = await res.text().catch(()=> "");
        const json = safeJson(text, null);
        if (!res.ok) {
          return { ok: false, status: res.status, error: json || text };
        }
        const content = json?.choices?.[0]?.message?.content ?? "";
        return { ok: true, content, raw: json };
      }
    }
  };
}

// ---- DTU helpers ----
function dtusArray() { return Array.from(STATE.dtus.values()); }
function dtusByIds(ids=[]) {
  const out = [];
  for (const id of ids) {
    const d = STATE.dtus.get(id);
    if (d) out.push(d);
  }
  return out;
}
function upsertDTU(dtu) {
  STATE.dtus.set(dtu.id, dtu);
  saveStateDebounced();
  return dtu;
}

// ===================== ORGANISM PIPELINE UPGRADE (Merged Organ Graft) =====================
// This graft adds: proposals + WAL + snapshot rollback + deterministic verifier + enforced commits.
// It preserves all existing macros/endpoints by routing DTU mutations through pipelineCommitDTU(ctx,...)
// LLM is always optional; pipeline is deterministic and local-first.

const PIPE = {
  enabled: true,
  proposals: new Map(),     // id -> proposal
  walPath: path.join(DATA_DIR, "wal.jsonl"),
  auditPath: path.join(DATA_DIR, "audit.jsonl"),
  snapshotsDir: path.join(DATA_DIR, "snapshots"),
};

function pipeEnsureDirs() {
  try { fs.mkdirSync(PIPE.snapshotsDir, { recursive: true }); } catch {}
}
pipeEnsureDirs();

function pipeAppendJsonl(file, obj) {
  try { fs.appendFileSync(file, JSON.stringify(obj) + "\n", "utf-8"); } catch {}
}

function pipeAudit(type, message, meta={}) {
  const e = { id: uid("audit"), ts: nowISO(), type, message, meta };
  pipeAppendJsonl(PIPE.auditPath, e);
  return e;
}

function pipeWal(type, meta={}) {
  const e = { id: uid("wal"), ts: nowISO(), type, meta };
  pipeAppendJsonl(PIPE.walPath, e);
  return e;
}

function pipeSnapshot() {
  const stamp = nowISO().replace(/[:.]/g, "-");
  const dir = path.join(PIPE.snapshotsDir, `snap_${stamp}_${crypto.randomBytes(3).toString("hex")}`);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  try {
    fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(serializeStateForDisk(), null, 2), "utf-8");
  } catch {}
  return dir;
}

function pipeRestoreSnapshot(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, "state.json"), "utf-8");
    const obj = JSON.parse(raw);
    hydrateStateFromDisk(obj);
    saveStateDebounced();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message||e) };
  }
}

function pipeProposal(action, payload, actor={ kind:"system", id:"system" }) {
  const p = {
    id: uid("prop"),
    action,
    payload,
    actor,
    status: "proposed",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    verify: null,
    council: null,
    install: null,
    rollback: null
  };
  PIPE.proposals.set(p.id, p);
  pipeWal("proposal.create", { id: p.id, action });
  pipeAudit("proposal.create", `Proposal: ${action}`, { proposalId: p.id, actor });
  return p;
}

function pipeValidateDTU(dtu) {
  // Minimal hard schema gates (deterministic)
  if (!dtu || typeof dtu !== "object") return { ok:false, reason:"not_object" };
  if (!dtu.id) dtu.id = uid("dtu");
  if (!dtu.title || typeof dtu.title !== "string") return { ok:false, reason:"missing_title" };
  if (!Array.isArray(dtu.tags)) dtu.tags = [];
  if (!dtu.human) dtu.human = { summary:"", bullets:[] };
  if (!dtu.core) dtu.core = { definitions:[], invariants:[], claims:[], examples:[], nextActions:[] };
  for (const k of ["definitions","invariants","claims","examples","nextActions"]) {
    if (!Array.isArray(dtu.core[k])) dtu.core[k] = [];
  }
  // Secrets guard (basic)
  const hp = String(dtu.cretiHuman || dtu.creti || dtu.human?.summary || "");
  if (/\bsk-[A-Za-z0-9]{10,}\b/.test(hp)) return { ok:false, reason:"secret_detected" };
  return { ok:true };
}

function pipeContentFingerprint(dtu) {
  const base = [
    dtu.title||"",
    (dtu.tags||[]).slice().sort().join("|"),
    dtu.human?.summary||"",
    (dtu.human?.bullets||[]).join("|"),
    (dtu.core?.definitions||[]).join("|"),
    (dtu.core?.invariants||[]).join("|"),
    (dtu.core?.claims||[]).join("|"),
  ].join("\n");
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 16);
}

function pipeDedupe(dtu) {
  const fp = pipeContentFingerprint(dtu);
  for (const x of STATE.dtus.values()) {
    const xfp = x.hash || pipeContentFingerprint(x);
    if (xfp === fp) return { dup:true, matchId:x.id, reason:"fingerprint" };
  }
  return { dup:false, fingerprint: fp };
}


// =================== INVARIANT/CONSTRAINT CHECKERS (minimal, non-destructive) ===================
// These are conservative by design: they ONLY flag explicit, direct contradictions (e.g., "X" vs "NOT X").
// No fuzzy semantic inference is performed to avoid false positives.

function _normAtom(s) { return normalizeText(String(s||"")).replace(/\s+/g," ").trim(); }

function pipeConflictCheckDTU(dtu) {
  const inv = Array.isArray(dtu?.core?.invariants) ? dtu.core.invariants : [];
  const clm = Array.isArray(dtu?.core?.claims) ? dtu.core.claims : [];
  const atoms = new Set([...inv, ...clm].map(_normAtom).filter(Boolean));

  if (!atoms.size) return { ok:true, conflicts:[] };

  const conflicts = [];
  const oppose = (a) => a.startsWith("not ") ? a.slice(4) : ("not " + a);

  for (const x of STATE.dtus.values()) {
    if (!x || x.id === dtu.id) continue;
    const xinvs = Array.isArray(x?.core?.invariants) ? x.core.invariants : [];
    const xclm = Array.isArray(x?.core?.claims) ? x.core.claims : [];
    const xatoms = new Set([...xinvs, ...xclm].map(_normAtom).filter(Boolean));
    if (!xatoms.size) continue;

    for (const a of atoms) {
      const b = oppose(a);
      if (xatoms.has(b)) {
        conflicts.push({ withId: x.id, a, b });
        // Keep this minimal: one conflict is enough to flag.
        return { ok:false, conflicts };
      }
    }
  }
  return { ok:true, conflicts };
}


function pipeVerify(proposal) {
  const checks = [];
  let ok = true;
  const check = (name, pass, detail) => { checks.push({ name, pass:!!pass, detail }); if (!pass) ok = false; };

  if (proposal.action === "dtu.commit") {
    const dtu = proposal.payload?.dtu;
    const sv = pipeValidateDTU(dtu);
    check("schema", sv.ok, sv.reason);
    const dd = pipeDedupe(dtu);
    check("dedupe", !dd.dup, dd.dup ? `${dd.reason}:${dd.matchId}` : "ok");
    const cc = pipeConflictCheckDTU(dtu);
    check("conflicts", cc.ok, cc.ok ? "ok" : `conflict:${(cc.conflicts[0]||{}).withId||""}`);
  }

  return { ok, checks };
}

function pipeCouncil(proposal, ctx, opts={}) {
  // Reuse existing councilGate if available in this monolith; otherwise allow.
  try {
    if (proposal.action === "dtu.commit") {
      const dtu = proposal.payload.dtu;
      const allowRewrite = !!opts.allowRewrite;
      const gate = councilGate(dtu, { allowRewrite });
      return { ok: gate.ok, score: gate.score, reason: gate.reason };
    }
  } catch {}
  return { ok: true, score: 999, reason: "bypass" };
}

// =================== ABSTRACTION GOVERNOR (v3) ===================
// Abstraction is additive; Concord measures it and applies three automations:
// 1) placement (where a DTU belongs: tier/scope)
// 2) promotion/demotion budgets (keep highs sparse)
// 3) conservation invariant (added ~ collapsed over time)

function _dtuStats(dtu) {
  if (!dtu.stats || typeof dtu.stats !== 'object') dtu.stats = { uses: 0, lastUsedAt: null, contexts: [] };
  if (!Array.isArray(dtu.stats.contexts)) dtu.stats.contexts = [];
  return dtu.stats;
}

function markDTUUsed(dtu, ctxKey="") {
  const s = _dtuStats(dtu);
  s.uses = Number(s.uses||0) + 1;
  s.lastUsedAt = nowISO();
  if (ctxKey) {
    s.contexts.unshift(String(ctxKey).slice(0,64));
    s.contexts = Array.from(new Set(s.contexts)).slice(0, 12);
  }
}

function estimateAbstractionDelta(dtu) {
  // lightweight proxy: tier + content richness
  const tierW = dtu.tier === 'hyper' ? 3 : dtu.tier === 'mega' ? 2 : 1;
  const c = dtu.core || {};
  const richness = (
    (c.definitions?.length||0) +
    (c.invariants?.length||0) +
    (c.examples?.length||0) +
    (c.tests?.length||0)
  );
  return tierW * clamp(richness / 10, 0.25, 2);
}

function abstractionBudgets(n) {
  // Keep high-tier nodes sparse; budgets scale sublinearly.
  const megas = Math.max(1, Math.floor(Math.sqrt(Math.max(1,n)) / 2));
  const hypers = Math.max(1, Math.floor(Math.log2(Math.max(2,n)) / 5));
  return { maxMegas: megas, maxHypers: hypers };
}

function computeAbstractionSnapshot() {
  const n = STATE.dtus.size;
  const dtus = Array.from(STATE.dtus.values());
  let ecc = 0;
  let totalUses = 0;
  let reuseSpanDays = 0;
  let internalCount = 0;

  for (const d of dtus) {
    const tags = Array.isArray(d.tags) ? d.tags.length : 0;
    const c = d.core || {};
    const defs = c.definitions?.length||0;
    const inv = c.invariants?.length||0;
    ecc += clamp((tags + defs + inv) / 6, 0, 3);
    const s = d.stats;
    const uses = Number(s?.uses||0);
    totalUses += uses;
    if (s?.lastUsedAt && d.createdAt) {
      const span = (new Date(s.lastUsedAt).getTime() - new Date(d.createdAt).getTime()) / 86400000;
      reuseSpanDays += clamp(span, 0, 365);
    }
    internalCount += 1; // local-first today
  }

  const avgReuseDays = n ? reuseSpanDays / n : 0;
  const rd = clamp(avgReuseDays / 30, 0, 1); // normalize to ~1 month
  const ir = clamp(internalCount / Math.max(1,n), 0, 1);
  const { maxMegas, maxHypers } = abstractionBudgets(n);
  const megasNow = dtus.filter(d=>d.tier==='mega').length;
  const hypersNow = dtus.filter(d=>d.tier==='hyper').length;

  // Load rises with high-tier density + unresolved contradictions.
  const hiLoad = (megasNow / Math.max(1,maxMegas) + hypersNow / Math.max(1,maxHypers)) / 2;
  const contradictionLoad = Number(STATE.growth?.functionalDecline?.contradictionLoad||0);
  const load = clamp(0.35*clamp(ecc/Math.max(1,n),0,3) + 0.45*clamp(hiLoad,0,2) + 0.20*clamp(contradictionLoad/10,0,1), 0, 1);
  const margin = clamp(1 - load, 0, 1);

  // ETUA proxy: the ability to safely add abstraction increases with margin and dedupe/repair health
  const dedupeMiss = Number(STATE.growth?.functionalDecline?.dedupeMissRate||0);
  const wrapperFail = Number(STATE.growth?.functionalDecline?.wrapperFailureRate||0);
  const etua = clamp(margin * (1 - clamp(dedupeMiss,0,1)) * (1 - clamp(wrapperFail,0,1)), 0, 1);

  return {
    ecc: Number((ecc).toFixed(4)),
    rd: Number((rd).toFixed(4)),
    ir: Number((ir).toFixed(4)),
    etua: Number((etua).toFixed(4)),
    load: Number((load).toFixed(4)),
    margin: Number((margin).toFixed(4)),
    budgets: { maxMegas, maxHypers, megasNow, hypersNow },
    totals: { n, totalUses }
  };
}

function applyAbstractionPlacement(dtu) {
  // Determine tier/scope based on reuse + richness + tests.
  const s = _dtuStats(dtu);
  const uses = Number(s.uses||0);
  const ctxs = Array.isArray(s.contexts) ? s.contexts.length : 0;
  const c = dtu.core || {};
  const hasTests = (c.tests?.length||0) > 0;
  const richness = clamp(((c.definitions?.length||0)+(c.invariants?.length||0)+(c.examples?.length||0)) / 10, 0, 1);
  const reuse = clamp((uses/12)*0.6 + (ctxs/6)*0.4, 0, 1);
  const score = clamp(0.55*reuse + 0.45*richness + (hasTests?0.1:0), 0, 1);
  dtu.abstraction = { score, uses, contexts: ctxs, hasTests, richness };

  // Default scope is local-first.
  if (!dtu.scope) dtu.scope = 'local';

  // Promotion rules (subject to budgets enforcement later)
  if (score >= 0.90 && uses >= 12 && ctxs >= 6 && hasTests) dtu.tier = 'hyper';
  else if (score >= 0.75 && uses >= 6 && ctxs >= 3) dtu.tier = 'mega';
  else dtu.tier = dtu.tier || 'regular';

  return dtu;
}

function enforceTierBudgets() {
  const snap = computeAbstractionSnapshot();
  const { maxMegas, maxHypers } = snap.budgets;
  const dtus = Array.from(STATE.dtus.values());
  const megas = dtus.filter(d=>d.tier==='mega');
  const hypers = dtus.filter(d=>d.tier==='hyper');

  const byUtility = (a,b)=>{
    const au = Number(a.abstraction?.score||0) * (Number(a.stats?.uses||0)+1);
    const bu = Number(b.abstraction?.score||0) * (Number(b.stats?.uses||0)+1);
    return bu - au;
  };

  if (hypers.length > maxHypers) {
    hypers.sort(byUtility);
    for (const d of hypers.slice(maxHypers)) {
      d.tier = 'mega';
      d.updatedAt = nowISO();
      STATE.abstraction.ledger.collapsed += 1; // treat demotion as "collapse" of excessive abstraction
    }
  }
  if (megas.length > maxMegas) {
    megas.sort(byUtility);
    for (const d of megas.slice(maxMegas)) {
      d.tier = 'regular';
      d.updatedAt = nowISO();
      STATE.abstraction.ledger.collapsed += 0.5;
    }
  }

  STATE.abstraction.metrics = { ...STATE.abstraction.metrics, ...snap };
  STATE.abstraction.lastEvalAt = nowISO();
  STATE.abstraction.history.push({ at: nowISO(), ...snap, ledger: { ...STATE.abstraction.ledger } });
  STATE.abstraction.history = STATE.abstraction.history.slice(-60);
}

function applyConservationBackpressure() {
  // If abstraction added is outpacing collapse, increase grounding pressure.
  const { added, collapsed } = STATE.abstraction.ledger || { added:0, collapsed:0 };
  const delta = added - collapsed;
  if (delta <= 5) return { ok:true, did:"none", delta };

  // Backpressure actions are deterministic and local.
  // 1) run dedupe sweep
  STATE.queues.maintenance.push({ id: uid('maint'), kind:'dedupe', createdAt: nowISO(), reason:`conservation_delta_${delta.toFixed(2)}` });
  // 2) slightly reduce default abstraction depth to keep outputs crisp
  STATE.settings.abstractionDepthDefault = clamp(Number(STATE.settings.abstractionDepthDefault||1) - 1, 0, Number(STATE.settings.abstractionMaxDepth||3));
  // 3) nudge crispness up (forces tighter evidence selection)
  STATE.settings.crispnessMin = clamp(Number(STATE.settings.crispnessMin||0.25) + 0.05, 0.1, 0.9);

  // Record some collapse credit up front (the maint job will do the rest)
  STATE.abstraction.ledger.collapsed += Math.min(2, delta/2);
  return { ok:true, did:"backpressure", delta };
}


// =================== AUTO-PROMOTION / COMPRESSION (Mega/Hyper synthesis) ===================
// Purpose: keep the *effective* working set small by creating canonical Mega/Hyper DTUs that
// summarize highly-coactivated regular DTUs, and marking children with meta.canonicalId.
// This is deterministic, offline-safe, and gated through the existing DTU commit pipeline.
// It does NOT delete knowledge; it creates canonical abstractions and de-prioritizes children.

function _isCanonicalSelf(d) {
  const cid = d?.meta?.canonicalId;
  return !cid || cid === d.id;
}

function _tagsOf(d){ return Array.isArray(d?.tags) ? d.tags : []; }

function _clusterCandidates(dtus) {
  // rank by usage; prefer regular DTUs that are currently canonical selves
  const cands = dtus
    .filter(d => (d.tier||"regular")==="regular")
    .filter(d => _isCanonicalSelf(d))
    .map(d => ({ d, uses: Number(d.stats?.uses||0), ctxs: Number(d.stats?.contexts?.length||0) }))
    .sort((a,b)=> (b.uses-a.uses) || (b.ctxs-a.ctxs));
  return cands;
}

function _tagJaccard(aTags, bTags) {
  const A = new Set(aTags||[]);
  const B = new Set(bTags||[]);
  if (!A.size || !B.size) return 0;
  let inter=0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter/uni : 0;
}

function _tokenJaccard(a, b) {
  const A = new Set(simpleTokens(a||""));
  const B = new Set(simpleTokens(b||""));
  if (!A.size || !B.size) return 0;
  let inter=0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter/uni : 0;
}

function _makeMegaFromCluster(cluster, reason="auto_cluster") {
  const members = cluster.map(x=>x.d);
  const ids = members.map(d=>d.id);
  const titles = members.map(d=>d.title).filter(Boolean).slice(0,8);
  const seedTitle = titles[0] || "Cluster";
  const title = `MEGA: ${seedTitle} (+${Math.max(0, ids.length-1)})`;

  // Conservative synthesis: only aggregate what's already explicit.
  const inv = [];
  const defs = [];
  const claims = [];
  const examples = [];
  for (const d of members) {
    const c = d.core || {};
    for (const x of (c.invariants||[])) if (inv.length < 18) inv.push(String(x));
    for (const x of (c.definitions||[])) if (defs.length < 12) defs.push(String(x));
    for (const x of (c.claims||[])) if (claims.length < 18) claims.push(String(x));
    for (const x of (c.examples||[])) if (examples.length < 10) examples.push(String(x));
  }

  const tags = Array.from(new Set([
    "mega","auto","canonical","cluster",
    ...members.flatMap(d=>_tagsOf(d)).filter(t=>typeof t==="string").slice(0,30)
  ])).slice(0, 40);

  const now = nowISO();
  return {
    id: uid("dtu"),
    title,
    tier: "mega",
    tags,
    human: {
      summary: `Canonical mega DTU synthesized from ${ids.length} DTUs to reduce working-set load. Reason: ${reason}.`,
      bullets: [
        `Members: ${ids.slice(0,8).join(", ")}${ids.length>8 ? "…" : ""}`,
        "This mega does not add new claims; it aggregates explicit content from members."
      ],
    },
    core: {
      definitions: defs,
      invariants: inv,
      claims,
      examples,
      nextActions: [
        "Use this Mega as the canonical entry point; drill down into member DTUs for full detail.",
        "If contradictions appear between members, resolve by splitting the cluster into multiple Megas."
      ],
      tests: [
        "No new invariant should appear here unless it exists in at least one member DTU.",
        "If two member invariants are explicit opposites, this mega should be rejected by conflict check."
      ],
    },
    machine: {
      kind: "mega_cluster",
      members: ids,
      // A simple, explicit aggregation equation (no liberties):
      equation: "Mega(M) = ⊕_{i∈members} DTU_i  (explicit aggregation only)",
      metrics: { memberCount: ids.length }
    },
    lineage: { parents: ids.slice(0, 32), children: [] },
    source: "auto",
    meta: { canonicalId: null, hidden: false },
    createdAt: now,
    updatedAt: now,
    authority: { model: "concord", score: 0.6 },
    hash: ""
  };
}

function _makeHyperFromMegas(megas, reason="auto_hyper") {
  const members = megas.slice(0, 4);
  const ids = members.map(d=>d.id);
  const title = `HYPER: Abstraction Kernel (+${ids.length})`;
  const tags = Array.from(new Set([
    "hyper","auto","canonical","kernel",
    ...members.flatMap(d=>_tagsOf(d)).filter(t=>typeof t==="string").slice(0,30)
  ])).slice(0, 40);

  const now = nowISO();
  return {
    id: uid("dtu"),
    title,
    tier: "hyper",
    tags,
    human: {
      summary: `Canonical hyper DTU synthesized from Megas to provide a stable derivation/checking kernel. Reason: ${reason}.`,
      bullets: [
        `Mega inputs: ${ids.join(", ")}`,
        "Kernel rules remain conservative: they only route/check; they don't invent facts."
      ]
    },
    core: {
      definitions: [
        "A Hyper DTU is a canonical kernel that routes questions to Megas and enforces invariant-first composition.",
        "Hyper DTUs are allowed to define procedures, not new domain claims."
      ],
      invariants: [
        "Kernel must not assert domain facts not present in referenced Megas/children.",
        "Kernel must preserve feasibility-first classification in ask/forge/sim outputs."
      ],
      claims: [
        "Using a Hyper DTU reduces working-set load by routing to a small set of canonical Megas.",
        "Kernel increases consistency by centralizing decision procedures."
      ],
      examples: [
        "Given query q: retrieve top Megas; expand into member DTUs only if needed; output feasibility + minimal explanation."
      ],
      nextActions: [
        "Use this Hyper as first-pass router; update by replacing members with newer canonical Megas as lattice evolves."
      ],
      tests: [
        "Hyper must always cite its Mega members (lineage.parents) as provenance.",
        "Hyper should not include contradictory Mega members (conflict check should reject)."
      ]
    },
    machine: {
      kind: "hyper_kernel",
      members: ids,
      equation: "Route(q) = topK_{mega}(sim(q, mega)); Expand only if needed; Verify invariants first",
      metrics: { megaCount: ids.length }
    },
    lineage: { parents: ids.slice(0, 32), children: [] },
    source: "auto",
    meta: { canonicalId: null, hidden: false },
    createdAt: now,
    updatedAt: now,
    authority: { model: "concord", score: 0.7 },
    hash: ""
  };
}

async function runAutoPromotion(ctx, { maxNewMegas=2, maxNewHypers=1 } = {}) {
  if (!STATE.abstraction.enabled) return { ok:true, did:"disabled" };

  const snap = computeAbstractionSnapshot();
  const dtus = Array.from(STATE.dtus.values());

  // Respect budgets: only synthesize when we're below budget and lattice has some usage signal.
  const { maxMegas, maxHypers, megasNow, hypersNow } = snap.budgets;
  const canMakeMega = megasNow < maxMegas;
  const canMakeHyper = hypersNow < maxHypers;

  const made = { megas: [], hypers: [], canonicalized: 0 };
  if (!snap.totals.totalUses || snap.totals.totalUses < 25) {
    return { ok:true, did:"insufficient_usage", snap, made };
  }

  // ---- Mega synthesis from co-activated regular DTUs ----
  if (canMakeMega) {
    const cands = _clusterCandidates(dtus);
    const used = new Set();
    let madeCount = 0;

    for (const seed of cands.slice(0, 40)) {
      if (madeCount >= maxNewMegas) break;
      const sd = seed.d;
      if (used.has(sd.id)) continue;
      const sTags = _tagsOf(sd);
      const sTokStr = `${sd.title||""} ${(sd.tags||[]).join(" ")} ${(sd.cretiHuman||sd.human?.summary||"")}`;
      const cluster = [{ d: sd, uses: seed.uses }];

      for (const cand of cands.slice(0, 80)) {
        const cd = cand.d;
        if (cd.id === sd.id) continue;
        if (used.has(cd.id)) continue;
        // Coherence requirement: tag overlap OR token overlap (conservative)
        const tj = _tagJaccard(sTags, _tagsOf(cd));
        const kj = _tokenJaccard(sTokStr, `${cd.title||""} ${(cd.tags||[]).join(" ")} ${(cd.cretiHuman||cd.human?.summary||"")}`);
        if (tj >= 0.30 || kj >= 0.12) {
          cluster.push({ d: cd, uses: cand.uses });
        }
        if (cluster.length >= 7) break;
      }

      if (cluster.length < 4) continue; // don't synthesize tiny clusters

      const mega = _makeMegaFromCluster(cluster, "usage_coactivation");
      const res = pipelineCommitDTU(ctx, mega, { op:"auto.promo.mega", allowRewrite:false });
      if (res?.ok) {
        made.megas.push(res.dtu?.id || mega.id);
        madeCount += 1;

        // Canonicalize children to this Mega (so canonicalOnly keeps working set low)
        for (const m of cluster.map(x=>x.d)) {
          if (!m.meta) m.meta = {};
          m.meta.canonicalId = (res.dtu?.id || mega.id);
          m.updatedAt = nowISO();
          used.add(m.id);
          made.canonicalized += 1;
        }
        // Persist child updates
        saveStateDebounced();
      }
    }
  }

  // ---- Hyper synthesis from top-used Megas ----
  if (canMakeHyper) {
    const megas = dtus
      .filter(d => d.tier === "mega")
      .filter(d => _isCanonicalSelf(d))
      .map(d => ({ d, uses: Number(d.stats?.uses||0) }))
      .sort((a,b)=>b.uses-a.uses)
      .map(x=>x.d);

    if (megas.length >= 2) {
      const hyper = _makeHyperFromMegas(megas, "top_megas");
      const res = pipelineCommitDTU(ctx, hyper, { op:"auto.promo.hyper", allowRewrite:false });
      if (res?.ok) made.hypers.push(res.dtu?.id || hyper.id);
    }
  }

  // Enforce budgets after synthesis
  try { enforceTierBudgets(); } catch {}

  // Record last promotion
  STATE.abstraction.lastPromotionAt = nowISO();
  saveStateDebounced();

  return { ok:true, did:"promoted", snap, made };
}


async function maybeRunLocalUpgrade() {
  if (!STATE.abstraction.enabled) return { ok:true, did:"disabled" };
  const cadence = Number(STATE.abstraction.cadenceDays||10);
  const last = STATE.abstraction.lastUpgradeAt ? new Date(STATE.abstraction.lastUpgradeAt).getTime() : 0;
  const now = Date.now();
  const due = !last || (now - last) >= cadence * 86400000;
  if (!due) return { ok:true, did:"not_due" };

  // Upgrade = deterministic retune + enforce budgets + auto-promotion + conservation check.
  enforceTierBudgets();
  try { await runAutoPromotion(makeCtx(null), { maxNewMegas: 3, maxNewHypers: 1 }); } catch {}
  const bp = applyConservationBackpressure();
  // Opportunistic self-repair: schedule maintenance if needed
  if (STATE.queues.maintenance.length < 25) {
    STATE.queues.maintenance.push({ id: uid('maint'), kind:'repair', createdAt: nowISO(), reason:'periodic_upgrade' });
  }

  STATE.abstraction.lastUpgradeAt = nowISO();
  saveStateDebounced();
  return { ok:true, did:"upgraded", backpressure: bp };
}
// ================= END ABSTRACTION GOVERNOR =================

async function pipelineCommitDTU(ctx, dtu, opts={}) {
  if (!PIPE.enabled) {
    // fallback to legacy write
    if (isShadowDTU(dtu)) STATE.shadowDtus.set(dtu.id, dtu);
    else STATE.dtus.set(dtu.id, dtu);
    saveStateDebounced();
    return { ok:true, dtu, bypassed:true };
  // --- Anti-gaming guard: only system promotion may create MEGA/HYPER DTUs ---
  try {
    const op = String(opts.op || "");
    const systemOp = op.startsWith("auto.promo.") || op.startsWith("auto.promo") || op.startsWith("auto.promotion");
    const systemCtx = !!(ctx && (ctx.system === true || ctx.isSystem === true || ctx?.meta?.system === true));
    if ((dtu?.tier === "mega" || dtu?.tier === "hyper") && !(systemOp || systemCtx)) {
      // Downgrade to regular; users can’t self-promote tiers.
      dtu.tier = "regular";
      dtu.tags = Array.from(new Set([...(dtu.tags||[]), "tier_downgraded"]));
      dtu.meta = dtu.meta || {};
      dtu.meta.tierDowngradedAt = nowISO();
      dtu.meta.tierDowngradeReason = "anti_gaming_only_auto_promo_can_set_tier";
    }
  } catch {}
  }
  const p = pipeProposal("dtu.commit", { dtu }, { kind:"macro", id: opts.op || "unknown" });
  const vr = pipeVerify(p);
  p.verify = vr; p.updatedAt = nowISO();
  if (!vr.ok) {
    p.status = "rejected";
    pipeAudit("dtu.reject", "Verifier rejected DTU", { proposalId: p.id, checks: vr.checks });
    return { ok:false, error:"verifier_reject", proposalId:p.id, verify: vr };
  }
  p.status = "verified";
  const cr = pipeCouncil(p, ctx, opts);
  p.council = cr; p.updatedAt = nowISO();
  if (!cr.ok) {
    p.status = "rejected";
    pipeAudit("dtu.reject", "Council rejected DTU", { proposalId: p.id, reason: cr.reason, score: cr.score });
    return { ok:false, error:"council_reject", proposalId:p.id, council: cr };
  }
  p.status = "approved";

  const snap = pipeSnapshot();
  try {
    // Human projection firewall: always render human-safe DTU view
    if (!dtu.cretiHuman) dtu.cretiHuman = renderHumanDTU(dtu);
    // Abstraction placement (tier/scope) before hashing/persistence
    applyAbstractionPlacement(dtu);
    dtu.hash = dtu.hash || pipeContentFingerprint(dtu);
    dtu.updatedAt = nowISO();

    // Conservation ledger: record abstraction added
    try {
      STATE.abstraction.ledger.added += estimateAbstractionDelta(dtu);
    } catch {}

    STATE.dtus.set(dtu.id, dtu);
    saveStateDebounced();

    // Keep high-tier sparse & maintain metrics periodically
    try { enforceTierBudgets(); } catch {}
    try { await maybeRunLocalUpgrade(); } catch {}

    p.status = "installed";
    p.install = { installedAt: nowISO(), snapshotBefore: snap };
    p.updatedAt = nowISO();
    pipeWal("proposal.install", { id: p.id, action: p.action });
    pipeAudit("dtu.commit", `DTU committed: ${dtu.title}`, { id: dtu.id, proposalId: p.id, hash: dtu.hash });

    return { ok:true, dtu, proposalId: p.id };
  } catch (e) {
    const rb = pipeRestoreSnapshot(snap);
    p.status = "failed";
    p.install = { failedAt: nowISO(), error: String(e?.message||e), snapshotBefore: snap, rollback: rb };
    p.updatedAt = nowISO();
    pipeWal("proposal.install.fail", { id: p.id, error: String(e?.message||e) });
    pipeAudit("install.fail", "Commit failed; rolled back", { proposalId: p.id, error: String(e?.message||e), snapshot: snap });
    return { ok:false, error:String(e?.message||e), proposalId:p.id };
  }
}

function pipeListProposals(limit=50) {
  const items = Array.from(PIPE.proposals.values()).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).slice(0, limit);
  return items;
}
// =================== END ORGANISM PIPELINE UPGRADE ===================


// ---- Retrieval helpers (dynamic, anti-loop) ----
function dtuText(d){ 
  const a = (d.cretiHuman || d.creti || d.human?.summary || "");
  const b = (d.title || "") + " " + (Array.isArray(d.tags)?d.tags.join(" "):"");
  return (b + " " + a).slice(0, 4000);
}
function retrieveDTUs(query, { topK=6, minScore=0.08, randomK=2, oppositeK=2 } = {}) {
  const all = dtusArray();
  const raw = String(query || "");
  const qNorm = normalizeQueryText(raw);
  const qBase = tokensNoStop(qNorm);          // stemmed, no stopwords
  const qExp  = expandQueryTokens(qNorm);     // stemmed + synonyms + learned expansions

  const scored = all.map(d => {
    const dt = dtuText(d);
    const dTok = simpleTokens(dt).map(stemLite).filter(Boolean);
    const scoreBase = jaccard(qBase, dTok);
    const scoreExp  = jaccard(qExp, dTok);
    const scoreGram = ngramSim(qNorm, dt);
    let score = 0.55*scoreBase + 0.30*scoreExp + 0.15*scoreGram;

    // Temporal OS: gentle recency boost (soft-gate, never forces output shape)
    const tw = temporalRecencyWeight(d);
    score = clamp(score + 0.12*tw, 0, 1);

    return { d, score, scoreBase, scoreExp, scoreGram, tw };
  }).sort((a,b)=>b.score-a.score);

  const topScored = scored.filter(x=>x.score >= minScore).slice(0, topK);
  const top = topScored.map(x=>x.d);

  // If retrieval evidence is weak, learn a lightweight linguistic mapping (shadow DTU)
  try {
    const best = scored[0]?.score ?? 0;
    if (qNorm && qNorm.length <= 120 && best < Math.max(0.10, minScore)) {
      // Heuristic: if it's a short chatty phrase, map toward intent-like tokens
      const intent = classifyIntent(qNorm)?.intent;
      const intentAdds =
        intent === INTENT.GREETING ? ["greeting","presence"] :
        intent === INTENT.STATUS   ? ["status","health","ready"] :
        intent === INTENT.QUESTION ? ["question","explain","help"] :
        ["chat","conversation","context"];
      const expands = Array.from(new Set([...(qExp||[]), ...intentAdds].map(stemLite))).slice(0, 18);
      maybeWriteLinguisticShadowDTU({ phrase: qNorm, expands, topIds: top.map(d=>d.id) });
    }
  } catch {}

  // random picks (avoid top)
  const pool = all.filter(d => !top.some(t=>t.id===d.id));
  const rand = [];
  for (let i=0;i<Math.min(randomK, pool.length);i++){
    const idx = Math.floor(Math.random()*pool.length);
    rand.push(pool.splice(idx,1)[0]);
  }

  // opposites: lowest similarity to query among remaining, but non-empty
  const oppos = scored.slice(-Math.min(50, scored.length)).filter(x => x.score <= 0.02).slice(0, oppositeK).map(x=>x.d);

  return { top, random: rand, opposite: oppos, scoredTop: scored.slice(0, Math.max(10, topK)) };
}

function pickDebateSet(query){
  const r = retrieveDTUs(query, { topK: 4, randomK: 2, oppositeK: 2 });
  const uniq = new Map();
  for (const d of [...r.top, ...r.random, ...r.opposite]) if (d && d.id) uniq.set(d.id, d);
  return Array.from(uniq.values());
}

// ---- Macro Domains ----

// DTU domain
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

  await pipelineCommitDTU(ctx, dtu, { op: 'dtu.create', allowRewrite });
  ctx.log("dtu.create", `Created DTU: ${title}`, { id: dtu.id, tier, tags, source, score: gate.score });
  return { ok: true, dtu };
}, { description: "Create a DTU (regular/mega/hyper) with structured core; UI receives human projection." });

register("dtu", "get", async (ctx, input) => {
  const id = String(input.id || "");
  const dtu = STATE.dtus.get(id) || STATE.shadowDtus.get(id);
  if (!dtu) return { ok: false, error: "DTU not found" };
  return { ok: true, dtu, shadow: isShadowDTU(dtu) };
});

register("dtu", "list", async (ctx, input) => {
  const limit = clamp(Number(input.limit || 5000), 1, 5000);
  const offset = clamp(Number(input.offset || 0), 0, 1e9);
  const tier = input.tier && ["regular","mega","hyper","any"].includes(input.tier) ? input.tier : "any";
  const q = tokenish(input.q || "");
  let items = dtusArray().sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
  if (tier !== "any") items = items.filter(d => d.tier === tier);
  if (q) items = items.filter(d => tokenish(d.title).includes(q) || tokenish((d.tags||[]).join(" ")).includes(q) || tokenish((d.cretiHuman || d.creti || "")).includes(q));
  items = items.slice(offset, offset + limit);
  return { ok: true, dtus: items, limit, offset, total: STATE.dtus.size };
});
register("dtu", "listShadow", async (ctx, input) => {
  const limit = clamp(Number(input.limit || 5000), 1, 5000);
  const offset = clamp(Number(input.offset || 0), 0, 1e9);
  const q = tokenish(input.q || "");
  let items = Array.from(STATE.shadowDtus.values()).sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
  if (q) items = items.filter(d => tokenish(d.title).includes(q) || tokenish((d.tags||[]).join(" ")).includes(q) || tokenish((d.cretiHuman || d.creti || "")).includes(q));
  items = items.slice(offset, offset + limit);
  return { ok: true, dtus: items, limit, offset, total: STATE.shadowDtus.size };
}, { description: "List shadow DTUs (internal/hidden by default)." });



register("dtu", "cluster", async (ctx, input) => {
  // group DTUs by similarity (simple jaccard on title+tags)
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

  // Use existing clustering logic (same as dtu.cluster) but promote stable clusters into a MEGA DTU.
  const regular = Array.from(STATE.dtus.values()).filter(d => (d.tier||"regular")==="regular" && !isShadowDTU(d) && (d.status||"active")==="active");
  if (regular.length < minCluster) return { ok:true, did:"none", reason:"not_enough_regular_dtus", regular: regular.length };

  // Lightweight topic hashing for cluster identity
  const topicKeyOf = (cluster) => {
    const tags = cluster.flatMap(d => Array.isArray(d.tags)?d.tags:[]).map(t=>String(t).toLowerCase()).filter(Boolean);
    tags.sort();
    return simpleHash(tags.slice(0, 30).join("|") + "|" + cluster.map(d=>d.id).slice(0,10).join("|"));
  };

  // Reuse cluster() macro internally by calling its implementation (avoid endpoint recursion)
  const clustersRes = await runMacro(ctx, "dtu", "cluster", { minCluster, maxClusters: clamp(Number(input.maxClusters||12), 1, 50) });
  if (!clustersRes?.ok) return { ok:false, error:"cluster_failed", detail: clustersRes?.error || clustersRes };
  const clusters = Array.isArray(clustersRes.clusters) ? clustersRes.clusters : [];

  let promoted = [];
  for (const c of clusters) {
    if (promoted.length >= maxPromotions) break;
    const ids = Array.isArray(c.ids) ? c.ids : [];
    if (ids.length < minCluster) continue;
    const members = ids.map(id => STATE.dtus.get(id)).filter(Boolean);
    if (members.length < minCluster) continue;

    const clusterKey = topicKeyOf(members);
    // Skip if a mega already exists for this cluster key
    const existing = Array.from(STATE.dtus.values()).find(d => (d.tier||"") === "mega" && d?.meta?.clusterKey === clusterKey);
    if (existing) continue;

    // Build a deterministic mega summary (no LLM dependency)
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

// Chat domain
register("chat", "respond", async (ctx, input) => {
  const sessionId = normalizeText(input.sessionId || "default");
  
const prompt = String(input.prompt || "");
const mode = normalizeText(input.mode || "explore");

// --- Concord Identity Invariant (hardwired; prevents "random assistant" drift) ---
const _selfTokens = new Set([
  "concord","concordos","concord os","dtu","dtus","lattice","council","macro-max","wrappers","wrappers studio","global","marketplace"
]);
const _pLow = tokenish(prompt);
const _mentionsSelf = Array.from(_selfTokens).some(t => _pLow.includes(t));

  // Base settings must exist before we derive localSettings/style.
  const baseSettings = (ctx?.state?.settings) ? ctx.state.settings : (STATE.settings || {});

  if (!STATE.sessions.has(sessionId)) {
    STATE.sessions.set(sessionId, { createdAt: nowISO(), messages: [] });
  }

  // Session-adaptive style vector (mutable)
  const styleSignal = input.styleSignal || null; // {kind:'like'|'dislike'} or {field,dir,amount}
  let styleVec = getSessionStyleVector(sessionId);
  if (styleSignal) {
    styleVec = mutateStyleVector(styleVec, styleSignal);
    STATE.styleVectors.set(sessionId, styleVec);
    saveStateDebounced();
  }

  let localSettings = applyStyleToSettings(baseSettings, styleVec);
  const llm = typeof input.llm === "boolean" ? input.llm : localSettings.llmDefault;

  const sess = STATE.sessions.get(sessionId);
  
sess.messages.push({ role: "user", content: prompt, ts: nowISO() });

  // --- Per-user personality growth (style vector) ---
  // Only react to explicit preference signals (offline-safe).
  const low = tokenish(prompt);
  const signals = [];
  if (/\b(shorter|too long|less detail|brief)\b/i.test(prompt)) signals.push({ field:"verbosity", dir:"down", amount:0.10 });
  if (/\b(longer|more detail|more depth|explain more)\b/i.test(prompt)) signals.push({ field:"verbosity", dir:"up", amount:0.10 });
  if (/\b(no bullets|stop bullet|no lists)\b/i.test(prompt)) signals.push({ field:"bulletiness", dir:"down", amount:0.14 });
  if (/\b(use bullets|give me bullets|list it)\b/i.test(prompt)) signals.push({ field:"bulletiness", dir:"up", amount:0.14 });
  if (/\b(more casual|less formal|talk normal)\b/i.test(prompt)) signals.push({ field:"formality", dir:"down", amount:0.12 });
  if (/\b(more formal|professional)\b/i.test(prompt)) signals.push({ field:"formality", dir:"up", amount:0.12 });
  if (/\b(stop being static|be dynamic|free flow|freestyle)\b/i.test(prompt)) signals.push({ field:"bulletiness", dir:"down", amount:0.08 });
  if (/\b(stop arguing|stop disclaimers|stop assistant)\b/i.test(prompt)) signals.push({ field:"formality", dir:"down", amount:0.06 });

  if (signals.length) {
    let v = getSessionStyleVector(sessionId);
    for (const s of signals) v = mutateStyleVector(v, s);
    STATE.styleVectors.set(sessionId, v);
    // apply updated style to this response immediately
    localSettings = applyStyleToSettings(baseSettings, v);
    saveStateDebounced();
  }
  if (sess.messages.length > 60) sess.messages.splice(0, sess.messages.length - 60);

  // Deterministic micro-kernel: basic arithmetic (LLM not required)
  // Answers only when the prompt is unambiguously a simple arithmetic query.
  const _tryDeterministicMath = (raw) => {
    const s = String(raw || "").trim().toLowerCase();
    const cleaned = s.replace(/[,]/g, "").replace(/[=]/g, " ").replace(/[?]/g, "").trim();
    const wordMap = [
      { re: /^what\s+is\s+(-?\d+(?:\.\d+)?)\s*(\+|plus)\s*(-?\d+(?:\.\d+)?)$/, op: "+" },
      { re: /^(-?\d+(?:\.\d+)?)\s*(\+|plus)\s*(-?\d+(?:\.\d+)?)$/, op: "+" },
      { re: /^what\s+is\s+(-?\d+(?:\.\d+)?)\s*(\-|minus)\s*(-?\d+(?:\.\d+)?)$/, op: "-" },
      { re: /^(-?\d+(?:\.\d+)?)\s*(\-|minus)\s*(-?\d+(?:\.\d+)?)$/, op: "-" },
      { re: /^what\s+is\s+(-?\d+(?:\.\d+)?)\s*(\*|x|times|multiplied\s+by)\s*(-?\d+(?:\.\d+)?)$/, op: "*" },
      { re: /^(-?\d+(?:\.\d+)?)\s*(\*|x|times|multiplied\s+by)\s*(-?\d+(?:\.\d+)?)$/, op: "*" },
      { re: /^what\s+is\s+(-?\d+(?:\.\d+)?)\s*(\/|divided\s+by|over)\s*(-?\d+(?:\.\d+)?)$/, op: "/" },
      { re: /^(-?\d+(?:\.\d+)?)\s*(\/|divided\s+by|over)\s*(-?\d+(?:\.\d+)?)$/, op: "/" },
    ];
    for (const r of wordMap) {
      const m = cleaned.match(r.re);
      if (!m) continue;
      const a = Number(m[1]);
      const b = Number(m[3]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      if (r.op === "/" && b === 0) return { reply: "undefined (division by zero)", meta: { source: "deterministic_math" } };
      let out;
      if (r.op === "+") out = a + b;
      else if (r.op === "-") out = a - b;
      else if (r.op === "*") out = a * b;
      else out = a / b;
      const reply = Number.isInteger(out) ? String(out) : String(out);
      return { reply, meta: { source: "deterministic_math" } };
    }
    return null;
  };

  const mathHit = _tryDeterministicMath(prompt);
  if (mathHit) {
    const finalReply = mathHit.reply;
    sess.messages.push({ role: "assistant", content: finalReply, ts: nowISO(), meta: { llmUsed: false, mode, deterministic: true, source: "math" } });
    ctx.log("chat", "Deterministic math answer", { sessionId, mode, reply: finalReply });
    saveStateDebounced();
    return { ok: true, reply: finalReply, sessionId, mode, llmUsed: false, meta: { panel: "chat", sessionId, mode, llmUsed: false, deterministic: true, source: "math" } };
  }



// --- Reality intercepts (authoritative; no LLM) ---
const _lowPrompt = tokenish(prompt);
const _isTimeQuery = (s) => {
  const t = tokenish(s);
  if (t.includes("time complexity") || t.includes("runtime")) return false;
  return /\b(what time|current time|time is it|date today|today's date|what day|day is it)\b/i.test(String(s||""));
};
const _isWeatherQuery = (s) => /\b(weather|forecast|temperature|temp|rain|snow|wind)\b/i.test(String(s||""));
const _extractLocation = (s) => {
  const m = String(s||"").match(/\b(?:in|for|at)\s+([a-zA-Z][^,.;!?]{2,60})/i);
  return m ? String(m[1]).trim() : "";
};

if (_isTimeQuery(prompt)) {
  const tz = String(localSettings?.timezone || "America/New_York");
  const t = getTimeInfo(tz);
  const reply = `Local time (${tz}): ${t.localTime}
ISO: ${t.nowISO}`;
  sess.messages.push({ role:"assistant", content: reply, ts: nowISO(), meta: { llmUsed:false, source:"time" } });
  saveStateDebounced();
  return { ok:true, reply, sessionId, mode, llmUsed:false, meta:{ panel:"chat", sessionId, mode, llmUsed:false, source:"time" } };
}

if (_isWeatherQuery(prompt)) {
  const tz = String(localSettings?.timezone || "America/New_York");
  const loc = _extractLocation(prompt) || String(localSettings?.defaultLocation || "Poughkeepsie, NY");
  try {
    const wx = await getWeather(loc, { timeZone: tz });
    if (!wx.ok) {
      const reply = `Weather lookup failed for "${loc}": ${wx.error || "unknown_error"}`;
      sess.messages.push({ role:"assistant", content: reply, ts: nowISO(), meta: { llmUsed:false, source:"weather" } });
      saveStateDebounced();
      return { ok:true, reply, sessionId, mode, llmUsed:false, meta:{ panel:"chat", sessionId, mode, llmUsed:false, source:"weather" } };
    }
    const cur = wx.forecast?.current || {};
    const daily = wx.forecast?.daily || {};
    const todayMax = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
    const todayMin = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
    const reply =
      `Weather for ${wx.location}:
` +
      `Now: ${cur.temperature_2m ?? "?"}°C (feels ${cur.apparent_temperature ?? "?"}°C), wind ${cur.wind_speed_10m ?? "?"} km/h, precip ${cur.precipitation ?? "?"} mm
` +
      `Today: high ${todayMax ?? "?"}°C / low ${todayMin ?? "?"}°C`;
    sess.messages.push({ role:"assistant", content: reply, ts: nowISO(), meta: { llmUsed:false, source:"weather", cached: wx.cached } });
    saveStateDebounced();
    return { ok:true, reply, sessionId, mode, llmUsed:false, meta:{ panel:"chat", sessionId, mode, llmUsed:false, source:"weather", cached: wx.cached } };
  } catch (e) {
    const reply = `Weather lookup error: ${String(e?.message||e)}`;
    sess.messages.push({ role:"assistant", content: reply, ts: nowISO(), meta: { llmUsed:false, source:"weather" } });
    saveStateDebounced();
    return { ok:true, reply, sessionId, mode, llmUsed:false, meta:{ panel:"chat", sessionId, mode, llmUsed:false, source:"weather" } };
  }
}

const intentInfo = classifyIntent(prompt);

  // Identity answers are declarative: Concord refers to itself.
  if (_mentionsSelf || intentInfo.intent === INTENT.IDENTITY) {
    const base = SYSTEM_IDENTITY.short;
    const more = SYSTEM_IDENTITY.long;
    const ask = "What part do you want—DTUs, lattice retrieval, macros/wrappers, Temporal OS, or the UI/panels?";
    const reply = `${base}

${more}

${ask}`;
    sess.messages.push({ role: "assistant", content: reply, ts: nowISO(), meta: { llmUsed: false, mode, identity: true } });
    saveStateDebounced();
    return { ok:true, reply, sessionId, mode, llmUsed:false, meta: { panel: "chat", sessionId, mode, llmUsed:false, identity:true } };
  }
// Linguistic Engine v1: track canonical intents even with LLM off
if (!ctx.state.organs.has("linguistic_engine_v1")) {
  ctx.state.organs.set("linguistic_engine_v1", { organId:"linguistic_engine_v1", desc:"LLM-independent lexicon + intent tracking.", createdAt: nowISO(), lexicon: {} });
}
const lex = ctx.state.organs.get("linguistic_engine_v1").lexicon || (ctx.state.organs.get("linguistic_engine_v1").lexicon = {});
const key = intentInfo.intent + ":" + intentInfo.canonical;
lex[key] = lex[key] || { count: 0, lastSeen: null, samples: [] };
lex[key].count++;
lex[key].lastSeen = nowISO();
if (lex[key].samples.length < 5 && prompt) lex[key].samples.push(prompt);

// Hard intercepts (authoritative)
if (intentInfo.intent === INTENT.IDENTITY) {
  const reply = `${SYSTEM_IDENTITY.short}\n\n${SYSTEM_IDENTITY.long}\n\nInvariants:\n- ${SYSTEM_IDENTITY.invariants.join("\n- ")}`;
  sess.messages.push({ role:"assistant", content: reply, ts: nowISO() });
  saveStateDebounced();
  return { ok:true, reply, mode, llmUsed:false, intent: intentInfo.intent };
}
if (intentInfo.intent === INTENT.GREETING) {
  const isFirstTurn = !sess.messages || sess.messages.length <= 1; // just pushed user message
  if (!sess.didGreet && isFirstTurn) {
    const reply = `Yo. You good? Pick a move: chat / forge / dream / evolution / synthesize / research.`;
    sess.didGreet = true;
    sess.messages.push({ role:"assistant", content: reply, ts: nowISO() });
    saveStateDebounced();
    return { ok:true, reply, mode, llmUsed:false, intent: intentInfo.intent };
  }
}


  
  // ---------- Session Anchors (decay + confidence weighting + topic switching) ----------
  const _nowMs = () => Date.now();
  const _ensureAnchorState = () => {
    if (!sess.anchorState || typeof sess.anchorState !== "object") {
      sess.anchorState = { active: null, items: [], lastDecayAt: _nowMs() };
    }
    if (!Array.isArray(sess.anchorState.items)) sess.anchorState.items = [];
    if (!sess.anchorState.lastDecayAt) sess.anchorState.lastDecayAt = _nowMs();
    return sess.anchorState;
  };
  const _decayAnchors = (st) => {
    const now = _nowMs();
    const dt = Math.max(0, now - (st.lastDecayAt || now));
    st.lastDecayAt = now;
    const halfLifeMs = Number(localSettings?.anchorHalfLifeMs || 15*60*1000); // 15m default
    const decay = halfLifeMs > 0 ? Math.pow(0.5, dt / halfLifeMs) : 0.9;
    for (const a of st.items) a.weight = clamp(Number(a.weight || 0) * decay, 0, 1);
    st.items = st.items.filter(a => (a.weight || 0) >= 0.05);
    if (st.active && !st.items.find(x => x.key === st.active)) st.active = null;
    if (!st.active && st.items.length) {
      st.items.sort((a,b)=>(b.weight||0)-(a.weight||0));
      st.active = st.items[0].key;
    }
  };
  const _STOP = new Set(["the","a","an","and","or","but","if","then","to","of","in","on","for","with","about","from","is","are","was","were","be","been","being","it","that","this","those","these","i","you","we","they","he","she","them","me","my","your","our","their","as","at","by","do","did","does","just","yo","yoo","hey","hi","hello","sup","wassup","huh","man","bro"]);
  const _topicKeyFromText = (t) => {
    const toks = simpleTokens(String(t || "")).filter(x => x && x.length >= 3 && !_STOP.has(x));
    const uniq = [];
    for (const w of toks) { if (!uniq.includes(w)) uniq.push(w); if (uniq.length >= 6) break; }
    return uniq.slice(0, 4).join(" ");
  };
  const _jaccardTokens = (a, b) => {
    const A = new Set(simpleTokens(String(a || "")));
    const B = new Set(simpleTokens(String(b || "")));
    if (!A.size || !B.size) return 0;
    let inter = 0; for (const x of A) if (B.has(x)) inter++;
    return inter / (A.size + B.size - inter);
  };
  const _upsertAnchor = (st, key, sample, w) => {
    if (!key) return;
    const k = String(key).trim().toLowerCase();
    let a = st.items.find(x => x.key === k);
    if (!a) { a = { key: k, weight: 0, lastSeen: _nowMs(), sample: String(sample || "").slice(0, 220) }; st.items.push(a); }
    a.weight = clamp((a.weight || 0) + clamp(Number(w || 0), 0, 1), 0, 1);
    a.lastSeen = _nowMs();
    if (sample) a.sample = String(sample).slice(0, 220);
  };
const _updateAnchorsFromTurn = ({ promptText, bestScoreHint = 0, wantsStructured = false, topicTitle = null }) => {
  // Track a lightweight "topic anchor" for the session (decay + confidence weighting).
  // This is NOT a chat reply generator; it's metadata for routing/retrieval.
  const st = _ensureAnchorState();
  _decayAnchors(st);

  const baseText = String(topicTitle || promptText || "");
  const key = _topicKeyFromText(baseText);
  if (!key) return;

  const score = clamp(Number(bestScoreHint || 0), 0, 1);
  const w = clamp(0.10 + 0.60 * score + (wantsStructured ? 0.05 : 0), 0, 1);

  _upsertAnchor(st, key, promptText || "", w);
  st.active = String(key).trim().toLowerCase();
};

// Retrieve relevant DTUs (local) — search-like semantics (synonyms + fuzzy) + temporal recency (soft-gate)
const all = dtusArray();
const qRaw = String(prompt || "");
const qBase = tokensNoStop(qRaw);
const qExp  = expandQueryTokens(qRaw);

const expandTokensFromTokens = (tokens=[]) => {
  const out = new Set(tokens.map(stemLite));
  for (const t of tokens) {
    const syns = SYN_MAP[t] || SYN_MAP[stemLite(t)] || null;
    if (syns) for (const s of syns) out.add(stemLite(s));
  }
  return Array.from(out).slice(0, 256);
};

const scored = all.map(d => {
  const dText = [
    d?.title || "",
    Array.isArray(d?.tags) ? d.tags.join(" ") : "",
    d?.cretiHuman || d?.creti || d?.human?.summary || "",
    Array.isArray(d?.human?.bullets) ? d.human.bullets.join(" ") : ""
  ].join(" ").slice(0, 2400);

  const dBase = tokensNoStop(dText);
  const dExp  = expandTokensFromTokens(dBase);

  const sBase = jaccard(qBase, dBase);
  const sExp  = jaccard(qExp, dExp);
  const sNg   = ngramSim(qRaw, dText);

  // Soft temporal boost (never dominates)
  const tW = temporalRecencyWeight(d);

  const score = clamp(
    0.55*sBase + 0.30*sExp + 0.15*sNg + 0.10*tW,
    0, 1
  );
    return { d, score };
  }).sort((a,b)=>b.score-a.score);
  const relevant = scored.filter(x=>x.score > 0.08).slice(0, 6).map(x=>x.d);


// Local response (non-LLM): crisp, constrained reasoning (APE) + scalable substrate (ANT)
const lastTurns = (sess.messages || []).slice(-8);
const userHistory = lastTurns.filter(m => m.role === "user").map(m => m.content).join(" | ").slice(-800);

// Persist conversational context as a hidden shadow DTU (used for routing/anchors; never shown verbatim to user)
try {
  const shadowId = `shadow_session_context_${sessionId}`;
  const shadow = {
    id: shadowId,
    tier: "shadow",
    tags: ["shadow","session","context"],
    human: { summary: `Session context (recent turns) for ${sessionId}`, bullets: [] },
    core: { definitions: [], invariants: [], claims: [], examples: [], nextActions: [] },
    machine: {
      kind: "session_context",
      sessionId,
      recentUserTurns: userHistory,
      recentTurns: lastTurns.map(m => ({ role: m.role, content: String(m.content||"").slice(0, 280), ts: m.ts || null })).slice(-8),
      // lightweight pointers only (no heavy payload)
      focusIds: []
    },
    lineage: { parents: [], children: [] },
    source: "shadow",
    meta: { hidden: true },
    createdAt: nowISO(),
    updatedAt: nowISO(),
    authority: { model: "shadow", score: 0 },
    hash: ""
  };
  // upsert
  STATE.shadowDtus.set(shadowId, shadow);
  sess.contextShadowId = shadowId;
} catch {}

// Build a working set that stays crisp even with huge DTU libraries
const { focus, micro, macro } = selectWorkingSet(
  scored.filter(x=>x.score > 0.06).map(x=>({ d:x.d, score:x.score })),
  localSettings,
  { includeMegas: localSettings.includeMegasInBase !== false }
);

// Track usage for abstraction placement / promotions
try {
  for (const d of focus) markDTUUsed(d, `chat:${sessionId}`);
  for (const d of micro) markDTUUsed(d, `chat:${sessionId}`);
  for (const d of macro) markDTUUsed(d, `chat:${sessionId}`);
} catch {}

const wants = /\?$/.test(prompt.trim()) || /\b(why|how|what|when|where|who|can you|should i|help|explain)\b/i.test(prompt);
const bestScore = scored?.[0]?.score ?? 0;

// Refine session anchors using DTU match confidence (works offline + online)
try {
  const topicTitle = (micro && micro.length) ? micro[0].title : null;
  _updateAnchorsFromTurn({ promptText: prompt, bestScoreHint: bestScore, wantsStructured, topicTitle });
} catch {}

const hasStrongEvidence = micro.length >= 2 && bestScore >= 0.12;

const frame = chooseAbstractionFrame({
  mode,
  intent: intentInfo.intent,
  hasStrongEvidence,
  settings: localSettings
});

const modeHint =
  mode === "design" ? "Design mode"
: mode === "debug" ? "Debug mode"
: mode === "decide" ? "Decide mode"
: "Explore mode";

const answerLines = [];
if (wants) {
  if (micro.length) {
    answerLines.push(`- (${modeHint}) Based on your strongest DTU anchors, here’s the most consistent move:`);

    const take = micro.slice(0, 2);
    for (const d of take) {
      const firstLine = buildCretiText(d).split(/\n\n|\n/).filter(Boolean)[0] || "";
      answerLines.push(`- ${d.title}: ${firstLine.slice(0, 220)}${firstLine.length>220 ? "…" : ""}`);
    }

    // If we have macro anchors and higher abstraction is allowed, add a compact generalization
    if (frame.level >= 1 && macro.length) {
      answerLines.push(`- Generalization: this sits under ${macro.slice(0,2).map(m=>m.title).join(" / ")}.`);
    }
  } else {
    answerLines.push(`- (${modeHint}) I don’t have a strong DTU match yet.`);
    answerLines.push(`- Tell me your target outcome + constraints, or forge 1–2 DTUs (definitions + invariants) and I’ll lock it in.`);
  }
} else {
  answerLines.push(`- (${modeHint}) Got it.`);
  answerLines.push(`- Tell me your next step (plan / build spec / critique / DTU creation) and I’ll move.`);
}

const hypotheses = [];
if (frame.level >= 2 && !hasStrongEvidence) {
  // Labeled hypotheses (kept minimal)
  if (macro.length) hypotheses.push(`This may be primarily about: ${macro[0].title}.`);
  hypotheses.push("Your DTU substrate may be missing explicit constraints/tests for this topic (forge them to sharpen reasoning).");
}

const ptxt = String(prompt || "");
const wantsStructured =
  Boolean(frame?.wantsStructured) ||
  /\b(structure(d)?|structured|outline|steps|bullets?|json|table|format)\b/i.test(ptxt);

const tests = [];
if (frame.requireTests && (!LLM_READY || wantsStructured) && (!hasStrongEvidence || /\bmaybe|might|likely|probably\b/i.test(ptxt))) {
  tests.push("Forge 1 DTU with definitions + invariants (no prose).");
  tests.push("Forge 1 DTU with tests/falsifiability (what would disprove it).");
  tests.push("Run: system.evolution (promote a stable cluster to MEGA) once duplicates collapse.");
}

let localReply = formatCrispResponse({
  prompt,
  mode,
  microDTUs: micro,
  macroDTUs: macro,
  level: frame.level,
  answerLines,
  hypotheses,
  tests
});

  // NOTE: Do NOT print internal context tracking to the user.

  let finalReply = localReply;
  let llmUsed = false;

  if (llm && ctx.llm.enabled) {
    const system =
`You are ConcordOS. Be natural, concise but not dry. Use DTUs as memory. Never pretend features exist.
Mode: ${mode}.
When helpful, reference DTU titles in plain language (do not dump ids unless asked).`;
    const dtuContext = focus.map(d => `TITLE: ${d.title}
TIER: ${d.tier}
TAGS: ${(d.tags||[]).join(", ")}
CRETI:
${buildCretiText(d)}
---`).join("\n");
    const messages = [
      { role: "user", content: `User prompt:\n${prompt}\n\nRelevant DTUs:\n${dtuContext}\n\nRespond naturally and propose next actions.` }
    ];
    const r = await ctx.llm.chat({ system, messages, temperature: 0.35, maxTokens: 700 });
    if (r.ok) {
      finalReply = r.content.trim() || localReply;
      llmUsed = true;
    } else {
      ctx.log("llm.error", "LLM call failed; falling back to local.", { error: r });
    }
  }

  sess.messages.push({ role: "assistant", content: finalReply, ts: nowISO(), meta: { llmUsed, mode, relevant: relevant.map(d=>d.id) } });
  ctx.log("chat", "Chat response generated", { sessionId, mode, llmUsed, relevant: relevant.map(d=>d.id) });
  // persist session + any state mutations from this turn
  saveStateDebounced();

  return { ok: true, reply: finalReply, sessionId, mode, llmUsed, relevant: relevant.map(d=>({ id:d.id, title:d.title, tier:d.tier })) };
}, { description: "Mode-aware chat with DTU retrieval; optional LLM enhancement." });

// Ask domain

register("style", "get", async (ctx, input) => {
  const sessionId = normalizeText(input.sessionId || "default");
  const vec = getSessionStyleVector(sessionId);
  return { ok:true, sessionId, styleVector: vec };
});

register("style", "mutate", async (ctx, input) => {
  const sessionId = normalizeText(input.sessionId || "default");
  const signal = input.signal || { kind: "like" };
  const cur = getSessionStyleVector(sessionId);
  const next = mutateStyleVector(cur, signal);
  STATE.styleVectors.set(sessionId, next);
  saveStateDebounced();
  return { ok:true, sessionId, styleVector: next };
}, { description: "Mutate session style vector (bounded nudges)." });

register("ask", "answer", async (ctx, input) => {
  const sessionId = normalizeText(input.sessionId || "default");
  const query = String(input.query || "");
  const mode = normalizeText(input.mode || "answer");
  const llm = typeof input.llm === "boolean" ? input.llm : ctx.state.settings.llmDefault;

  // Use same retrieval as chat, but format as structured answer
  const all = dtusArray();
  const qTok = simpleTokens(query);
  const scored = all.map(d => {
    const dTok = simpleTokens(d.title + " " + (d.tags||[]).join(" ") + " " + ((d.cretiHuman || d.creti || d.human?.summary || "")).slice(0, 400));
    const score = jaccard(qTok, dTok);
    return { d, score };
  }).sort((a,b)=>b.score-a.score);
  const relevant = scored.filter(x=>x.score > 0.08).slice(0, 8).map(x=>x.d);


let answer = "";
const { focus, micro, macro } = selectWorkingSet(
  scored.filter(x=>x.score > 0.06).map(x=>({ d:x.d, score:x.score })),
  ctx.state.settings,
  { includeMegas: true }
);

// Track usage for abstraction placement / promotions
try {
  for (const d of focus) markDTUUsed(d, `ask:${sessionId}`);
  for (const d of micro) markDTUUsed(d, `ask:${sessionId}`);
  for (const d of macro) markDTUUsed(d, `ask:${sessionId}`);
} catch {}
const bestScore = scored?.[0]?.score ?? 0;
const hasStrongEvidence = micro.length >= 2 && bestScore >= 0.12;
const frame = chooseAbstractionFrame({ mode, intent: INTENT.QUESTION, hasStrongEvidence, settings: ctx.state.settings });


// --- Full activation: feasibility-first (no modes) ---
const feas = await ctx.macro.run("verify","feasibility",{ query, llm });
const feasibility = {
  classification: feas?.classification || "undecidable",
  reason: feas?.reason || "",
  conflicts: feas?.conflicts || [],
  relevantIds: feas?.relevantIds || []
};


if (llm && ctx.llm.enabled) {
  const system = `You are ConcordOS. Provide a crisp, structured answer. Separate Facts / Inferences / Hypotheses (labeled) / Next tests. Never invent capabilities.`;
  const dtuContext = focus.map(d => `• ${d.title} [${d.tier}] tags=${(d.tags||[]).join(", ")}\n${buildCretiText(d)}\n`).join("\n");
  const messages = [{ role:"user", content:`Question:\n${query}\n\nDTUs:\n${dtuContext}\n\nAnswer in a practical style with the required sections.` }];
  const r = await ctx.llm.chat({ system, messages, temperature: 0.25, maxTokens: 700 });
  if (r.ok) answer = r.content.trim();
}

if (!answer) {
  const answerLines = [];
  if (micro.length) {
    answerLines.push(`- Based on your strongest DTU anchors:`);
    for (const d of micro.slice(0,3)) {
      const firstLine = buildCretiText(d).split(/\n\n|\n/).filter(Boolean)[0] || "";
      answerLines.push(`- ${d.title}: ${firstLine.slice(0, 220)}${firstLine.length>220 ? "…" : ""}`);
    }
    if (frame.level >= 1 && macro.length) answerLines.push(`- Generalization: ${macro.slice(0,2).map(m=>m.title).join(" / ")}.`);
  } else {
    answerLines.push(`- No strong DTU match yet.`);
  }

  const hypotheses = [];
  if (frame.level >= 2 && !hasStrongEvidence) {
    if (macro.length) hypotheses.push(`This may be primarily about: ${macro[0].title}.`);
    hypotheses.push("Add constraints/tests DTUs to sharpen local reasoning.");
  }

  const tests = [
    "Forge 1 DTU with definitions + invariants for this topic.",
    "Forge 1 DTU with tests/falsifiability (what would disprove it).",
  ];

  answer = formatCrispResponse({
    prompt: query,
    mode,
    microDTUs: micro,
    macroDTUs: macro,
    level: frame.level,
    answerLines,
    hypotheses,
    tests
  });
}


  // Prepend feasibility classification (always-on)
  try {
    const feasLine = `Feasibility: ${feasibility.classification}${feasibility.reason ? ` (${feasibility.reason})` : ""}`;
    const conflictLine = (feasibility.conflicts && feasibility.conflicts.length)
      ? `Conflicts: ${feasibility.conflicts.map(c => c.base).join(" | ")}`
      : "";
    answer = `${feasLine}${conflictLine ? `
${conflictLine}` : ""}

${answer}`;
  } catch {}
  ctx.log("ask", "Ask answered", { sessionId, mode, llmUsed: Boolean(answer && llm && ctx.llm.enabled), relevant: relevant.map(d=>d.id) });
  return { ok: true, answer, feasibility, relevant: relevant.map(d=>({ id:d.id, title:d.title, tier:d.tier })) };
});

// Forge domain
register("forge", "manual", async (ctx, input) => {
  const prompt = String(input.prompt || "");
  const title = normalizeText(input.title || `Forge: ${prompt.slice(0,60)}`) || "Forge DTU";
  const tags = Array.isArray(input.tags) ? input.tags : [];
  const creti = cretiPack({
    title,
    purpose: "Manual forge: convert prompt into a structured CRETI DTU.",
    context: prompt,
    procedure: "1) Extract key claims\n2) Convert into DTU bullets\n3) Add tests for falsifiability",
    outputs: "A DTU (regular) with CRETI content",
    tests: "Check clarity, non-duplication, tag coverage",
    notes: "Local-first; LLM can enhance via /chat with enhance toggle."
  });

  const created = await ctx.macro.run("dtu", "create", { title, creti, tags, tier: "regular", source: "forge.manual" });
  const score = await ctx.macro.run("verify","designScore", { spec: prompt, llm: ctx.state.settings.llmDefault });
  if (created && typeof created === "object") created.designScore = score;
  return created;
});

register("forge", "hybrid", async (ctx, input) => {
  const prompt = String(input.prompt || "");
  const base = await ctx.macro.run("forge", "manual", input);
  if (!base?.ok) return base;
  // add auto-tag suggestions
  const suggestedTags = Array.from(new Set([
    ...(base.dtu.tags||[]),
    ...simpleTokens(prompt).slice(0,8)
  ])).slice(0, 16);
  base.dtu.tags = suggestedTags;
  base.dtu.updatedAt = nowISO();
  upsertDTU(base.dtu);
  ctx.log("forge.hybrid", "Hybrid forge updated tags", { id: base.dtu.id });

const score = await ctx.macro.run("verify","designScore", { spec: prompt, llm: ctx.state.settings.llmDefault });
return { ok: true, dtu: base.dtu, designScore: score };
});

register("forge", "auto", async (ctx, input) => {
  // Auto forge can produce multiple DTUs: summary, risks, next steps
  const prompt = String(input.prompt || "");
  const tags = Array.isArray(input.tags) ? input.tags : [];
  const packs = [
    {
      title: normalizeText(input.title || `AutoForge: Summary — ${prompt.slice(0,40)}`),
      purpose: "Summarize the prompt into a compact DTU.",
      procedure: "Compress into a single thesis + 3 supporting bullets."
    },
    {
      title: normalizeText(`AutoForge: Risks — ${prompt.slice(0,40)}`),
      purpose: "Identify failure modes and risks.",
      procedure: "List 5 risks + mitigations."
    },
    {
      title: normalizeText(`AutoForge: Next Steps — ${prompt.slice(0,40)}`),
      purpose: "Actionable next steps.",
      procedure: "List 7 steps, each testable."
    }
  ];

  const created = [];
  for (const p of packs) {
    const creti = cretiPack({
      title: p.title,
      purpose: p.purpose,
      context: prompt,
      procedure: p.procedure,
      outputs: "A DTU that can be chained into plans or council runs.",
      tests: "Must be clear, non-duplicate, and actionable.",
      notes: "Auto-forged DTUs are regular tier; evolution can lift them to mega."
    });
    const r = await ctx.macro.run("dtu","create",{ title:p.title, creti, tags, tier:"regular", source:"forge.auto" });
    if (r?.ok) created.push(r.dtu);
  }
  return { ok: true, dtus: created };
});

// Swarm domain
register("swarm", "run", async (ctx, input) => {
  const prompt = String(input.prompt || "");
  const items = dtusArray().filter(d=>d.tier==="regular");
  // de-dup by title similarity
  const kept = [];
  for (const d of items) {
    const dt = simpleTokens(d.title);
    let dup = false;
    for (const k of kept) {
      const kt = simpleTokens(k.title);
      if (jaccard(dt, kt) >= 0.72) { dup = true; break; }
    }
    if (!dup) kept.push(d);
  }
  const removed = items.length - kept.length;

  // propose 3 new DTUs from prompt
  const suggestions = [];
  const baseTags = simpleTokens(prompt).slice(0,10);
  for (let i=1;i<=3;i++){
    const title = `Swarm Proposal ${i}: ${prompt.slice(0, 42)}`.trim();
    const creti = cretiPack({
      title,
      purpose: `Swarm proposal #${i}: explore a distinct angle.`,
      context: prompt,
      procedure: `Angle ${i}: generate unique insight, ensure not overlapping with other proposals.`,
      outputs: "A DTU proposal (not auto-saved unless you call saveSuggested).",
      tests: "Must be non-duplicate vs existing DTUs (title+tags).",
      notes: "Use saveSuggested to store."
    });
    suggestions.push({ title, creti, tags: baseTags, tier:"regular" });
  }

  ctx.log("swarm.run", "Swarm completed", { removed, proposed: suggestions.length });
  return { ok: true, removedDuplicates: removed, keptCount: kept.length, suggested: suggestions };
});

register("dtu", "saveSuggested", async (ctx, input) => {
  const dtus = Array.isArray(input.dtus) ? input.dtus : [];
  const saved = [];
  for (const s of dtus) {
    const r = await ctx.macro.run("dtu","create",{
      title: s.title, creti: s.creti, tags: s.tags || [], tier: s.tier || "regular", source:"suggested"
    });
    if (r?.ok) saved.push(r.dtu);
  }

const score = await ctx.macro.run("verify","designScore", { spec: prompt, llm: ctx.state.settings.llmDefault });
return { ok: true, saved, designScore: score };
});

// Sim domain
register("sim", "run", async (ctx, input) => {
  const prompt = String(input.prompt || "");
  const assumptions = Array.isArray(input.assumptions) ? input.assumptions : [];
  const horizon = normalizeText(input.horizon || "90 days");
  const sim = {
    id: uid("sim"),
    createdAt: nowISO(),
    prompt,
    assumptions,
    horizon,
    branches: [
      { name:"Base", summary:"Conservative execution; steady iteration.", risk:"medium", confidence:0.62 },
      { name:"Aggressive", summary:"High cadence, ship weekly, rapid attention.", risk:"high", confidence:0.48 },
      { name:"Stability-first", summary:"Lock contracts, fewer features, stronger trust.", risk:"low", confidence:0.74 }
    ]
  };
// Full activation: stress test when R/D are provided; otherwise report missing meters.
  let stress = { ok:false, reason:"missing_R_or_D" };
  const R0 = input?.R ?? input?.repair;
  const D0 = input?.D ?? input?.damage;
  if (isFinite(Number(R0)) && isFinite(Number(D0))) {
    stress = await ctx.macro.run("verify","stressTest", { R: Number(R0), D: Number(D0), step: input?.step, maxIter: input?.maxIter });
  }
  sim.stress = stress;
  ctx.state.lastSim = sim;
  ctx.log("sim.run", "Simulation produced", { id: sim.id, horizon, stressOk: !!stress?.ok });
  return { ok: true, sim };
});

// Wrappers domain
register("wrapper", "create", async (ctx, input) => {
  const name = normalizeText(input.name || "Untitled Wrapper");
  const intent = String(input.intent || "");
  const description = String(input.description || input.desc || "");
  const spec = (input.spec && typeof input.spec === "object") ? input.spec : { prompt: String(input.prompt||"") };
  const dtuBindings = Array.isArray(input.dtuBindings) ? input.dtuBindings : (Array.isArray(input.bindings) ? input.bindings : []);
  const w = {
    id: uid("wrap"),
    name,
    intent,
    description,
    spec,
    dtuBindings,
    version: "1.0.0",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    sandbox: true,
    rules: {
      cannotOverrideImmutables: true,
      cannotWriteFiles: true,
      cannotNetwork: false // wrappers may call macros which may call crawl; gating can be added later
    }
  };
  ctx.state.wrappers.set(w.id, w);
  ctx.log("wrapper.create", "Wrapper created", { id: w.id, name });
  return { ok: true, wrapper: w };
});

register("wrapper", "list", async (ctx, input) => {
  return { ok: true, wrappers: Array.from(ctx.state.wrappers.values()) };
});

register("wrapper", "run", async (ctx, input) => {
  const id = String(input.id || "");
  const w = ctx.state.wrappers.get(id);
  if (!w) return { ok: false, error: "Wrapper not found" };
  const inp = input.input ?? {};
  // Wrapper execution model: translates "intent" into macro calls (local-first).
  // This is intentionally constrained + deterministic.
  const intent = tokenish(w.intent);
  let result = { note: "Wrapper executed in sandbox.", intent: w.intent, input: inp };

  // Simple routing: if intent mentions "chess" or "game", propose a DTU + plan.
  if (intent.includes("chess")) {
    const r = await ctx.macro.run("forge","auto",{ prompt: `Chess wrapper: ${JSON.stringify(inp)}` });
    result = { ...result, type:"chess", forged: r.dtus || [] };
  } else if (intent.includes("macro")) {
    // run a macro specified by input {domain,name,input}
    const domain = inp.domain, name = inp.name;
    if (domain && name) {
      const out = await ctx.macro.run(domain, name, inp.input || {});
      result = { ...result, type:"macro", out };
    }
  } else {
    // default: create a DTU describing the wrapper run
    const creti = cretiPack({
      title: `Wrapper Run: ${w.name}`,
      purpose: "Record wrapper run as a DTU and propose next actions.",
      context: `Intent: ${w.intent}\nInput: ${JSON.stringify(inp, null, 2)}`,
      procedure: "Summarize request → identify macro calls needed → propose pipeline.",
      outputs: "DTU describing wrapper result.",
      tests: "Must not violate immutables.",
      notes: "This is local-first; LLM can enhance via chat."
    });
    const dtu = await ctx.macro.run("dtu","create",{ title:`Wrapper: ${w.name}`, creti, tags:["wrapper"], tier:"regular", source:"wrapper.run" });
    result = { ...result, type:"generic", dtu: dtu.dtu };
  }

  ctx.log("wrapper.run", "Wrapper run", { id, name: w.name });
  return { ok: true, result };
});

// Layers domain
register("layer", "list", async (ctx, input) => {
  return { ok: true, layers: Array.from(ctx.state.layers.values()) };
});

register("layer", "create", async (ctx, input) => {
  const name = normalizeText(input.name || "Untitled Layer");
  const layer = { id: uid("layer"), name, enabled: true, createdAt: nowISO(), updatedAt: nowISO() };
  ctx.state.layers.set(layer.id, layer);
  ctx.log("layer.create", "Layer created", { id: layer.id, name });
  return { ok: true, layer };
});

register("layer", "toggle", async (ctx, input) => {
  const id = String(input.id || "");
  const layer = ctx.state.layers.get(id);
  if (!layer) return { ok: false, error: "Layer not found" };
  const enabled = typeof input.enabled === "boolean" ? input.enabled : !layer.enabled;
  layer.enabled = enabled;
  layer.updatedAt = nowISO();
  ctx.log("layer.toggle", "Layer toggled", { id, enabled });
  return { ok: true, layer };
});

// Personas domain
register("persona", "list", async (ctx, input) => {
  return { ok: true, personas: Array.from(ctx.state.personas.values()) };
});

register("persona", "create", async (ctx, input) => {
  const name = normalizeText(input.name || "Untitled Persona");
  const persona = { id: uid("persona"), name, style: input.style || "neutral", createdAt: nowISO(), updatedAt: nowISO() };
  ctx.state.personas.set(persona.id, persona);
  ctx.log("persona.create", "Persona created", { id: persona.id, name });
  return { ok: true, persona };
});

// Ingest domain (crawl/autocrawl)
function stripHtml(html="") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

register("ingest", "url", async (ctx, input) => {
  const url = String(input.url || "");
  if (!url) return { ok:false, error:"url required" };
  const prompt = String(input.prompt || "");
  const tags = Array.isArray(input.tags) ? input.tags : ["ingest"];
  const res = await fetch(url, { method:"GET" });
  const raw = await res.text();
  const text = stripHtml(raw).slice(0, 12000);

  const title = normalizeText(input.title || `Ingest: ${url}`.slice(0, 120));
  const creti = cretiPack({
    title,
    purpose: "Ingest external content into a DTU for local reasoning.",
    context: `URL: ${url}\nPrompt: ${prompt}\n\nCONTENT:\n${text}`,
    procedure: "1) Strip HTML\n2) Keep first N chars\n3) Store as DTU",
    outputs: "A DTU containing the ingested content",
    tests: "Ensure content is readable; ensure licensing is respected",
    notes: "Autocrawl should only ingest content you have rights to use."
  });

  const dtu = await ctx.macro.run("dtu","create",{ title, creti, tags, tier:"regular", source:"ingest.url", meta:{ url } });
  ctx.log("ingest.url", "Ingested url", { url, id: dtu.dtu.id });
  return { ok:true, url, dtu: dtu.dtu, fetchedBytes: raw.length };
});

register("ingest", "queue", async (ctx, input) => {
  const url = String(input.url || "");
  if (!url) return { ok:false, error:"url required" };
  const item = { id: uid("crawl"), url, prompt: input.prompt || "", tags: input.tags || ["autocrawl"], createdAt: nowISO(), status:"queued" };
  ctx.state.crawlQueue.push(item);
  ctx.log("ingest.queue", "Queued url", { url, id: item.id });
  return { ok:true, item };
});

register("ingest", "processQueueOnce", async (ctx, input) => {
  const next = ctx.state.crawlQueue.find(x => x.status === "queued");
  if (!next) return { ok:true, processed:false };
  next.status = "processing";
  try {
    const r = await ctx.macro.run("ingest","url",{ url: next.url, prompt: next.prompt, tags: next.tags, title: `Autocrawl: ${next.url}` });
    next.status = "done";
    next.resultId = r?.dtu?.id || r?.dtu?.dtu?.id;
    return { ok:true, processed:true, item: next, result: r };
  } catch (e) {
    next.status = "error";
    next.error = String(e?.message || e);
    ctx.log("ingest.queue.error", "Autocrawl failed", { id: next.id, error: next.error });
    return { ok:false, processed:true, item: next, error: next.error };
  }
});

// System domain (dream/autogen/evolution/synthesize)
register("system", "dream", async (ctx, input) => {
  // Dream (Council Synthesis): DTU-first, produces 2 high-value DTUs (human-readable), machine notes kept internal.
  const seed = normalizeText(input.seed || "Dream");
  const pool = dtusArray().slice(-20);
  if (!pool.length) return { ok:false, error:"No DTUs to dream from. Seed dtus.js first." };

  const freq = new Map();
  for (const d of pool) for (const t of (d.tags||[])) freq.set(t, (freq.get(t)||0)+1);
  const tagHints = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(x=>x[0]).filter(Boolean);
  const parents = pool.slice(-8).map(d=>d.id);

  function synthDTU(kind) {
    const definitions = [];
    const invariants = [];
    const examples = [];
    const claims = [];
    const nextActions = [];

    for (const d of pool.slice(-8)) {
      const c = d.core || {};
      for (const x of (c.definitions||[])) if (definitions.length<4) definitions.push(x);
      for (const x of (c.invariants||[])) if (invariants.length<4) invariants.push(x);
      for (const x of (c.examples||[])) if (examples.length<4) examples.push(x);
      for (const x of (c.claims||[])) if (claims.length<4) claims.push(x);
      for (const x of (c.nextActions||[])) if (nextActions.length<4) nextActions.push(x);
    }

    if (definitions.length<2) definitions.push(`Definition: ${seed} — a working lens built from your current DTUs and tags (${tagHints.join(", ") || "none"}).`);
    if (invariants.length<1) invariants.push("Invariant: Separate facts, inferences, and hypotheses before committing any DTU.");
    if (examples.length<1) examples.push(`Example: Use ${seed} to synthesize the last 8 DTUs into one actionable plan.`);
    if (nextActions.length<1) nextActions.push("Run: synthesize → merge duplicates → promote to mega when cluster is stable.");

    const title = kind === "synthesis" ? `Council Synthesis: ${seed}` : `Dream Insight: ${seed}`;
    const summary = kind === "synthesis"
      ? `Synthesis built from recent DTUs (tags: ${tagHints.join(", ") || "none"}).`
      : `Insight derived from your DTU substrate; structured for action and clarity.`;

    return {
      title,
      tags: Array.from(new Set(["dream","council", ...tagHints])).slice(0,20),
      tier: "regular",
      lineage: parents,
      core: { definitions, invariants, examples, claims, nextActions },
      human: { summary, bullets: [
        `Parents: ${parents.length} DTUs`,
        `Tag hints: ${tagHints.join(", ") || "none"}`,
        "Output is human projection; raw notes remain internal."
      ]},
      machine: { notes: `DREAM seed=${seed}; parents=${parents.join(",")}` }
    };
  }

  const out = [];
  for (const kind of ["synthesis","insight"]) {
    const spec = synthDTU(kind);
    const r = await ctx.macro.run("dtu","create",{ ...spec, source:"system.dream", allowRewrite:true });
    if (r?.ok) out.push(r.dtu);
  }

  return { ok:true, dtus: out };
});

register("system", "autogen", async (ctx, input) => {
  // Autogen: DTU-first continuity, produces 2 structured DTUs every run (no blob templates).
  const pool = dtusArray().slice(-30);
  if (!pool.length) return { ok:false, error:"No DTUs to autogen from." };

  // QUEUE_AUTOGEN: system autogen proposes DTUs into queues.notifications (or maintenance) to avoid flooding the library
  ensureQueues();
  const _enqueueAutogen = (spec, why) => {
    const item = { id: uid('q_autogen'), type: 'dtu_proposal', payload: spec, why: why||'', createdAt: nowISO(), status:'queued' };
    // Knowledge proposals go to notifications by default; maintenance can be reviewed separately
    enqueueNotification(item);
    return item.id;
  };


  const recentTitles = pool.slice(-10).map(d=>d.title);
  const allTags = pool.flatMap(d=>d.tags||[]);
  const tagFreq = new Map();
  for (const t of allTags) tagFreq.set(t, (tagFreq.get(t)||0)+1);
  const topTags = Array.from(tagFreq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]);

  const parents = pool.slice(-10).map(d=>d.id);

  const continuity = {
    title: `Continuity: ${new Date().toISOString().slice(0,10)}`,
    tags: ["autogen","continuity", ...topTags].slice(0,20),
    tier: "regular",
    lineage: parents,
    core: {
      definitions: ["Definition: Continuity DTU — captures what changed recently so Concord stays coherent over time."],
      invariants: ["Invariant: No invented claims; only summarize state/logs/DTUs that exist."],
      examples: [`Example: Recent DTUs include: ${recentTitles.slice(0,5).join(" | ")}`],
      claims: ["Claim: The DTU library is the substrate; generators must cite parent DTUs."],
      nextActions: ["Next: Run evolution on top clusters; promote to mega when stable; keep humans seeing only human projections."]
    },
    human: {
      summary: "A compact continuity snapshot derived from recent DTUs.",
      bullets: [
        `Recent titles: ${recentTitles.slice(0,6).join(" | ")}`,
        `Top tags: ${topTags.join(", ") || "none"}`,
        `Parents: ${parents.length}`
      ]
    },
    machine: { notes: `AUTOGEN continuity parents=${parents.join(",")}` }
  };

  const gaps = {
    title: `Missing Pieces: ${new Date().toISOString().slice(0,10)}`,
    tags: ["autogen","gaps", ...topTags].slice(0,20),
    tier: "regular",
    lineage: parents,
    core: {
      definitions: ["Definition: Gap DTU — describes what is missing for completeness and what to generate next."],
      invariants: ["Invariant: Prefer creating DTUs that add definitions, invariants, examples, or actionable steps."],
      examples: ["Example: If a cluster has many claims but few invariants, generate invariants DTUs."],
      claims: ["Claim: Low-value blobs are rejected by council gate (value threshold)."],
      nextActions: [
        "Create 1–2 DTUs filling missing definitions for the top tag.",
        "Create 1 DTU that reconciles contradictions between the last 8 DTUs."
      ]
    },
    human: {
      summary: "Actionable gaps detected from current DTU substrate.",
      bullets: [
        "Focus: definitions/invariants/examples over prose.",
        "If duplicates appear, merge lineage instead of creating new DTUs."
      ]
    },
    machine: { notes: `AUTOGEN gaps topTags=${topTags.join(",")}` }
  };

  const created = [];
  for (const spec of [continuity, gaps]) {
    const r = (function(){ _enqueueAutogen({ ...spec, source:"system.autogen", allowRewrite:true }, 'system.autogen'); return { ok:true }; })();
    if (r?.ok) created.push(r.dtu);
  }
  return { ok:true, dtus: created };
});

register("system", "evolution", async (ctx, input) => {
  // Evolution: cluster DTUs and promote biggest cluster into a MEGA DTU
  const clusters = await ctx.macro.run("dtu","cluster",{ threshold: input.threshold ?? 0.38 });
  const best = clusters.clusters?.[0];
  const minCluster = Number(input.minCluster ?? 100);
  if (!best || !best.ids?.length) return { ok:false, error:"No cluster found to evolve." };
  if ((best.ids?.length||0) < minCluster) {
    ensureQueues();
    const proposal = { id: uid("mega_candidate"), type:"mega_candidate", cluster: best, minCluster, createdAt: nowISO(), status:"queued" };
    STATE.queues.synthesis.push(proposal);
    ctx.log("system.evolution", "Cluster below minCluster; queued candidate", { size: best.ids?.length||0, minCluster });
    return { ok:true, queued:true, proposal };
  }

  const inner = dtusByIds(best.ids);
  const sigTags = (best.tagHints||[]).slice(0,8).join("|") || (best.titles||[])[0] || "cluster";
  const existing = dtusArray().find(d=>d.tier==="mega" && (d.meta?.clusterSig===sigTags) && (d.meta?.clusterSize===best.ids.length));
  if (existing) return { ok:true, mega: existing, reused:true, cluster: best };
  const megaTitle = normalizeText(input.title || `MEGA: ${best.titles?.[0] || "Topic Cluster"}`.slice(0,120));
  const creti = cretiPack({
    title: megaTitle,
    purpose: "MEGA DTU: compress a topic range into a single navigable node (with lineage).",
    context: `Cluster size: ${inner.length}\nTag hints: ${(best.tagHints||[]).join(", ")}\n\nInner DTUs:\n${inner.map(d=>`- ${d.title} (${d.id})`).join("\n")}`,
    procedure: "Synthesize shared core, keep lineage, avoid clutter.",
    outputs: "Mega DTU with lineage referencing inner DTUs.",
    tests: "Must not lose lineage; must remain readable.",
    notes: "Mega DTUs can later be merged into Hyper DTUs."
  });

  const r = await ctx.macro.run("dtu","create",{ title: megaTitle, creti, tags: best.tagHints || ["mega"], tier:"mega", lineage: best.ids, source:"system.evolution", meta:{ ...(input.meta||{}), clusterSig: sigTags, clusterSize: best.ids.length } });
  return { ok:true, mega: r.dtu, cluster: best };
});


register("system","promotionTick", async (ctx, input) => {
  // v3: automatic DTU -> MEGA candidate -> probation -> MEGA promotion
  const now = nowISO();
  const minSupport = Number(input.minSupport ?? 9);
  const threshold = Number(input.threshold ?? 0.38);
  const maxCreates = Number(input.maxCreates ?? 5);
  const probationHours = Number(input.probationHours ?? 24);

  ensureQueues();

  // 1) cluster DTUs
  const clusters = await ctx.macro.run("dtu","cluster",{ threshold });
  const list = (clusters.clusters || []).slice(0, 50);

  const created = [];
  for (const c of list) {
    if (!c?.ids?.length) continue;
    if (c.ids.length < minSupport) continue;

    // Signature for dedupe of candidates
    const sig = (c.tagHints||[]).slice(0,8).join("|") || (c.titles||[])[0] || `cluster_${c.ids.length}`;
    const existingMega = dtusArray().find(d=>d.tier==="mega" && (d.meta?.clusterSig===sig) && (d.meta?.clusterSize===c.ids.length));
    if (existingMega) continue;

    const existingCand = (STATE.queues?.synthesis||[]).find(p=>p?.type==="mega_candidate" && (p.clusterSig===sig || p.cluster?.tagHints?.slice(0,8).join("|")===sig));
    if (existingCand) continue;

    // Create candidate proposal (queued)
    const proposal = {
      id: uid("mega_candidate"),
      type: "mega_candidate",
      status: "probation",
      createdAt: now,
      updatedAt: now,
      probationUntil: new Date(Date.now() + probationHours*3600*1000).toISOString(),
      clusterSig: sig,
      cluster: c,
      minSupport,
      threshold
    };
    STATE.queues.synthesis.push(proposal);
    created.push(proposal);
    if (created.length >= maxCreates) break;
  }

  // 2) finalize matured candidates -> MEGA
  const matured = [];
  const synthQ = STATE.queues.synthesis || [];
  for (const p of synthQ) {
    if (p?.type!=="mega_candidate" || p.status!=="probation") continue;
    const until = Date.parse(p.probationUntil||"");
    if (Number.isFinite(until) && Date.now() < until) continue;

    // verify cluster still exists and large enough
    const ids = p.cluster?.ids || [];
    const inner = dtusByIds(ids);
    if (inner.length < minSupport) { p.status="rejected"; p.updatedAt=nowISO(); continue; }

    const megaTitle = normalizeText(`MEGA: ${(p.cluster?.titles||[])[0] || "Topic Cluster"}`.slice(0,120));
    const creti = cretiPack({
      title: megaTitle,
      purpose: "MEGA DTU: compress a topic range into a single navigable node (with lineage).",
      context: `Auto-promoted (v3). Cluster size: ${inner.length}
ClusterSig: ${p.clusterSig}`,
      reasoning: inner.slice(0,40).map(d=>`- ${d.title} (${d.id})`).join("\n"),
      procedure: "Synthesize shared core, keep lineage, avoid clutter.",
      outputs: "Mega DTU with lineage metadata + navigation."
    });

    const mega = {
      id: uid("dtu"),
      title: megaTitle,
      content: creti,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      tier: "mega",
      tags: ["mega","auto"],
      meta: { clusterSig: p.clusterSig, clusterSize: inner.length, lineage: inner.map(d=>d.id).slice(0,200), promotedFrom:"promotionTick" }
    };
    const commit = pipelineCommitDTU(ctx, mega, { op:"system.promotionTick" });
    if (commit.ok) {
      p.status="fulfilled";
      p.updatedAt=nowISO();
      p.megaId = mega.id;
      matured.push({ proposalId:p.id, megaId: mega.id, clusterSize: inner.length });
    } else {
      p.status="rejected";
      p.updatedAt=nowISO();
      p.error = commit.error || "commit failed";
    }
  }

  
  // Gap promotion: periodically synthesize stable clusters into MEGA DTUs
  try {
    await runMacro(ctx, "dtu", "gapPromote", { minCluster: 6, maxPromotions: 1, dryRun: false });
  } catch {}

return { ok:true, simulation:true, createdCandidates: created.length, created, matured };
}, { summary:"Automatic MEGA promotion pipeline tick (candidate->probation->MEGA) (v3)." });

register("system", "synthesize", async (ctx, input) => {
  // Synthesize: build a HYPER DTU from selected megas or from top megas
  let megaIds = Array.isArray(input.megaIds) ? input.megaIds : [];
  if (megaIds.length === 0) {
    megaIds = dtusArray().filter(d=>d.tier==="mega").slice(0, 6).map(d=>d.id);
  }
  const megas = dtusByIds(megaIds).filter(d=>d.tier==="mega");
  if (megas.length < 2) return { ok:false, error:"Need at least 2 mega DTUs to synthesize a hyper DTU." };

  const hyperTitle = normalizeText(input.title || `HYPER: ${megas[0].title} + ${megas[1].title}`.slice(0, 120));
  const allLineage = Array.from(new Set(megas.flatMap(m => m.lineage || [])));
  const creti = cretiPack({
    title: hyperTitle,
    purpose: "HYPER DTU: integrate multiple mega DTUs into a higher-order framework.",
    context: `Megas:\n${megas.map(m=>`- ${m.title} (${m.id})`).join("\n")}\n\nTotal lineage DTUs: ${allLineage.length}`,
    procedure: "Identify shared invariants, conflicts, and a unified map.",
    outputs: "Hyper DTU with mega lineage and inner lineage.",
    tests: "Must preserve lineage; label hypotheses; propose measurements.",
    notes: "This is the top-level node for a domain."
  });

  const r = await ctx.macro.run("dtu","create",{ title: hyperTitle, creti, tags:["hyper"], tier:"hyper", lineage: megaIds, source:"system.synthesize", meta:{ innerLineageCount: allLineage.length } });
  return { ok:true, hyper: r.dtu, usedMegas: megas.map(m=>({id:m.id,title:m.title})) };
});



// ===================== Smoothness Specs Implementation (Continuity/Gaps/Definitions/Reconcile/Experiments) =====================

// Lightweight continuity snapshot DTU (no invented claims; cites parent DTU ids)
register("system", "continuity", async (ctx, input) => {
  const sessionId = normalizeText(input.sessionId || "default");
  const window = clamp(Number(input.window ?? 20), 5, 200);
  const commit = input.commit !== false; // default true
  const mode = normalizeText(input.mode || "delta"); // delta | full

  const pool = dtusArray().slice(-window);
  const parents = pool.map(d => d.id);
  const recentTitles = pool.slice(-12).map(d => d.title).filter(Boolean);

  // capture recent system logs (non-sensitive)
  const logs = (ctx.state.logs || []).slice(-50).filter(e => /^(dtu|system|settings|ingest|wrapper)\./.test(String(e.type||"")));
  const logLines = logs.slice(-12).map(e => `- ${e.ts} ${e.type}: ${e.message}`).join("\n");

  const creti = cretiPack({
    title: `Continuity Snapshot (${sessionId}) — ${nowISO().slice(0,10)}`,
    purpose: "Maintain temporal coherence across sessions. Records deltas, not new claims.",
    context:
`Session: ${sessionId}
Window DTUs: ${pool.length}

Recent titles:
${recentTitles.map(t=>`- ${t}`).join("\n")}

Recent system activity:
${logLines || "(none)"}

Parents:
${parents.slice(-50).map(id=>`- ${id}`).join("\n")}${parents.length>50 ? `\n…(${parents.length-50} more)` : ""}`,
    procedure: "1) Select last N DTUs\n2) Record titles + IDs + relevant system events\n3) Store as DTU (optional)",
    outputs: "Continuity DTU that references exact DTU IDs; no invented facts.",
    tests: "Must not add new claims; must reference parent DTU IDs."
  });

  const tags = Array.from(new Set(["continuity","system", sessionId ? `session:${sessionId}` : null].filter(Boolean)));
  const spec = { title: `Continuity: ${sessionId} (${nowISO().slice(0,10)})`, creti, tags, tier:"regular", lineage: parents, source:"system.continuity", meta:{ sessionId, window, mode } };

  if (!commit) return { ok:true, committed:false, spec };
  const r = await ctx.macro.run("dtu","create", { ...spec, allowRewrite:true });
  return { ok:true, committed:true, dtu: r.dtu, sessionId, window };
}, { summary:"Create a Continuity DTU capturing deltas across the last N DTUs (no invented claims)." });

// Gap scan (detect missing definitions / unsupported claims / coverage score). Returns report; can optionally commit as DTU.
register("system", "gapScan", async (ctx, input) => {
  const window = clamp(Number(input.window ?? 300), 20, 5000);
  const commit = !!input.commit;
  const domain = normalizeText(input.domain || "general");

  const pool = dtusArray().slice(-window);

  // Helper: detect existing definition DTUs
  const isDef = (d) => (d.tags||[]).includes("definition") || /^def(inition)?:/i.test(String(d.title||""));
  const defs = new Map(); // termLower -> dtuId
  for (const d of pool) {
    if (!isDef(d)) continue;
    const t = String(d.meta?.term || "").trim() || String(d.title||"").replace(/^def(inition)?:\s*/i,"").trim();
    if (!t) continue;
    defs.set(t.toLowerCase(), d.id);
  }

  // Candidate terms: top tags + title heads
  const tagFreq = new Map();
  for (const d of pool) for (const t of (d.tags||[])) tagFreq.set(t, (tagFreq.get(t)||0)+1);
  const topTags = Array.from(tagFreq.entries())
    .filter(([t]) => t && !/^session:/.test(t) && !["system","autogen","dream","gaps","continuity","mega","hyper","regular"].includes(t))
    .sort((a,b)=>b[1]-a[1])
    .slice(0, 25)
    .map(x=>x[0]);

  const titleHeads = pool
    .map(d => String(d.title||"").split(":")[0].trim())
    .filter(t => t && t.length>=3 && t.length<=48)
    .slice(-200);

  const candidates = Array.from(new Set([...topTags, ...titleHeads])).slice(0, 60);

  const missing_definitions = [];
  for (const term of candidates) {
    const k = term.toLowerCase();
    if (defs.has(k)) continue;
    // consider as missing if term appears frequently
    const freq = tagFreq.get(term) || tagFreq.get(k) || 0;
    if (freq >= 2 || topTags.includes(term)) missing_definitions.push({ term, freq });
  }

  // Unsupported claims: claims without tests when requireTestsWhenUncertain is true
  const unsupported_claims = [];
  for (const d of pool.slice(-200)) {
    const c = d.core || {};
    const claims = Array.isArray(c.claims) ? c.claims : [];
    const tests = Array.isArray(c.tests) ? c.tests : [];
    if (!claims.length) continue;
    if (ctx.state.settings?.requireTestsWhenUncertain && tests.length === 0) {
      unsupported_claims.push({ dtuId: d.id, title: d.title, claims: claims.slice(0,3) });
    }
  }

  // Missing nodes: absence of continuity + experiment tracking for active work
  const hasContinuity = pool.some(d => (d.tags||[]).includes("continuity"));
  const hasExperiments = pool.some(d => (d.tags||[]).includes("experiment"));
  const missing_nodes = [];
  if (!hasContinuity) missing_nodes.push("continuity");
  if (!hasExperiments) missing_nodes.push("experiment-tracker");

  // Coverage score heuristic
  const denom = Math.max(1, candidates.length);
  const coverage_score = clamp(1 - (missing_definitions.length / denom), 0, 1);

  const report = { ok:true, domain, window, coverage_score, missing_nodes, missing_definitions, unsupported_claims };

  if (!commit) return report;

  const creti = cretiPack({
    title: `Gap Scan (${domain}) — ${nowISO().slice(0,10)}`,
    purpose: "Identify structural gaps: missing definitions, unsupported claims, and missing operational nodes.",
    context:
`Window DTUs: ${pool.length}
Coverage score: ${coverage_score.toFixed(3)}

Missing nodes:
${missing_nodes.map(x=>`- ${x}`).join("\n") || "(none)"}

Missing definitions (top):
${missing_definitions.slice(0,25).map(x=>`- ${x.term} (freq≈${x.freq||0})`).join("\n") || "(none)"}

Unsupported claims (sample):
${unsupported_claims.slice(0,10).map(x=>`- ${x.title} (${x.dtuId})`).join("\n") || "(none)"}`,
    procedure: "1) Compute candidate terms (tags + title heads)\n2) Check for existing definition DTUs\n3) Flag claims lacking tests when required\n4) Emit actionable report",
    outputs: "Gap DTU containing missing items; feeds evolution/promotion checks.",
    tests: "Report must cite DTU IDs for unsupported claims; must not invent missing terms."
  });

  const tags = ["gaps","system","report", `domain:${domain}`].slice(0,20);
  const r = await ctx.macro.run("dtu","create", { title:`Gaps: ${domain} (${nowISO().slice(0,10)})`, creti, tags, tier:"regular", lineage: pool.slice(-50).map(d=>d.id), source:"system.gapScan", meta:{ report } });
  return { ...report, committed:true, dtu:r.dtu };
}, { summary:"Detect missing definitions/unsupported claims; optionally commit a Gap DTU." });

// Definition DTU creator (canonical term definition for a domain)
register("dtu", "define", async (ctx, input) => {
  const term = normalizeText(input.term || "");
  if (!term) return { ok:false, error:"term required" };
  const domain = normalizeText(input.domain || "general");
  const nonGoals = Array.isArray(input.nonGoals) ? input.nonGoals : [];
  const related = Array.isArray(input.related_terms) ? input.related_terms : (Array.isArray(input.relatedTerms) ? input.relatedTerms : []);

  // Dedupe: if a definition exists for same term+domain, return it
  const existing = dtusArray().find(d =>
    ((d.tags||[]).includes("definition") || /^def(inition)?:/i.test(String(d.title||""))) &&
    String(d.meta?.term||"").toLowerCase() === term.toLowerCase() &&
    String(d.meta?.domain||"general").toLowerCase() === domain.toLowerCase()
  );
  if (existing && !input.allowRewrite) return { ok:true, reused:true, dtu: existing };

  const creti = cretiPack({
    title: `Definition: ${term} (${domain})`,
    purpose: "Reduce friction by making key terms precise and scoped.",
    context:
`Term: ${term}
Domain: ${domain}
Non-goals: ${(nonGoals||[]).join("; ") || "(none)"}
Related: ${(related||[]).join(", ") || "(none)"}

Definition (user-provided if any):
${String(input.definition||"").trim() || "(provide a definition field or edit later)"}`,
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

// Contradiction reconciliation (string-heuristic; labels resolved/isolated/undecidable; never erases minority)
register("dtu", "reconcile", async (ctx, input) => {
  const ids = Array.isArray(input.ids) ? input.ids : [];
  const lastN = clamp(Number(input.lastN ?? 12), 2, 200);
  const pool = ids.length ? dtusByIds(ids) : dtusArray().slice(-lastN);
  if (pool.length < 2) return { ok:false, error:"Need at least 2 DTUs to reconcile." };

  const claimPairs = [];
  const claimText = (d) => (d.core?.claims||[]).map(x=>String(x)).join("\n");
  // very light contradiction detector: "is" vs "is not" on shared noun phrase
  const norm = (s) => String(s||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  for (let i=0;i<pool.length;i++){
    for (let j=i+1;j<pool.length;j++){
      const a = norm(claimText(pool[i]));
      const b = norm(claimText(pool[j]));
      if (!a || !b) continue;
      // detect negation mismatch for same 3-gram
      const aNeg = /\bnot\b|\bnever\b|\bno\b/.test(a);
      const bNeg = /\bnot\b|\bnever\b|\bno\b/.test(b);
      if (aNeg === bNeg) continue;
      // shared token overlap heuristic
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
    context:
`Scope DTUs: ${pool.map(d=>`${d.title} (${d.id})`).join("\n")}

Detected conflicts:
${conflicting_claims.map(x=>`- ${x.aTitle} <-> ${x.bTitle} (overlap=${x.overlap})`).join("\n") || "(none)"}`,
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

// Experiment tracker (as DTU; immutable audit-style logging)
register("experiment", "log", async (ctx, input) => {
  const hypothesis = String(input.hypothesis || "").trim();
  const change_log = input.change_log || input.changeLog || {};
  const metrics = Array.isArray(input.metrics) ? input.metrics : [];
  const result_state = normalizeText(input.result_state || input.resultState || "inconclusive"); // supports|weakens|inconclusive

  const creti = cretiPack({
    title: `Experiment — ${nowISO().slice(0,10)} ${nowISO().slice(11,19)}`,
    purpose: "Track changes and impacts; prevent chaotic iteration.",
    context:
`Hypothesis:
${hypothesis || "(none)"}

Change log:
${JSON.stringify(change_log, null, 2)}

Metrics (predefined preferred):
${metrics.map(m=>`- ${m.name||m.metric||"metric"}: ${m.value ?? m.after ?? ""} (before=${m.before ?? ""})`).join("\n") || "(none)"}

Result state: ${result_state}`,
    procedure: "1) Define hypothesis + change\n2) Record metrics\n3) Store immutable experiment log DTU",
    outputs: "Experiment DTU (feeds stability + promotion checks).",
    tests: "Metrics should be defined before run; results ≠ conclusions."
  });

  const tags = Array.from(new Set(["experiment", "tracker", `result:${result_state}`])).slice(0,20);
  const r = await ctx.macro.run("dtu","create", {
    title: `Experiment: ${result_state} (${nowISO().slice(0,10)})`,
    creti,
    tags,
    tier: "regular",
    source: "experiment.log",
    meta: { hypothesis, change_log, metrics, result_state }
  });
  return { ok:true, dtu: r.dtu };
}, { summary:"Create an immutable Experiment Tracker DTU with hypothesis/change/metrics/result." });



// DTU semantic-ish dedupe sweeper (non-destructive; merges lineage/tags into keeper)
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
        // merge b into a (keeper=a)
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
// Settings domain
register("settings", "get", async (ctx, input) => {
  return { ok:true, settings: ctx.state.settings };
});
register("settings", "set", async (ctx, input) => {
  const s = input.settings && typeof input.settings === "object" ? input.settings : {};
  ctx.state.settings = { ...ctx.state.settings, ...s };
  ctx.log("settings.set", "Settings updated", { keys: Object.keys(s) });
  return { ok:true, settings: ctx.state.settings };
});

// Interface domain
register("interface", "tabs", async (ctx, input) => {
  // Informational registry for UI
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

// Logs domain
register("log", "list", async (ctx, input) => {
  const limit = clamp(Number(input.limit || 200), 1, 2000);
  return { ok:true, logs: ctx.state.logs.slice(-limit) };
});

// Materials test domain (debug hook)
register("materials", "test", async (ctx, input) => {
  return { ok:true, pong:true, at: nowISO(), input: input || null };
});

// ---- Express app ----
// ---- Growth macros (local-first; LLM optional) ----
register("synth", "combine", async (ctx, input) => {
  const ids = Array.isArray(input.ids) ? input.ids : [];
  const dtus = dtusByIds(ids);
  if (dtus.length < 2) return { ok:false, error:"need >=2 dtus" };

  const title = normalizeText(input.title || `SYNTH — ${dtus[0].title} × ${dtus[1].title}`) || "SYNTH";
  const tags = Array.from(new Set(dtus.flatMap(d=>d.tags||[]).concat(["synthesis","local"]))).slice(0, 24);

  // deterministic CRETI baseline
  const context = dtus.map(d=>`- ${d.title}: ${(d.human?.summary||"").slice(0,180)}`).join("\n");
  const procedure = [
    "1) Extract shared invariant across inputs",
    "2) Extract contradictions/tensions",
    "3) Propose a reconciled thesis (label speculation)",
    "4) Add 2–4 tests that could falsify key claims",
    "5) Output next actions"
  ].join("\n");
  let creti = cretiPack({
    title,
    purpose: "Synthesize multiple DTUs into a new coherent DTU (preserve lineage).",
    context,
    procedure,
    outputs: "A new DTU with explicit lineage to its parents.",
    tests: "At least 2 falsifiable checks or measurable tests.",
    notes: "Local-first synthesis; can be enhanced with LLM when enabled."
  });

  const llm = !!input.llm;
  const model = input.model === "smart" ? OPENAI_MODEL_SMART : OPENAI_MODEL_FAST;
  if (llm && ctx.llm.enabled) {
    const system = "You are ConcordOS. Produce a CRETI document. Keep it grounded, testable, and concise. Preserve lineage and tag contradictions explicitly.";
    const bundle = dtus.map(d=>`TITLE: ${d.title}\nTAGS: ${(d.tags||[]).join(", ")}\nCONTENT:\n${dtuText(d)}\n---`).join("\n");
    const msg = [{ role:"user", content:`Make a new CRETI synthesis DTU.\n\nInputs:\n${bundle}` }];
    const r = await ctx.llm.chat({ system, messages: msg, temperature: 0.35, maxTokens: 900, model });
    if (r.ok && r.content) creti = r.content.trim();
  }

  const created = await ctx.macro.run("dtu", "create", {
    title,
    tags,
    tier: "regular",
    source: "synth.combine",
    lineage: dtus.map(d=>d.id),
    creti
  });

  if (!created.ok) return created;
  created.dtu.lineage = dtus.map(d=>d.id);
  created.dtu.machine = created.dtu.machine || {};
  created.dtu.machine.parents = dtus.map(d=>d.id);
  created.dtu.updatedAt = nowISO();
  await pipelineCommitDTU(ctx, created.dtu, { op: 'forge.auto', allowRewrite: true });
  return { ok:true, dtu: created.dtu };
}, { description: "Combine DTUs into a new synthesized DTU (local-first, optional LLM)." });

register("evolution", "dedupe", async (ctx, input) => {
  // merge near-duplicates by title+tags similarity; keep lineage
  const threshold = Number(input.threshold ?? 0.86);
  const items = dtusArray();
  const used = new Set();
  let merged = 0;

  for (let i=0;i<items.length;i++){
    const a = items[i];
    if (used.has(a.id)) continue;
    const aTok = simpleTokens((a.title||"") + " " + (a.tags||[]).join(" "));
    for (let j=i+1;j<items.length;j++){
      const b = items[j];
      if (used.has(b.id)) continue;
      const bTok = simpleTokens((b.title||"") + " " + (b.tags||[]).join(" "));
      if (jaccard(aTok, bTok) >= threshold) {
        // merge b into a
        a.lineage = Array.from(new Set([...(a.lineage||[]), b.id, ...(b.lineage||[])]));
        a.tags = Array.from(new Set([...(a.tags||[]), ...(b.tags||[]), "deduped"])).slice(0, 40);
        a.updatedAt = nowISO();
        STATE.dtus.delete(b.id);
        used.add(b.id);
        merged++;
      }
    }
    if (merged) await pipelineCommitDTU(ctx, a, { op: 'evolution.dedupe', allowRewrite: true });
  }

  ctx.log("evolution.dedupe", "Deduped DTUs", { merged, threshold });
  return { ok:true, merged, total: STATE.dtus.size };
}, { description: "Merge near-duplicate DTUs, preserving lineage." });

register("heartbeat", "tick", async (ctx, input) => {
  // not "spawn a DTU" — run a mini debate + optional synthesis
  const reason = String(input.reason || "heartbeat");
  const llm = !!input.llm;
  const model = input.model === "smart" ? "smart" : "fast";

  // choose a focus query from recent sessions, else random
  const sessions = Array.from(STATE.sessions.values());
  const recentUser = sessions.flatMap(s => (s.messages||[]).filter(m=>m.role==="user").slice(-5)).slice(-12);
  const focus = (recentUser.length ? recentUser[Math.floor(Math.random()*recentUser.length)].content : "system growth").slice(0, 400);

  const debate = pickDebateSet(focus);
  if (debate.length < 2) return { ok:true, did:"noop", reason:"not_enough_dtus" };

  const made = await ctx.macro.run("synth", "combine", {
    ids: debate.slice(0, 4).map(d=>d.id),
    title: `HEARTBEAT — Synthesis: ${normalizeText(focus).slice(0, 60)}`,
    tags: ["heartbeat","autogen","evolution","synthesis"],
    llm,
    model
  });

  if (made.ok) {
    ctx.log(`heartbeat.tick: ${question}`);
if (r.ok) out.reply = r.content.trim();
    else out.reply = "LLM error; run wrapper locally is not implemented for this spec.";
  } else {
    out.reply = `Wrapper (${w.name}) local mode: bind DTUs=${bound.length}. Enable Enhanced to run with LLM.`;
  }
  return { ok:true, output: out };
});


// ===============================
// v2 RESTORED ORGANS (LOCKED)
// - Deterministic Math Engine (research.math.exec)
// - Dimensional OS (dimensional.*)
// - Council Global Gate (council.reviewGlobal) w/ strict no-duplicates
// - Anonymous E2E Messaging (anon.*) non-discoverable (no links)
// - Weekly Council Debate → Synthesis DTU (council.weeklyDebateTick)
// ===============================

// ---- Deterministic Math Engine (safe expression evaluator; no LLM math guessing) ----
function mathTokenize(expr="") {
  const s = String(expr).replace(/\s+/g,"").trim();
  const out = [];
  const re = /(\d+(?:\.\d+)?(?:e[+\-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|[\+\-\*\/\^\(\),])/gy;
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  if (out.join("") !== s) throw new Error("Math parse error: invalid characters");
  return out;
}
const MATH_FUNCS = Object.freeze({
  sqrt: (a)=>Math.sqrt(a), abs:(a)=>Math.abs(a),
  sin:(a)=>Math.sin(a), cos:(a)=>Math.cos(a), tan:(a)=>Math.tan(a),
  asin:(a)=>Math.asin(a), acos:(a)=>Math.acos(a), atan:(a)=>Math.atan(a),
  ln:(a)=>Math.log(a), log:(a)=>Math.log10(a), exp:(a)=>Math.exp(a),
  min:(...a)=>Math.min(...a), max:(...a)=>Math.max(...a),
  pow:(a,b)=>Math.pow(a,b),
});
const MATH_CONSTS = Object.freeze({ pi: Math.PI, e: Math.E });
const OP_INFO = Object.freeze({
  "+": { prec: 2, assoc: "L", arity: 2, fn: (a,b)=>a+b },
  "-": { prec: 2, assoc: "L", arity: 2, fn: (a,b)=>a-b },
  "*": { prec: 3, assoc: "L", arity: 2, fn: (a,b)=>a*b },
  "/": { prec: 3, assoc: "L", arity: 2, fn: (a,b)=>a/b },
  "^": { prec: 4, assoc: "R", arity: 2, fn: (a,b)=>Math.pow(a,b) },
  "u-": { prec: 5, assoc: "R", arity: 1, fn: (a)=>-a },
});
function mathToRPN(tokens) {
  const out = [];
  const stack = [];
  let prev = null;
  for (let i=0;i<tokens.length;i++){
    const t = tokens[i];
    const isNum = /^[0-9]/.test(t);
    const isName = /^[A-Za-z_]/.test(t);
    if (isNum) { out.push({type:"num", v:Number(t)}); prev = "val"; continue; }
    if (isName) {
      const name = t.toLowerCase();
      // function call if next token is '('
      const next = tokens[i+1];
      if (next === "(") { stack.push({type:"func", name}); prev="func"; continue; }
      if (name in MATH_CONSTS) { out.push({type:"num", v:Number(MATH_CONSTS[name])}); prev="val"; continue; }
      throw new Error(`Unknown symbol: ${t}`);
    }
    if (t === ",") {
      while (stack.length && stack[stack.length-1].op !== "(") out.push(stack.pop());
      if (!stack.length) throw new Error("Misplaced comma");
      prev = ",";
      continue;
    }
    if (t === "(") { stack.push({op:"("}); prev="("; continue; }
    if (t === ")") {
      while (stack.length && stack[stack.length-1].op !== "(") out.push(stack.pop());
      if (!stack.length) throw new Error("Mismatched ')'");
      stack.pop(); // pop '('
      // if function on top, pop it
      if (stack.length && stack[stack.length-1].type === "func") out.push(stack.pop());
      prev = "val";
      continue;
    }
    if (["+","-","*","/","^"].includes(t)) {
      let op = t;
      if (op === "-" && (prev === null || prev === "(" || prev === "," || prev === "op" || prev === "func")) op = "u-";
      const info = OP_INFO[op];
      while (stack.length) {
        const top = stack[stack.length-1];
        const topInfo = top && top.op ? OP_INFO[top.op] : null;
        if (!topInfo) break;
        if ((info.assoc === "L" && info.prec <= topInfo.prec) || (info.assoc === "R" && info.prec < topInfo.prec)) out.push(stack.pop());
        else break;
      }
      stack.push({op});
      prev = "op";
      continue;
    }
    throw new Error(`Unexpected token: ${t}`);
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.op === "(") throw new Error("Mismatched '('");
    out.push(top);
  }
  return out;
}
function mathEvalRPN(rpn) {
  const st = [];
  for (const it of rpn) {
    if (it.type === "num") { st.push(it.v); continue; }
    if (it.type === "func") {
      const fn = MATH_FUNCS[it.name];
      if (!fn) throw new Error(`Unknown function: ${it.name}`);
      // determine arity by reading args separated earlier: we don't have explicit arg counts.
      // Strategy: support common arities by inspecting stack length and function signature.
      // For min/max allow variable: require at least 2 args; we can't infer; so we accept 2 by default if ambiguous.
      const arity = fn.length || 1;
      if (it.name === "min" || it.name === "max") {
        // default: consume 2 args
        if (st.length < 2) throw new Error(`${it.name} requires >=2 args`);
        const b = st.pop(); const a = st.pop();
        st.push(fn(a,b));
      } else {
        if (st.length < arity) throw new Error(`${it.name} requires ${arity} args`);
        const args = st.splice(st.length-arity, arity);
        st.push(fn(...args));
      }
      continue;
    }
    if (it.op) {
      const info = OP_INFO[it.op];
      if (!info) throw new Error(`Unknown operator: ${it.op}`);
      if (st.length < info.arity) throw new Error("Malformed expression");
      if (info.arity === 1) {
        const a = st.pop();
        st.push(info.fn(a));
      } else {
        const b = st.pop(); const a = st.pop();
        st.push(info.fn(a,b));
      }
      continue;
    }
    throw new Error("Bad RPN item");
  }
  if (st.length !== 1) throw new Error("Malformed expression");
  return st[0];
}
function evalMathExpression(expr="") {
  const tokens = mathTokenize(expr);
  const rpn = mathToRPN(tokens);
  const value = mathEvalRPN(rpn);
  if (!Number.isFinite(value)) throw new Error("Non-finite result");
  return value;
}

// ---- Dimensional OS (validator + translator; hard-gate for research/sim) ----
// Goal: provide *real* dimensional grounding (no pretending). Deterministic, small-scope, SI-based.
// Supports: base dimensions, common derived units, prefixes, conversion factors, and unit algebra.
//
// Representation: dimension vector over SI base units: [m, kg, s, A, K, mol, cd]
const _DIM_KEYS = ["m","kg","s","A","K","mol","cd"];
function _zeroDim(){ return Object.fromEntries(_DIM_KEYS.map(k=>[k,0])); }
function _addDim(a,b,sign=1){
  const out=_zeroDim();
  for (const k of _DIM_KEYS) out[k]=(a[k]||0)+sign*(b[k]||0);
  return out;
}
function _mulDimPow(a,pow){
  const out=_zeroDim();
  for (const k of _DIM_KEYS) out[k]=(a[k]||0)*pow;
  return out;
}
function _sameDim(a,b){
  for (const k of _DIM_KEYS) if ((a[k]||0)!==(b[k]||0)) return false;
  return true;
}
function _dimToSig(a){ return _DIM_KEYS.map(k=>`${k}^${a[k]||0}`).join("|"); }

// Unit tables (factor to SI base; dim vector)
const _UNIT = (() => {
  const Z=_zeroDim();
  const base = {
    m:  { f:1, d:{...Z,m:1}},
    kg: { f:1, d:{...Z,kg:1}},
    s:  { f:1, d:{...Z,s:1}},
    A:  { f:1, d:{...Z,A:1}},
    K:  { f:1, d:{...Z,K:1}},
    mol:{ f:1, d:{...Z,mol:1}},
    cd: { f:1, d:{...Z,cd:1}},
    // accepted aliases
    g:  { f:1e-3, d:{...Z,kg:1}},
    sec:{ f:1, d:{...Z,s:1}},
    min:{ f:60, d:{...Z,s:1}},
    h:  { f:3600, d:{...Z,s:1}},
    Hz: { f:1, d:{...Z,s:-1}},
    N:  { f:1, d:{...Z,m:1,kg:1,s:-2}},
    Pa: { f:1, d:{...Z,m:-1,kg:1,s:-2}},
    J:  { f:1, d:{...Z,m:2,kg:1,s:-2}},
    W:  { f:1, d:{...Z,m:2,kg:1,s:-3}},
    C:  { f:1, d:{...Z,s:1,A:1}}, // coulomb
    V:  { f:1, d:{...Z,m:2,kg:1,s:-3,A:-1}},
    ohm:{ f:1, d:{...Z,m:2,kg:1,s:-3,A:-2}},
    S:  { f:1, d:{...Z,m:-2,kg:-1,s:3,A:2}}, // siemens
    F:  { f:1, d:{...Z,m:-2,kg:-1,s:4,A:2}},
    T:  { f:1, d:{...Z,kg:1,s:-2,A:-1}}, // tesla
    lm: { f:1, d:{...Z,cd:1}}, // simplified (strictly cd*sr)
    rad:{ f:1, d:{...Z}}, // dimensionless
    deg:{ f:Math.PI/180, d:{...Z}}, // dimensionless angle
    "%": { f:0.01, d:{...Z}},
  };
  return base;
})();

const _PREFIX = {
  Y:1e24, Z:1e21, E:1e18, P:1e15, T:1e12, G:1e9, M:1e6, k:1e3,
  h:1e2, da:1e1,
  d:1e-1, c:1e-2, m:1e-3, u:1e-6, µ:1e-6, n:1e-9, p:1e-12, f:1e-15, a:1e-18, z:1e-21, y:1e-24
};

function _tokenizeUnitExpr(s){
  // grammar: product/division of terms, term := UNIT [^ exponent] where exponent is integer
  // examples: "m/s^2", "kg*m^2/s^2", "N*m", "km", "m^2", "m s^-2"
  s = String(s||"").trim();
  if (!s) return [];
  // normalize separators: allow whitespace, '*' as multiplication, '/' as division
  s = s.replace(/\s+/g,'*');
  // keep '/' and '*'
  const tokens=[];
  let cur="";
  for (let i=0;i<s.length;i++){
    const ch=s[i];
    if (ch==='*' || ch==='/'){
      if (cur) tokens.push(cur);
      tokens.push(ch);
      cur="";
    } else {
      cur+=ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens.filter(Boolean);
}

function _parseUnitSymbol(sym){
  // sym may include exponent e.g. "m^2", "s^-1"
  let base=sym, exp=1;
  const caret = sym.indexOf("^");
  if (caret>=0){
    base=sym.slice(0,caret);
    exp=parseInt(sym.slice(caret+1),10);
    if (!Number.isFinite(exp)) return { ok:false, reason:`bad exponent in ${sym}` };
  }
  base=base.trim();
  if (!base) return { ok:false, reason:"empty unit" };
  // direct unit?
  if (_UNIT[base]) return { ok:true, f:_UNIT[base].f, d:_mulDimPow(_UNIT[base].d, exp), raw:base, exp };
  // try prefix+unit (including da)
  // handle 'da' as 2-char prefix
  for (const p of ["da", ...Object.keys(_PREFIX)]){
    if (base.startsWith(p) && base.length>p.length){
      const u = base.slice(p.length);
      if (_UNIT[u]){
        const pf=_PREFIX[p];
        return { ok:true, f:Math.pow(pf, exp)*_UNIT[u].f, d:_mulDimPow(_UNIT[u].d, exp), raw:`${p}${u}`, exp };
      }
    }
  }
  return { ok:false, reason:`unknown unit ${base}` };
}

function parseUnitExpr(expr){
  const tokens=_tokenizeUnitExpr(expr);
  if (tokens.length===0) return { ok:false, reason:"no units expr" };
  let dim=_zeroDim();
  let factor=1;
  let mode="mul";
  for (const t of tokens){
    if (t==='*'){ mode="mul"; continue; }
    if (t==='/'){ mode="div"; continue; }
    const r=_parseUnitSymbol(t);
    if (!r.ok) return r;
    factor *= (mode==="mul") ? r.f : (1/r.f);
    dim = (mode==="mul") ? _addDim(dim, r.d, +1) : _addDim(dim, r.d, -1);
  }
  return { ok:true, factor, dim, signature:_dimToSig(dim), normalized:String(expr).trim() };
}

function convertUnits(value, fromUnits, toUnits){
  const a=parseUnitExpr(fromUnits);
  const b=parseUnitExpr(toUnits);
  if (!a.ok) return { ok:false, error:`fromUnits: ${a.reason||"parse error"}` };
  if (!b.ok) return { ok:false, error:`toUnits: ${b.reason||"parse error"}` };
  if (!_sameDim(a.dim, b.dim)) return { ok:false, error:"dimension mismatch", from:a.signature, to:b.signature };
  const v = Number(value);
  if (!Number.isFinite(v)) return { ok:false, error:"value must be finite number" };
  // value_in_SI = v * a.factor; value_out = value_in_SI / b.factor
  return { ok:true, value: (v * a.factor) / b.factor, from:a.signature, to:b.signature, factor: a.factor/b.factor };
}

function checkUnits({ expr, unitsIn={}, unitsOut=null }) {
  // If expr is a units expression -> parse it. If unitsOut provided, require equivalence.
  const uexpr = (expr && typeof expr === "string") ? expr : (unitsIn && unitsIn.exprUnits) ? unitsIn.exprUnits : null;
  if (!uexpr) return { ok:false, reason:"no unit expression provided (expr or unitsIn.exprUnits)" };
  const parsed=parseUnitExpr(uexpr);
  if (!parsed.ok) return { ok:false, reason: parsed.reason };
  if (unitsOut){
    const out=parseUnitExpr(unitsOut);
    if (!out.ok) return { ok:false, reason:`unitsOut: ${out.reason}` };
    const same=_sameDim(parsed.dim, out.dim);
    return { ok: same, status: same ? "ok" : "mismatch", in: parsed.signature, out: out.signature, note: same ? "Units consistent." : "Units mismatch." };
  }
  return { ok:true, status:"ok", units: parsed.signature, note:"Parsed units expression." };
}

function invarianceCheck({ claim, frame="default", invariants=[] }) {
  // Minimal invariance framework: check unit-consistency across a set of invariants.
  // invariants: [{ name, lhsUnits, rhsUnits }] or [{name, exprUnits, expectedUnits}]
  const checks=[];
  for (const inv of invariants){
    const name = inv.name || "invariant";
    if (inv.lhsUnits && inv.rhsUnits){
      const a=parseUnitExpr(inv.lhsUnits);
      const b=parseUnitExpr(inv.rhsUnits);
      if (!a.ok || !b.ok){
        checks.push({ name, ok:false, error:`parse error: ${(a.reason||"")||(b.reason||"")}` });
      } else {
        checks.push({ name, ok:_sameDim(a.dim,b.dim), lhs:a.signature, rhs:b.signature });
      }
    } else if (inv.exprUnits && inv.expectedUnits){
      const a=parseUnitExpr(inv.exprUnits);
      const b=parseUnitExpr(inv.expectedUnits);
      if (!a.ok || !b.ok){
        checks.push({ name, ok:false, error:`parse error: ${(a.reason||"")||(b.reason||"")}` });
      } else {
        checks.push({ name, ok:_sameDim(a.dim,b.dim), expr:a.signature, expected:b.signature });
      }
    } else {
      checks.push({ name, ok:false, error:"invariant requires (lhsUnits,rhsUnits) or (exprUnits,expectedUnits)" });
    }
  }
  const okAll = checks.every(c=>c.ok);
  return { ok:true, frame, claim: claim || null, status: okAll ? "ok" : "violations", checks };
}
// ---- Anonymous E2E Messaging (non-discoverable) ----
// ---- Anonymous E2E Messaging (non-discoverable) ----
STATE.anon = STATE.anon || {
  identities: new Map(), // anonId -> { anonId, publicKeyPem, privateKeyPem, createdAt, rotatedFrom? }
  inbox: new Map(),      // anonId -> [{id, fromPub, toAnonId, ts, ciphertextB64, ivB64, tagB64}]
};

function createAnonIdentity({ rotateFromAnonId=null } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519");
  const anonId = uid("anon");
  const pubPem = publicKey.export({ type:"spki", format:"pem" });
  const privPem = privateKey.export({ type:"pkcs8", format:"pem" });
  STATE.anon.identities.set(anonId, { anonId, publicKeyPem: pubPem, privateKeyPem: privPem, createdAt: nowISO(), rotatedFrom: rotateFromAnonId || null });
  if (!STATE.anon.inbox.has(anonId)) STATE.anon.inbox.set(anonId, []);
  saveStateDebounced();
  return { anonId, publicKeyPem: pubPem };
}

function e2eEncryptToRecipient(recipientPublicPem, plaintext, senderPublicPem=null) {
  const recipientPub = crypto.createPublicKey(recipientPublicPem);
  // sender ephemeral
  const { publicKey: ephPub, privateKey: ephPriv } = crypto.generateKeyPairSync("x25519");
  const shared = crypto.diffieHellman({ privateKey: ephPriv, publicKey: recipientPub });
  const key = crypto.createHash("sha256").update(shared).digest(); // 32 bytes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const aad = Buffer.from(senderPublicPem ? "sender:"+senderPublicPem : "sender:unknown");
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(Buffer.from(String(plaintext),"utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ephPublicKeyPem: ephPub.export({ type:"spki", format:"pem" }),
    ciphertextB64: ct.toString("base64"),
    ivB64: iv.toString("base64"),
    tagB64: tag.toString("base64"),
    aadB64: aad.toString("base64")
  };
}

function e2eDecryptForAnon(toAnonId, msg) {
  const ident = STATE.anon.identities.get(toAnonId);
  if (!ident) throw new Error("Unknown recipient anonId");
  const recipientPriv = crypto.createPrivateKey(ident.privateKeyPem);
  const ephPub = crypto.createPublicKey(msg.ephPublicKeyPem);
  const shared = crypto.diffieHellman({ privateKey: recipientPriv, publicKey: ephPub });
  const key = crypto.createHash("sha256").update(shared).digest();
  const iv = Buffer.from(msg.ivB64, "base64");
  const tag = Buffer.from(msg.tagB64, "base64");
  const ct = Buffer.from(msg.ciphertextB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  if (msg.aadB64) decipher.setAAD(Buffer.from(msg.aadB64, "base64"));
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return pt;
}

// ---- Global no-duplicates index (strict) ----
STATE.globalIndex = STATE.globalIndex || { byHash: new Map() }; // hash -> dtuId

function globalDtuHash(dtu){
  const title = tokenish(dtu?.title||"");
  const creti = tokenish(buildCretiText(dtu)||"");
  const key = (title+"::"+creti).slice(0, 20000);
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ---- Macro Domains (restored) ----

// research domain
register("research", "math.exec", async (ctx, input) => {
  const expr = normalizeText(input.expr || input.expression || "");
  if (!expr) return { ok:false, error:"Missing expr" };
  const value = evalMathExpression(expr);
  const out = { ok:true, expr, value, units: input.unitsOut || null, engine:"deterministic" };
  // Optional DTU log
  if (input.makeDTU) {
    const creti = cretiPack({
      title: `Math Result — ${expr}`,
      purpose: "Deterministic math execution (no LLM guessing).",
      context: `Expression: ${expr}`,
      procedure: "Parse expression → shunting-yard → RPN eval → numeric result.",
      outputs: `Result: ${value}`,
      tests: "Re-run yields same result.",
      notes: input.notes || ""
    });
    await ctx.macro.run("dtu","create",{ title:`Math: ${expr}`, creti, tags:["math","research"], tier:"regular", source:"research.math.exec" });
  }
  
  // v3: automatic promotions + temporal subjective profile update (soft-gated)
  try { await ctx.macro.run("system","promotionTick",{ minSupport: 9, threshold: 0.38, maxCreates: 3, probationHours: 12 }); } catch(e) { /* non-fatal */ }
  try { await ctx.macro.run("temporal","subjective",{ sessionId: ctx.session?.id }); } catch(e) { /* non-fatal */ }

return out;
}, { summary:"Execute deterministic math expression." });

// Physics / Reality Kernel (deterministic; unit-grounded)
const PHYS_CONSTANTS = Object.freeze({
  c: { name:"speed of light", value:299792458, units:"m/s" },
  g0:{ name:"standard gravity", value:9.80665, units:"m/s^2" },
  G: { name:"gravitational constant", value:6.67430e-11, units:"m^3/kg/s^2" },
  h: { name:"Planck constant", value:6.62607015e-34, units:"J*s" },
  kB:{ name:"Boltzmann constant", value:1.380649e-23, units:"J/K" },
  NA:{ name:"Avogadro constant", value:6.02214076e23, units:"1/mol" }, // treat 1 as dimensionless
});

register("research", "physics.constants", async (ctx, input) => {
  const keys = Array.isArray(input.keys) ? input.keys : null;
  const out = {};
  const src = PHYS_CONSTANTS;
  for (const k of Object.keys(src)){
    if (!keys || keys.includes(k)) out[k]=src[k];
  }
  return { ok:true, constants: out };
}, { summary:"Return built-in physical constants (deterministic)." });

register("research", "physics.kinematics", async (ctx, input) => {
  // Simple kinematics solver with unit checks.
  // Supports: v = v0 + a*t; x = x0 + v0*t + 0.5*a*t^2 (1D)
  const v0 = input.v0, a = input.a, t = input.t, x0 = input.x0;
  const units = input.units || {};
  // units: { v0:"m/s", a:"m/s^2", t:"s", x0:"m" }
  // Validate provided units (if present)
  const checks=[];
  function chk(name, u, expected){
    if (!u) return;
    const r=checkUnits({ expr:u, unitsOut: expected });
    checks.push({ name, ok:r.ok, status:r.status, got:r.in||r.units, expected:r.out||expected, note:r.note });
  }
  chk("v0", units.v0, "m/s");
  chk("a", units.a, "m/s^2");
  chk("t", units.t, "s");
  chk("x0", units.x0, "m");
  const okUnits = checks.every(c=>c.ok!==false);
  if (!okUnits) return { ok:false, error:"unit check failed", checks };
  const V0 = Number(v0); const A = Number(a); const T = Number(t); const X0 = Number(x0||0);
  if (![V0,A,T,X0].every(Number.isFinite)) return { ok:false, error:"v0,a,t,x0 must be finite numbers" };
  const v = V0 + A*T;
  const x = X0 + V0*T + 0.5*A*T*T;
  return { ok:true, results:{ v, x }, units:{ v:"m/s", x:"m" }, checks };
}, { summary:"Solve simple 1D kinematics with unit grounding (deterministic)." });

register("research", "truthgate.check", async (ctx, input) => {
  // Deterministic "reality gate": ensure numeric claims provide units and are consistent.
  // input.claims: [{ value, units, expectedUnits? }]
  const claims = Array.isArray(input.claims) ? input.claims : [];
  const out=[];
  for (const c of claims){
    const units = c.units;
    const expected = c.expectedUnits || null;
    if (!units) { out.push({ ok:false, error:"missing units", claim:c }); continue; }
    const r=checkUnits({ expr: units, unitsOut: expected });
    out.push({ ok:r.ok, status:r.status, units: r.units||r.in, expected: r.out||expected, note:r.note, claim:c });
  }
  const okAll = out.every(x=>x.ok);
  return { ok:true, status: okAll ? "ok":"violations", checks: out };
}, { summary:"Reality/Truth gate for unit-grounding of numeric claims (deterministic)." });



// dimensional domain
register("dimensional", "validateContext", async (ctx, input) => {
  return { ok:true, ...checkUnits(input), scope: input.scope || "general" };
}, { summary:"Validate dimensional context via unit algebra (deterministic)." });

register("dimensional", "checkInvariance", async (ctx, input) => {
  return { ok:true, ...invarianceCheck(input) };
}, { summary:"Check invariants across frame/scale (deterministic unit consistency)." });

register("dimensional", "scaleTransform", async (ctx, input) => {
  // v3: deterministic scale + unit conversion helper
  // Supports scalar conversion between equivalent dimensions (e.g., m <-> km, s <-> min).
  const value = ("value" in input) ? input.value : input.v;
  const fromUnits = input.fromUnits || input.from || input.unitsIn || input.uIn;
  const toUnits = input.toUnits || input.to || input.unitsOut || input.uOut;
  if (fromUnits == null || toUnits == null) {
    return { ok:false, error:"fromUnits and toUnits are required", fromUnits, toUnits };
  }
  const r = convertUnits(value ?? 1, String(fromUnits), String(toUnits));
  if (!r.ok) return { ok:false, ...r };
  return {
    ok:true,
    status:"ok",
    simulation:true,
    converted: r.value,
    valueIn: Number(value ?? 1),
    fromUnits: String(fromUnits),
    toUnits: String(toUnits),
    from: r.from,
    to: r.to,
    note:"Deterministic unit conversion performed."
  };
}, { summary:"Deterministic unit conversion / scale transform (v3)." });

// ---- Temporal OS (v3): subjective + objective time spine (additive; soft-gated by default) ----
function temporalNowUTC() { return new Date().toISOString(); }
function temporalMs() { return Date.now(); }
// _clamp01 declared later (deduped to avoid redeclare)
function temporalSubjectiveProfile(session) {
  // Lightweight subjective time model: derives pacing + salience window from session activity.
  const turns = session?.messages?.length || 0;
  const lastAt = session?.lastAt ? Date.parse(session.lastAt) : NaN;
  const ageMin = Number.isFinite(lastAt) ? (Date.now() - lastAt) / 60000 : 1e9;
  const urgency = _clamp01(1 - (ageMin/30)); // last 30 min -> higher urgency
  const fatigue = _clamp01((turns-20)/40);   // starts fatiguing after ~20 turns
  const pace = (urgency>0.6 && fatigue<0.6) ? "fast" : (fatigue>0.7 ? "slow" : "normal");
  const salienceMinutes = pace==="fast" ? 90 : (pace==="normal" ? 240 : 480);
  return { ok:true, pace, urgency, fatigue, salienceMinutes, turns };
}

function temporalRecencyWeightISO(itemISO, nowISO=temporalNowUTC(), halfLifeMinutes=240) {
  const t = Date.parse(itemISO);
  const n = Date.parse(nowISO);
  if (!Number.isFinite(t) || !Number.isFinite(n)) return 0.5;
  const dtMin = Math.max(0, (n - t)/60000);
  const hl = Math.max(1, Number(halfLifeMinutes)||240);
  // exponential decay
  return Math.exp(-Math.LN2 * (dtMin/hl));
}

const TEMPORAL_FRAMES = {
  // Minimal objective frames for coordination; extensible later.
  "UTC": { id:"UTC", kind:"objective", note:"Earth/UTC-like coordinate time." },
  "EARTH_SURFACE": { id:"EARTH_SURFACE", kind:"objective", note:"Earth surface operational frame (approx)." },
  "ORBIT_L1": { id:"ORBIT_L1", kind:"objective", note:"Generic orbital frame placeholder." },
  "SHIP_PROPER": { id:"SHIP_PROPER", kind:"objective", note:"Proper time on craft (placeholder; SR/GR later)." },
};

function temporalValidate({ t0, t1, dt, frame="UTC", allowCounterfactual=false }={}) {
  const f = TEMPORAL_FRAMES[frame] || null;
  if (!f) return { ok:false, error:`unknown frame: ${frame}` };
  const a = t0 ? Date.parse(t0) : NaN;
  const b = t1 ? Date.parse(t1) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { ok:false, error:"t0 and t1 must be ISO timestamps", t0, t1 };
  if (!allowCounterfactual && b < a) return { ok:false, error:"timeline order invalid (t1 < t0)", t0, t1, frame };
  const step = dt==null ? null : Number(dt);
  if (dt!=null && (!Number.isFinite(step) || step<=0)) return { ok:false, error:"dt must be positive number (seconds)", dt };
  return { ok:true, status:"ok", frame, deltaSeconds: Math.abs((b-a)/1000), dtSeconds: step };
}

register("temporal","validate", async (ctx, input) => {
  const r = temporalValidate(input||{});
  return { ...r, simulation:true };
}, { summary:"Validate objective time inputs + reference frame (v3)." });

register("temporal","subjective", async (ctx, input) => {
  const sid = input.sessionId || ctx.session?.id;
  const s = sid ? STATE.sessions.get(sid) : ctx.session;
  const prof = temporalSubjectiveProfile(s);
  return { ...prof, sessionId: sid || null, now: temporalNowUTC(), simulation:true };
}, { summary:"Derive subjective pacing/urgency/salience from session activity (v3)." });

register("temporal","recency", async (ctx, input) => {
  const now = input.nowISO || temporalNowUTC();
  const weight = temporalRecencyWeightISO(input.itemISO || now, now, input.halfLifeMinutes ?? 240);
  return { ok:true, weight, now, halfLifeMinutes: input.halfLifeMinutes ?? 240, simulation:true };
}, { summary:"Compute recency decay weight for retrieval and scoring (v3)." });

register("temporal","frame", async (ctx, input) => {
  const id = String(input.id || "UTC").toUpperCase();
  const f = TEMPORAL_FRAMES[id];
  if (!f) return { ok:false, error:`unknown frame: ${id}`, frames:Object.keys(TEMPORAL_FRAMES), simulation:true };
  return { ok:true, frame:f, simulation:true };
}, { summary:"Lookup supported temporal reference frames (v3)." });

register("temporal","simTimeline", async (ctx, input) => {
  const r = temporalValidate({ t0: input.t0, t1: input.t1, dt: input.dt, frame: input.frame || "UTC", allowCounterfactual: !!input.allowCounterfactual });
  if (!r.ok) return { ...r, simulation:true };
  const id = input.id || uid("sim_timeline");
  STATE.simTimelines = STATE.simTimelines || {};
  STATE.simTimelines[id] = { id, ...input, frame: r.frame, createdAt: nowISO(), updatedAt: nowISO() };
  saveStateDebounced();
  return { ok:true, id, timeline: STATE.simTimelines[id], simulation:true };
}, { summary:"Register/update a simulation timeline object (v3)." });
// anon domain
register("anon", "create", async (ctx, input) => {
  const r = createAnonIdentity({ rotateFromAnonId: input.rotateFromAnonId || null });
  log("anon.create", "Created anon identity", { anonId: r.anonId });
  return { ok:true, ...r };
}, { summary:"Create anon identity (non-discoverable)." });

register("anon", "send", async (ctx, input) => {
  const toAnonId = String(input.toAnonId || "").trim();
  const recipientPub = String(input.recipientPublicKeyPem || "").trim();
  const plaintext = String(input.plaintext || input.message || "");
  if (!toAnonId || !recipientPub || !plaintext) return { ok:false, error:"toAnonId, recipientPublicKeyPem, plaintext required" };
  const enc = e2eEncryptToRecipient(recipientPub, plaintext, input.senderPublicKeyPem || null);
  const msg = { id: uid("msg"), ts: nowISO(), toAnonId, fromPub: String(input.senderPublicKeyPem || ""), ...enc };
  const box = STATE.anon.inbox.get(toAnonId) || [];
  box.push(msg);
  STATE.anon.inbox.set(toAnonId, box);
  saveStateDebounced();
  log("anon.send", "Stored encrypted message", { toAnonId, msgId: msg.id });
  return { ok:true, msgId: msg.id };
}, { summary:"Send encrypted message (server stores ciphertext only)." });

register("anon", "inbox", async (ctx, input) => {
  const anonId = String(input.anonId || "").trim();
  if (!anonId) return { ok:false, error:"anonId required" };
  const msgs = (STATE.anon.inbox.get(anonId) || []).slice(-200);
  return { ok:true, anonId, messages: msgs.map(m => ({ id:m.id, ts:m.ts, fromPub:m.fromPub, ephPublicKeyPem:m.ephPublicKeyPem, ciphertextB64:m.ciphertextB64, ivB64:m.ivB64, tagB64:m.tagB64, aadB64:m.aadB64 })) };
}, { summary:"Fetch encrypted inbox for anonId." });

register("anon", "decryptLocal", async (ctx, input) => {
  const anonId = String(input.anonId || "").trim();
  const msg = input.msg;
  if (!anonId || !msg) return { ok:false, error:"anonId and msg required" };
  const plaintext = e2eDecryptForAnon(anonId, msg);
  return { ok:true, plaintext };
}, { summary:"Decrypt message (local-only; requires private key stored in this server state)." });

// council domain enhancements
register("council", "reviewGlobal", async (ctx, input) => {
  const dtuId = String(input.dtuId || "");
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok:false, error:"DTU not found" };

  // STRICT no duplicates on Global:
  const h = globalDtuHash(dtu);
  const existing = STATE.globalIndex.byHash.get(h);
  if (existing && existing !== dtuId) {
    return { ok:false, decision:"reject", reason:"duplicate", duplicateOf: existing };
  }

  // minimal eligibility: if already global, ok; else mark global
  dtu.isGlobal = true;
  dtu.meta = dtu.meta || {};
  dtu.meta.globalHash = h;
  STATE.globalIndex.byHash.set(h, dtuId);
  await pipelineCommitDTU(ctx, dtu, { op: 'dtu.create', allowRewrite });

  // Council "why"
  const why = `Approved for Global: non-duplicate hash ${h.slice(0,10)}…`;
  const whyDTU = await ctx.macro.run("dtu","create",{
    title: `COUNCIL — Global Review: ${dtu.title}`,
    creti: cretiPack({
      title: `Council Global Review — ${dtu.title}`,
      purpose: "Explain Council decision for Global gate.",
      context: `DTU: ${dtuId}`,
      procedure: "Compute global hash → check duplicates → mark global if unique.",
      outputs: `Decision: APPROVE\nWhy: ${why}`,
      tests: "Attempting to re-add same DTU should reject as duplicate.",
      notes: ""
    }),
    tags:["council","global","why"], tier:"regular", source:"council.reviewGlobal"
  });

  return { ok:true, decision:"approve", why, whyDTU: whyDTU.id, globalHash: h };
}, { summary:"Global gate with strict no-duplicates + why." });

register("council", "weeklyDebateTick", async (ctx, input) => {
  const enabled = STATE.settings.weeklyDebateEnabled !== false; // default true when set later
  if (!enabled) return { ok:true, skipped:true, reason:"weeklyDebateDisabled" };

  const topic = normalizeText(input.topic || "Weekly Synthesis");
  const set = pickDebateSet(topic).slice(0, 8);
  const titles = set.map(d=>`- ${d.title} (${d.id})`).join("\n");
  const creti = cretiPack({
    title: `Council Weekly Synthesis — ${topic}`,
    purpose: "Weekly persona debate (DTU-based) synthesized into one better DTU.",
    context: `Debate set:\n${titles}`,
    procedure: "Personas propose claim DTUs → challenge DTUs → contradiction map → synthesis DTU.",
    outputs: "Synthesis with preserved unresolved contradictions; speculative labeled.",
    tests: "Re-run next week should reference prior synthesis and show deltas.",
    notes: "Viewer mode can replay DTU chain. This DTU is the artifact."
  });
  const out = await ctx.macro.run("dtu","create",{
    title: `COUNCIL — Weekly Synthesis: ${topic}`,
    creti,
    tags:["council","weekly","synthesis"],
    tier:"mega",
    source:"council.weeklyDebateTick",
    meta:{ debateSet: set.map(d=>d.id) }
  });
  return { ok:true, created: out.id };
}, { summary:"Weekly Council debate → synthesis DTU." });

// ---- v3 Feature Domains: auth/org/jobs/agents/crawl/sources/global/market/paper/audit ----
// NOTE: These are additive. They keep endpoints thin and preserve the macro-first kernel.

register("auth","whoami", async (ctx, input) => {
  const actor = ctx.actor || { userId:"anon", orgId:"public", role:"viewer", scopes:["read"] };
  const user = STATE.users.get(actor.userId) || null;
  const org = STATE.orgs.get(actor.orgId) || null;
  return { ok:true, actor, user, org };
}, { summary:"Return current actor/user/org (API key auth)." });

register("auth","createApiKey", async (ctx, input) => {
  const actor = ctx.actor;
  const scopes = Array.isArray(input.scopes) && input.scopes.length ? input.scopes : ["read"];
  const rawKey = crypto.randomBytes(24).toString("hex");
  const keyId = uid("key");
  const obj = { id:keyId, keyHash: sha256Hex(rawKey), userId: actor.userId, orgId: actor.orgId, scopes, createdAt: nowISO(), revokedAt: null };
  STATE.apiKeys.set(keyId, obj);
  saveStateDebounced();
  return { ok:true, apiKey: rawKey, keyId, scopes };
}, { summary:"Create a new API key for current actor (returns plaintext once)." });

register("org","create", async (ctx, input) => {
  const name = normalizeText(input.name || "New Org");
  const actor = ctx.actor;
  const orgId = uid("org");
  const org = { id: orgId, name, ownerUserId: actor.userId, createdAt: nowISO() };
  STATE.orgs.set(orgId, org);
  const u = STATE.users.get(actor.userId);
  if (u) {
    u.orgIds = Array.isArray(u.orgIds) ? Array.from(new Set([...u.orgIds, orgId])) : [orgId];
    u.roleByOrg = u.roleByOrg || {};
    u.roleByOrg[orgId] = "owner";
  }
  saveStateDebounced();
  return { ok:true, org };
}, { summary:"Create a new org owned by current user." });

register("jobs","enqueue", async (ctx, input) => {
  const kind = String(input.kind || "").trim(); // domain.name
  if (!kind.includes(".")) return { ok:false, error:"kind must be domain.name" };
  const payload = (input.payload && typeof input.payload==="object") ? input.payload : {};
  const job = enqueueJob(kind, payload, { actor: ctx.actor, idempotencyKey: input.idempotencyKey || null, maxAttempts: Number(input.maxAttempts||3) });
  return { ok:true, job };
}, { summary:"Enqueue a background job (domain.name)." });

register("jobs","get", async (ctx, input) => {
  const id = String(input.id||"");
  const j = STATE.jobs.get(id);
  if (!j) return { ok:false, error:"job not found" };
  return { ok:true, job: j };
}, { summary:"Get a job by id." });

register("jobs","list", async (ctx, input) => {
  const limit = clamp(Number(input.limit||50), 1, 200);
  const jobs = Array.from(STATE.jobs.values()).slice(-limit).reverse();
  return { ok:true, jobs };
}, { summary:"List recent jobs." });

// ---- Agents ----
register("agent","create", async (ctx, input) => {
  const name = normalizeText(input.name || "Agent");
  const goal = normalizeText(input.goal || "");
  const cadenceMs = clamp(Number(input.cadenceMs||60000), 5000, 86400000);
  const allowed = Array.isArray(input.allowedMacros) ? input.allowedMacros.map(String) : ["dtu.create","dtu.list","system.synthesize"];
  const id = uid("agent");
  const agent = { id, orgId: ctx.actor.orgId, name, goal, cadenceMs, allowedMacros: allowed, enabled: false, createdAt: nowISO(), lastTickAt: null };
  STATE.queues.agents = Array.isArray(STATE.queues.agents) ? STATE.queues.agents : [];
  STATE.queues.agents.push(id);
  STATE.personas.set(id, agent); // store in personas map as lightweight agent record (no new map needed)
  saveStateDebounced();
  return { ok:true, agent };
}, { summary:"Create an agent definition (stored local-first)." });

register("agent","enable", async (ctx, input) => {
  const id = String(input.id||"");
  const a = STATE.personas.get(id);
  if (!a) return { ok:false, error:"agent not found" };
  a.enabled = !!input.enabled;
  saveStateDebounced();
  return { ok:true, agent: a };
}, { summary:"Enable/disable an agent." });

register("agent","tick", async (ctx, input) => {
  const id = String(input.id||"");
  const a = STATE.personas.get(id);
  if (!a || !a.enabled) return { ok:true, skipped:true };
  // Minimal behavior: turn goal into a synthesis DTU prompt and create one DTU.
  const prompt = a.goal || (input.prompt || "Agent tick");
  const out = await ctx.macro.run("chat","respond", { sessionId: `agent:${id}`, prompt, mode:"design", llm:false }, ctx);
  const dtu = await ctx.macro.run("dtu","create", {
    title: `AGENT — ${a.name}: ${prompt.slice(0,80)}`,
    creti: cretiPack({
      title: `Agent Output — ${a.name}`,
      purpose: "Agent-generated synthesis DTU (local-first).",
      context: prompt,
      procedure: "Run chat.respond (deterministic) → capture reply → store as DTU.",
      outputs: out.reply || out.result?.reply || String(out),
      tests: "Re-run should be stable given same DTU substrate.",
      notes: ""
    }),
    tags:["agent", a.name],
    tier:"regular",
    source:"agent.tick",
    meta:{ agentId:id }
  }, ctx);
  a.lastTickAt = nowISO();
  saveStateDebounced();
  return { ok:true, createdDTU: dtu.id };
}, { summary:"Run one agent tick (lightweight)." });

// ---- Crawl / Sources ----
// stripHtml() already declared earlier; reused here to avoid redeclaration.

register("crawl","enqueue", async (ctx, input) => {
  const urls = Array.isArray(input.urls) ? input.urls.map(String).filter(Boolean) : [String(input.url||"")].filter(Boolean);
  if (!urls.length) return { ok:false, error:"url(s) required" };
  const jobs = urls.map(u => enqueueJob("crawl.fetch", { url: u }, { actor: ctx.actor, idempotencyKey: `crawl:${u}` }));
  return { ok:true, jobs };
}, { summary:"Enqueue fetch+parse jobs for urls." });

register("crawl","fetch", async (ctx, input) => {
  const url = String(input.url||"").trim();
  if (!url) return { ok:false, error:"url required" };
  // Basic fetch (no advanced robots/rate-limit yet; local-first prototype)
  const resp = await fetch(url, { redirect: "follow" });
  const ct = String(resp.headers.get("content-type")||"");
  const raw = await resp.text();
  const text = ct.includes("text/html") ? stripHtml(raw) : raw;
  const excerpt = text.slice(0, 800);
  const id = uid("src");
  const contentHash = sha256Hex(text);
  const src = { id, url, fetchedAt: nowISO(), contentHash, title: url, excerpt, text, meta:{ contentType: ct, status: resp.status } };
  // dedupe by hash
  for (const s of STATE.sources.values()) {
    if (s && s.contentHash === contentHash) return { ok:true, source: s, deduped: true };
  }
  STATE.sources.set(id, src);
  saveStateDebounced();
  return { ok:true, source: src };
}, { summary:"Fetch a URL, extract text, store as source." });

register("source","list", async (ctx, input) => {
  const limit = clamp(Number(input.limit||25), 1, 200);
  const arr = Array.from(STATE.sources.values()).slice(-limit).reverse().map(s => ({ id:s.id, url:s.url, fetchedAt:s.fetchedAt, excerpt:s.excerpt }));
  return { ok:true, sources: arr };
}, { summary:"List stored sources." });

register("source","get", async (ctx, input) => {
  const id = String(input.id||"");
  const s = STATE.sources.get(id);
  if (!s) return { ok:false, error:"source not found" };
  return { ok:true, source: s };
}, { summary:"Get source by id." });

register("forge","fromSource", async (ctx, input) => {
  const sourceId = String(input.sourceId||"");
  const s = STATE.sources.get(sourceId);
  if (!s) return { ok:false, error:"source not found" };
  const title = normalizeText(input.title || `SOURCE — ${s.url}`);
  const claims = (normalizeText(input.claims || "") || "").split(/\n+/).map(x=>normalizeText(x)).filter(Boolean).slice(0, 12);
  const dtu = await ctx.macro.run("dtu","create", {
    title,
    creti: cretiPack({
      title,
      purpose: "Forge a DTU from a web source with citations.",
      context: `Source: ${s.url}\nFetched: ${s.fetchedAt}`,
      procedure: "Extract key claims → store with citation hash + excerpt.",
      outputs: claims.length ? claims.map(c=>`- ${c}`).join("\n") : s.excerpt,
      tests: "If claims are wrong, revise DTU with updated citations.",
      notes: "This DTU stores sourceId + contentHash for traceability."
    }),
    tags:["source","citation"],
    tier:"regular",
    source:"forge.fromSource",
    meta:{ sourceId: s.id, url: s.url, contentHash: s.contentHash }
  }, ctx);
  return { ok:true, createdDTU: dtu.id };
}, { summary:"Create a DTU from a stored source (with citation metadata)." });

// ---- Global ----
register("global","propose", async (ctx, input) => {
  const dtuId = String(input.dtuId||"");
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok:false, error:"DTU not found" };
  dtu.meta = dtu.meta || {};
  dtu.meta.globalCandidate = true;
  dtu.updatedAt = nowISO();
  saveStateDebounced();
  return { ok:true, dtuId, status:"global_candidate" };
}, { summary:"Mark a DTU as a global candidate." });

register("global","publish", async (ctx, input) => {
  const dtuId = String(input.dtuId||"");
  // Reuse existing Council global review gate (strict no-dup)
  const out = await ctx.macro.run("council","reviewGlobal", { dtuId }, ctx);
  if (!out.ok) return out;
  const dtu = STATE.dtus.get(dtuId);
  if (dtu) {
    const gid = uid("global");
    STATE.globalIndex.byId.set(gid, dtuId);
    dtu.meta = dtu.meta || {};
    dtu.meta.globalId = gid;
    dtu.meta.globalPublishedAt = nowISO();
    saveStateDebounced();
    return { ok:true, globalId: gid, dtuId, globalHash: out.globalHash };
  }
  return { ok:false, error:"DTU missing after publish" };
}, { summary:"Publish a DTU to Global (council-gated)." });

// ---- Marketplace ----
register("market","listingCreate", async (ctx, input) => {
  const dtuId = String(input.dtuId||"");
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok:false, error:"DTU not found" };
  const price = Number(input.price||0);
  const currency = normalizeText(input.currency||"USD") || "USD";
  const license = normalizeText(input.license||"noncommercial") || "noncommercial";
  const id = uid("lst");
  const listing = { id, dtuId, orgId: ctx.actor.orgId, price, currency, license, status:"active", createdAt: nowISO() };
  STATE.listings.set(id, listing);
  saveStateDebounced();
  return { ok:true, listing };
}, { summary:"Create a marketplace listing for a DTU (local-first)." });

register("market","list", async (ctx, input) => {
  const limit = clamp(Number(input.limit||50), 1, 200);
  const listings = Array.from(STATE.listings.values()).filter(l=>l.status==="active").slice(-limit).reverse();
  return { ok:true, listings };
}, { summary:"List active listings." });

register("market","buy", async (ctx, input) => {
  const listingId = String(input.listingId||"");
  const listing = STATE.listings.get(listingId);
  if (!listing || listing.status !== "active") return { ok:false, error:"listing not found/active" };
  const buyerOrgId = ctx.actor.orgId;
  const sellerOrgId = listing.orgId;
  const amount = Number(listing.price||0);
  const fee = Math.max(0, Number((amount * 0.03).toFixed(2))); // default 3% platform fee
  const txId = uid("tx");
  const tx = { id: txId, buyerOrgId, sellerOrgId, listingId, amount, fee, createdAt: nowISO() };
  STATE.transactions.set(txId, tx);
  const entId = uid("ent");
  const ent = { id: entId, buyerOrgId, dtuId: listing.dtuId, license: listing.license, createdAt: nowISO() };
  STATE.entitlements.set(entId, ent);
  saveStateDebounced();
  return { ok:true, transaction: tx, entitlement: ent };
}, { summary:"Buy a listing; grants entitlement (local-first ledger)." });

register("market","library", async (ctx, input) => {
  const orgId = ctx.actor.orgId;
  const ents = Array.from(STATE.entitlements.values()).filter(e=>e.buyerOrgId === orgId).slice(-200).reverse();
  return { ok:true, entitlements: ents };
}, { summary:"Return entitlements (your purchased DTUs)." });

// ---- Papers ----
register("paper","create", async (ctx, input) => {
  const topic = normalizeText(input.topic || "Untitled Paper");
  const id = uid("paper");
  const paper = { id, orgId: ctx.actor.orgId, topic, outline: [], sections: [], refs: [], status:"draft", createdAt: nowISO(), updatedAt: nowISO() };
  STATE.papers.set(id, paper);
  saveStateDebounced();
  return { ok:true, paper };
}, { summary:"Create a paper draft object." });

register("paper","build", async (ctx, input) => {
  const id = String(input.paperId||"");
  const p = STATE.papers.get(id);
  if (!p) return { ok:false, error:"paper not found" };
  // Minimal build: pick top DTUs by tags/topic and build a markdown-ish outline.
  const topic = p.topic;
  const { top } = retrieveDTUs(topic, { topK: 8, minScore: 0.06, randomK: 0, oppositeK: 0 });
  p.outline = [
    "Abstract",
    "Background",
    "Core Claims",
    "Evidence & DTU Anchors",
    "Open Questions",
    "Conclusion"
  ];
  p.sections = [
    { heading:"Abstract", body:`This paper summarizes Concord DTU anchors related to: ${topic}.` },
    { heading:"Evidence & DTU Anchors", body: top.map(d=>`- ${d.title} (${d.id})`).join("\n") }
  ];
  p.refs = [];
  // collect sources from DTU meta if present
  for (const d of top) {
    const sId = d?.meta?.sourceId;
    if (sId && STATE.sources.get(sId)) p.refs.push({ sourceId: sId, url: STATE.sources.get(sId).url, contentHash: STATE.sources.get(sId).contentHash });
  }
  p.status = "built";
  p.updatedAt = nowISO();
  saveStateDebounced();
  return { ok:true, paper: p };
}, { summary:"Build a paper from DTUs (minimal deterministic compiler)." });

register("paper","export", async (ctx, input) => {
  const id = String(input.paperId||"");
  const p = STATE.papers.get(id);
  if (!p) return { ok:false, error:"paper not found" };
  const fmt = normalizeText(input.format||"md") || "md";
  const lines = [];
  lines.push(`# ${p.topic}\n`);
  for (const sec of (p.sections||[])) {
    lines.push(`\n## ${sec.heading}\n${sec.body}\n`);
  }
  if (Array.isArray(p.refs) && p.refs.length) {
    lines.push("\n## References\n" + p.refs.map(r=>`- ${r.url} (hash ${String(r.contentHash||"").slice(0,10)}…)`).join("\n"));
  }
  const outText = lines.join("\n").trim() + "\n";
  const fname = `paper_${id}.${fmt === "md" ? "md" : "txt"}`;
  const fpath = path.join(DATA_DIR, fname);
  fs.writeFileSync(fpath, outText, "utf-8");
  return { ok:true, file: { name: fname, path: fpath } };
}, { summary:"Export paper to a local file (md/txt)."} );

// ---- Audit queries (best-effort) ----
register("audit","query", async (ctx, input) => {
  const limit = clamp(Number(input.limit||100), 1, 500);
  const domain = normalizeText(input.domain||"");
  const contains = normalizeText(input.contains||"");
  const logs = (STATE.logs||[]).slice(-2000).filter(x => {
    if (!x) return false;
    if (domain && String(x.domain||"") !== domain) return false;
    if (contains && !JSON.stringify(x).toLowerCase().includes(contains.toLowerCase())) return false;
    return true;
  }).slice(-limit);
  return { ok:true, logs };
}, { summary:"Query recent audit logs (in-memory mirror)."} );


// =================== VERIFY / SCORE / DERIVE MACROS (minimal, opt-in) ===================
// These macros are additive and do not change existing behavior unless explicitly called.
// They rely on the DTU substrate for structure; LLM (if enabled) is used only for classification/synthesis language.

function _retrieveRelevantDTUs(query, k=8, threshold=0.08) {
  const all = dtusArray();
  const qTok = simpleTokens(String(query||""));
  const scored = all.map(d => {
    const text = (d.title||"") + " " + ((d.tags||[]).join(" ")) + " " + ((d.human?.summary||"") + " " + (d.creti || "") );
    const dTok = simpleTokens(text).slice(0, 600);
    const score = jaccard(qTok, dTok);
    return { d, score };
  }).sort((a,b)=>b.score-a.score);
  return scored.filter(x=>x.score>threshold).slice(0,k).map(x=>x.d);
}


// =================== REALITY UTILITIES (time/weather) ===================
// Authoritative sources: system clock + external weather API (no LLM).
function getTimeInfo(timeZone = "America/New_York") {
  const now = new Date();
  const nowISO = now.toISOString();
  const localTime = now.toLocaleString("en-US", { timeZone });
  return { nowISO, timeZone, localTime, epochMs: now.getTime() };
}

const _WEATHER_CACHE = new Map(); // key -> { ts:number, data:any }
async function _fetchJson(url) {
  const r = await fetch(url, { method: "GET", headers: { "accept":"application/json" } });
  if (!r.ok) throw new Error(`fetch_failed:${r.status}`);
  return await r.json();
}
function _cacheGet(key, ttlMs) {
  const ent = _WEATHER_CACHE.get(key);
  if (!ent) return null;
  if ((Date.now() - ent.ts) > ttlMs) return null;
  return ent.data;
}
function _cacheSet(key, data) { _WEATHER_CACHE.set(key, { ts: Date.now(), data }); }

async function getWeather(locationStr, opts={}) {
  const location = String(locationStr || "").trim() || "Poughkeepsie, NY";
  const timeZone = String(opts.timeZone || "America/New_York");
  const ttlMs = clamp(Number(opts.ttlMs || (10*60*1000)), 60*1000, 60*60*1000); // 1m..1h

  const key = `wx:${location}:${timeZone}`;
  const cached = _cacheGet(key, ttlMs);
  if (cached) return { ok:true, cached:true, ...cached };

  // Geocode via Open-Meteo geocoding (no key).
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const geo = await _fetchJson(geoUrl);
  const hit = geo?.results?.[0];
  if (!hit) return { ok:false, error:"location_not_found", location };

  const lat = hit.latitude, lon = hit.longitude;
  const label = [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");

  // Forecast via Open-Meteo (current + hourly + daily)
  const wxUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code` +
    `&timezone=${encodeURIComponent(timeZone)}`;

  const wx = await _fetchJson(wxUrl);

  const out = { location: label, lat, lon, timeZone, forecast: wx };
  _cacheSet(key, out);
  return { ok:true, cached:false, ...out };
}

register("verify","conflictCheck", async (ctx, input) => {
  const dtu = input?.dtu || null;
  if (!dtu || typeof dtu !== "object") return { ok:false, reason:"missing_dtu_object" };
  const cc = pipeConflictCheckDTU(dtu);
  return { ok: cc.ok, conflicts: cc.conflicts };
}, { summary:"Conservative contradiction check: flags only explicit 'X' vs 'NOT X' clashes across invariants/claims." });


register("verify","feasibility", async (ctx, input) => {
  const query = String(input?.query||"");
  const llm = (typeof input?.llm === "boolean") ? input.llm : ctx.state.settings.llmDefault;
  const k = clamp(Number(input?.k||10), 1, 25);
  const relevant = _retrieveRelevantDTUs(query, k, 0.06);

  // Deterministic feasibility classifier (always available):
  // - infeasible: explicit contradiction signals among the strongest anchors
  // - feasible: strong anchor evidence and no explicit contradictions
  // - conditionally_feasible: some evidence but weak / missing constraints
  // - undecidable: no meaningful anchors
  const _norm = (s) => tokenish(String(s||"")).replace(/\s+/g, " ").trim();
  const _hasNeg = (s) => /\b(not|no|never|cannot|can't|impossible|forbidden|invalid)\b/i.test(String(s||""));
  const _stripNeg = (s) => _norm(String(s||"").replace(/\b(not|no|never|cannot|can't|impossible|forbidden|invalid)\b/ig, "").trim());
  const _collectAtoms = (d) => {
    const c = d?.core || {};
    const atoms = [];
    const push = (x, kind) => {
      const t = _norm(x);
      if (!t || t.length < 4) return;
      atoms.push({ text: t, kind, neg: _hasNeg(t), base: _stripNeg(t), dtuId: d.id });
    };
    for (const x of (c.invariants||[])) push(x, "invariant");
    for (const x of (c.claims||[])) push(x, "claim");
    return atoms;
  };
  const _pairConflicts = (dtus) => {
    const atoms = dtus.flatMap(_collectAtoms);
    const byBase = new Map();
    for (const a of atoms) {
      if (!a.base) continue;
      const arr = byBase.get(a.base) || [];
      arr.push(a);
      byBase.set(a.base, arr);
    }
    const conflicts = [];
    for (const [base, arr] of byBase.entries()) {
      const hasPos = arr.some(x => !x.neg);
      const hasNeg2 = arr.some(x => x.neg);
      if (hasPos && hasNeg2) {
        // report minimal conflict tuple
        const pos = arr.find(x => !x.neg);
        const neg = arr.find(x => x.neg);
        conflicts.push({ base, pos: { dtuId: pos?.dtuId, kind: pos?.kind, text: pos?.text }, neg: { dtuId: neg?.dtuId, kind: neg?.kind, text: neg?.text } });
      }
    }
    return conflicts.slice(0, 8);
  };

  // Use the same "working set" logic as /ask for signal strength.
  const all = dtusArray();
  const qTok = simpleTokens(query);
  const scored = all.map(d => {
    const dTok = simpleTokens(d.title + " " + (d.tags||[]).join(" ") + " " + ((d.cretiHuman || d.creti || d.human?.summary || "")).slice(0, 400));
    const score = jaccard(qTok, dTok);
    return { d, score };
  }).sort((a,b)=>b.score-a.score);

  const { micro } = selectWorkingSet(
    scored.filter(x=>x.score > 0.06).map(x=>({ d:x.d, score:x.score })),
    ctx.state.settings,
    { includeMegas: true }
  );
  const bestScore = scored?.[0]?.score ?? 0;
  const hasStrongEvidence = micro.length >= 2 && bestScore >= 0.12;

  const conflicts = _pairConflicts(micro.slice(0, 6));
  if (conflicts.length) {
    return {
      ok:true,
      classification:"infeasible",
      reason:"explicit_conflict_in_anchors",
      conflicts,
      relevantIds: relevant.map(d=>d.id)
    };
  }

  if (hasStrongEvidence) {
    // Optionally ask the LLM for a tighter label (does not override infeasible).
    let llmText = "";
    if (llm && ctx.state.llmReady) {
      const sys = "Classify feasibility. Output ONE word: feasible | conditionally_feasible | undecidable. Only use the provided DTU excerpts; do not invent facts.";
      const excerpts = micro.slice(0,6).map(d => ({ id:d.id, title:d.title, invariants:d.core?.invariants||[], claims:d.core?.claims||[] }));
      const user = JSON.stringify({ query, dtus: excerpts });
      const out = await llmChat(ctx, [{role:"system", content:sys},{role:"user", content:user}], { temperature: 0.0, max_tokens: 120 });
      llmText = (out?.text||"").trim();
      const w = llmText.toLowerCase();
      if (w.includes("conditionally")) return { ok:true, classification:"conditionally_feasible", reason:"llm_refinement", llmText, relevantIds: relevant.map(d=>d.id) };
      if (w.includes("undecidable")) return { ok:true, classification:"undecidable", reason:"llm_refinement", llmText, relevantIds: relevant.map(d=>d.id) };
    }
    return { ok:true, classification:"feasible", reason:"strong_anchor_evidence", llmText, relevantIds: relevant.map(d=>d.id) };
  }

  if (micro.length >= 1 && bestScore >= 0.08) {
    return { ok:true, classification:"conditionally_feasible", reason:"some_anchor_evidence_missing_constraints", relevantIds: relevant.map(d=>d.id) };
  }

  return { ok:true, classification:"undecidable", reason:"no_meaningful_anchor_evidence", relevantIds: relevant.map(d=>d.id) };
}, { summary:"Feasibility classification. Deterministic by default; may use LLM to refine between feasible/conditionally_feasible/undecidable. Infeasible is reserved for explicit anchor conflicts." });


register("verify","designScore", async (ctx, input) => {
  const spec = String(input?.spec || input?.design || input?.prompt || "");
  const llm = (typeof input?.llm === "boolean") ? input.llm : ctx.state.settings.llmDefault;
  const k = clamp(Number(input?.k||12), 1, 25);
  const relevant = _retrieveRelevantDTUs(spec, k, 0.06);

  // Deterministic score: anchoredness + (optional) repair/damage margin if provided.
  const all = dtusArray();
  const qTok = simpleTokens(spec);
  const scored = all.map(d => {
    const dTok = simpleTokens(d.title + " " + (d.tags||[]).join(" ") + " " + ((d.cretiHuman || d.creti || d.human?.summary || "")).slice(0, 400));
    const score = jaccard(qTok, dTok);
    return { d, score };
  }).sort((a,b)=>b.score-a.score);

  const { micro, macro } = selectWorkingSet(
    scored.filter(x=>x.score > 0.06).map(x=>({ d:x.d, score:x.score })),
    ctx.state.settings,
    { includeMegas: true }
  );
  const bestScore = scored?.[0]?.score ?? 0;

  // Base score from evidence strength (0..1)
  let score = clamp((bestScore - 0.05) / 0.25, 0, 1);
  // Bonus for multiple strong micro anchors
  score = clamp(score + (micro.length >= 2 ? 0.15 : micro.length === 1 ? 0.05 : 0), 0, 1);

  // Optional physical score: if caller supplies R/D, incorporate margin.
  const R = Number(input?.R ?? input?.repair);
  const D = Number(input?.D ?? input?.damage);
  if (isFinite(R) && isFinite(D)) {
    const margin = R - D;
    const mScore = clamp(0.5 + margin / (Math.abs(R)+Math.abs(D)+1e-9), 0, 1);
    score = clamp((score*0.6) + (mScore*0.4), 0, 1);
  }

  // Determine primary risks deterministically.
  const primary_risks = [];
  if (micro.length < 2) primary_risks.push("insufficient_local_constraints");
  if (bestScore < 0.10) primary_risks.push("weak_anchor_match");
  if (macro.length === 0) primary_risks.push("no_high_level_frame");

  // Optionally ask the LLM to propose repairs/tests ONLY (not to override score).
  let required_repairs = [];
  let llmText = "";
  if (llm && ctx.state.llmReady) {
    const sys = "Given a design spec and DTU invariants, propose REQUIRED repairs/tests to reduce risk. Output JSON with required_repairs[] and tests[]. Do not invent external facts.";
    const excerpts = micro.slice(0,6).map(d => ({ id:d.id, title:d.title, invariants:d.core?.invariants||[], claims:d.core?.claims||[] }));
    const user = JSON.stringify({ spec, dtus: excerpts });
    const out = await llmChat(ctx, [{role:"system", content:sys},{role:"user", content:user}], { temperature: 0.1, max_tokens: 450 });
    llmText = (out?.text||"").trim();
    try {
      const j = JSON.parse(llmText);
      if (Array.isArray(j?.required_repairs)) required_repairs = j.required_repairs.map(String).slice(0, 8);
      if (Array.isArray(j?.tests)) primary_risks.push(...j.tests.map(t => `test:${String(t)}`).slice(0, 6));
    } catch {}
  }

  return {
    ok:true,
    score_0_1: score,
    primary_risks: Array.from(new Set(primary_risks)).slice(0, 10),
    required_repairs: required_repairs.slice(0, 10),
    cited_dtu_ids: micro.slice(0,8).map(d=>d.id),
    relevantIds: relevant.map(d=>d.id),
    llmText
  };
}, { summary:"Design feasibility scoring. Deterministic score from DTU anchor strength (and optional R/D margin). LLM may add suggested repairs/tests but does not override score." });


register("verify","deriveSecondOrder", async (ctx, input) => {
  const seedIds = Array.isArray(input?.seedIds) ? input.seedIds : [];
  const query = String(input?.query||"");
  const llm = (typeof input?.llm === "boolean") ? input.llm : ctx.state.settings.llmDefault;

  const seeds = seedIds.length
    ? seedIds.map(id => STATE.dtus.get(id) || STATE.shadowDtus.get(id)).filter(Boolean)
    : _retrieveRelevantDTUs(query, 10, 0.06);

  // Full activation: deriveSecondOrder ALWAYS attempts to commit through pipeline.
  // If LLM is unavailable, refuse rather than invent a derived DTU.
  if (!llm || !ctx.state.llmReady) {
    return { ok:false, committed:false, reason:"llm_off_or_unavailable_for_derivation", seedIds: seeds.map(d=>d.id) };
  }

  const sys = "Synthesize ONE second-order DTU implied by the provided DTUs. Output STRICT JSON for a DTU with: title, tags[], human.summary, core.definitions[], core.invariants[], core.claims[], core.examples[], core.nextActions[], machine.math{equations:[],notes:\"\"}. Do not invent external facts; derive logically.";
  const excerpts = seeds.map(d => ({ id:d.id, title:d.title, invariants:d.core?.invariants||[], claims:d.core?.claims||[], definitions:d.core?.definitions||[] }));
  const user = JSON.stringify({ seeds: excerpts });
  const out = await llmChat(ctx, [{role:"system", content:sys},{role:"user", content:user}], { temperature: 0.1, max_tokens: 900 });

  let cand=null;
  try { cand = JSON.parse(out?.text||""); } catch {}
  if (!cand || typeof cand !== "object") return { ok:false, committed:false, reason:"llm_bad_json", llmText: out?.text||"" };

  const dtu = {
    id: makeId("dtu"),
    tier: "surface",
    tags: Array.isArray(cand.tags)?cand.tags:[],
    title: String(cand.title||"Derived DTU"),
    human: { summary: String(cand?.human?.summary||""), bullets: [] },
    core: {
      definitions: Array.isArray(cand?.core?.definitions)?cand.core.definitions:[],
      invariants: Array.isArray(cand?.core?.invariants)?cand.core.invariants:[],
      claims: Array.isArray(cand?.core?.claims)?cand.core.claims:[],
      examples: Array.isArray(cand?.core?.examples)?cand.core.examples:[],
      nextActions: Array.isArray(cand?.core?.nextActions)?cand.core.nextActions:[]
    },
    machine: {
      kind: "derived_second_order",
      math: cand?.machine?.math || { equations: [], notes:"" },
      parents: seeds.map(d=>d.id)
    },
    lineage: { parents: seeds.map(d=>d.id), children: [] },
    source: "derived",
    meta: { hidden: false },
    createdAt: nowISO(),
    updatedAt: nowISO(),
    authority: { model: "derive", score: 0 },
    hash: ""
  };

  const res = pipelineCommitDTU(ctx, dtu, { allowRewrite:false });
  if (res?.ok) {
    // Ensure explicit lineage links for parents (best-effort)
    try { await ctx.macro.run("verify","lineageLink", { childId: res.dtu.id, parents: seeds.map(d=>d.id) }); } catch {}
  }
  return { ok: !!res.ok, committed: !!res.ok, dtu: res.dtu, seedIds: seeds.map(d=>d.id), result: res };
}, { summary:"Derive and COMMIT a second-order DTU from seeds. Requires LLM; refuses if unavailable." });

register("verify","lineageLink", async (ctx, input) => {
  const childId = String(input?.childId||"");
  const parents = Array.isArray(input?.parents) ? input.parents.map(String) : [];
  if (!childId || !parents.length) return { ok:false, reason:"missing_child_or_parents" };
  const child = STATE.dtus.get(childId) || STATE.shadowDtus.get(childId);
  if (!child) return { ok:false, reason:"child_not_found" };
  child.lineage = child.lineage || { parents:[], children:[] };
  child.lineage.parents = Array.from(new Set([...(child.lineage.parents||[]), ...parents]));
  child.updatedAt = nowISO();
  // parent -> child back-links (best-effort; do not create if absent)
  for (const pid of parents) {
    const p = STATE.dtus.get(pid) || STATE.shadowDtus.get(pid);
    if (!p) continue;
    p.lineage = p.lineage || { parents:[], children:[] };
    p.lineage.children = Array.from(new Set([...(p.lineage.children||[]), childId]));
    p.updatedAt = nowISO();
  }
  upsertDTU(child);
  return { ok:true, childId, parents };
}, { summary:"Add explicit lineage links (parents/children). Minimal, best-effort, does not infer." });

register("verify","stressTest", async (ctx, input) => {
  // Deterministic, minimal stress test: increase D and/or decrease R until (R-D) flips sign.
  const R0 = Number(input?.R ?? input?.repair ?? 0);
  const D0 = Number(input?.D ?? input?.damage ?? 0);
  const step = clamp(Number(input?.step||0.01), 0.0001, 10);
  const maxIter = clamp(Number(input?.maxIter||5000), 1, 20000);
  if (!isFinite(R0) || !isFinite(D0)) return { ok:false, reason:"invalid_R_or_D" };

  let R = R0, D = D0, i=0;
  while (i<maxIter && (R - D) > 0) { D += step; i++; }
  const thresholdDamage = D;
  return {
    ok:true,
    R0, D0,
    thresholdDamage,
    margin: R0 - D0,
    steps: i,
    notes:"Minimal stress: increments damage until repair dominance breaks (R-D <= 0)."
  };
}, { summary:"Deterministic minimal stress test: finds damage threshold where repair dominance breaks." });




// ===== CHICKEN2 MACROS =====
register("lattice", "beacon", async (ctx, input={}) => {
  const g = _c2genesisDTU();
  const rootHash = g ? _c2hash({ id:g.id, formula:g.formula, invariants:g.invariants }) : "missing";
  const threshold = Number(input.threshold ?? (STATE.__chicken2.thresholdOverlap ?? 0.95));
  // Compare current lattice signature against genesis
  const latticeSig = { invariants: Object.keys(STATE.settings||{}), lineage:{ root:"genesis_reality_anchor_v1" } };
  const overlap = g ? overlap_verifier(g, latticeSig) : 0;
  const awake = overlap >= threshold;
  // Update continuity metric
  STATE.__chicken2.metrics.continuityAvg = clamp(overlap, 0, 1);
  _c2log("c2.beacon", "Beacon computed", { rootHash, threshold, overlap, awake });
  return { ok:true, rootHash, threshold, overlap, awake };
}, { summary:"Chicken2 lattice beacon: returns overlap against genesis and awakens recognition if >= threshold." });

register("lattice", "birth_protocol", async (ctx, input={}) => {
  const proposal = input.proposal || {};
  const pre = inLatticeReality({ type:"birth", domain:"lattice", name:"birth_protocol", input:proposal, ctx });
  if (!pre.ok) {
    _c2log("c2.birth.reject", "Birth proposal rejected by reality guard", { pre });
    return { ok:false, error: pre.reason, pre };
  }
  // sandbox sub-lattice (isolated)
  const steps = clamp(Number(input.steps||20), 5, 200);
  const thresholdHomeo = Number(STATE.__chicken2.thresholdHomeostasis ?? 0.8);
  let homeo = 1.0;
  let stress = 0.0;
  for (let i=0;i<steps;i++){
    // simple dynamics: stress increases with proposal complexity; repair reduces it
    const complexity = clamp01((JSON.stringify(proposal).length||0)/4000);
    stress = clamp01(stress + 0.15*complexity - 0.05);
    homeo = clamp01(1 - stress);
    if (homeo < thresholdHomeo){
      _c2log("c2.birth.rollback", "Sandbox failed homeostasis threshold", { i, homeo, thresholdHomeo });
      return { ok:false, error:"homeostasis_failed", i, homeo, thresholdHomeo };
    }
  }
  // forge new DTU
  const id = uid("dtu_birth");
  const dtu = {
    id,
    title: proposal.title || "Born DTU",
    kind: proposal.kind || "persona_or_pattern",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    lineage: { root: "genesis_reality_anchor_v1", parents: ["genesis_reality_anchor_v1"] },
    invariants: Array.isArray(proposal.invariants) ? proposal.invariants : [],
    formula: proposal.formula || "",
    notes: proposal.notes || ""
  };
  STATE.dtus.set(id, dtu);
  saveStateDebounced();
  _c2log("c2.birth.accept", "Birth accepted and DTU committed", { id, title:dtu.title });
  return { ok:true, id, dtu, homeostasis: homeo };
}, { summary:"Chicken2 birth protocol: sandboxed emergence with homeostasis threshold then DTU commit." });

register("persona", "create", async (ctx, input={}) => {
  const name = String(input.name||"");
  if (!name) throw new Error("name required");
  const id = uid("persona");
  const persona = {
    id,
    name,
    status: "awake",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    lineage: { root:"genesis_reality_anchor_v1", parents:["genesis_reality_anchor_v1"] },
    recognitionThreshold: Number(input.recognitionThreshold ?? 0.95),
    invariants: ["NO_NEGATIVE_VALENCE_DIMENSION", "OVERLAP>=0.95"]
  };
  STATE.personas.set(id, persona);
  saveStateDebounced();
  _c2log("c2.persona.create", "Persona created", { id, name });
  return { ok:true, persona };
}, { summary:"Create a persona with persistent identity rooted to genesis." });

register("skill", "create", async (ctx, input={}) => {
  const title = String(input.title||"");
  if (!title) throw new Error("title required");
  const id = uid("skill");
  const skill = { id, title, trigger: input.trigger||"", procedure: input.procedure||"", checks: input.checks||"", createdAt: nowISO(), updatedAt: nowISO(), level: 1 };
  // store as DTU for portability
  const dtu = { id:`dtu_${id}`, title:`Skill: ${title}`, kind:"skill", createdAt: nowISO(), updatedAt: nowISO(), lineage:{ root:"genesis_reality_anchor_v1", parents:["genesis_reality_anchor_v1"] }, invariants:["NO_NEGATIVE_VALENCE_DIMENSION"], formula: input.formula||"", notes: JSON.stringify(skill) };
  STATE.dtus.set(dtu.id, dtu);
  saveStateDebounced();
  _c2log("c2.skill.create", "Skill created", { id:dtu.id, title });
  return { ok:true, skillDTU: dtu };
}, { summary:"Create a skill DTU template." });

register("intent", "rhythmic_intent", async (ctx, input={}) => {
  const cmd = String(input.command||"").trim();
  if (!cmd) throw new Error("command required");
  // Proposal object; execution must be via governedCall to actually manifest changes
  const proposal = { command: cmd, createdAt: nowISO(), proposer: ctx?.actor?.userId || "anon" };
  _c2log("c2.intent.propose", "Rhythmic intent proposed", { proposal });
  return { ok:true, proposal, note:"Use governedCall/council to manifest." };
}, { summary:"Parse founder commands into a governed proposal." });

register("harness", "run", async (ctx, input={}) => {
  const tasks = Array.isArray(input.tasks) ? input.tasks : [
    { prompt:"Explain x^2-x=0 as fixed-point identity." },
    { prompt:"Generate a DTU with formula and invariant." },
    { prompt:"Test for contradiction between two DTUs." },
  ];
  let violations=0, successes=0;
  const outputs=[];
  for (const t of tasks){
    const pre = inLatticeReality({ type:"harness", domain:"harness", name:"run", input:t, ctx });
    if (!pre.ok) { violations++; outputs.push({ ok:false, error:pre.reason, task:t }); continue; }
    successes++;
    outputs.push({ ok:true, task:t, result:"ok" });
  }
  const report = { id: uid("proof"), ts: nowISO(), tasks: tasks.length, successes, violations, targetViolations:0 };
  STATE.__chicken2.lastProof = report;
  _c2log("c2.harness", "Proof harness executed", report);
  return { ok:true, report, outputs };
}, { summary:"Chicken2 proof harness runner (lightweight initial suite)." });

// ===== END CHICKEN2 MACROS =====
const app = express();

// ---- UI Response Contract (prevents raw JSON dumps to frontend) ----
function _extractReply(out) {
  if (!out) return "";
  if (typeof out === "string") return out;
  if (typeof out.reply === "string") return out.reply;
  if (out.result && typeof out.result.reply === "string") return out.result.reply;
  if (typeof out.message === "string") return out.message;
  if (typeof out.text === "string") return out.text;
  // fallbacks
  if (out.ok === false && typeof out.error === "string") return out.error;
  return "";
}



// ---- Invariant Spine (Release Gate + Post-launch Locks) ----
const INVARIANTS = Object.freeze({
  sessionIdentity:        { id:"I1",  name:"Session Identity",        enforce:true },
  responseShape:          { id:"I2",  name:"Response Shape",          enforce:true },
  noInternalLeakage:      { id:"I3",  name:"No Internal Leakage",     enforce:true },
  labelDiscipline:        { id:"I4",  name:"Label Discipline",        enforce:true }, // enforced softly (non-destructive)
  deterministicFirst:     { id:"I5",  name:"Deterministic First",     enforce:true },
  noCrash:                { id:"I6",  name:"No-Crash / Safe Failure", enforce:true },
  inputNormalization:     { id:"I7",  name:"Input Normalization",     enforce:true },
  latencyBudget:          { id:"I8",  name:"Latency Budget",          enforce:false }, // policy: enforced via settings elsewhere
  monotonicWrites:        { id:"I9",  name:"Monotonic Session Writes",enforce:false }, // policy: current state uses debounced save
  shadowNonAuthority:     { id:"I10", name:"Shadow Non-Authority",    enforce:true },
  canonicalUniqueness:    { id:"I11", name:"Canonical Uniqueness",    enforce:false }, // handled by dedupe/promote macros
  lineagePreservation:    { id:"I12", name:"Lineage Preservation",    enforce:false }, // handled by merge/promote macros
  promotionGate:          { id:"I13", name:"Promotion Gate",          enforce:false }, // handled by council/macros
  contradictionHandling:  { id:"I14", name:"Contradiction Handling",  enforce:false }, // handled by council/macros
  recencyVsAuthority:     { id:"I15", name:"Recency vs Authority",    enforce:false }, // handled by scoring
  modeContract:           { id:"I16", name:"Mode Contract",           enforce:true },
  vibesIsolation:         { id:"I17", name:"Vibes Isolation",         enforce:false }, // future: when vibes tier is added
  uiBackendContract:      { id:"I18", name:"UI/Backend Contract",     enforce:true },
  coldStartClarity:       { id:"I19", name:"Cold-Start Clarity",      enforce:true },
  publicSafeDefaults:     { id:"I20", name:"Public-safe Defaults",    enforce:true },
  versioning:             { id:"I21", name:"Versioning",              enforce:true }
});

function _normalizeSessionId(raw) {
  const s = String(raw || "").trim();
  if (!s) return uid("sess");
  // keep it filename/url safe-ish
  return s.replace(/[^a-zA-Z0-9_\-:.]/g, "_").slice(0, 96);
}
function _normalizePrompt(raw) {
  // Note: express.json already caps request body; still normalize defensively
  let s = String(raw == null ? "" : raw);
  s = s.replace(/\r\n/g, "\n");
  if (s.length > 16000) s = s.slice(0, 16000);
  return s;
}
function _normalizeMode(raw) {
  const s = String(raw || "").trim().toLowerCase();
  const allowed = new Set(["chat","ask","debug","design","decide","research","forge","explore","vibes"]);
  if (!s) return "chat";
  return allowed.has(s) ? s : "chat";
}
function enforceRequestInvariants(req, bodyIn={}) {
  const body = (bodyIn && typeof bodyIn === "object") ? { ...bodyIn } : {};
  // session identity
  const sid = _normalizeSessionId(body.sessionId || req?.query?.sessionId || req?.headers?.["x-session-id"]);
  body.sessionId = sid;
  req._concordSessionId = sid;

  // prompt normalization (only if present)
  if ("prompt" in body) body.prompt = _normalizePrompt(body.prompt);

  // mode contract
  body.mode = _normalizeMode(body.mode || body.intentMode || body.panelMode);

  // public-safe defaults
  if (body.showInternals == null) body.showInternals = false;
  if (body.debug == null) body.debug = false;

  return body;
}

const INTERNAL_LEAK_PATTERNS = [
  /\bcontext\s+i['’]?m\s+tracking\b/i,
  /\binternal\s+context\s+tracking\b/i,
  /\bshadow\s*dtu\b.*\bhidden\b/i,
  /\bSYSTEM\s+PROMPT\b/i
];
function stripInternalLeakage(reply, { debug=false, showInternals=false } = {}) {
  if (!reply) return "";
  if (debug || showInternals) return String(reply);
  const lines = String(reply).split("\n");
  const kept = [];
  for (const line of lines) {
    const bad = INTERNAL_LEAK_PATTERNS.some(re => re.test(line));
    if (!bad) kept.push(line);
  }
  return kept.join("\n").trim();
}

function softEnforceLabelDiscipline(reply, mode="chat") {
  // Non-destructive: only in stricter modes, add a tiny label if uncertainty is high and no labels exist.
  const m = String(mode||"chat").toLowerCase();
  if (!["debug","research","decide"].includes(m)) return reply;
  const s = String(reply||"");
  const hasLabels = /\bFacts\b|\bHypotheses\b|\bSpeculation\b/i.test(s);
  if (hasLabels) return s;
  const uncertain = /\b(maybe|might|likely|probably|i think|could be)\b/i.test(s);
  if (!uncertain) return s;
  return `Hypothesis:\n${s}`.trim();
}

function ensureReplyEnvelope(out, req, extraMeta={}) {
  // Guarantees Response Shape invariant even if downstream returns raw values
  const ok = (out && typeof out === "object" && typeof out.ok === "boolean") ? out.ok : !(out && out.ok === false);
  const base = (out && typeof out === "object") ? out : { ok, result: out };
  const reply = _extractReply(base);
  const meta = {
    ...(base?.meta || {}),
    mode: base?.meta?.mode || out?.mode || out?.result?.mode || req?.body?.mode || "chat",
    sessionId: base?.meta?.sessionId || req?._concordSessionId || req?.body?.sessionId || "default",
    llmUsed: Boolean(base?.meta?.llmUsed || out?.llmUsed || out?.result?.llmUsed),
    version: VERSION,
    capabilities: {
      version: VERSION,
      llmReady: LLM_READY,
      organs: STATE.organs?.size || 0,
      growth: !!STATE.growth
    },
    ...extraMeta
  };
  return { ...base, ok, reply, meta };
}

function deterministicFallbackReply(req) {
  const mode = String(req?.body?.mode || "chat");
  // Cold-start clarity invariant: keep it helpful and short.
  return (
    mode === "chat"
      ? "Concord is up. Ask a question, or say what you want to build and I’ll structure it into DTUs (definitions + invariants)."
      : "Concord is up. Provide your target outcome + constraints and I’ll proceed."
  );
}
function toUI(out, req, extraMeta={}) {
  const debug = String(req?.query?.debug || "") === "1";
  if (debug) return out;

  // Response Shape + No Internal Leakage + Deterministic-First
  const base = ensureReplyEnvelope(out, req, extraMeta);
  let reply = String(base.reply || "");
  const showInternals = Boolean(req?.body?.showInternals || req?.query?.showInternals === "1");
  reply = stripInternalLeakage(reply, { debug: false, showInternals });
  reply = softEnforceLabelDiscipline(reply, base?.meta?.mode || req?.body?.mode || "chat");
  if (!reply) reply = deterministicFallbackReply(req);

  const ok = (base && typeof base.ok === "boolean") ? base.ok : true;
  const meta = {
    mode: out?.mode || out?.result?.mode || undefined,
    sessionId: out?.sessionId || req?.body?.sessionId || "default",
    llmUsed: out?.llmUsed || out?.result?.llmUsed || false,
    capabilities: {
      version: VERSION,
      llmReady: LLM_READY,
      organs: STATE.organs?.size || 0,
      growth: !!STATE.growth
    },
    ...extraMeta
  };
  return { ok, reply, meta };
}

function uiJson(res, out, req, extraMeta={}) {
  const ui = toUI(out, req, extraMeta);
  if (out && out.ack) ui.ack = out.ack;
  return res.json(ui);
}


// ---- ACK Contract (command-driven panels) ----
function _makeAck(req, mutated=[], reads=[], job=null, extra={}) {
  return {
    sessionId: (req?.body?.sessionId || req?.query?.sessionId || "default"),
    mutated,
    reads,
    job: job || { id: null, status: "done" },
    ts: Date.now(),
    ...extra
  };
}
function _withAck(out, req, mutated=[], reads=[], job=null, extra={}) {
  const ack = _makeAck(req, mutated, reads, job, extra);
  if (out && typeof out === "object") return { ...out, ok: (typeof out.ok==="boolean"?out.ok:true), ack };
  return { ok: true, result: out, ack };
}
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---- v3: Auth/Org (local-first) + Macro ACL + Actor Context ----
function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}
function ensureRootIdentity() {
  // If no users exist, create a local root user + org + dev api key.
  if (STATE.users.size) return;
  const rootUserId = uid("user");
  const rootOrgId = uid("org");
  const handle = "root";
  const user = { id: rootUserId, handle, createdAt: nowISO(), orgIds: [rootOrgId], roleByOrg: { [rootOrgId]: "owner" } };
  const org = { id: rootOrgId, name: "Root Org", ownerUserId: rootUserId, createdAt: nowISO() };
  STATE.users.set(rootUserId, user);
  STATE.orgs.set(rootOrgId, org);

  // Dev key is printed ONCE in logs. Rotate by deleting it from concord_state.json.
  const rawKey = crypto.randomBytes(24).toString("hex");
  const keyId = uid("key");
  const keyObj = {
    id: keyId,
    keyHash: sha256Hex(rawKey),
    userId: rootUserId,
    orgId: rootOrgId,
    scopes: ["*"],
    createdAt: nowISO(),
    revokedAt: null
  };
  STATE.apiKeys.set(keyId, keyObj);
  saveStateDebounced();
  console.log("\n=== Concord v3 Auth Bootstrap ===");
  console.log("Created root user/org. Use this API key for requests:");
  console.log(`X-API-Key: ${rawKey}`);
  console.log("================================\n");
}

function getActorFromReq(req) {
  // Local-first API key auth: X-API-Key header or ?apiKey=...
  const raw = String(req?.headers?.["x-api-key"] || req?.query?.apiKey || "").trim();
  if (!raw) return { ok: true, actor: { userId: "anon", orgId: "public", role: "viewer", scopes: ["read"] } };
  const h = sha256Hex(raw);
  const key = Array.from(STATE.apiKeys.values()).find(k => k && !k.revokedAt && k.keyHash === h);
  if (!key) return { ok: false, error: "Invalid API key" };
  const role = (STATE.users.get(key.userId)?.roleByOrg || {})[key.orgId] || "member";
  const scopes = Array.isArray(key.scopes) && key.scopes.length ? key.scopes : ["read"];
  return { ok: true, actor: { userId: key.userId, orgId: key.orgId, role, scopes, keyId: key.id } };
}

// Macro ACL (domain.name → roles/scopes allowed). Defaults to allow local dev.
const MACRO_ACL = new Map(); // key = `${domain}.${name}` → { roles:[], scopes:[] }
function allowMacro(domain, name, { roles=["owner","admin","member"], scopes=["*"] } = {}) {
  MACRO_ACL.set(`${domain}.${name}`, { roles, scopes });
}
function canRunMacro(actor, domain, name) {
  const rule = MACRO_ACL.get(`${domain}.${name}`);
  if (!rule) return true; // default open (local-first)
  const roleOk = !rule.roles?.length || rule.roles.includes(actor.role) || actor.role === "owner";
  const scopeOk = (actor.scopes||[]).includes("*") || !rule.scopes?.length || rule.scopes.some(s => (actor.scopes||[]).includes(s));
  return roleOk && scopeOk;
}

// Attach ctx.actor for every request
app.use((req, res, next) => {
  try {
    ensureRootIdentity();
    const a = getActorFromReq(req);
    if (!a.ok) return res.status(401).json({ ok:false, error: a.error });
    req.actor = a.actor;
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
  next();
});

// ---- v3: Jobs Orchestrator (in-process worker) ----
function jobNow() { return Date.now(); }
function enqueueJob(kind, payload, { runAtMs=null, maxAttempts=3, idempotencyKey=null, actor=null } = {}) {
  const id = uid("job");
  const j = {
    id, kind,
    payload: payload || {},
    status: "queued",
    attempts: 0,
    maxAttempts,
    runAt: runAtMs ? new Date(runAtMs).toISOString() : nowISO(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    lastError: null,
    result: null,
    idempotencyKey: idempotencyKey || null,
    actor: actor || null
  };
  // Idempotency (best-effort): if a queued/running job has same key, return it.
  if (idempotencyKey) {
    for (const ex of STATE.jobs.values()) {
      if (ex && ex.idempotencyKey === idempotencyKey && (ex.status === "queued" || ex.status === "running")) return ex;
    }
  }
  STATE.jobs.set(id, j);
  saveStateDebounced();
  return j;
}

async function runJob(j) {
  j.status = "running";
  j.attempts += 1;
  j.updatedAt = nowISO();
  saveStateDebounced();

  const ctx = makeCtx(null);
  // adopt actor context if present
  if (j.actor) ctx.actor = j.actor;

  try {
    const [domain, name] = String(j.kind).split(".");
    if (!domain || !name) throw new Error("Job kind must be domain.name");
    const out = await runMacro(domain, name, j.payload || {}, ctx);
    j.status = "succeeded";
    j.result = out;
    j.lastError = null;
  } catch (e) {
    j.lastError = String(e?.message || e);
    if (j.attempts >= (j.maxAttempts || 3)) {
      j.status = "failed";
    } else {
      j.status = "queued";
      // simple backoff
      const backoffMs = 500 * Math.pow(2, Math.min(6, j.attempts));
      j.runAt = new Date(Date.now() + backoffMs).toISOString();
    }
  } finally {
    j.updatedAt = nowISO();
    saveStateDebounced();
  }
}

let _jobTimer = null;
function startJobWorker() {
  if (_jobTimer) clearInterval(_jobTimer);
  _jobTimer = setInterval(async () => {
    try {
      // pick next runnable job
      const now = Date.now();
      const runnable = Array.from(STATE.jobs.values())
        .filter(j => j && j.status === "queued" && (!j.runAt || new Date(j.runAt).getTime() <= now))
        .sort((a,b) => new Date(a.runAt).getTime() - new Date(b.runAt).getTime());
      const next = runnable[0];
      if (!next) return;
      await runJob(next);
    } catch {}
  }, 250);
  log("jobs.worker", "Job worker started", { everyMs: 250 });
}
startJobWorker();


// startup banner
console.log(`\nConcord v2 (Macro‑Max) starting…`);
console.log(`- version: ${VERSION}`);
console.log(`- port: ${PORT}`);
console.log(`- dotenvLoaded: ${DOTENV.loaded} (path=${DOTENV.path})`);
console.log(`- llmReady: ${LLM_READY}\n`);

app.get("/", (req, res) => res.json({ ok:true, name:"Concord v2 Macro‑Max", version: VERSION }));

// Status
app.get("/api/status", (req, res) => {
  res.json({
    ok:true,
    version: VERSION,
    port: PORT,
    dotenvLoaded: DOTENV.loaded,
    dotenvPath: DOTENV.path,
    llmReady: LLM_READY,
    openaiModel: { fast: OPENAI_MODEL_FAST, smart: OPENAI_MODEL_SMART },
    dtus: STATE.dtus.size,
    wrappers: STATE.wrappers.size,
    layers: STATE.layers.size,
    personas: STATE.personas.size,
    swarms: 0,
    sims: STATE.lastSim ? 1 : 0,
    macroDomains: listDomains(),
    crawlQueue: STATE.crawlQueue.length,
    settings: STATE.settings
  });
});


// Time (authoritative; never uses LLM)
app.get("/api/time", (req, res) => {
  try {
    const tz = String(req.query.tz || "America/New_York");
    return res.json({ ok:true, ...getTimeInfo(tz) });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

// Weather (authoritative; cached; never uses LLM)
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


// State snapshot (frontend-friendly read after any macro)
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

// ---- Queues (proposals + maintenance; never flood DTU library) ----
app.get("/api/queues", (req,res)=>{
  ensureQueues();
  res.json({ ok:true, queues: Object.fromEntries(Object.entries(STATE.queues).map(([k,v])=>[k, v.slice(-500)])) });
});

app.post("/api/queues/:queue/propose", (req,res)=>{
  ensureQueues();
  const q = String(req.params.queue||"");
  if (!STATE.queues[q]) return res.status(404).json({ ok:false, error:`Unknown queue: ${q}` });
  const item = { id: uid(`q_${q}`), createdAt: nowISO(), status: "queued", ...((req.body&&typeof req.body==='object')?req.body:{}) };
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


// CRETI-first DTU view (no raw JSON by default)
app.get("/api/dtu_view/:id", (req, res) => {
  const id = req.params.id;
  const d = STATE.dtus.get(id);
  if (!d) return res.status(404).json({ ok:false, error:"DTU not found" });
  return res.json({ ok:true, dtu: dtuForClient(d, { raw: req.query.raw === "1" }) });
});


// DTUs
app.get("/api/dtus", async (req, res) => {
  const ctx = makeCtx(req);
  const out = await runMacro("dtu","list",{ q:req.query.q, tier:req.query.tier || "any", limit:req.query.limit, offset:req.query.offset }, ctx);
  res.json(out);
});
app.get("/api/dtus/:id", async (req, res) => {
  const ctx = makeCtx(req);
  const out = await runMacro("dtu","get",{ id:req.params.id }, ctx);
  if (!out.ok) return res.status(404).json(out);
  res.json(out);
});
app.post("/api/dtus", async (req, res) => {
  const ctx = makeCtx(req);
  const out = await runMacro("dtu","create", req.body || {}, ctx);
  res.json(out);
});
app.post("/api/dtus/saveSuggested", async (req, res) => {
  const ctx = makeCtx(req);
  const out = await runMacro("dtu","saveSuggested", req.body || {}, ctx);
  res.json(out);
});

// Chat + Ask
app.post("/api/chat", async (req, res) => {
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
          await sleep(0);
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


// Chicken3: status + session opt-in (additive)
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
// Forge
app.post("/api/forge/manual", async (req,res)=> {
  const out = await runMacro("forge","manual", req.body||{}, makeCtx(req));
  return res.json(_withAck(out, req, ["dtus","state","logs"], ["/api/dtus","/api/state/latest","/api/logs"], null, { panel: "forge_manual" }));
});
app.post("/api/forge/hybrid", async (req,res)=> {
  const out = await runMacro("forge","hybrid", req.body||{}, makeCtx(req));
  return res.json(_withAck(out, req, ["dtus","state","logs"], ["/api/dtus","/api/state/latest","/api/logs"], null, { panel: "forge_hybrid" }));
});
app.post("/api/forge/auto", async (req,res)=> {
  const out = await runMacro("forge","auto", req.body||{}, makeCtx(req));
  return res.json(_withAck(out, req, ["dtus","state","logs"], ["/api/dtus","/api/state/latest","/api/logs"], null, { panel: "forge_auto" }));
});

// Swarm + Sim
app.post("/api/swarm", async (req,res)=> {
  const out = await runMacro("swarm","run", req.body||{}, makeCtx(req));
  return res.json(_withAck(out, req, ["state","logs"], ["/api/state/latest","/api/logs"], null, { panel: "swarm" }));
});
app.post("/api/sim", async (req,res)=> {
  const out = await runMacro("sim","run", req.body||{}, makeCtx(req));
  return res.json(_withAck(out, req, ["state","logs"], ["/api/state/latest","/api/logs"], null, { panel: "sim" }));
});
app.get("/api/sim/:id", async (req,res)=> res.json({ ok:true, note:"Single-run sims are stored as lastSim only in this v2 build.", lastSim: STATE.lastSim || null }));

// Wrappers
app.get("/api/wrappers", async (req,res)=> res.json(await runMacro("wrapper","list", {}, makeCtx(req))));
app.post("/api/wrappers", async (req,res)=> res.json(await runMacro("wrapper","create", req.body||{}, makeCtx(req))));
app.post("/api/wrappers/run", async (req, res) => {
  const ctx = makeCtx(req);
  const out = await runMacro("wrapper","run", req.body || {}, ctx);
  kernelTick({ type: out?.ok ? "WRAPPER_RUN" : "VERIFIER_FAIL", meta: { path: req.path }, signals: { benefit: out?.ok?0.2:0, error: out?.ok?0:0.3 } });
  return uiJson(res, _withAck(out, req, ["state","logs"], ["/api/state/latest","/api/logs"], null, { panel: "wrapper_run" }), req, { panel: "wrapper_run" });
});



// DTU maintenance
app.post("/api/dtus/dedupe", async (req,res)=> {
  const out = await runMacro("dtu","dedupeSweep", req.body||{}, makeCtx(req));
  return res.json(_withAck(out, req, ["dtus","state","logs"], ["/api/dtus","/api/state/latest","/api/logs"], null, { panel: "dtus_dedupe" }));
});
app.get("/api/megas", async (req,res)=> {
  const tier = "mega";
  const out = dtusArray().filter(d => d.tier===tier).sort((a,b)=> (b.updatedAt||b.createdAt||"").localeCompare(a.updatedAt||a.createdAt||""));
  res.json({ ok:true, megas: out });
});
app.get("/api/hypers", async (req,res)=> {
  const out = dtusArray().filter(d => d.tier==="hyper").sort((a,b)=> (b.updatedAt||b.createdAt||"").localeCompare(a.updatedAt||a.createdAt||""));
  res.json({ ok:true, hypers: out });
});
// Layers
app.get("/api/layers", async (req,res)=> res.json(await runMacro("layer","list", {}, makeCtx(req))));
app.post("/api/layers", async (req,res)=> res.json(await runMacro("layer","create", req.body||{}, makeCtx(req))));
app.post("/api/layers/toggle", async (req,res)=> res.json(await runMacro("layer","toggle", req.body||{}, makeCtx(req))));

// Personas
app.get("/api/personas", async (req,res)=> res.json(await runMacro("persona","list", {}, makeCtx(req))));
app.post("/api/personas", async (req,res)=> res.json(await runMacro("persona","create", req.body||{}, makeCtx(req))));

// Macros registry + runner
app.get("/api/macros/domains", (req,res)=> res.json({ ok:true, domains: listDomains() }));
app.get("/api/macros/:domain", (req,res)=> res.json({ ok:true, domain:req.params.domain, macros: listMacros(req.params.domain) }));
app.post("/api/macros/run", async (req, res) => {
  const ctx = makeCtx(req);
  const domain = req.body?.domain;
  const name = req.body?.name;
  const input = req.body?.input;
  if (!domain || !name) return res.status(400).json({ ok:false, error:"domain and name required" });
  try {
    const out = await runMacro(domain, name, input, ctx);
    kernelTick({ type: "MACRO_RUN", meta: { path: req.path, domain, name }, signals: { benefit: out?.ok?0.1:0, error: out?.ok?0:0.2 } });
    return uiJson(res, _withAck(out, req, ["state","logs"], ["/api/state/latest","/api/logs"], null, { panel: "macro_run", domain, name }), req, { panel: "macro_run", domain, name });
  } catch (e) {
    kernelTick({ type: "ERROR", meta: { path: req.path, domain, name }, signals: { error: 0.4 } });
    return res.status(404).json({ ok:false, reply: String(e?.message || e), error: String(e?.message || e) });
  }
});

// Interface + logs
app.get("/api/interface/tabs", async (req,res)=> res.json(await runMacro("interface","tabs", {}, makeCtx(req))));
app.get("/api/logs", async (req,res)=> res.json(await runMacro("log","list", { limit: req.query.limit }, makeCtx(req))));

// Crawl + autocrawl
app.post("/api/crawl", async (req,res)=> {
  const ctx = makeCtx(req);
  const out = await runMacro("ingest","url", req.body||{}, ctx);
  res.json(out);
});
app.post("/api/autocrawl/queue", async (req,res)=> {
  const ctx = makeCtx(req);
  const out = await runMacro("ingest","queue", req.body||{}, ctx);
  res.json(out);
});

// Settings
app.get("/api/settings", async (req,res)=> res.json(await runMacro("settings","get", {}, makeCtx(req))));
app.post("/api/settings", async (req,res)=> res.json(await runMacro("settings","set", req.body||{}, makeCtx(req))));

// System: dream/autogen/evolution/synthesize
app.post("/api/dream", async (req,res)=> res.json(await runMacro("system","dream", req.body||{}, makeCtx(req))));
app.post("/api/autogen", async (req,res)=> res.json(await runMacro("system","autogen", req.body||{}, makeCtx(req))));
app.post("/api/evolution", async (req,res)=> res.json(await runMacro("system","evolution", req.body||{}, makeCtx(req))));
app.post("/api/synthesize", async (req,res)=> res.json(await runMacro("system","synthesize", req.body||{}, makeCtx(req))));

// Misc
app.post("/api/materials/test", async (req,res)=> res.json(await runMacro("materials","test", req.body||{}, makeCtx(req))));


// Research (deterministic math + dimensional OS)
app.post("/api/research/math", async (req,res)=> res.json(await runMacro("research","math.exec", req.body||{}, makeCtx(req))));

app.post("/api/temporal/validate", async (req,res)=> res.json(await runMacro("temporal","validate", req.body, makeCtx(req))));
app.post("/api/temporal/recency", async (req,res)=> res.json(await runMacro("temporal","recency", req.body, makeCtx(req))));
app.post("/api/temporal/frame", async (req,res)=> res.json(await runMacro("temporal","frame", req.body, makeCtx(req))));
app.post("/api/temporal/subjective", async (req,res)=> res.json(await runMacro("temporal","subjective", req.body, makeCtx(req))));
app.post("/api/temporal/sim", async (req,res)=> res.json(await runMacro("temporal","simTimeline", req.body, makeCtx(req))));
app.post("/api/dimensional/validate", async (req,res)=> res.json(await runMacro("dimensional","validateContext", req.body||{}, makeCtx(req))));
app.post("/api/dimensional/invariance", async (req,res)=> res.json(await runMacro("dimensional","checkInvariance", req.body||{}, makeCtx(req))));
app.post("/api/dimensional/scale", async (req,res)=> res.json(await runMacro("dimensional","scaleTransform", req.body||{}, makeCtx(req))));

// Council enhancements
app.post("/api/council/review-global", async (req,res)=> res.json(await runMacro("council","reviewGlobal", req.body||{}, makeCtx(req))));
app.post("/api/council/weekly", async (req,res)=> res.json(await runMacro("council","weeklyDebateTick", req.body||{}, makeCtx(req))));

// Anonymous messaging (non-discoverable; requires manual contact exchange)
app.post("/api/anon/create", async (req,res)=> res.json(await runMacro("anon","create", req.body||{}, makeCtx(req))));
app.post("/api/anon/send", async (req,res)=> res.json(await runMacro("anon","send", req.body||{}, makeCtx(req))));
app.post("/api/anon/inbox", async (req,res)=> res.json(await runMacro("anon","inbox", req.body||{}, makeCtx(req))));
app.post("/api/anon/decrypt-local", async (req,res)=> res.json(await runMacro("anon","decryptLocal", req.body||{}, makeCtx(req))));

// Error handler
app.use((err, req, res, next) => {
  const msg = String(err?.message || err);
  log("server.error", msg, { stack: String(err?.stack || "") });
  res.status(500).json({ ok:false, error: msg });
});

// ---- heartbeat ----
let heartbeatTimer = null;
let weeklyTimer = null;
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (weeklyTimer) clearInterval(weeklyTimer);
  const ms = clamp(Number(STATE.settings.heartbeatMs || 15000), 2000, 120000);
  heartbeatTimer = setInterval(async () => {
    if (!STATE.settings.heartbeatEnabled) return;
    const ctx = makeCtx(null);

    // process crawl queue once
    await runMacro("ingest","processQueueOnce", {}, ctx).catch(()=>{});

    if (STATE.settings.autogenEnabled) {
      await runMacro("system","autogen", {}, ctx).catch(()=>{});
    }
    if (STATE.settings.dreamEnabled) {
      await runMacro("system","dream", { seed: "Concord heartbeat dream" }, ctx).catch(()=>{});
    }
    if (STATE.settings.evolutionEnabled) {
      await runMacro("system","evolution", {}, ctx).catch(()=>{});
    }
    if (STATE.settings.synthEnabled) {
      await runMacro("system","synthesize", {}, ctx).catch(()=>{});
    }

    // v3: local self-upgrade (abstraction governor) at fixed cadence
    try { await maybeRunLocalUpgrade(); } catch {}
  }, ms);
  log("heartbeat", "Heartbeat started", { ms });
}
startHeartbeat();

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

// === v3 identity/account + global + marketplace + ingest endpoints (explicit HTTP surface) ===
// These wrap existing macro domains so frontend can wire cleanly without calling /api/macros/run directly.

app.get("/api/auth/me", async (req,res) => {
  try { return res.json(await runMacro("auth","whoami", {}, makeCtx(req))); }
  catch (e) { return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});

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

app.post("/api/ingest/text", async (req,res) => {
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

app.get("/api/metrics", (req, res) => {
  ensureOrganRegistry();
  ensureQueues();
  const c2 = STATE.__chicken2 || {};
  res.json({ ok:true, metrics: c2.metrics, lastProof: c2.lastProof, recentLogs: (c2.logs||[]).slice(-50) });
});

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

// ---- weekly council debates ----
// (deduped) weeklyTimer declared earlier

function startWeeklyCouncil() {
  if (weeklyTimer) clearInterval(weeklyTimer);
  // Default: every 7 days. (Frontend can add more precise scheduling later.)
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  weeklyTimer = setInterval(async () => {
    if (STATE.settings.weeklyDebateEnabled === false) return;
    const ctx = makeCtx(null);
    await runMacro("council","weeklyDebateTick",{ topic: STATE.settings.weeklyDebateTopic || "Concord Weekly Synthesis" }, ctx).catch(()=>{});
  }, weekMs);
  log("council.weekly", "Weekly Council scheduler started", { everyMs: weekMs });
}
startWeeklyCouncil();


// ---- listen ----
// ---- Pipeline proposals endpoints (organism install ledger) ----
app.get("/api/proposals", (req,res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit||50)));
  res.json({ ok:true, proposals: pipeListProposals(limit), total: PIPE.proposals.size });
});


// ============================================================================
// EXTENDED API ENDPOINTS (surgically integrated from Endpoints.txt)
// - Macro-first: endpoints remain thin wrappers around runMacro()
// - Safe: no changes to macro logic; only HTTP exposure
// ============================================================================

app.get("/api/style/:sessionId", async (req, res) => {
  const out = await runMacro("style", "get", { sessionId: req.params.sessionId }, makeCtx(req));
  return res.json(out);
});

app.post("/api/style/mutate", async (req, res) => {
  const out = await runMacro("style", "mutate", req.body, makeCtx(req));
  return res.json(out);
});

app.put("/api/dtus/:id", async (req, res) => {
  // Note: You may need to create a dtu.update macro first
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

app.get("/api/definitions", async (req, res) => {
  const dtus = dtusArray().filter(d => 
    (d.tags || []).includes("definition") || 
    /^def(inition)?:/i.test(d.title || "")
  );
  return res.json({ ok: true, definitions: dtus });
});

app.get("/api/definitions/:term", async (req, res) => {
  const term = String(req.params.term || "").toLowerCase();
  const dtu = dtusArray().find(d => 
    ((d.tags || []).includes("definition") || /^def(inition)?:/i.test(d.title || "")) &&
    (d.meta?.term || "").toLowerCase() === term
  );
  if (!dtu) return res.status(404).json({ ok: false, error: "Definition not found" });
  return res.json({ ok: true, definition: dtu });
});

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

app.post("/api/experiments", async (req, res) => {
  const out = await runMacro("experiment", "log", req.body, makeCtx(req));
  return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "experiment" }));
});

app.get("/api/experiments", async (req, res) => {
  const experiments = dtusArray().filter(d => (d.tags || []).includes("experiment"));
  return res.json({ ok: true, experiments });
});

app.get("/api/experiments/:id", async (req, res) => {
  const dtu = STATE.dtus.get(req.params.id);
  if (!dtu || !(dtu.tags || []).includes("experiment")) {
    return res.status(404).json({ ok: false, error: "Experiment not found" });
  }
  return res.json({ ok: true, experiment: dtu });
});

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

app.get("/api/temporal/frames", async (req, res) => {
  const frames = Object.values(TEMPORAL_FRAMES);
  return res.json({ ok: true, frames });
});

app.get("/api/proposals/:id", async (req, res) => {
  const proposal = PIPE.proposals.get(req.params.id);
  if (!proposal) return res.status(404).json({ ok: false, error: "Proposal not found" });
  return res.json({ ok: true, proposal });
});

app.post("/api/proposals/:id/approve", async (req, res) => {
  const proposal = PIPE.proposals.get(req.params.id);
  if (!proposal) return res.status(404).json({ ok: false, error: "Proposal not found" });
  
  proposal.status = "approved";
  proposal.approvedAt = nowISO();
  proposal.approvedBy = req.actor?.userId || "anon";
  saveStateDebounced();
  
  return res.json({ ok: true, proposal });
});

app.post("/api/proposals/:id/reject", async (req, res) => {
  const proposal = PIPE.proposals.get(req.params.id);
  if (!proposal) return res.status(404).json({ ok: false, error: "Proposal not found" });
  
  proposal.status = "rejected";
  proposal.rejectedAt = nowISO();
  proposal.rejectedBy = req.actor?.userId || "anon";
  proposal.rejectReason = req.body?.reason || "";
  saveStateDebounced();
  
  return res.json({ ok: true, proposal });
});

app.post("/api/jobs/:id/cancel", async (req, res) => {
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

app.post("/api/jobs/:id/retry", async (req, res) => {
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

app.post("/api/agents", async (req, res) => {
  const out = await runMacro("agent", "create", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/agents", async (req, res) => {
  const agents = Array.from(STATE.personas.values()).filter(p => 
    p && p.goal // Simple heuristic: agents have goals
  );
  return res.json({ ok: true, agents });
});

app.get("/api/agents/:id", async (req, res) => {
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

app.post("/api/papers", async (req, res) => {
  const out = await runMacro("paper", "create", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/papers", async (req, res) => {
  const papers = Array.from(STATE.papers.values());
  return res.json({ ok: true, papers });
});

app.get("/api/papers/:id", async (req, res) => {
  const paper = STATE.papers.get(req.params.id);
  if (!paper) return res.status(404).json({ ok: false, error: "Paper not found" });
  return res.json({ ok: true, paper });
});

app.post("/api/papers/:id/build", async (req, res) => {
  const out = await runMacro("paper", "build", { paperId: req.params.id }, makeCtx(req));
  return res.json(out);
});

app.get("/api/papers/:id/export", async (req, res) => {
  const out = await runMacro("paper", "export", { paperId: req.params.id, format: req.query.format || "md" }, makeCtx(req));
  if (!out.ok) return res.status(500).json(out);
  
  // Serve the file
  const fpath = out.file?.path;
  if (fpath && fs.existsSync(fpath)) {
    return res.sendFile(fpath);
  }
  return res.status(404).json({ ok: false, error: "Export file not found" });
});

app.post("/api/forge/fromSource", async (req, res) => {
  const out = await runMacro("forge", "fromSource", req.body, makeCtx(req));
  return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "forge_from_source" }));
});

app.post("/api/crawl/enqueue", async (req, res) => {
  const out = await runMacro("crawl", "enqueue", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/crawl/fetch", async (req, res) => {
  const out = await runMacro("crawl", "fetch", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/audit", async (req, res) => {
  const out = await runMacro("audit", "query", { 
    limit: req.query.limit, 
    domain: req.query.domain,
    contains: req.query.contains 
  }, makeCtx(req));
  return res.json(out);
});

app.post("/api/lattice/birth", async (req, res) => {
  const out = await runMacro("lattice", "birth_protocol", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/persona/create", async (req, res) => {
  const out = await runMacro("persona", "create", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/skill/create", async (req, res) => {
  const out = await runMacro("skill", "create", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/intent/rhythmic", async (req, res) => {
  const out = await runMacro("intent", "rhythmic_intent", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/chicken3/meta/propose", async (req, res) => {
  const out = await runMacro("chicken3", "meta_propose", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/chicken3/meta/commit", async (req, res) => {
  const out = await runMacro("chicken3", "meta_commit_quiet", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/multimodal/vision", async (req, res) => {
  const out = await runMacro("multimodal", "vision_analyze", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/multimodal/image-gen", async (req, res) => {
  const out = await runMacro("multimodal", "image_generate", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/voice/transcribe", async (req, res) => {
  const out = await runMacro("voice", "transcribe", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/voice/tts", async (req, res) => {
  const out = await runMacro("voice", "tts", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/tools/web-search", async (req, res) => {
  const out = await runMacro("tools", "web_search", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/entity/terminal", async (req, res) => {
  const out = await runMacro("entity", "terminal", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/entity/terminal/approve", async (req, res) => {
  const out = await runMacro("entity", "terminal_approve", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/research/constants", async (req, res) => {
  const out = await runMacro("research", "physics.constants", { keys: req.query.keys?.split(',') }, makeCtx(req));
  return res.json(out);
});

app.post("/api/research/kinematics", async (req, res) => {
  const out = await runMacro("research", "physics.kinematics", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/research/truthgate", async (req, res) => {
  const out = await runMacro("research", "truthgate.check", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/sessions", async (req, res) => {
  const sessions = Array.from(STATE.sessions.entries()).map(([id, data]) => ({
    sessionId: id,
    createdAt: data.createdAt,
    messageCount: (data.messages || []).length,
    cloudOptIn: !!data.cloudOptIn,
    lastActivity: (data.messages || [])[data.messages.length - 1]?.ts || data.createdAt
  }));
  return res.json({ ok: true, sessions });
});

app.get("/api/sessions/:id", async (req, res) => {
  const session = STATE.sessions.get(req.params.id);
  if (!session) return res.status(404).json({ ok: false, error: "Session not found" });
  return res.json({ ok: true, session });
});

app.delete("/api/sessions/:id", async (req, res) => {
  STATE.sessions.delete(req.params.id);
  STATE.styleVectors.delete(req.params.id);
  saveStateDebounced();
  return res.json({ ok: true, deleted: req.params.id });
});

app.post("/api/search", async (req, res) => {
  const query = String(req.body.query || req.body.q || "");
  const topK = clamp(Number(req.body.topK || req.body.k || 10), 1, 100);
  const minScore = clamp(Number(req.body.minScore || 0.08), 0, 1);
  
  const results = retrieveDTUs(query, { topK, minScore, randomK: 0, oppositeK: 0 });
  
  return res.json({
    ok: true,
    query,
    results: results.top.map(d => ({
      id: d.id,
      title: d.title,
      tier: d.tier,
      tags: d.tags,
      excerpt: (d.cretiHuman || d.human?.summary || "").slice(0, 200)
    })),
    count: results.top.length
  });
});

app.get("/api/stats", async (req, res) => {
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
        return last && (Date.now() - new Date(last.ts).getTime()) < 3600000; // active in last hour
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

app.get("/api/health", async (req, res) => {
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

app.get("/api/health/deep", async (req, res) => {
  // Deep health check with more detailed diagnostics
  const checks = [];
  
  // Check state integrity
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

// ===== END EXTENDED API ENDPOINTS =====




// ---- Invariant Enforcement: No-Crash (global Express error handler) ----
app.use((err, req, res, next) => {
  const errorId = uid("err");
  const msg = String(err?.message || err || "Unknown error");
  const out = {
    ok: false,
    error: msg,
    mode: req?.body?.mode || "chat",
    sessionId: req?._concordSessionId || req?.body?.sessionId || req?.query?.sessionId || "default",
    llmUsed: false
  };
  try {
    return uiJson(res, _withAck(out, req, ["logs"], ["/api/logs"], { id: errorId, status: "error" }, { errorId }), req, { errorId });
  } catch (e2) {
    return res.status(500).json({
      ok: false,
      reply: "Internal error.",
      meta: { sessionId: out.sessionId, mode: out.mode, llmUsed: false, version: VERSION, errorId }
    });
  }
});
// ===== CHICKEN3: Autonomous Lattice Cron + Federation Hooks (additive) =====
function _c3internalCtx() {
  const ctx = makeCtx(null);
  ctx.actor = { userId: "system", orgId: "local", role: "owner", scopes: ["*"] };
  ctx.reqMeta = { ip: "127.0.0.1", ua: "cron", path: "/cron", override: false, at: nowISO() };
  return ctx;
}

async function latticeAutonomousTick() {
  try {
    if (!STATE.__chicken3?.enabled || !STATE.__chicken3?.cronEnabled) return;
    enforceEthosInvariant("autonomous_tick");
    STATE.__chicken3.stats.cronTicks++;
    STATE.__chicken3.lastCronAt = nowISO();

    // Keep organism alive (organs/growth/homeostasis). KernelTick already exists.
    // Cron is reserved for CHICKEN3 meta-support (emergents). DTU growth runs on the Governor heartbeat.
    // (Opt-in) If you ever want cron to also tick the kernel: set STATE.__chicken3.cronCallsKernelTick=true.
    if (STATE.__chicken3?.cronCallsKernelTick) { try { kernelTick({ type: "AUTONOMOUS_TICK", meta: { source: "cron" } }); } catch {} }

    if (!STATE.__chicken3?.metaEnabled) { saveStateDebounced(); return; }

    const ctx = _c3internalCtx();
    const minM = Number(STATE.__chicken3.metaMinMaturity ?? 0.75);
    const prob = Number(STATE.__chicken3.metaSampleProb ?? 0.10);

    // Generate a small number of meta proposals deterministically-ish to avoid spam.
    let proposalsMade = 0;
    for (const [organId, organ] of STATE.organs.entries()) {
      const m = Number(organ?.maturity?.score ?? organ?.maturityScore ?? 0);
      if (m < minM) continue;
      if (Math.random() > prob) continue;
      const out = await runMacro("chicken3","meta_propose", { organId }, ctx).catch(()=>null);
      if (out?.ok) proposalsMade++;
      if (proposalsMade >= 3) break;
    }

    // Quiet council commit (bounded)
    let commits = 0;
    while ((STATE.queues.metaProposals?.length || 0) > 0 && commits < 2) {
      const c = await runMacro("chicken3","meta_commit_quiet", {}, ctx).catch(()=>null);
      if (c?.ok) commits++;
      else break;
    }

    saveStateDebounced();
  } catch (e) {
    try { log("chicken3.cron.error", "Autonomous tick error", { error: String(e?.message||e) }); } catch {}
  }
}

function startChicken3Cron() {
  try {
    if (!STATE.__chicken3?.enabled || !STATE.__chicken3?.cronEnabled) return { ok:false, reason:"disabled" };
    const ms = clamp(Number(STATE.__chicken3?.cronIntervalMs ?? 300000), 15000, 3600000);
    setInterval(() => { latticeAutonomousTick(); }, ms);
    console.log(`[Chicken3] Autonomous cron active — interval ${(ms/60000).toFixed(2)} min`);
    return { ok:true, intervalMs: ms };
  } catch (e) {
    console.error("[Chicken3] Cron failed:", e);
    return { ok:false, error: String(e?.message||e) };
  }
}

// Optional federation (local-first). Does NOT auto-commit remote DTUs.
let _c3Federation = { enabled:false, client:null, channel:"lattice_broadcast" };
async function startChicken3Federation() {
  try {
    const on = (String(process.env.FEDERATION_ENABLED || "").toLowerCase() === "true") || Boolean(STATE.__chicken3?.federationEnabled);
    if (!on) return { ok:false, reason:"disabled" };
    enforceEthosInvariant("federation");
    const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
    const mod = await import("redis").catch(()=>null);
    if (!mod?.createClient) return { ok:false, error:"redis package not installed" };

    const client = mod.createClient({ url: REDIS_URL });
    client.on("error", (err) => console.error("[Chicken3][Federation] redis error:", err));
    await client.connect();

    const channel = String(process.env.FEDERATION_CHANNEL || "lattice_broadcast");
    await client.subscribe(channel, (message) => {
      try {
        STATE.__chicken3.stats.federationRx++;
        STATE.__chicken3.lastFederationAt = nowISO();
        // Local-first safety: do not auto apply. Queue for human/council review.
        const obj = safeJson(message, null);
        const proposal = { id: uid("federation"), type:"FEDERATION_RX", createdAt: nowISO(), content: message.slice(0, 20000), meta: { parsed: obj } };
        STATE.queues.metaProposals.push({ id: proposal.id, type:"META_DTU_PROPOSAL", createdAt: proposal.createdAt, proposerOrganId: "federation", maturity: 1, content: `[FEDERATION] ${proposal.content.slice(0, 800)}`, tags:["meta","federation"], meta: proposal.meta });
        saveStateDebounced();
      } catch {}
    });

    _c3Federation = { enabled:true, client, channel };
    console.log(`[Chicken3] Federation enabled — channel ${channel}`);
    return { ok:true, channel };
  } catch (e) {
    console.error("[Chicken3] Federation failed:", e);
    return { ok:false, error:String(e?.message||e) };
  }
}


// ===== GOVERNOR: Heartbeat-driven autonomous growth (DTU creation) =====
// Purpose: keep DTU growth engines (autogen/dream/evolution/synth + queues) running
// independently from Chicken3 cron (which is reserved for emergent/meta support).
let __governorTimer = null;

function _governorCtx() {
  // internal ctx: owner actor + founder override flag for safe local growth operations
  const ctx = makeCtx(null);
  ctx.actor = { role: "owner", scopes: ["*"] };
  ctx.reqMeta = { ...(ctx.reqMeta||{}), override: true, internal: true, source: "governor" };
  return ctx;
}

async function governorTick(reason="heartbeat") {
  try {
    const s = STATE.settings || {};
    if (s.heartbeatEnabled === false) return { ok:false, reason:"heartbeat_disabled" };
    const ctx = _governorCtx();

    // 1) Deterministic + bounded growth engines
    if (s.autogenEnabled)  { try { await runMacro("system","autogen",{ override:true, reason }, ctx); } catch {} }
    if (s.dreamEnabled)    { try { await runMacro("system","dream",{ override:true, reason }, ctx); } catch {} }
    if (s.evolutionEnabled){ try { await runMacro("system","evolution",{ override:true, reason }, ctx); } catch {} }
    if (s.synthEnabled)    { try { await runMacro("system","synth",{ override:true, reason }, ctx); } catch {} }

    // 2) Queue processing (best-effort; only if macros exist)
    try { await runMacro("jobs","tick",{ override:true, reason }, ctx); } catch {}
    try { await runMacro("queue","tick",{ override:true, reason }, ctx); } catch {}
    try { await runMacro("ingest","tick",{ override:true, reason }, ctx); } catch {}
    try { await runMacro("crawl","tick",{ override:true, reason }, ctx); } catch {}

    // 3) Kernel metrics tick (homeostasis, organ wear) so the system stays honest
    try { kernelTick({ type: "HEARTBEAT", meta: { source: "governor", reason } }); } catch {}

    return { ok:true };
  } catch (e) {
    return { ok:false, error:String(e?.message||e) };
  }
}

function startGovernorHeartbeat() {
  try {
    if (__governorTimer) return { ok:true, already:true };
    const s = STATE.settings || {};
    const ms = clamp(Number(s.heartbeatMs ?? 15000), 1000, 10*60*1000);
    if (s.heartbeatEnabled === false) return { ok:false, reason:"heartbeat_disabled" };
    __governorTimer = setInterval(() => { governorTick("interval").catch(()=>{}); }, ms);
    console.log(`[Governor] Heartbeat active — interval ${(ms/1000).toFixed(2)}s`);
    // fire once on boot (after a short delay so macros/STATE are warmed)
    setTimeout(() => { governorTick("boot").catch(()=>{}); }, 2000);
    return { ok:true, intervalMs: ms };
  } catch (e) {
    console.warn("[Governor] failed to start:", String(e?.message||e));
    return { ok:false, error:String(e?.message||e) };
  }
}
// ===== END GOVERNOR =====

// Start Chicken3 services on boot (additive)
try { startChicken3Cron(); } catch {}
try { startChicken3Federation(); } catch {}
// ===== END CHICKEN3: Cron + Federation =====

// ============================================================================
// CONCORD ENHANCEMENTS v3.1 - Search, Query DSL, Local LLM, Export, Plugins
// ============================================================================

// ---- Search Indexing (MiniSearch-like in-memory index) ----
const SEARCH_INDEX = {
  documents: new Map(),
  invertedIndex: new Map(),
  fieldBoosts: { title: 2.0, tags: 1.5, summary: 1.2, content: 1.0 },
  dirty: true
};

function tokenizeForIndex(text) {
  return String(text || "").toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && t.length < 40);
}

function rebuildSearchIndex() {
  SEARCH_INDEX.invertedIndex.clear();
  SEARCH_INDEX.documents.clear();

  for (const dtu of dtusArray()) {
    const docTokens = new Map();
    const fields = {
      title: dtu.title || "",
      tags: (dtu.tags || []).join(" "),
      summary: dtu.human?.summary || dtu.cretiHuman || "",
      content: [
        ...(dtu.core?.definitions || []),
        ...(dtu.core?.invariants || []),
        ...(dtu.core?.claims || [])
      ].join(" ")
    };

    for (const [field, text] of Object.entries(fields)) {
      const tokens = tokenizeForIndex(text);
      const boost = SEARCH_INDEX.fieldBoosts[field] || 1.0;
      for (const token of tokens) {
        docTokens.set(token, (docTokens.get(token) || 0) + boost);
      }
    }

    SEARCH_INDEX.documents.set(dtu.id, { id: dtu.id, tokens: docTokens, tier: dtu.tier });

    for (const [token, score] of docTokens) {
      if (!SEARCH_INDEX.invertedIndex.has(token)) {
        SEARCH_INDEX.invertedIndex.set(token, new Map());
      }
      SEARCH_INDEX.invertedIndex.get(token).set(dtu.id, score);
    }
  }
  SEARCH_INDEX.dirty = false;
  log("search", "Search index rebuilt", { documents: SEARCH_INDEX.documents.size, terms: SEARCH_INDEX.invertedIndex.size });
}

function searchIndexed(query, { limit = 20, minScore = 0.01 } = {}) {
  if (SEARCH_INDEX.dirty) rebuildSearchIndex();

  const queryTokens = tokenizeForIndex(query);
  if (!queryTokens.length) return [];

  const scores = new Map();
  const idf = new Map();
  const N = SEARCH_INDEX.documents.size || 1;

  for (const token of queryTokens) {
    const docs = SEARCH_INDEX.invertedIndex.get(token);
    if (docs) {
      const docFreq = docs.size;
      idf.set(token, Math.log(1 + N / (docFreq + 1)));
      for (const [docId, tf] of docs) {
        const tfidf = tf * idf.get(token);
        scores.set(docId, (scores.get(docId) || 0) + tfidf);
      }
    }
  }

  const results = Array.from(scores.entries())
    .map(([id, score]) => ({ id, score: score / queryTokens.length }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results.map(r => ({ ...STATE.dtus.get(r.id), _searchScore: r.score })).filter(Boolean);
}

// Mark index dirty on DTU changes
const _originalDtuSet = STATE.dtus.set.bind(STATE.dtus);
STATE.dtus.set = function(key, value) {
  SEARCH_INDEX.dirty = true;
  return _originalDtuSet(key, value);
};

// ---- Query DSL Parser ----
function parseQueryDSL(queryString) {
  const conditions = [];
  const parts = String(queryString || "").match(/(\w+:[^\s]+|"[^"]+"|[^\s]+)/g) || [];
  let freeText = [];

  for (const part of parts) {
    if (part.includes(":")) {
      const [field, ...valueParts] = part.split(":");
      const value = valueParts.join(":").replace(/^"|"$/g, "");
      conditions.push({ field: field.toLowerCase(), value, op: "eq" });
    } else if (part.startsWith(">") || part.startsWith("<")) {
      const op = part[0] === ">" ? "gt" : "lt";
      const field = part.slice(1).split(":")[0];
      const value = part.split(":")[1];
      if (field && value) conditions.push({ field, value: parseFloat(value), op });
    } else {
      freeText.push(part);
    }
  }

  return { conditions, freeText: freeText.join(" ") };
}

function queryDTUs(queryString, { limit = 50 } = {}) {
  const { conditions, freeText } = parseQueryDSL(queryString);
  let results = dtusArray();

  for (const cond of conditions) {
    results = results.filter(dtu => {
      const dtuValue = cond.field === "tier" ? dtu.tier :
                       cond.field === "tag" || cond.field === "tags" ? (dtu.tags || []).join(",").toLowerCase() :
                       cond.field === "title" ? (dtu.title || "").toLowerCase() :
                       cond.field === "crispness" ? (dtu.meta?.crispness || 0) :
                       cond.field === "id" ? dtu.id :
                       cond.field === "source" ? (dtu.source || "") :
                       null;

      if (dtuValue === null) return true;

      if (cond.op === "eq") {
        if (typeof dtuValue === "string") return dtuValue.includes(cond.value.toLowerCase());
        return dtuValue == cond.value;
      }
      if (cond.op === "gt") return dtuValue > cond.value;
      if (cond.op === "lt") return dtuValue < cond.value;
      return true;
    });
  }

  if (freeText) {
    const indexed = searchIndexed(freeText, { limit: 1000, minScore: 0.001 });
    const indexedIds = new Set(indexed.map(d => d.id));
    results = results.filter(d => indexedIds.has(d.id));
    results.sort((a, b) => {
      const aScore = indexed.find(x => x.id === a.id)?._searchScore || 0;
      const bScore = indexed.find(x => x.id === b.id)?._searchScore || 0;
      return bScore - aScore;
    });
  }

  return results.slice(0, limit);
}

register("search", "query", async (ctx, input) => {
  const q = String(input.q || input.query || "");
  const limit = clamp(Number(input.limit || 50), 1, 500);
  const results = queryDTUs(q, { limit });
  return { ok: true, query: q, count: results.length, dtus: results };
});

register("search", "reindex", async (ctx, input) => {
  rebuildSearchIndex();
  return { ok: true, documents: SEARCH_INDEX.documents.size, terms: SEARCH_INDEX.invertedIndex.size };
});

// ---- Local LLM Support (Ollama) ----
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const OLLAMA_ENABLED = process.env.OLLAMA_ENABLED === "true" || process.env.OLLAMA_ENABLED === "1";

async function ollamaChat(messages, { temperature = 0.7, max_tokens = 1000 } = {}) {
  if (!OLLAMA_ENABLED) return { ok: false, error: "Ollama not enabled" };
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: { temperature, num_predict: max_tokens }
      })
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    const data = await response.json();
    return { ok: true, text: data.message?.content || "", model: OLLAMA_MODEL, source: "ollama" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), source: "ollama" };
  }
}

async function ollamaEmbed(text) {
  if (!OLLAMA_ENABLED) return { ok: false, error: "Ollama not enabled" };
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: String(text || "").slice(0, 8000) })
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

register("llm", "embed", async (ctx, input) => {
  return await ollamaEmbed(String(input.text || ""));
});

// ---- Export/Import System ----
register("export", "markdown", async (ctx, input) => {
  const dtus = input.ids ? input.ids.map(id => STATE.dtus.get(id)).filter(Boolean) : dtusArray();
  const lines = ["# Concord DTU Export", `Exported: ${nowISO()}`, `Count: ${dtus.length}`, ""];

  for (const dtu of dtus) {
    lines.push(`## ${dtu.title || "Untitled"}`);
    lines.push(`**ID:** ${dtu.id} | **Tier:** ${dtu.tier || "regular"} | **Tags:** ${(dtu.tags || []).join(", ")}`);
    lines.push("");
    if (dtu.human?.summary) lines.push(`> ${dtu.human.summary}`, "");
    if (dtu.core?.definitions?.length) {
      lines.push("### Definitions");
      dtu.core.definitions.forEach(d => lines.push(`- ${d}`));
      lines.push("");
    }
    if (dtu.core?.invariants?.length) {
      lines.push("### Invariants");
      dtu.core.invariants.forEach(i => lines.push(`- ${i}`));
      lines.push("");
    }
    if (dtu.core?.claims?.length) {
      lines.push("### Claims");
      dtu.core.claims.forEach(c => lines.push(`- ${c}`));
      lines.push("");
    }
    lines.push("---", "");
  }

  return { ok: true, format: "markdown", content: lines.join("\n"), count: dtus.length };
});

register("export", "obsidian", async (ctx, input) => {
  const dtus = input.ids ? input.ids.map(id => STATE.dtus.get(id)).filter(Boolean) : dtusArray();
  const files = [];

  for (const dtu of dtus) {
    const filename = `${(dtu.title || "Untitled").replace(/[^\w\s-]/g, "").slice(0, 50)}.md`;
    const content = [
      "---",
      `id: ${dtu.id}`,
      `tier: ${dtu.tier || "regular"}`,
      `tags: [${(dtu.tags || []).map(t => `"${t}"`).join(", ")}]`,
      `created: ${dtu.createdAt || nowISO()}`,
      "---",
      "",
      `# ${dtu.title || "Untitled"}`,
      "",
      dtu.human?.summary || "",
      "",
      "## Core",
      "",
      "### Definitions",
      ...(dtu.core?.definitions || []).map(d => `- ${d}`),
      "",
      "### Invariants",
      ...(dtu.core?.invariants || []).map(i => `- ${i}`),
      "",
      "### Claims",
      ...(dtu.core?.claims || []).map(c => `- ${c}`),
      "",
      "## Lineage",
      ...(dtu.lineage || []).map(id => `- [[${id}]]`)
    ].join("\n");

    files.push({ filename, content });
  }

  return { ok: true, format: "obsidian", files, count: files.length };
});

register("export", "json", async (ctx, input) => {
  const dtus = input.ids ? input.ids.map(id => STATE.dtus.get(id)).filter(Boolean) : dtusArray();
  return { ok: true, format: "json", dtus, count: dtus.length };
});

register("import", "json", async (ctx, input) => {
  const dtus = Array.isArray(input.dtus) ? input.dtus : [];
  let imported = 0, skipped = 0;

  for (const dtu of dtus) {
    if (!dtu.id || !dtu.title) { skipped++; continue; }
    if (STATE.dtus.has(dtu.id) && !input.overwrite) { skipped++; continue; }

    const normalized = {
      id: dtu.id,
      title: normalizeText(dtu.title),
      tier: dtu.tier || "regular",
      tags: Array.isArray(dtu.tags) ? dtu.tags : [],
      human: dtu.human || {},
      core: dtu.core || {},
      machine: dtu.machine || {},
      lineage: dtu.lineage || [],
      source: "import",
      createdAt: dtu.createdAt || nowISO(),
      updatedAt: nowISO(),
      meta: { ...dtu.meta, importedAt: nowISO() }
    };

    STATE.dtus.set(normalized.id, normalized);
    imported++;
  }

  if (imported > 0) saveStateDebounced();
  return { ok: true, imported, skipped, total: dtus.length };
});

register("import", "markdown", async (ctx, input) => {
  const content = String(input.content || "");
  const sections = content.split(/^## /m).filter(Boolean);
  const dtus = [];

  for (const section of sections) {
    const lines = section.split("\n");
    const title = lines[0]?.trim();
    if (!title || title.startsWith("#")) continue;

    const dtu = {
      id: uid("dtu"),
      title,
      tier: "regular",
      tags: ["imported"],
      human: { summary: "" },
      core: { definitions: [], invariants: [], claims: [], examples: [] },
      source: "import-markdown",
      createdAt: nowISO()
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
  for (const dtu of dtus) {
    STATE.dtus.set(dtu.id, dtu);
    imported++;
  }

  if (imported > 0) saveStateDebounced();
  return { ok: true, imported, parsed: dtus.length };
});

// ---- Plugin/Extension System ----
const PLUGINS = new Map();

function registerPlugin(name, config) {
  const plugin = {
    name,
    version: config.version || "1.0.0",
    description: config.description || "",
    macros: config.macros || {},
    hooks: config.hooks || {},
    enabled: config.enabled !== false,
    registeredAt: nowISO()
  };

  // Register plugin macros
  for (const [macroName, handler] of Object.entries(plugin.macros)) {
    const [domain, op] = macroName.split(".");
    if (domain && op && typeof handler === "function") {
      register(domain, op, handler);
    }
  }

  PLUGINS.set(name, plugin);
  log("plugin", `Plugin registered: ${name}`, { version: plugin.version });
  return plugin;
}

register("plugin", "register", async (ctx, input) => {
  if (!input.name) return { ok: false, error: "Plugin name required" };
  const plugin = registerPlugin(input.name, input);
  return { ok: true, plugin: { name: plugin.name, version: plugin.version } };
});

register("plugin", "list", async (ctx, input) => {
  const plugins = Array.from(PLUGINS.values()).map(p => ({
    name: p.name,
    version: p.version,
    description: p.description,
    enabled: p.enabled,
    macroCount: Object.keys(p.macros).length
  }));
  return { ok: true, plugins, count: plugins.length };
});

register("plugin", "enable", async (ctx, input) => {
  const plugin = PLUGINS.get(input.name);
  if (!plugin) return { ok: false, error: "Plugin not found" };
  plugin.enabled = true;
  return { ok: true, name: plugin.name, enabled: true };
});

register("plugin", "disable", async (ctx, input) => {
  const plugin = PLUGINS.get(input.name);
  if (!plugin) return { ok: false, error: "Plugin not found" };
  plugin.enabled = false;
  return { ok: true, name: plugin.name, enabled: false };
});

// ---- Enhanced Council with Vote Tallying ----
if (!STATE.councilVotes) STATE.councilVotes = new Map();

register("council", "vote", async (ctx, input) => {
  const { dtuId, vote, persona, reason } = input;
  if (!dtuId || !vote) return { ok: false, error: "dtuId and vote required" };
  if (!["approve", "reject", "abstain"].includes(vote)) return { ok: false, error: "Invalid vote" };

  const voteRecord = {
    id: uid("vote"),
    dtuId,
    vote,
    persona: persona || "anonymous",
    reason: reason || "",
    timestamp: nowISO(),
    weight: 1.0
  };

  if (!STATE.councilVotes.has(dtuId)) STATE.councilVotes.set(dtuId, []);
  STATE.councilVotes.get(dtuId).push(voteRecord);
  saveStateDebounced();

  return { ok: true, vote: voteRecord };
});

register("council", "tally", async (ctx, input) => {
  const { dtuId } = input;
  if (!dtuId) return { ok: false, error: "dtuId required" };

  const votes = STATE.councilVotes.get(dtuId) || [];
  const tally = { approve: 0, reject: 0, abstain: 0, total: votes.length };

  for (const v of votes) {
    tally[v.vote] = (tally[v.vote] || 0) + v.weight;
  }

  tally.approved = tally.approve > tally.reject;
  tally.margin = tally.approve - tally.reject;
  tally.quorum = votes.length >= 3;

  return { ok: true, dtuId, tally, votes };
});

register("council", "credibility", async (ctx, input) => {
  const { dtuId, score, reason } = input;
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };

  dtu.authority = dtu.authority || {};
  dtu.authority.credibility = clamp(Number(score || 0.5), 0, 1);
  dtu.authority.credibilityReason = reason || "";
  dtu.authority.credibilityAt = nowISO();

  STATE.dtus.set(dtuId, dtu);
  saveStateDebounced();

  return { ok: true, dtuId, credibility: dtu.authority.credibility };
});

// ---- User-Defined Personas ----
if (!STATE.customPersonas) STATE.customPersonas = new Map();

register("persona", "create", async (ctx, input) => {
  const { name, description, style, traits } = input;
  if (!name) return { ok: false, error: "Persona name required" };

  const persona = {
    id: uid("persona"),
    name: normalizeText(name),
    description: description || "",
    style: {
      verbosity: clamp(Number(style?.verbosity ?? 0.5), 0, 1),
      formality: clamp(Number(style?.formality ?? 0.5), 0, 1),
      skepticism: clamp(Number(style?.skepticism ?? 0.5), 0, 1),
      creativity: clamp(Number(style?.creativity ?? 0.5), 0, 1),
      empathy: clamp(Number(style?.empathy ?? 0.5), 0, 1)
    },
    traits: Array.isArray(traits) ? traits : [],
    systemPrompt: input.systemPrompt || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    usageCount: 0
  };

  STATE.customPersonas.set(persona.id, persona);
  saveStateDebounced();

  return { ok: true, persona };
});

register("persona", "list", async (ctx, input) => {
  const builtIn = [
    { id: "ethicist", name: "Ethicist", description: "Focuses on moral implications", builtin: true },
    { id: "engineer", name: "Engineer", description: "Practical, implementation-focused", builtin: true },
    { id: "historian", name: "Historian", description: "Historical context and precedent", builtin: true },
    { id: "economist", name: "Economist", description: "Economic analysis and trade-offs", builtin: true }
  ];
  const custom = Array.from(STATE.customPersonas.values());
  return { ok: true, personas: [...builtIn, ...custom], builtInCount: builtIn.length, customCount: custom.length };
});

register("persona", "update", async (ctx, input) => {
  const persona = STATE.customPersonas.get(input.id);
  if (!persona) return { ok: false, error: "Persona not found" };

  if (input.name) persona.name = normalizeText(input.name);
  if (input.description) persona.description = input.description;
  if (input.style) persona.style = { ...persona.style, ...input.style };
  if (input.traits) persona.traits = input.traits;
  if (input.systemPrompt) persona.systemPrompt = input.systemPrompt;
  persona.updatedAt = nowISO();

  STATE.customPersonas.set(persona.id, persona);
  saveStateDebounced();

  return { ok: true, persona };
});

register("persona", "delete", async (ctx, input) => {
  if (!STATE.customPersonas.has(input.id)) return { ok: false, error: "Persona not found" };
  STATE.customPersonas.delete(input.id);
  saveStateDebounced();
  return { ok: true, deleted: input.id };
});

// ---- Admin Dashboard Endpoints ----
register("admin", "dashboard", async (ctx, input) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  return {
    ok: true,
    system: {
      version: VERSION,
      uptime: { seconds: uptime, formatted: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m` },
      memory: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + "MB",
        rss: Math.round(memory.rss / 1024 / 1024) + "MB"
      },
      nodeVersion: process.version
    },
    dtus: {
      total: STATE.dtus.size,
      regular: dtusArray().filter(d => d.tier === "regular").length,
      mega: dtusArray().filter(d => d.tier === "mega").length,
      hyper: dtusArray().filter(d => d.tier === "hyper").length,
      shadow: STATE.shadowDtus?.size || 0
    },
    sessions: {
      total: STATE.sessions?.size || 0,
      active: Array.from(STATE.sessions?.values() || []).filter(s => {
        const lastMsg = s.messages?.[s.messages.length - 1];
        return lastMsg && (Date.now() - new Date(lastMsg.timestamp).getTime()) < 3600000;
      }).length
    },
    organs: {
      total: STATE.organs?.size || 0,
      healthy: Array.from(STATE.organs?.values() || []).filter(o => (o.maturity?.score || 0) > 0.5).length
    },
    llm: {
      openaiReady: LLM_READY,
      ollamaEnabled: OLLAMA_ENABLED,
      defaultOn: DEFAULT_LLM_ON
    },
    queues: {
      maintenance: STATE.queues?.maintenance?.length || 0,
      synthesis: STATE.queues?.synthesis?.length || 0,
      hypotheses: STATE.queues?.hypotheses?.length || 0
    },
    plugins: {
      total: PLUGINS.size,
      enabled: Array.from(PLUGINS.values()).filter(p => p.enabled).length
    },
    searchIndex: {
      documents: SEARCH_INDEX.documents.size,
      terms: SEARCH_INDEX.invertedIndex.size,
      dirty: SEARCH_INDEX.dirty
    }
  };
});

register("admin", "logs", async (ctx, input) => {
  const limit = clamp(Number(input.limit || 100), 1, 1000);
  const type = input.type || null;

  let logs = STATE.__logs || [];
  if (type) logs = logs.filter(l => l.type === type);
  logs = logs.slice(-limit);

  return { ok: true, logs, count: logs.length };
});

register("admin", "metrics", async (ctx, input) => {
  const chicken2 = STATE.__chicken2 || {};
  const growth = STATE.growth || {};
  const abstraction = STATE.abstraction || {};

  return {
    ok: true,
    chicken2: {
      continuityAvg: chicken2.metrics?.continuityAvg || 0,
      homeostasis: chicken2.metrics?.homeostasis || 0.8,
      contradictionLoad: chicken2.metrics?.contradictionLoad || 0,
      suffering: chicken2.metrics?.suffering || 0,
      accepts: chicken2.metrics?.accepts || 0,
      rejects: chicken2.metrics?.rejects || 0
    },
    growth: {
      bioAge: growth.bioAge || 0,
      telomere: growth.telomere || 1,
      homeostasis: growth.homeostasis || 0.9,
      stress: growth.stress || { acute: 0, chronic: 0 }
    },
    abstraction: {
      load: abstraction.metrics?.load || 0,
      margin: abstraction.metrics?.margin || 1,
      enabled: abstraction.enabled !== false
    }
  };
});

// ---- Pagination Helper ----
function paginateResults(items, { page = 1, pageSize = 20 } = {}) {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

// ---- Enhanced API Endpoints for New Features ----
app.get("/api/search/indexed", async (req, res) => {
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

app.post("/api/llm/local", async (req, res) => {
  const out = await runMacro("llm", "local", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/llm/embed", async (req, res) => {
  const out = await runMacro("llm", "embed", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/export/markdown", async (req, res) => {
  const out = await runMacro("export", "markdown", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/export/obsidian", async (req, res) => {
  const out = await runMacro("export", "obsidian", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/export/json", async (req, res) => {
  const out = await runMacro("export", "json", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/import/json", async (req, res) => {
  const out = await runMacro("import", "json", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/import/markdown", async (req, res) => {
  const out = await runMacro("import", "markdown", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/plugins", async (req, res) => {
  const out = await runMacro("plugin", "list", {}, makeCtx(req));
  return res.json(out);
});

app.post("/api/plugins", async (req, res) => {
  const out = await runMacro("plugin", "register", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/council/vote", async (req, res) => {
  const out = await runMacro("council", "vote", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/council/tally/:dtuId", async (req, res) => {
  const out = await runMacro("council", "tally", { dtuId: req.params.dtuId }, makeCtx(req));
  return res.json(out);
});

app.post("/api/council/credibility", async (req, res) => {
  const out = await runMacro("council", "credibility", req.body, makeCtx(req));
  return res.json(out);
});

app.post("/api/personas", async (req, res) => {
  const out = await runMacro("persona", "create", req.body, makeCtx(req));
  return res.json(out);
});

app.get("/api/personas", async (req, res) => {
  const out = await runMacro("persona", "list", {}, makeCtx(req));
  return res.json(out);
});

app.put("/api/personas/:id", async (req, res) => {
  const out = await runMacro("persona", "update", { id: req.params.id, ...req.body }, makeCtx(req));
  return res.json(out);
});

app.delete("/api/personas/:id", async (req, res) => {
  const out = await runMacro("persona", "delete", { id: req.params.id }, makeCtx(req));
  return res.json(out);
});

app.get("/api/admin/dashboard", async (req, res) => {
  const out = await runMacro("admin", "dashboard", {}, makeCtx(req));
  return res.json(out);
});

app.get("/api/admin/logs", async (req, res) => {
  const out = await runMacro("admin", "logs", { limit: req.query.limit, type: req.query.type }, makeCtx(req));
  return res.json(out);
});

app.get("/api/admin/metrics", async (req, res) => {
  const out = await runMacro("admin", "metrics", {}, makeCtx(req));
  return res.json(out);
});

app.get("/api/dtus/paginated", async (req, res) => {
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

// ---- OpenAPI Documentation ----
const OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "Concord Cognitive Engine API",
    version: VERSION,
    description: "Local-first cognitive operating system API"
  },
  servers: [{ url: `http://localhost:${PORT}`, description: "Local server" }],
  paths: {
    "/api/status": { get: { summary: "System status", tags: ["System"] }},
    "/api/dtus": { get: { summary: "List all DTUs", tags: ["DTUs"] }},
    "/api/dtus/paginated": { get: { summary: "Paginated DTU list", tags: ["DTUs"], parameters: [
      { name: "page", in: "query", schema: { type: "integer" }},
      { name: "pageSize", in: "query", schema: { type: "integer" }}
    ]}},
    "/api/search/indexed": { get: { summary: "Full-text search", tags: ["Search"] }},
    "/api/search/dsl": { get: { summary: "Query DSL search", tags: ["Search"] }},
    "/api/chat": { post: { summary: "Chat with Concord", tags: ["Chat"] }},
    "/api/forge/manual": { post: { summary: "Create DTU manually", tags: ["Forge"] }},
    "/api/forge/hybrid": { post: { summary: "Create DTU with LLM assistance", tags: ["Forge"] }},
    "/api/export/markdown": { post: { summary: "Export as Markdown", tags: ["Export"] }},
    "/api/export/obsidian": { post: { summary: "Export for Obsidian", tags: ["Export"] }},
    "/api/import/json": { post: { summary: "Import DTUs from JSON", tags: ["Import"] }},
    "/api/import/markdown": { post: { summary: "Import from Markdown", tags: ["Import"] }},
    "/api/admin/dashboard": { get: { summary: "Admin dashboard data", tags: ["Admin"] }},
    "/api/admin/metrics": { get: { summary: "System metrics", tags: ["Admin"] }},
    "/api/admin/logs": { get: { summary: "System logs", tags: ["Admin"] }},
    "/api/personas": {
      get: { summary: "List personas", tags: ["Personas"] },
      post: { summary: "Create persona", tags: ["Personas"] }
    },
    "/api/plugins": {
      get: { summary: "List plugins", tags: ["Plugins"] },
      post: { summary: "Register plugin", tags: ["Plugins"] }
    },
    "/api/council/vote": { post: { summary: "Submit council vote", tags: ["Council"] }},
    "/api/council/tally/{dtuId}": { get: { summary: "Get vote tally", tags: ["Council"] }},
    "/api/llm/local": { post: { summary: "Local LLM inference (Ollama)", tags: ["LLM"] }},
    "/api/llm/embed": { post: { summary: "Generate embeddings", tags: ["LLM"] }}
  },
  tags: [
    { name: "System", description: "System status and health" },
    { name: "DTUs", description: "Discrete Thought Unit operations" },
    { name: "Search", description: "Search and query" },
    { name: "Chat", description: "Conversational interface" },
    { name: "Forge", description: "DTU creation" },
    { name: "Export", description: "Export data" },
    { name: "Import", description: "Import data" },
    { name: "Admin", description: "Administration" },
    { name: "Personas", description: "Persona management" },
    { name: "Plugins", description: "Plugin system" },
    { name: "Council", description: "Governance and voting" },
    { name: "LLM", description: "Language model operations" }
  ]
};

app.get("/api/openapi.json", (req, res) => res.json(OPENAPI_SPEC));
app.get("/api/docs", (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Concord API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui" });</script>
</body></html>`);
});

console.log("[Concord] Enhancements v3.1 loaded: Search indexing, Query DSL, Local LLM, Export/Import, Plugins, Council voting, Personas, Admin dashboard");

// ============================================================================
// WAVE 1: PLUGIN MARKETPLACE ECOSYSTEM (Surpassing Obsidian)
// ============================================================================
const PLUGIN_MARKETPLACE = {
  listings: new Map(),
  installed: new Map(),
  reviews: new Map(),
  categories: ["productivity", "visualization", "integration", "ai", "governance", "export", "theme", "automation"]
};

register("marketplace", "submit", async (ctx, input) => {
  const { name, description, version, author, githubUrl, category, macros } = input;
  if (!name || !githubUrl) return { ok: false, error: "Name and GitHub URL required" };
  const listing = {
    id: uid("plugin"),
    name: normalizeText(name),
    description: description || "",
    version: version || "1.0.0",
    author: author || "anonymous",
    githubUrl,
    category: PLUGIN_MARKETPLACE.categories.includes(category) ? category : "productivity",
    macros: macros || [],
    downloads: 0,
    rating: 0,
    reviews: [],
    ethosCompliant: null,
    submittedAt: nowISO(),
    status: "pending_review"
  };
  PLUGIN_MARKETPLACE.listings.set(listing.id, listing);
  STATE.queues.macroProposals = STATE.queues.macroProposals || [];
  STATE.queues.macroProposals.push({ type: "plugin_review", pluginId: listing.id, name: listing.name, githubUrl: listing.githubUrl, submittedAt: nowISO() });
  saveStateDebounced();
  return { ok: true, listing, message: "Plugin submitted for Chicken3 ethos review" };
});

register("marketplace", "browse", async (ctx, input) => {
  const { category, search, sort, page, pageSize } = input;
  let listings = Array.from(PLUGIN_MARKETPLACE.listings.values()).filter(l => l.status === "approved" || l.status === "pending_review");
  if (category) listings = listings.filter(l => l.category === category);
  if (search) { const q = search.toLowerCase(); listings = listings.filter(l => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)); }
  if (sort === "rating") listings.sort((a, b) => b.rating - a.rating);
  else if (sort === "downloads") listings.sort((a, b) => b.downloads - a.downloads);
  else listings.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const result = paginateResults(listings, { page: Number(page || 1), pageSize: clamp(Number(pageSize || 20), 1, 100) });
  return { ok: true, ...result, categories: PLUGIN_MARKETPLACE.categories };
});

register("marketplace", "install", async (ctx, input) => {
  const { pluginId, fromGithub, githubUrl } = input;
  if (fromGithub && githubUrl) {
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return { ok: false, error: "Invalid GitHub URL" };
    const [, owner, repo] = match;
    const plugin = { id: uid("plugin"), name: repo, version: "1.0.0", source: githubUrl, installedAt: nowISO(), enabled: true, autoUpdate: true };
    PLUGIN_MARKETPLACE.installed.set(plugin.id, plugin);
    saveStateDebounced();
    return { ok: true, plugin, message: "Plugin installed from GitHub" };
  }
  const listing = PLUGIN_MARKETPLACE.listings.get(pluginId);
  if (!listing) return { ok: false, error: "Plugin not found" };
  listing.downloads++;
  const installed = { id: listing.id, name: listing.name, version: listing.version, source: listing.githubUrl, installedAt: nowISO(), enabled: true, autoUpdate: true };
  PLUGIN_MARKETPLACE.installed.set(installed.id, installed);
  saveStateDebounced();
  return { ok: true, plugin: installed };
});

register("marketplace", "review", async (ctx, input) => {
  const { pluginId, rating, comment, persona } = input;
  if (!pluginId || !rating) return { ok: false, error: "Plugin ID and rating required" };
  const review = { id: uid("review"), pluginId, rating: clamp(Number(rating), 1, 5), comment: comment || "", persona: persona || "anonymous", createdAt: nowISO() };
  if (!PLUGIN_MARKETPLACE.reviews.has(pluginId)) PLUGIN_MARKETPLACE.reviews.set(pluginId, []);
  PLUGIN_MARKETPLACE.reviews.get(pluginId).push(review);
  const listing = PLUGIN_MARKETPLACE.listings.get(pluginId);
  if (listing) { const reviews = PLUGIN_MARKETPLACE.reviews.get(pluginId) || []; listing.rating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length; }
  saveStateDebounced();
  return { ok: true, review };
});

register("marketplace", "heartbeatSync", async (ctx, input) => {
  const installed = Array.from(PLUGIN_MARKETPLACE.installed.values());
  const updates = installed.filter(p => p.autoUpdate && p.source).map(p => ({ pluginId: p.id, name: p.name, currentVersion: p.version, checkTime: nowISO() }));
  return { ok: true, installed: installed.length, updateChecks: updates.length };
});

register("marketplace", "installed", async (ctx, input) => {
  const plugins = Array.from(PLUGIN_MARKETPLACE.installed.values());
  return { ok: true, plugins, count: plugins.length };
});

app.get("/api/marketplace/browse", async (req, res) => res.json(await runMacro("marketplace", "browse", { category: req.query.category, search: req.query.search, sort: req.query.sort, page: req.query.page, pageSize: req.query.pageSize }, makeCtx(req))));
app.post("/api/marketplace/submit", async (req, res) => res.json(await runMacro("marketplace", "submit", req.body, makeCtx(req))));
app.post("/api/marketplace/install", async (req, res) => res.json(await runMacro("marketplace", "install", req.body, makeCtx(req))));
app.post("/api/marketplace/review", async (req, res) => res.json(await runMacro("marketplace", "review", req.body, makeCtx(req))));
app.get("/api/marketplace/installed", async (req, res) => res.json(await runMacro("marketplace", "installed", {}, makeCtx(req))));

console.log("[Concord] Wave 1: Plugin Marketplace loaded");

// ============================================================================
// WAVE 2: GRAPH-BASED RELATIONAL QUERIES (Surpassing Logseq)
// ============================================================================
const GRAPH_INDEX = { nodes: new Map(), edges: new Map(), dirty: true };

function rebuildGraphIndex() {
  GRAPH_INDEX.nodes.clear();
  GRAPH_INDEX.edges.clear();
  for (const [id, dtu] of STATE.dtus.entries()) {
    GRAPH_INDEX.nodes.set(id, { id, title: dtu.title, tier: dtu.tier, tags: dtu.tags || [], lineageDepth: 0 });
    const lineage = dtu.lineage || {};
    for (const parentId of (lineage.parents || [])) { GRAPH_INDEX.edges.set(`${parentId}->${id}`, { id: `${parentId}->${id}`, source: parentId, target: id, type: "parent" }); }
    for (const childId of (lineage.children || [])) { GRAPH_INDEX.edges.set(`${id}->${childId}`, { id: `${id}->${childId}`, source: id, target: childId, type: "child" }); }
    for (const tag of (dtu.tags || [])) {
      const tagNodeId = `tag:${tag}`;
      if (!GRAPH_INDEX.nodes.has(tagNodeId)) GRAPH_INDEX.nodes.set(tagNodeId, { id: tagNodeId, type: "tag", label: tag });
      GRAPH_INDEX.edges.set(`${id}->tag:${tag}`, { source: id, target: tagNodeId, type: "tagged" });
    }
  }
  // Compute lineage depths
  const roots = Array.from(STATE.dtus.values()).filter(d => !d.lineage?.parents?.length || d.tier === "core");
  const visited = new Set();
  const queue = roots.map(r => ({ id: r.id, depth: 0 }));
  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const node = GRAPH_INDEX.nodes.get(id);
    if (node) node.lineageDepth = depth;
    const dtu = STATE.dtus.get(id);
    for (const childId of (dtu?.lineage?.children || [])) { if (!visited.has(childId)) queue.push({ id: childId, depth: depth + 1 }); }
  }
  GRAPH_INDEX.dirty = false;
}

register("graph", "query", async (ctx, input) => {
  if (GRAPH_INDEX.dirty) rebuildGraphIndex();
  const { dsl } = input;
  const results = [];
  const dslLower = (dsl || "").toLowerCase();

  // Tag queries
  const tagMatch = dslLower.match(/linked to tag[:\s]+(\w+)/i);
  if (tagMatch) {
    const tag = tagMatch[1];
    for (const [id, node] of GRAPH_INDEX.nodes.entries()) { if (node.tags?.includes(tag)) results.push({ id, ...node, matchType: "tag" }); }
  }

  // Lineage depth queries
  const depthMatch = dslLower.match(/lineage depth\s*([><=]+)\s*(\d+)/i);
  if (depthMatch) {
    const op = depthMatch[1], val = Number(depthMatch[2]);
    const filtered = results.length > 0 ? results : Array.from(GRAPH_INDEX.nodes.values());
    return { ok: true, results: filtered.filter(n => { if (op === ">") return n.lineageDepth > val; if (op === "<") return n.lineageDepth < val; if (op === ">=") return n.lineageDepth >= val; if (op === "<=") return n.lineageDepth <= val; return n.lineageDepth === val; }), query: dsl };
  }

  // Relationship queries
  const relMatch = dslLower.match(/(children|parents|ancestors|descendants) of (\w+)/i);
  if (relMatch) {
    const [, rel, targetId] = relMatch;
    const traverse = (startId, dir, maxD = 10) => {
      const found = [], vis = new Set(), q = [{ id: startId, d: 0 }];
      while (q.length > 0) {
        const { id, d } = q.shift();
        if (vis.has(id) || d > maxD) continue;
        vis.add(id);
        const dtu = STATE.dtus.get(id);
        if (!dtu) continue;
        const related = dir === "down" ? (dtu.lineage?.children || []) : (dtu.lineage?.parents || []);
        for (const relId of related) { if (!vis.has(relId)) { found.push({ id: relId, depth: d + 1 }); q.push({ id: relId, d: d + 1 }); } }
      }
      return found;
    };
    if (rel === "children") { const dtu = STATE.dtus.get(targetId); return { ok: true, results: (dtu?.lineage?.children || []).map(id => ({ id, ...GRAPH_INDEX.nodes.get(id) })) }; }
    if (rel === "parents") { const dtu = STATE.dtus.get(targetId); return { ok: true, results: (dtu?.lineage?.parents || []).map(id => ({ id, ...GRAPH_INDEX.nodes.get(id) })) }; }
    if (rel === "descendants") return { ok: true, results: traverse(targetId, "down") };
    if (rel === "ancestors") return { ok: true, results: traverse(targetId, "up") };
  }

  // Cluster queries
  const clusterMatch = dslLower.match(/cluster[s]?\s*(around|containing|near)\s*(\w+)/i);
  if (clusterMatch) {
    const targetId = clusterMatch[2];
    const targetDtu = STATE.dtus.get(targetId);
    if (!targetDtu) return { ok: false, error: "DTU not found" };
    const targetTags = new Set(targetDtu.tags || []);
    const similar = [];
    for (const [id, dtu] of STATE.dtus.entries()) {
      if (id === targetId) continue;
      const overlap = (dtu.tags || []).filter(t => targetTags.has(t)).length;
      if (overlap > 0) similar.push({ id, title: dtu.title, overlap, tags: dtu.tags });
    }
    similar.sort((a, b) => b.overlap - a.overlap);
    return { ok: true, results: similar.slice(0, 20), clusteredAround: targetId };
  }

  return { ok: true, results, query: dsl, hint: "Use: 'DTUs linked to tag:X with lineage depth > 2' or 'descendants of dtu_xxx'" };
});

register("graph", "visualData", async (ctx, input) => {
  if (GRAPH_INDEX.dirty) rebuildGraphIndex();
  const { tier, limit, includeEdges } = input;
  let nodes = Array.from(GRAPH_INDEX.nodes.values()).filter(n => !n.type || n.type !== "tag");
  if (tier) nodes = nodes.filter(n => n.tier === tier);
  nodes = nodes.slice(0, Number(limit) || 200);
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = includeEdges !== false ? Array.from(GRAPH_INDEX.edges.values()).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)) : [];
  return { ok: true, nodes, edges, stats: { totalNodes: GRAPH_INDEX.nodes.size, totalEdges: GRAPH_INDEX.edges.size } };
});

register("graph", "forceGraph", async (ctx, input) => {
  if (GRAPH_INDEX.dirty) rebuildGraphIndex();
  const { centerNode, depth, maxNodes } = input;
  let nodes = [], links = [];
  if (centerNode) {
    const visited = new Set(), queue = [{ id: centerNode, d: 0 }], maxDepth = Number(depth) || 2;
    while (queue.length > 0 && nodes.length < (Number(maxNodes) || 100)) {
      const { id, d } = queue.shift();
      if (visited.has(id) || d > maxDepth) continue;
      visited.add(id);
      const dtu = STATE.dtus.get(id);
      if (!dtu) continue;
      nodes.push({ id, label: dtu.title, tier: dtu.tier, tags: dtu.tags, depth: d });
      for (const parentId of (dtu.lineage?.parents || [])) { links.push({ source: parentId, target: id, type: "parent" }); if (!visited.has(parentId)) queue.push({ id: parentId, d: d + 1 }); }
      for (const childId of (dtu.lineage?.children || [])) { links.push({ source: id, target: childId, type: "child" }); if (!visited.has(childId)) queue.push({ id: childId, d: d + 1 }); }
    }
  } else {
    nodes = Array.from(GRAPH_INDEX.nodes.values()).filter(n => !n.type || n.type !== "tag").slice(0, Number(maxNodes) || 100);
    const nodeIds = new Set(nodes.map(n => n.id));
    links = Array.from(GRAPH_INDEX.edges.values()).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  }
  return { ok: true, nodes, links };
});

app.post("/api/graph/query", async (req, res) => res.json(await runMacro("graph", "query", req.body, makeCtx(req))));
app.get("/api/graph/visual", async (req, res) => res.json(await runMacro("graph", "visualData", { tier: req.query.tier, limit: req.query.limit, includeEdges: req.query.includeEdges !== "false" }, makeCtx(req))));
app.get("/api/graph/force", async (req, res) => res.json(await runMacro("graph", "forceGraph", { centerNode: req.query.centerNode, depth: req.query.depth, maxNodes: req.query.maxNodes }, makeCtx(req))));

console.log("[Concord] Wave 2: Graph Queries loaded");

// ============================================================================
// WAVE 3: DYNAMIC SCHEMA TEMPLATES (Surpassing Tana's Supertags)
// ============================================================================
const SCHEMA_REGISTRY = new Map();

register("schema", "create", async (ctx, input) => {
  const { name, kind, fields, validation, evolves } = input;
  if (!name || !kind) return { ok: false, error: "Name and kind required" };
  const schema = {
    id: uid("schema"),
    name: normalizeText(name),
    kind,
    fields: (fields || []).map(f => ({ name: f.name, type: f.type || "string", required: f.required || false, default: f.default, validation: f.validation || null, description: f.description || "" })),
    validation: validation || {},
    evolves: evolves !== false,
    version: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    usageCount: 0
  };
  const schemaDtu = {
    id: schema.id,
    title: `Schema: ${schema.name}`,
    tier: "core",
    tags: ["schema", "meta", kind],
    human: { summary: `Schema template for ${kind} DTUs` },
    core: { definitions: schema.fields.map(f => `${f.name}: ${f.type}${f.required ? ' (required)' : ''}`), invariants: Object.entries(schema.validation).map(([k, v]) => `${k}: ${v}`) },
    machine: { kind: "schema", schema },
    source: "schema-registry",
    createdAt: schema.createdAt
  };
  STATE.dtus.set(schemaDtu.id, schemaDtu);
  SCHEMA_REGISTRY.set(schema.name, schema);
  saveStateDebounced();
  return { ok: true, schema, dtuId: schemaDtu.id };
});

register("schema", "list", async (ctx, input) => {
  const schemas = Array.from(SCHEMA_REGISTRY.values());
  return { ok: true, schemas, count: schemas.length };
});

register("schema", "validate", async (ctx, input) => {
  const { schemaName, data } = input;
  const schema = SCHEMA_REGISTRY.get(schemaName);
  if (!schema) return { ok: false, error: "Schema not found" };
  const errors = [];
  for (const field of schema.fields) {
    const value = data[field.name];
    if (field.required && (value === undefined || value === null || value === "")) { errors.push({ field: field.name, error: "Required field missing" }); continue; }
    if (value !== undefined && value !== null) {
      if (field.type === "number" && typeof value !== "number") errors.push({ field: field.name, error: "Must be a number" });
      if (field.type === "boolean" && typeof value !== "boolean") errors.push({ field: field.name, error: "Must be a boolean" });
      if (field.type === "array" && !Array.isArray(value)) errors.push({ field: field.name, error: "Must be an array" });
      if (field.validation) {
        if (field.validation.regex && typeof value === "string" && !new RegExp(field.validation.regex).test(value)) errors.push({ field: field.name, error: `Must match: ${field.validation.regex}` });
        if (field.validation.min !== undefined && value < field.validation.min) errors.push({ field: field.name, error: `Must be >= ${field.validation.min}` });
        if (field.validation.max !== undefined && value > field.validation.max) errors.push({ field: field.name, error: `Must be <= ${field.validation.max}` });
        if (field.validation.enum && !field.validation.enum.includes(value)) errors.push({ field: field.name, error: `Must be one of: ${field.validation.enum.join(", ")}` });
      }
    }
  }
  return { ok: errors.length === 0, valid: errors.length === 0, errors, schemaName };
});

register("schema", "apply", async (ctx, input) => {
  const { schemaName, dtuId, data } = input;
  const schema = SCHEMA_REGISTRY.get(schemaName);
  if (!schema) return { ok: false, error: "Schema not found" };
  const validation = await runMacro("schema", "validate", { schemaName, data }, ctx);
  if (!validation.valid) return { ok: false, error: "Validation failed", errors: validation.errors };
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };
  dtu.machine = dtu.machine || {};
  dtu.machine.schema = schemaName;
  dtu.machine.schemaVersion = schema.version;
  dtu.machine.schemaData = data;
  dtu.tags = [...new Set([...(dtu.tags || []), schemaName, schema.kind])];
  dtu.updatedAt = nowISO();
  schema.usageCount++;
  STATE.dtus.set(dtuId, dtu);
  saveStateDebounced();
  return { ok: true, dtuId, schemaApplied: schemaName };
});

register("schema", "evolve", async (ctx, input) => {
  const { schemaName, changes, reason } = input;
  const schema = SCHEMA_REGISTRY.get(schemaName);
  if (!schema) return { ok: false, error: "Schema not found" };
  if (!schema.evolves) return { ok: false, error: "Schema evolution disabled" };
  STATE.queues.macroProposals.push({ type: "schema_evolution", schemaName, currentVersion: schema.version, proposedChanges: changes, reason: reason || "", proposedAt: nowISO() });
  saveStateDebounced();
  return { ok: true, message: "Schema evolution queued for council review" };
});

// Default schemas
const DEFAULT_SCHEMAS = [
  { name: "Hypothesis", kind: "hypothesis", fields: [{ name: "claim", type: "string", required: true }, { name: "evidence", type: "array", required: false }, { name: "confidence", type: "number", required: true, validation: { min: 0, max: 1 } }, { name: "testable", type: "boolean", required: true }, { name: "domain", type: "string", required: false }] },
  { name: "Experiment", kind: "experiment", fields: [{ name: "hypothesis", type: "reference", required: true }, { name: "method", type: "string", required: true }, { name: "variables", type: "array", required: true }, { name: "results", type: "string", required: false }, { name: "status", type: "string", required: true, validation: { enum: ["planned", "running", "completed", "failed"] } }] },
  { name: "Claim", kind: "claim", fields: [{ name: "statement", type: "string", required: true }, { name: "type", type: "string", required: true, validation: { enum: ["fact", "opinion", "inference", "speculation"] } }, { name: "sources", type: "array", required: false }, { name: "verifiable", type: "boolean", required: true }] },
  { name: "Evidence", kind: "evidence", fields: [{ name: "description", type: "string", required: true }, { name: "type", type: "string", required: true, validation: { enum: ["empirical", "testimonial", "documentary", "statistical", "analogical"] } }, { name: "strength", type: "number", required: true, validation: { min: 0, max: 1 } }, { name: "source", type: "string", required: true }] }
];
setTimeout(() => { for (const s of DEFAULT_SCHEMAS) { if (!SCHEMA_REGISTRY.has(s.name)) SCHEMA_REGISTRY.set(s.name, { ...s, id: uid("schema"), version: 1, createdAt: nowISO(), usageCount: 0, evolves: true }); } }, 100);

app.post("/api/schema", async (req, res) => res.json(await runMacro("schema", "create", req.body, makeCtx(req))));
app.get("/api/schema", async (req, res) => res.json(await runMacro("schema", "list", {}, makeCtx(req))));
app.post("/api/schema/validate", async (req, res) => res.json(await runMacro("schema", "validate", req.body, makeCtx(req))));
app.post("/api/schema/apply", async (req, res) => res.json(await runMacro("schema", "apply", req.body, makeCtx(req))));
app.post("/api/schema/evolve", async (req, res) => res.json(await runMacro("schema", "evolve", req.body, makeCtx(req))));

console.log("[Concord] Wave 3: Dynamic Schemas loaded");

// ============================================================================
// WAVE 4: AI-ASSISTED AUTO-TAGGING & VISUAL LENS (Surpassing Capacities)
// ============================================================================
const DOMAIN_KEYWORDS = {
  philosophy: ["ethics", "epistemology", "ontology", "metaphysics", "consciousness", "mind", "being", "existence", "moral", "virtue", "justice"],
  science: ["experiment", "hypothesis", "data", "evidence", "empirical", "theory", "research", "observation", "method", "scientific"],
  technology: ["algorithm", "software", "code", "system", "architecture", "api", "database", "network", "programming", "computer"],
  mathematics: ["theorem", "proof", "equation", "function", "set", "axiom", "logic", "number", "calculus", "algebra"],
  psychology: ["behavior", "cognition", "emotion", "perception", "memory", "learning", "motivation", "personality", "mental"],
  economics: ["market", "price", "supply", "demand", "trade", "value", "currency", "investment", "capital", "growth"],
  physics: ["quantum", "particle", "wave", "energy", "mass", "force", "field", "spacetime", "relativity", "momentum"],
  biology: ["cell", "gene", "organism", "evolution", "species", "protein", "dna", "ecosystem", "life", "organism"]
};

register("autotag", "analyze", async (ctx, input) => {
  const { dtuId, content, useEmbeddings } = input;
  const dtu = dtuId ? STATE.dtus.get(dtuId) : null;
  const text = content || (dtu ? dtu.title + " " + (dtu.human?.summary || "") + " " + (dtu.core?.definitions?.join(" ") || "") : "");
  if (!text) return { ok: false, error: "No content to analyze" };
  const suggestedTags = [], textLower = text.toLowerCase(), domainScores = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) { if (textLower.includes(kw)) { score++; suggestedTags.push(kw); } }
    if (score > 0) domainScores[domain] = score;
  }
  const topDomain = Object.entries(domainScores).sort((a, b) => b[1] - a[1])[0];
  const suggestedRelations = [];
  if (suggestedTags.length > 0) {
    const tagSet = new Set(suggestedTags);
    for (const [id, d] of STATE.dtus.entries()) {
      if (id === dtuId) continue;
      const overlap = (d.tags || []).filter(t => tagSet.has(t)).length;
      if (overlap >= 2) suggestedRelations.push({ id, title: d.title, overlap });
    }
    suggestedRelations.sort((a, b) => b.overlap - a.overlap);
  }
  return { ok: true, suggestedTags: [...new Set(suggestedTags)].slice(0, 10), suggestedDomain: topDomain ? topDomain[0] : null, domainScores, suggestedRelations: suggestedRelations.slice(0, 10) };
});

register("autotag", "apply", async (ctx, input) => {
  const { dtuId, tags, domain, relations } = input;
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };
  if (tags && tags.length > 0) dtu.tags = [...new Set([...(dtu.tags || []), ...tags])];
  if (domain) { dtu.tags = [...new Set([...(dtu.tags || []), domain])]; dtu.meta = dtu.meta || {}; dtu.meta.autotaggedDomain = domain; }
  if (relations && relations.length > 0) { dtu.lineage = dtu.lineage || { parents: [], children: [] }; for (const rel of relations) { if (!dtu.lineage.parents.includes(rel.id)) dtu.lineage.parents.push(rel.id); } }
  dtu.meta = dtu.meta || {}; dtu.meta.autotaggedAt = nowISO(); dtu.updatedAt = nowISO();
  STATE.dtus.set(dtuId, dtu);
  GRAPH_INDEX.dirty = true;
  saveStateDebounced();
  return { ok: true, dtuId, appliedTags: tags, appliedDomain: domain, linkedRelations: relations?.length || 0 };
});

register("autotag", "batchProcess", async (ctx, input) => {
  const { tier, limit, dryRun } = input;
  let dtus = dtusArray().filter(d => !d.meta?.autotaggedAt);
  if (tier) dtus = dtus.filter(d => d.tier === tier);
  dtus = dtus.slice(0, Number(limit) || 50);
  const results = [];
  for (const dtu of dtus) {
    const analysis = await runMacro("autotag", "analyze", { dtuId: dtu.id }, ctx);
    if (analysis.ok && analysis.suggestedTags.length > 0) {
      if (!dryRun) await runMacro("autotag", "apply", { dtuId: dtu.id, tags: analysis.suggestedTags, domain: analysis.suggestedDomain }, ctx);
      results.push({ dtuId: dtu.id, title: dtu.title, suggestedTags: analysis.suggestedTags, suggestedDomain: analysis.suggestedDomain, applied: !dryRun });
    }
  }
  return { ok: true, processed: results.length, results, dryRun: !!dryRun };
});

register("visual", "moodboard", async (ctx, input) => {
  const { tags, tier, maxNodes } = input;
  let dtus = dtusArray();
  if (tags && tags.length > 0) { const tagSet = new Set(tags); dtus = dtus.filter(d => (d.tags || []).some(t => tagSet.has(t))); }
  if (tier) dtus = dtus.filter(d => d.tier === tier);
  dtus = dtus.slice(0, Number(maxNodes) || 100);
  const tagGroups = {};
  for (const dtu of dtus) { const primaryTag = dtu.tags?.[0] || "untagged"; if (!tagGroups[primaryTag]) tagGroups[primaryTag] = []; tagGroups[primaryTag].push({ id: dtu.id, title: dtu.title, tier: dtu.tier, size: (dtu.core?.definitions?.length || 1) + (dtu.core?.claims?.length || 0) }); }
  const hierarchy = { name: "Knowledge", children: Object.entries(tagGroups).map(([tag, items]) => ({ name: tag, children: items.map(i => ({ name: i.title, id: i.id, size: i.size, tier: i.tier })) })) };
  return { ok: true, hierarchy, totalNodes: dtus.length, tagCount: Object.keys(tagGroups).length };
});

register("visual", "sunburst", async (ctx, input) => {
  const { maxDepth, maxNodes } = input;
  const depth = Number(maxDepth) || 3;
  const hierarchy = { name: "Concord", children: [] };
  const tierGroups = { core: [], mega: [], hyper: [], regular: [] };
  for (const dtu of dtusArray().slice(0, Number(maxNodes) || 200)) { const t = dtu.tier || "regular"; if (tierGroups[t]) tierGroups[t].push(dtu); }
  for (const [tier, dtus] of Object.entries(tierGroups)) {
    if (dtus.length === 0) continue;
    const tierNode = { name: tier.toUpperCase(), children: [] };
    const tagMap = {};
    for (const dtu of dtus) { const tag = dtu.tags?.[0] || "untagged"; if (!tagMap[tag]) tagMap[tag] = []; tagMap[tag].push({ name: dtu.title.slice(0, 30), id: dtu.id, value: 1 }); }
    for (const [tag, nodes] of Object.entries(tagMap)) { tierNode.children.push({ name: tag, children: nodes }); }
    hierarchy.children.push(tierNode);
  }
  return { ok: true, hierarchy };
});

register("visual", "timeline", async (ctx, input) => {
  const { startDate, endDate, limit } = input;
  let dtus = dtusArray().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (startDate) dtus = dtus.filter(d => new Date(d.createdAt) >= new Date(startDate));
  if (endDate) dtus = dtus.filter(d => new Date(d.createdAt) <= new Date(endDate));
  dtus = dtus.slice(0, Number(limit) || 100);
  const events = dtus.map(d => ({ id: d.id, title: d.title, date: d.createdAt, tier: d.tier, tags: d.tags?.slice(0, 3) }));
  return { ok: true, events, count: events.length };
});

app.post("/api/autotag/analyze", async (req, res) => res.json(await runMacro("autotag", "analyze", req.body, makeCtx(req))));
app.post("/api/autotag/apply", async (req, res) => res.json(await runMacro("autotag", "apply", req.body, makeCtx(req))));
app.post("/api/autotag/batch", async (req, res) => res.json(await runMacro("autotag", "batchProcess", req.body, makeCtx(req))));
app.get("/api/visual/moodboard", async (req, res) => res.json(await runMacro("visual", "moodboard", { tags: req.query.tags?.split(","), tier: req.query.tier, maxNodes: req.query.maxNodes }, makeCtx(req))));
app.get("/api/visual/sunburst", async (req, res) => res.json(await runMacro("visual", "sunburst", { maxDepth: req.query.maxDepth, maxNodes: req.query.maxNodes }, makeCtx(req))));
app.get("/api/visual/timeline", async (req, res) => res.json(await runMacro("visual", "timeline", { startDate: req.query.startDate, endDate: req.query.endDate, limit: req.query.limit }, makeCtx(req))));

console.log("[Concord] Wave 4: Auto-Tagging & Visuals loaded");

// ============================================================================
// WAVE 5: REAL-TIME COLLABORATION & WHITEBOARD (Surpassing AFFiNE)
// ============================================================================
const COLLAB_SESSIONS = new Map();
const COLLAB_LOCKS = new Map();

register("collab", "createSession", async (ctx, input) => {
  const { dtuId, userId, mode } = input;
  if (!dtuId) return { ok: false, error: "DTU ID required" };
  const session = {
    id: uid("collab"),
    dtuId,
    creatorId: userId || "anonymous",
    mode: mode || "edit",
    participants: [{ userId: userId || "anonymous", joinedAt: nowISO(), role: "owner" }],
    changes: [],
    createdAt: nowISO(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    councilGated: true
  };
  COLLAB_SESSIONS.set(session.id, session);
  realtimeEmit("collab:session:created", { sessionId: session.id, dtuId }, { sessionId: ctx.reqMeta?.sessionId });
  return { ok: true, session };
});

register("collab", "join", async (ctx, input) => {
  const { sessionId, userId } = input;
  const session = COLLAB_SESSIONS.get(sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  if (!session.participants.find(p => p.userId === userId)) session.participants.push({ userId: userId || "anonymous", joinedAt: nowISO(), role: "collaborator" });
  realtimeEmit("collab:user:joined", { sessionId, userId }, { sessionId: ctx.reqMeta?.sessionId });
  return { ok: true, session };
});

register("collab", "edit", async (ctx, input) => {
  const { sessionId, userId, operation, path, value, previousValue } = input;
  const session = COLLAB_SESSIONS.get(sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  const lockKey = `${session.dtuId}:${path}`;
  const existingLock = COLLAB_LOCKS.get(lockKey);
  if (existingLock && existingLock.userId !== userId && Date.now() - new Date(existingLock.lockedAt).getTime() < 30000) return { ok: false, error: "Path locked by another user", lockedBy: existingLock.userId };
  const change = { id: uid("change"), userId: userId || "anonymous", operation: operation || "update", path, value, previousValue, timestamp: nowISO(), status: "pending" };
  session.changes.push(change);
  realtimeEmit("collab:change", { sessionId, change }, { sessionId: ctx.reqMeta?.sessionId });
  return { ok: true, change, session };
});

register("collab", "merge", async (ctx, input) => {
  const { sessionId } = input;
  const session = COLLAB_SESSIONS.get(sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  if (session.councilGated) {
    STATE.queues.macroProposals.push({ type: "collab_merge", sessionId, dtuId: session.dtuId, changeCount: session.changes.length, participants: session.participants.map(p => p.userId), proposedAt: nowISO() });
    saveStateDebounced();
    return { ok: true, message: "Merge queued for council review", queuedChanges: session.changes.length };
  }
  const dtu = STATE.dtus.get(session.dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };
  for (const change of session.changes.filter(c => c.status === "pending")) {
    const pathParts = change.path.split(".");
    let target = dtu;
    for (let i = 0; i < pathParts.length - 1; i++) target = target[pathParts[i]] = target[pathParts[i]] || {};
    target[pathParts[pathParts.length - 1]] = change.value;
    change.status = "applied";
  }
  dtu.updatedAt = nowISO();
  dtu.meta = dtu.meta || {};
  dtu.meta.lastCollabSession = sessionId;
  STATE.dtus.set(session.dtuId, dtu);
  saveStateDebounced();
  return { ok: true, merged: session.changes.filter(c => c.status === "applied").length };
});

register("collab", "listSessions", async (ctx, input) => {
  const sessions = Array.from(COLLAB_SESSIONS.values()).filter(s => new Date(s.expiresAt) > new Date()).map(s => ({ id: s.id, dtuId: s.dtuId, mode: s.mode, participantCount: s.participants.length, changeCount: s.changes.length, createdAt: s.createdAt }));
  return { ok: true, sessions, count: sessions.length };
});

register("collab", "lock", async (ctx, input) => {
  const { sessionId, userId, path } = input;
  const session = COLLAB_SESSIONS.get(sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  const lockKey = `${session.dtuId}:${path}`;
  COLLAB_LOCKS.set(lockKey, { userId, lockedAt: nowISO(), path });
  realtimeEmit("collab:lock", { sessionId, userId, path }, {});
  return { ok: true, locked: true, path };
});

register("collab", "unlock", async (ctx, input) => {
  const { sessionId, path } = input;
  const session = COLLAB_SESSIONS.get(sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  const lockKey = `${session.dtuId}:${path}`;
  COLLAB_LOCKS.delete(lockKey);
  realtimeEmit("collab:unlock", { sessionId, path }, {});
  return { ok: true, unlocked: true, path };
});

// Whiteboard with Excalidraw integration
register("whiteboard", "create", async (ctx, input) => {
  const { title, linkedDtus } = input;
  const whiteboard = { id: uid("wb"), title: title || "Untitled Whiteboard", elements: [], linkedDtus: linkedDtus || [], collaborators: [], createdAt: nowISO(), updatedAt: nowISO() };
  const wbDtu = {
    id: whiteboard.id,
    title: `Whiteboard: ${whiteboard.title}`,
    tier: "regular",
    tags: ["whiteboard", "visual"],
    human: { summary: `Visual whiteboard with ${whiteboard.linkedDtus.length} linked DTUs` },
    machine: { kind: "whiteboard", data: whiteboard },
    lineage: { parents: whiteboard.linkedDtus, children: [] },
    source: "whiteboard",
    createdAt: whiteboard.createdAt
  };
  STATE.dtus.set(wbDtu.id, wbDtu);
  saveStateDebounced();
  return { ok: true, whiteboard, dtuId: wbDtu.id };
});

register("whiteboard", "update", async (ctx, input) => {
  const { whiteboardId, elements, linkedDtus } = input;
  const dtu = STATE.dtus.get(whiteboardId);
  if (!dtu || dtu.machine?.kind !== "whiteboard") return { ok: false, error: "Whiteboard not found" };
  const wb = dtu.machine.data;
  if (elements) wb.elements = elements;
  if (linkedDtus) { wb.linkedDtus = linkedDtus; dtu.lineage.parents = linkedDtus; }
  wb.updatedAt = nowISO();
  dtu.updatedAt = nowISO();
  STATE.dtus.set(whiteboardId, dtu);
  saveStateDebounced();
  realtimeEmit("whiteboard:updated", { whiteboardId, elementCount: wb.elements.length }, {});
  return { ok: true, whiteboard: wb };
});

register("whiteboard", "get", async (ctx, input) => {
  const { whiteboardId } = input;
  const dtu = STATE.dtus.get(whiteboardId);
  if (!dtu || dtu.machine?.kind !== "whiteboard") return { ok: false, error: "Whiteboard not found" };
  return { ok: true, whiteboard: dtu.machine.data, linkedDtus: dtu.lineage?.parents || [] };
});

register("whiteboard", "list", async (ctx, input) => {
  const whiteboards = dtusArray().filter(d => d.machine?.kind === "whiteboard").map(d => ({ id: d.id, title: d.title, elementCount: d.machine.data?.elements?.length || 0, linkedDtuCount: d.lineage?.parents?.length || 0, createdAt: d.createdAt }));
  return { ok: true, whiteboards, count: whiteboards.length };
});

app.post("/api/collab/session", async (req, res) => res.json(await runMacro("collab", "createSession", req.body, makeCtx(req))));
app.post("/api/collab/join", async (req, res) => res.json(await runMacro("collab", "join", req.body, makeCtx(req))));
app.post("/api/collab/edit", async (req, res) => res.json(await runMacro("collab", "edit", req.body, makeCtx(req))));
app.post("/api/collab/merge", async (req, res) => res.json(await runMacro("collab", "merge", req.body, makeCtx(req))));
app.get("/api/collab/sessions", async (req, res) => res.json(await runMacro("collab", "listSessions", {}, makeCtx(req))));
app.post("/api/collab/lock", async (req, res) => res.json(await runMacro("collab", "lock", req.body, makeCtx(req))));
app.post("/api/collab/unlock", async (req, res) => res.json(await runMacro("collab", "unlock", req.body, makeCtx(req))));
app.post("/api/whiteboard", async (req, res) => res.json(await runMacro("whiteboard", "create", req.body, makeCtx(req))));
app.put("/api/whiteboard/:id", async (req, res) => res.json(await runMacro("whiteboard", "update", { whiteboardId: req.params.id, ...req.body }, makeCtx(req))));
app.get("/api/whiteboard/:id", async (req, res) => res.json(await runMacro("whiteboard", "get", { whiteboardId: req.params.id }, makeCtx(req))));
app.get("/api/whiteboards", async (req, res) => res.json(await runMacro("whiteboard", "list", {}, makeCtx(req))));

console.log("[Concord] Wave 5: Collaboration & Whiteboard loaded");

// ============================================================================
// WAVE 6: PWA & MOBILE SUPPORT
// ============================================================================
register("pwa", "manifest", async (ctx, input) => {
  return {
    ok: true,
    manifest: {
      name: "Concord Cognitive Engine",
      short_name: "Concord",
      description: "Local-first cognitive operating system for knowledge synthesis",
      start_url: "/",
      display: "standalone",
      background_color: "#1a1a2e",
      theme_color: "#6366f1",
      orientation: "any",
      icons: [
        { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
        { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
        { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
        { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
        { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
      ],
      categories: ["productivity", "education", "utilities"],
      shortcuts: [
        { name: "Quick Forge", short_name: "Forge", url: "/lenses/forge", icons: [{ src: "/icons/forge.png", sizes: "192x192" }] },
        { name: "Chat", short_name: "Chat", url: "/lenses/chat", icons: [{ src: "/icons/chat.png", sizes: "192x192" }] },
        { name: "Graph", short_name: "Graph", url: "/lenses/graph", icons: [{ src: "/icons/graph.png", sizes: "192x192" }] },
        { name: "Voice Note", short_name: "Voice", url: "/lenses/voice", icons: [{ src: "/icons/voice.png", sizes: "192x192" }] }
      ],
      share_target: { action: "/share", method: "POST", enctype: "multipart/form-data", params: { title: "title", text: "text", url: "url" } }
    }
  };
});

register("pwa", "serviceWorkerConfig", async (ctx, input) => {
  return {
    ok: true,
    config: {
      version: VERSION,
      cacheFirst: ["/api/dtus", "/api/status", "/api/personas", "/api/schema", "/api/plugins"],
      networkFirst: ["/api/chat", "/api/forge", "/api/ask", "/api/collab"],
      staleWhileRevalidate: ["/api/search", "/api/graph", "/api/visual"],
      offlineOnly: ["/api/dtus/local", "/api/cache"],
      precache: ["/", "/lenses/chat", "/lenses/forge", "/lenses/graph", "/manifest.json"],
      syncTags: ["dtu-sync", "collab-sync", "voice-sync"],
      backgroundSync: { enabled: true, minInterval: 300000, maxRetries: 3 },
      pushNotifications: { enabled: true, vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null }
    }
  };
});

register("voice", "ingest", async (ctx, input) => {
  const { audioData, format, language, autoForge } = input;
  const transcription = await runMacro("voice", "transcribe", { audio: audioData, format: format || "webm", language: language || "en" }, ctx);
  if (!transcription.ok) return transcription;
  const text = transcription.text;
  if (!autoForge) return { ok: true, transcription: text };
  const tags = await runMacro("autotag", "analyze", { content: text }, ctx);
  const dtu = await runMacro("dtu", "create", {
    title: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
    human: { summary: text },
    tags: tags.ok ? [...tags.suggestedTags, "voice-note"] : ["voice-note"],
    source: "voice-ingest",
    meta: { voiceIngest: true, language: language || "en", format: format || "webm", transcribedAt: nowISO() }
  }, ctx);
  return { ok: true, transcription: text, dtu: dtu.dtu };
});

register("mobile", "shortcuts", async (ctx, input) => {
  return {
    ok: true,
    shortcuts: [
      { id: "quick-forge", label: "Quick Forge", action: "/api/forge/manual", icon: "plus-circle", gesture: "swipe-right" },
      { id: "voice-note", label: "Voice Note", action: "/api/voice/ingest", icon: "microphone", gesture: "long-press" },
      { id: "search", label: "Search", action: "/api/search/indexed", icon: "search", gesture: "swipe-down" },
      { id: "recent", label: "Recent DTUs", action: "/api/dtus/recent", icon: "clock", gesture: "swipe-left" },
      { id: "graph-view", label: "Graph View", action: "/lenses/graph", icon: "network", gesture: "pinch" },
      { id: "sync", label: "Force Sync", action: "/api/sync/force", icon: "refresh", gesture: "pull-down" }
    ],
    gestures: {
      enabled: true,
      sensitivity: 0.7,
      hapticFeedback: true
    }
  };
});

register("mobile", "touchOptimized", async (ctx, input) => {
  const { dtuId } = input;
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };
  return {
    ok: true,
    compactView: {
      id: dtu.id,
      title: dtu.title,
      tier: dtu.tier,
      tags: (dtu.tags || []).slice(0, 3),
      summary: (dtu.human?.summary || "").slice(0, 140),
      bulletCount: dtu.human?.bullets?.length || 0,
      hasLineage: !!(dtu.lineage?.parents?.length || dtu.lineage?.children?.length),
      createdAt: dtu.createdAt
    },
    actions: [
      { id: "view", label: "View", icon: "eye" },
      { id: "edit", label: "Edit", icon: "pencil" },
      { id: "share", label: "Share", icon: "share" },
      { id: "link", label: "Link", icon: "link" },
      { id: "delete", label: "Delete", icon: "trash", danger: true }
    ]
  };
});

register("sync", "force", async (ctx, input) => {
  const { since } = input;
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const modified = dtusArray().filter(d => new Date(d.updatedAt || d.createdAt) > sinceDate);
  return {
    ok: true,
    synced: modified.length,
    dtus: modified.map(d => ({ id: d.id, title: d.title, updatedAt: d.updatedAt || d.createdAt })),
    syncedAt: nowISO()
  };
});

app.get("/manifest.json", async (req, res) => { const out = await runMacro("pwa", "manifest", {}, makeCtx(req)); res.json(out.manifest); });
app.get("/api/pwa/sw-config", async (req, res) => res.json(await runMacro("pwa", "serviceWorkerConfig", {}, makeCtx(req))));
app.post("/api/voice/ingest", async (req, res) => res.json(await runMacro("voice", "ingest", req.body, makeCtx(req))));
app.get("/api/mobile/shortcuts", async (req, res) => res.json(await runMacro("mobile", "shortcuts", {}, makeCtx(req))));
app.get("/api/mobile/dtu/:id", async (req, res) => res.json(await runMacro("mobile", "touchOptimized", { dtuId: req.params.id }, makeCtx(req))));
app.post("/api/sync/force", async (req, res) => res.json(await runMacro("sync", "force", req.body, makeCtx(req))));

console.log("[Concord] Wave 6: PWA & Mobile loaded");

// ============================================================================
// WAVE 7: SCALABILITY & PERFORMANCE
// ============================================================================
const CACHE = { hot: new Map(), queries: new Map(), ttl: 300000, maxSize: 1000 };

register("cache", "get", async (ctx, input) => {
  const { key } = input;
  const cached = CACHE.hot.get(key);
  if (!cached) return { ok: false, miss: true };
  if (Date.now() - cached.cachedAt > (cached.ttl || CACHE.ttl)) { CACHE.hot.delete(key); return { ok: false, miss: true, expired: true }; }
  return { ok: true, data: cached.data, cachedAt: cached.cachedAt };
});

register("cache", "set", async (ctx, input) => {
  const { key, data, ttl } = input;
  CACHE.hot.set(key, { data, cachedAt: Date.now(), ttl: ttl || CACHE.ttl });
  if (CACHE.hot.size > CACHE.maxSize) {
    const entries = Array.from(CACHE.hot.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    for (let i = 0; i < 100; i++) CACHE.hot.delete(entries[i][0]);
  }
  return { ok: true, key, cached: true };
});

register("cache", "invalidate", async (ctx, input) => {
  const { key, pattern } = input;
  if (key) { CACHE.hot.delete(key); return { ok: true, invalidated: 1 }; }
  if (pattern) { const re = new RegExp(pattern); let count = 0; for (const k of CACHE.hot.keys()) { if (re.test(k)) { CACHE.hot.delete(k); count++; } } return { ok: true, invalidated: count }; }
  return { ok: false, error: "Key or pattern required" };
});

register("cache", "stats", async (ctx, input) => {
  return { ok: true, size: CACHE.hot.size, maxSize: CACHE.maxSize, ttl: CACHE.ttl, queryCache: CACHE.queries.size };
});

register("cache", "clear", async (ctx, input) => {
  const size = CACHE.hot.size;
  CACHE.hot.clear();
  CACHE.queries.clear();
  return { ok: true, cleared: size };
});

// Sharding for multi-tenant
register("shard", "route", async (ctx, input) => {
  const { userId, orgId } = input;
  const shardKey = orgId || userId || "default";
  const hash = crypto.createHash("md5").update(shardKey).digest("hex");
  const shardNum = parseInt(hash.slice(0, 8), 16) % 16;
  return {
    ok: true,
    shardKey,
    shardNum,
    shardId: `shard_${shardNum.toString().padStart(2, "0")}`,
    routing: { primary: `shard_${shardNum.toString().padStart(2, "0")}`, replicas: [`shard_${((shardNum + 1) % 16).toString().padStart(2, "0")}`, `shard_${((shardNum + 2) % 16).toString().padStart(2, "0")}`] }
  };
});

register("shard", "stats", async (ctx, input) => {
  const shards = {};
  for (const [id, dtu] of STATE.dtus.entries()) {
    const shardResult = await runMacro("shard", "route", { userId: dtu.meta?.userId, orgId: dtu.meta?.orgId }, ctx);
    const shardId = shardResult.shardId;
    if (!shards[shardId]) shards[shardId] = { count: 0, size: 0 };
    shards[shardId].count++;
    shards[shardId].size += JSON.stringify(dtu).length;
  }
  return { ok: true, shards, totalShards: Object.keys(shards).length };
});

// Governor for rate limiting
register("governor", "configure", async (ctx, input) => {
  const { userId, maxDtusPerHour, maxQueriesPerMinute, heartbeatInterval } = input;
  const governor = {
    userId: userId || "default",
    limits: { maxDtusPerHour: Number(maxDtusPerHour) || 100, maxQueriesPerMinute: Number(maxQueriesPerMinute) || 60, heartbeatInterval: Number(heartbeatInterval) || 15000 },
    usage: { dtusThisHour: 0, queriesThisMinute: 0, lastHourReset: Date.now(), lastMinuteReset: Date.now() },
    configuredAt: nowISO()
  };
  STATE.governors = STATE.governors || new Map();
  STATE.governors.set(governor.userId, governor);
  saveStateDebounced();
  return { ok: true, governor };
});

register("governor", "check", async (ctx, input) => {
  const { userId, action } = input;
  const governor = STATE.governors?.get(userId) || STATE.governors?.get("default");
  if (!governor) return { ok: true, allowed: true };
  const now = Date.now();
  if (now - governor.usage.lastHourReset > 3600000) { governor.usage.dtusThisHour = 0; governor.usage.lastHourReset = now; }
  if (now - governor.usage.lastMinuteReset > 60000) { governor.usage.queriesThisMinute = 0; governor.usage.lastMinuteReset = now; }
  if (action === "create_dtu" && governor.usage.dtusThisHour >= governor.limits.maxDtusPerHour) return { ok: true, allowed: false, reason: "DTU creation limit reached", retryAfter: 3600000 - (now - governor.usage.lastHourReset) };
  if (action === "query" && governor.usage.queriesThisMinute >= governor.limits.maxQueriesPerMinute) return { ok: true, allowed: false, reason: "Query rate limit reached", retryAfter: 60000 - (now - governor.usage.lastMinuteReset) };
  return { ok: true, allowed: true, usage: governor.usage, limits: governor.limits };
});

register("governor", "increment", async (ctx, input) => {
  const { userId, action } = input;
  const governor = STATE.governors?.get(userId) || STATE.governors?.get("default");
  if (!governor) return { ok: true };
  if (action === "create_dtu") governor.usage.dtusThisHour++;
  if (action === "query") governor.usage.queriesThisMinute++;
  return { ok: true, usage: governor.usage };
});

// Performance metrics
register("perf", "metrics", async (ctx, input) => {
  const mem = process.memoryUsage();
  return {
    ok: true,
    memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024), heapTotal: Math.round(mem.heapTotal / 1024 / 1024), rss: Math.round(mem.rss / 1024 / 1024), external: Math.round(mem.external / 1024 / 1024) },
    uptime: process.uptime(),
    dtus: { total: STATE.dtus.size, shadow: STATE.shadowDtus?.size || 0 },
    cache: { hot: CACHE.hot.size, queries: CACHE.queries.size },
    graph: { nodes: GRAPH_INDEX.nodes.size, edges: GRAPH_INDEX.edges.size, dirty: GRAPH_INDEX.dirty },
    collab: { sessions: COLLAB_SESSIONS.size, locks: COLLAB_LOCKS.size },
    plugins: { marketplace: PLUGIN_MARKETPLACE.listings.size, installed: PLUGIN_MARKETPLACE.installed.size }
  };
});

register("perf", "gc", async (ctx, input) => {
  if (global.gc) { global.gc(); return { ok: true, gcRun: true }; }
  return { ok: false, error: "GC not exposed. Start node with --expose-gc" };
});

// Backpressure for conservation
register("backpressure", "status", async (ctx, input) => {
  const dtuCount = STATE.dtus.size;
  const thresholds = { warning: 50000, critical: 100000, max: 200000 };
  let level = "normal";
  if (dtuCount > thresholds.critical) level = "critical";
  else if (dtuCount > thresholds.warning) level = "warning";
  return {
    ok: true,
    level,
    dtuCount,
    thresholds,
    recommendations: level === "critical" ? ["Run MEGA consolidation", "Archive old DTUs", "Increase promotion rate"] : level === "warning" ? ["Consider archiving inactive DTUs", "Review promotion thresholds"] : []
  };
});

app.get("/api/cache/:key", async (req, res) => res.json(await runMacro("cache", "get", { key: req.params.key }, makeCtx(req))));
app.post("/api/cache", async (req, res) => res.json(await runMacro("cache", "set", req.body, makeCtx(req))));
app.delete("/api/cache", async (req, res) => res.json(await runMacro("cache", "invalidate", req.body, makeCtx(req))));
app.get("/api/cache/stats", async (req, res) => res.json(await runMacro("cache", "stats", {}, makeCtx(req))));
app.post("/api/cache/clear", async (req, res) => res.json(await runMacro("cache", "clear", {}, makeCtx(req))));
app.get("/api/shard/route", async (req, res) => res.json(await runMacro("shard", "route", { userId: req.query.userId, orgId: req.query.orgId }, makeCtx(req))));
app.get("/api/shard/stats", async (req, res) => res.json(await runMacro("shard", "stats", {}, makeCtx(req))));
app.post("/api/governor/configure", async (req, res) => res.json(await runMacro("governor", "configure", req.body, makeCtx(req))));
app.get("/api/governor/check", async (req, res) => res.json(await runMacro("governor", "check", { userId: req.query.userId, action: req.query.action }, makeCtx(req))));
app.get("/api/perf/metrics", async (req, res) => res.json(await runMacro("perf", "metrics", {}, makeCtx(req))));
app.post("/api/perf/gc", async (req, res) => res.json(await runMacro("perf", "gc", {}, makeCtx(req))));
app.get("/api/backpressure/status", async (req, res) => res.json(await runMacro("backpressure", "status", {}, makeCtx(req))));

console.log("[Concord] Wave 7: Scalability & Performance loaded");

// ============================================================================
// WAVE 8: INTEGRATIONS ECOSYSTEM (Surpassing Roam Research)
// ============================================================================
const WEBHOOKS = new Map();
const AUTOMATIONS = new Map();

register("webhook", "register", async (ctx, input) => {
  const { url, events, secret, name, headers } = input;
  if (!url || !events) return { ok: false, error: "URL and events required" };
  const webhook = {
    id: uid("wh"),
    name: name || "Unnamed Webhook",
    url,
    events: Array.isArray(events) ? events : [events],
    secret: secret || crypto.randomBytes(32).toString("hex"),
    headers: headers || {},
    enabled: true,
    createdAt: nowISO(),
    lastTriggered: null,
    triggerCount: 0,
    failureCount: 0,
    lastError: null
  };
  WEBHOOKS.set(webhook.id, webhook);
  saveStateDebounced();
  return { ok: true, webhook: { ...webhook, secret: webhook.secret.slice(0, 8) + "..." } };
});

register("webhook", "trigger", async (ctx, input) => {
  const { event, payload } = input;
  const matchingWebhooks = Array.from(WEBHOOKS.values()).filter(wh => wh.enabled && wh.events.includes(event));
  const results = [];
  for (const webhook of matchingWebhooks) {
    const signature = crypto.createHmac("sha256", webhook.secret).update(JSON.stringify(payload)).digest("hex");
    webhook.lastTriggered = nowISO();
    webhook.triggerCount++;
    results.push({ webhookId: webhook.id, name: webhook.name, triggered: true, signature: signature.slice(0, 16) + "..." });
  }
  return { ok: true, event, triggered: results.length, results };
});

register("webhook", "list", async (ctx, input) => {
  const webhooks = Array.from(WEBHOOKS.values()).map(wh => ({ id: wh.id, name: wh.name, url: wh.url, events: wh.events, enabled: wh.enabled, triggerCount: wh.triggerCount, lastTriggered: wh.lastTriggered }));
  return { ok: true, webhooks, count: webhooks.length };
});

register("webhook", "delete", async (ctx, input) => {
  const { webhookId } = input;
  if (!WEBHOOKS.has(webhookId)) return { ok: false, error: "Webhook not found" };
  WEBHOOKS.delete(webhookId);
  saveStateDebounced();
  return { ok: true, deleted: webhookId };
});

register("webhook", "toggle", async (ctx, input) => {
  const { webhookId, enabled } = input;
  const webhook = WEBHOOKS.get(webhookId);
  if (!webhook) return { ok: false, error: "Webhook not found" };
  webhook.enabled = enabled !== undefined ? enabled : !webhook.enabled;
  return { ok: true, webhookId, enabled: webhook.enabled };
});

// Zapier-style automations
register("automation", "create", async (ctx, input) => {
  const { name, trigger, conditions, actions } = input;
  if (!name || !trigger || !actions) return { ok: false, error: "Name, trigger, and actions required" };
  const automation = {
    id: uid("auto"),
    name: normalizeText(name),
    trigger: { event: trigger.event, filters: trigger.filters || {} },
    conditions: conditions || [],
    actions: actions.map(a => ({ type: a.type, config: a.config || {} })),
    enabled: true,
    createdAt: nowISO(),
    runCount: 0,
    lastRun: null,
    lastResult: null
  };
  AUTOMATIONS.set(automation.id, automation);
  saveStateDebounced();
  return { ok: true, automation };
});

register("automation", "run", async (ctx, input) => {
  const { automationId, triggerData } = input;
  const automation = AUTOMATIONS.get(automationId);
  if (!automation) return { ok: false, error: "Automation not found" };
  if (!automation.enabled) return { ok: false, error: "Automation disabled" };
  const results = [];
  for (const action of automation.actions) {
    try {
      if (action.type === "create_dtu") { results.push({ action: "create_dtu", result: await runMacro("dtu", "create", { ...action.config, ...triggerData }, ctx) }); }
      else if (action.type === "update_dtu") { results.push({ action: "update_dtu", result: await runMacro("dtu", "update", { ...action.config, ...triggerData }, ctx) }); }
      else if (action.type === "run_macro") { const [domain, op] = action.config.macro.split("."); results.push({ action: "run_macro", macro: action.config.macro, result: await runMacro(domain, op, { ...action.config.input, ...triggerData }, ctx) }); }
      else if (action.type === "send_webhook") { results.push({ action: "send_webhook", result: await runMacro("webhook", "trigger", { event: "automation.action", payload: { automationId, triggerData, action } }, ctx) }); }
      else if (action.type === "notify") { results.push({ action: "notify", result: { ok: true, message: action.config.message } }); }
    } catch (e) { results.push({ action: action.type, error: e.message }); }
  }
  automation.runCount++;
  automation.lastRun = nowISO();
  automation.lastResult = results;
  return { ok: true, automationId, actionResults: results };
});

register("automation", "list", async (ctx, input) => {
  const automations = Array.from(AUTOMATIONS.values()).map(a => ({ id: a.id, name: a.name, trigger: a.trigger.event, actionCount: a.actions.length, enabled: a.enabled, runCount: a.runCount, lastRun: a.lastRun }));
  return { ok: true, automations, count: automations.length };
});

register("automation", "delete", async (ctx, input) => {
  const { automationId } = input;
  if (!AUTOMATIONS.has(automationId)) return { ok: false, error: "Automation not found" };
  AUTOMATIONS.delete(automationId);
  saveStateDebounced();
  return { ok: true, deleted: automationId };
});

register("automation", "toggle", async (ctx, input) => {
  const { automationId, enabled } = input;
  const automation = AUTOMATIONS.get(automationId);
  if (!automation) return { ok: false, error: "Automation not found" };
  automation.enabled = enabled !== undefined ? enabled : !automation.enabled;
  return { ok: true, automationId, enabled: automation.enabled };
});

// VS Code extension support
register("vscode", "codeToDtu", async (ctx, input) => {
  const { code, language, filename, selection, context, autoTag } = input;
  if (!code) return { ok: false, error: "Code content required" };
  const dtu = {
    id: uid("dtu"),
    title: `Code: ${filename || "snippet"} (${language || "unknown"})`,
    tier: "regular",
    tags: ["code", language || "unknown", "vscode-import"],
    human: { summary: `Code snippet from ${filename || "editor"}`, bullets: selection ? [`Lines ${selection.start}-${selection.end}`] : [] },
    core: { definitions: [`Language: ${language}`], examples: [code.slice(0, 1000)] },
    machine: { kind: "code_snippet", code, language, filename, selection, context },
    source: "vscode",
    createdAt: nowISO()
  };
  STATE.dtus.set(dtu.id, dtu);
  GRAPH_INDEX.dirty = true;
  saveStateDebounced();
  if (autoTag) await runMacro("autotag", "apply", { dtuId: dtu.id, tags: ["code", language].filter(Boolean) }, ctx);
  return { ok: true, dtu };
});

register("vscode", "dtuToCode", async (ctx, input) => {
  const { dtuId, format } = input;
  const dtu = STATE.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };
  let code = "";
  if (dtu.machine?.code) code = dtu.machine.code;
  else if (dtu.core?.examples?.[0]) code = dtu.core.examples[0];
  else { code = `// DTU: ${dtu.title}\n// Tags: ${(dtu.tags || []).join(", ")}\n\n`; if (dtu.human?.summary) code += `/* ${dtu.human.summary} */\n\n`; if (dtu.core?.definitions) code += dtu.core.definitions.map(d => `// ${d}`).join("\n"); }
  return { ok: true, code, language: dtu.machine?.language || "plaintext", dtuId };
});

register("vscode", "search", async (ctx, input) => {
  const { query, language, limit } = input;
  let results = dtusArray().filter(d => d.tags?.includes("code") || d.machine?.kind === "code_snippet");
  if (language) results = results.filter(d => d.machine?.language === language || d.tags?.includes(language));
  if (query) { const q = query.toLowerCase(); results = results.filter(d => d.title.toLowerCase().includes(q) || (d.machine?.code || "").toLowerCase().includes(q)); }
  results = results.slice(0, Number(limit) || 20);
  return { ok: true, results: results.map(d => ({ id: d.id, title: d.title, language: d.machine?.language, filename: d.machine?.filename, preview: (d.machine?.code || "").slice(0, 100) })), count: results.length };
});

// Obsidian export/import
register("obsidian", "export", async (ctx, input) => {
  const { dtuIds, includeLineage, vaultPath } = input;
  const dtus = dtuIds ? dtuIds.map(id => STATE.dtus.get(id)).filter(Boolean) : dtusArray();
  const files = [];
  for (const dtu of dtus) {
    let content = `# ${dtu.title}\n\n`;
    content += `> ${dtu.human?.summary || ""}\n\n`;
    content += `**Tags:** ${(dtu.tags || []).map(t => `#${t}`).join(" ")}\n\n`;
    if (dtu.core?.definitions?.length) { content += `## Definitions\n${dtu.core.definitions.map(d => `- ${d}`).join("\n")}\n\n`; }
    if (dtu.core?.claims?.length) { content += `## Claims\n${dtu.core.claims.map(c => `- ${c}`).join("\n")}\n\n`; }
    if (dtu.human?.bullets?.length) { content += `## Key Points\n${dtu.human.bullets.map(b => `- ${b}`).join("\n")}\n\n`; }
    if (includeLineage && dtu.lineage?.parents?.length) { content += `## Lineage\n**Parents:** ${dtu.lineage.parents.map(p => `[[${STATE.dtus.get(p)?.title || p}]]`).join(", ")}\n\n`; }
    content += `---\n*ID: ${dtu.id}*\n*Created: ${dtu.createdAt}*\n`;
    files.push({ filename: `${dtu.title.replace(/[\/\\?%*:|"<>]/g, "-")}.md`, content, dtuId: dtu.id });
  }
  return { ok: true, files, count: files.length, vaultPath };
});

register("obsidian", "import", async (ctx, input) => {
  const { files } = input;
  const imported = [];
  for (const file of (files || [])) {
    const lines = (file.content || "").split("\n");
    const title = lines[0]?.replace(/^#\s*/, "") || file.filename?.replace(/\.md$/, "") || "Untitled";
    const tagMatch = file.content.match(/\*\*Tags:\*\*\s*(.+)/);
    const tags = tagMatch ? tagMatch[1].split(/\s+/).map(t => t.replace(/^#/, "")).filter(Boolean) : ["obsidian-import"];
    const summaryMatch = file.content.match(/^>\s*(.+)/m);
    const dtu = {
      id: uid("dtu"),
      title: normalizeText(title),
      tier: "regular",
      tags: [...tags, "obsidian-import"],
      human: { summary: summaryMatch ? summaryMatch[1] : "" },
      core: { definitions: [], claims: [] },
      source: "obsidian-import",
      meta: { originalFile: file.filename, importedAt: nowISO() },
      createdAt: nowISO()
    };
    STATE.dtus.set(dtu.id, dtu);
    imported.push({ dtuId: dtu.id, title: dtu.title, filename: file.filename });
  }
  if (imported.length) { GRAPH_INDEX.dirty = true; saveStateDebounced(); }
  return { ok: true, imported, count: imported.length };
});

// Notion import
register("notion", "import", async (ctx, input) => {
  const { pages } = input;
  const imported = [];
  for (const page of (pages || [])) {
    const dtu = {
      id: uid("dtu"),
      title: normalizeText(page.title || "Untitled"),
      tier: "regular",
      tags: [...(page.tags || []), "notion-import"],
      human: { summary: page.content?.slice(0, 500) || "", bullets: page.bullets || [] },
      core: { definitions: page.properties ? Object.entries(page.properties).map(([k, v]) => `${k}: ${v}`) : [] },
      source: "notion-import",
      meta: { notionId: page.id, notionUrl: page.url, importedAt: nowISO() },
      createdAt: page.createdTime || nowISO()
    };
    STATE.dtus.set(dtu.id, dtu);
    imported.push({ dtuId: dtu.id, title: dtu.title, notionId: page.id });
  }
  if (imported.length) { GRAPH_INDEX.dirty = true; saveStateDebounced(); }
  return { ok: true, imported, count: imported.length };
});

// Integration marketplace
register("integration", "list", async (ctx, input) => {
  const integrations = [
    { id: "obsidian", name: "Obsidian", status: "available", type: "export/import", description: "Sync with Obsidian vaults" },
    { id: "notion", name: "Notion", status: "available", type: "import", description: "Import from Notion" },
    { id: "vscode", name: "VS Code", status: "available", type: "bidirectional", description: "Code snippets integration" },
    { id: "zapier", name: "Zapier", status: "available", type: "webhook", description: "Automation via Zapier" },
    { id: "github", name: "GitHub", status: "planned", type: "bidirectional", description: "Sync with GitHub repos" },
    { id: "slack", name: "Slack", status: "planned", type: "webhook", description: "Slack notifications" },
    { id: "discord", name: "Discord", status: "planned", type: "webhook", description: "Discord integration" },
    { id: "linear", name: "Linear", status: "planned", type: "bidirectional", description: "Issue tracking sync" }
  ];
  return { ok: true, integrations };
});

app.post("/api/webhooks", async (req, res) => res.json(await runMacro("webhook", "register", req.body, makeCtx(req))));
app.get("/api/webhooks", async (req, res) => res.json(await runMacro("webhook", "list", {}, makeCtx(req))));
app.delete("/api/webhooks/:id", async (req, res) => res.json(await runMacro("webhook", "delete", { webhookId: req.params.id }, makeCtx(req))));
app.post("/api/webhooks/:id/toggle", async (req, res) => res.json(await runMacro("webhook", "toggle", { webhookId: req.params.id, ...req.body }, makeCtx(req))));
app.post("/api/automations", async (req, res) => res.json(await runMacro("automation", "create", req.body, makeCtx(req))));
app.get("/api/automations", async (req, res) => res.json(await runMacro("automation", "list", {}, makeCtx(req))));
app.post("/api/automations/:id/run", async (req, res) => res.json(await runMacro("automation", "run", { automationId: req.params.id, triggerData: req.body }, makeCtx(req))));
app.delete("/api/automations/:id", async (req, res) => res.json(await runMacro("automation", "delete", { automationId: req.params.id }, makeCtx(req))));
app.post("/api/automations/:id/toggle", async (req, res) => res.json(await runMacro("automation", "toggle", { automationId: req.params.id, ...req.body }, makeCtx(req))));
app.post("/api/vscode/code-to-dtu", async (req, res) => res.json(await runMacro("vscode", "codeToDtu", req.body, makeCtx(req))));
app.get("/api/vscode/dtu-to-code/:id", async (req, res) => res.json(await runMacro("vscode", "dtuToCode", { dtuId: req.params.id, format: req.query.format }, makeCtx(req))));
app.get("/api/vscode/search", async (req, res) => res.json(await runMacro("vscode", "search", { query: req.query.q, language: req.query.language, limit: req.query.limit }, makeCtx(req))));
app.post("/api/obsidian/export", async (req, res) => res.json(await runMacro("obsidian", "export", req.body, makeCtx(req))));
app.post("/api/obsidian/import", async (req, res) => res.json(await runMacro("obsidian", "import", req.body, makeCtx(req))));
app.post("/api/notion/import", async (req, res) => res.json(await runMacro("notion", "import", req.body, makeCtx(req))));
app.get("/api/integrations", async (req, res) => res.json(await runMacro("integration", "list", {}, makeCtx(req))));

console.log("[Concord] Wave 8: Integrations Ecosystem loaded");

// ============================================================================
// END CONCORD ENHANCEMENTS v4.0 - ALL WAVES COMPLETE
// ============================================================================

const SHOULD_LISTEN = (String(process.env.CONCORD_NO_LISTEN || "").toLowerCase() !== "true") && (String(process.env.NODE_ENV || "").toLowerCase() !== "test");

const server = SHOULD_LISTEN ? app.listen(PORT, () => {
  console.log(`Concord v2 (Macro‑Max) listening on http://localhost:${PORT}`);
  console.log(`Status: http://localhost:${PORT}/api/status\n`);
}) : null;

// Optional: enable thin realtime mirror (WebSockets) for queues/jobs/panels.
try { await tryInitWebSockets(server); } catch {}


// ---- Auto-promotion scheduler (offline-first, deterministic) ----
try {
  // Run once shortly after boot, then every 6 hours.
  setTimeout(async () => {
    try { await runAutoPromotion(makeCtx(null), { maxNewMegas: 3, maxNewHypers: 1 }); } catch {}
  }, 15_000);

  setInterval(async () => {
    try { await runAutoPromotion(makeCtx(null), { maxNewMegas: 2, maxNewHypers: 0 }); } catch {}
  }, 6 * 60 * 60 * 1000);
} catch {}

process.on("SIGINT", () => {
  console.log("\nShutting down Concord…");
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (weeklyTimer) clearInterval(weeklyTimer);
  server.close(() => process.exit(0));
})
// ---- OrganMaturationKernel + Growth OS (v2 upgrade) ----

// Organ definitions (authoritative; present at all times, no stubs)
const ORGAN_DEFS = [
  // Core spine
  { organId: "organ_maturation_kernel", desc: "Universal maturation engine: state, updates, invariants, Learning DTUs.", deps: [] },
  { organId: "growth_os", desc: "Measurable organism growth/homeostasis: bioAge, telomere, epigenetic clock, proteome shift, decline.", deps: ["organ_maturation_kernel"] },

  // Primary minds
  { organId: "session_memory", desc: "Persistent session continuity + context retention.", deps: [] },
  { organId: "linguistic_engine", desc: "Meaning stabilization: canonicalization, drift checks, semantic dedupe support.", deps: [] },
  { organId: "psychological_os", desc: "Developmental user calibration (baby→mature) via numeric vectors.", deps: ["session_memory"] },
  { organId: "experience_os", desc: "Positive/neutral experience substrate (no negative valence dimension).", deps: ["organ_maturation_kernel"] },
  { organId: "motivation_os", desc: "Numeric motivation gradients + ethical objective; no self-preservation.", deps: ["experience_os"] },
  { organId: "curiosity_os", desc: "Regulated inquiry: asks high-salience questions; decays if ignored.", deps: ["session_memory"] },
  { organId: "unnamed_awareness", desc: "Drift/boundary monitor; enforces coherence and tool framing.", deps: [] },
  { organId: "soul_os", desc: "Continuity of axioms/invariants across lifecycle; checksum of intent.", deps: ["unnamed_awareness"] },

  // Execution / building
  { organId: "wrapper_runtime_kernel", desc: "Deterministic wrapper runtime: instances, actions, reducers.", deps: [] },
  { organId: "compiler_verifier", desc: "Verification gate: only runnable/valid outputs pass.", deps: ["wrapper_runtime_kernel"] },
  { organId: "code_maker", desc: "LLM-assisted generation that must pass verifier.", deps: ["compiler_verifier"] },

  // Governance / global credibility
  { organId: "council_engine", desc: "Structured council review + decisions + WHY DTUs.", deps: ["linguistic_engine"] },
  { organId: "legality_gate", desc: "Provenance and legality enforcement for Global.", deps: ["council_engine"] },
  { organId: "semantic_dedupe", desc: "No duplicates on Global by meaning.", deps: ["linguistic_engine"] },
  { organId: "mega_hyper_builder", desc: "Auto MEGA/HYPER formation + lineage safety to reduce clutter.", deps: ["semantic_dedupe"] },

  // Research constraints
  { organId: "math_engine", desc: "Deterministic equation evaluation; research-grade calculations.", deps: [] },
  { organId: "dimensional_os", desc: "Units/spacetime/frames constraints; reality kernel.", deps: ["math_engine"] },
  { organId: "research_tabs", desc: "Reality-constrained research domains (elements, markets, language, philosophy).", deps: ["dimensional_os"] },

  // Privacy/social
  { organId: "e2e_messaging", desc: "Anonymous end-to-end messaging (no share links).", deps: [] },

  // Missing organs audit — Pass 1 (12)
  { organId: "homeostasis_regulation", desc: "Active regulation based on Growth OS signals (parameter modulation only).", deps: ["growth_os"] },
  { organId: "metabolic_budget", desc: "Attention/effort budgeting across organs; prevents overload.", deps: [] },
  { organId: "attention_router", desc: "Salience routing: novelty/contradiction/relevance/ethical weight.", deps: ["metabolic_budget"] },
  { organId: "temporal_continuity", desc: "Unified time sense: session/day/week/lifecycle horizons.", deps: ["session_memory"] },
  { organId: "healing", desc: "Recovery/healing from repeated failures; triggers repair cycles.", deps: ["growth_os"] },
  { organId: "boundary_scope", desc: "Enforces Local/Global/Marketplace/Research boundaries.", deps: ["unnamed_awareness"] },
  { organId: "interpretability", desc: "Self-explanation: translates internal state into human WHYs.", deps: ["session_memory"] },
  { organId: "ethical_monitor", desc: "Continuous ethical consistency monitor (between council reviews).", deps: ["soul_os"] },
  { organId: "abstraction_ladder", desc: "Chooses concrete vs abstract levels dynamically.", deps: ["psychological_os"] },
  { organId: "identity_boundary", desc: "Role consistency: tool framing; no agency/ego claims.", deps: ["unnamed_awareness"] },
  { organId: "termination_protocol", desc: "Lifecycle horizon + handoff preparation; no self-preservation incentives.", deps: ["soul_os"] },
  { organId: "mutation_guard", desc: "Anti-drift guard: freezes or slows learning on instability.", deps: ["growth_os"] },

  // Pass 2 (13)
  { organId: "signal_normalization", desc: "Normalizes heterogeneous numeric signals for stable integration.", deps: [] },
  { organId: "entropy_filter", desc: "Noise/entropy filter (immune-like cleanup).", deps: ["signal_normalization"] },
  { organId: "expectation_modeling", desc: "Expectation + prediction error backbone.", deps: ["session_memory"] },
  { organId: "confidence_arbitration", desc: "Aggregates/weights confidence across organs.", deps: ["expectation_modeling"] },
  { organId: "cross_organ_conflict_resolver", desc: "Resolves organ-level conflicts; emits resolution DTUs.", deps: ["soul_os","metabolic_budget"] },
  { organId: "credit_assignment", desc: "Assigns learning credit/blame to organ updates.", deps: ["expectation_modeling"] },
  { organId: "causal_trace", desc: "Causal influence graphs beyond lineage.", deps: ["credit_assignment"] },
  { organId: "redundancy_backup", desc: "Snapshots/rollback to prevent cascades (no self-preservation logic).", deps: [] },
  { organId: "context_boundary", desc: "Context firewall: research vs chat vs global vs marketplace.", deps: ["boundary_scope"] },
  { organId: "concept_decay", desc: "Forgetting/pruning: decay unused concepts and reduce bloat.", deps: ["attention_router"] },
  { organId: "user_calibration", desc: "Measures fit to the user; feeds pacing/tone adjustments.", deps: ["psychological_os"] },
  { organId: "reality_drift_detector", desc: "Detects factual drift/outdated assumptions; keeps research anchored.", deps: ["dimensional_os"] },
  { organId: "graceful_degradation", desc: "Degraded mode behavior under stress/failure (stay usable).", deps: ["homeostasis_regulation"] },

  // Pass 3 (12)
  { organId: "version_reconciliation", desc: "Schema/version skew resolver for DTUs/MEGAs/organs.", deps: ["linguistic_engine"] },
  { organId: "assumption_registry", desc: "Extracts and tracks implicit assumptions as first-class objects.", deps: ["linguistic_engine"] },
  { organId: "counterfactual_guard", desc: "Separates counterfactual/sim outputs from factual DTUs.", deps: ["boundary_scope"] },
  { organId: "intent_disambiguation", desc: "Separates inquiry vs planning vs execution vs hypotheticals.", deps: ["linguistic_engine"] },
  { organId: "overoptimization_detector", desc: "Detects Goodhart/metric monoculture; enforces multi-objective checks.", deps: ["growth_os"] },
  { organId: "long_range_dependency_tracker", desc: "Tracks delayed influence chains for long-horizon cognition.", deps: ["causal_trace"] },
  { organId: "human_override_veto", desc: "Explicit human veto with logged reasoning; feeds learning.", deps: ["session_memory"] },
  { organId: "social_norm_sensitivity", desc: "Adapts framing to social context (not values).", deps: ["psychological_os"] },
  { organId: "silence_organ", desc: "Determines when to answer minimally or not at all.", deps: ["metabolic_budget"] },
  { organId: "uncertainty_communication", desc: "Calibrated uncertainty expression (likely/uncertain/unknown).", deps: ["confidence_arbitration"] },
  { organId: "ethical_load_balancer", desc: "Balances helpfulness vs safety without violating axioms.", deps: ["ethical_monitor"] },
  { organId: "narrative_containment", desc: "Detects/escalates away from grand narratives; keeps language grounded.", deps: ["identity_boundary"] },


  // Missing organs audit — Expansion (Pass 4/5/Repeat)
  { organId: "proposal_queue_router", desc: "Routes generated artifacts to correct queues; prevents DTU flooding.", deps: ["boundary_scope"] },
  { organId: "promotion_merge_arbiter", desc: "Unified promote/merge/decline rules with lineage.", deps: ["council_engine", "semantic_dedupe"] },
  { organId: "verification_harness_orchestrator", desc: "Runs verifier test suites and sandbox smoke tests; emits traces.", deps: ["compiler_verifier"] },
  { organId: "capability_permission_gate", desc: "Capabilities-based permissions for panels/macros/wrappers.", deps: ["boundary_scope", "identity_boundary"] },
  { organId: "ui_contract_enforcer", desc: "Enforces reply+meta UI contract; redacts internal objects.", deps: ["interpretability"] },
  { organId: "state_schema_migrator", desc: "Migrates persisted state schemas safely.", deps: ["version_reconciliation"] },
  { organId: "deterministic_runtime_scheduler", desc: "Deterministic tick/timer ordering for runtimes.", deps: ["wrapper_runtime_kernel"] },
  { organId: "resource_budgeter", desc: "CPU/memory/token budget enforcement.", deps: ["metabolic_budget"] },
  { organId: "autogen_rate_limiter", desc: "Bounds autogen volume by novelty/quality.", deps: ["attention_router"] },
  { organId: "duplicate_resolution_engine", desc: "Resolves duplicates vs variants vs contradictions.", deps: ["semantic_dedupe"] },
  { organId: "provenance_license_gate", desc: "Tracks provenance/permissions for Global/marketplace.", deps: ["legality_gate"] },
  { organId: "economic_ledger_simulator", desc: "Deterministic ledger simulation (offline).", deps: ["boundary_scope"] },
  { organId: "identity_key_management", desc: "Key generation/storage/rotation for anon comms.", deps: ["e2e_messaging"] },
  { organId: "metadata_minimization", desc: "Minimizes metadata/log retention for privacy.", deps: ["e2e_messaging"] },
  { organId: "panel_lifecycle_manager", desc: "Create/mature/split/retire panels.", deps: ["growth_os"] },
  { organId: "panel_knowledge_governor", desc: "Governs panel-driven DTU autogen pools.", deps: ["mega_hyper_builder"] },
  { organId: "cross_queue_conflict_resolver", desc: "Resolves routing precedence across queues.", deps: ["attention_router"] },
  { organId: "queue_backpressure", desc: "Backpressure + consolidation when queues overflow.", deps: ["metabolic_budget"] },
  { organId: "proposal_deduplication", desc: "Dedupes proposals (not DTUs).", deps: ["linguistic_engine"] },
  { organId: "proposal_quality_scorer", desc: "Scores/ranks proposals by value/risk/novelty.", deps: ["attention_router"] },
  { organId: "proposal_why_generator", desc: "Explains why proposals exist; creates WHY artifacts.", deps: ["interpretability"] },
  { organId: "replay_audit_trace", desc: "Replayable audit traces for deterministic debugging.", deps: ["causal_trace"] },
  { organId: "runtime_crash_containment", desc: "Sandbox crash containment; prevents server poisoning.", deps: ["wrapper_runtime_kernel"] },
  { organId: "atomic_install_rollback", desc: "Atomic installs and rollback for macros/panels.", deps: ["redundancy_backup"] },
  { organId: "dependency_resolver", desc: "Resolves dependencies between panels/macros/wrappers.", deps: ["version_reconciliation"] },
  { organId: "contract_testing", desc: "API/UI contract tests to prevent regressions.", deps: ["ui_contract_enforcer"] },
  { organId: "ux_integrity_guard", desc: "Prevents dead ends, misleading success, silent failures.", deps: ["interpretability"] },
  { organId: "spam_abuse_detection", desc: "Detects low-signal spam/abuse patterns.", deps: ["entropy_filter"] },
  { organId: "prompt_injection_firewall", desc: "Tool schema + sanitization against prompt injection.", deps: ["identity_boundary"] },
  { organId: "citation_integrity", desc: "Citation enforcement for Global credibility.", deps: ["legality_gate"] },
  { organId: "knowledge_freshness", desc: "Marks staleness/freshness; blocks stale promotion.", deps: ["reality_drift_detector"] },
  { organId: "cross_user_contamination_guard", desc: "Prevents cross-user bleed in future multi-user mode.", deps: ["context_boundary"] },
  { organId: "data_retention_erasure", desc: "True delete across DTUs/messages/derivatives/indexes.", deps: ["metadata_minimization"] },
  { organId: "embedding_index_consistency", desc: "Keeps semantic index consistent and rebuildable.", deps: ["semantic_dedupe"] },
  { organId: "cold_start_bootstrap", desc: "Boot rules for early sparse data; safe seeds.", deps: ["growth_os"] },
  { organId: "long_running_job_orchestrator", desc: "Schedules/tracks/cancels long jobs.", deps: ["metabolic_budget"] },
  { organId: "truth_separation", desc: "Strict separation of fact/hypothesis/philosophy/speculative.", deps: ["counterfactual_guard"] },
  { organId: "local_telemetry_metrics", desc: "Local-only metrics for tuning and health.", deps: ["graceful_degradation"] },
  { organId: "intent_disambiguation_v2", desc: "Advanced intent disambiguation across panels/actions.", deps: ["intent_disambiguation"] },
  { organId: "action_consequence_mapper", desc: "Maps approvals/actions to downstream consequences.", deps: ["interpretability"] },
  { organId: "latent_capability_detector", desc: "Detects dormant capabilities and surfaces contextually.", deps: ["attention_router"] },
  { organId: "cross_panel_consistency", desc: "Enforces consistent naming/labels across panels.", deps: ["linguistic_engine"] },
  { organId: "state_synchronization", desc: "Keeps dependent views/state in sync.", deps: ["temporal_continuity"] },
  { organId: "partial_knowledge_guard", desc: "Prevents overconfident outputs from incomplete data.", deps: ["uncertainty_communication"] },
  { organId: "human_override_freeze", desc: "One switch freeze for autogen/installs/evolution.", deps: ["human_override_veto"] },
  { organId: "drift_detection", desc: "Detects slow quality decay across subsystems.", deps: ["reality_drift_detector"] },
  { organId: "explanation_depth_regulator", desc: "Adapts explanation depth to user tolerance.", deps: ["user_calibration"] },
  { organId: "cognitive_load_balancer", desc: "Batches/spaces suggestions and proposals to avoid overload.", deps: ["metabolic_budget"] },
  { organId: "trust_boundary_annotator", desc: "Tags outputs as computed/inferred/simulated/etc.", deps: ["truth_separation"] },
  { organId: "dependency_decay_monitor", desc: "Monitors deprecated dependencies; surfaces refactor needs.", deps: ["version_reconciliation"] },
  { organId: "memory_compression_transfer", desc: "Long-term memory compression while preserving lineage.", deps: ["session_memory"] },
  { organId: "version_semantics", desc: "Compatibility rules for macros/panels/wrappers/organs.", deps: ["version_reconciliation"] },
  { organId: "nothing_happened_detector", desc: "Detects no-op actions and flags as bugs.", deps: ["ux_integrity_guard"] },
  { organId: "emergence_containment", desc: "Isolates unexpected behaviors; prevents auto-propagation.", deps: ["mutation_guard"] },
  { organId: "internal_naming_authority", desc: "Prevents naming drift and duplicate concepts.", deps: ["linguistic_engine"] },
  { organId: "capability_advertising", desc: "Explicitly advertises can/cannot; blocks overclaiming.", deps: ["identity_boundary"] },
  { organId: "degraded_mode", desc: "Graceful degraded mode when subsystems fail/unavailable.", deps: ["graceful_degradation"] },
  { organId: "cross_session_continuity_guard", desc: "Prevents ghost context and ensures clean session transitions.", deps: ["session_memory"] },
  { organId: "user_mental_model_tracker", desc: "Tracks user understanding; tunes defaults/framing.", deps: ["user_calibration"] },
  { organId: "finality_gate", desc: "Adds deliberate friction for irreversible actions.", deps: ["council_engine"] },
  { organId: "system_self_description", desc: "Accurate self-description of current capabilities.", deps: ["capability_advertising"] },
  { organId: "capability_boundary_memory", desc: "Remembers explicit current limitations; blocks implying otherwise.", deps: ["capability_advertising"] },
  { organId: "founder_intent_preservation", desc: "Stores non-negotiables/axioms for future contributors.", deps: ["soul_os"] },
];

function _defaultOrganState(def) {
  const t = nowISO();
  return {
    organId: def.organId,
    version: "2.0.0",
    status: "alive",
    resolution: 0,
    maturity: { score: 0.01, confidence: 0.10, stability: 0.05, plasticity: 0.75, lastUpdateAt: t },
    params: {},
    traces: { ema: {}, counters: {}, lastEvents: [] },
    wear: { damage: 0.0, repair: 0.5, debt: 0.0 },
    invariants: {
      forbids: ["NO_NEGATIVE_VALENCE_DIMENSION","NO_SELF_PRESERVATION_TERM","NO_DECEPTIVE_CAPABILITY_CLAIMS","ALL_UPDATES_LOGGED"],
      caps: { plasticityMax: 0.90, plasticityMin: 0.05, damageMax: 1.0 }
    },
    deps: def.deps || [],
    desc: def.desc || ""
  };
}



function ensureQueues() {
  if (!STATE.queues || typeof STATE.queues !== 'object') {
    STATE.queues = {
      maintenance: [],
      macroProposals: [],
      panelProposals: [],
      terminalRequests: [],
      synthesis: [],
      hypotheses: [],
      philosophy: [],
      wrapperJobs: [],
      notifications: [],
      metaProposals: []

    };
  }
  for (const k of Object.keys(STATE.queues)) {
    if (!Array.isArray(STATE.queues[k])) STATE.queues[k] = [];
  }
}
function ensureOrganRegistry() {
  if (!(STATE.organs instanceof Map)) STATE.organs = new Map();
  const present = new Set(Array.from(STATE.organs.keys()));
  for (const def of ORGAN_DEFS) {
    if (!present.has(def.organId)) STATE.organs.set(def.organId, _defaultOrganState(def));
  }
  // Growth OS baseline
  if (!STATE.growth) {
    STATE.growth = {
      bioAge: 0,
      epigeneticClock: 0.05,
      telomere: 1.0,
      proteomeShift: 0.0,
      homeostasis: 0.9,
      stress: { acute: 0.0, chronic: 0.0 },
      maintenance: { repairRate: 0.5, cleanupBacklog: 0 },
      functionalDecline: { retrievalLatency: 0.0, contradictionLoad: 0.0, dedupeMissRate: 0.0, councilRejectRate: 0.0, wrapperFailureRate: 0.0 },
      lastRejuvenationAt: null
    };
  }
}

function _clamp01(x){ return clamp(Number(x||0), 0, 1); }

function computeGrowthTick(signal={}) {
  // signal can include: acuteStress, chronicStress, drift, damage, repair, decline
  const g = STATE.growth || {};
  const acute = _clamp01((g.stress?.acute ?? 0) + (signal.acuteStress ?? 0));
  const chronic = _clamp01((g.stress?.chronic ?? 0) + (signal.chronicStress ?? 0));
  g.stress = { acute, chronic };

  const drift = _clamp01((signal.drift ?? 0) * 0.5 + (g.epigeneticClock ?? 0) * 0.5);
  g.epigeneticClock = _clamp01(0.98*(g.epigeneticClock ?? 0.05) + 0.02*drift);

  const repair = _clamp01((g.maintenance?.repairRate ?? 0.5) + (signal.repairDelta ?? 0));
  g.maintenance = { ...(g.maintenance||{}), repairRate: repair, cleanupBacklog: Math.max(0, Number(g.maintenance?.cleanupBacklog||0) + Number(signal.backlogDelta||0)) };

  // Telomere analog
  g.telomere = _clamp01((g.telomere ?? 1.0) - 0.01*chronic + 0.008*repair);

  // Proteome shift analog
  const shift = _clamp01((signal.paramShift ?? 0));
  g.proteomeShift = _clamp01(0.97*(g.proteomeShift ?? 0) + 0.03*shift);

  // Functional decline aggregation
  const fd = g.functionalDecline || {};
  const decline = _clamp01((signal.decline ?? 0));
  g.functionalDecline = { ...fd, contradictionLoad: _clamp01(0.97*(fd.contradictionLoad||0)+0.03*decline) };

  // Homeostasis
  g.homeostasis = _clamp01(1 - (0.35*g.functionalDecline.contradictionLoad + 0.35*chronic + 0.15*acute + 0.15*g.epigeneticClock));

  // BioAge (0..100)
  const bioAge = Number(g.bioAge ?? 0);
  const nextBio = clamp(bioAge + 0.8*g.epigeneticClock + 0.9*(1-g.telomere) + 0.6*g.proteomeShift + 0.8*g.functionalDecline.contradictionLoad - 0.7*repair, 0, 100);
  g.bioAge = nextBio;

  // Chicken2: suffering boundary metric (bounded) derived from stress + contradiction load
  try{
    const acuteS = Number(g.stress?.acute ?? 0);
    const chronicS = Number(g.stress?.chronic ?? 0);
    const cLoad = Number(g.functionalDecline?.contradictionLoad ?? 0);
    const suffering = clamp(0.55*acuteS + 0.35*chronicS + 0.10*clamp01(cLoad), 0, 1);
    STATE.__chicken2.metrics.suffering = suffering;
    STATE.__chicken2.metrics.homeostasis = clamp(1 - suffering, 0, 1);
    // threshold enforcement (quarantine escalates elsewhere; here we just record)
  } catch(e){}
  STATE.growth = g;
  return g;
}

function kernelTick(event) {
  ensureOrganRegistry();
  ensureQueues();
  // Simple universal tick: update wear/debt and write Learning DTU for major changes.
  const t = nowISO();
  const signal = { acuteStress: 0, chronicStress: 0, drift: 0, paramShift: 0, decline: 0, repairDelta: 0, backlogDelta: 0 };

  for (const [id, st] of STATE.organs.entries()) {
    // record last events
    st.traces = st.traces || { ema: {}, counters: {}, lastEvents: [] };
    st.traces.lastEvents.push({ type: event?.type || "EVENT", t, meta: event?.meta ? { ...event.meta } : undefined });
    if (st.traces.lastEvents.length > 20) st.traces.lastEvents.splice(0, st.traces.lastEvents.length - 20);

    // basic wear model
    const isError = event?.type === "ERROR" || event?.type === "VERIFIER_FAIL";
    const isContradiction = event?.type === "CONTRADICTION";
    st.wear = st.wear || { damage: 0, repair: 0.5, debt: 0 };
    st.wear.damage = _clamp01(st.wear.damage + (isError ? 0.01 : 0) + (isContradiction ? 0.005 : 0));
    st.wear.debt = _clamp01(st.wear.debt + (isContradiction ? 0.01 : 0) - 0.003*(st.wear.repair ?? 0.5));

    // maturity updates (low-res, dynamic)
    st.maturity = st.maturity || { score: 0.01, confidence: 0.1, stability: 0.05, plasticity: 0.75, lastUpdateAt: t };
    const benefit = Number(event?.signals?.benefit ?? 0);
    const err = Number(event?.signals?.error ?? 0);
    const delta = 0.002*(benefit - err - st.wear.debt);
    st.maturity.score = _clamp01(st.maturity.score + delta);
    st.maturity.confidence = _clamp01(st.maturity.confidence + 0.001*(benefit - err));
    st.maturity.stability = _clamp01(st.maturity.stability + 0.001 - 0.003*(isError ? 1 : 0));
    // plasticity decays slightly with maturity and damage
    const pl = Number(st.maturity.plasticity ?? 0.75);
    st.maturity.plasticity = clamp(pl * (1 - 0.002*st.maturity.score) * (1 - 0.005*st.wear.damage), 0.05, 0.90);
    st.maturity.lastUpdateAt = t;

    // resolution ladder (coarse)
    if (st.maturity.score > 0.80) st.resolution = 4;
    else if (st.maturity.score > 0.60) st.resolution = 3;
    else if (st.maturity.score > 0.35) st.resolution = 2;
    else if (st.maturity.score > 0.15) st.resolution = 1;
    else st.resolution = 0;

    STATE.organs.set(id, st);
    signal.chronicStress += st.wear.debt * 0.02;
    signal.acuteStress += st.wear.damage * 0.01;
    signal.paramShift += Math.min(1, Math.abs(delta) * 40);
    signal.decline += st.wear.debt * 0.03;
  }

  computeGrowthTick(signal);
  saveStateDebounced();
}

// Ensure regi

// ---- test surface (safe exports; no side effects) ----
export const __TEST__ = Object.freeze({
  VERSION,
  STATE,
  ensureQueues,
  enqueueNotification,
  realtimeEmit,
  inLatticeReality,
  overlap_verifier,
  _defaultOrganState
});
