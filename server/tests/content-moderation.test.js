import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  submitReport,
  getReport,
  listReports,
  resolveReport,
  restoreContent,
  scanContent,
  addCustomPattern,
  getModerationQueue,
  getContentAuditLog,
  getUserModerationStatus,
  getModerationMetrics,
  REPORT_CATEGORIES,
  MODERATION_ACTIONS,
  FLAG_SOURCES,
  MODERATION_STATUS,
} from "../lib/content-moderation.js";

describe("content-moderation", () => {
  let STATE;

  beforeEach(() => {
    STATE = {};
  });

  function makeReport(overrides = {}) {
    return {
      reporterId: "reporter1",
      contentId: "content_123",
      contentType: "media",
      category: "spam",
      reason: "This is spam content",
      ...overrides,
    };
  }

  // ── submitReport ───────────────────────────────────────────────────

  describe("submitReport", () => {
    it("creates a report with correct fields", () => {
      const result = submitReport(STATE, makeReport());

      assert.equal(result.ok, true);
      assert.ok(result.report.id.startsWith("report-"));
      assert.equal(result.report.reporterId, "reporter1");
      assert.equal(result.report.contentId, "content_123");
      assert.equal(result.report.category, "spam");
      assert.equal(result.report.status, "pending");
      assert.equal(result.report.source, "user_report");
      assert.ok(result.report.createdAt);
    });

    it("categorizes severity based on category", () => {
      const violence = submitReport(STATE, makeReport({ category: "violence", contentId: "c1" }));
      assert.equal(violence.report.severity, "critical");

      const harassment = submitReport(STATE, makeReport({ category: "harassment", contentId: "c2" }));
      assert.equal(harassment.report.severity, "high");

      const copyright = submitReport(STATE, makeReport({ category: "copyright", contentId: "c3" }));
      assert.equal(copyright.report.severity, "medium");

      const spam = submitReport(STATE, makeReport({ category: "spam", contentId: "c4" }));
      assert.equal(spam.report.severity, "low");
    });

    it("rejects report with missing reporterId", () => {
      const result = submitReport(STATE, makeReport({ reporterId: null }));
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("reporterId"));
    });

    it("rejects report with missing contentId", () => {
      const result = submitReport(STATE, makeReport({ contentId: null }));
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("contentId"));
    });

    it("rejects report with missing contentType", () => {
      const result = submitReport(STATE, makeReport({ contentType: null }));
      assert.equal(result.ok, false);
    });

    it("rejects report with invalid category", () => {
      const result = submitReport(STATE, makeReport({ category: "madeup" }));
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("Invalid category"));
    });

    it("prevents duplicate pending report from same user on same content", () => {
      submitReport(STATE, makeReport());
      const dup = submitReport(STATE, makeReport());
      assert.equal(dup.ok, false);
      assert.ok(dup.error.includes("already reported"));
    });

    it("creates audit trail entry on report submission", () => {
      submitReport(STATE, makeReport());
      const audit = getContentAuditLog(STATE, "content_123");
      assert.equal(audit.ok, true);
      assert.ok(audit.total > 0);
      assert.equal(audit.entries[0].action, "flag");
    });

    it("increments metrics on report submission", () => {
      submitReport(STATE, makeReport());
      const metrics = getModerationMetrics(STATE);
      assert.equal(metrics.totalReports, 1);
      assert.equal(metrics.pendingReports, 1);
    });
  });

  // ── getReport ──────────────────────────────────────────────────────

  describe("getReport", () => {
    it("retrieves a report by ID", () => {
      const { report } = submitReport(STATE, makeReport());
      const result = getReport(STATE, report.id);
      assert.equal(result.ok, true);
      assert.equal(result.report.id, report.id);
    });

    it("returns error for non-existent report", () => {
      const result = getReport(STATE, "report-nonexistent");
      assert.equal(result.ok, false);
    });
  });

  // ── listReports ────────────────────────────────────────────────────

  describe("listReports", () => {
    it("lists all reports", () => {
      submitReport(STATE, makeReport({ contentId: "c1" }));
      submitReport(STATE, makeReport({ contentId: "c2" }));
      const result = listReports(STATE);
      assert.equal(result.ok, true);
      assert.equal(result.total, 2);
    });

    it("filters by status", () => {
      submitReport(STATE, makeReport({ contentId: "c1" }));
      const result = listReports(STATE, { status: "pending" });
      assert.equal(result.total, 1);

      const resolved = listReports(STATE, { status: "resolved" });
      assert.equal(resolved.total, 0);
    });

    it("filters by category", () => {
      submitReport(STATE, makeReport({ contentId: "c1", category: "spam" }));
      submitReport(STATE, makeReport({ contentId: "c2", category: "violence" }));

      const result = listReports(STATE, { category: "violence" });
      assert.equal(result.total, 1);
    });

    it("includes reports with different severity levels", () => {
      submitReport(STATE, makeReport({ contentId: "c1", category: "spam" }));
      submitReport(STATE, makeReport({ contentId: "c2", category: "self_harm" }));

      const result = listReports(STATE);
      const severities = result.reports.map((r) => r.severity);
      assert.ok(severities.includes("critical"));
      assert.ok(severities.includes("low"));
    });
  });

  // ── scanContent (auto-flag) ────────────────────────────────────────

  describe("scanContent", () => {
    it("flags content matching keyword patterns", () => {
      const result = scanContent(
        STATE,
        "This is a scam, click here now!",
        "content_scan1",
        "dtu"
      );

      assert.equal(result.ok, true);
      assert.equal(result.flagged, true);
      assert.ok(result.matches.length > 0);
    });

    it("does not flag clean content", () => {
      const result = scanContent(
        STATE,
        "This is perfectly normal content about science.",
        "content_clean",
        "dtu"
      );

      assert.equal(result.flagged, false);
      assert.equal(result.matches.length, 0);
    });

    it("auto-creates a report for medium+ severity matches", () => {
      scanContent(
        STATE,
        "This is a scam operation",
        "content_auto",
        "dtu"
      );

      const metrics = getModerationMetrics(STATE);
      assert.ok(metrics.autoFlagged >= 1);
      // Should have auto-created a report
      assert.ok(metrics.totalReports >= 1);
    });

    it("handles empty content gracefully", () => {
      const result = scanContent(STATE, "", "c_empty", "dtu");
      assert.equal(result.ok, true);
      assert.equal(result.flagged, false);
    });

    it("handles null content gracefully", () => {
      const result = scanContent(STATE, null, "c_null", "dtu");
      assert.equal(result.ok, true);
      assert.equal(result.flagged, false);
    });

    it("handles non-string content", () => {
      const result = scanContent(STATE, 12345, "c_num", "dtu");
      assert.equal(result.ok, true);
      assert.equal(result.flagged, false);
    });
  });

  // ── addCustomPattern ───────────────────────────────────────────────

  describe("addCustomPattern", () => {
    it("adds a custom keyword pattern", () => {
      const result = addCustomPattern(STATE, {
        pattern: "\\bcustom_bad_word\\b",
        category: "harassment",
        severity: "high",
      });
      assert.equal(result.ok, true);

      // Verify it is used in scanning
      const scan = scanContent(
        STATE,
        "This has custom_bad_word in it",
        "c_custom",
        "dtu"
      );
      assert.equal(scan.flagged, true);
    });

    it("rejects missing pattern", () => {
      const result = addCustomPattern(STATE, { category: "spam" });
      assert.equal(result.ok, false);
    });

    it("rejects invalid category", () => {
      const result = addCustomPattern(STATE, {
        pattern: "test",
        category: "invalid",
      });
      assert.equal(result.ok, false);
    });

    it("rejects invalid regex", () => {
      const result = addCustomPattern(STATE, {
        pattern: "[invalid",
        category: "spam",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("Invalid regex"));
    });
  });

  // ── resolveReport ──────────────────────────────────────────────────

  describe("resolveReport", () => {
    it("resolves a report with 'approve' (dismiss)", () => {
      const { report } = submitReport(STATE, makeReport());
      const result = resolveReport(STATE, report.id, "mod1", {
        action: "approve",
      });

      assert.equal(result.ok, true);
      assert.equal(result.report.status, "dismissed");
    });

    it("resolves a report with 'remove'", () => {
      const { report } = submitReport(STATE, makeReport());
      const result = resolveReport(STATE, report.id, "mod1", {
        action: "remove",
        reason: "Violates policy",
      });

      assert.equal(result.ok, true);
      assert.equal(result.report.status, "resolved");
      assert.ok(result.report.resolvedAt);
      assert.equal(result.report.resolvedBy, "mod1");
    });

    it("resolves with 'warn' action", () => {
      const { report } = submitReport(STATE, makeReport());
      const result = resolveReport(STATE, report.id, "mod1", {
        action: "warn",
        reason: "First offense",
      });
      assert.equal(result.ok, true);
      assert.equal(result.report.status, "resolved");
    });

    it("rejects invalid action", () => {
      const { report } = submitReport(STATE, makeReport());
      const result = resolveReport(STATE, report.id, "mod1", {
        action: "nuke",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("Invalid action"));
    });

    it("rejects resolution of already-resolved report", () => {
      const { report } = submitReport(STATE, makeReport());
      resolveReport(STATE, report.id, "mod1", { action: "approve" });
      const result = resolveReport(STATE, report.id, "mod2", {
        action: "remove",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("already resolved"));
    });

    it("returns error for non-existent report", () => {
      const result = resolveReport(STATE, "report-ghost", "mod1", {
        action: "approve",
      });
      assert.equal(result.ok, false);
    });

    it("creates audit trail on resolution", () => {
      const { report } = submitReport(STATE, makeReport());
      resolveReport(STATE, report.id, "mod1", { action: "remove" });

      const audit = getContentAuditLog(STATE, "content_123");
      const removeEntry = audit.entries.find((e) => e.action === "remove");
      assert.ok(removeEntry);
      assert.equal(removeEntry.actorId, "mod1");
    });
  });

  // ── restoreContent ─────────────────────────────────────────────────

  describe("restoreContent", () => {
    it("restores previously removed content", () => {
      const { report } = submitReport(STATE, makeReport());
      resolveReport(STATE, report.id, "mod1", { action: "remove" });

      const result = restoreContent(STATE, "content_123", "mod2", "Mistake");
      assert.equal(result.ok, true);
      assert.equal(result.restored, true);
    });

    it("returns error when no removal record exists", () => {
      const result = restoreContent(STATE, "content_never_removed", "mod1");
      assert.equal(result.ok, false);
    });
  });

  // ── getModerationQueue ─────────────────────────────────────────────

  describe("getModerationQueue", () => {
    it("returns pending items in queue", () => {
      submitReport(STATE, makeReport({ contentId: "q1" }));
      submitReport(STATE, makeReport({ contentId: "q2" }));

      const result = getModerationQueue(STATE);
      assert.equal(result.ok, true);
      assert.ok(result.total >= 2);
      assert.ok(result.pendingCount >= 2);
    });

    it("escalates severity with multiple reports on same content", () => {
      submitReport(STATE, makeReport({ reporterId: "r1", contentId: "esc1" }));
      submitReport(STATE, makeReport({ reporterId: "r2", contentId: "esc1" }));
      submitReport(STATE, makeReport({ reporterId: "r3", contentId: "esc1" }));

      const result = getModerationQueue(STATE);
      const item = result.queue.find((q) => q.contentId === "esc1");
      assert.ok(item);
      assert.equal(item.reportCount, 3);
      assert.equal(item.severity, "high");
    });
  });

  // ── getUserModerationStatus ────────────────────────────────────────

  describe("getUserModerationStatus", () => {
    it("returns clean status for user with no strikes", () => {
      const result = getUserModerationStatus(STATE, "clean_user");
      assert.equal(result.ok, true);
      assert.equal(result.strikes, 0);
      assert.equal(result.suspended, false);
    });
  });

  // ── Constants ──────────────────────────────────────────────────────

  describe("constants", () => {
    it("REPORT_CATEGORIES includes expected values", () => {
      assert.ok(REPORT_CATEGORIES.includes("spam"));
      assert.ok(REPORT_CATEGORIES.includes("harassment"));
      assert.ok(REPORT_CATEGORIES.includes("violence"));
      assert.ok(REPORT_CATEGORIES.includes("copyright"));
    });

    it("MODERATION_ACTIONS includes expected values", () => {
      assert.ok(MODERATION_ACTIONS.includes("flag"));
      assert.ok(MODERATION_ACTIONS.includes("approve"));
      assert.ok(MODERATION_ACTIONS.includes("remove"));
      assert.ok(MODERATION_ACTIONS.includes("restore"));
    });

    it("FLAG_SOURCES includes user_report and auto_keyword", () => {
      assert.ok(FLAG_SOURCES.includes("user_report"));
      assert.ok(FLAG_SOURCES.includes("auto_keyword"));
    });

    it("MODERATION_STATUS includes expected values", () => {
      assert.ok(MODERATION_STATUS.includes("pending"));
      assert.ok(MODERATION_STATUS.includes("resolved"));
      assert.ok(MODERATION_STATUS.includes("dismissed"));
    });
  });
});
