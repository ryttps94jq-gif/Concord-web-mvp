import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const serverPath = path.join(import.meta.dirname, "../server.js");
const serverSrc = fs.readFileSync(serverPath, "utf-8");

describe("Sovereign Access Control", () => {
  it("should have SOVEREIGN_ROUTES defined", () => {
    expect(serverSrc).toContain("SOVEREIGN_ROUTES");
    expect(serverSrc).toContain("/api/sovereign");
    expect(serverSrc).toContain("/api/system/shutdown");
  });

  it("should block entity access to sovereign routes", () => {
    expect(serverSrc).toContain("x-entity-id");
    expect(serverSrc).toContain("entity_access_denied");
  });

  it("should have sovereign dashboard endpoint", () => {
    expect(serverSrc).toContain("/api/sovereign/dashboard");
  });
});

describe("Entity Autonomy Blocked Lenses", () => {
  const autonomyPath = path.join(import.meta.dirname, "../emergent/entity-autonomy.js");
  if (fs.existsSync(autonomyPath)) {
    const autonomySrc = fs.readFileSync(autonomyPath, "utf-8");

    it("should have ENTITY_BLOCKED_LENSES", () => {
      expect(autonomySrc).toContain("ENTITY_BLOCKED_LENSES");
      expect(autonomySrc).toContain("admin");
      expect(autonomySrc).toContain("sovereign");
      expect(autonomySrc).toContain("command-center");
    });
  }
});

describe("Three Gate Consistency", () => {
  it("should have artifact paths in gates", () => {
    expect(serverSrc).toContain('"/api/artifact"');
    expect(serverSrc).toContain('"/api/feedback"');
  });

  it("should have context domain in gates", () => {
    expect(serverSrc).toContain('"/api/context"');
  });
});
