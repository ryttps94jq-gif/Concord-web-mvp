/**
 * GRC v1 Schema — Grounded Recursive Closure output spec
 *
 * Defines the canonical JSON schema for Concord's post-LLM output shape.
 * Enforces structure, word-count rails, and forbidden patterns.
 *
 * Every LLM response exits through this shape — no exceptions.
 */

// ---- JSON Schema (for external consumers / OpenAPI docs) ----

export const GRC_JSON_SCHEMA = {
  type: "object",
  required: ["toneLock", "anchor", "invariants", "reality", "payload", "nextLoop", "question"],
  properties: {
    toneLock: { type: "string", maxLength: 60 },
    anchor: {
      type: "object",
      properties: {
        dtus: { type: "array", items: { type: "string" } },
        macros: { type: "array", items: { type: "string" } },
        stateRefs: { type: "array", items: { type: "string" } },
        mode: { type: "string" }
      },
      additionalProperties: true
    },
    invariants: { type: "array", items: { type: "string" }, maxItems: 12 },
    reality: {
      type: "object",
      required: ["facts", "assumptions", "unknowns"],
      properties: {
        facts: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } },
        unknowns: { type: "array", items: { type: "string" } }
      }
    },
    payload: { type: "string" },
    nextLoop: {
      type: "object",
      required: ["name", "why"],
      properties: {
        name: { type: "string", maxLength: 80 },
        why: { type: "string", maxLength: 180 }
      }
    },
    question: { type: "string", maxLength: 220 }
  }
};

// ---- Validation Constants ----

/** Valid tone lock openers (max 6 words) */
export const TONE_LOCK_OPENERS = [
  "Acknowledged.", "Confirmed.", "Aligned.", "Proceeding.",
  "Locked.", "Anchored.", "Received.", "Grounded."
];

/** Forbidden output patterns (word salad detection) */
export const FORBIDDEN_PATTERNS = [
  /\bI(?:'m| am) (?:just |only )?an? (?:AI|language model|LLM)\b/i,
  /\bAs an AI\b/i,
  /\bI don['']t have (?:the ability|access|capability)\b/i,
  /\blet me (?:re-?explain|clarify|break (?:it |this )?down)\b/i,
  /\bto (?:summarize|sum up|recap)\s*[,:]/i,
  /\bgreat question\b/i,
  /\bthat['']s a (?:great|good|interesting|excellent) (?:point|question|observation)\b/i,
  /\bhere['']s (?:what|how) (?:I think|I would|we could)\b/i,
];

/** Word count limits per GRC spec */
export const WORD_LIMITS = {
  /** Sections 0-3 combined: toneLock + anchor + invariants + reality */
  preambleMax: 120,
  /** Sections 5-6 combined: nextLoop + question */
  closureMax: 50,
  /** Tone lock max words */
  toneLockMax: 6,
  /** Invariants count range */
  invariantsMin: 0,
  invariantsMax: 12,
};

// ---- Structural Validator ----

/**
 * Validate a GRC output object against the spec.
 * Returns { valid, errors[], warnings[] }.
 */
export function validateGRC(output) {
  const errors = [];
  const warnings = [];

  if (!output || typeof output !== "object") {
    return { valid: false, errors: ["Output must be an object"], warnings };
  }

  // Required fields
  const required = ["toneLock", "anchor", "invariants", "reality", "payload", "nextLoop", "question"];
  for (const field of required) {
    if (!(field in output)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  if (errors.length > 0) return { valid: false, errors, warnings };

  // Section 0: Tone Lock
  if (typeof output.toneLock !== "string") {
    errors.push("toneLock must be a string");
  } else {
    if (output.toneLock.length > 60) {
      errors.push(`toneLock exceeds 60 chars (got ${output.toneLock.length})`);
    }
    const wordCount = output.toneLock.trim().split(/\s+/).length;
    if (wordCount > WORD_LIMITS.toneLockMax) {
      errors.push(`toneLock exceeds ${WORD_LIMITS.toneLockMax} words (got ${wordCount})`);
    }
  }

  // Section 1: Anchor
  if (!output.anchor || typeof output.anchor !== "object") {
    errors.push("anchor must be an object");
  } else {
    const hasAnchors =
      (Array.isArray(output.anchor.dtus) && output.anchor.dtus.length > 0) ||
      (Array.isArray(output.anchor.macros) && output.anchor.macros.length > 0) ||
      (Array.isArray(output.anchor.stateRefs) && output.anchor.stateRefs.length > 0) ||
      (typeof output.anchor.mode === "string" && output.anchor.mode.length > 0);
    if (!hasAnchors) {
      errors.push("anchor must include at least 1 anchor (dtus, macros, stateRefs, or mode)");
    }
  }

  // Section 2: Invariants
  if (!Array.isArray(output.invariants)) {
    errors.push("invariants must be an array");
  } else {
    if (output.invariants.length > WORD_LIMITS.invariantsMax) {
      errors.push(`invariants exceeds max ${WORD_LIMITS.invariantsMax} items (got ${output.invariants.length})`);
    }
    for (const inv of output.invariants) {
      if (typeof inv !== "string") {
        errors.push("Each invariant must be a string");
        break;
      }
    }
  }

  // Section 3: Reality
  if (!output.reality || typeof output.reality !== "object") {
    errors.push("reality must be an object");
  } else {
    for (const key of ["facts", "assumptions", "unknowns"]) {
      if (!Array.isArray(output.reality[key])) {
        errors.push(`reality.${key} must be an array`);
      }
    }
  }

  // Section 4: Payload
  if (typeof output.payload !== "string") {
    errors.push("payload must be a string");
  }

  // Section 5: Next Loop
  if (!output.nextLoop || typeof output.nextLoop !== "object") {
    errors.push("nextLoop must be an object");
  } else {
    if (typeof output.nextLoop.name !== "string" || !output.nextLoop.name) {
      errors.push("nextLoop.name is required");
    } else if (output.nextLoop.name.length > 80) {
      errors.push(`nextLoop.name exceeds 80 chars (got ${output.nextLoop.name.length})`);
    }
    if (typeof output.nextLoop.why !== "string" || !output.nextLoop.why) {
      errors.push("nextLoop.why is required");
    } else if (output.nextLoop.why.length > 180) {
      errors.push(`nextLoop.why exceeds 180 chars (got ${output.nextLoop.why.length})`);
    }
  }

  // Section 6: Question
  if (typeof output.question !== "string") {
    errors.push("question must be a string");
  } else {
    if (output.question.length > 220) {
      errors.push(`question exceeds 220 chars (got ${output.question.length})`);
    }
    if (!output.question.includes("?")) {
      warnings.push("question should end with '?'");
    }
  }

  // Word count rails
  const preambleWords = countPreambleWords(output);
  if (preambleWords > WORD_LIMITS.preambleMax) {
    warnings.push(`Sections 0-3 exceed ${WORD_LIMITS.preambleMax} words (got ${preambleWords})`);
  }

  const closureWords = countClosureWords(output);
  if (closureWords > WORD_LIMITS.closureMax) {
    warnings.push(`Sections 5-6 exceed ${WORD_LIMITS.closureMax} words (got ${closureWords})`);
  }

  // Forbidden patterns in payload
  if (typeof output.payload === "string") {
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(output.payload)) {
        warnings.push(`Payload contains forbidden pattern: ${pat.source}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ---- Word count helpers ----

function wordCount(text) {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function arrayWordCount(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((sum, s) => sum + wordCount(String(s)), 0);
}

export function countPreambleWords(output) {
  let count = 0;
  count += wordCount(output.toneLock);
  // Anchor
  if (output.anchor) {
    count += arrayWordCount(output.anchor.dtus);
    count += arrayWordCount(output.anchor.macros);
    count += arrayWordCount(output.anchor.stateRefs);
    count += wordCount(output.anchor.mode);
  }
  // Invariants
  count += arrayWordCount(output.invariants);
  // Reality
  if (output.reality) {
    count += arrayWordCount(output.reality.facts);
    count += arrayWordCount(output.reality.assumptions);
    count += arrayWordCount(output.reality.unknowns);
  }
  return count;
}

export function countClosureWords(output) {
  let count = 0;
  if (output.nextLoop) {
    count += wordCount(output.nextLoop.name);
    count += wordCount(output.nextLoop.why);
  }
  count += wordCount(output.question);
  return count;
}
