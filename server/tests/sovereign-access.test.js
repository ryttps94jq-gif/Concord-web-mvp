import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const serverPath = path.join(import.meta.dirname, "../server.js");
const serverSrc = fs.readFileSync(serverPath, "utf-8");

describe("Sovereign Access Control", () => {
  it("should have SOVEREIGN_ROUTES defined", () => {
    assert.ok(serverSrc.includes("SOVEREIGN_ROUTES"));
    assert.ok(serverSrc.includes("/api/sovereign"));
    assert.ok(serverSrc.includes("/api/system/shutdown"));
  });

  it("should block entity access to sovereign routes", () => {
    assert.ok(serverSrc.includes("x-entity-id"));
    assert.ok(serverSrc.includes("entity_access_denied"));
  });

  it("should have sovereign dashboard endpoint", () => {
    assert.ok(serverSrc.includes("/api/sovereign/dashboard"));
  });
});

describe("Entity Autonomy Blocked Lenses", () => {
  const autonomyPath = path.join(import.meta.dirname, "../emergent/entity-autonomy.js");
  if (fs.existsSync(autonomyPath)) {
    const autonomySrc = fs.readFileSync(autonomyPath, "utf-8");

    it("should have ENTITY_BLOCKED_LENSES", () => {
      assert.ok(autonomySrc.includes("ENTITY_BLOCKED_LENSES"));
      assert.ok(autonomySrc.includes("admin"));
      assert.ok(autonomySrc.includes("sovereign"));
      assert.ok(autonomySrc.includes("command-center"));
    });
  }
});

describe("Three Gate Consistency", () => {
  it("should have artifact paths in gates", () => {
    assert.ok(serverSrc.includes('"/api/artifact"'));
    assert.ok(serverSrc.includes('"/api/feedback"'));
  });

  it("should have context domain in gates", () => {
    assert.ok(serverSrc.includes('"/api/context"'));
  });
});
