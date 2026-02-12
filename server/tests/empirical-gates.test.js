/**
 * Tests for Empirical Gates — Math / Units / Physical Constants Validators
 *
 * Coverage:
 *   1. Math engine (expression evaluation)
 *   2. Unit parsing & dimensional analysis
 *   3. Unit conversion
 *   4. Unit consistency checking
 *   5. Invariance checking
 *   6. Physical constants database
 *   7. Text scanners (numeric claims, math expressions, constant references)
 *   8. Individual gate runners (math, unit, constants)
 *   9. Composite gate runner (runEmpiricalGates)
 *  10. Pipeline integration (critic phase with empirical gates)
 *  11. Gate info
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evalMathExpression, parseUnitExpr, convertUnits,
  checkUnits, invarianceCheck,
  PHYS_CONSTANTS,
  extractNumericClaims, extractMathExpressions, extractConstantReferences,
  mathGate, unitGate, constantsGate,
  runEmpiricalGates, getEmpiricalGateInfo,
} from "../emergent/empirical-gates.js";

import {
  criticPhase,
} from "../emergent/autogen-pipeline.js";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Math Engine
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Math Engine", () => {
  it("evaluates basic arithmetic", () => {
    assert.equal(evalMathExpression("2+3"), 5);
    assert.equal(evalMathExpression("10-4"), 6);
    assert.equal(evalMathExpression("3*7"), 21);
    assert.equal(evalMathExpression("15/3"), 5);
  });

  it("handles operator precedence", () => {
    assert.equal(evalMathExpression("2+3*4"), 14);
    assert.equal(evalMathExpression("(2+3)*4"), 20);
  });

  it("supports exponentiation", () => {
    assert.equal(evalMathExpression("2^10"), 1024);
    assert.equal(evalMathExpression("3^2"), 9);
  });

  it("supports math functions", () => {
    assert.ok(Math.abs(evalMathExpression("sqrt(144)") - 12) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("abs(-5)") - 5) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("sin(0)") - 0) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("cos(0)") - 1) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("log(100)") - 2) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("exp(0)") - 1) < 1e-10);
  });

  it("supports math constants", () => {
    assert.ok(Math.abs(evalMathExpression("pi") - Math.PI) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("e") - Math.E) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("2*pi") - 2 * Math.PI) < 1e-10);
  });

  it("handles unary minus", () => {
    assert.equal(evalMathExpression("-5"), -5);
    assert.equal(evalMathExpression("-2+3"), 1);
    assert.equal(evalMathExpression("(-2)*3"), -6);
  });

  it("handles decimals and scientific notation", () => {
    assert.ok(Math.abs(evalMathExpression("1.5+2.5") - 4) < 1e-10);
    assert.ok(Math.abs(evalMathExpression("3e2") - 300) < 1e-10);
  });

  it("throws on invalid expressions", () => {
    assert.throws(() => evalMathExpression("2++3"));
    assert.throws(() => evalMathExpression("abc"));
    assert.throws(() => evalMathExpression(""));
  });

  it("throws on non-finite results", () => {
    assert.throws(() => evalMathExpression("1/0"));
  });

  it("handles nested functions", () => {
    assert.ok(Math.abs(evalMathExpression("sqrt(pow(3,2)+pow(4,2))") - 5) < 1e-10);
  });

  it("handles min/max", () => {
    assert.equal(evalMathExpression("min(3,7)"), 3);
    assert.equal(evalMathExpression("max(3,7)"), 7);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Unit Parsing & Dimensional Analysis
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Unit Parsing", () => {
  it("parses SI base units", () => {
    const r = parseUnitExpr("m");
    assert.equal(r.ok, true);
    assert.equal(r.dim.m, 1);
    assert.equal(r.factor, 1);
  });

  it("parses derived units", () => {
    const r = parseUnitExpr("N");
    assert.equal(r.ok, true);
    assert.equal(r.dim.m, 1);
    assert.equal(r.dim.kg, 1);
    assert.equal(r.dim.s, -2);
  });

  it("parses compound units with division", () => {
    const r = parseUnitExpr("m/s^2");
    assert.equal(r.ok, true);
    assert.equal(r.dim.m, 1);
    assert.equal(r.dim.s, -2);
  });

  it("parses compound units with multiplication", () => {
    const r = parseUnitExpr("kg*m^2/s^2");
    assert.equal(r.ok, true);
    assert.equal(r.dim.kg, 1);
    assert.equal(r.dim.m, 2);
    assert.equal(r.dim.s, -2);
  });

  it("handles SI prefixes", () => {
    const r = parseUnitExpr("km");
    assert.equal(r.ok, true);
    assert.equal(r.dim.m, 1);
    assert.equal(r.factor, 1000);
  });

  it("handles cm, mm, nm", () => {
    assert.equal(parseUnitExpr("cm").factor, 0.01);
    assert.equal(parseUnitExpr("mm").factor, 0.001);
    assert.ok(Math.abs(parseUnitExpr("nm").factor - 1e-9) < 1e-15);
  });

  it("rejects unknown units", () => {
    const r = parseUnitExpr("quux");
    assert.equal(r.ok, false);
  });

  it("handles time units", () => {
    assert.equal(parseUnitExpr("s").factor, 1);
    assert.equal(parseUnitExpr("min").factor, 60);
    assert.equal(parseUnitExpr("h").factor, 3600);
  });

  it("handles Hz", () => {
    const r = parseUnitExpr("Hz");
    assert.equal(r.ok, true);
    assert.equal(r.dim.s, -1);
  });

  it("parses J*s (Planck constant units)", () => {
    const r = parseUnitExpr("J*s");
    assert.equal(r.ok, true);
    assert.equal(r.dim.m, 2);
    assert.equal(r.dim.kg, 1);
    assert.equal(r.dim.s, -1); // J = m^2*kg*s^-2; J*s = m^2*kg*s^-1
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Unit Conversion
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Unit Conversion", () => {
  it("converts km to m", () => {
    const r = convertUnits(5, "km", "m");
    assert.equal(r.ok, true);
    assert.equal(r.value, 5000);
  });

  it("converts m/s to km/h", () => {
    const r = convertUnits(1, "m/s", "km/h");
    assert.equal(r.ok, true);
    assert.ok(Math.abs(r.value - 3.6) < 1e-10);
  });

  it("rejects dimension mismatch", () => {
    const r = convertUnits(1, "m", "s");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("mismatch"));
  });

  it("converts g to kg", () => {
    const r = convertUnits(1000, "g", "kg");
    assert.equal(r.ok, true);
    assert.ok(Math.abs(r.value - 1) < 1e-10);
  });

  it("converts h to s", () => {
    const r = convertUnits(1, "h", "s");
    assert.equal(r.ok, true);
    assert.equal(r.value, 3600);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Unit Consistency Check
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — checkUnits", () => {
  it("validates a unit expression alone", () => {
    const r = checkUnits({ expr: "m/s^2" });
    assert.equal(r.ok, true);
    assert.equal(r.status, "ok");
  });

  it("validates matching unitsOut", () => {
    const r = checkUnits({ expr: "N", unitsOut: "kg*m/s^2" });
    assert.equal(r.ok, true);
    assert.equal(r.status, "ok");
  });

  it("flags mismatched unitsOut", () => {
    const r = checkUnits({ expr: "N", unitsOut: "J" });
    assert.equal(r.ok, false);
    assert.equal(r.status, "mismatch");
  });

  it("rejects unparseable units", () => {
    const r = checkUnits({ expr: "foobar" });
    assert.equal(r.ok, false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Invariance Checking
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Invariance Check", () => {
  it("validates consistent lhs/rhs units", () => {
    const r = invarianceCheck({
      claim: "F = ma",
      invariants: [{ name: "Newton's second law", lhsUnits: "N", rhsUnits: "kg*m/s^2" }],
    });
    assert.equal(r.status, "ok");
    assert.ok(r.checks[0].ok);
  });

  it("flags inconsistent lhs/rhs units", () => {
    const r = invarianceCheck({
      claim: "bad equation",
      invariants: [{ name: "wrong", lhsUnits: "N", rhsUnits: "J" }],
    });
    assert.equal(r.status, "violations");
    assert.equal(r.checks[0].ok, false);
  });

  it("handles multiple invariants", () => {
    const r = invarianceCheck({
      invariants: [
        { name: "energy", lhsUnits: "J", rhsUnits: "kg*m^2/s^2" },
        { name: "power", lhsUnits: "W", rhsUnits: "J/s" },
      ],
    });
    assert.equal(r.status, "ok");
    assert.equal(r.checks.length, 2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Physical Constants
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Physical Constants", () => {
  it("includes speed of light", () => {
    assert.equal(PHYS_CONSTANTS.c.value, 299792458);
    assert.equal(PHYS_CONSTANTS.c.units, "m/s");
  });

  it("includes standard gravity", () => {
    assert.equal(PHYS_CONSTANTS.g0.value, 9.80665);
    assert.equal(PHYS_CONSTANTS.g0.units, "m/s^2");
  });

  it("includes Planck constant", () => {
    assert.equal(PHYS_CONSTANTS.h.value, 6.62607015e-34);
  });

  it("includes Boltzmann constant", () => {
    assert.equal(PHYS_CONSTANTS.kB.value, 1.380649e-23);
  });

  it("includes Avogadro constant", () => {
    assert.equal(PHYS_CONSTANTS.NA.value, 6.02214076e23);
  });

  it("includes gravitational constant", () => {
    assert.ok(Math.abs(PHYS_CONSTANTS.G.value - 6.67430e-11) < 1e-15);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Text Scanners
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Text Scanners", () => {
  it("extracts numeric claims with units", () => {
    const r = extractNumericClaims("The speed was 9.81 m/s^2 and distance was 100 km");
    assert.ok(r.length >= 2);
    assert.ok(r.some(c => c.value === 9.81 && c.units === "m/s^2"));
    assert.ok(r.some(c => c.value === 100 && c.units === "km"));
  });

  it("handles scientific notation in claims", () => {
    const r = extractNumericClaims("Planck constant h = 6.626e-34 J");
    assert.ok(r.length >= 1);
    assert.ok(r.some(c => Math.abs(c.value - 6.626e-34) < 1e-37));
  });

  it("extracts math expressions", () => {
    const r = extractMathExpressions("The result is: sqrt(9.81*2) and also = 2*3.14*5");
    assert.ok(r.length >= 1);
  });

  it("extracts constant references", () => {
    const r = extractConstantReferences("The speed of light is approximately 3e8 m/s");
    assert.ok(r.length >= 1);
    assert.equal(r[0].key, "c");
  });

  it("extracts Boltzmann constant reference", () => {
    const r = extractConstantReferences("Boltzmann constant kB = 1.38e-23");
    assert.ok(r.length >= 1);
    assert.equal(r[0].key, "kB");
  });

  it("returns empty for non-empirical text", () => {
    const r = extractNumericClaims("This is a purely philosophical statement about existence.");
    assert.equal(r.length, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. Individual Gate Runners
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Gate Runners", () => {
  it("mathGate passes valid expressions", () => {
    const issues = mathGate(["result is: 2*3+1"]);
    // No critical issues for valid math
    assert.ok(!issues.some(i => i.severity === "critical"));
  });

  it("unitGate validates unit strings", () => {
    const issues = unitGate(["The force was 10 N and acceleration 9.81 m/s^2"]);
    assert.equal(issues.length, 0); // N and m/s^2 are valid
  });

  it("constantsGate flags incorrect constant values", () => {
    const issues = constantsGate(["speed of light c = 500000000"]);
    // 500000000 vs 299792458 — should flag
    assert.ok(issues.length > 0);
    assert.ok(issues[0].rule === "constant_mismatch");
  });

  it("constantsGate passes correct constant values", () => {
    const issues = constantsGate(["speed of light c = 299792458"]);
    assert.equal(issues.length, 0);
  });

  it("constantsGate passes approximately correct values", () => {
    // 3e8 is ~0.07% off, within 1% tolerance
    const issues = constantsGate(["speed of light c = 300000000"]);
    assert.equal(issues.length, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. Composite Gate Runner
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — runEmpiricalGates", () => {
  it("returns clean for non-empirical candidate", () => {
    const candidate = {
      title: "Philosophy of knowledge",
      core: {
        definitions: ["Knowledge is justified true belief"],
        invariants: ["All claims must be evaluated"],
        claims: ["Understanding precedes wisdom"],
      },
      meta: { claims: [] },
      human: { summary: "A philosophical exploration" },
    };
    const r = runEmpiricalGates(candidate);
    assert.equal(r.ok, true);
    assert.equal(r.issues.length, 0);
  });

  it("detects numeric claims in candidate", () => {
    const candidate = {
      title: "Physics basics",
      core: {
        definitions: ["Gravity acceleration is 9.81 m/s^2"],
        claims: ["Light travels at 300000 km/s"],
      },
      meta: {},
    };
    const r = runEmpiricalGates(candidate);
    assert.ok(r.stats.numericClaims >= 1);
  });

  it("flags incorrect physical constant", () => {
    const candidate = {
      title: "Physics",
      core: {
        claims: ["The speed of light c = 100000000"],
      },
      meta: {},
    };
    const r = runEmpiricalGates(candidate);
    assert.ok(r.issues.some(i => i.gate === "constants"));
  });

  it("returns stats shape", () => {
    const candidate = {
      title: "Test",
      core: { definitions: ["test"] },
      meta: {},
    };
    const r = runEmpiricalGates(candidate);
    assert.ok("textsScanned" in r.stats);
    assert.ok("numericClaims" in r.stats);
    assert.ok("mathExprs" in r.stats);
    assert.ok("constantRefs" in r.stats);
    assert.ok("mathIssues" in r.stats);
    assert.ok("unitIssues" in r.stats);
    assert.ok("constantIssues" in r.stats);
  });

  it("handles empty candidate gracefully", () => {
    const r = runEmpiricalGates({});
    assert.equal(r.ok, true);
    assert.equal(r.issues.length, 0);
    assert.equal(r.stats.textsScanned, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. Pipeline Integration (critic phase with empirical gates)
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Pipeline Critic Integration", () => {
  it("critic phase includes empiricalStats", () => {
    const candidate = {
      title: "Test DTU with physics",
      core: {
        definitions: ["Gravity is 9.81 m/s^2"],
        invariants: ["F = ma"],
        claims: ["Speed of sound is 343 m/s"],
      },
      meta: {
        claims: [{ text: "Speed is 343 m/s", support: ["dtu_1"], confidence: 0.9, type: "fact" }],
      },
    };
    const result = criticPhase(candidate, {});
    assert.ok(result.empiricalStats);
    assert.ok("textsScanned" in result.empiricalStats);
    assert.ok(result.empiricalStats.textsScanned > 0);
  });

  it("critic flags empirical issues for wrong constant", () => {
    const candidate = {
      title: "Bad physics",
      core: {
        definitions: ["Def"],
        invariants: ["Inv"],
        examples: ["Ex"],
        claims: ["The speed of light c = 100000"],
      },
      meta: {
        claims: [{ text: "speed of light c = 100000", support: ["dtu_1"], confidence: 0.9, type: "fact" }],
      },
    };
    const result = criticPhase(candidate, {});
    const empiricalIssues = result.issues.filter(i => i.gate);
    assert.ok(empiricalIssues.length > 0);
    assert.ok(empiricalIssues.some(i => i.rule.includes("constant_mismatch")));
  });

  it("critic passes clean empirical candidate", () => {
    const candidate = {
      title: "Correct physics DTU",
      core: {
        definitions: ["Standard gravity is 9.80665 m/s^2"],
        invariants: ["All measurements must include units"],
        examples: ["Weight = 10 kg * 9.81 m/s^2 = 98.1 N"],
        claims: ["Earth gravity is approximately 9.81 m/s^2"],
      },
      meta: {
        claims: [{ text: "Earth gravity is approximately 9.81 m/s^2", support: ["dtu_phys"], confidence: 0.95, type: "fact" }],
      },
    };
    const result = criticPhase(candidate, {});
    const empiricalIssues = result.issues.filter(i => i.gate);
    assert.equal(empiricalIssues.length, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. Gate Info
// ══════════════════════════════════════════════════════════════════════════════

describe("Empirical Gates — Info", () => {
  it("returns supported gates", () => {
    const info = getEmpiricalGateInfo();
    assert.equal(info.ok, true);
    assert.deepEqual(info.gates, ["math", "unit", "constants"]);
  });

  it("lists math functions", () => {
    const info = getEmpiricalGateInfo();
    assert.ok(info.mathFunctions.includes("sqrt"));
    assert.ok(info.mathFunctions.includes("sin"));
    assert.ok(info.mathFunctions.includes("cos"));
  });

  it("lists SI base units", () => {
    const info = getEmpiricalGateInfo();
    assert.deepEqual(info.siBaseUnits, ["m", "kg", "s", "A", "K", "mol", "cd"]);
  });

  it("lists physical constants", () => {
    const info = getEmpiricalGateInfo();
    assert.ok(info.physicalConstants.includes("c"));
    assert.ok(info.physicalConstants.includes("G"));
    assert.ok(info.physicalConstants.includes("h"));
  });

  it("lists derived units", () => {
    const info = getEmpiricalGateInfo();
    assert.ok(info.derivedUnits.includes("N"));
    assert.ok(info.derivedUnits.includes("J"));
    assert.ok(info.derivedUnits.includes("W"));
    assert.ok(info.derivedUnits.includes("Pa"));
  });
});
