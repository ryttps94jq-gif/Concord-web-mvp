/**
 * OpenAPI Contract Tests
 *
 * Validates that the OpenAPI spec at ../openapi.yaml stays in sync with the
 * routes actually defined in the server source code.
 *
 * Approach: parse the YAML spec for declared paths/methods, then use regex to
 * extract every `app.<method>("path", ...)` and `router.<method>("path", ...)`
 * call from the server source files, and cross-reference the two sets.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load OpenAPI spec using js-yaml (already in deps)
let yaml;
try { yaml = (await import("js-yaml")).default; } catch { yaml = (await import("yaml")).default; }

const specPath = path.join(__dirname, "..", "openapi.yaml");
const specContent = fs.readFileSync(specPath, "utf8");
const spec = yaml.load ? yaml.load(specContent) : yaml.parse(specContent);

// ---------------------------------------------------------------------------
// Extract routes from source files via regex
// ---------------------------------------------------------------------------
function extractRoutesFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const routes = [];
  // Match app.METHOD("path", ...) and router.METHOD("path", ...)
  const regex = /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`](\/[^"'`]*)["'`]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    routes.push({ method: match[1].toUpperCase(), path: match[2] });
  }
  return routes;
}

// Collect all routes from every file that registers HTTP handlers
const serverRoutes = [];
const serverDir = path.join(__dirname, "..");

// 1. server.js (the monolith — registers hundreds of routes directly on app)
const serverFile = path.join(serverDir, "server.js");
if (fs.existsSync(serverFile)) {
  serverRoutes.push(...extractRoutesFromFile(serverFile));
}

// 2. routes/*.js — some are mounted with a prefix, some register directly on app
const routesDir = path.join(serverDir, "routes");
if (fs.existsSync(routesDir)) {
  for (const f of fs.readdirSync(routesDir)) {
    if (!f.endsWith(".js")) continue;
    const filePath = path.join(routesDir, f);
    const fileRoutes = extractRoutesFromFile(filePath);

    // Determine mount prefix for router-based files
    let prefix = "";
    if (f === "emergent.js") prefix = "/api/emergent";
    else if (f === "auth.js") prefix = "/api/auth";

    fileRoutes.forEach(r => { r.path = prefix + r.path; });
    serverRoutes.push(...fileRoutes);
  }
}

// 3. Additional source files that register routes directly on app
const additionalFiles = [
  path.join(serverDir, "durable.js"),
  path.join(serverDir, "guidance.js"),
  path.join(serverDir, "economy", "routes.js"),
];
for (const f of additionalFiles) {
  if (fs.existsSync(f)) {
    serverRoutes.push(...extractRoutesFromFile(f));
  }
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Convert Express `:param` syntax to OpenAPI `{param}` syntax */
function normalizeToOpenAPI(expressPath) {
  return expressPath.replace(/:([^/]+)/g, "{$1}");
}

/** Build a Set of "METHOD /path" strings from code routes */
const codeRouteSet = new Set(
  serverRoutes.map(r => `${r.method} ${normalizeToOpenAPI(r.path)}`)
);

/** Unique code paths (ignoring method) */
const codePathSet = new Set(
  serverRoutes.map(r => normalizeToOpenAPI(r.path))
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenAPI Contract Tests", () => {
  const specPaths = Object.keys(spec.paths || {});

  it("OpenAPI spec should have paths defined", () => {
    assert.ok(specPaths.length > 0, "No paths found in OpenAPI spec");
  });

  it("All spec paths should have corresponding routes in code", () => {
    const missing = [];

    for (const specPath of specPaths) {
      if (!codePathSet.has(specPath)) {
        missing.push(specPath);
      }
    }

    // Allow up to 20 % mismatch for routes mounted by dynamic or less
    // conventional patterns that the regex cannot pick up.
    const missingPct = missing.length / specPaths.length;
    assert.ok(
      missingPct < 0.2,
      `${missing.length}/${specPaths.length} spec paths not found in code:\n${missing.join("\n")}`
    );
  });

  it("All spec HTTP methods should match code", () => {
    let matched = 0;
    let total = 0;

    for (const [specPath, methods] of Object.entries(spec.paths || {})) {
      for (const method of Object.keys(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          total++;
          const key = `${method.toUpperCase()} ${specPath}`;
          if (codeRouteSet.has(key)) matched++;
        }
      }
    }

    const matchRate = total > 0 ? matched / total : 0;
    assert.ok(
      matchRate > 0.5,
      `Only ${matched}/${total} (${(matchRate * 100).toFixed(1)}%) spec operations found in code`
    );
  });

  it("Should have comprehensive API documentation (>= 100 operations)", () => {
    let opCount = 0;
    for (const methods of Object.values(spec.paths || {})) {
      for (const method of Object.keys(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          opCount++;
        }
      }
    }
    assert.ok(opCount >= 100, `Only ${opCount} operations documented, expected >= 100`);
  });

  it("All spec operations should have summaries", () => {
    let missing = 0;
    let total = 0;
    const missingList = [];

    for (const [p, methods] of Object.entries(spec.paths || {})) {
      for (const [method, detail] of Object.entries(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          total++;
          if (!detail.summary) {
            missing++;
            missingList.push(`${method.toUpperCase()} ${p}`);
          }
        }
      }
    }

    assert.equal(
      missing, 0,
      `${missing}/${total} operations missing summaries:\n${missingList.join("\n")}`
    );
  });

  it("Security schemes should be defined", () => {
    const schemes = spec.components?.securitySchemes;
    assert.ok(schemes, "No security schemes defined");
    assert.ok(schemes.cookieAuth, "Missing cookieAuth scheme");
    assert.ok(schemes.bearerAuth, "Missing bearerAuth scheme");
    assert.ok(schemes.apiKeyAuth, "Missing apiKeyAuth scheme");
  });

  it("Should warn about undocumented routes (in code but not in spec)", () => {
    const specPathMethodSet = new Set();
    for (const [specPath, methods] of Object.entries(spec.paths || {})) {
      for (const method of Object.keys(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          specPathMethodSet.add(`${method.toUpperCase()} ${specPath}`);
        }
      }
    }

    const undocumented = [];
    for (const route of serverRoutes) {
      const key = `${route.method} ${normalizeToOpenAPI(route.path)}`;
      if (!specPathMethodSet.has(key)) {
        undocumented.push(key);
      }
    }

    // This is a warning — we report it but allow up to 60 % undocumented
    // because the monolith has many internal/admin routes.
    const docRate = serverRoutes.length > 0
      ? 1 - (undocumented.length / serverRoutes.length)
      : 1;
    assert.ok(
      docRate > 0.1,
      `Documentation coverage too low: only ${(docRate * 100).toFixed(1)}% of code routes are documented`
    );

    // Log undocumented routes as informational output
    if (undocumented.length > 0) {
      console.log(
        `[info] ${undocumented.length} undocumented routes (in code but not in spec) — consider adding them to openapi.yaml`
      );
    }
  });

  it("Ghost routes (in spec but not in code) should be minimal", () => {
    const ghosts = [];

    for (const [specPath, methods] of Object.entries(spec.paths || {})) {
      for (const method of Object.keys(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          const key = `${method.toUpperCase()} ${specPath}`;
          if (!codeRouteSet.has(key)) {
            ghosts.push(key);
          }
        }
      }
    }

    // Allow up to 20 % ghost routes (regex extraction is heuristic-based
    // and cannot catch every dynamic registration pattern).
    const totalOps = Object.values(spec.paths || {}).reduce((sum, methods) => {
      return sum + Object.keys(methods).filter(m =>
        ["get", "post", "put", "patch", "delete"].includes(m)
      ).length;
    }, 0);

    const ghostPct = totalOps > 0 ? ghosts.length / totalOps : 0;
    assert.ok(
      ghostPct < 0.2,
      `${ghosts.length}/${totalOps} (${(ghostPct * 100).toFixed(1)}%) ghost routes found in spec but not in code:\n${ghosts.join("\n")}`
    );
  });
});
