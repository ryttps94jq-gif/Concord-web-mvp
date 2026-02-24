import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

const serverPath = path.join(import.meta.dirname, "../server.js");
const serverSrc = fs.readFileSync(serverPath, "utf-8");

describe("Consolidation Pipeline", () => {
  it("should have CONSOLIDATION frozen constants", () => {
    expect(serverSrc).toContain("const CONSOLIDATION = Object.freeze({");
    expect(serverSrc).toContain("MEGA_MIN_CLUSTER: 5");
    expect(serverSrc).toContain("MEGA_MAX_PER_CYCLE: 5");
    expect(serverSrc).toContain("HYPER_MIN_MEGAS: 3");
    expect(serverSrc).toContain("COVERAGE_THRESHOLD: 0.8");
    expect(serverSrc).toContain("MAX_HEAP_BYTES: 1_363_148_800");
  });

  it("should have TICK_FREQUENCIES frozen constants", () => {
    expect(serverSrc).toContain("const TICK_FREQUENCIES = Object.freeze({");
    expect(serverSrc).toContain("CONSOLIDATION: 30");
    expect(serverSrc).toContain("FORGETTING: 50");
    expect(serverSrc).toContain("WEALTH_REDISTRIBUTION: 500");
  });

  it("should have CONTEXT_TIER_BOOST frozen constants", () => {
    expect(serverSrc).toContain("const CONTEXT_TIER_BOOST = Object.freeze({");
    expect(serverSrc).toContain("hyper: 2.0");
    expect(serverSrc).toContain("mega: 1.5");
  });

  it("should have quality validation function", () => {
    expect(serverSrc).toContain("function validateConsolidationQuality");
    expect(serverSrc).toContain("COVERAGE_THRESHOLD");
    expect(serverSrc).toContain("AUTHORITY_PRESERVATION");
  });

  it("should have edge transfer function", () => {
    expect(serverSrc).toContain("function transferEdgesToConsolidated");
  });

  it("should have adaptive threshold computation", () => {
    expect(serverSrc).toContain("function computeAdaptiveThreshold");
    expect(serverSrc).toContain("HEAP_TARGET_PERCENT");
  });

  it("should use TICK_FREQUENCIES in heartbeat", () => {
    expect(serverSrc).toContain("TICK_FREQUENCIES.CONSOLIDATION");
    expect(serverSrc).toContain("TICK_FREQUENCIES.FORGETTING");
  });

  it("should have archive functions", () => {
    expect(serverSrc).toContain("function archiveDTUToDisk");
    expect(serverSrc).toContain("function rehydrateDTU");
    expect(serverSrc).toContain("function demoteToArchive");
  });

  it("should have context query macro", () => {
    expect(serverSrc).toContain('register("context", "query"');
  });

  it("should have marketplace macros", () => {
    expect(serverSrc).toContain('register("marketplace", "list"');
    expect(serverSrc).toContain('register("marketplace", "purchase"');
    expect(serverSrc).toContain('register("marketplace", "browse"');
  });
});

describe("Archive Migration", () => {
  it("should have archived_dtus migration", () => {
    const migrationPath = path.join(import.meta.dirname, "../migrations/007_archived_dtus.js");
    expect(fs.existsSync(migrationPath)).toBe(true);
    const migrationSrc = fs.readFileSync(migrationPath, "utf-8");
    expect(migrationSrc).toContain("archived_dtus");
    expect(migrationSrc).toContain("tier TEXT");
    expect(migrationSrc).toContain("rehydrated_count");
  });
});

describe("Artifact Store", () => {
  it("should have artifact store module", () => {
    const storePath = path.join(import.meta.dirname, "../lib/artifact-store.js");
    expect(fs.existsSync(storePath)).toBe(true);
    const storeSrc = fs.readFileSync(storePath, "utf-8");
    expect(storeSrc).toContain("storeArtifact");
    expect(storeSrc).toContain("retrieveArtifact");
    expect(storeSrc).toContain("deleteArtifact");
    expect(storeSrc).toContain("getArtifactDiskUsage");
  });
});

describe("Feedback Engine", () => {
  it("should have feedback engine module", () => {
    const enginePath = path.join(import.meta.dirname, "../lib/feedback-engine.js");
    expect(fs.existsSync(enginePath)).toBe(true);
    const engineSrc = fs.readFileSync(enginePath, "utf-8");
    expect(engineSrc).toContain("processFeedbackQueue");
    expect(engineSrc).toContain("aggregateFeedback");
    expect(engineSrc).toContain("FEEDBACK_TYPES");
  });
});
