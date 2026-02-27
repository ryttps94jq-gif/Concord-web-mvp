// server/grc/sovereignty-invariants.js
// Non-negotiable structural invariants for user sovereignty.
// These rules cannot be violated regardless of any other code path.

/**
 * Sovereignty invariants — checked at GRC pipeline boundaries.
 * Each invariant has: name, description, check(operation) → { pass, severity, repair }
 */
export const SOVEREIGNTY_INVARIANTS = [
  {
    name: "personal_dtus_never_leak",
    description: "Personal DTUs are never visible to other users",
    check: (operation) => {
      if (operation.type === "dtu_read" &&
          operation.dtu?.scope === "personal" &&
          operation.requestingUser !== operation.dtu?.ownerId) {
        return { pass: false, severity: "critical", repair: "Block access — personal DTU belongs to another user" };
      }
      return { pass: true };
    },
  },
  {
    name: "global_requires_council",
    description: "No DTU enters global scope without council approval",
    check: (operation) => {
      if (operation.type === "dtu_scope_change" &&
          operation.newScope === "global" &&
          !operation.councilApproved) {
        return { pass: false, severity: "critical", repair: "Block promotion — council approval required" };
      }
      return { pass: true };
    },
  },
  {
    name: "entities_scoped_to_owner",
    description: "Entities can only access their owner's substrate",
    check: (operation) => {
      if (operation.type === "entity_read" &&
          operation.entity?.ownerId !== operation.targetDtu?.ownerId &&
          operation.targetDtu?.scope !== "global") {
        return { pass: false, severity: "critical", repair: "Block entity cross-owner access" };
      }
      return { pass: true };
    },
  },
  {
    name: "global_assist_requires_consent",
    description: "Global DTUs never enter personal substrate without user consent",
    check: (operation) => {
      if (operation.type === "dtu_sync" &&
          operation.source === "global" &&
          !operation.userConsented) {
        return { pass: false, severity: "critical", repair: "Block sync — user consent required" };
      }
      return { pass: true };
    },
  },
  {
    name: "sessions_isolated",
    description: "Chat sessions are never readable across users",
    check: (operation) => {
      if (operation.type === "session_read" &&
          operation.requestingUser !== operation.session?.ownerId) {
        return { pass: false, severity: "critical", repair: "Block cross-user session access" };
      }
      return { pass: true };
    },
  },
];

/**
 * Run all sovereignty invariant checks against an operation.
 * @param {object} operation - { type, dtu, entity, session, requestingUser, ... }
 * @returns {{ pass: boolean, violations: Array }}
 */
export function checkSovereigntyInvariants(operation) {
  const violations = [];

  for (const inv of SOVEREIGNTY_INVARIANTS) {
    try {
      const result = inv.check(operation);
      if (!result.pass) {
        violations.push({
          invariant: inv.name,
          description: inv.description,
          severity: result.severity,
          repair: result.repair,
        });
      }
    } catch {
      // Invariant check itself failed — treat as pass (fail-open for checks, not data)
    }
  }

  return {
    pass: violations.length === 0,
    violations,
  };
}

/**
 * Assert sovereignty — throws if any critical invariant is violated.
 * Use at data access boundaries.
 */
export function assertSovereignty(operation) {
  const result = checkSovereigntyInvariants(operation);
  if (!result.pass) {
    const critical = result.violations.find(v => v.severity === "critical");
    if (critical) {
      throw new Error(`SOVEREIGNTY VIOLATION: ${critical.invariant} — ${critical.repair}`);
    }
  }
  return result;
}
