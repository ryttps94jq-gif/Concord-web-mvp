/**
 * Quality Gate — structural validation for lens artifacts before rendering.
 *
 * ZERO LLM calls. Pure structural validation. Runs in <5ms.
 * Validates against schema, runs domain-specific checks, catches LLM garbage.
 *
 * Returns { pass, issues[], score (0-1) }
 */

import { getArtifactSchema } from "./artifact-schemas.js";

const VALIDATORS = new Map();
const VOCABULARIES = new Map();

export function registerValidator(domain, validatorFn) {
  VALIDATORS.set(domain, validatorFn);
}

export function registerVocabulary(name, words) {
  VOCABULARIES.set(name, new Set(words.map((w) => w.toLowerCase())));
}

export function getVocabulary(name) {
  return VOCABULARIES.get(name);
}

// ── Core Validation ─────────────────────────────────────────────────────────

/**
 * Validate artifact data against schema and domain rules.
 * Returns { pass, issues[], score (0-1) }
 */
export function validateForRender(domain, action, artifactData) {
  const issues = [];
  let score = 1.0;

  // 1. Schema validation
  const schema = getArtifactSchema(domain, action);
  if (schema) {
    const schemaIssues = validateAgainstSchema(artifactData, schema);
    issues.push(...schemaIssues);
    score -= schemaIssues.length * 0.1;
  }

  // 2. Domain-specific validator
  const validator = VALIDATORS.get(domain);
  if (validator) {
    const domainResult = validator(artifactData, action);
    if (!domainResult.pass) {
      issues.push(...(domainResult.issues || [{ issue: domainResult.reason, severity: "warning" }]));
      score -= 0.3;
    }
  }

  // 3. Anti-garbage checks (universal)
  const garbageResult = antiGarbageCheck(artifactData, domain);
  issues.push(...garbageResult.issues);
  score -= garbageResult.issues.length * 0.15;

  score = Math.max(0, Math.min(1, score));

  return {
    pass: score >= 0.5 && issues.filter((i) => i.severity === "critical").length === 0,
    score,
    issues,
  };
}

// ── Quality Tier Assignment ─────────────────────────────────────────────────

/**
 * Assign marketplace readiness tier based on validation + entity maturity.
 *
 * TIER 1: Auto-approved — score >= 0.8, maturity >= 0.5, no warnings
 * TIER 2: Pending spot-check — score >= 0.5, maturity >= 0.3
 * TIER 3: Held for review — everything else that passed
 * rejected: Critical issues found
 */
export function assignQualityTier(validationResult, entityMaturity) {
  const { score, issues } = validationResult;
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  if (criticalCount > 0) return { tier: "rejected", status: "draft_failed_quality" };

  if (score >= 0.8 && entityMaturity >= 0.5 && warningCount === 0) {
    return { tier: 1, status: "marketplace_ready" };
  }

  if (score >= 0.5 && entityMaturity >= 0.3) {
    return { tier: 2, status: "pending_spot_check" };
  }

  return { tier: 3, status: "pending_review" };
}

// ── Schema Validator ────────────────────────────────────────────────────────

function validateAgainstSchema(data, schema, path = "") {
  const issues = [];

  if (!data || typeof data !== "object") {
    issues.push({ path, issue: "Expected object, got " + typeof data, severity: "critical" });
    return issues;
  }

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null || data[field] === "") {
        issues.push({
          path: path ? `${path}.${field}` : field,
          issue: `Required field missing: ${field}`,
          severity: "critical",
        });
      }
    }
  }

  // Check property constraints
  if (schema.properties) {
    for (const [field, constraints] of Object.entries(schema.properties)) {
      const value = data[field];
      if (value === undefined || value === null) continue;

      const fieldPath = path ? `${path}.${field}` : field;

      // Type check
      if (constraints.type === "number" && typeof value !== "number") {
        issues.push({ path: fieldPath, issue: `Expected number, got ${typeof value}`, severity: "warning" });
      }
      if (constraints.type === "string" && typeof value !== "string") {
        issues.push({ path: fieldPath, issue: `Expected string, got ${typeof value}`, severity: "warning" });
      }
      if (constraints.type === "array" && !Array.isArray(value)) {
        issues.push({ path: fieldPath, issue: `Expected array, got ${typeof value}`, severity: "critical" });
        continue;
      }

      // Range checks
      if (constraints.min !== undefined && typeof value === "number" && value < constraints.min) {
        issues.push({ path: fieldPath, issue: `Value ${value} below minimum ${constraints.min}`, severity: "warning" });
      }
      if (constraints.max !== undefined && typeof value === "number" && value > constraints.max) {
        issues.push({ path: fieldPath, issue: `Value ${value} above maximum ${constraints.max}`, severity: "warning" });
      }
      if (constraints.minLength !== undefined && typeof value === "string" && value.length < constraints.minLength) {
        issues.push({ path: fieldPath, issue: `String too short: ${value.length} < ${constraints.minLength}`, severity: "warning" });
      }

      // Enum check
      if (constraints.enum && !constraints.enum.includes(value)) {
        issues.push({ path: fieldPath, issue: `Invalid value "${value}", expected one of: ${constraints.enum.join(", ")}`, severity: "warning" });
      }

      // Array item validation (recursive, check first 10)
      if (constraints.type === "array" && Array.isArray(value)) {
        if (constraints.minItems && value.length < constraints.minItems) {
          issues.push({ path: fieldPath, issue: `Array needs at least ${constraints.minItems} items, has ${value.length}`, severity: "critical" });
        }
        if (constraints.items && typeof constraints.items === "object") {
          for (let i = 0; i < Math.min(value.length, 10); i++) {
            const itemIssues = validateAgainstSchema(value[i], constraints.items, `${fieldPath}[${i}]`);
            issues.push(...itemIssues);
          }
        }
      }

      // Nested object validation (recursive)
      if (constraints.properties && typeof value === "object" && !Array.isArray(value)) {
        const nestedIssues = validateAgainstSchema(value, constraints, fieldPath);
        issues.push(...nestedIssues);
      }

      // Vocabulary check (info-level only)
      if (constraints.vocabulary && typeof value === "string") {
        const vocab = getVocabulary(constraints.vocabulary);
        if (vocab && !vocab.has(value.toLowerCase())) {
          issues.push({ path: fieldPath, issue: `"${value}" not in ${constraints.vocabulary} vocabulary`, severity: "info" });
        }
      }
    }
  }

  return issues;
}

// ── Anti-Garbage Check ──────────────────────────────────────────────────────

/**
 * Universal checks that catch LLM-generated garbage regardless of domain.
 */
function antiGarbageCheck(data, domain) {
  const issues = [];
  const text = JSON.stringify(data).toLowerCase();

  // System/meta language in user-facing content
  const FORBIDDEN_PATTERNS = [
    /\bconcord\b/i,
    /\bdtu\b/i,
    /\blattice\b/i,
    /\bconstraint geometry\b/i,
    /\bsubstrate\b/i,
    /\bheartbeat\b/i,
    /\bautogen\b/i,
    /\bmacro registry\b/i,
    /\bollama\b/i,
    /\bentity \w+ explores\b/i,
    /\bas an ai\b/i,
    /\blanguage model\b/i,
    /\bi don'?t have (access|the ability)\b/i,
    /\bplaceholder\b/i,
    /\b\[insert\b/i,
    /\b\[your\b/i,
    /\bexample\.\.\./i,
    /\blorem ipsum\b/i,
  ];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        issue: `Forbidden pattern detected: ${pattern.source}`,
        severity: "critical",
        pattern: pattern.source,
      });
    }
  }

  // Suspiciously repetitive content
  const values = extractStringValues(data);
  if (values.length > 3) {
    const unique = new Set(values.map((v) => v.toLowerCase().trim()));
    const repetitionRatio = unique.size / values.length;
    if (repetitionRatio < 0.3) {
      issues.push({ issue: `High repetition: ${unique.size} unique values out of ${values.length}`, severity: "warning" });
    }
  }

  // Suspiciously short content
  const allStrings = values.filter((v) => v.length > 0);
  const avgLength = allStrings.reduce((s, v) => s + v.length, 0) / (allStrings.length || 1);
  if (avgLength < 5 && allStrings.length > 3) {
    issues.push({ issue: `Average string length very short (${avgLength.toFixed(1)} chars)`, severity: "warning" });
  }

  // Domain vocabulary presence check
  const DOMAIN_SIGNALS = {
    food: /\b(cup|tablespoon|teaspoon|ounce|gram|pound|bake|grill|saut[eé]|chop|dice|simmer|boil|fry|roast|protein|carb|fat|calorie|fiber|sodium|serve|portion|ingredient|recipe|meal|breakfast|lunch|dinner)\b/i,
    fitness: /\b(set|rep|superset|circuit|rest|warmup|cooldown|bench|squat|deadlift|curl|press|row|pull|push|plank|lunge|cardio|hiit|stretch|weight|dumbbell|barbell|kettlebell|band|bodyweight|muscle|hypertrophy|strength|endurance)\b/i,
    healthcare: /\b(patient|diagnosis|symptom|medication|dosage|treatment|intervention|monitor|vital|blood pressure|heart rate|lab|referral|follow.?up|prognosis|chronic|acute|assessment|care plan|goal|outcome|provider|clinician)\b/i,
    law: /\b(party|parties|clause|term|agreement|contract|liability|indemnif|warrant|represent|breach|remedy|jurisdiction|governing law|arbitrat|confidential|terminat|amendment|assign|notice|severab|waiver|execution|signature)\b/i,
    legal: /\b(party|parties|clause|term|agreement|contract|liability|indemnif|warrant|represent|breach|remedy|jurisdiction|governing law|arbitrat|confidential|terminat)\b/i,
    finance: /\b(revenue|expense|asset|liability|equity|cash flow|profit|loss|margin|roi|irr|npv|depreciation|amortization|interest|principal|tax|deduction|credit|debit|ledger|balance|reconcil|forecast|budget|variance)\b/i,
    accounting: /\b(invoice|ledger|debit|credit|balance|revenue|expense|tax|reconcil|statement|receivable|payable|journal|depreciation|amortization)\b/i,
    music: /\b(note|chord|melody|rhythm|beat|tempo|bpm|bar|measure|key|scale|minor|major|flat|sharp|octave|velocity|sustain|release|attack|decay|reverb|delay|midi|track|channel)\b/i,
    studio: /\b(note|chord|melody|rhythm|beat|tempo|bpm|bar|measure|key|scale|minor|major|velocity|midi|track|channel|pattern|arrangement)\b/i,
    realestate: /\b(property|listing|mortgage|down payment|closing|escrow|title|deed|apprais|inspect|roi|cap rate|noi|cash.on.cash|tenant|lease|rent|sqft|square feet|bedroom|bathroom|lot size|zoning|hoa)\b/i,
    education: /\b(lesson|curriculum|student|teacher|assess|rubric|objective|outcome|standard|grade|quiz|exam|assignment|homework|project|module|unit|semester|prerequisite|scaffol|differentiat|bloom|taxonomy|formative|summative)\b/i,
    insurance: /\b(policy|premium|deductible|coverage|claim|underwriting|exclusion|rider|copay|coinsurance|actuarial|indemnity|liability|subrogation|reinsurance)\b/i,
  };

  const domainSignal = DOMAIN_SIGNALS[domain];
  if (domainSignal) {
    const matches = text.match(new RegExp(domainSignal, "gi")) || [];
    if (matches.length < 3 && text.length > 200) {
      issues.push({
        issue: `Low domain vocabulary signal: only ${matches.length} ${domain} terms found`,
        severity: "warning",
      });
    }
  }

  return { issues };
}

function extractStringValues(obj) {
  const values = [];
  function walk(o) {
    if (typeof o === "string" && o.length > 0) values.push(o);
    else if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") Object.values(o).forEach(walk);
  }
  walk(obj);
  return values;
}
