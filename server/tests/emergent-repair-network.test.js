/**
 * Tests for emergent/repair-network.js — Global Repair Network
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Mock fetch globally before importing module
const fetchMock = mock.fn();
globalThis.fetch = fetchMock;

import {
  pushFixes,
  pullFixes,
  getStatus,
  disconnect,
  handleRepairNetworkCommand,
  init,
  stop,
} from "../emergent/repair-network.js";

describe("repair-network", () => {

  beforeEach(() => {
    fetchMock.mock.resetCalls();
    globalThis._concordRepairMemory = new Map();
  });

  afterEach(() => {
    stop();
    delete globalThis._concordRepairMemory;
  });

  // ── getStatus ───────────────────────────────────────────────────────────

  describe("getStatus", () => {
    it("returns status with enabled flag", () => {
      const s = getStatus();
      assert.equal(s.ok, true);
      assert.equal(typeof s.enabled, "boolean");
      assert.equal(typeof s.tier, "string");
      assert.equal(s.lastPush, null);
      assert.equal(s.lastPull, null);
      assert.equal(s.globalFixCount, 0);
    });
  });

  // ── pushFixes ─────────────────────────────────────────────────────────

  describe("pushFixes", () => {
    it("returns not enabled when env not set", async () => {
      const r = await pushFixes();
      assert.equal(r.ok, false);
      assert.match(r.error, /not enabled/i);
    });
  });

  // ── pullFixes ─────────────────────────────────────────────────────────

  describe("pullFixes", () => {
    it("returns not enabled when env not set", async () => {
      const r = await pullFixes();
      assert.equal(r.ok, false);
      assert.match(r.error, /not enabled/i);
    });
  });

  // ── disconnect ────────────────────────────────────────────────────────

  describe("disconnect", () => {
    it("returns ok and disconnected", () => {
      const r = disconnect();
      assert.equal(r.ok, true);
      assert.equal(r.disconnected, true);
    });
  });

  // ── handleRepairNetworkCommand ────────────────────────────────────────

  describe("handleRepairNetworkCommand", () => {
    it("routes repair-network-status", () => {
      const r = handleRepairNetworkCommand(["repair-network-status"]);
      assert.equal(r.ok, true);
      assert.equal(typeof r.tier, "string");
    });

    it("routes repair-network-contribute", async () => {
      const r = await handleRepairNetworkCommand(["repair-network-contribute"]);
      assert.equal(r.ok, false); // not enabled
    });

    it("routes repair-network-pull", async () => {
      const r = await handleRepairNetworkCommand(["repair-network-pull"]);
      assert.equal(r.ok, false); // not enabled
    });

    it("routes repair-network-disconnect", () => {
      const r = handleRepairNetworkCommand(["repair-network-disconnect"]);
      assert.equal(r.ok, true);
      assert.equal(r.disconnected, true);
    });

    it("returns error for unknown command", () => {
      const r = handleRepairNetworkCommand(["unknown-command"]);
      assert.equal(r.ok, false);
      assert.match(r.error, /Unknown/);
    });

    it("handles undefined parts[0]", () => {
      const r = handleRepairNetworkCommand([]);
      assert.equal(r.ok, false);
    });
  });

  // ── init ──────────────────────────────────────────────────────────────

  describe("init", () => {
    it("returns disabled message when network not enabled", () => {
      const r = init({});
      assert.equal(r.ok, true);
      assert.equal(r.enabled, false);
    });

    it("works with no arguments", () => {
      const r = init();
      assert.equal(r.ok, true);
    });
  });

  // ── stop ──────────────────────────────────────────────────────────────

  describe("stop", () => {
    it("calls disconnect without error", () => {
      stop(); // should not throw
    });
  });
});
