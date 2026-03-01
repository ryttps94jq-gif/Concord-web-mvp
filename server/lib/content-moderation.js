/**
 * Concord — Content Moderation System
 *
 * Provides:
 *   - Content flag/report API
 *   - Auto-flag rules (keyword patterns, NSFW detection placeholders)
 *   - Moderation queue management
 *   - Report system with categories
 *   - Content removal with full audit trail
 *   - Moderation metrics and analytics
 *
 * All moderation actions produce an audit log entry. Content is never
 * silently removed — every action has a paper trail.
 */

import { randomUUID } from "node:crypto";

// ── Constants ─────────────────────────────────────────────────────────────

export const REPORT_CATEGORIES = [
  "spam",
  "harassment",
  "hate_speech",
  "violence",
  "sexual_content",
  "misinformation",
  "copyright",
  "impersonation",
  "self_harm",
  "other",
];

export const MODERATION_ACTIONS = [
  "flag",          // Mark for review
  "approve",       // Approve flagged content
  "remove",        // Remove content
  "restrict",      // Restrict visibility
  "warn",          // Warn the user
  "suspend",       // Suspend user account
  "restore",       // Restore removed content
];

export const FLAG_SOURCES = [
  "user_report",   // User-submitted report
  "auto_keyword",  // Auto-flagged by keyword filter
  "auto_pattern",  // Auto-flagged by pattern detection
  "moderator",     // Manually flagged by moderator
  "system",        // System-level flag
];

export const MODERATION_STATUS = [
  "pending",       // Awaiting review
  "reviewing",     // Currently being reviewed
  "resolved",      // Action taken
  "dismissed",     // Report dismissed
  "escalated",     // Escalated to higher authority
];

// ── Auto-Flag Keyword Patterns ────────────────────────────────────────────

const DEFAULT_KEYWORD_PATTERNS = [
  // These are intentionally mild patterns for demonstration
  // In production, use a proper content filtering service
  { pattern: /\b(scam|phishing|ponzi)\b/gi, category: "spam", severity: "medium" },
  { pattern: /\b(buy now|limited offer|act fast|click here)\b/gi, category: "spam", severity: "low" },
  { pattern: /\b(kill|murder|attack|bomb)\b/gi, category: "violence", severity: "medium" },
  { pattern: /\b(hack|exploit|crack|keygen)\b/gi, category: "other", severity: "low" },
];

// ── Moderation State ──────────────────────────────────────────────────────

function getModerationState(STATE) {
  if (!STATE._moderation) {
    STATE._moderation = {
      reports: new Map(),       // reportId -> report object
      queue: new Map(),         // queueItemId -> queue item
      auditLog: [],             // chronological audit entries
      userStrikes: new Map(),   // userId -> { count, strikes[] }
      removedContent: new Map(), // contentId -> removal record
      customPatterns: [],       // additional keyword patterns
      metrics: {
        totalReports: 0,
        pendingReports: 0,
        resolvedReports: 0,
        dismissedReports: 0,
        autoFlagged: 0,
        contentRemoved: 0,
        contentRestored: 0,
        warningsIssued: 0,
        suspensions: 0,
      },
    };
  }
  return STATE._moderation;
}

// ── Report System ─────────────────────────────────────────────────────────

/**
 * Submit a content report.
 *
 * @param {object} STATE
 * @param {object} params
 * @param {string} params.reporterId - User submitting the report
 * @param {string} params.contentId - ID of the flagged content
 * @param {string} params.contentType - Type: 'media', 'dtu', 'comment', 'profile'
 * @param {string} params.category - One of REPORT_CATEGORIES
 * @param {string} params.reason - Detailed reason for the report
 * @param {string} [params.evidence] - Additional evidence or context
 * @returns {{ ok: boolean, report?: object, error?: string }}
 */
export function submitReport(STATE, params) {
  const mod = getModerationState(STATE);
  const { reporterId, contentId, contentType, category, reason, evidence } = params;

  if (!reporterId) return { ok: false, error: "reporterId is required" };
  if (!contentId) return { ok: false, error: "contentId is required" };
  if (!contentType) return { ok: false, error: "contentType is required" };
  if (!category || !REPORT_CATEGORIES.includes(category)) {
    return { ok: false, error: `Invalid category. Must be one of: ${REPORT_CATEGORIES.join(", ")}` };
  }

  // Check for duplicate reports from same user on same content
  for (const existing of mod.reports.values()) {
    if (existing.reporterId === reporterId && existing.contentId === contentId && existing.status === "pending") {
      return { ok: false, error: "You have already reported this content" };
    }
  }

  const reportId = `report-${randomUUID()}`;
  const now = new Date().toISOString();

  const report = {
    id: reportId,
    reporterId,
    contentId,
    contentType,
    category,
    reason: reason || "",
    evidence: evidence || null,
    source: "user_report",
    status: "pending",
    severity: categorizeSeverity(category),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
  };

  mod.reports.set(reportId, report);
  mod.metrics.totalReports++;
  mod.metrics.pendingReports++;

  // Add to moderation queue
  addToQueue(mod, report);

  // Record audit
  addAuditEntry(mod, {
    action: "flag",
    reportId,
    contentId,
    contentType,
    category,
    actorId: reporterId,
    actorType: "user",
    details: `User reported content for: ${category}`,
  });

  return { ok: true, report };
}

/**
 * Get a report by ID.
 */
export function getReport(STATE, reportId) {
  const mod = getModerationState(STATE);
  const report = mod.reports.get(reportId);
  if (!report) return { ok: false, error: "Report not found" };
  return { ok: true, report };
}

/**
 * List reports with filtering.
 */
export function listReports(STATE, options = {}) {
  const mod = getModerationState(STATE);
  let reports = Array.from(mod.reports.values());

  if (options.status) {
    reports = reports.filter(r => r.status === options.status);
  }
  if (options.category) {
    reports = reports.filter(r => r.category === options.category);
  }
  if (options.contentType) {
    reports = reports.filter(r => r.contentType === options.contentType);
  }
  if (options.contentId) {
    reports = reports.filter(r => r.contentId === options.contentId);
  }

  // Sort by severity (high first), then by date (newest first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  reports.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  return {
    ok: true,
    reports: reports.slice(offset, offset + limit),
    total: reports.length,
  };
}

// ── Moderation Queue ──────────────────────────────────────────────────────

/**
 * Add a report to the moderation queue.
 */
function addToQueue(mod, report) {
  const queueItem = {
    id: `queue-${randomUUID()}`,
    reportId: report.id,
    contentId: report.contentId,
    contentType: report.contentType,
    category: report.category,
    severity: report.severity,
    status: "pending",
    reportCount: 1,
    createdAt: report.createdAt,
    assignedTo: null,
  };

  // Check if content already has a queue item
  for (const [, existing] of mod.queue) {
    if (existing.contentId === report.contentId && existing.status === "pending") {
      existing.reportCount++;
      // Escalate severity if many reports
      if (existing.reportCount >= 5) existing.severity = "critical";
      else if (existing.reportCount >= 3) existing.severity = "high";
      return existing;
    }
  }

  mod.queue.set(queueItem.id, queueItem);
  return queueItem;
}

/**
 * Get the moderation queue.
 */
export function getModerationQueue(STATE, options = {}) {
  const mod = getModerationState(STATE);
  let items = Array.from(mod.queue.values());

  if (options.status) {
    items = items.filter(i => i.status === options.status);
  }
  if (options.severity) {
    items = items.filter(i => i.severity === options.severity);
  }

  // Sort: critical first, then by report count, then by date
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    if (sevDiff !== 0) return sevDiff;
    if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  return {
    ok: true,
    queue: items.slice(offset, offset + limit),
    total: items.length,
    pendingCount: items.filter(i => i.status === "pending").length,
  };
}

// ── Moderation Actions ────────────────────────────────────────────────────

/**
 * Resolve a report with a moderation action.
 *
 * @param {object} STATE
 * @param {string} reportId
 * @param {string} moderatorId
 * @param {object} params
 * @param {string} params.action - One of MODERATION_ACTIONS
 * @param {string} [params.reason] - Reason for the action
 */
export function resolveReport(STATE, reportId, moderatorId, params) {
  const mod = getModerationState(STATE);
  const report = mod.reports.get(reportId);
  if (!report) return { ok: false, error: "Report not found" };
  if (report.status === "resolved" || report.status === "dismissed") {
    return { ok: false, error: "Report already resolved" };
  }

  const { action, reason } = params;
  if (!action || !MODERATION_ACTIONS.includes(action)) {
    return { ok: false, error: `Invalid action. Must be one of: ${MODERATION_ACTIONS.join(", ")}` };
  }

  const now = new Date().toISOString();

  // Apply the action
  switch (action) {
    case "approve":
      report.status = "dismissed";
      report.resolution = "Content approved — no violation found";
      mod.metrics.dismissedReports++;
      mod.metrics.pendingReports = Math.max(0, mod.metrics.pendingReports - 1);
      break;

    case "remove":
      report.status = "resolved";
      report.resolution = reason || "Content removed for policy violation";
      removeContent(STATE, report.contentId, report.contentType, moderatorId, reason);
      mod.metrics.resolvedReports++;
      mod.metrics.pendingReports = Math.max(0, mod.metrics.pendingReports - 1);
      mod.metrics.contentRemoved++;
      break;

    case "restrict":
      report.status = "resolved";
      report.resolution = reason || "Content visibility restricted";
      restrictContent(STATE, report.contentId, report.contentType);
      mod.metrics.resolvedReports++;
      mod.metrics.pendingReports = Math.max(0, mod.metrics.pendingReports - 1);
      break;

    case "warn":
      report.status = "resolved";
      report.resolution = reason || "User warned";
      issueWarning(mod, getContentAuthor(STATE, report.contentId, report.contentType), reason);
      mod.metrics.resolvedReports++;
      mod.metrics.pendingReports = Math.max(0, mod.metrics.pendingReports - 1);
      mod.metrics.warningsIssued++;
      break;

    case "suspend":
      report.status = "resolved";
      report.resolution = reason || "User suspended";
      const authorId = getContentAuthor(STATE, report.contentId, report.contentType);
      suspendUser(mod, authorId, reason);
      mod.metrics.resolvedReports++;
      mod.metrics.pendingReports = Math.max(0, mod.metrics.pendingReports - 1);
      mod.metrics.suspensions++;
      break;

    case "flag":
      report.status = "escalated";
      report.resolution = reason || "Escalated for further review";
      break;

    default:
      report.status = "resolved";
      report.resolution = reason || `Action: ${action}`;
      mod.metrics.resolvedReports++;
      mod.metrics.pendingReports = Math.max(0, mod.metrics.pendingReports - 1);
  }

  report.resolvedAt = now;
  report.resolvedBy = moderatorId;
  report.updatedAt = now;

  // Update queue item
  for (const [, queueItem] of mod.queue) {
    if (queueItem.contentId === report.contentId) {
      queueItem.status = report.status === "dismissed" ? "dismissed" : "resolved";
    }
  }

  // Audit trail
  addAuditEntry(mod, {
    action,
    reportId,
    contentId: report.contentId,
    contentType: report.contentType,
    category: report.category,
    actorId: moderatorId,
    actorType: "moderator",
    details: report.resolution,
  });

  return { ok: true, report };
}

/**
 * Restore previously removed content.
 */
export function restoreContent(STATE, contentId, moderatorId, reason) {
  const mod = getModerationState(STATE);
  const removal = mod.removedContent.get(contentId);
  if (!removal) return { ok: false, error: "No removal record found for this content" };

  // In production, this would restore the actual content
  removal.restored = true;
  removal.restoredAt = new Date().toISOString();
  removal.restoredBy = moderatorId;

  mod.metrics.contentRestored++;

  addAuditEntry(mod, {
    action: "restore",
    contentId,
    contentType: removal.contentType,
    actorId: moderatorId,
    actorType: "moderator",
    details: reason || "Content restored",
  });

  return { ok: true, contentId, restored: true };
}

// ── Auto-Flagging ─────────────────────────────────────────────────────────

/**
 * Scan content text for auto-flag violations.
 * Returns a list of matched patterns (may be empty if no issues found).
 *
 * @param {object} STATE
 * @param {string} text - Text content to scan
 * @param {string} contentId - ID of the content being scanned
 * @param {string} contentType - Type of content
 * @returns {{ ok: boolean, flagged: boolean, matches: object[] }}
 */
export function scanContent(STATE, text, contentId, contentType) {
  const mod = getModerationState(STATE);
  if (!text || typeof text !== "string") {
    return { ok: true, flagged: false, matches: [] };
  }

  const allPatterns = [...DEFAULT_KEYWORD_PATTERNS, ...mod.customPatterns];
  const matches = [];

  for (const rule of allPatterns) {
    const found = text.match(rule.pattern);
    if (found) {
      matches.push({
        category: rule.category,
        severity: rule.severity,
        matchedTerms: [...new Set(found.map(m => m.toLowerCase()))],
        pattern: rule.pattern.source,
      });
    }
  }

  const flagged = matches.length > 0;

  if (flagged) {
    mod.metrics.autoFlagged++;

    // Auto-create reports for medium+ severity matches
    const severeMatches = matches.filter(m => m.severity !== "low");
    if (severeMatches.length > 0) {
      const topMatch = severeMatches[0];
      const reportId = `report-auto-${randomUUID()}`;
      const now = new Date().toISOString();

      const autoReport = {
        id: reportId,
        reporterId: "system",
        contentId,
        contentType,
        category: topMatch.category,
        reason: `Auto-flagged: matched ${topMatch.matchedTerms.join(", ")}`,
        evidence: JSON.stringify(matches),
        source: "auto_keyword",
        status: "pending",
        severity: topMatch.severity,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
      };

      mod.reports.set(reportId, autoReport);
      mod.metrics.totalReports++;
      mod.metrics.pendingReports++;
      addToQueue(mod, autoReport);

      addAuditEntry(mod, {
        action: "flag",
        reportId,
        contentId,
        contentType,
        category: topMatch.category,
        actorId: "system",
        actorType: "system",
        details: `Auto-flagged for ${topMatch.category}: ${topMatch.matchedTerms.join(", ")}`,
      });
    }
  }

  return { ok: true, flagged, matches };
}

/**
 * Add a custom keyword pattern for auto-flagging.
 */
export function addCustomPattern(STATE, params) {
  const mod = getModerationState(STATE);
  const { pattern, category, severity = "medium" } = params;

  if (!pattern) return { ok: false, error: "pattern is required" };
  if (!category || !REPORT_CATEGORIES.includes(category)) {
    return { ok: false, error: `Invalid category. Must be one of: ${REPORT_CATEGORIES.join(", ")}` };
  }

  try {
    const regex = new RegExp(pattern, "gi");
    mod.customPatterns.push({ pattern: regex, category, severity });
    return { ok: true, pattern, category, severity };
  } catch (e) {
    return { ok: false, error: `Invalid regex pattern: ${e.message}` };
  }
}

// ── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Remove content from the system.
 */
function removeContent(STATE, contentId, contentType, moderatorId, reason) {
  const mod = getModerationState(STATE);

  // Record the removal
  mod.removedContent.set(contentId, {
    contentId,
    contentType,
    removedAt: new Date().toISOString(),
    removedBy: moderatorId,
    reason: reason || "Policy violation",
    restored: false,
    restoredAt: null,
    restoredBy: null,
  });

  // In production: actually hide/delete the content
  // For media DTUs
  if (STATE._media && STATE._media.mediaDTUs.has(contentId)) {
    const dtu = STATE._media.mediaDTUs.get(contentId);
    dtu.privacy = "removed";
    dtu.moderationStatus = "removed";
    dtu.updatedAt = new Date().toISOString();
  }

  // For regular DTUs
  if (STATE.dtus && STATE.dtus.has(contentId)) {
    const dtu = STATE.dtus.get(contentId);
    if (dtu) {
      dtu.moderationStatus = "removed";
      dtu.updatedAt = new Date().toISOString();
    }
  }
}

/**
 * Restrict content visibility.
 */
function restrictContent(STATE, contentId, contentType) {
  if (STATE._media && STATE._media.mediaDTUs.has(contentId)) {
    const dtu = STATE._media.mediaDTUs.get(contentId);
    dtu.privacy = "private";
    dtu.moderationStatus = "restricted";
    dtu.updatedAt = new Date().toISOString();
  }

  if (STATE.dtus && STATE.dtus.has(contentId)) {
    const dtu = STATE.dtus.get(contentId);
    if (dtu) {
      dtu.moderationStatus = "restricted";
      dtu.updatedAt = new Date().toISOString();
    }
  }
}

/**
 * Get the author of a piece of content.
 */
function getContentAuthor(STATE, contentId, _contentType) {
  if (STATE._media && STATE._media.mediaDTUs.has(contentId)) {
    return STATE._media.mediaDTUs.get(contentId).author;
  }
  if (STATE.dtus && STATE.dtus.has(contentId)) {
    const dtu = STATE.dtus.get(contentId);
    return dtu.author || dtu.meta?.authorId;
  }
  return null;
}

/**
 * Issue a warning to a user.
 */
function issueWarning(mod, userId, reason) {
  if (!userId) return;

  if (!mod.userStrikes.has(userId)) {
    mod.userStrikes.set(userId, { count: 0, strikes: [] });
  }

  const record = mod.userStrikes.get(userId);
  record.count++;
  record.strikes.push({
    type: "warning",
    reason: reason || "Policy violation",
    issuedAt: new Date().toISOString(),
  });
}

/**
 * Suspend a user account.
 */
function suspendUser(mod, userId, reason) {
  if (!userId) return;

  if (!mod.userStrikes.has(userId)) {
    mod.userStrikes.set(userId, { count: 0, strikes: [] });
  }

  const record = mod.userStrikes.get(userId);
  record.count++;
  record.strikes.push({
    type: "suspension",
    reason: reason || "Repeated policy violations",
    issuedAt: new Date().toISOString(),
  });
  record.suspended = true;
  record.suspendedAt = new Date().toISOString();
}

/**
 * Add an audit log entry.
 */
function addAuditEntry(mod, params) {
  const entry = {
    id: `audit-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    ...params,
  };
  mod.auditLog.push(entry);

  // Keep audit log bounded
  if (mod.auditLog.length > 10000) {
    mod.auditLog = mod.auditLog.slice(-5000);
  }

  return entry;
}

/**
 * Categorize severity from report category.
 */
function categorizeSeverity(category) {
  switch (category) {
    case "self_harm":
    case "violence":
      return "critical";
    case "hate_speech":
    case "harassment":
    case "sexual_content":
      return "high";
    case "copyright":
    case "impersonation":
    case "misinformation":
      return "medium";
    case "spam":
    case "other":
    default:
      return "low";
  }
}

// ── Public Query APIs ─────────────────────────────────────────────────────

/**
 * Get the audit log for a specific content item.
 */
export function getContentAuditLog(STATE, contentId) {
  const mod = getModerationState(STATE);
  const entries = mod.auditLog.filter(e => e.contentId === contentId);
  return { ok: true, entries, total: entries.length };
}

/**
 * Get moderation status for a user (warnings, suspensions).
 */
export function getUserModerationStatus(STATE, userId) {
  const mod = getModerationState(STATE);
  const record = mod.userStrikes.get(userId);

  if (!record) {
    return { ok: true, userId, strikes: 0, warnings: 0, suspended: false, history: [] };
  }

  return {
    ok: true,
    userId,
    strikes: record.count,
    warnings: record.strikes.filter(s => s.type === "warning").length,
    suspended: record.suspended || false,
    suspendedAt: record.suspendedAt || null,
    history: record.strikes,
  };
}

/**
 * Get overall moderation metrics.
 */
export function getModerationMetrics(STATE) {
  const mod = getModerationState(STATE);
  return {
    ok: true,
    ...mod.metrics,
    queueSize: mod.queue.size,
    auditLogSize: mod.auditLog.length,
    customPatternCount: mod.customPatterns.length,
  };
}
