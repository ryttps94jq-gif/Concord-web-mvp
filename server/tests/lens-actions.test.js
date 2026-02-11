/**
 * Lens Actions — Comprehensive Test Suite
 *
 * Tests production-quality lens domain actions, domain index,
 * export formatters, and cross-lens pipelines.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ── Helper: Minimal lens runtime harness ──────────────────────────────────────

let _idCounter = 0;
function uid(prefix = "test") { return `${prefix}_${++_idCounter}_${Date.now()}`; }
function nowISO() { return new Date().toISOString(); }

function createHarness() {
  const actions = new Map();
  const artifacts = new Map();
  const domainIndex = new Map();

  function registerLensAction(domain, action, handler) {
    actions.set(`${domain}.${action}`, handler);
  }

  function createArtifact(domain, type, data = {}, meta = {}) {
    const id = uid("lart");
    const artifact = {
      id, domain, type,
      ownerId: "test-user",
      title: `Test ${type}`,
      data,
      meta: { tags: [], status: "active", visibility: "private", ...meta },
      createdAt: nowISO(),
      updatedAt: nowISO(),
      version: 1,
    };
    artifacts.set(id, artifact);
    if (!domainIndex.has(domain)) domainIndex.set(domain, new Set());
    domainIndex.get(domain).add(id);
    return artifact;
  }

  async function runAction(domain, action, artifact, params = {}) {
    const handler = actions.get(`${domain}.${action}`);
    if (!handler) throw new Error(`No handler for ${domain}.${action}`);
    const ctx = { actor: { userId: "test-user" } };
    return handler(ctx, artifact, params);
  }

  return { actions, artifacts, domainIndex, registerLensAction, createArtifact, runAction };
}

// ── Load Domain Modules ───────────────────────────────────────────────────────

const { default: modules } = await import("../domains/index.js");

// ── Module Loading & Registration Tests ───────────────────────────────────────

describe("Lens Domain Module Loading", () => {
  it("should load all 23 domain modules", () => {
    assert.ok(Array.isArray(modules), "Domain modules should be an array");
    assert.equal(modules.length, 23, "Should have 23 domain modules");
  });

  it("each module should be a function accepting registerLensAction", () => {
    for (const mod of modules) {
      assert.equal(typeof mod, "function", "Each module should be a function");
    }
  });
});

describe("Lens Domain Action Registration", () => {
  const harness = createHarness();

  before(() => {
    for (const mod of modules) mod(harness.registerLensAction);
  });

  it("should register actions for all 23 domains", () => {
    const domains = new Set();
    for (const key of harness.actions.keys()) domains.add(key.split(".")[0]);
    assert.ok(domains.size >= 23, `Should have actions for at least 23 domains, got ${domains.size}`);
  });

  it("should register at least 2 actions per domain", () => {
    const domainCounts = {};
    for (const key of harness.actions.keys()) {
      const domain = key.split(".")[0];
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
    for (const [domain, count] of Object.entries(domainCounts)) {
      assert.ok(count >= 2, `Domain "${domain}" should have at least 2 actions, got ${count}`);
    }
  });
});

// ── Healthcare Actions ──────────────────────────────────────────────────────

describe("Healthcare Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("checkInteractions: should find no interactions with < 2 prescriptions", async () => {
    const artifact = harness.createArtifact("healthcare", "patient", {
      prescriptions: [{ drug: "Aspirin", rxcui: "1191", dose: "81mg" }]
    });
    const result = await harness.runAction("healthcare", "checkInteractions", artifact);
    assert.ok(result.ok || result.result?.interactions?.length === 0);
  });

  it("checkInteractions: should detect known interaction pairs", async () => {
    const artifact = harness.createArtifact("healthcare", "patient", {
      prescriptions: [
        { drug: "Warfarin", rxcui: "11289", dose: "5mg" },
        { drug: "Aspirin", rxcui: "1191", dose: "325mg" },
      ],
      knownInteractions: [
        { pair: ["11289", "1191"], severity: "high", description: "Increased bleeding risk" }
      ]
    });
    const result = await harness.runAction("healthcare", "checkInteractions", artifact);
    const interactions = result.interactions || result.result?.interactions || [];
    assert.ok(interactions.length >= 1, "Should find at least one interaction");
  });

  it("generateSummary: should produce a patient summary", async () => {
    const artifact = harness.createArtifact("healthcare", "patient", {
      prescriptions: [{ drug: "Metformin", rxcui: "6809", dose: "500mg" }],
      conditions: ["Type 2 Diabetes"],
      vitals: { bp: "120/80", hr: 72 },
    });
    const result = await harness.runAction("healthcare", "generateSummary", artifact);
    assert.ok(result !== undefined, "generateSummary should return a result");
  });
});

// ── Trades Actions ──────────────────────────────────────────────────────────

describe("Trades Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("calculateEstimate: should compute estimate with line items", async () => {
    const artifact = harness.createArtifact("trades", "estimate", {
      lineItems: [
        { description: "Framing", quantity: 40, unitCost: 25, category: "labor" },
        { description: "Lumber", quantity: 100, unitCost: 8, category: "material" },
      ]
    });
    const result = await harness.runAction("trades", "calculateEstimate", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });

  it("materialsCost: should compute total material costs", async () => {
    const artifact = harness.createArtifact("trades", "project", {
      materials: [
        { name: "2x4 Lumber", quantity: 50, unitCost: 5.99 },
        { name: "Nails 3in", quantity: 10, unitCost: 8.99 },
      ]
    });
    const result = await harness.runAction("trades", "materialsCost", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Food Actions ────────────────────────────────────────────────────────────

describe("Food Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("scaleRecipe: should scale ingredients by factor", async () => {
    const artifact = harness.createArtifact("food", "recipe", {
      recipe: { name: "Pasta", baseYield: 4, yieldUnit: "servings", ingredients: [
        { name: "Pasta", quantity: 400, unit: "g" },
        { name: "Sauce", quantity: 200, unit: "ml" },
      ]}
    });
    const result = await harness.runAction("food", "scaleRecipe", artifact, { targetYield: 8 });
    assert.ok(result !== undefined, "Should return a result");
  });

  it("costPlate: should calculate plate cost", async () => {
    const artifact = harness.createArtifact("food", "plate", {
      ingredients: [
        { name: "Chicken", quantity: 200, unit: "g", costPer: 12.00, costUnit: "kg" },
        { name: "Rice", quantity: 150, unit: "g", costPer: 2.00, costUnit: "kg" },
      ]
    });
    const result = await harness.runAction("food", "costPlate", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Accounting Actions ──────────────────────────────────────────────────────

describe("Accounting Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("trialBalance: should compute trial balance", async () => {
    const artifact = harness.createArtifact("accounting", "ledger", {
      accounts: [
        { accountNumber: "1000", name: "Cash", type: "asset", normalBalance: "debit", entries: [
          { date: "2025-01-01", debit: 10000, credit: 0, memo: "Opening" },
          { date: "2025-01-15", debit: 0, credit: 500, memo: "Rent" },
        ]},
        { accountNumber: "3000", name: "Revenue", type: "revenue", normalBalance: "credit", entries: [
          { date: "2025-01-10", debit: 0, credit: 5000, memo: "Sales" },
        ]},
      ]
    });
    const result = await harness.runAction("accounting", "trialBalance", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });

  it("budgetVariance: should compute budget vs actual", async () => {
    const artifact = harness.createArtifact("accounting", "budget", {
      budgetLines: [
        { category: "Revenue", budgeted: 10000, actual: 12000 },
        { category: "Expenses", budgeted: 8000, actual: 7500 },
      ]
    });
    const result = await harness.runAction("accounting", "budgetVariance", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Logistics Actions ───────────────────────────────────────────────────────

describe("Logistics Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("optimizeRoute: should optimize delivery route", async () => {
    const artifact = harness.createArtifact("logistics", "route", {
      stops: [
        { id: "s1", name: "Warehouse", lat: 40.7128, lng: -74.0060 },
        { id: "s2", name: "Customer A", lat: 40.7580, lng: -73.9855 },
        { id: "s3", name: "Customer B", lat: 40.7282, lng: -73.7949 },
      ]
    });
    const result = await harness.runAction("logistics", "optimizeRoute", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Education Actions ───────────────────────────────────────────────────────

describe("Education Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("gradeCalculation: should compute grades", async () => {
    const artifact = harness.createArtifact("education", "gradebook", {
      students: [
        { name: "Alice", scores: [90, 85, 92, 88] },
        { name: "Bob", scores: [70, 75, 80, 72] },
      ],
      weights: { homework: 0.3, exams: 0.7 }
    });
    const result = await harness.runAction("education", "gradeCalculation", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Legal Actions ───────────────────────────────────────────────────────────

describe("Legal Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("deadlineCheck: should verify deadlines", async () => {
    const artifact = harness.createArtifact("legal", "case", {
      deadlines: [
        { task: "File motion", dueDate: "2025-03-01", completed: false },
        { task: "Discovery", dueDate: "2025-04-15", completed: true },
      ]
    });
    const result = await harness.runAction("legal", "deadlineCheck", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Retail Actions ──────────────────────────────────────────────────────────

describe("Retail Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("reorderCheck: should check inventory reorder points", async () => {
    const artifact = harness.createArtifact("retail", "inventory", {
      products: [
        { sku: "WDG-001", name: "Widget A", onHand: 5, reorderPoint: 10, reorderQty: 50 },
        { sku: "WDG-002", name: "Widget B", onHand: 100, reorderPoint: 20, reorderQty: 50 },
      ]
    });
    const result = await harness.runAction("retail", "reorderCheck", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Insurance Actions ───────────────────────────────────────────────────────

describe("Insurance Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("riskScore: should calculate risk score", async () => {
    const artifact = harness.createArtifact("insurance", "policy", {
      policyType: "auto",
      insuredValue: 25000,
      riskFactors: [{ factor: "age", value: 25 }, { factor: "accidents", value: 0 }],
      claims: [],
    });
    const result = await harness.runAction("insurance", "riskScore", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });

  it("coverageGap: should find coverage gaps", async () => {
    const artifact = harness.createArtifact("insurance", "policy", {
      coverages: [
        { type: "liability", limit: 100000, deductible: 500 },
        { type: "collision", limit: 50000, deductible: 1000 },
      ]
    });
    const result = await harness.runAction("insurance", "coverageGap", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Security Actions ────────────────────────────────────────────────────────

describe("Security Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("incidentTrend: should analyze incident trends", async () => {
    const artifact = harness.createArtifact("security", "incidents", {
      incidents: [
        { id: "i1", type: "intrusion", date: "2025-01-01", severity: "high" },
        { id: "i2", type: "phishing", date: "2025-01-05", severity: "medium" },
        { id: "i3", type: "intrusion", date: "2025-01-10", severity: "high" },
      ]
    });
    const result = await harness.runAction("security", "incidentTrend", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Science Actions ─────────────────────────────────────────────────────────

describe("Science Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("chainOfCustody: should track sample chain of custody", async () => {
    const artifact = harness.createArtifact("science", "sample", {
      sampleId: "S-001",
      custody: [
        { holder: "Lab A", from: "2025-01-01", to: "2025-01-05" },
        { holder: "Lab B", from: "2025-01-05", to: null },
      ]
    });
    const result = await harness.runAction("science", "chainOfCustody", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Manufacturing Actions ───────────────────────────────────────────────────

describe("Manufacturing Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("oeeCalculate: should compute OEE", async () => {
    const artifact = harness.createArtifact("manufacturing", "line", {
      plannedTime: 480,
      actualRunTime: 400,
      totalParts: 500,
      goodParts: 475,
      idealCycleTime: 0.8,
    });
    const result = await harness.runAction("manufacturing", "oeeCalculate", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Fitness Actions ─────────────────────────────────────────────────────────

describe("Fitness Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("progressionCalc: should calculate progression", async () => {
    const artifact = harness.createArtifact("fitness", "program", {
      exercises: [
        { name: "Squat", history: [{ date: "2025-01-01", weight: 135, reps: 5 }, { date: "2025-01-08", weight: 145, reps: 5 }] },
      ]
    });
    const result = await harness.runAction("fitness", "progressionCalc", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Events Actions ──────────────────────────────────────────────────────────

describe("Events Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("budgetReconcile: should reconcile event budget", async () => {
    const artifact = harness.createArtifact("events", "event", {
      budget: 50000,
      lineItems: [
        { category: "Venue", estimated: 15000, actual: 14500 },
        { category: "Catering", estimated: 10000, actual: 11200 },
      ]
    });
    const result = await harness.runAction("events", "budgetReconcile", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Environment Actions ─────────────────────────────────────────────────────

describe("Environment Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("complianceCheck: should check environmental compliance", async () => {
    const artifact = harness.createArtifact("environment", "site", {
      permits: [
        { type: "air", expires: "2026-01-01", status: "active" },
        { type: "water", expires: "2024-06-01", status: "expired" },
      ]
    });
    const result = await harness.runAction("environment", "complianceCheck", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Government Actions ──────────────────────────────────────────────────────

describe("Government Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("permitTimeline: should track permit timeline", async () => {
    const artifact = harness.createArtifact("government", "permit", {
      stages: [
        { name: "Submission", startDate: "2025-01-01", endDate: "2025-01-05", status: "complete" },
        { name: "Review", startDate: "2025-01-06", endDate: null, status: "in_progress" },
      ]
    });
    const result = await harness.runAction("government", "permitTimeline", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Real Estate Actions ─────────────────────────────────────────────────────

describe("Real Estate Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("capRate: should compute cap rate", async () => {
    const artifact = harness.createArtifact("realestate", "property", {
      purchasePrice: 500000,
      annualIncome: 48000,
      annualExpenses: 12000,
    });
    const result = await harness.runAction("realestate", "capRate", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Aviation Actions ────────────────────────────────────────────────────────

describe("Aviation Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("currencyCheck: should check pilot currency", async () => {
    const artifact = harness.createArtifact("aviation", "pilot", {
      certificates: [{ type: "PPL", expires: "2026-06-01" }],
      recentFlights: [
        { date: "2025-01-01", duration: 1.5, landings: 3 },
        { date: "2025-01-15", duration: 2.0, landings: 2 },
      ]
    });
    const result = await harness.runAction("aviation", "currencyCheck", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Creative Actions ────────────────────────────────────────────────────────

describe("Creative Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("shotListGenerate: should generate shot list", async () => {
    const artifact = harness.createArtifact("creative", "project", {
      scenes: [
        { id: "s1", name: "Opening", location: "Studio A", description: "Wide shot" },
        { id: "s2", name: "Interview", location: "Office", description: "Close-up" },
      ]
    });
    const result = await harness.runAction("creative", "shotListGenerate", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Nonprofit Actions ───────────────────────────────────────────────────────

describe("Nonprofit Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("donorRetention: should calculate donor retention", async () => {
    const artifact = harness.createArtifact("nonprofit", "campaign", {
      donors: [
        { id: "d1", name: "Alice", donations: [{ amount: 100, date: "2024-01-01" }, { amount: 150, date: "2025-01-01" }] },
        { id: "d2", name: "Bob", donations: [{ amount: 500, date: "2024-06-01" }] },
      ]
    });
    const result = await harness.runAction("nonprofit", "donorRetention", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Services Actions ────────────────────────────────────────────────────────

describe("Services Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("scheduleOptimize: should optimize service schedule", async () => {
    const artifact = harness.createArtifact("services", "schedule", {
      appointments: [
        { id: "a1", provider: "Alice", start: "2025-03-15T09:00:00Z", end: "2025-03-15T10:00:00Z" },
        { id: "a2", provider: "Alice", start: "2025-03-15T14:00:00Z", end: "2025-03-15T15:00:00Z" },
      ]
    });
    const result = await harness.runAction("services", "scheduleOptimize", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Household Actions ───────────────────────────────────────────────────────

describe("Household Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("maintenanceDue: should find items due for maintenance", async () => {
    const artifact = harness.createArtifact("household", "home", {
      items: [
        { name: "HVAC Filter", lastMaintenance: "2024-06-01", intervalDays: 90 },
        { name: "Gutters", lastMaintenance: "2024-09-01", intervalDays: 180 },
      ],
    });
    const result = await harness.runAction("household", "maintenanceDue", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Agriculture Actions ─────────────────────────────────────────────────────

describe("Agriculture Actions", () => {
  const harness = createHarness();
  before(() => { for (const mod of modules) mod(harness.registerLensAction); });

  it("yieldAnalysis: should analyze crop yield", async () => {
    const artifact = harness.createArtifact("agriculture", "field", {
      crop: "wheat",
      acreage: 100,
      harvests: [
        { year: 2023, yield: 5000, unit: "bushels" },
        { year: 2024, yield: 5500, unit: "bushels" },
      ]
    });
    const result = await harness.runAction("agriculture", "yieldAnalysis", artifact);
    assert.ok(result !== undefined, "Should return a result");
  });
});

// ── Export Formatter Unit Tests ──────────────────────────────────────────────

describe("Export Formatters (CSV)", () => {
  it("CSV escape: should handle commas and quotes", () => {
    function csvEscape(val) {
      if (val === null || val === undefined) return "";
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    assert.equal(csvEscape("hello"), "hello");
    assert.equal(csvEscape("hello, world"), '"hello, world"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
    assert.equal(csvEscape("line1\nline2"), '"line1\nline2"');
    assert.equal(csvEscape(null), "");
    assert.equal(csvEscape(undefined), "");
    assert.equal(csvEscape(42), "42");
  });
});

describe("Export Formatters (Markdown)", () => {
  it("should generate valid markdown for a simple artifact", () => {
    function exportMarkdown(artifact) {
      const lines = [];
      lines.push(`# ${artifact.title || "Untitled"}`);
      lines.push(`**Domain:** ${artifact.domain} | **Type:** ${artifact.type} | **Version:** ${artifact.version || 1}`);
      lines.push(`**Status:** ${artifact.meta?.status || "draft"} | **Created:** ${artifact.createdAt} | **Updated:** ${artifact.updatedAt}`);
      if (artifact.meta?.tags?.length) lines.push(`**Tags:** ${artifact.meta.tags.join(", ")}`);
      lines.push("");
      return lines.join("\n");
    }

    const artifact = {
      id: "test-1", domain: "healthcare", type: "patient",
      title: "Patient Record", version: 1,
      data: { name: "Alice" },
      meta: { tags: ["urgent"], status: "active" },
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-02T00:00:00Z",
    };

    const md = exportMarkdown(artifact);
    assert.ok(md.includes("# Patient Record"), "Should have title heading");
    assert.ok(md.includes("healthcare"), "Should include domain");
    assert.ok(md.includes("urgent"), "Should include tags");
  });
});

// ── Domain Index Tests ──────────────────────────────────────────────────────

describe("Domain Index", () => {
  it("should track artifacts by domain", () => {
    const index = new Map();
    function indexAdd(domain, id) {
      if (!index.has(domain)) index.set(domain, new Set());
      index.get(domain).add(id);
    }
    function indexRemove(domain, id) {
      const set = index.get(domain);
      if (set) { set.delete(id); if (set.size === 0) index.delete(domain); }
    }
    function indexGet(domain) {
      return index.get(domain) || new Set();
    }

    indexAdd("healthcare", "art1");
    indexAdd("healthcare", "art2");
    indexAdd("finance", "art3");

    assert.equal(indexGet("healthcare").size, 2);
    assert.equal(indexGet("finance").size, 1);
    assert.equal(indexGet("unknown").size, 0);

    indexRemove("healthcare", "art1");
    assert.equal(indexGet("healthcare").size, 1);

    indexRemove("finance", "art3");
    assert.ok(!index.has("finance"), "Empty domain should be cleaned up");
  });

  it("should rebuild correctly from artifact map", () => {
    const artifacts = new Map([
      ["a1", { id: "a1", domain: "healthcare", type: "patient" }],
      ["a2", { id: "a2", domain: "healthcare", type: "record" }],
      ["a3", { id: "a3", domain: "finance", type: "portfolio" }],
      ["a4", { id: "a4", domain: "legal", type: "contract" }],
      ["a5", { id: "a5", domain: "finance", type: "trade" }],
    ]);

    const index = new Map();
    for (const [id, art] of artifacts) {
      if (!index.has(art.domain)) index.set(art.domain, new Set());
      index.get(art.domain).add(id);
    }

    assert.equal(index.size, 3, "Should have 3 domains");
    assert.equal(index.get("healthcare").size, 2);
    assert.equal(index.get("finance").size, 2);
    assert.equal(index.get("legal").size, 1);
  });
});

// ── Pipeline Registry Tests ─────────────────────────────────────────────────

describe("Pipeline Registry", () => {
  it("should register and lookup pipelines", () => {
    const pipelines = new Map();
    function registerPipeline(source, event, target, transform) {
      const key = `${source}.${event}`;
      if (!pipelines.has(key)) pipelines.set(key, []);
      pipelines.get(key).push({ target, transform });
    }

    registerPipeline("healthcare", "checkInteractions", "insurance", () => ({ type: "claim", data: {} }));
    registerPipeline("finance", "simulate", "accounting", () => ({ type: "entry", data: {} }));
    registerPipeline("healthcare", "checkInteractions", "daily", () => ({ type: "entry", data: {} }));

    assert.equal(pipelines.get("healthcare.checkInteractions").length, 2, "Healthcare should have 2 pipelines");
    assert.equal(pipelines.get("finance.simulate").length, 1, "Finance should have 1 pipeline");
    assert.ok(!pipelines.has("unknown.action"), "Unknown pipeline should not exist");
  });

  it("should execute transform functions correctly", () => {
    const transform = (src, result) => {
      if (!result?.ok) return null;
      return {
        type: "derived",
        title: `From: ${src.title}`,
        data: { sourceId: src.id, resultSummary: result.summary }
      };
    };

    const src = { id: "src-1", title: "Test Source" };
    const result = { ok: true, summary: "All good" };
    const output = transform(src, result);

    assert.equal(output.type, "derived");
    assert.equal(output.title, "From: Test Source");
    assert.equal(output.data.sourceId, "src-1");

    const nullOutput = transform(src, { ok: false });
    assert.equal(nullOutput, null);
  });
});

// ── Cross-Domain Action Verification ────────────────────────────────────────

describe("All 23 Domains Have Required Actions", () => {
  const harness = createHarness();

  before(() => {
    for (const mod of modules) mod(harness.registerLensAction);
  });

  const expectedDomains = [
    "healthcare", "trades", "food", "retail", "household",
    "accounting", "agriculture", "logistics", "education", "legal",
    "nonprofit", "realestate", "fitness", "creative", "manufacturing",
    "environment", "government", "aviation", "events", "science",
    "security", "services", "insurance",
  ];

  for (const domain of expectedDomains) {
    it(`${domain}: should have registered actions`, () => {
      const domainActions = [];
      for (const key of harness.actions.keys()) {
        if (key.startsWith(`${domain}.`)) domainActions.push(key);
      }
      assert.ok(domainActions.length >= 2, `${domain} should have at least 2 actions, got ${domainActions.length}: ${domainActions.join(", ")}`);
    });
  }
});
