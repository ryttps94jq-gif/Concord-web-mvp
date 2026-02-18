/**
 * Concord — Compliance Scaffolding
 *
 * Data region tagging, export controls, role-based data partitioning,
 * audit logs for compliance. Not full HIPAA/SOC2, but enough for pilot conversations.
 */

import crypto from "crypto";

// ── Data Regions ─────────────────────────────────────────────────────────

export const DATA_REGIONS = Object.freeze({
  DEFAULT: "default",
  US:      "us",
  EU:      "eu",
  UK:      "uk",
  APAC:    "apac",
  LOCAL:   "local",
});

// ── Compliance State ─────────────────────────────────────────────────────

function getComplianceState(STATE) {
  if (!STATE._compliance) {
    STATE._compliance = {
      dataRegionTags: new Map(),     // resourceId → region
      exportControls: new Map(),     // resourceId → { allowed: boolean, restrictions: [] }
      dataPartitions: new Map(),     // orgId → { partition, accessRules }
      complianceLog: [],             // all compliance events
      retentionPolicies: new Map(),  // orgId → retention policy
      dpaAgreements: new Map(),      // orgId → DPA status

      metrics: {
        regionTags: 0,
        exportChecks: 0,
        exportBlocked: 0,
        partitionsCreated: 0,
        complianceEvents: 0,
      },
    };
  }
  return STATE._compliance;
}

// ── Data Region Tagging ──────────────────────────────────────────────────

/**
 * Tag a resource (DTU, org, workspace) with a data region.
 */
export function tagDataRegion(STATE, resourceId, region, taggedBy) {
  const compliance = getComplianceState(STATE);

  if (!Object.values(DATA_REGIONS).includes(region)) {
    return { ok: false, error: `Invalid region: ${region}. Valid: ${Object.values(DATA_REGIONS).join(", ")}` };
  }

  const previous = compliance.dataRegionTags.get(resourceId);
  compliance.dataRegionTags.set(resourceId, {
    region,
    taggedAt: new Date().toISOString(),
    taggedBy: taggedBy || "system",
  });

  if (!previous) compliance.metrics.regionTags++;

  logComplianceEvent(compliance, "REGION_TAGGED", taggedBy, {
    resourceId, region, previousRegion: previous?.region || null,
  });

  return { ok: true, resourceId, region, previous: previous?.region || null };
}

export function getDataRegion(STATE, resourceId) {
  const compliance = getComplianceState(STATE);
  const tag = compliance.dataRegionTags.get(resourceId);
  return { ok: true, resourceId, region: tag?.region || DATA_REGIONS.DEFAULT, tag };
}

/**
 * Check if a resource can be accessed from a given region (cross-region access control).
 */
export function checkRegionAccess(STATE, resourceId, requestRegion) {
  const compliance = getComplianceState(STATE);
  compliance.metrics.exportChecks++;

  const tag = compliance.dataRegionTags.get(resourceId);
  if (!tag) return { allowed: true, reason: "no_region_restriction" };

  // EU data cannot be accessed from non-EU regions (simplified GDPR constraint)
  if (tag.region === "eu" && requestRegion !== "eu" && requestRegion !== "local") {
    compliance.metrics.exportBlocked++;
    logComplianceEvent(compliance, "CROSS_REGION_BLOCKED", "system", {
      resourceId, dataRegion: tag.region, requestRegion,
    });
    return { allowed: false, reason: "eu_data_restriction", dataRegion: tag.region, requestRegion };
  }

  return { allowed: true, dataRegion: tag.region, requestRegion };
}

// ── Export Controls ──────────────────────────────────────────────────────

/**
 * Set export controls on a resource.
 */
export function setExportControls(STATE, resourceId, controls) {
  const compliance = getComplianceState(STATE);
  compliance.exportControls.set(resourceId, {
    allowed: controls.allowed !== false,
    restrictions: controls.restrictions || [],
    formats: controls.formats || ["json"],
    requireApproval: controls.requireApproval || false,
    setAt: new Date().toISOString(),
    setBy: controls.setBy || "system",
  });

  logComplianceEvent(compliance, "EXPORT_CONTROLS_SET", controls.setBy, { resourceId, controls });

  return { ok: true, resourceId, controls: compliance.exportControls.get(resourceId) };
}

/**
 * Check if a resource can be exported.
 */
export function checkExportAllowed(STATE, resourceId, format = "json", _requestor = null) {
  const compliance = getComplianceState(STATE);
  compliance.metrics.exportChecks++;

  const controls = compliance.exportControls.get(resourceId);
  if (!controls) return { allowed: true, reason: "no_export_controls" };

  if (!controls.allowed) {
    compliance.metrics.exportBlocked++;
    return { allowed: false, reason: "export_disabled" };
  }

  if (controls.formats.length > 0 && !controls.formats.includes(format)) {
    compliance.metrics.exportBlocked++;
    return { allowed: false, reason: "format_not_allowed", allowedFormats: controls.formats };
  }

  if (controls.requireApproval) {
    return { allowed: false, reason: "approval_required", requireApproval: true };
  }

  return { allowed: true };
}

/**
 * Export data for a resource with compliance controls.
 */
export function exportData(STATE, resourceId, format, requestor) {
  const compliance = getComplianceState(STATE);
  const check = checkExportAllowed(STATE, resourceId, format, requestor);

  if (!check.allowed) return { ok: false, ...check };

  // Get the actual data
  const dtu = STATE.dtus?.get(resourceId);
  if (!dtu) return { ok: false, error: "Resource not found" };

  // Redact PII if needed (use content-shield data)
  const exportData = { ...dtu };
  delete exportData._internal;

  logComplianceEvent(compliance, "DATA_EXPORTED", requestor, {
    resourceId, format,
  });

  return { ok: true, resourceId, format, data: exportData, exportedAt: new Date().toISOString() };
}

// ── Role-Based Data Partitioning ─────────────────────────────────────────

/**
 * Create a data partition for an organization.
 * Data within a partition is isolated from other orgs.
 */
export function createDataPartition(STATE, orgId, config = {}) {
  const compliance = getComplianceState(STATE);

  const partition = {
    orgId,
    partitionId: `part_${crypto.randomBytes(6).toString("hex")}`,
    region: config.region || DATA_REGIONS.DEFAULT,
    isolationLevel: config.isolationLevel || "standard", // standard, strict
    dataTypes: config.dataTypes || ["dtus", "atlas", "marketplace"],
    retentionDays: config.retentionDays || 365,
    encryptionRequired: config.encryptionRequired || false,
    createdAt: new Date().toISOString(),
    accessRules: config.accessRules || [],
  };

  compliance.dataPartitions.set(orgId, partition);
  compliance.metrics.partitionsCreated++;

  logComplianceEvent(compliance, "PARTITION_CREATED", config.createdBy || "system", {
    orgId, partitionId: partition.partitionId, region: partition.region,
  });

  return { ok: true, partition };
}

export function getDataPartition(STATE, orgId) {
  const compliance = getComplianceState(STATE);
  const partition = compliance.dataPartitions.get(orgId);
  return { ok: true, partition: partition || null };
}

// ── Retention Policies ───────────────────────────────────────────────────

export function setRetentionPolicy(STATE, orgId, policy) {
  const compliance = getComplianceState(STATE);
  compliance.retentionPolicies.set(orgId, {
    orgId,
    retentionDays: policy.retentionDays || 365,
    autoDeleteAfterExpiry: policy.autoDeleteAfterExpiry || false,
    archiveBeforeDelete: policy.archiveBeforeDelete ?? true,
    exemptTypes: policy.exemptTypes || ["legal_hold"],
    setAt: new Date().toISOString(),
    setBy: policy.setBy || "system",
  });

  logComplianceEvent(compliance, "RETENTION_POLICY_SET", policy.setBy, { orgId, policy });
  return { ok: true, orgId, policy: compliance.retentionPolicies.get(orgId) };
}

export function getRetentionPolicy(STATE, orgId) {
  const compliance = getComplianceState(STATE);
  return { ok: true, policy: compliance.retentionPolicies.get(orgId) || null };
}

// ── Compliance Audit Log ─────────────────────────────────────────────────

function logComplianceEvent(compliance, action, actor, details) {
  const event = {
    id: `comp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    ts: Date.now(),
    timestamp: new Date().toISOString(),
    action,
    actor: actor || "system",
    details,
  };
  compliance.complianceLog.push(event);
  compliance.metrics.complianceEvents++;
  return event;
}

export function getComplianceLog(STATE, options = {}) {
  const compliance = getComplianceState(STATE);
  let events = compliance.complianceLog;

  if (options.action) {
    events = events.filter(e => e.action === options.action);
  }
  if (options.since) {
    const sinceTs = new Date(options.since).getTime();
    events = events.filter(e => e.ts >= sinceTs);
  }

  events.sort((a, b) => b.ts - a.ts);

  const limit = options.limit || 100;
  return { ok: true, events: events.slice(0, limit), total: events.length };
}

// ── DPA (Data Processing Agreement) Tracking ─────────────────────────────

export function recordDPA(STATE, orgId, dpaData) {
  const compliance = getComplianceState(STATE);
  compliance.dpaAgreements.set(orgId, {
    orgId,
    status: dpaData.status || "pending", // pending, signed, expired
    signedAt: dpaData.signedAt || null,
    expiresAt: dpaData.expiresAt || null,
    version: dpaData.version || "1.0",
    regions: dpaData.regions || [],
  });

  logComplianceEvent(compliance, "DPA_RECORDED", dpaData.recordedBy, { orgId, status: dpaData.status });
  return { ok: true, orgId, dpa: compliance.dpaAgreements.get(orgId) };
}

// ── Compliance Status Summary ────────────────────────────────────────────

export function getComplianceStatus(STATE) {
  const compliance = getComplianceState(STATE);

  return {
    ok: true,
    metrics: compliance.metrics,
    regionTagCount: compliance.dataRegionTags.size,
    exportControlCount: compliance.exportControls.size,
    partitionCount: compliance.dataPartitions.size,
    retentionPolicyCount: compliance.retentionPolicies.size,
    dpaCount: compliance.dpaAgreements.size,
    complianceLogSize: compliance.complianceLog.length,
  };
}
