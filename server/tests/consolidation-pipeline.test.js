import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const serverPath = path.join(import.meta.dirname, "../server.js");
const serverSrc = fs.readFileSync(serverPath, "utf-8");

describe("Consolidation Pipeline", () => {
  it("should have CONSOLIDATION frozen constants", () => {
    assert.ok(serverSrc.includes("const CONSOLIDATION = Object.freeze({"));
    assert.ok(serverSrc.includes("MEGA_MIN_CLUSTER: 5"));
    assert.ok(serverSrc.includes("MEGA_MAX_PER_CYCLE: 8"));
    assert.ok(serverSrc.includes("HYPER_MIN_MEGAS: 3"));
    assert.ok(serverSrc.includes("COVERAGE_THRESHOLD: 0.8"));
    assert.ok(serverSrc.includes("MAX_HEAP_BYTES: 4_294_967_296"));
  });

  it("should have TICK_FREQUENCIES frozen constants", () => {
    assert.ok(serverSrc.includes("const TICK_FREQUENCIES = Object.freeze({"));
    assert.ok(serverSrc.includes("CONSOLIDATION: 30"));
    assert.ok(serverSrc.includes("FORGETTING: 50"));
    assert.ok(serverSrc.includes("WEALTH_REDISTRIBUTION: 500"));
  });

  it("should have CONTEXT_TIER_BOOST frozen constants", () => {
    assert.ok(serverSrc.includes("const CONTEXT_TIER_BOOST = Object.freeze({"));
    assert.ok(serverSrc.includes("hyper: 2.0"));
    assert.ok(serverSrc.includes("mega: 1.5"));
  });

  it("should have quality validation function", () => {
    assert.ok(serverSrc.includes("function validateConsolidationQuality"));
    assert.ok(serverSrc.includes("COVERAGE_THRESHOLD"));
    assert.ok(serverSrc.includes("AUTHORITY_PRESERVATION"));
  });

  it("should have edge transfer function", () => {
    assert.ok(serverSrc.includes("function transferEdgesToConsolidated"));
  });

  it("should have adaptive threshold computation", () => {
    assert.ok(serverSrc.includes("function computeAdaptiveThreshold"));
    assert.ok(serverSrc.includes("HEAP_TARGET_PERCENT"));
  });

  it("should use TICK_FREQUENCIES in heartbeat", () => {
    assert.ok(serverSrc.includes("TICK_FREQUENCIES.CONSOLIDATION"));
    assert.ok(serverSrc.includes("TICK_FREQUENCIES.FORGETTING"));
  });

  it("should have archive functions", () => {
    assert.ok(serverSrc.includes("function archiveDTUToDisk"));
    assert.ok(serverSrc.includes("function rehydrateDTU"));
    assert.ok(serverSrc.includes("function demoteToArchive"));
  });

  it("should have context query macro", () => {
    assert.ok(serverSrc.includes('register("context", "query"'));
  });

  it("should have marketplace macros", () => {
    assert.ok(serverSrc.includes('register("marketplace", "list"'));
    assert.ok(serverSrc.includes('register("marketplace", "purchase"'));
    assert.ok(serverSrc.includes('register("marketplace", "browse"'));
  });
});

describe("Archive Migration", () => {
  it("should have archived_dtus migration", () => {
    const migrationPath = path.join(import.meta.dirname, "../migrations/007_archived_dtus.js");
    assert.equal(fs.existsSync(migrationPath), true);
    const migrationSrc = fs.readFileSync(migrationPath, "utf-8");
    assert.ok(migrationSrc.includes("archived_dtus"));
    assert.ok(migrationSrc.includes("tier TEXT"));
    assert.ok(migrationSrc.includes("rehydrated_count"));
  });
});

describe("Artifact Store", () => {
  it("should have artifact store module", () => {
    const storePath = path.join(import.meta.dirname, "../lib/artifact-store.js");
    assert.equal(fs.existsSync(storePath), true);
    const storeSrc = fs.readFileSync(storePath, "utf-8");
    assert.ok(storeSrc.includes("storeArtifact"));
    assert.ok(storeSrc.includes("retrieveArtifact"));
    assert.ok(storeSrc.includes("deleteArtifact"));
    assert.ok(storeSrc.includes("getArtifactDiskUsage"));
  });
});

describe("Feedback Engine", () => {
  it("should have feedback engine module", () => {
    const enginePath = path.join(import.meta.dirname, "../lib/feedback-engine.js");
    assert.equal(fs.existsSync(enginePath), true);
    const engineSrc = fs.readFileSync(enginePath, "utf-8");
    assert.ok(engineSrc.includes("processFeedbackQueue"));
    assert.ok(engineSrc.includes("aggregateFeedback"));
    assert.ok(engineSrc.includes("FEEDBACK_TYPES"));
  });
});
