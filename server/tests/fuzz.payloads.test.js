/**
 * Fuzz / Property Test Suite for Concord Atlas
 *
 * Generates random payload variants and ensures the system never crashes.
 * Every response must be { ok: true/false } — never undefined, never a thrown exception.
 *
 * Uses Node.js native test runner (node:test and node:assert/strict).
 * No external fuzzing libraries required.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Module imports ──────────────────────────────────────────────────────────

import { initAtlasState, getAtlasState } from "../emergent/atlas-epistemic.js";
import { initScopeState, scopedWrite, createSubmission, getDtuScope } from "../emergent/atlas-scope-router.js";
import { applyWrite, WRITE_OPS } from "../emergent/atlas-write-guard.js";
import { chatRetrieve, saveAsDtu } from "../emergent/atlas-chat.js";
import { canUse, validateLicense, validateDerivativeRights, computeContentHash } from "../emergent/atlas-rights.js";
import { SCOPES, LICENSE_TYPES, RIGHTS_ACTIONS } from "../emergent/atlas-config.js";

// ── Test STATE factory ──────────────────────────────────────────────────────

function makeTestState() {
  const STATE = {
    dtus: new Map(),
    shadowDtus: new Map(),
    sessions: new Map(),
    users: new Map(),
    orgs: new Map(),
    __emergent: null,
  };
  initAtlasState(STATE);
  initScopeState(STATE);
  return STATE;
}

// ── Random generators (inline, no external libs) ────────────────────────────

function randomString(len = 10) {
  return Array.from({ length: len }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join("");
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBool() {
  return Math.random() > 0.5;
}

// ── Valid domain types and epistemic classes for mixing ──────────────────────

const VALID_DOMAIN_TYPES = [
  "formal.math", "formal.logic",
  "empirical.physics", "empirical.biology", "empirical.medicine",
  "historical.world", "historical.economic",
  "interpretive.philosophy", "interpretive.linguistics",
  "model.economics", "model.policy",
  "arts.visual", "arts.music", "arts.literature",
  "design.architecture", "design.product",
  "general.note",
];

const VALID_EPISTEMIC_CLASSES = [
  "FORMAL", "EMPIRICAL", "HISTORICAL", "INTERPRETIVE",
  "MODEL", "ARTS", "DESIGN", "GENERAL",
];

const VALID_CLAIM_TYPES = [
  "FACT", "INTERPRETATION", "RECEPTION", "PROVENANCE",
  "SPEC", "HYPOTHESIS", "MODEL_OUTPUT",
];

// ═════════════════════════════════════════════════════════════════════════════
// 1. Fuzz: DTU Create — 200 random payloads
// ═════════════════════════════════════════════════════════════════════════════

describe("Fuzz: DTU Create — 200 random payloads", () => {
  const STATE = makeTestState();

  it("should never throw and always return { ok: boolean } for 200 random payloads", () => {
    for (let i = 0; i < 200; i++) {
      // Build a random payload with random combinations of fields
      const payload = {};

      // title: sometimes missing, sometimes very long, sometimes empty
      if (randomBool()) {
        const titleVariant = randomInt(0, 3);
        if (titleVariant === 0) {
          payload.title = "";
        } else if (titleVariant === 1) {
          payload.title = randomString(1000);
        } else if (titleVariant === 2) {
          payload.title = randomString(randomInt(3, 50));
        }
        // titleVariant === 3: leave missing
      }

      // domainType: sometimes valid, sometimes invalid, sometimes missing
      if (randomBool()) {
        if (randomBool()) {
          payload.domainType = randomChoice(VALID_DOMAIN_TYPES);
        } else {
          payload.domainType = randomChoice(["fake.domain", "invalid", "", "x.y.z", "123"]);
        }
      }

      // epistemicClass: sometimes valid, sometimes invalid, sometimes missing
      if (randomBool()) {
        if (randomBool()) {
          payload.epistemicClass = randomChoice(VALID_EPISTEMIC_CLASSES);
        } else {
          payload.epistemicClass = randomChoice(["INVALID", "", "nope", "UNKNOWN", "42"]);
        }
      }

      // claims: 0-5 random claims with random claimTypes
      const claimCount = randomInt(0, 5);
      if (claimCount > 0) {
        payload.claims = [];
        for (let c = 0; c < claimCount; c++) {
          const claim = { text: randomString(randomInt(5, 100)) };
          if (randomBool()) {
            claim.claimType = randomBool()
              ? randomChoice(VALID_CLAIM_TYPES)
              : randomChoice(["BOGUS", "", "INVALID_TYPE"]);
          }
          if (randomBool()) {
            claim.sources = [{
              title: randomString(15),
              url: `https://example.com/${randomString(8)}`,
              sourceTier: randomChoice(["PRIMARY", "SECONDARY", "TERTIARY", "UNCITED"]),
            }];
          }
          payload.claims.push(claim);
        }
      }

      // tags: 0-10 random tags
      const tagCount = randomInt(0, 10);
      if (tagCount > 0) {
        payload.tags = Array.from({ length: tagCount }, () => randomString(randomInt(3, 20)));
      }

      // author: sometimes present, sometimes missing
      if (randomBool()) {
        payload.author = { userId: randomString(8) };
      }

      // Build random context
      const ctx = {
        scope: randomChoice(["local", "global"]),
        actor: "fuzz",
      };

      // Execute — must never throw
      let result;
      try {
        result = applyWrite(STATE, WRITE_OPS.CREATE, payload, ctx);
      } catch (err) {
        assert.fail(
          `applyWrite threw on iteration ${i}: ${err.message}\nPayload: ${JSON.stringify(payload).slice(0, 300)}`
        );
      }

      // Assert: result is an object with ok property (boolean), never undefined
      assert.notEqual(result, undefined, `Result was undefined on iteration ${i}`);
      assert.notEqual(result, null, `Result was null on iteration ${i}`);
      assert.equal(typeof result, "object", `Result was not an object on iteration ${i}`);
      assert.equal(
        typeof result.ok,
        "boolean",
        `result.ok was not boolean on iteration ${i}: got ${typeof result.ok} (${JSON.stringify(result.ok)})`
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Fuzz: Chat Retrieve — 100 random queries
// ═════════════════════════════════════════════════════════════════════════════

describe("Fuzz: Chat Retrieve — 100 random queries", () => {
  const STATE = makeTestState();

  it("should never throw and always return { ok, context: [] } for 100 random queries", () => {
    // Special character and unicode query fragments
    const specialQueries = [
      "", "   ", "\n\t\r", "<script>alert(1)</script>",
      "'; DROP TABLE dtus; --", "\u0000\u0001\u0002",
      "\uD83D\uDE00\uD83D\uDE80\uD83C\uDF1F", // emoji sequence
      "a".repeat(10000), "\x00null\x00byte",
      "SELECT * FROM", "${}", "{{template}}",
      "../../../etc/passwd", "null", "undefined",
      "NaN", "Infinity", "-Infinity", "true", "false",
      String.fromCharCode(...Array.from({ length: 50 }, () => randomInt(0, 65535))),
    ];

    for (let i = 0; i < 100; i++) {
      // Pick a random query variant
      let query;
      const variant = randomInt(0, 5);
      if (variant === 0) {
        query = randomChoice(specialQueries);
      } else if (variant === 1) {
        query = randomString(randomInt(1, 500));
      } else if (variant === 2) {
        query = String(randomInt(-999999, 999999));
      } else if (variant === 3) {
        query = randomString(randomInt(1, 10000));
      } else if (variant === 4) {
        query = Array.from({ length: randomInt(1, 20) }, () =>
          randomChoice(["AND", "OR", "NOT", randomString(5), String(randomInt(0, 100))])
        ).join(" ");
      } else {
        query = "";
      }

      const opts = { limit: randomInt(0, 100) };

      let result;
      try {
        result = chatRetrieve(STATE, query, opts);
      } catch (err) {
        assert.fail(
          `chatRetrieve threw on iteration ${i}: ${err.message}\nQuery: ${String(query).slice(0, 200)}`
        );
      }

      // Assert: result.ok exists, result.context is an array
      assert.notEqual(result, undefined, `Result was undefined on iteration ${i}`);
      assert.notEqual(result, null, `Result was null on iteration ${i}`);
      assert.equal(typeof result.ok, "boolean", `result.ok was not boolean on iteration ${i}`);
      assert.ok(Array.isArray(result.context), `result.context was not an array on iteration ${i}`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Fuzz: Save as DTU — 100 random chat saves
// ═════════════════════════════════════════════════════════════════════════════

describe("Fuzz: Save as DTU — 100 random chat saves", () => {
  const STATE = makeTestState();

  it("should never throw and always return { ok: boolean } for 100 random chat saves", () => {
    for (let i = 0; i < 100; i++) {
      // Build random content with missing/present/invalid fields
      const content = {};

      if (randomBool()) content.title = randomBool() ? randomString(randomInt(0, 200)) : "";
      if (randomBool()) content.content = randomString(randomInt(0, 500));
      if (randomBool()) content.tags = Array.from({ length: randomInt(0, 8) }, () => randomString(randomInt(1, 15)));
      if (randomBool()) {
        content.claims = Array.from({ length: randomInt(0, 4) }, () => ({
          text: randomString(randomInt(5, 80)),
          claimType: randomBool() ? randomChoice(VALID_CLAIM_TYPES) : randomChoice(["BOGUS", ""]),
        }));
      }
      if (randomBool()) content.domainType = randomBool() ? randomChoice(VALID_DOMAIN_TYPES) : "fake.nonsense";
      if (randomBool()) content.epistemicClass = randomBool() ? randomChoice(VALID_EPISTEMIC_CLASSES) : "NOPE";

      // Sometimes pass null/undefined for optional fields (plausible bad input)
      if (randomBool()) content.title = randomBool() ? null : undefined;
      if (randomBool()) content.tags = randomBool() ? null : undefined;

      const ctx = {
        actor: randomString(randomInt(1, 20)),
        sessionId: randomString(randomInt(5, 30)),
      };

      let result;
      try {
        result = saveAsDtu(STATE, content, ctx);
      } catch (err) {
        assert.fail(
          `saveAsDtu threw on iteration ${i}: ${err.message}\nContent: ${JSON.stringify(content).slice(0, 300)}`
        );
      }

      // Assert: result has ok property, never throws
      assert.notEqual(result, undefined, `Result was undefined on iteration ${i}`);
      assert.notEqual(result, null, `Result was null on iteration ${i}`);
      assert.equal(typeof result, "object", `Result was not an object on iteration ${i}`);
      assert.equal(
        typeof result.ok,
        "boolean",
        `result.ok was not boolean on iteration ${i}: got ${typeof result.ok}`
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Fuzz: Rights canUse — 100 random checks
// ═════════════════════════════════════════════════════════════════════════════

describe("Fuzz: Rights canUse — 100 random checks", () => {
  const STATE = makeTestState();

  // Pre-create a few valid DTUs so some lookups succeed
  const validDtuIds = [];

  it("should never throw and always return { allowed: boolean } for 100 random rights checks", () => {
    // Seed a few valid DTUs
    const seedPayloads = [
      {
        title: "Fuzz seed DTU alpha",
        domainType: "empirical.physics",
        epistemicClass: "EMPIRICAL",
        claims: [{ claimType: "FACT", text: "Alpha fact", sources: [{ title: "Source A", url: "https://a.com", sourceTier: "PRIMARY" }] }],
        tags: ["seed"],
        author: { userId: "seed-user-1" },
      },
      {
        title: "Fuzz seed DTU beta",
        domainType: "historical.world",
        epistemicClass: "HISTORICAL",
        claims: [{ claimType: "FACT", text: "Beta fact", sources: [{ title: "Source B", url: "https://b.com", sourceTier: "SECONDARY" }] }],
        tags: ["seed"],
        author: { userId: "seed-user-2" },
      },
      {
        title: "Fuzz seed DTU gamma",
        domainType: "general.note",
        epistemicClass: "GENERAL",
        claims: [{ claimType: "FACT", text: "Gamma fact", sources: [{ title: "Source C", url: "https://c.com", sourceTier: "PRIMARY" }] }],
        tags: ["seed"],
        author: { userId: "seed-user-3" },
      },
    ];

    for (const seed of seedPayloads) {
      const res = applyWrite(STATE, WRITE_OPS.CREATE, seed, { scope: "local", actor: "fuzz-seed" });
      if (res.ok && res.dtu) {
        validDtuIds.push(res.dtu.id);
      }
    }

    // Now fuzz canUse
    const allActions = [...Object.values(RIGHTS_ACTIONS), "INVALID_ACTION", ""];

    for (let i = 0; i < 100; i++) {
      const userId = randomString(randomInt(1, 20));
      const artifactId = randomChoice([
        ...validDtuIds,
        "nonexistent",
        "",
        null,
        randomString(15),
      ]);
      const action = randomChoice(allActions);

      let result;
      try {
        result = canUse(STATE, userId, artifactId, action);
      } catch (err) {
        assert.fail(
          `canUse threw on iteration ${i}: ${err.message}\nArgs: userId=${userId}, artifactId=${artifactId}, action=${action}`
        );
      }

      // Assert: result has allowed property (boolean)
      assert.notEqual(result, undefined, `Result was undefined on iteration ${i}`);
      assert.notEqual(result, null, `Result was null on iteration ${i}`);
      assert.equal(typeof result, "object", `Result was not an object on iteration ${i}`);
      assert.equal(
        typeof result.allowed,
        "boolean",
        `result.allowed was not boolean on iteration ${i}: got ${typeof result.allowed} (${JSON.stringify(result.allowed)})`
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Fuzz: validateLicense — 50 random license checks
// ═════════════════════════════════════════════════════════════════════════════

describe("Fuzz: validateLicense — 50 random license checks", () => {
  const STATE = makeTestState();

  it("should never throw and always return { ok: boolean } for 50 random license checks", () => {
    const allLicenseTypes = [...Object.values(LICENSE_TYPES)];
    const garbageLicenseTypes = ["INVALID", "", "BOGUS_LICENSE", "free", "MIT", "GPL"];

    for (let i = 0; i < 50; i++) {
      // Random license type: valid, invalid, empty, null, undefined
      let licenseType;
      const typeVariant = randomInt(0, 5);
      if (typeVariant === 0) {
        licenseType = randomChoice(allLicenseTypes);
      } else if (typeVariant === 1) {
        licenseType = randomChoice(garbageLicenseTypes);
      } else if (typeVariant === 2) {
        licenseType = "";
      } else if (typeVariant === 3) {
        licenseType = null;
      } else {
        licenseType = undefined;
      }

      // Random custom profile: complete, incomplete, missing fields, wrong types
      let customProfile = null;
      if (randomBool()) {
        const profileVariant = randomInt(0, 4);
        if (profileVariant === 0) {
          // Complete valid profile
          customProfile = {
            attribution_required: randomBool(),
            derivative_allowed: randomBool(),
            commercial_use_allowed: randomBool(),
            redistribution_allowed: randomBool(),
            royalty_required: randomBool(),
          };
        } else if (profileVariant === 1) {
          // Incomplete profile — missing some fields
          customProfile = {
            attribution_required: randomBool(),
            derivative_allowed: randomBool(),
          };
        } else if (profileVariant === 2) {
          // Wrong types
          customProfile = {
            attribution_required: "yes",
            derivative_allowed: 42,
            commercial_use_allowed: null,
            redistribution_allowed: undefined,
            royalty_required: "no",
          };
        } else if (profileVariant === 3) {
          // Empty object
          customProfile = {};
        } else {
          // Random garbage
          customProfile = randomString(20);
        }
      }

      let result;
      try {
        result = validateLicense(licenseType, customProfile);
      } catch (err) {
        assert.fail(
          `validateLicense threw on iteration ${i}: ${err.message}\nArgs: type=${licenseType}, profile=${JSON.stringify(customProfile).slice(0, 200)}`
        );
      }

      // Assert: result has ok property, never throws
      assert.notEqual(result, undefined, `Result was undefined on iteration ${i}`);
      assert.notEqual(result, null, `Result was null on iteration ${i}`);
      assert.equal(typeof result, "object", `Result was not an object on iteration ${i}`);
      assert.equal(
        typeof result.ok,
        "boolean",
        `result.ok was not boolean on iteration ${i}: got ${typeof result.ok}`
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Fuzz: computeContentHash — 50 random artifacts
// ═════════════════════════════════════════════════════════════════════════════

describe("Fuzz: computeContentHash — 50 random artifacts", () => {
  it("should never throw and always return a 64-char hex string for 50 random artifacts", () => {
    for (let i = 0; i < 50; i++) {
      // Build random artifact objects with various field combos
      const artifact = {};

      if (randomBool()) artifact.title = randomBool() ? randomString(randomInt(0, 500)) : "";
      if (randomBool()) artifact.content = randomString(randomInt(0, 1000));
      if (randomBool()) {
        artifact.claims = Array.from({ length: randomInt(0, 5) }, () => {
          const claim = {};
          if (randomBool()) claim.text = randomString(randomInt(0, 200));
          if (randomBool()) claim.claimType = randomChoice([...VALID_CLAIM_TYPES, "BOGUS", ""]);
          return claim;
        });
      }
      if (randomBool()) {
        artifact.tags = Array.from({ length: randomInt(0, 10) }, () => randomString(randomInt(1, 20)));
      }
      if (randomBool()) {
        artifact.interpretations = Array.from({ length: randomInt(0, 3) }, () => ({
          text: randomBool() ? randomString(randomInt(5, 100)) : "",
        }));
      }

      // Sometimes pass null/undefined for optional fields (plausible bad input)
      if (randomBool()) artifact.title = randomChoice([null, undefined, ""]);
      if (randomBool()) artifact.claims = randomChoice([null, undefined, []]);
      if (randomBool()) artifact.tags = randomChoice([null, undefined, []]);

      let result;
      try {
        result = computeContentHash(artifact);
      } catch (err) {
        assert.fail(
          `computeContentHash threw on iteration ${i}: ${err.message}\nArtifact: ${JSON.stringify(artifact).slice(0, 300)}`
        );
      }

      // Assert: returns a string of length 64 (SHA-256 hex), never throws
      assert.equal(typeof result, "string", `Result was not a string on iteration ${i}: got ${typeof result}`);
      assert.equal(
        result.length,
        64,
        `Result length was ${result.length}, expected 64 on iteration ${i}`
      );
    }
  });
});
