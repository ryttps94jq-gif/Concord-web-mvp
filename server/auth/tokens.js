// ---- Auth / Token Infrastructure ----
// Extracted from server.js — ESM module
//
// Dependencies are injected via initTokens(deps) to avoid circular imports.
// Call initTokens() once at startup before using any exported functions.

import crypto from "crypto";

let jwt = null;
let bcrypt = null;
let db = null;
let EFFECTIVE_JWT_SECRET = "";
let JWT_EXPIRES_IN = "7d";
let BCRYPT_ROUNDS = 12;
let NODE_ENV = "development";
let REFRESH_TOKEN_EXPIRES = "30d";
let REFRESH_TOKEN_COOKIE = "concord_refresh";

/**
 * Initialize token infrastructure with runtime dependencies.
 * Must be called once before using any exported functions.
 */
export function initTokens(deps) {
  jwt = deps.jwt ?? null;
  bcrypt = deps.bcrypt ?? null;
  db = deps.db ?? null;
  EFFECTIVE_JWT_SECRET = deps.EFFECTIVE_JWT_SECRET || "";
  JWT_EXPIRES_IN = deps.JWT_EXPIRES_IN || "7d";
  BCRYPT_ROUNDS = deps.BCRYPT_ROUNDS ?? 12;
  NODE_ENV = deps.NODE_ENV || "development";
  REFRESH_TOKEN_EXPIRES = deps.REFRESH_TOKEN_EXPIRES || "30d";
  REFRESH_TOKEN_COOKIE = deps.REFRESH_TOKEN_COOKIE || "concord_refresh";
}

// Auth helper functions
export function createToken(userId, expiresIn = JWT_EXPIRES_IN) {
  if (!jwt) return null;
  const jti = crypto.randomBytes(16).toString("hex"); // Unique token ID for revocation
  return jwt.sign({ userId, jti, iat: Math.floor(Date.now() / 1000) }, EFFECTIVE_JWT_SECRET, { expiresIn });
}

// ---- Refresh Token (Tier 1: Auth Hardening) ----
export function createRefreshToken(userId) {
  if (!jwt) return null;
  const jti = crypto.randomBytes(16).toString("hex");
  const family = crypto.randomBytes(8).toString("hex"); // Token family for rotation detection
  return jwt.sign({ userId, jti, family, type: "refresh", iat: Math.floor(Date.now() / 1000) }, EFFECTIVE_JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
}

export function verifyToken(token) {
  if (!jwt) return null;
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    // ---- Token Revocation Check (Tier 1: Auth Hardening) ----
    if (decoded.jti && _TOKEN_BLACKLIST.isRevoked(decoded.jti)) {
      return null; // Token has been revoked
    }
    return decoded;
  } catch { return null; }
}

// ---- Token Blacklist (Tier 1: Auth Hardening) ----
// In-memory blacklist with SQLite persistence when available
export const _TOKEN_BLACKLIST = {
  revoked: new Map(), // jti -> { revokedAt, expiresAt }

  revoke(jti, expiresAt, userId) {
    this.revoked.set(jti, { revokedAt: Date.now(), expiresAt: expiresAt || Date.now() + 7 * 86400000, userId: userId || null });
    // Persist to DB if available
    if (db) {
      try {
        const stmt = db.prepare("UPDATE sessions SET is_revoked = 1 WHERE token_hash = ?");
        stmt.run(jti);
      } catch (err) { console.error('[auth] Token revocation failed:', err); }
    }
  },

  isRevoked(jti) {
    return this.revoked.has(jti);
  },

  // Revoke all tokens for a user (e.g., password change, security incident)
  revokeAllForUser(userId) {
    if (db) {
      try {
        const stmt = db.prepare("UPDATE sessions SET is_revoked = 1 WHERE user_id = ?");
        stmt.run(userId);
      } catch (err) { console.error('[auth] Bulk token revocation failed for user:', err); }
    }
    // Mark in-memory
    for (const [jti, entry] of this.revoked) {
      if (entry.userId === userId) this.revoked.set(jti, { ...entry, revokedAt: Date.now() });
    }
  },

  // Cleanup expired entries (tokens past their expiry don't need blacklisting)
  cleanup() {
    const now = Date.now();
    for (const [jti, entry] of this.revoked) {
      if (now > entry.expiresAt) this.revoked.delete(jti);
    }
  }
};

// Cleanup blacklist every hour
setInterval(() => _TOKEN_BLACKLIST.cleanup(), 3600000);

// ---- Refresh Token Family Tracking (detects token theft via reuse) ----
export const _REFRESH_FAMILIES = new Map(); // family -> { userId, currentJti, rotatedAt }

export function hashPassword(password) {
  if (!bcrypt) return null;
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password, hash) {
  if (!bcrypt) return false;
  return bcrypt.compareSync(password, hash);
}

export function generateApiKey() {
  return `ck_${crypto.randomBytes(32).toString("hex")}`;
}

// SECURITY: Hash API keys for storage (only store hash, return raw key once on creation)
export function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function verifyApiKey(rawKey, hashedKey) {
  const hash = hashApiKey(rawKey);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedKey));
  } catch {
    return false;
  }
}

// ============================================================================
// SECURITY: Cookie Configuration
// ============================================================================
function getCookieConfig() {
  return {
    httpOnly: true,
    secure: NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/"
  };
}

export function setAuthCookie(res, token) {
  res.cookie("concord_auth", token, getCookieConfig());
}

export function clearAuthCookie(res) {
  res.clearCookie("concord_auth", { path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/"
  });
}

// ============================================================================
// SECURITY: CSRF Protection (Double-Submit Cookie Pattern)
// Privacy-friendly: no server-side state, token derived from session
// ============================================================================
export function generateCsrfToken(sessionId = "") {
  // Generate a token based on a secret + session identifier
  const secret = EFFECTIVE_JWT_SECRET.slice(0, 32);
  const data = `${sessionId}:${Date.now()}`;
  return crypto.createHmac("sha256", secret).update(data).digest("hex").slice(0, 32);
}

export function validateCsrfToken(token, cookieToken) {
  if (!token || !cookieToken) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cookieToken));
  } catch {
    return false;
  }
}
