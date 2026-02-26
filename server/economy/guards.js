// economy/guards.js
// Module-local admin gating for economy and Stripe routes.
// Does not depend on global middleware — enforces locally.

import crypto from "crypto";

const FOUNDER_SECRET = process.env.FOUNDER_SECRET || "";

/**
 * Check if the request is from an admin or founder.
 * Uses: JWT role claim, FOUNDER_SECRET header, or wildcard scope.
 * @returns {{ ok: boolean, error?: string }}
 */
export function requireAdmin(req) {
  // Public auth mode — allow (global middleware handles this)
  if (process.env.AUTH_MODE === "public") return { ok: true };

  // Check FOUNDER_SECRET header (ops backdoor) — timing-safe comparison
  if (FOUNDER_SECRET) {
    const provided = req.headers["x-founder-secret"] || "";
    if (provided && provided.length === FOUNDER_SECRET.length) {
      try {
        const a = Buffer.from(provided, "utf-8");
        const b = Buffer.from(FOUNDER_SECRET, "utf-8");
        if (crypto.timingSafeEqual(a, b)) {
          return { ok: true, method: "founder_secret" };
        }
      } catch { /* length mismatch or encoding error — fall through */ }
    }
  }

  // Check JWT/session user
  if (!req.user) {
    return { ok: false, error: "auth_required", status: 401 };
  }

  const role = req.user.role;
  const scopes = req.user.scopes;

  // Admin, owner, or wildcard scope
  if (role === "admin" || role === "owner" || role === "founder") {
    return { ok: true, method: "role", role };
  }

  if (scopes && (scopes.includes("*") || scopes.includes("economy:admin"))) {
    return { ok: true, method: "scope" };
  }

  return { ok: false, error: "forbidden", status: 403 };
}

/**
 * Check if the request is from an authenticated user.
 */
export function requireUser(req) {
  if (process.env.AUTH_MODE === "public") return { ok: true };

  if (!req.user) {
    return { ok: false, error: "auth_required", status: 401 };
  }

  return { ok: true, userId: req.user.id };
}

/**
 * Express middleware: reject non-admin requests.
 */
export function adminOnly(req, res, next) {
  const check = requireAdmin(req);
  if (!check.ok) {
    return res.status(check.status || 403).json({ ok: false, error: check.error });
  }
  next();
}

/**
 * Express middleware: reject unauthenticated requests.
 */
export function authRequired(req, res, next) {
  const check = requireUser(req);
  if (!check.ok) {
    return res.status(check.status || 401).json({ ok: false, error: check.error });
  }
  next();
}
