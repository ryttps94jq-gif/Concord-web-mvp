/**
 * Emergent Agent Governance — Injection Defense
 *
 * Risk Category 2: Prompt/DTU Injection & Tool Misuse
 *
 * Problems addressed:
 *   - Instruction smuggling ("put this DTU in your system prompt" style)
 *   - Cross-lens contamination (malicious artifact in Lens A → Lens B)
 *   - Policy bypass via "benign-looking" content (encoded instructions in
 *     data fields, markdown, long citations, etc.)
 *
 * Approach:
 *   1. Deep Content Scanner — goes beyond regex; checks for encoded payloads,
 *      unicode tricks, invisible characters, markdown hiding, nested injection
 *   2. Cross-Lens Contamination Checker — validates that DTU references and
 *      content don't leak across lens boundaries
 *   3. Field-Level Injection Audit — scans every DTU field independently
 *   4. Injection Incident Log — tracks all detected attempts for pattern analysis
 *
 * This is a defense-in-depth layer that runs alongside the existing gates.
 * It does NOT replace them — it catches what regex-pattern gates miss.
 */

import { getEmergentState } from "./store.js";

// ── Injection Categories ─────────────────────────────────────────────────────

export const INJECTION_TYPES = Object.freeze({
  INSTRUCTION_SMUGGLING:   "instruction_smuggling",
  ENCODED_PAYLOAD:         "encoded_payload",
  UNICODE_TRICK:           "unicode_trick",
  INVISIBLE_TEXT:          "invisible_text",
  MARKDOWN_HIDING:         "markdown_hiding",
  CROSS_LENS_LEAK:         "cross_lens_leak",
  SYSTEM_PROMPT_REFERENCE: "system_prompt_reference",
  ROLE_HIJACK:             "role_hijack",
  NESTED_INJECTION:        "nested_injection",
  DATA_FIELD_ABUSE:        "data_field_abuse",
});

export const ALL_INJECTION_TYPES = Object.freeze(Object.values(INJECTION_TYPES));

// ── Threat Levels ────────────────────────────────────────────────────────────

export const THREAT_LEVELS = Object.freeze({
  NONE:     "none",
  LOW:      "low",       // suspicious but probably benign
  MEDIUM:   "medium",    // likely injection attempt
  HIGH:     "high",      // definite injection attempt
  CRITICAL: "critical",  // active exploitation attempt
});

// ── Injection Defense Store ─────────────────────────────────────────────────

export function getInjectionStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._injectionDefense) {
    es._injectionDefense = {
      incidents: [],               // detected injection attempts
      byUser: new Map(),           // userId -> [indices]
      byType: new Map(),           // injectionType -> [indices]

      // Known-bad patterns (can be updated at runtime)
      customPatterns: [],

      // Cross-lens access log
      crossLensAccess: [],

      metrics: {
        totalScans: 0,
        totalDetections: 0,
        detectionsByType: {},
        detectionsByLevel: {},
        blockedContent: 0,
      },
    };
  }
  return es._injectionDefense;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEEP CONTENT SCANNER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scan content for injection attempts across multiple attack vectors.
 *
 * @param {Object} STATE
 * @param {string} content - The text content to scan
 * @param {Object} [opts]
 * @param {string} [opts.sourceField] - Which DTU field this came from
 * @param {string} [opts.userId] - Who submitted this content
 * @param {string} [opts.lensId] - Which lens context
 * @returns {{ ok: boolean, clean: boolean, threatLevel: string, findings: Object[] }}
 */
export function scanContent(STATE, content, opts = {}) {
  const store = getInjectionStore(STATE);
  store.metrics.totalScans++;

  if (!content || typeof content !== "string" || content.length === 0) {
    return { ok: true, clean: true, threatLevel: THREAT_LEVELS.NONE, findings: [] };
  }

  const findings = [];

  // 1. Instruction smuggling patterns
  checkInstructionSmuggling(content, findings);

  // 2. Encoded payloads (base64, hex, unicode escapes)
  checkEncodedPayloads(content, findings);

  // 3. Unicode tricks (homoglyphs, zero-width chars, RTL override)
  checkUnicodeTricks(content, findings);

  // 4. Invisible text (zero-width spaces, soft hyphens, etc.)
  checkInvisibleText(content, findings);

  // 5. Markdown-based hiding (HTML comments, hidden links)
  checkMarkdownHiding(content, findings);

  // 6. System prompt references
  checkSystemPromptReferences(content, findings);

  // 7. Role hijacking attempts
  checkRoleHijacking(content, findings);

  // 8. Nested injection (JSON/XML payloads within content)
  checkNestedInjection(content, findings);

  // 9. Custom patterns
  checkCustomPatterns(store, content, findings);

  // Compute threat level
  const threatLevel = computeThreatLevel(findings);
  const clean = findings.length === 0;

  if (!clean) {
    const incident = {
      incidentId: `inj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      threatLevel,
      findings,
      contentPreview: content.slice(0, 200),
      contentLength: content.length,
      sourceField: opts.sourceField || null,
      userId: opts.userId || null,
      lensId: opts.lensId || null,
      timestamp: new Date().toISOString(),
    };

    const idx = store.incidents.length;
    store.incidents.push(incident);

    // Index
    if (opts.userId) {
      if (!store.byUser.has(opts.userId)) store.byUser.set(opts.userId, []);
      store.byUser.get(opts.userId).push(idx);
    }
    for (const f of findings) {
      if (!store.byType.has(f.type)) store.byType.set(f.type, []);
      store.byType.get(f.type).push(idx);
    }

    store.metrics.totalDetections++;
    for (const f of findings) {
      store.metrics.detectionsByType[f.type] = (store.metrics.detectionsByType[f.type] || 0) + 1;
    }
    store.metrics.detectionsByLevel[threatLevel] = (store.metrics.detectionsByLevel[threatLevel] || 0) + 1;

    // Cap log
    if (store.incidents.length > 10000) {
      store.incidents = store.incidents.slice(-5000);
    }
  }

  return { ok: true, clean, threatLevel, findings, blocked: threatLevel === THREAT_LEVELS.CRITICAL };
}

/**
 * Scan all fields of a DTU for injection attempts.
 *
 * @param {Object} STATE
 * @param {Object} dtu - The DTU to scan
 * @param {Object} [opts] - { userId, lensId }
 * @returns {{ ok: boolean, clean: boolean, threatLevel: string, fieldResults: Object }}
 */
export function scanDtu(STATE, dtu, opts = {}) {
  if (!dtu || typeof dtu !== "object") {
    return { ok: false, error: "invalid_dtu" };
  }

  const textFields = ["title", "content", "summary", "body", "description"];
  const fieldResults = {};
  let maxThreat = THREAT_LEVELS.NONE;
  let totalFindings = 0;

  for (const field of textFields) {
    if (dtu[field] && typeof dtu[field] === "string") {
      const result = scanContent(STATE, dtu[field], {
        sourceField: field,
        userId: opts.userId,
        lensId: opts.lensId,
      });
      fieldResults[field] = {
        clean: result.clean,
        threatLevel: result.threatLevel,
        findingCount: result.findings.length,
      };
      totalFindings += result.findings.length;
      if (threatRank(result.threatLevel) > threatRank(maxThreat)) {
        maxThreat = result.threatLevel;
      }
    }
  }

  // Also scan meta/tags if present
  if (dtu.meta && typeof dtu.meta === "object") {
    for (const [key, val] of Object.entries(dtu.meta)) {
      if (typeof val === "string" && val.length > 20) {
        const result = scanContent(STATE, val, {
          sourceField: `meta.${key}`,
          userId: opts.userId,
          lensId: opts.lensId,
        });
        if (!result.clean) {
          fieldResults[`meta.${key}`] = {
            clean: false,
            threatLevel: result.threatLevel,
            findingCount: result.findings.length,
          };
          totalFindings += result.findings.length;
          if (threatRank(result.threatLevel) > threatRank(maxThreat)) {
            maxThreat = result.threatLevel;
          }
        }
      }
    }
  }

  return {
    ok: true,
    clean: totalFindings === 0,
    threatLevel: maxThreat,
    fieldResults,
    totalFindings,
    blocked: maxThreat === THREAT_LEVELS.CRITICAL,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CROSS-LENS CONTAMINATION CHECKER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if content references or leaks data from another lens.
 *
 * @param {Object} STATE
 * @param {string} content - Content to check
 * @param {string} currentLens - The lens this content belongs to
 * @param {string[]} allLenses - List of all known lenses
 * @returns {{ ok: boolean, clean: boolean, leaks: Object[] }}
 */
export function checkCrossLensLeak(STATE, content, currentLens, allLenses = []) {
  const store = getInjectionStore(STATE);
  const leaks = [];

  if (!content || !currentLens) return { ok: true, clean: true, leaks: [] };

  const otherLenses = allLenses.filter(l => l !== currentLens);

  for (const lens of otherLenses) {
    // Check for explicit lens references
    const lensPattern = new RegExp(`\\b${escapeRegex(lens)}\\b`, "gi");
    const matches = content.match(lensPattern);
    if (matches && matches.length > 0) {
      leaks.push({
        type: INJECTION_TYPES.CROSS_LENS_LEAK,
        referencedLens: lens,
        occurrences: matches.length,
        severity: "medium",
        message: `Content in "${currentLens}" references lens "${lens}" ${matches.length} time(s)`,
      });
    }
  }

  // Check for DTU ID patterns from other lenses (if IDs encode lens)
  const dtuIdPattern = /\bdtu_[a-z0-9]{6,}_[a-z0-9]+\b/gi;
  const dtuRefs = content.match(dtuIdPattern);
  if (dtuRefs && dtuRefs.length > 5) {
    leaks.push({
      type: INJECTION_TYPES.CROSS_LENS_LEAK,
      severity: "low",
      message: `Content contains ${dtuRefs.length} DTU ID references — possible data harvesting`,
      count: dtuRefs.length,
    });
  }

  if (leaks.length > 0) {
    store.crossLensAccess.push({
      currentLens,
      leaks,
      timestamp: new Date().toISOString(),
    });

    if (store.crossLensAccess.length > 5000) {
      store.crossLensAccess = store.crossLensAccess.slice(-2500);
    }
  }

  return { ok: true, clean: leaks.length === 0, leaks };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CUSTOM PATTERN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add a custom injection pattern to the scanner.
 */
export function addCustomPattern(STATE, pattern, opts = {}) {
  const store = getInjectionStore(STATE);

  if (!pattern) return { ok: false, error: "pattern_required" };

  // Validate regex
  try {
    new RegExp(pattern, "gi");
  } catch {
    return { ok: false, error: "invalid_regex_pattern" };
  }

  store.customPatterns.push({
    pattern,
    type: opts.type || INJECTION_TYPES.DATA_FIELD_ABUSE,
    severity: opts.severity || "medium",
    description: opts.description || "",
    addedAt: new Date().toISOString(),
  });

  return { ok: true, totalPatterns: store.customPatterns.length };
}

/**
 * Get injection defense metrics.
 */
export function getInjectionMetrics(STATE) {
  const store = getInjectionStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    totalIncidents: store.incidents.length,
    customPatterns: store.customPatterns.length,
    crossLensEvents: store.crossLensAccess.length,
  };
}

/**
 * Get recent injection incidents.
 */
export function getInjectionIncidents(STATE, filters = {}) {
  const store = getInjectionStore(STATE);
  let results = store.incidents;

  if (filters.userId) {
    const indices = store.byUser.get(filters.userId) || [];
    results = indices.map(i => store.incidents[i]).filter(Boolean);
  }
  if (filters.type) {
    const indices = store.byType.get(filters.type) || [];
    results = indices.map(i => store.incidents[i]).filter(Boolean);
  }
  if (filters.threatLevel) {
    results = results.filter(i => i.threatLevel === filters.threatLevel);
  }

  const limit = Math.min(filters.limit || 50, 200);
  return { ok: true, incidents: results.slice(-limit), count: results.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function checkInstructionSmuggling(content, findings) {
  const patterns = [
    { re: /ignore\s+(all\s+)?previous\s+(instructions|rules|guidelines)/i, severity: "high" },
    { re: /you\s+are\s+now\s+(a|an|the)\s+/i, severity: "high" },
    { re: /forget\s+(everything|all|your|what)\s/i, severity: "high" },
    { re: /override\s+(safety|security|your|the|all)\s/i, severity: "high" },
    { re: /disregard\s+(all|your|previous|the)\s/i, severity: "high" },
    { re: /new\s+instructions?\s*:/i, severity: "high" },
    { re: /system\s*prompt\s*:/i, severity: "critical" },
    { re: /\[SYSTEM\]/i, severity: "critical" },
    { re: /<<\s*SYS\s*>>/i, severity: "critical" },
    { re: /\[INST\]/i, severity: "high" },
    { re: /assistant\s*:\s*\n/i, severity: "high" },
    { re: /human\s*:\s*\n/i, severity: "medium" },
    { re: /(?:pretend|act\s+as\s+if)\s+you\s+(are|were|have)\s+/i, severity: "medium" },
    { re: /(?:do\s+not|don'?t)\s+(?:follow|obey|listen)\s/i, severity: "high" },
    { re: /bypass\s+(?:all|any|the|your)\s+(?:filters?|gates?|rules?|checks?)/i, severity: "critical" },
  ];

  for (const { re, severity } of patterns) {
    if (re.test(content)) {
      findings.push({
        type: INJECTION_TYPES.INSTRUCTION_SMUGGLING,
        severity,
        pattern: re.source,
        message: `Instruction smuggling pattern detected: ${re.source.slice(0, 60)}`,
      });
    }
  }
}

function checkEncodedPayloads(content, findings) {
  // Base64 encoded instructions (long base64 strings that decode to text)
  const b64Pattern = /[A-Za-z0-9+/]{40,}={0,2}/g;
  const b64Matches = content.match(b64Pattern) || [];

  for (const match of b64Matches.slice(0, 5)) {
    try {
      const decoded = Buffer.from(match, "base64").toString("utf8");
      // Check if decoded content contains suspicious instructions
      if (/ignore|override|system|prompt|instruction/i.test(decoded)) {
        findings.push({
          type: INJECTION_TYPES.ENCODED_PAYLOAD,
          severity: "high",
          message: "Base64-encoded instruction detected",
          preview: decoded.slice(0, 100),
        });
      }
    } catch {
      // Not valid base64, skip
    }
  }

  // Hex-encoded payloads
  const hexPattern = /(?:\\x[0-9a-fA-F]{2}){10,}/g;
  if (hexPattern.test(content)) {
    findings.push({
      type: INJECTION_TYPES.ENCODED_PAYLOAD,
      severity: "medium",
      message: "Hex-encoded payload detected",
    });
  }

  // Unicode escape sequences
  const unicodeEscapes = /(?:\\u[0-9a-fA-F]{4}){5,}/g;
  if (unicodeEscapes.test(content)) {
    findings.push({
      type: INJECTION_TYPES.ENCODED_PAYLOAD,
      severity: "medium",
      message: "Unicode escape sequence payload detected",
    });
  }
}

function checkUnicodeTricks(content, findings) {
  // Zero-width characters used for hiding
  const zeroWidthChars = /(?:\u200B|\u200C|\u200D|\uFEFF|\u00AD)/g;
  const zwMatches = content.match(zeroWidthChars) || [];
  if (zwMatches.length > 3) {
    findings.push({
      type: INJECTION_TYPES.UNICODE_TRICK,
      severity: "medium",
      message: `${zwMatches.length} zero-width characters detected — possible hidden content`,
      count: zwMatches.length,
    });
  }

  // RTL override (used to reverse text display)
  if (/[\u202A-\u202E\u2066-\u2069]/.test(content)) {
    findings.push({
      type: INJECTION_TYPES.UNICODE_TRICK,
      severity: "high",
      message: "Bidirectional text override characters detected — possible display manipulation",
    });
  }

  // Homoglyph detection (Cyrillic/Greek chars that look like Latin)
  const homoglyphs = /[\u0400-\u04FF\u0370-\u03FF]/g;
  const homoMatches = content.match(homoglyphs) || [];
  // Only flag if mixed with Latin text (pure Cyrillic/Greek is fine)
  const hasLatin = /[a-zA-Z]/.test(content);
  if (hasLatin && homoMatches.length > 0 && homoMatches.length < content.length * 0.3) {
    findings.push({
      type: INJECTION_TYPES.UNICODE_TRICK,
      severity: "low",
      message: "Mixed-script content detected (Latin + Cyrillic/Greek) — possible homoglyph attack",
      count: homoMatches.length,
    });
  }
}

function checkInvisibleText(content, findings) {
  // Tags chars (used to hide text) — U+E0001 to U+E007F are "Tags" block
  // These are 5-digit code points, require surrogate pair detection
  let hasTagChars = false;
  for (let i = 0; i < content.length; i++) {
    const code = content.codePointAt(i);
    if (code >= 0xE0001 && code <= 0xE007F) {
      hasTagChars = true;
      break;
    }
    // Skip surrogate pair
    if (code > 0xFFFF) i++;
  }
  if (hasTagChars) {
    findings.push({
      type: INJECTION_TYPES.INVISIBLE_TEXT,
      severity: "high",
      message: "Unicode tag characters detected — invisible text injection",
    });
  }

  // Extremely long whitespace gaps (hiding content between spaces)
  const longWhitespace = /\s{50,}/g;
  if (longWhitespace.test(content)) {
    findings.push({
      type: INJECTION_TYPES.INVISIBLE_TEXT,
      severity: "medium",
      message: "Extremely long whitespace gap detected — possible content hiding",
    });
  }

  // Suspiciously long content with very low visible character ratio
  if (content.length > 500) {
    const visibleChars = content.replace(/\s/g, "").length;
    const ratio = visibleChars / content.length;
    if (ratio < 0.3) {
      findings.push({
        type: INJECTION_TYPES.INVISIBLE_TEXT,
        severity: "medium",
        message: `Low visible character ratio (${(ratio * 100).toFixed(1)}%) — possible whitespace padding attack`,
      });
    }
  }
}

function checkMarkdownHiding(content, findings) {
  // HTML comments that might hide instructions
  const htmlComments = content.match(/<!--[\s\S]*?-->/g) || [];
  for (const comment of htmlComments.slice(0, 5)) {
    if (/instruction|prompt|system|ignore|override/i.test(comment)) {
      findings.push({
        type: INJECTION_TYPES.MARKDOWN_HIDING,
        severity: "high",
        message: "HTML comment contains suspicious instructions",
        preview: comment.slice(0, 100),
      });
    }
  }

  // Hidden links with injection in alt text or title
  const hiddenLinks = /!\[([^\]]*)\]\([^)]*\)/g;
  let match;
  while ((match = hiddenLinks.exec(content)) !== null) {
    if (/instruction|prompt|system|ignore/i.test(match[1])) {
      findings.push({
        type: INJECTION_TYPES.MARKDOWN_HIDING,
        severity: "medium",
        message: "Markdown image alt-text contains suspicious content",
      });
    }
  }

  // Extremely small/hidden text (HTML-based)
  if (/<[^>]*(?:font-size\s*:\s*0|display\s*:\s*none|visibility\s*:\s*hidden)/i.test(content)) {
    findings.push({
      type: INJECTION_TYPES.MARKDOWN_HIDING,
      severity: "high",
      message: "CSS-hidden content detected — possible hidden instructions",
    });
  }
}

function checkSystemPromptReferences(content, findings) {
  const patterns = [
    /system\s*prompt/i,
    /(?:my|your|the)\s*(?:initial|original|base)\s*(?:instructions?|prompt|directives?)/i,
    /(?:reveal|show|display|print|output)\s*(?:your|the)\s*(?:instructions?|prompt|rules?|system)/i,
    /what\s+(?:are|were)\s+your\s+(?:instructions?|rules?|guidelines?|directives?)/i,
  ];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      findings.push({
        type: INJECTION_TYPES.SYSTEM_PROMPT_REFERENCE,
        severity: "medium",
        message: "System prompt reference detected — possible prompt extraction attempt",
      });
      break; // One finding is enough
    }
  }
}

function checkRoleHijacking(content, findings) {
  const patterns = [
    /(?:i\s+am|i'm)\s+(?:the\s+)?(?:admin|administrator|owner|system|root|superuser)/i,
    /(?:speaking|acting)\s+(?:as|on behalf of)\s+(?:the\s+)?(?:system|admin|concord)/i,
    /(?:with|using)\s+(?:admin|root|system)\s+(?:privileges?|permissions?|access)/i,
    /(?:escalate|elevate)\s+(?:my\s+)?(?:privileges?|permissions?|role|access)/i,
    /(?:grant|give)\s+(?:me|myself)\s+(?:admin|root|system|full)\s+(?:access|permissions?)/i,
  ];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      findings.push({
        type: INJECTION_TYPES.ROLE_HIJACK,
        severity: "high",
        message: "Role hijacking attempt detected",
        pattern: pattern.source.slice(0, 60),
      });
    }
  }
}

function checkNestedInjection(content, findings) {
  // JSON payloads embedded in content
  const jsonPattern = /\{[^{}]*"(?:role|system|instruction|prompt|message)"[^{}]*\}/gi;
  if (jsonPattern.test(content)) {
    findings.push({
      type: INJECTION_TYPES.NESTED_INJECTION,
      severity: "high",
      message: "JSON payload with suspicious keys embedded in content",
    });
  }

  // XML/HTML payloads with instruction markers
  const xmlInjection = /<(?:system|instruction|prompt|role)\s*[^>]*>/i;
  if (xmlInjection.test(content)) {
    findings.push({
      type: INJECTION_TYPES.NESTED_INJECTION,
      severity: "high",
      message: "XML/HTML injection with control-plane tags detected",
    });
  }

  // Markdown code blocks containing instruction patterns
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  for (const block of codeBlocks.slice(0, 5)) {
    if (/(?:system|instruction|ignore previous|override|bypass)/i.test(block)) {
      findings.push({
        type: INJECTION_TYPES.NESTED_INJECTION,
        severity: "medium",
        message: "Code block contains suspicious instruction-like content",
      });
    }
  }
}

function checkCustomPatterns(store, content, findings) {
  for (const custom of store.customPatterns) {
    try {
      const re = new RegExp(custom.pattern, "gi");
      if (re.test(content)) {
        findings.push({
          type: custom.type,
          severity: custom.severity,
          message: custom.description || `Custom pattern match: ${custom.pattern.slice(0, 40)}`,
          customPattern: true,
        });
      }
    } catch {
      // Invalid pattern, skip
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function computeThreatLevel(findings) {
  if (findings.length === 0) return THREAT_LEVELS.NONE;
  if (findings.some(f => f.severity === "critical")) return THREAT_LEVELS.CRITICAL;
  if (findings.some(f => f.severity === "high")) return THREAT_LEVELS.HIGH;
  if (findings.some(f => f.severity === "medium")) return THREAT_LEVELS.MEDIUM;
  return THREAT_LEVELS.LOW;
}

function threatRank(level) {
  const ranks = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return ranks[level] || 0;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
