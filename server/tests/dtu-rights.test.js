import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  initRightsTable,
  createRightsManager,
  LICENSE_TYPES,
} from "../lib/dtu-rights.js";

describe("dtu-rights", () => {
  let db;
  let mgr;

  beforeEach(() => {
    db = new Database(":memory:");
    initRightsTable(db);
    mgr = createRightsManager(db);
  });

  // ── initRightsTable ────────────────────────────────────────────────

  describe("initRightsTable", () => {
    it("creates the dtu_rights table", () => {
      const freshDb = new Database(":memory:");
      const result = initRightsTable(freshDb);
      assert.equal(result, true);

      const tables = freshDb
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='dtu_rights'"
        )
        .all();
      assert.equal(tables.length, 1);
    });

    it("returns false for null db", () => {
      assert.equal(initRightsTable(null), false);
    });

    it("is idempotent", () => {
      const freshDb = new Database(":memory:");
      assert.equal(initRightsTable(freshDb), true);
      assert.equal(initRightsTable(freshDb), true);
    });
  });

  // ── assignRights ───────────────────────────────────────────────────

  describe("assignRights", () => {
    it("creates a new rights record", () => {
      const result = mgr.assignRights("dtu_1", {
        creatorId: "user_creator",
      });

      assert.equal(result.ok, true);
      assert.ok(result.rights);
      assert.equal(result.rights.dtuId, "dtu_1");
      assert.equal(result.rights.creatorId, "user_creator");
      assert.equal(result.rights.ownerId, "user_creator");
    });

    it("applies standard license defaults", () => {
      const result = mgr.assignRights("dtu_2", {
        creatorId: "user1",
        license: "standard",
      });

      assert.equal(result.rights.derivativeAllowed, true);
      assert.equal(result.rights.commercialAllowed, false);
      assert.equal(result.rights.attributionRequired, true);
      assert.equal(result.rights.transferable, true);
    });

    it("applies commercial license defaults", () => {
      const result = mgr.assignRights("dtu_3", {
        creatorId: "user1",
        license: "commercial",
      });

      assert.equal(result.rights.derivativeAllowed, false);
      assert.equal(result.rights.commercialAllowed, true);
    });

    it("applies exclusive license — no derivatives, no transfer", () => {
      const result = mgr.assignRights("dtu_4", {
        creatorId: "user1",
        license: "exclusive",
      });

      assert.equal(result.rights.derivativeAllowed, false);
      assert.equal(result.rights.commercialAllowed, false);
      assert.equal(result.rights.transferable, false);
    });

    it("allows explicit overrides over license defaults", () => {
      const result = mgr.assignRights("dtu_5", {
        creatorId: "user1",
        license: "standard",
        commercialAllowed: true, // override standard default (false)
      });

      assert.equal(result.rights.commercialAllowed, true);
    });

    it("sets a different owner from creator", () => {
      const result = mgr.assignRights("dtu_6", {
        creatorId: "user_creator",
        ownerId: "user_owner",
      });

      assert.equal(result.rights.creatorId, "user_creator");
      assert.equal(result.rights.ownerId, "user_owner");
    });

    it("validates scope to allowed values", () => {
      const result = mgr.assignRights("dtu_7", {
        creatorId: "user1",
        scope: "invalid_scope",
      });
      // Falls back to "local"
      assert.equal(result.rights.scope, "local");
    });

    it("returns error for missing dtuId", () => {
      const result = mgr.assignRights(null, { creatorId: "u1" });
      assert.equal(result.ok, false);
      assert.equal(result.error, "missing_dtu_id");
    });

    it("returns error for missing creatorId", () => {
      const result = mgr.assignRights("dtu_8", {});
      assert.equal(result.ok, false);
      assert.equal(result.error, "missing_creator_id");
    });

    it("updates existing rights on re-assignment", () => {
      mgr.assignRights("dtu_upd", {
        creatorId: "u1",
        license: "standard",
      });
      mgr.assignRights("dtu_upd", {
        creatorId: "u1",
        license: "open",
      });

      const rights = mgr.getRights("dtu_upd");
      assert.equal(rights.license, "open");
    });
  });

  // ── checkPermission ────────────────────────────────────────────────

  describe("checkPermission", () => {
    it("allows creator full access", () => {
      mgr.assignRights("dtu_perm", { creatorId: "creator1" });
      const result = mgr.checkPermission("dtu_perm", "creator1", "write");
      assert.equal(result.allowed, true);
    });

    it("allows owner most access", () => {
      mgr.assignRights("dtu_own", {
        creatorId: "c1",
        ownerId: "o1",
      });
      const result = mgr.checkPermission("dtu_own", "o1", "read");
      assert.equal(result.allowed, true);
    });

    it("denies write to non-owner/non-creator", () => {
      mgr.assignRights("dtu_wr", { creatorId: "c1" });
      const result = mgr.checkPermission("dtu_wr", "stranger", "write");
      assert.equal(result.allowed, false);
    });

    it("denies derive when derivativeAllowed=false", () => {
      mgr.assignRights("dtu_nod", {
        creatorId: "c1",
        derivativeAllowed: false,
      });
      const result = mgr.checkPermission("dtu_nod", "other", "derive");
      assert.equal(result.allowed, false);
    });

    it("allows derive when derivativeAllowed=true", () => {
      mgr.assignRights("dtu_ysd", {
        creatorId: "c1",
        derivativeAllowed: true,
      });
      const result = mgr.checkPermission("dtu_ysd", "other", "derive");
      assert.equal(result.allowed, true);
    });

    it("denies sell when commercialAllowed=false for non-owner", () => {
      mgr.assignRights("dtu_nos", {
        creatorId: "c1",
        commercialAllowed: false,
      });
      // Creator has full access, so test with a different user
      const result = mgr.checkPermission("dtu_nos", "other_user", "sell");
      assert.equal(result.allowed, false);
    });

    it("denies unknown action", () => {
      const result = mgr.checkPermission("dtu_x", "u1", "fly");
      assert.equal(result.allowed, false);
    });

    it("denies revoked user", () => {
      mgr.assignRights("dtu_rev", { creatorId: "c1" });
      mgr.revokeAccess("dtu_rev", "banned_user");
      const result = mgr.checkPermission("dtu_rev", "banned_user", "read");
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes("revoked"));
    });

    it("denies access after expiration", () => {
      const expired = new Date(Date.now() - 86400000).toISOString();
      mgr.assignRights("dtu_exp", {
        creatorId: "c1",
        expiration: expired,
      });
      // Non-creator user should be denied
      const result = mgr.checkPermission("dtu_exp", "other", "read");
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes("expired"));
    });

    it("allows unrestricted when no rights record exists", () => {
      const result = mgr.checkPermission("dtu_none", "anyone", "read");
      assert.equal(result.allowed, true);
    });

    it("denies transfer when not transferable for non-owner", () => {
      mgr.assignRights("dtu_nt", {
        creatorId: "c1",
        ownerId: "o1",
        transferable: false,
      });
      // Owner has full access, so test with a different user
      const result = mgr.checkPermission("dtu_nt", "other_user", "transfer");
      assert.equal(result.allowed, false);
    });

    it("limits max derivatives", () => {
      mgr.assignRights("dtu_maxd", {
        creatorId: "c1",
        derivativeAllowed: true,
        maxDerivatives: 0,
      });
      const result = mgr.checkPermission("dtu_maxd", "other", "derive");
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes("Max derivatives"));
    });
  });

  // ── transferOwnership ──────────────────────────────────────────────

  describe("transferOwnership", () => {
    it("transfers ownership from current owner", () => {
      mgr.assignRights("dtu_tr", {
        creatorId: "c1",
        ownerId: "owner_a",
      });
      const result = mgr.transferOwnership("dtu_tr", "owner_a", "owner_b");

      assert.equal(result.ok, true);
      assert.equal(result.previousOwner, "owner_a");
      assert.equal(result.newOwner, "owner_b");

      const rights = mgr.getRights("dtu_tr");
      assert.equal(rights.ownerId, "owner_b");
    });

    it("records transfer in history", () => {
      mgr.assignRights("dtu_th", {
        creatorId: "c1",
        ownerId: "a",
      });
      mgr.transferOwnership("dtu_th", "a", "b");
      mgr.transferOwnership("dtu_th", "b", "c");

      const rights = mgr.getRights("dtu_th");
      assert.equal(rights.transferHistory.length, 2);
      assert.equal(rights.transferHistory[0].from, "a");
      assert.equal(rights.transferHistory[1].to, "c");
    });

    it("denies transfer from non-owner", () => {
      mgr.assignRights("dtu_no_tr", {
        creatorId: "c1",
        ownerId: "actual_owner",
      });
      const result = mgr.transferOwnership(
        "dtu_no_tr",
        "not_owner",
        "target"
      );
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("current owner"));
    });

    it("denies transfer on non-transferable DTU", () => {
      mgr.assignRights("dtu_locked", {
        creatorId: "c1",
        ownerId: "o1",
        transferable: false,
      });
      const result = mgr.transferOwnership("dtu_locked", "o1", "o2");
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("not transferable"));
    });

    it("denies transfer on expired rights", () => {
      const expired = new Date(Date.now() - 86400000).toISOString();
      mgr.assignRights("dtu_tr_exp", {
        creatorId: "c1",
        ownerId: "o1",
        expiration: expired,
      });
      const result = mgr.transferOwnership("dtu_tr_exp", "o1", "o2");
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("expired"));
    });

    it("returns error for non-existent DTU", () => {
      const result = mgr.transferOwnership("dtu_ghost", "a", "b");
      assert.equal(result.ok, false);
    });
  });

  // ── grantDerivativeRights ──────────────────────────────────────────

  describe("grantDerivativeRights", () => {
    it("enables derivatives on a DTU", () => {
      mgr.assignRights("dtu_gr", {
        creatorId: "c1",
        derivativeAllowed: false,
      });
      const result = mgr.grantDerivativeRights("dtu_gr", {});
      assert.equal(result.ok, true);
      assert.equal(result.derivativeAllowed, true);
    });

    it("sets max derivatives", () => {
      mgr.assignRights("dtu_max", { creatorId: "c1" });
      const result = mgr.grantDerivativeRights("dtu_max", {
        maxDerivatives: 5,
      });
      assert.equal(result.maxDerivatives, 5);
    });

    it("grants to a specific user", () => {
      mgr.assignRights("dtu_gu", { creatorId: "c1" });
      mgr.grantDerivativeRights("dtu_gu", { grantedTo: "user_x" });

      const rights = mgr.getRights("dtu_gu");
      assert.ok(rights.grantedUsers.includes("user_x"));
    });

    it("returns error for non-existent DTU", () => {
      const result = mgr.grantDerivativeRights("dtu_nope", {});
      assert.equal(result.ok, false);
    });
  });

  // ── checkCommercialRights ──────────────────────────────────────────

  describe("checkCommercialRights", () => {
    it("returns allowed=true when commercial is enabled", () => {
      mgr.assignRights("dtu_com", {
        creatorId: "c1",
        commercialAllowed: true,
      });
      const result = mgr.checkCommercialRights("dtu_com");
      assert.equal(result.allowed, true);
    });

    it("returns allowed=false when commercial is disabled", () => {
      mgr.assignRights("dtu_nocom", {
        creatorId: "c1",
        commercialAllowed: false,
      });
      const result = mgr.checkCommercialRights("dtu_nocom");
      assert.equal(result.allowed, false);
    });

    it("returns allowed=true when no rights record exists (unrestricted)", () => {
      const result = mgr.checkCommercialRights("dtu_unrestricted");
      assert.equal(result.allowed, true);
    });

    it("returns allowed=false when rights are expired", () => {
      const expired = new Date(Date.now() - 86400000).toISOString();
      mgr.assignRights("dtu_comexp", {
        creatorId: "c1",
        commercialAllowed: true,
        expiration: expired,
      });
      const result = mgr.checkCommercialRights("dtu_comexp");
      assert.equal(result.allowed, false);
    });
  });

  // ── revokeAccess ───────────────────────────────────────────────────

  describe("revokeAccess", () => {
    it("revokes a user's access", () => {
      mgr.assignRights("dtu_rvk", { creatorId: "c1" });
      const result = mgr.revokeAccess("dtu_rvk", "bad_user");
      assert.equal(result.ok, true);

      const rights = mgr.getRights("dtu_rvk");
      assert.ok(rights.revokedUsers.includes("bad_user"));
    });

    it("cannot revoke creator's access", () => {
      mgr.assignRights("dtu_norvc", { creatorId: "c1" });
      const result = mgr.revokeAccess("dtu_norvc", "c1");
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("creator"));
    });

    it("removes user from granted list on revocation", () => {
      mgr.assignRights("dtu_rgr", { creatorId: "c1" });
      mgr.grantDerivativeRights("dtu_rgr", { grantedTo: "user_g" });
      mgr.revokeAccess("dtu_rgr", "user_g");

      const rights = mgr.getRights("dtu_rgr");
      assert.ok(!rights.grantedUsers.includes("user_g"));
      assert.ok(rights.revokedUsers.includes("user_g"));
    });

    it("is idempotent — revoking twice does not duplicate", () => {
      mgr.assignRights("dtu_idm", { creatorId: "c1" });
      mgr.revokeAccess("dtu_idm", "u1");
      mgr.revokeAccess("dtu_idm", "u1");

      const rights = mgr.getRights("dtu_idm");
      const count = rights.revokedUsers.filter((u) => u === "u1").length;
      assert.equal(count, 1);
    });

    it("returns error for non-existent DTU", () => {
      const result = mgr.revokeAccess("dtu_ghost", "u1");
      assert.equal(result.ok, false);
    });
  });

  // ── enforceAttribution ─────────────────────────────────────────────

  describe("enforceAttribution", () => {
    it("returns attribution required when source has attributionRequired", () => {
      mgr.assignRights("dtu_source", {
        creatorId: "original_author",
        attributionRequired: true,
      });
      mgr.assignRights("dtu_deriv", { creatorId: "deriver" });

      const result = mgr.enforceAttribution("dtu_deriv", "dtu_source");
      assert.equal(result.ok, true);
      assert.equal(result.attributionRequired, true);
      assert.equal(result.sourceCreatorId, "original_author");
    });

    it("returns no attribution when source does not require it", () => {
      mgr.assignRights("dtu_source2", {
        creatorId: "c1",
        attributionRequired: false,
      });
      mgr.assignRights("dtu_deriv2", { creatorId: "c2" });

      const result = mgr.enforceAttribution("dtu_deriv2", "dtu_source2");
      assert.equal(result.attributionRequired, false);
    });

    it("returns no attribution when no source specified", () => {
      mgr.assignRights("dtu_alone", { creatorId: "c1" });
      const result = mgr.enforceAttribution("dtu_alone");
      assert.equal(result.attributionRequired, false);
    });
  });

  // ── LICENSE_TYPES ──────────────────────────────────────────────────

  describe("LICENSE_TYPES", () => {
    it("exposes known license types", () => {
      assert.ok(LICENSE_TYPES.standard);
      assert.ok(LICENSE_TYPES.creative_commons);
      assert.ok(LICENSE_TYPES.commercial);
      assert.ok(LICENSE_TYPES.exclusive);
      assert.ok(LICENSE_TYPES.open);
    });

    it("open license has no restrictions", () => {
      assert.equal(LICENSE_TYPES.open.derivativeAllowed, true);
      assert.equal(LICENSE_TYPES.open.commercialAllowed, true);
      assert.equal(LICENSE_TYPES.open.attributionRequired, false);
      assert.equal(LICENSE_TYPES.open.transferable, true);
    });

    it("is frozen (immutable)", () => {
      assert.ok(Object.isFrozen(LICENSE_TYPES));
    });
  });
});
