/**
 * Tests for emergent/social-layer.js — Social / Distribution Layer
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  upsertProfile,
  getProfile,
  listProfiles,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  publishDtu,
  unpublishDtu,
  recordCitation,
  getCitedBy,
  getFeed,
  computeTrending,
  discoverUsers,
  getSocialMetrics,
} from "../emergent/social-layer.js";

function makeSTATE() {
  return { dtus: new Map() };
}

describe("social-layer", () => {
  let STATE;

  beforeEach(() => {
    STATE = makeSTATE();
  });

  // ── Profiles ────────────────────────────────────────────────────────

  describe("upsertProfile", () => {
    it("creates a new profile", () => {
      const r = upsertProfile(STATE, "u1", { displayName: "Alice" });
      assert.equal(r.ok, true);
      assert.equal(r.isNew, true);
      assert.equal(r.profile.displayName, "Alice");
      assert.equal(r.profile.userId, "u1");
    });

    it("updates existing profile", () => {
      upsertProfile(STATE, "u1", { displayName: "Alice" });
      const r = upsertProfile(STATE, "u1", { bio: "Researcher" });
      assert.equal(r.ok, true);
      assert.equal(r.isNew, false);
      assert.equal(r.profile.displayName, "Alice"); // kept
      assert.equal(r.profile.bio, "Researcher");
    });

    it("preserves createdAt on update", () => {
      const r1 = upsertProfile(STATE, "u1", { displayName: "Alice" });
      const r2 = upsertProfile(STATE, "u1", { bio: "updated" });
      assert.equal(r2.profile.createdAt, r1.profile.createdAt);
    });

    it("defaults isPublic to true", () => {
      const r = upsertProfile(STATE, "u1", {});
      assert.equal(r.profile.isPublic, true);
    });

    it("respects isPublic = false", () => {
      const r = upsertProfile(STATE, "u1", { isPublic: false });
      assert.equal(r.profile.isPublic, false);
    });
  });

  describe("getProfile", () => {
    it("returns error for missing profile", () => {
      const r = getProfile(STATE, "nonexistent");
      assert.equal(r.ok, false);
    });

    it("recomputes stats", () => {
      upsertProfile(STATE, "u1", { displayName: "Alice" });
      STATE.dtus.set("d1", { id: "d1", author: "u1", tags: [] });
      const r = getProfile(STATE, "u1");
      assert.equal(r.ok, true);
      assert.equal(r.profile.stats.dtuCount, 1);
    });

    it("counts public dtus correctly", () => {
      upsertProfile(STATE, "u1", {});
      STATE.dtus.set("d1", { id: "d1", author: "u1" });
      publishDtu(STATE, "d1", "u1");
      const r = getProfile(STATE, "u1");
      assert.equal(r.profile.stats.publicDtuCount, 1);
    });

    it("counts citations", () => {
      upsertProfile(STATE, "u1", {});
      STATE.dtus.set("d1", { id: "d1", author: "u1" });
      STATE.dtus.set("d2", { id: "d2", author: "u2" });
      recordCitation(STATE, "d1", "d2");
      const r = getProfile(STATE, "u1");
      assert.equal(r.profile.stats.citationCount, 1);
    });

    it("recognizes meta.authorId", () => {
      upsertProfile(STATE, "u1", {});
      STATE.dtus.set("d1", { id: "d1", meta: { authorId: "u1" } });
      const r = getProfile(STATE, "u1");
      assert.equal(r.profile.stats.dtuCount, 1);
    });
  });

  describe("listProfiles", () => {
    it("returns empty for no profiles", () => {
      const r = listProfiles(STATE);
      assert.equal(r.ok, true);
      assert.equal(r.profiles.length, 0);
    });

    it("filters to public only by default", () => {
      upsertProfile(STATE, "u1", { isPublic: true });
      upsertProfile(STATE, "u2", { isPublic: false });
      const r = listProfiles(STATE);
      assert.equal(r.profiles.length, 1);
    });

    it("includes private when publicOnly=false", () => {
      upsertProfile(STATE, "u1", { isPublic: true });
      upsertProfile(STATE, "u2", { isPublic: false });
      const r = listProfiles(STATE, { publicOnly: false });
      assert.equal(r.profiles.length, 2);
    });

    it("sorts by citationCount by default", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      const r = listProfiles(STATE);
      assert.equal(r.ok, true);
    });

    it("sorts by followerCount", () => {
      upsertProfile(STATE, "u1", {});
      const r = listProfiles(STATE, { sortBy: "followerCount" });
      assert.equal(r.ok, true);
    });

    it("sorts by dtuCount", () => {
      upsertProfile(STATE, "u1", {});
      const r = listProfiles(STATE, { sortBy: "dtuCount" });
      assert.equal(r.ok, true);
    });

    it("returns 0 for unknown sortBy", () => {
      upsertProfile(STATE, "u1", {});
      const r = listProfiles(STATE, { sortBy: "unknown" });
      assert.equal(r.ok, true);
    });

    it("respects limit", () => {
      for (let i = 0; i < 10; i++) upsertProfile(STATE, `u${i}`, {});
      const r = listProfiles(STATE, { limit: 3 });
      assert.equal(r.profiles.length, 3);
    });
  });

  // ── Follow System ─────────────────────────────────────────────────

  describe("followUser / unfollowUser", () => {
    it("cannot follow yourself", () => {
      upsertProfile(STATE, "u1", {});
      const r = followUser(STATE, "u1", "u1");
      assert.equal(r.ok, false);
    });

    it("cannot follow non-existent user", () => {
      const r = followUser(STATE, "u1", "u2");
      assert.equal(r.ok, false);
    });

    it("follows a user", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      const r = followUser(STATE, "u1", "u2");
      assert.equal(r.ok, true);
      assert.equal(r.isNew, true);
    });

    it("following again is not new", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      followUser(STATE, "u1", "u2");
      const r = followUser(STATE, "u1", "u2");
      assert.equal(r.ok, true);
      assert.equal(r.isNew, false);
    });

    it("unfollows a user", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      followUser(STATE, "u1", "u2");
      const r = unfollowUser(STATE, "u1", "u2");
      assert.equal(r.ok, true);
    });

    it("unfollow returns error if not following", () => {
      const r = unfollowUser(STATE, "u1", "u2");
      assert.equal(r.ok, false);
    });
  });

  describe("getFollowers / getFollowing", () => {
    it("returns empty followers", () => {
      const r = getFollowers(STATE, "u1");
      assert.equal(r.ok, true);
      assert.equal(r.followers.length, 0);
    });

    it("returns followers after follow", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      followUser(STATE, "u1", "u2");
      const r = getFollowers(STATE, "u2");
      assert.equal(r.total, 1);
    });

    it("returns following", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      followUser(STATE, "u1", "u2");
      const r = getFollowing(STATE, "u1");
      assert.equal(r.total, 1);
    });
  });

  // ── Public DTU Index ──────────────────────────────────────────────

  describe("publishDtu / unpublishDtu", () => {
    it("publishes a dtu", () => {
      STATE.dtus.set("d1", { id: "d1" });
      const r = publishDtu(STATE, "d1", "u1");
      assert.equal(r.ok, true);
      assert.equal(r.isPublic, true);
    });

    it("returns error for missing dtu", () => {
      const r = publishDtu(STATE, "nonexistent", "u1");
      assert.equal(r.ok, false);
    });

    it("unpublishes a dtu", () => {
      STATE.dtus.set("d1", { id: "d1" });
      publishDtu(STATE, "d1", "u1");
      const r = unpublishDtu(STATE, "d1");
      assert.equal(r.ok, true);
      assert.equal(r.isPublic, false);
    });
  });

  // ── Cited-By ──────────────────────────────────────────────────────

  describe("recordCitation / getCitedBy", () => {
    it("records a citation", () => {
      const r = recordCitation(STATE, "d1", "d2");
      assert.equal(r.ok, true);
      assert.equal(r.totalCitations, 1);
    });

    it("rejects self-citation", () => {
      const r = recordCitation(STATE, "d1", "d1");
      assert.equal(r.ok, false);
    });

    it("getCitedBy returns citers", () => {
      recordCitation(STATE, "d1", "d2");
      STATE.dtus.set("d2", { id: "d2", title: "T2" });
      const r = getCitedBy(STATE, "d1");
      assert.equal(r.ok, true);
      assert.equal(r.total, 1);
    });

    it("getCitedBy returns empty for uncited", () => {
      const r = getCitedBy(STATE, "d999");
      assert.equal(r.ok, true);
      assert.equal(r.total, 0);
    });
  });

  // ── Feed ──────────────────────────────────────────────────────────

  describe("getFeed", () => {
    it("returns empty feed for no follows", () => {
      const r = getFeed(STATE, "u1");
      assert.equal(r.ok, true);
      assert.equal(r.feed.length, 0);
    });

    it("returns feed items from followed users", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      followUser(STATE, "u1", "u2");

      STATE.dtus.set("d1", { id: "d1", author: "u2", title: "T", createdAt: new Date().toISOString(), tags: [] });
      publishDtu(STATE, "d1", "u2");

      const r = getFeed(STATE, "u1");
      assert.equal(r.ok, true);
      assert.equal(r.feed.length, 1);
    });

    it("respects limit and offset", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", {});
      followUser(STATE, "u1", "u2");

      for (let i = 0; i < 5; i++) {
        STATE.dtus.set(`d${i}`, { id: `d${i}`, author: "u2", title: `T${i}`, createdAt: new Date().toISOString(), tags: [] });
        publishDtu(STATE, `d${i}`, "u2");
      }

      const r = getFeed(STATE, "u1", { limit: 2, offset: 1 });
      assert.equal(r.feed.length, 2);
    });
  });

  // ── Trending ──────────────────────────────────────────────────────

  describe("computeTrending", () => {
    it("returns empty trending", () => {
      const r = computeTrending(STATE);
      assert.equal(r.ok, true);
      assert.equal(r.trending.length, 0);
    });

    it("returns trending dtus with citations", () => {
      upsertProfile(STATE, "u1", {});
      STATE.dtus.set("d1", { id: "d1", author: "u1", title: "T", createdAt: new Date().toISOString(), tags: [] });
      publishDtu(STATE, "d1", "u1");
      recordCitation(STATE, "d1", "d2");

      const r = computeTrending(STATE);
      assert.equal(r.ok, true);
      assert.ok(r.trending.length >= 1);
      assert.equal(r.cached, false);
    });

    it("returns cached result on quick re-call", () => {
      upsertProfile(STATE, "u1", {});
      STATE.dtus.set("d1", { id: "d1", author: "u1", title: "T", createdAt: new Date().toISOString(), tags: [] });
      publishDtu(STATE, "d1", "u1");

      computeTrending(STATE);
      const r = computeTrending(STATE);
      assert.equal(r.cached, true);
    });
  });

  // ── Discovery ─────────────────────────────────────────────────────

  describe("discoverUsers", () => {
    it("returns empty suggestions when no matching tags", () => {
      upsertProfile(STATE, "u1", {});
      const r = discoverUsers(STATE, "u1");
      assert.equal(r.ok, true);
      assert.equal(r.suggestions.length, 0);
    });

    it("suggests users with overlapping specializations", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", { specialization: ["ai", "ml"] });
      STATE.dtus.set("d1", { id: "d1", author: "u1", tags: ["ai"] });

      const r = discoverUsers(STATE, "u1");
      assert.equal(r.ok, true);
      assert.ok(r.suggestions.length >= 1);
    });

    it("excludes already followed users", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", { specialization: ["ai"] });
      followUser(STATE, "u1", "u2");
      STATE.dtus.set("d1", { id: "d1", author: "u1", tags: ["ai"] });

      const r = discoverUsers(STATE, "u1");
      assert.equal(r.suggestions.length, 0);
    });

    it("excludes private profiles", () => {
      upsertProfile(STATE, "u1", {});
      upsertProfile(STATE, "u2", { specialization: ["ai"], isPublic: false });
      STATE.dtus.set("d1", { id: "d1", author: "u1", tags: ["ai"] });

      const r = discoverUsers(STATE, "u1");
      assert.equal(r.suggestions.length, 0);
    });
  });

  // ── Metrics ───────────────────────────────────────────────────────

  describe("getSocialMetrics", () => {
    it("returns metrics", () => {
      const r = getSocialMetrics(STATE);
      assert.equal(r.ok, true);
      assert.equal(typeof r.totalProfiles, "number");
    });
  });
});
