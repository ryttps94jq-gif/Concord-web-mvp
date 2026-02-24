/**
 * Three-Gate Consistency Test
 *
 * Verifies that the three permission gates in server.js are consistent:
 * Gate 1: publicReadPaths in authMiddleware
 * Gate 2: publicReadDomains in runMacro
 * Gate 3: _safeReadPaths in Chicken2 safeReadBypass
 *
 * Every path prefix in Gate 1 should have a corresponding entry in Gate 3.
 * The test extracts both arrays and diffs them.
 */

import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import path from "path";

const SERVER_PATH = path.resolve(import.meta.dirname, "../server.js");

function extractArrayFromSource(source, marker) {
  // Find the array starting after the marker
  const idx = source.indexOf(marker);
  if (idx === -1) return [];

  // Find the opening bracket
  const bracketStart = source.indexOf("[", idx);
  if (bracketStart === -1) return [];

  // Find matching closing bracket
  let depth = 0;
  let end = bracketStart;
  for (let i = bracketStart; i < source.length; i++) {
    if (source[i] === "[") depth++;
    if (source[i] === "]") depth--;
    if (depth === 0) { end = i; break; }
  }

  const arrayStr = source.slice(bracketStart, end + 1);
  // Extract quoted strings
  const paths = [];
  const re = /"([^"]+)"/g;
  let m;
  while ((m = re.exec(arrayStr)) !== null) {
    if (m[1].startsWith("/api/")) paths.push(m[1]);
  }
  return paths;
}

describe("Three-Gate Consistency", () => {
  const source = readFileSync(SERVER_PATH, "utf-8");

  const gate1Paths = extractArrayFromSource(source, "const publicReadPaths = [");
  const gate3Paths = extractArrayFromSource(source, "const _safeReadPaths = [");

  it("should have found Gate 1 paths", () => {
    expect(gate1Paths.length).toBeGreaterThan(10);
  });

  it("should have found Gate 3 paths", () => {
    expect(gate3Paths.length).toBeGreaterThan(10);
  });

  it("every Gate 1 path should exist in Gate 3", () => {
    const gate3Set = new Set(gate3Paths);
    const missing = gate1Paths.filter(p => !gate3Set.has(p));
    if (missing.length > 0) {
      console.warn("Paths in Gate 1 (publicReadPaths) but missing from Gate 3 (_safeReadPaths):", missing);
    }
    expect(missing).toEqual([]);
  });

  it("every Gate 3 path should exist in Gate 1", () => {
    const gate1Set = new Set(gate1Paths);
    const missing = gate3Paths.filter(p => !gate1Set.has(p));
    if (missing.length > 0) {
      console.warn("Paths in Gate 3 (_safeReadPaths) but missing from Gate 1 (publicReadPaths):", missing);
    }
    expect(missing).toEqual([]);
  });

  it("should have CONSOLIDATION constants defined", () => {
    expect(source).toContain("const CONSOLIDATION = Object.freeze({");
  });

  it("should have FORGETTING_CONSTANTS defined", () => {
    expect(source).toContain("const FORGETTING_CONSTANTS = Object.freeze({");
  });

  it("should have ENTITY_ECONOMY_CONSTANTS defined", () => {
    expect(source).toContain("const ENTITY_ECONOMY_CONSTANTS = Object.freeze({");
  });

  it("should have ENTITY_LIMITS defined", () => {
    expect(source).toContain("const ENTITY_LIMITS = Object.freeze({");
  });
});
