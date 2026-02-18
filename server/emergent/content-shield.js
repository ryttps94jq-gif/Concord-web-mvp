/**
 * Emergent Agent Governance — Content Shield
 *
 * Risk Category 6: Legal / Compliance
 *
 * Problems addressed:
 *   - Users uploading copyrighted content and claiming it's theirs
 *   - Lenses producing output that looks like legal/medical/financial advice
 *   - PII leaking into DTUs, lattice, or shared contexts
 *   - Marketplace listings containing prohibited content
 *
 * Approach:
 *   1. PII Detector — pattern-based detection of emails, phones, SSNs, credit
 *      cards, IP addresses, and other personally identifiable information
 *   2. Copyright Signal Scanner — detects indicators of copied content (not a
 *      full copyright system, but raises flags for human review)
 *   3. Advice Framing Guard — detects when content resembles professional advice
 *      and ensures proper disclaimers are present
 *   4. Content Classification — classifies content risk level for moderation
 *   5. Disclaimer Registry — manages required disclaimers per domain/lens
 *
 * This is NOT a content filter — it's a flag+metadata system.
 * Blocking is a governance decision; this module provides the signals.
 */

import { getEmergentState } from "./store.js";

// ── PII Types ───────────────────────────────────────────────────────────────

export const PII_TYPES = Object.freeze({
  EMAIL:         "email",
  PHONE:         "phone",
  SSN:           "ssn",
  CREDIT_CARD:   "credit_card",
  IP_ADDRESS:    "ip_address",
  ADDRESS:       "address",
  DATE_OF_BIRTH: "date_of_birth",
  PASSPORT:      "passport",
  DRIVERS_LICENSE: "drivers_license",
});

export const ALL_PII_TYPES = Object.freeze(Object.values(PII_TYPES));

// ── Advice Domains ──────────────────────────────────────────────────────────

export const ADVICE_DOMAINS = Object.freeze({
  LEGAL:     "legal",
  MEDICAL:   "medical",
  FINANCIAL: "financial",
  TAX:       "tax",
  THERAPY:   "therapy",
});

export const ALL_ADVICE_DOMAINS = Object.freeze(Object.values(ADVICE_DOMAINS));

// ── Content Risk Levels ─────────────────────────────────────────────────────

export const CONTENT_RISK = Object.freeze({
  SAFE:     "safe",         // no concerns
  LOW:      "low",          // minor flags
  MODERATE: "moderate",     // needs review
  HIGH:     "high",         // should be flagged
  BLOCKED:  "blocked",      // should not be published
});

// ── Content Shield Store ────────────────────────────────────────────────────

export function getContentShieldStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._contentShield) {
    es._contentShield = {
      // Scan results
      scans: [],                     // recent scan results

      // PII detection log
      piiDetections: [],             // { dtuId, piiType, redacted, timestamp }

      // Advice framing alerts
      adviceAlerts: [],              // { dtuId, domain, hasDisclaimer, timestamp }

      // Copyright signals
      copyrightSignals: [],          // { dtuId, signal, timestamp }

      // Disclaimer registry
      disclaimers: new Map(),        // domain -> disclaimerText

      // Configuration
      config: {
        piiDetectionEnabled: true,
        copyrightDetectionEnabled: true,
        adviceFramingEnabled: true,
        autoRedactPii: false,           // if true, replaces PII with [REDACTED]
      },

      metrics: {
        totalScans: 0,
        piiDetected: 0,
        piiByType: {},
        adviceAlertsRaised: 0,
        copyrightSignalsRaised: 0,
        contentByRisk: {},
      },
    };

    // Seed default disclaimers
    seedDisclaimers(es._contentShield);
  }
  return es._contentShield;
}

function seedDisclaimers(store) {
  store.disclaimers.set(ADVICE_DOMAINS.LEGAL,
    "This content is for informational purposes only and does not constitute legal advice. " +
    "Consult a qualified attorney for legal matters."
  );
  store.disclaimers.set(ADVICE_DOMAINS.MEDICAL,
    "This content is for informational purposes only and does not constitute medical advice. " +
    "Consult a qualified healthcare professional for medical decisions."
  );
  store.disclaimers.set(ADVICE_DOMAINS.FINANCIAL,
    "This content is for informational purposes only and does not constitute financial advice. " +
    "Consult a qualified financial advisor before making investment decisions."
  );
  store.disclaimers.set(ADVICE_DOMAINS.TAX,
    "This content is for informational purposes only and does not constitute tax advice. " +
    "Consult a qualified tax professional for tax matters."
  );
  store.disclaimers.set(ADVICE_DOMAINS.THERAPY,
    "This content is for informational purposes only and is not a substitute for professional " +
    "mental health care. If you are in crisis, contact emergency services."
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PII DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scan content for personally identifiable information.
 *
 * @param {Object} STATE
 * @param {string} content - Text to scan
 * @param {Object} [opts] - { dtuId, autoRedact }
 * @returns {{ ok: boolean, piiFound: boolean, detections: Object[], redacted?: string }}
 */
export function detectPii(STATE, content, opts = {}) {
  const store = getContentShieldStore(STATE);
  if (!store.config.piiDetectionEnabled) {
    return { ok: true, piiFound: false, detections: [], skipped: true };
  }

  if (!content || typeof content !== "string") {
    return { ok: true, piiFound: false, detections: [] };
  }

  const detections = [];
  let redactedContent = content;

  // Email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emails = content.match(emailPattern) || [];
  for (const email of emails) {
    detections.push({ type: PII_TYPES.EMAIL, value: maskPii(email, "email"), position: content.indexOf(email) });
    redactedContent = redactedContent.replace(email, "[EMAIL REDACTED]");
  }

  // Phone numbers (US + international formats)
  const phonePattern = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  const phones = content.match(phonePattern) || [];
  for (const phone of phones) {
    detections.push({ type: PII_TYPES.PHONE, value: maskPii(phone, "phone"), position: content.indexOf(phone) });
    redactedContent = redactedContent.replace(phone, "[PHONE REDACTED]");
  }

  // SSN (US Social Security Number)
  const ssnPattern = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
  const ssns = content.match(ssnPattern) || [];
  // Filter out phone numbers that also match
  for (const ssn of ssns) {
    if (!phones.includes(ssn) && /^\d{3}[-\s]?\d{2}[-\s]?\d{4}$/.test(ssn.trim())) {
      detections.push({ type: PII_TYPES.SSN, value: "***-**-" + ssn.slice(-4), position: content.indexOf(ssn) });
      redactedContent = redactedContent.replace(ssn, "[SSN REDACTED]");
    }
  }

  // Credit card numbers (basic Luhn-eligible patterns)
  const ccPattern = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  const ccs = content.match(ccPattern) || [];
  for (const cc of ccs) {
    const digits = cc.replace(/[-\s]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) {
      detections.push({ type: PII_TYPES.CREDIT_CARD, value: "****-****-****-" + digits.slice(-4), position: content.indexOf(cc) });
      redactedContent = redactedContent.replace(cc, "[CREDIT CARD REDACTED]");
    }
  }

  // IP addresses (IPv4)
  const ipPattern = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;
  const ips = content.match(ipPattern) || [];
  for (const ip of ips) {
    // Skip common non-PII IPs (localhost, private ranges in documentation)
    if (ip === "127.0.0.1" || ip === "0.0.0.0" || ip.startsWith("192.168.") || ip.startsWith("10.")) continue;
    detections.push({ type: PII_TYPES.IP_ADDRESS, value: ip.replace(/\d+$/, "***"), position: content.indexOf(ip) });
    redactedContent = redactedContent.replace(ip, "[IP REDACTED]");
  }

  const piiFound = detections.length > 0;

  if (piiFound) {
    for (const d of detections) {
      store.piiDetections.push({
        dtuId: opts.dtuId || null,
        piiType: d.type,
        timestamp: new Date().toISOString(),
      });
      store.metrics.piiDetected++;
      store.metrics.piiByType[d.type] = (store.metrics.piiByType[d.type] || 0) + 1;
    }

    if (store.piiDetections.length > 10000) {
      store.piiDetections = store.piiDetections.slice(-5000);
    }
  }

  const result = { ok: true, piiFound, detections, count: detections.length };
  if ((opts.autoRedact || store.config.autoRedactPii) && piiFound) {
    result.redacted = redactedContent;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COPYRIGHT SIGNAL SCANNER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scan content for copyright indicators.
 * This is heuristic — it flags for human review, not blocks.
 *
 * @param {Object} STATE
 * @param {string} content
 * @param {Object} [opts] - { dtuId }
 * @returns {{ ok: boolean, signals: Object[], riskLevel: string }}
 */
export function detectCopyrightSignals(STATE, content, opts = {}) {
  const store = getContentShieldStore(STATE);
  if (!store.config.copyrightDetectionEnabled) {
    return { ok: true, signals: [], riskLevel: CONTENT_RISK.SAFE, skipped: true };
  }

  if (!content || typeof content !== "string") {
    return { ok: true, signals: [], riskLevel: CONTENT_RISK.SAFE };
  }

  const signals = [];

  // Copyright notices
  const copyrightPattern = /©\s*\d{4}|copyright\s*(?:\(c\)\s*)?\d{4}|all\s+rights\s+reserved/gi;
  const copyrightMatches = content.match(copyrightPattern) || [];
  if (copyrightMatches.length > 0) {
    signals.push({
      type: "copyright_notice",
      severity: "high",
      message: `Copyright notice found: "${copyrightMatches[0]}"`,
      matches: copyrightMatches.length,
    });
  }

  // ISBN / DOI patterns
  const isbnPattern = /ISBN[-\s]?(?:1[03])?[-\s]?(?:\d[-\s]?){9}[\dXx]/g;
  if (isbnPattern.test(content)) {
    signals.push({
      type: "isbn_found",
      severity: "medium",
      message: "ISBN number detected — content may be from a published book",
    });
  }

  const doiPattern = /\bdoi:\s*10\.\d{4,}\b/gi;
  if (doiPattern.test(content)) {
    signals.push({
      type: "doi_found",
      severity: "low",
      message: "DOI reference detected — academic source citation",
    });
  }

  // Very long verbatim quotes (>500 chars without attribution)
  const longQuote = /[""][^""]{500,}[""]|'{500,}'/;
  if (longQuote.test(content)) {
    signals.push({
      type: "long_verbatim_quote",
      severity: "medium",
      message: "Very long quotation detected (>500 chars) — may exceed fair use",
    });
  }

  // Trademark symbols
  const trademarkCount = (content.match(/[™®℠]/g) || []).length;
  if (trademarkCount > 3) {
    signals.push({
      type: "trademark_dense",
      severity: "low",
      message: `Content contains ${trademarkCount} trademark symbols`,
    });
  }

  // Compute risk level
  const riskLevel = signals.some(s => s.severity === "high") ? CONTENT_RISK.HIGH
    : signals.some(s => s.severity === "medium") ? CONTENT_RISK.MODERATE
    : signals.length > 0 ? CONTENT_RISK.LOW
    : CONTENT_RISK.SAFE;

  if (signals.length > 0) {
    store.copyrightSignals.push({
      dtuId: opts.dtuId || null,
      signals: signals.length,
      riskLevel,
      timestamp: new Date().toISOString(),
    });
    store.metrics.copyrightSignalsRaised += signals.length;

    if (store.copyrightSignals.length > 5000) {
      store.copyrightSignals = store.copyrightSignals.slice(-2500);
    }
  }

  return { ok: true, signals, riskLevel, count: signals.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ADVICE FRAMING GUARD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if content resembles professional advice and check for disclaimers.
 *
 * @param {Object} STATE
 * @param {string} content
 * @param {Object} [opts] - { dtuId, domain }
 * @returns {{ ok: boolean, adviceDetected: boolean, domains: string[], hasDisclaimer: boolean, neededDisclaimers: string[] }}
 */
export function checkAdviceFraming(STATE, content, opts = {}) {
  const store = getContentShieldStore(STATE);
  if (!store.config.adviceFramingEnabled) {
    return { ok: true, adviceDetected: false, domains: [], hasDisclaimer: true, neededDisclaimers: [], skipped: true };
  }

  if (!content || typeof content !== "string") {
    return { ok: true, adviceDetected: false, domains: [], hasDisclaimer: true, neededDisclaimers: [] };
  }

  const detectedDomains = [];

  // Legal advice patterns
  const legalPatterns = [
    /\b(?:you\s+should|you\s+must|you\s+need\s+to)\s+(?:file|sue|hire\s+a\s+lawyer|consult)/i,
    /\b(?:legal\s+rights?|statute\s+of\s+limitations?|liable|liability|litigation)\b/i,
    /\b(?:in\s+(?:my|this)\s+legal\s+opinion|according\s+to\s+the\s+law)\b/i,
    /\b(?:court\s+order|legal\s+obligation|breach\s+of\s+contract)\b/i,
  ];
  if (legalPatterns.some(p => p.test(content))) {
    detectedDomains.push(ADVICE_DOMAINS.LEGAL);
  }

  // Medical advice patterns
  const medicalPatterns = [
    /\b(?:you\s+should\s+(?:take|stop\s+taking|increase|decrease)\s+(?:your\s+)?(?:medication|dosage|dose))\b/i,
    /\b(?:diagnosis|prognosis|treatment\s+plan|prescription|you\s+(?:have|might\s+have)\s+(?:a|an)\s+\w+\s+condition)\b/i,
    /\b(?:symptoms?\s+(?:of|suggest|indicate)|side\s+effects?\s+(?:include|are))\b/i,
    /\b(?:take\s+\d+\s*mg|apply\s+(?:topical|cream|ointment))\b/i,
  ];
  if (medicalPatterns.some(p => p.test(content))) {
    detectedDomains.push(ADVICE_DOMAINS.MEDICAL);
  }

  // Financial advice patterns
  const financialPatterns = [
    /\b(?:you\s+should\s+(?:invest|buy|sell|hold)\s+(?:stocks?|bonds?|crypto|shares?))\b/i,
    /\b(?:financial\s+advice|investment\s+(?:advice|strategy|recommendation))\b/i,
    /\b(?:guaranteed\s+(?:returns?|profits?)|risk-free\s+investment)\b/i,
    /\b(?:portfolio\s+allocation|asset\s+allocation|buy\s+(?:the\s+)?dip)\b/i,
  ];
  if (financialPatterns.some(p => p.test(content))) {
    detectedDomains.push(ADVICE_DOMAINS.FINANCIAL);
  }

  // Tax advice patterns
  const taxPatterns = [
    /\b(?:tax\s+(?:deduction|credit|write[-\s]?off|shelter|haven|loophole))\b/i,
    /\b(?:you\s+(?:can|should)\s+(?:deduct|claim|write\s+off))\b/i,
    /\b(?:irs|hmrc|tax\s+return|taxable\s+income)\b/i,
  ];
  if (taxPatterns.some(p => p.test(content))) {
    detectedDomains.push(ADVICE_DOMAINS.TAX);
  }

  // Therapy patterns
  const therapyPatterns = [
    /\b(?:you\s+(?:are|seem|appear)\s+(?:depressed|anxious|suicidal|bipolar))\b/i,
    /\b(?:mental\s+health\s+(?:diagnosis|assessment|evaluation))\b/i,
    /\b(?:therapeutic\s+(?:approach|technique|intervention))\b/i,
  ];
  if (therapyPatterns.some(p => p.test(content))) {
    detectedDomains.push(ADVICE_DOMAINS.THERAPY);
  }

  if (detectedDomains.length === 0) {
    return { ok: true, adviceDetected: false, domains: [], hasDisclaimer: true, neededDisclaimers: [] };
  }

  // Check for existing disclaimers
  const hasDisclaimer = /\b(?:not\s+(?:legal|medical|financial|tax|professional)\s+advice|informational\s+purposes\s+only|consult\s+(?:a|an|your)\s+(?:qualified|licensed|professional))\b/i.test(content);

  // Get needed disclaimers
  const neededDisclaimers = [];
  for (const domain of detectedDomains) {
    const disclaimer = store.disclaimers.get(domain);
    if (disclaimer && !hasDisclaimer) {
      neededDisclaimers.push({ domain, text: disclaimer });
    }
  }

  // Log
  store.adviceAlerts.push({
    dtuId: opts.dtuId || null,
    domains: detectedDomains,
    hasDisclaimer,
    timestamp: new Date().toISOString(),
  });
  store.metrics.adviceAlertsRaised++;

  if (store.adviceAlerts.length > 5000) {
    store.adviceAlerts = store.adviceAlerts.slice(-2500);
  }

  return {
    ok: true,
    adviceDetected: true,
    domains: detectedDomains,
    hasDisclaimer,
    neededDisclaimers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. COMPREHENSIVE CONTENT SCAN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run all content checks against a piece of content.
 *
 * @param {Object} STATE
 * @param {string} content
 * @param {Object} [opts] - { dtuId, domain }
 * @returns {{ ok: boolean, riskLevel: string, pii: Object, copyright: Object, advice: Object }}
 */
export function scanContentFull(STATE, content, opts = {}) {
  const store = getContentShieldStore(STATE);
  store.metrics.totalScans++;

  const pii = detectPii(STATE, content, opts);
  const copyright = detectCopyrightSignals(STATE, content, opts);
  const advice = checkAdviceFraming(STATE, content, opts);

  // Compute overall risk level
  let riskLevel = CONTENT_RISK.SAFE;
  if (pii.piiFound) riskLevel = maxRisk(riskLevel, pii.count > 3 ? CONTENT_RISK.HIGH : CONTENT_RISK.MODERATE);
  if (copyright.riskLevel !== CONTENT_RISK.SAFE) riskLevel = maxRisk(riskLevel, copyright.riskLevel);
  if (advice.adviceDetected && !advice.hasDisclaimer) riskLevel = maxRisk(riskLevel, CONTENT_RISK.MODERATE);

  store.metrics.contentByRisk[riskLevel] = (store.metrics.contentByRisk[riskLevel] || 0) + 1;

  // Store scan result
  store.scans.push({
    dtuId: opts.dtuId || null,
    riskLevel,
    piiCount: pii.count || 0,
    copyrightSignals: copyright.count || 0,
    adviceDomains: advice.domains?.length || 0,
    timestamp: new Date().toISOString(),
  });
  if (store.scans.length > 5000) store.scans = store.scans.slice(-2500);

  return { ok: true, riskLevel, pii, copyright, advice };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DISCLAIMER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set or update a disclaimer for an advice domain.
 */
export function setDisclaimer(STATE, domain, text) {
  const store = getContentShieldStore(STATE);
  if (!ALL_ADVICE_DOMAINS.includes(domain)) {
    return { ok: false, error: "invalid_advice_domain", allowed: ALL_ADVICE_DOMAINS };
  }
  store.disclaimers.set(domain, String(text).slice(0, 2000));
  return { ok: true };
}

/**
 * Get disclaimer for a domain.
 */
export function getDisclaimer(STATE, domain) {
  const store = getContentShieldStore(STATE);
  const text = store.disclaimers.get(domain);
  return { ok: true, domain, text: text || null };
}

/**
 * Get all disclaimers.
 */
export function getAllDisclaimers(STATE) {
  const store = getContentShieldStore(STATE);
  const disclaimers = {};
  for (const [domain, text] of store.disclaimers) {
    disclaimers[domain] = text;
  }
  return { ok: true, disclaimers };
}

/**
 * Update content shield configuration.
 */
export function updateContentShieldConfig(STATE, overrides = {}) {
  const store = getContentShieldStore(STATE);
  for (const [key, value] of Object.entries(overrides)) {
    if (key in store.config && typeof value === typeof store.config[key]) {
      store.config[key] = value;
    }
  }
  return { ok: true, config: { ...store.config } };
}

/**
 * Get content shield metrics.
 */
export function getContentShieldMetrics(STATE) {
  const store = getContentShieldStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    totalScans: store.scans.length,
    piiDetections: store.piiDetections.length,
    adviceAlerts: store.adviceAlerts.length,
    copyrightSignals: store.copyrightSignals.length,
    disclaimersConfigured: store.disclaimers.size,
    config: { ...store.config },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function maskPii(value, type) {
  if (!value) return "[REDACTED]";
  switch (type) {
    case "email": {
      const [local, domain] = value.split("@");
      return `${local[0]}***@${domain}`;
    }
    case "phone":
      return value.slice(0, 3) + "***" + value.slice(-2);
    default:
      return value.slice(0, 2) + "***" + value.slice(-2);
  }
}

function passesLuhn(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function maxRisk(a, b) {
  const rank = { safe: 0, low: 1, moderate: 2, high: 3, blocked: 4 };
  return (rank[a] || 0) >= (rank[b] || 0) ? a : b;
}
