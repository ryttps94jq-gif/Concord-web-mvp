/**
 * Integration Test: Legal / DMCA Compliance
 *
 * Tests DMCA integration including:
 * - DMCA case lifecycle: submit -> review -> resolve
 * - Counter-notification flow
 * - Case status transitions
 * - Input validation
 * - Audit trail
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// ── Mock Database ────────────────────────────────────────────────────────

function createMockDB() {
  const tables = new Map();
  const data = new Map();

  return {
    exec(sql) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (match) {
        const tableName = match[1];
        if (!tables.has(tableName)) {
          tables.set(tableName, true);
          data.set(tableName, []);
        }
      }
    },

    prepare(sql) {
      return {
        run(...args) {
          const tableName = sql.match(/(?:INTO|UPDATE)\s+(\w+)/i)?.[1];
          if (!tableName || !data.has(tableName)) return;

          const rows = data.get(tableName);
          const isInsert = sql.trim().toUpperCase().startsWith("INSERT");
          const isUpdate = sql.trim().toUpperCase().startsWith("UPDATE");

          if (isInsert) {
            // Parse positional params
            const row = {};
            if (args.length > 0 && !Array.isArray(args[0])) {
              // Positional: map to column order based on INSERT statement
              const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
              if (colMatch) {
                const cols = colMatch[1].split(",").map((c) => c.trim());
                for (let i = 0; i < cols.length && i < args.length; i++) {
                  row[cols[i]] = args[i];
                }
              }
            }
            rows.push(row);
          }

          if (isUpdate) {
            // Find the row by id
            const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
            if (whereMatch) {
              const idArg = args[args.length - 1]; // Last arg is the WHERE id
              const targetRow = rows.find((r) => r.id === idArg);
              if (targetRow) {
                // Parse SET columns
                const setMatch = sql.match(/SET\s+([\s\S]+)\s+WHERE/i);
                if (setMatch) {
                  const setParts = setMatch[1].split(",").map((s) => s.trim());
                  let argIdx = 0;
                  for (const part of setParts) {
                    const [col] = part.split("=").map((s) => s.trim());
                    targetRow[col] = args[argIdx++];
                  }
                }
              }
            }
          }
        },

        get(...args) {
          const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
          if (!tableName || !data.has(tableName)) return null;

          const rows = data.get(tableName);

          if (sql.includes("COUNT(*)")) {
            return { total: rows.length };
          }

          // Handle WHERE id = ?
          if (sql.includes("WHERE id = ?")) {
            const id = args[0];
            return rows.find((r) => r.id === id) || null;
          }

          return rows[0] || null;
        },

        all(...args) {
          const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
          if (!tableName || !data.has(tableName)) return [];

          let rows = [...data.get(tableName)];

          // Handle status filter
          if (sql.includes("status = ?") || sql.includes("status = @status")) {
            const status = args[0]?.status || args[0];
            rows = rows.filter((r) => r.status === status);
          }

          // Handle LIMIT/OFFSET
          const limit = args[0]?.limit || 50;
          const offset = args[0]?.offset || 0;
          if (typeof limit === "number") {
            rows = rows.slice(offset, offset + limit);
          }

          return rows;
        },
      };
    },

    _getRows(tableName) {
      return data.get(tableName) || [];
    },

    _setRows(tableName, rows) {
      data.set(tableName, rows);
    },
  };
}

// ── Mock DMCA Service ────────────────────────────────────────────────────

function createMockDMCAService(db) {
  const auditLog = [];

  function ensureTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dmca_cases (
        id TEXT PRIMARY KEY
      )
    `);
  }

  function generateId() {
    return `dmca_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }

  function submitNotice(params) {
    ensureTable();

    // Validate required fields
    const missing = [];
    if (!params.claimantName) missing.push("claimantName");
    if (!params.claimantEmail) missing.push("claimantEmail");
    if (!params.copyrightWork) missing.push("copyrightWork");
    if (!params.description) missing.push("description");
    if (!params.signature) missing.push("signature");

    if (missing.length > 0) {
      return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.claimantEmail)) {
      return { ok: false, error: "Invalid email address format." };
    }

    if (!params.goodFaithStatement || !params.accuracyStatement) {
      return { ok: false, error: "Both good faith and accuracy statements must be affirmed." };
    }

    const caseId = generateId();
    const now = new Date().toISOString();

    const caseRow = {
      id: caseId,
      status: "pending",
      claimant_name: params.claimantName,
      claimant_email: params.claimantEmail,
      claimant_address: params.claimantAddress || null,
      copyright_work: params.copyrightWork,
      infringing_url: params.infringingUrl || null,
      dtu_id: params.dtuId || null,
      description: params.description,
      good_faith_statement: params.goodFaithStatement ? 1 : 0,
      accuracy_statement: params.accuracyStatement ? 1 : 0,
      signature: params.signature,
      counter_respondent_name: null,
      counter_respondent_email: null,
      counter_statement: null,
      counter_consent_to_jurisdiction: 0,
      counter_signature: null,
      resolution: null,
      resolution_notes: null,
      resolved_by: null,
      created_at: now,
      updated_at: now,
      resolved_at: null,
    };

    const rows = db._getRows("dmca_cases");
    rows.push(caseRow);

    auditLog.push({
      action: "notice_submitted",
      caseId,
      claimantEmail: params.claimantEmail,
      timestamp: now,
    });

    return {
      ok: true,
      caseId,
      status: "pending",
      message: "Your DMCA takedown notice has been received.",
    };
  }

  function getCase(caseId) {
    ensureTable();
    const rows = db._getRows("dmca_cases");
    return rows.find((r) => r.id === caseId) || null;
  }

  function submitCounterNotification(caseId, params) {
    ensureTable();

    const missing = [];
    if (!params.respondentName) missing.push("respondentName");
    if (!params.respondentEmail) missing.push("respondentEmail");
    if (!params.counterStatement) missing.push("counterStatement");
    if (!params.signature) missing.push("signature");

    if (missing.length > 0) {
      return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
    }

    if (!params.consentToJurisdiction) {
      return { ok: false, error: "Consent to jurisdiction is required for counter-notifications." };
    }

    const rows = db._getRows("dmca_cases");
    const caseRow = rows.find((r) => r.id === caseId);

    if (!caseRow) {
      return { ok: false, error: "DMCA case not found." };
    }

    if (caseRow.status === "resolved") {
      return { ok: false, error: "This case has already been resolved." };
    }

    if (caseRow.counter_respondent_name) {
      return { ok: false, error: "A counter-notification has already been filed for this case." };
    }

    const now = new Date().toISOString();

    caseRow.status = "counter_filed";
    caseRow.counter_respondent_name = params.respondentName;
    caseRow.counter_respondent_email = params.respondentEmail;
    caseRow.counter_respondent_address = params.respondentAddress || null;
    caseRow.counter_statement = params.counterStatement;
    caseRow.counter_consent_to_jurisdiction = params.consentToJurisdiction ? 1 : 0;
    caseRow.counter_signature = params.signature;
    caseRow.updated_at = now;

    auditLog.push({
      action: "counter_notification_filed",
      caseId,
      respondentEmail: params.respondentEmail,
      timestamp: now,
    });

    return { ok: true, caseId, status: "counter_filed" };
  }

  function resolveCase(caseId, resolution, notes, resolvedBy) {
    ensureTable();

    const validResolutions = ["upheld", "dismissed", "counter_filed"];
    if (!resolution || !validResolutions.includes(resolution)) {
      return { ok: false, error: `Resolution must be one of: ${validResolutions.join(", ")}` };
    }

    const rows = db._getRows("dmca_cases");
    const caseRow = rows.find((r) => r.id === caseId);

    if (!caseRow) {
      return { ok: false, error: "DMCA case not found." };
    }

    if (caseRow.status === "resolved") {
      return { ok: false, error: "This case has already been resolved." };
    }

    const now = new Date().toISOString();

    caseRow.status = "resolved";
    caseRow.resolution = resolution;
    caseRow.resolution_notes = notes || null;
    caseRow.resolved_by = resolvedBy || "system";
    caseRow.resolved_at = now;
    caseRow.updated_at = now;

    auditLog.push({
      action: "case_resolved",
      caseId,
      resolution,
      resolvedBy: resolvedBy || "system",
      timestamp: now,
    });

    return { ok: true, caseId, status: "resolved", resolution };
  }

  function getAllCases(filters = {}) {
    ensureTable();
    let rows = [...db._getRows("dmca_cases")];
    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }
    return rows;
  }

  function getAuditLog() {
    return [...auditLog];
  }

  return {
    submitNotice,
    getCase,
    submitCounterNotification,
    resolveCase,
    getAllCases,
    getAuditLog,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Integration: Legal/DMCA Compliance", () => {
  let db;
  let dmca;

  const VALID_NOTICE = {
    claimantName: "John Doe",
    claimantEmail: "john@example.com",
    claimantAddress: "123 Main St, New York, NY 10001",
    copyrightWork: "My Original Composition",
    infringingUrl: "https://concord.example.com/media/abc123",
    dtuId: "dtu-test-123",
    description: "This DTU contains my copyrighted musical composition without authorization.",
    goodFaithStatement: true,
    accuracyStatement: true,
    signature: "John Doe",
  };

  const VALID_COUNTER = {
    respondentName: "Jane Smith",
    respondentEmail: "jane@example.com",
    respondentAddress: "456 Oak Ave, Los Angeles, CA 90001",
    counterStatement: "The material is not infringing. I am the original creator and hold all rights.",
    consentToJurisdiction: true,
    signature: "Jane Smith",
  };

  beforeEach(() => {
    db = createMockDB();
    dmca = createMockDMCAService(db);
  });

  // ── DMCA Case Lifecycle: submit -> review -> resolve ──────

  describe("DMCA Case Lifecycle", () => {
    it("submits a DMCA takedown notice successfully", () => {
      const result = dmca.submitNotice(VALID_NOTICE);

      assert.ok(result.ok);
      assert.ok(result.caseId);
      assert.ok(result.caseId.startsWith("dmca_"));
      assert.equal(result.status, "pending");
    });

    it("submitted case is retrievable by ID", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      const caseRow = dmca.getCase(caseId);
      assert.ok(caseRow);
      assert.equal(caseRow.id, caseId);
      assert.equal(caseRow.status, "pending");
      assert.equal(caseRow.claimant_name, "John Doe");
      assert.equal(caseRow.claimant_email, "john@example.com");
      assert.equal(caseRow.copyright_work, "My Original Composition");
      assert.equal(caseRow.description, VALID_NOTICE.description);
      assert.equal(caseRow.signature, "John Doe");
    });

    it("resolves a case as 'upheld'", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      const result = dmca.resolveCase(caseId, "upheld", "Content confirmed as infringing.", "admin-1");

      assert.ok(result.ok);
      assert.equal(result.status, "resolved");
      assert.equal(result.resolution, "upheld");

      const caseRow = dmca.getCase(caseId);
      assert.equal(caseRow.status, "resolved");
      assert.equal(caseRow.resolution, "upheld");
      assert.equal(caseRow.resolved_by, "admin-1");
      assert.ok(caseRow.resolved_at);
    });

    it("resolves a case as 'dismissed'", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      const result = dmca.resolveCase(caseId, "dismissed", "Insufficient evidence of ownership.");

      assert.ok(result.ok);
      assert.equal(result.resolution, "dismissed");
    });

    it("full lifecycle: submit -> review -> resolve", () => {
      // Step 1: Submit notice
      const submitResult = dmca.submitNotice(VALID_NOTICE);
      assert.ok(submitResult.ok);

      // Step 2: Verify pending state
      const pendingCase = dmca.getCase(submitResult.caseId);
      assert.equal(pendingCase.status, "pending");

      // Step 3: Resolve
      const resolveResult = dmca.resolveCase(submitResult.caseId, "upheld", "Verified infringement.", "admin-1");
      assert.ok(resolveResult.ok);

      // Step 4: Verify resolved state
      const resolvedCase = dmca.getCase(submitResult.caseId);
      assert.equal(resolvedCase.status, "resolved");
      assert.equal(resolvedCase.resolution, "upheld");
      assert.ok(resolvedCase.resolved_at);
    });
  });

  // ── Counter-Notification Flow ──────

  describe("Counter-Notification Flow", () => {
    it("submits counter-notification on pending case", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      const result = dmca.submitCounterNotification(caseId, VALID_COUNTER);

      assert.ok(result.ok);
      assert.equal(result.status, "counter_filed");

      const caseRow = dmca.getCase(caseId);
      assert.equal(caseRow.status, "counter_filed");
      assert.equal(caseRow.counter_respondent_name, "Jane Smith");
      assert.equal(caseRow.counter_respondent_email, "jane@example.com");
      assert.equal(caseRow.counter_statement, VALID_COUNTER.counterStatement);
    });

    it("prevents duplicate counter-notification", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      dmca.submitCounterNotification(caseId, VALID_COUNTER);

      const duplicateResult = dmca.submitCounterNotification(caseId, {
        ...VALID_COUNTER,
        respondentName: "Another Person",
      });

      assert.ok(!duplicateResult.ok);
      assert.equal(duplicateResult.error, "A counter-notification has already been filed for this case.");
    });

    it("prevents counter-notification on resolved case", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      dmca.resolveCase(caseId, "upheld", "Resolved.", "admin-1");

      const result = dmca.submitCounterNotification(caseId, VALID_COUNTER);

      assert.ok(!result.ok);
      assert.equal(result.error, "This case has already been resolved.");
    });

    it("full lifecycle with counter: submit -> counter -> resolve", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      assert.equal(dmca.getCase(caseId).status, "pending");

      dmca.submitCounterNotification(caseId, VALID_COUNTER);
      assert.equal(dmca.getCase(caseId).status, "counter_filed");

      dmca.resolveCase(caseId, "dismissed", "Counter-notification upheld. Content restored.");
      assert.equal(dmca.getCase(caseId).status, "resolved");
      assert.equal(dmca.getCase(caseId).resolution, "dismissed");
    });
  });

  // ── Case Status Transitions ──────

  describe("Case Status Transitions", () => {
    it("status transitions: pending -> counter_filed -> resolved", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      assert.equal(dmca.getCase(caseId).status, "pending");

      dmca.submitCounterNotification(caseId, VALID_COUNTER);
      assert.equal(dmca.getCase(caseId).status, "counter_filed");

      dmca.resolveCase(caseId, "counter_filed", "Resolved after counter-notification.");
      assert.equal(dmca.getCase(caseId).status, "resolved");
    });

    it("status transitions: pending -> resolved (no counter)", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      dmca.resolveCase(caseId, "upheld", "Clear infringement.");

      assert.equal(dmca.getCase(caseId).status, "resolved");
    });

    it("prevents double resolution", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      dmca.resolveCase(caseId, "upheld", "First resolution.");

      const result = dmca.resolveCase(caseId, "dismissed", "Second resolution attempt.");
      assert.ok(!result.ok);
      assert.equal(result.error, "This case has already been resolved.");
    });

    it("all cases are queryable by status", () => {
      dmca.submitNotice(VALID_NOTICE);
      dmca.submitNotice({ ...VALID_NOTICE, claimantEmail: "user2@example.com" });

      const { caseId: resolved } = dmca.submitNotice({ ...VALID_NOTICE, claimantEmail: "user3@example.com" });
      dmca.resolveCase(resolved, "upheld", "Resolved.");

      const pendingCases = dmca.getAllCases({ status: "pending" });
      assert.equal(pendingCases.length, 2);

      const resolvedCases = dmca.getAllCases({ status: "resolved" });
      assert.equal(resolvedCases.length, 1);
    });
  });

  // ── Input Validation ──────

  describe("Input Validation", () => {
    it("rejects notice with missing claimant name", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        claimantName: "",
      });
      assert.ok(!result.ok);
      assert.ok(result.error.includes("claimantName"));
    });

    it("rejects notice with missing claimant email", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        claimantEmail: "",
      });
      assert.ok(!result.ok);
      assert.ok(result.error.includes("claimantEmail"));
    });

    it("rejects notice with invalid email format", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        claimantEmail: "not-an-email",
      });
      assert.ok(!result.ok);
      assert.equal(result.error, "Invalid email address format.");
    });

    it("rejects notice with missing copyright work", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        copyrightWork: "",
      });
      assert.ok(!result.ok);
      assert.ok(result.error.includes("copyrightWork"));
    });

    it("rejects notice with missing description", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        description: "",
      });
      assert.ok(!result.ok);
      assert.ok(result.error.includes("description"));
    });

    it("rejects notice with missing signature", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        signature: "",
      });
      assert.ok(!result.ok);
      assert.ok(result.error.includes("signature"));
    });

    it("rejects notice without good faith statement", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        goodFaithStatement: false,
      });
      assert.ok(!result.ok);
      assert.equal(result.error, "Both good faith and accuracy statements must be affirmed.");
    });

    it("rejects notice without accuracy statement", () => {
      const result = dmca.submitNotice({
        ...VALID_NOTICE,
        accuracyStatement: false,
      });
      assert.ok(!result.ok);
      assert.equal(result.error, "Both good faith and accuracy statements must be affirmed.");
    });

    it("rejects counter-notification with missing fields", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      const result = dmca.submitCounterNotification(caseId, {
        respondentName: "Jane",
        respondentEmail: "",
        counterStatement: "",
        consentToJurisdiction: true,
        signature: "Jane",
      });
      assert.ok(!result.ok);
      assert.ok(result.error.includes("respondentEmail"));
    });

    it("rejects counter-notification without consent to jurisdiction", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      const result = dmca.submitCounterNotification(caseId, {
        ...VALID_COUNTER,
        consentToJurisdiction: false,
      });
      assert.ok(!result.ok);
      assert.equal(result.error, "Consent to jurisdiction is required for counter-notifications.");
    });

    it("rejects invalid resolution type", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);

      const result = dmca.resolveCase(caseId, "invalid_resolution", "Notes.");
      assert.ok(!result.ok);
      assert.ok(result.error.includes("Resolution must be one of"));
    });

    it("returns error for non-existent case ID", () => {
      const caseRow = dmca.getCase("dmca_nonexistent");
      assert.equal(caseRow, null);

      const resolveResult = dmca.resolveCase("dmca_nonexistent", "upheld", "Notes.");
      assert.ok(!resolveResult.ok);
      assert.equal(resolveResult.error, "DMCA case not found.");

      const counterResult = dmca.submitCounterNotification("dmca_nonexistent", VALID_COUNTER);
      assert.ok(!counterResult.ok);
      assert.equal(counterResult.error, "DMCA case not found.");
    });
  });

  // ── Audit Trail ──────

  describe("Audit Trail", () => {
    it("records audit entry on notice submission", () => {
      dmca.submitNotice(VALID_NOTICE);

      const log = dmca.getAuditLog();
      assert.equal(log.length, 1);
      assert.equal(log[0].action, "notice_submitted");
      assert.equal(log[0].claimantEmail, "john@example.com");
      assert.ok(log[0].caseId);
      assert.ok(log[0].timestamp);
    });

    it("records audit entry on counter-notification", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);
      dmca.submitCounterNotification(caseId, VALID_COUNTER);

      const log = dmca.getAuditLog();
      assert.equal(log.length, 2);
      assert.equal(log[1].action, "counter_notification_filed");
      assert.equal(log[1].respondentEmail, "jane@example.com");
    });

    it("records audit entry on case resolution", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);
      dmca.resolveCase(caseId, "upheld", "Confirmed.", "admin-1");

      const log = dmca.getAuditLog();
      assert.equal(log.length, 2);
      assert.equal(log[1].action, "case_resolved");
      assert.equal(log[1].resolution, "upheld");
      assert.equal(log[1].resolvedBy, "admin-1");
    });

    it("full lifecycle audit trail is complete", () => {
      const { caseId } = dmca.submitNotice(VALID_NOTICE);
      dmca.submitCounterNotification(caseId, VALID_COUNTER);
      dmca.resolveCase(caseId, "dismissed", "Counter prevailed.", "admin-1");

      const log = dmca.getAuditLog();
      assert.equal(log.length, 3);

      // All entries should have the same caseId
      assert.ok(log.every((entry) => entry.caseId === caseId));

      // Actions in order
      assert.equal(log[0].action, "notice_submitted");
      assert.equal(log[1].action, "counter_notification_filed");
      assert.equal(log[2].action, "case_resolved");

      // Timestamps should be chronological
      for (let i = 1; i < log.length; i++) {
        assert.ok(log[i].timestamp >= log[i - 1].timestamp);
      }
    });

    it("multiple cases have independent audit trails", () => {
      dmca.submitNotice(VALID_NOTICE);
      dmca.submitNotice({ ...VALID_NOTICE, claimantEmail: "other@example.com" });

      const log = dmca.getAuditLog();
      assert.equal(log.length, 2);

      // Different case IDs
      assert.notEqual(log[0].caseId, log[1].caseId);
    });
  });
});
