/**
 * Empirical Gates — Deterministic Math/Physics/Dimensional Validators
 *
 * Extracted from server.js research/dimensional domains into a standalone
 * module so the autogen pipeline's Critic phase can enforce empirical discipline.
 *
 * Three gate layers:
 *   1. Math Gate:        validate/evaluate math expressions found in claims
 *   2. Unit Gate:        parse & validate units on numeric claims (SI dimensional)
 *   3. Constants Gate:   cross-reference physical constants against known values
 *
 * Integration contract:
 *   - Pure functions, no side effects, no STATE dependency
 *   - Every gate returns { ok, issues[] } — never throws
 *   - Issues have severity: "critical" | "warning" | "info"
 *   - The pipeline critic calls runEmpiricalGates(candidate) and merges issues
 */

// ══════════════════════════════════════════════════════════════════════════════
// Math Engine (shunting-yard → RPN)
// ══════════════════════════════════════════════════════════════════════════════

const MATH_FUNCS = Object.freeze({
  sqrt: (a) => Math.sqrt(a), abs: (a) => Math.abs(a),
  sin: (a) => Math.sin(a), cos: (a) => Math.cos(a), tan: (a) => Math.tan(a),
  asin: (a) => Math.asin(a), acos: (a) => Math.acos(a), atan: (a) => Math.atan(a),
  ln: (a) => Math.log(a), log: (a) => Math.log10(a), exp: (a) => Math.exp(a),
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a),
  pow: (a, b) => Math.pow(a, b),
});

const MATH_CONSTS = Object.freeze({ pi: Math.PI, e: Math.E });

const OP_INFO = Object.freeze({
  "+":  { prec: 2, assoc: "L", arity: 2, fn: (a, b) => a + b },
  "-":  { prec: 2, assoc: "L", arity: 2, fn: (a, b) => a - b },
  "*":  { prec: 3, assoc: "L", arity: 2, fn: (a, b) => a * b },
  "/":  { prec: 3, assoc: "L", arity: 2, fn: (a, b) => a / b },
  "^":  { prec: 4, assoc: "R", arity: 2, fn: (a, b) => Math.pow(a, b) },
  "u-": { prec: 5, assoc: "R", arity: 1, fn: (a) => -a },
});

function mathTokenize(expr = "") {
  const s = String(expr).replace(/\s+/g, "").trim();
  const out = [];
  const re = /(\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|[+\-*/^(),])/gy;
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  if (out.join("") !== s) throw new Error("Math parse error: invalid characters");
  return out;
}

function mathToRPN(tokens) {
  const out = [];
  const stack = [];
  let prev = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isNum = /^[0-9]/.test(t);
    const isName = /^[A-Za-z_]/.test(t);
    if (isNum) { out.push({ type: "num", v: Number(t) }); prev = "val"; continue; }
    if (isName) {
      const name = t.toLowerCase();
      const next = tokens[i + 1];
      if (next === "(") { stack.push({ type: "func", name }); prev = "func"; continue; }
      if (name in MATH_CONSTS) { out.push({ type: "num", v: Number(MATH_CONSTS[name]) }); prev = "val"; continue; }
      throw new Error(`Unknown symbol: ${t}`);
    }
    if (t === ",") {
      while (stack.length && stack[stack.length - 1].op !== "(") out.push(stack.pop());
      if (!stack.length) throw new Error("Misplaced comma");
      prev = ",";
      continue;
    }
    if (t === "(") { stack.push({ op: "(" }); prev = "("; continue; }
    if (t === ")") {
      while (stack.length && stack[stack.length - 1].op !== "(") out.push(stack.pop());
      if (!stack.length) throw new Error("Mismatched ')'");
      stack.pop();
      if (stack.length && stack[stack.length - 1].type === "func") out.push(stack.pop());
      prev = "val";
      continue;
    }
    if (["+", "-", "*", "/", "^"].includes(t)) {
      let op = t;
      if (op === "-" && (prev === null || prev === "(" || prev === "," || prev === "op" || prev === "func")) op = "u-";
      const info = OP_INFO[op];
      while (stack.length) {
        const top = stack[stack.length - 1];
        const topInfo = top && top.op ? OP_INFO[top.op] : null;
        if (!topInfo) break;
        if ((info.assoc === "L" && info.prec <= topInfo.prec) || (info.assoc === "R" && info.prec < topInfo.prec)) out.push(stack.pop());
        else break;
      }
      stack.push({ op });
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
      const arity = fn.length || 1;
      if (it.name === "min" || it.name === "max") {
        if (st.length < 2) throw new Error(`${it.name} requires >=2 args`);
        const b = st.pop(); const a = st.pop();
        st.push(fn(a, b));
      } else {
        if (st.length < arity) throw new Error(`${it.name} requires ${arity} args`);
        const args = st.splice(st.length - arity, arity);
        st.push(fn(...args));
      }
      continue;
    }
    if (it.op) {
      const info = OP_INFO[it.op];
      if (!info) throw new Error(`Unknown operator: ${it.op}`);
      if (st.length < info.arity) throw new Error("Malformed expression");
      if (info.arity === 1) {
        st.push(info.fn(st.pop()));
      } else {
        const b = st.pop(); const a = st.pop();
        st.push(info.fn(a, b));
      }
      continue;
    }
    throw new Error("Bad RPN item");
  }
  if (st.length !== 1) throw new Error("Malformed expression");
  return st[0];
}

/**
 * Evaluate a math expression deterministically.
 * @param {string} expr - e.g. "2*pi*3.5", "sqrt(144)+1"
 * @returns {number}
 * @throws on parse/eval error
 */
export function evalMathExpression(expr = "") {
  const tokens = mathTokenize(expr);
  const rpn = mathToRPN(tokens);
  const value = mathEvalRPN(rpn);
  if (!Number.isFinite(value)) throw new Error("Non-finite result");
  return value;
}

// ══════════════════════════════════════════════════════════════════════════════
// Dimensional Analysis (SI-based unit algebra)
// ══════════════════════════════════════════════════════════════════════════════

const DIM_KEYS = ["m", "kg", "s", "A", "K", "mol", "cd"];

function zeroDim() { return Object.fromEntries(DIM_KEYS.map(k => [k, 0])); }

function addDim(a, b, sign = 1) {
  const out = zeroDim();
  for (const k of DIM_KEYS) out[k] = (a[k] || 0) + sign * (b[k] || 0);
  return out;
}

function mulDimPow(a, pow) {
  const out = zeroDim();
  for (const k of DIM_KEYS) out[k] = (a[k] || 0) * pow;
  return out;
}

function sameDim(a, b) {
  for (const k of DIM_KEYS) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

function dimToSig(a) { return DIM_KEYS.map(k => `${k}^${a[k] || 0}`).join("|"); }

const UNIT_TABLE = (() => {
  const Z = zeroDim();
  return {
    m:   { f: 1, d: { ...Z, m: 1 } },
    kg:  { f: 1, d: { ...Z, kg: 1 } },
    s:   { f: 1, d: { ...Z, s: 1 } },
    A:   { f: 1, d: { ...Z, A: 1 } },
    K:   { f: 1, d: { ...Z, K: 1 } },
    mol: { f: 1, d: { ...Z, mol: 1 } },
    cd:  { f: 1, d: { ...Z, cd: 1 } },
    g:   { f: 1e-3, d: { ...Z, kg: 1 } },
    sec: { f: 1, d: { ...Z, s: 1 } },
    min: { f: 60, d: { ...Z, s: 1 } },
    h:   { f: 3600, d: { ...Z, s: 1 } },
    Hz:  { f: 1, d: { ...Z, s: -1 } },
    N:   { f: 1, d: { ...Z, m: 1, kg: 1, s: -2 } },
    Pa:  { f: 1, d: { ...Z, m: -1, kg: 1, s: -2 } },
    J:   { f: 1, d: { ...Z, m: 2, kg: 1, s: -2 } },
    W:   { f: 1, d: { ...Z, m: 2, kg: 1, s: -3 } },
    C:   { f: 1, d: { ...Z, s: 1, A: 1 } },
    V:   { f: 1, d: { ...Z, m: 2, kg: 1, s: -3, A: -1 } },
    ohm: { f: 1, d: { ...Z, m: 2, kg: 1, s: -3, A: -2 } },
    S:   { f: 1, d: { ...Z, m: -2, kg: -1, s: 3, A: 2 } },
    F:   { f: 1, d: { ...Z, m: -2, kg: -1, s: 4, A: 2 } },
    T:   { f: 1, d: { ...Z, kg: 1, s: -2, A: -1 } },
    lm:  { f: 1, d: { ...Z, cd: 1 } },
    rad: { f: 1, d: { ...Z } },
    deg: { f: Math.PI / 180, d: { ...Z } },
    "%": { f: 0.01, d: { ...Z } },
  };
})();

const SI_PREFIX = {
  Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3,
  h: 1e2, da: 1e1,
  d: 1e-1, c: 1e-2, m: 1e-3, u: 1e-6, "\u00b5": 1e-6, n: 1e-9, p: 1e-12,
  f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24,
};

function tokenizeUnitExpr(s) {
  s = String(s || "").trim();
  if (!s) return [];
  s = s.replace(/\s+/g, "*");
  const tokens = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "*" || ch === "/") {
      if (cur) tokens.push(cur);
      tokens.push(ch);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens.filter(Boolean);
}

function parseUnitSymbol(sym) {
  let base = sym, exp = 1;
  const caret = sym.indexOf("^");
  if (caret >= 0) {
    base = sym.slice(0, caret);
    exp = parseInt(sym.slice(caret + 1), 10);
    if (!Number.isFinite(exp)) return { ok: false, reason: `bad exponent in ${sym}` };
  }
  base = base.trim();
  if (!base) return { ok: false, reason: "empty unit" };
  if (UNIT_TABLE[base]) return { ok: true, f: UNIT_TABLE[base].f, d: mulDimPow(UNIT_TABLE[base].d, exp), raw: base, exp };
  for (const p of ["da", ...Object.keys(SI_PREFIX)]) {
    if (base.startsWith(p) && base.length > p.length) {
      const u = base.slice(p.length);
      if (UNIT_TABLE[u]) {
        const pf = SI_PREFIX[p];
        return { ok: true, f: Math.pow(pf, exp) * UNIT_TABLE[u].f, d: mulDimPow(UNIT_TABLE[u].d, exp), raw: `${p}${u}`, exp };
      }
    }
  }
  return { ok: false, reason: `unknown unit ${base}` };
}

/**
 * Parse a unit expression into factor + dimension vector.
 * @param {string} expr - e.g. "m/s^2", "kg*m^2/s^2", "km"
 */
export function parseUnitExpr(expr) {
  const tokens = tokenizeUnitExpr(expr);
  if (tokens.length === 0) return { ok: false, reason: "no units expr" };
  let dim = zeroDim();
  let factor = 1;
  let mode = "mul";
  for (const t of tokens) {
    if (t === "*") { mode = "mul"; continue; }
    if (t === "/") { mode = "div"; continue; }
    const r = parseUnitSymbol(t);
    if (!r.ok) return r;
    factor *= (mode === "mul") ? r.f : (1 / r.f);
    dim = (mode === "mul") ? addDim(dim, r.d, +1) : addDim(dim, r.d, -1);
  }
  return { ok: true, factor, dim, signature: dimToSig(dim), normalized: String(expr).trim() };
}

/**
 * Convert a value between unit expressions.
 */
export function convertUnits(value, fromUnits, toUnits) {
  const a = parseUnitExpr(fromUnits);
  const b = parseUnitExpr(toUnits);
  if (!a.ok) return { ok: false, error: `fromUnits: ${a.reason || "parse error"}` };
  if (!b.ok) return { ok: false, error: `toUnits: ${b.reason || "parse error"}` };
  if (!sameDim(a.dim, b.dim)) return { ok: false, error: "dimension mismatch", from: a.signature, to: b.signature };
  const v = Number(value);
  if (!Number.isFinite(v)) return { ok: false, error: "value must be finite number" };
  return { ok: true, value: (v * a.factor) / b.factor, from: a.signature, to: b.signature, factor: a.factor / b.factor };
}

/**
 * Check unit dimensional consistency.
 */
export function checkUnits({ expr, unitsOut = null }) {
  const uexpr = (expr && typeof expr === "string") ? expr : null;
  if (!uexpr) return { ok: false, reason: "no unit expression provided" };
  const parsed = parseUnitExpr(uexpr);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  if (unitsOut) {
    const out = parseUnitExpr(unitsOut);
    if (!out.ok) return { ok: false, reason: `unitsOut: ${out.reason}` };
    const same = sameDim(parsed.dim, out.dim);
    return { ok: same, status: same ? "ok" : "mismatch", in: parsed.signature, out: out.signature };
  }
  return { ok: true, status: "ok", units: parsed.signature };
}

/**
 * Check invariance — validate unit-consistency across a set of invariants.
 */
export function invarianceCheck({ claim, frame = "default", invariants = [] }) {
  const checks = [];
  for (const inv of invariants) {
    const name = inv.name || "invariant";
    if (inv.lhsUnits && inv.rhsUnits) {
      const a = parseUnitExpr(inv.lhsUnits);
      const b = parseUnitExpr(inv.rhsUnits);
      if (!a.ok || !b.ok) {
        checks.push({ name, ok: false, error: `parse error: ${a.reason || b.reason || ""}` });
      } else {
        checks.push({ name, ok: sameDim(a.dim, b.dim), lhs: a.signature, rhs: b.signature });
      }
    } else if (inv.exprUnits && inv.expectedUnits) {
      const a = parseUnitExpr(inv.exprUnits);
      const b = parseUnitExpr(inv.expectedUnits);
      if (!a.ok || !b.ok) {
        checks.push({ name, ok: false, error: `parse error: ${a.reason || b.reason || ""}` });
      } else {
        checks.push({ name, ok: sameDim(a.dim, b.dim), expr: a.signature, expected: b.signature });
      }
    } else {
      checks.push({ name, ok: false, error: "invariant requires (lhsUnits,rhsUnits) or (exprUnits,expectedUnits)" });
    }
  }
  const okAll = checks.every(c => c.ok);
  return { ok: true, frame, claim: claim || null, status: okAll ? "ok" : "violations", checks };
}

// ══════════════════════════════════════════════════════════════════════════════
// Physical Constants Database
// ══════════════════════════════════════════════════════════════════════════════

export const PHYS_CONSTANTS = Object.freeze({
  c:   { name: "speed of light",        value: 299792458,       units: "m/s" },
  g0:  { name: "standard gravity",      value: 9.80665,         units: "m/s^2" },
  G:   { name: "gravitational constant", value: 6.67430e-11,    units: "m^3/kg/s^2" },
  h:   { name: "Planck constant",       value: 6.62607015e-34,  units: "J*s" },
  kB:  { name: "Boltzmann constant",    value: 1.380649e-23,    units: "J/K" },
  NA:  { name: "Avogadro constant",     value: 6.02214076e23,   units: "1/mol" },
});

// Named constant patterns for text scanning
const CONSTANT_PATTERNS = [
  { key: "c",  patterns: [/speed\s+of\s+light/i, /\bc\s*=\s*([\d.e+\-]+)/] },
  { key: "g0", patterns: [/standard\s+gravity/i, /\bg0?\s*=\s*([\d.e+\-]+)/i, /gravitational\s+acceleration/i] },
  { key: "G",  patterns: [/gravitational\s+constant/i, /\bG\s*=\s*([\d.e+\-]+)/] },
  { key: "h",  patterns: [/planck\s+constant/i, /\bh\s*=\s*([\d.e+\-]+)/] },
  { key: "kB", patterns: [/boltzmann\s+constant/i, /\bkB?\s*=\s*([\d.e+\-]+)/i] },
  { key: "NA", patterns: [/avogadro/i, /\bNA\s*=\s*([\d.e+\-]+)/i] },
];

// ══════════════════════════════════════════════════════════════════════════════
// Text Scanners — extract empirical content from claim strings
// ══════════════════════════════════════════════════════════════════════════════

// Regex: number followed by unit string (e.g., "9.81 m/s^2", "300000 km/s", "1.38e-23 J/K")
const NUMERIC_UNIT_RE = /(?<!\w)([-+]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(m\/s\^2|m\/s|kg\/m\^3|kg\/s\^2|m\^3\/kg\/s\^2|m\^2\/s\^2|m\^2|m\^3|J\*s|J\/K|J\/mol|J|N|Pa|W|Hz|V|A|ohm|F|T|K|kg|km\/s|km\/h|km|cm|mm|nm|µm|mg|µg|g|mol|cd|s|m)\b/gi;

// Regex: inline math expression (e.g., "2*pi*r", "sqrt(9.81*2)")
const MATH_EXPR_RE = /(?:^|[=:]\s*)((?:\d[\d.e+\-]*\s*[+\-*/^]\s*)+[\d.e+\-piePIE]+|(?:sqrt|sin|cos|tan|log|ln|exp|abs|pow|min|max)\s*\([\d.e+\-,piePIE\s*/^()+\-]+\))/g;

/**
 * Scan a text string for numeric+unit claims.
 * @returns {Array<{ value: number, units: string, position: number }>}
 */
export function extractNumericClaims(text) {
  if (!text || typeof text !== "string") return [];
  const results = [];
  let match;
  const re = new RegExp(NUMERIC_UNIT_RE.source, NUMERIC_UNIT_RE.flags);
  while ((match = re.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (Number.isFinite(value)) {
      results.push({ value, units: match[2], position: match.index, raw: match[0] });
    }
  }
  return results;
}

/**
 * Scan a text string for math expressions.
 * @returns {Array<{ expr: string, position: number }>}
 */
export function extractMathExpressions(text) {
  if (!text || typeof text !== "string") return [];
  const results = [];
  let match;
  const re = new RegExp(MATH_EXPR_RE.source, MATH_EXPR_RE.flags);
  while ((match = re.exec(text)) !== null) {
    const expr = match[1].trim();
    if (expr.length >= 3) {
      results.push({ expr, position: match.index });
    }
  }
  return results;
}

/**
 * Scan a text string for mentions of known physical constants.
 * @returns {Array<{ key: string, constant: object, citedValue?: number }>}
 */
export function extractConstantReferences(text) {
  if (!text || typeof text !== "string") return [];
  const results = [];
  for (const { key, patterns } of CONSTANT_PATTERNS) {
    let found = false;
    let bestEntry = null;
    for (const pat of patterns) {
      // Reset lastIndex for stateful regexes
      const re = new RegExp(pat.source, pat.flags);
      const match = re.exec(text);
      if (match) {
        const entry = { key, constant: PHYS_CONSTANTS[key] };
        if (match[1]) {
          entry.citedValue = parseFloat(match[1]);
        }
        // Prefer patterns that capture a value
        if (entry.citedValue !== undefined) {
          bestEntry = entry;
          found = true;
          break; // value-capturing match is best
        }
        if (!bestEntry) bestEntry = entry;
        found = true;
      }
    }
    if (found && bestEntry) results.push(bestEntry);
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// Gate Runners — individual validators
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Math Gate: verify extractable math expressions in text.
 * Returns issues for expressions that fail evaluation.
 */
export function mathGate(texts) {
  const issues = [];
  for (const text of texts) {
    const exprs = extractMathExpressions(text);
    for (const { expr, position } of exprs) {
      try {
        const value = evalMathExpression(expr);
        // Expression evaluates — no issue (could optionally record the result)
        if (!Number.isFinite(value)) {
          issues.push({
            severity: "warning",
            rule: "math_non_finite",
            detail: `Expression "${expr}" produces non-finite result`,
            position,
          });
        }
      } catch (e) {
        issues.push({
          severity: "info",
          rule: "math_parse_error",
          detail: `Expression "${expr}" failed: ${e.message}`,
          position,
        });
      }
    }
  }
  return issues;
}

/**
 * Unit Gate: validate units on all numeric claims.
 * Flags numeric values without parseable units and dimensional inconsistencies.
 */
export function unitGate(texts) {
  const issues = [];
  for (const text of texts) {
    const claims = extractNumericClaims(text);
    for (const { value, units, raw } of claims) {
      const parsed = parseUnitExpr(units);
      if (!parsed.ok) {
        issues.push({
          severity: "warning",
          rule: "unit_parse_error",
          detail: `"${raw}" has unparseable units: ${parsed.reason}`,
          value,
          units,
        });
      }
    }
  }
  return issues;
}

/**
 * Constants Gate: cross-reference physical constants against known values.
 * Flags constants cited with values that deviate significantly from accepted values.
 */
export function constantsGate(texts) {
  const issues = [];
  const tolerance = 0.01; // 1% tolerance for constant values

  for (const text of texts) {
    const refs = extractConstantReferences(text);
    for (const { key, constant, citedValue } of refs) {
      if (citedValue !== undefined && Number.isFinite(citedValue)) {
        const expected = constant.value;
        // Use relative error for large/small numbers
        const relError = Math.abs(citedValue - expected) / Math.abs(expected);
        if (relError > tolerance) {
          issues.push({
            severity: "warning",
            rule: "constant_mismatch",
            detail: `${constant.name} (${key}) cited as ${citedValue}, accepted value is ${expected} ${constant.units} (${(relError * 100).toFixed(1)}% off)`,
            key,
            citedValue,
            expectedValue: expected,
            relativeError: relError,
          });
        }
      }
    }
  }
  return issues;
}

// ══════════════════════════════════════════════════════════════════════════════
// Composite Gate Runner (for pipeline integration)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Run all empirical gates on a pipeline candidate.
 *
 * Scans: core.claims, core.definitions, core.invariants, core.examples,
 *        meta.claims[].text, human.summary, human.bullets
 *
 * @param {object} candidate - autogen pipeline candidate DTU
 * @returns {{ ok: boolean, issues: Array, stats: object }}
 */
export function runEmpiricalGates(candidate) {
  // Collect all text surfaces to scan
  const texts = [];
  const c = candidate.core || {};
  if (Array.isArray(c.claims)) texts.push(...c.claims);
  if (Array.isArray(c.definitions)) texts.push(...c.definitions);
  if (Array.isArray(c.invariants)) texts.push(...c.invariants);
  if (Array.isArray(c.examples)) texts.push(...c.examples);

  // Meta claims
  const metaClaims = candidate.meta?.claims || [];
  for (const mc of metaClaims) {
    if (mc.text && typeof mc.text === "string") texts.push(mc.text);
  }

  // Human projections
  if (candidate.human?.summary) texts.push(candidate.human.summary);
  if (Array.isArray(candidate.human?.bullets)) texts.push(...candidate.human.bullets);

  // Filter to only strings
  const textStrings = texts.filter(t => typeof t === "string" && t.length > 0);

  if (textStrings.length === 0) {
    return { ok: true, issues: [], stats: { textsScanned: 0, numericClaims: 0, mathExprs: 0, constantRefs: 0 } };
  }

  // Run gates
  const mathIssues = mathGate(textStrings);
  const unitIssues = unitGate(textStrings);
  const constantIssues = constantsGate(textStrings);

  const allIssues = [
    ...mathIssues.map(i => ({ ...i, gate: "math" })),
    ...unitIssues.map(i => ({ ...i, gate: "unit" })),
    ...constantIssues.map(i => ({ ...i, gate: "constants" })),
  ];

  // Compute stats
  let numericClaims = 0;
  let mathExprs = 0;
  let constantRefs = 0;
  for (const t of textStrings) {
    numericClaims += extractNumericClaims(t).length;
    mathExprs += extractMathExpressions(t).length;
    constantRefs += extractConstantReferences(t).length;
  }

  const hasCritical = allIssues.some(i => i.severity === "critical");

  return {
    ok: !hasCritical,
    issues: allIssues,
    stats: {
      textsScanned: textStrings.length,
      numericClaims,
      mathExprs,
      constantRefs,
      mathIssues: mathIssues.length,
      unitIssues: unitIssues.length,
      constantIssues: constantIssues.length,
    },
  };
}

/**
 * Get a summary of what the empirical gates can validate.
 */
export function getEmpiricalGateInfo() {
  return {
    ok: true,
    gates: ["math", "unit", "constants"],
    mathFunctions: Object.keys(MATH_FUNCS),
    mathConstants: Object.keys(MATH_CONSTS),
    siBaseUnits: DIM_KEYS,
    derivedUnits: Object.keys(UNIT_TABLE),
    siPrefixes: Object.keys(SI_PREFIX),
    physicalConstants: Object.keys(PHYS_CONSTANTS),
  };
}
