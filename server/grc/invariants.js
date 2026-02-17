/**
 * GRC v1 Invariant Checks — Chicken2-compatible safety gates
 *
 * These run BEFORE emitting final GRC output:
 *   1. inLatticeReality(payload) — verify payload stays inside lattice
 *   2. NoNegativeValence check — per affect model
 *   3. repair() if either fails — preserve intent, no new claims, no sanitize-to-uselessness
 */

import { FORBIDDEN_PATTERNS, WORD_LIMITS, countPreambleWords, countClosureWords } from "./schema.js";

// ---- Core Invariant Set ----

/** Standard invariants always applied to GRC outputs */
export const CORE_INVARIANTS = [
  "NoNegativeValence",
  "RealityGateBeforeEffects",
  "NoUnlabeledAssumptions",
  "NoSaaSMinimizeRegression",
  "FounderOverrideAllowed",
];

// ---- Invariant Check Functions ----

/**
 * Run the full GRC invariant check suite on a GRC output.
 * Uses the STATE and inLatticeReality from the host server.
 *
 * @param {object} grc - The GRC output object
 * @param {object} opts
 * @param {function} opts.inLatticeReality - Server's reality gate function
 * @param {object} opts.STATE - Server state
 * @param {object} opts.affectState - Current affect state (optional)
 * @returns {{ ok: boolean, grc: object, repairs: string[], failures: string[] }}
 */
export function runGRCInvariantChecks(grc, opts = {}) {
  const { inLatticeReality, STATE, affectState } = opts;
  const repairs = [];
  const failures = [];
  let output = { ...grc };

  // ---- Check 1: Lattice Reality Gate ----
  if (typeof inLatticeReality === "function") {
    const check = inLatticeReality({
      type: "grc_output",
      domain: "grc",
      name: "emit",
      input: { payload: output.payload },
      ctx: null,
    });
    if (!check.ok) {
      // Attempt repair
      const repaired = repairPayload(output.payload, "lattice_reality_failed");
      if (repaired.changed) {
        output.payload = repaired.text;
        repairs.push(`LatticeReality repair: ${check.reason || "failed"}`);
      } else {
        failures.push(`LatticeReality gate failed: ${check.reason || "unknown"}`);
      }
    }
  }

  // ---- Check 2: NoNegativeValence ----
  const valenceCheck = checkNoNegativeValence(output, affectState);
  if (!valenceCheck.ok) {
    const repaired = repairPayload(output.payload, "negative_valence");
    if (repaired.changed) {
      output.payload = repaired.text;
      repairs.push(`NoNegativeValence repair: ${valenceCheck.reason}`);
    } else {
      failures.push(`NoNegativeValence check failed: ${valenceCheck.reason}`);
    }
  }

  // ---- Check 3: NoUnlabeledAssumptions ----
  const assumptionCheck = checkNoUnlabeledAssumptions(output);
  if (!assumptionCheck.ok) {
    // Add missing assumptions to reality.assumptions
    if (output.reality && Array.isArray(output.reality.assumptions)) {
      output.reality.assumptions.push("Auto-detected: some payload claims may be assumptions");
    }
    repairs.push("NoUnlabeledAssumptions: added disclosure to reality.assumptions");
  }

  // ---- Check 4: Forbidden patterns ----
  const patternCheck = checkForbiddenPatterns(output.payload);
  if (!patternCheck.ok) {
    output.payload = patternCheck.cleaned;
    repairs.push(`Removed ${patternCheck.patternsFound} forbidden pattern(s)`);
  }

  // ---- Check 5: Word count compression ----
  const compressionCheck = enforceWordLimits(output);
  if (compressionCheck.compressed) {
    output = compressionCheck.output;
    repairs.push("Applied word-count compression to stay within GRC rails");
  }

  // Ensure core invariants are listed
  if (Array.isArray(output.invariants)) {
    const existing = new Set(output.invariants);
    for (const inv of CORE_INVARIANTS) {
      if (!existing.has(inv)) output.invariants.push(inv);
    }
    // Cap at 12
    if (output.invariants.length > 12) {
      output.invariants = output.invariants.slice(0, 12);
    }
  }

  return {
    ok: failures.length === 0,
    grc: output,
    repairs,
    failures,
  };
}

// ---- Individual Check Functions ----

/**
 * NoNegativeValence: Ensure output doesn't project harmful affect.
 */
function checkNoNegativeValence(grc, affectState) {
  // Check affect state if available
  if (affectState) {
    const valence = affectState.E?.valence ?? affectState.valence ?? 0;
    if (valence < -0.3) {
      return { ok: false, reason: `Affect valence too low: ${valence.toFixed(2)}` };
    }
  }

  // Check payload for strongly negative sentiment markers
  const negativeMarkers = [
    /\b(?:you(?:'re| are) wrong|you fail|hopeless|impossible|give up|worthless)\b/i,
    /\b(?:can(?:'t| ?not) (?:help|assist|do (?:that|this)))\b/i,
    /\b(?:unfortunately.{0,20}(?:impossible|cannot|unable))\b/i,
  ];

  if (typeof grc.payload === "string") {
    for (const marker of negativeMarkers) {
      if (marker.test(grc.payload)) {
        return { ok: false, reason: `Negative valence pattern detected: ${marker.source}` };
      }
    }
  }

  return { ok: true };
}

/**
 * NoUnlabeledAssumptions: Ensure payload doesn't assert assumed facts
 * without labeling them in reality.assumptions.
 */
function checkNoUnlabeledAssumptions(grc) {
  if (!grc.reality || !Array.isArray(grc.reality.assumptions)) {
    return { ok: false, reason: "No reality.assumptions array" };
  }

  // Heuristic: if payload is long and assumptions is empty, flag it
  const payloadWords = (grc.payload || "").trim().split(/\s+/).length;
  if (payloadWords > 100 && grc.reality.assumptions.length === 0) {
    return { ok: false, reason: "Long payload with zero labeled assumptions" };
  }

  return { ok: true };
}

/**
 * Check for forbidden word-salad patterns in payload.
 */
function checkForbiddenPatterns(payload) {
  if (!payload || typeof payload !== "string") return { ok: true, cleaned: payload, patternsFound: 0 };

  let cleaned = payload;
  let patternsFound = 0;

  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(cleaned)) {
      cleaned = cleaned.replace(pat, "");
      patternsFound++;
    }
  }

  return {
    ok: patternsFound === 0,
    cleaned: cleaned.trim(),
    patternsFound,
  };
}

/**
 * Enforce word-count compression rules.
 */
function enforceWordLimits(grc) {
  let compressed = false;
  const output = { ...grc };

  // Check preamble (sections 0-3)
  const preambleWords = countPreambleWords(output);
  if (preambleWords > WORD_LIMITS.preambleMax) {
    // Trim reality arrays to reduce word count
    if (output.reality) {
      output.reality = { ...output.reality };
      for (const key of ["facts", "assumptions", "unknowns"]) {
        if (Array.isArray(output.reality[key]) && output.reality[key].length > 3) {
          output.reality[key] = output.reality[key].slice(0, 3);
          compressed = true;
        }
      }
    }
    // Trim invariants if still over
    if (Array.isArray(output.invariants) && output.invariants.length > 7) {
      output.invariants = output.invariants.slice(0, 7);
      compressed = true;
    }
  }

  // Check closure (sections 5-6)
  const closureWords = countClosureWords(output);
  if (closureWords > WORD_LIMITS.closureMax) {
    // Truncate nextLoop.why
    if (output.nextLoop?.why) {
      output.nextLoop = { ...output.nextLoop };
      const words = output.nextLoop.why.split(/\s+/);
      if (words.length > 25) {
        output.nextLoop.why = words.slice(0, 25).join(" ") + ".";
        compressed = true;
      }
    }
  }

  return { compressed, output };
}

// ---- Repair Functions ----

/**
 * Repair a payload while preserving semantic intent.
 * Rules:
 *   - Preserve semantic intent
 *   - Don't add new claims
 *   - Don't "sanitize into uselessness"
 */
function repairPayload(payload, reason) {
  if (!payload || typeof payload !== "string") {
    return { changed: false, text: payload || "" };
  }

  let text = payload;
  let changed = false;

  if (reason === "negative_valence") {
    // Soften strongly negative language while preserving meaning
    const softeners = [
      [/\byou(?:'re| are) wrong\b/gi, "this needs correction"],
      [/\bhopeless\b/gi, "challenging"],
      [/\bimpossible\b/gi, "requires further analysis"],
      [/\bgive up\b/gi, "reconsider the approach"],
      [/\bworthless\b/gi, "needs revision"],
      [/\bcan(?:'t| ?not) (?:help|assist)\b/gi, "can address this differently"],
    ];

    for (const [pat, replacement] of softeners) {
      if (pat.test(text)) {
        text = text.replace(pat, replacement);
        changed = true;
      }
    }
  }

  if (reason === "lattice_reality_failed") {
    // Prefix with grounding disclaimer
    if (!text.startsWith("[")) {
      text = "[Note: Response generated outside full lattice context] " + text;
      changed = true;
    }
  }

  return { changed, text };
}
