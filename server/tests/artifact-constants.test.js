import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ARTIFACT,
  FEEDBACK,
} from "../lib/artifact-constants.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertFrozen(obj, label) {
  assert.ok(Object.isFrozen(obj), `${label} should be frozen`);
}

function assertCannotMutate(obj, key, label) {
  const original = obj[key];
  try { obj[key] = "__MUTATED__"; } catch { /* strict mode throws */ }
  assert.deepStrictEqual(obj[key], original, `${label}.${key} should be immutable`);
}

function assertCannotAdd(obj, label) {
  try { obj.__newProp = true; } catch { /* strict mode throws */ }
  assert.strictEqual(obj.__newProp, undefined, `${label} should not allow new properties`);
}

function assertCannotDelete(obj, key, label) {
  try { delete obj[key]; } catch { /* strict mode throws */ }
  assert.notStrictEqual(obj[key], undefined, `${label}.${key} should not be deletable`);
}

// ── ARTIFACT ─────────────────────────────────────────────────────────────────

describe("ARTIFACT", () => {
  it("is frozen", () => assertFrozen(ARTIFACT, "ARTIFACT"));

  it("MAX_ARTIFACT_SIZE is 100 MB", () => {
    assert.strictEqual(ARTIFACT.MAX_ARTIFACT_SIZE, 100 * 1024 * 1024);
  });

  it("MAX_DISK_USAGE_PERCENT is 0.80 (80%)", () => {
    assert.strictEqual(ARTIFACT.MAX_DISK_USAGE_PERCENT, 0.80);
  });

  it("CLEANUP_THRESHOLD_PERCENT is 0.60 (60%)", () => {
    assert.strictEqual(ARTIFACT.CLEANUP_THRESHOLD_PERCENT, 0.60);
  });

  it("CLEANUP_THRESHOLD_PERCENT is less than MAX_DISK_USAGE_PERCENT", () => {
    assert.ok(ARTIFACT.CLEANUP_THRESHOLD_PERCENT < ARTIFACT.MAX_DISK_USAGE_PERCENT);
  });

  it("UNACCESSED_CLEANUP_DAYS is 30", () => {
    assert.strictEqual(ARTIFACT.UNACCESSED_CLEANUP_DAYS, 30);
  });

  it("DISK_CHECK_INTERVAL is 1000", () => {
    assert.strictEqual(ARTIFACT.DISK_CHECK_INTERVAL, 1000);
  });

  it("THUMBNAIL_MAX_WIDTH is 400", () => {
    assert.strictEqual(ARTIFACT.THUMBNAIL_MAX_WIDTH, 400);
  });

  it("PREVIEW_DURATION_SECONDS is 30", () => {
    assert.strictEqual(ARTIFACT.PREVIEW_DURATION_SECONDS, 30);
  });

  it("AVAILABLE_DISK_BYTES is 280 GB", () => {
    assert.strictEqual(ARTIFACT.AVAILABLE_DISK_BYTES, 280 * 1024 * 1024 * 1024);
  });

  it("all values are positive numbers", () => {
    for (const [key, value] of Object.entries(ARTIFACT)) {
      assert.strictEqual(typeof value, "number", `ARTIFACT.${key} should be a number`);
      assert.ok(value > 0, `ARTIFACT.${key} should be positive`);
    }
  });

  it("cannot be mutated", () => {
    assertCannotMutate(ARTIFACT, "MAX_ARTIFACT_SIZE", "ARTIFACT");
    assertCannotAdd(ARTIFACT, "ARTIFACT");
    assertCannotDelete(ARTIFACT, "MAX_ARTIFACT_SIZE", "ARTIFACT");
  });
});

// ── FEEDBACK ─────────────────────────────────────────────────────────────────

describe("FEEDBACK", () => {
  it("is frozen", () => assertFrozen(FEEDBACK, "FEEDBACK"));

  it("PROCESS_INTERVAL is 200", () => {
    assert.strictEqual(FEEDBACK.PROCESS_INTERVAL, 200);
  });

  it("MIN_REQUESTS_FOR_PROPOSAL is 3", () => {
    assert.strictEqual(FEEDBACK.MIN_REQUESTS_FOR_PROPOSAL, 3);
  });

  it("MIN_REPORTS_FOR_REPAIR is 2", () => {
    assert.strictEqual(FEEDBACK.MIN_REPORTS_FOR_REPAIR, 2);
  });

  it("NEGATIVE_SENTIMENT_THRESHOLD is -5", () => {
    assert.strictEqual(FEEDBACK.NEGATIVE_SENTIMENT_THRESHOLD, -5);
  });

  it("AUTHORITY_ADJUSTMENT_RATE is 0.01", () => {
    assert.strictEqual(FEEDBACK.AUTHORITY_ADJUSTMENT_RATE, 0.01);
  });

  it("PROPOSAL_APPROVAL_THRESHOLD is 0.6", () => {
    assert.strictEqual(FEEDBACK.PROPOSAL_APPROVAL_THRESHOLD, 0.6);
  });

  it("PROPOSAL_APPROVAL_THRESHOLD is between 0 and 1", () => {
    assert.ok(FEEDBACK.PROPOSAL_APPROVAL_THRESHOLD > 0);
    assert.ok(FEEDBACK.PROPOSAL_APPROVAL_THRESHOLD < 1);
  });

  it("AUTHORITY_ADJUSTMENT_RATE is between 0 and 1", () => {
    assert.ok(FEEDBACK.AUTHORITY_ADJUSTMENT_RATE > 0);
    assert.ok(FEEDBACK.AUTHORITY_ADJUSTMENT_RATE < 1);
  });

  it("has exactly 6 keys", () => {
    assert.strictEqual(Object.keys(FEEDBACK).length, 6);
  });

  it("cannot be mutated", () => {
    assertCannotMutate(FEEDBACK, "PROCESS_INTERVAL", "FEEDBACK");
    assertCannotAdd(FEEDBACK, "FEEDBACK");
    assertCannotDelete(FEEDBACK, "PROCESS_INTERVAL", "FEEDBACK");
  });
});
