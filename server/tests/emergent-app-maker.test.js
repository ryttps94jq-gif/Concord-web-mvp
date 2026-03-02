/**
 * App Maker — Comprehensive Test Suite
 *
 * Covers: validateApp, createApp, getApp, listApps, updateApp, deleteApp,
 *         promoteApp, demoteApp, countApps, countAppsByStage,
 *         getAppMetrics, handleAppCommand, init
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  validateApp,
  createApp,
  getApp,
  listApps,
  updateApp,
  deleteApp,
  promoteApp,
  demoteApp,
  countApps,
  countAppsByStage,
  getAppMetrics,
  handleAppCommand,
  init,
} from "../emergent/app-maker.js";

// ── Setup / Cleanup ──────────────────────────────────────────────────────────

let _originalMACROS;
let _originalEmit;

beforeEach(() => {
  _originalMACROS = globalThis._concordMACROS;
  _originalEmit = globalThis.realtimeEmit;
  globalThis._concordMACROS = undefined;
  globalThis.realtimeEmit = undefined;
});

afterEach(() => {
  globalThis._concordMACROS = _originalMACROS;
  globalThis.realtimeEmit = _originalEmit;
});

// ── validateApp ──────────────────────────────────────────────────────────────

describe("validateApp", () => {
  it("returns valid for a well-formed app spec", () => {
    const spec = {
      name: "TestApp",
      primitives: {
        artifacts: {
          types: ["workout"],
          schema: {
            workout: {
              fields: [
                { name: "duration", type: "number" },
                { name: "date", type: "date" },
              ],
            },
          },
        },
      },
    };
    const result = validateApp(spec);
    assert.equal(result.valid, true);
    assert.deepEqual(result.violations, []);
  });

  it("requires name", () => {
    const result = validateApp({ primitives: {} });
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.includes("name")));
  });

  it("requires primitives", () => {
    const result = validateApp({ name: "test" });
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.includes("Primitives")));
  });

  it("validates field types", () => {
    const spec = {
      name: "test",
      primitives: {
        artifacts: {
          schema: {
            thing: {
              fields: [{ name: "x", type: "invalid_type" }],
            },
          },
        },
      },
    };
    const result = validateApp(spec);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.includes("invalid type")));
  });

  it("rejects schema without fields array", () => {
    const spec = {
      name: "test",
      primitives: {
        artifacts: {
          schema: {
            thing: { noFields: true },
          },
        },
      },
    };
    const result = validateApp(spec);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.includes("fields array")));
  });

  it("checks that macros exist or are inline", () => {
    const spec = {
      name: "test",
      primitives: {
        execution: { macros: ["nonexistent_macro"] },
      },
    };
    const result = validateApp(spec);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.includes("nonexistent_macro")));
  });

  it("passes macros that exist in global MACROS", () => {
    globalThis._concordMACROS = new Map([
      ["domain1", new Map([["existingMacro", {}]])],
    ]);
    const spec = {
      name: "test",
      primitives: {
        execution: { macros: ["existingMacro"] },
      },
    };
    const result = validateApp(spec);
    // macro check should pass
    assert.ok(!result.violations.some(v => v.includes("existingMacro")));
  });

  it("passes macros defined as inline", () => {
    const spec = {
      name: "test",
      primitives: {
        execution: { macros: ["myMacro"] },
      },
      _inlineMacros: { myMacro: {} },
    };
    const result = validateApp(spec);
    assert.ok(!result.violations.some(v => v.includes("myMacro")));
  });

  it("checks panel source references", () => {
    const spec = {
      name: "test",
      primitives: {
        artifacts: { types: ["workout"] },
      },
      ui: {
        panels: [{ source: "nonexistent" }],
      },
    };
    const result = validateApp(spec);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => v.includes("nonexistent")));
  });

  it("passes panels referencing existing types", () => {
    const spec = {
      name: "test",
      primitives: {
        artifacts: { types: ["workout"] },
      },
      ui: {
        panels: [{ source: "workout" }],
      },
    };
    const result = validateApp(spec);
    assert.ok(!result.violations.some(v => v.includes("workout")));
  });
});

// ── createApp ────────────────────────────────────────────────────────────────

describe("createApp", () => {
  it("creates an app with defaults", () => {
    const result = createApp({});
    assert.equal(result.ok, true);
    assert.ok(result.app.id.startsWith("app_"));
    assert.equal(result.app.status, "draft");
  });

  it("creates an app with name and author", () => {
    const result = createApp({ name: "MyApp", author: "alice" });
    assert.equal(result.ok, true);
    assert.equal(result.app.name, "MyApp");
  });

  it("validates the app on creation", () => {
    const result = createApp({ name: "GoodApp", primitives: {} });
    assert.equal(result.ok, true);
    assert.equal(typeof result.app.valid, "boolean");
  });

  it("emits realtime event when available", () => {
    let emitted = null;
    globalThis.realtimeEmit = (event, data) => { emitted = { event, data }; };
    createApp({ name: "EmitTest" });
    assert.equal(emitted.event, "app:created");
  });
});

// ── getApp ───────────────────────────────────────────────────────────────────

describe("getApp", () => {
  it("returns not found for unknown id", () => {
    const result = getApp("nonexistent");
    assert.equal(result.ok, false);
    assert.ok(result.error);
  });

  it("returns the app for a known id", () => {
    const created = createApp({ name: "FindMe" });
    const result = getApp(created.app.id);
    assert.equal(result.ok, true);
    assert.equal(result.app.name, "FindMe");
  });
});

// ── listApps ─────────────────────────────────────────────────────────────────

describe("listApps", () => {
  it("lists all apps", () => {
    const result = listApps();
    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.apps));
  });

  it("filters by status", () => {
    createApp({ name: "Draft1" });
    const result = listApps({ status: "draft" });
    assert.ok(result.apps.every(a => a.status === "draft"));
  });

  it("filters by author", () => {
    createApp({ name: "ByAlice", author: "alice_filter_test" });
    const result = listApps({ author: "alice_filter_test" });
    assert.ok(result.apps.every(a => a.author === "alice_filter_test"));
  });
});

// ── updateApp ────────────────────────────────────────────────────────────────

describe("updateApp", () => {
  it("updates name of a draft app", () => {
    const app = createApp({ name: "Old" }).app;
    const result = updateApp(app.id, { name: "New" });
    assert.equal(result.ok, true);
    assert.equal(result.app.name, "New");
  });

  it("returns error for unknown app", () => {
    const result = updateApp("nonexistent", { name: "x" });
    assert.equal(result.ok, false);
  });

  it("rejects updates to non-draft apps", () => {
    const app = createApp({ name: "Promote", primitives: {} }).app;
    // Force promote by hacking internal state
    const gotten = getApp(app.id).app;
    gotten.status = "published";
    const result = updateApp(app.id, { name: "x" });
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("draft"));
  });

  it("updates version, primitives, ui, and inlineMacros", () => {
    const app = createApp({ name: "UpdateAll" }).app;
    const result = updateApp(app.id, {
      version: "2.0.0",
      primitives: { artifacts: {} },
      ui: { lens: "new" },
      _inlineMacros: { m1: {} },
    });
    assert.equal(result.ok, true);
  });
});

// ── deleteApp ────────────────────────────────────────────────────────────────

describe("deleteApp", () => {
  it("deletes a draft app", () => {
    const app = createApp({ name: "ToDelete" }).app;
    const result = deleteApp(app.id);
    assert.equal(result.ok, true);
    assert.equal(result.deleted, app.id);
    assert.equal(getApp(app.id).ok, false);
  });

  it("returns error for unknown app", () => {
    const result = deleteApp("nonexistent");
    assert.equal(result.ok, false);
  });

  it("rejects deleting non-draft app", () => {
    const app = createApp({ name: "NoDel" }).app;
    getApp(app.id).app.status = "published";
    const result = deleteApp(app.id);
    assert.equal(result.ok, false);
  });
});

// ── promoteApp ───────────────────────────────────────────────────────────────

describe("promoteApp", () => {
  it("promotes draft to published", () => {
    const app = createApp({ name: "Promo", primitives: {} }).app;
    const result = promoteApp(app.id);
    assert.equal(result.ok, true);
    assert.equal(result.stage, "published");
  });

  it("returns error for unknown app", () => {
    const result = promoteApp("nonexistent");
    assert.equal(result.ok, false);
  });

  it("rejects promotion at max stage", () => {
    const app = createApp({ name: "MaxStage", primitives: {} }).app;
    getApp(app.id).app._promotionStage = "global";
    const result = promoteApp(app.id);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("max stage"));
  });

  it("rejects promotion with validation errors", () => {
    const app = createApp({}).app; // missing name validation will pass since createApp gives default
    // Remove name to force invalid
    getApp(app.id).app.name = "";
    const result = promoteApp(app.id);
    assert.equal(result.ok, false);
    assert.ok(result.violations || result.error);
  });

  it("sets publishedAt on first publish", () => {
    const app = createApp({ name: "PubAt", primitives: {} }).app;
    promoteApp(app.id);
    const gotten = getApp(app.id).app;
    assert.ok(gotten.publishedAt);
  });

  it("emits realtime event on promotion", () => {
    let emitted = null;
    globalThis.realtimeEmit = (event, data) => { emitted = { event, data }; };
    const app = createApp({ name: "EmitPromo", primitives: {} }).app;
    promoteApp(app.id);
    assert.equal(emitted.event, "app:published");
  });
});

// ── demoteApp ────────────────────────────────────────────────────────────────

describe("demoteApp", () => {
  it("demotes published to draft", () => {
    const app = createApp({ name: "Demote", primitives: {} }).app;
    promoteApp(app.id);
    const result = demoteApp(app.id);
    assert.equal(result.ok, true);
    assert.equal(result.stage, "draft");
  });

  it("returns error for unknown app", () => {
    const result = demoteApp("nonexistent");
    assert.equal(result.ok, false);
  });

  it("rejects demotion at draft", () => {
    const app = createApp({ name: "AlreadyDraft" }).app;
    const result = demoteApp(app.id);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("draft"));
  });
});

// ── countApps / countAppsByStage / getAppMetrics ─────────────────────────────

describe("countApps", () => {
  it("returns a number", () => {
    assert.equal(typeof countApps(), "number");
  });
});

describe("countAppsByStage", () => {
  it("returns an object with stage keys", () => {
    const result = countAppsByStage();
    assert.ok("draft" in result);
    assert.ok("published" in result);
    assert.ok("marketplace" in result);
    assert.ok("global" in result);
  });
});

describe("getAppMetrics", () => {
  it("returns ok with total and byStage", () => {
    const result = getAppMetrics();
    assert.equal(result.ok, true);
    assert.equal(typeof result.total, "number");
    assert.ok(result.byStage);
  });
});

// ── handleAppCommand ─────────────────────────────────────────────────────────

describe("handleAppCommand", () => {
  it("handles app-list", () => {
    const result = handleAppCommand(["app-list"]);
    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.apps));
  });

  it("handles app-status with valid id", () => {
    const app = createApp({ name: "CmdStatus" }).app;
    const result = handleAppCommand(["app-status", app.id]);
    assert.equal(result.ok, true);
  });

  it("handles app-status with invalid id", () => {
    const result = handleAppCommand(["app-status", "nonexistent"]);
    assert.equal(result.ok, false);
  });

  it("handles app-promote", () => {
    const app = createApp({ name: "CmdPromote", primitives: {} }).app;
    const result = handleAppCommand(["app-promote", app.id]);
    assert.equal(result.ok, true);
  });

  it("handles app-demote", () => {
    const app = createApp({ name: "CmdDemote", primitives: {} }).app;
    promoteApp(app.id);
    const result = handleAppCommand(["app-demote", app.id]);
    assert.equal(result.ok, true);
  });

  it("handles app-validate with valid app", () => {
    const app = createApp({ name: "CmdValidate", primitives: {} }).app;
    const result = handleAppCommand(["app-validate", app.id]);
    assert.equal(typeof result.valid, "boolean");
  });

  it("handles app-validate with missing app", () => {
    const result = handleAppCommand(["app-validate", "missing"]);
    assert.equal(result.ok, false);
  });

  it("returns error for unknown subcommand", () => {
    const result = handleAppCommand(["app-unknown"]);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("Unknown"));
  });
});

// ── init ─────────────────────────────────────────────────────────────────────

describe("init", () => {
  it("returns ok", () => {
    const result = init();
    assert.equal(result.ok, true);
  });

  it("accepts STATE and helpers args", () => {
    const result = init({ STATE: {}, helpers: {} });
    assert.equal(result.ok, true);
  });
});
