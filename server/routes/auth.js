/**
 * Auth routes — extracted from server.js
 * Mounted at /api/auth
 */
const express = require("express");
const crypto = require("crypto");

module.exports = function createAuthRouter({
  AuthDB,
  AuditDB,
  db,
  jwt,
  authRateLimiter,
  _TOKEN_BLACKLIST,
  _REFRESH_FAMILIES,
  REFRESH_TOKEN_COOKIE,
  NODE_ENV,
  validate,
  hashPassword,
  verifyPassword,
  createToken,
  createRefreshToken,
  verifyToken,
  setAuthCookie,
  setRefreshCookie,
  clearAuthCookie,
  auditLog,
  generateApiKey,
  hashApiKey,
  requireRole,
  generateCsrfToken,
  uid,
  structuredLog,
  saveAuthData
}) {
  const router = express.Router();

  // Apply stricter rate limiting to auth endpoints
  const authRateLimitMiddleware = authRateLimiter || ((req, res, next) => next());

  router.post("/register", authRateLimitMiddleware, validate("userRegister"), (req, res) => {
    const { username, email, password } = req.validated || req.body;

    // Check if registration is allowed
    if (String(process.env.ALLOW_REGISTRATION || "true").toLowerCase() !== "true") {
      return res.status(403).json({ ok: false, error: "Registration disabled" });
    }

    // Check for existing user
    if (AuthDB.getUserByUsername(username)) {
      return res.status(409).json({ ok: false, error: "Username taken" });
    }
    if (AuthDB.getUserByEmail(email)) {
      return res.status(409).json({ ok: false, error: "Email taken" });
    }

    const userId = crypto.randomUUID();
    const userCount = AuthDB.getUserCount();
    const user = {
      id: userId,
      username,
      email,
      passwordHash: hashPassword(password),
      role: userCount === 0 ? "owner" : "member",
      scopes: userCount === 0 ? ["*"] : ["read", "write"],
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    // Guard: if bcrypt is unavailable, passwordHash will be null — reject registration
    if (!user.passwordHash) {
      return res.status(503).json({ ok: false, error: "Password hashing unavailable. Install bcryptjs to enable registration." });
    }

    AuthDB.createUser(user);

    const token = createToken(userId);
    const refreshToken = createRefreshToken(userId);

    // SECURITY: Set httpOnly cookies for browser auth
    if (token) setAuthCookie(res, token);
    if (refreshToken) setRefreshCookie(res, refreshToken);

    // Track refresh token family
    try {
      const decoded = jwt.decode(refreshToken);
      if (decoded?.family) _REFRESH_FAMILIES.set(decoded.family, { userId, currentJti: decoded.jti, rotatedAt: Date.now() });
    } catch {}

    // Audit log registration
    auditLog("auth", "register", {
      userId,
      username,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({
      ok: true,
      user: { id: userId, username, email, role: user.role },
      token // Also return token for non-browser clients
    });
  });

  router.post("/login", authRateLimitMiddleware, validate("userLogin"), (req, res) => {
    const { username, email, password } = req.validated || req.body;

    // Find user by username or email
    let user = null;
    if (username) {
      user = AuthDB.getUserByUsername(username);
    } else if (email) {
      user = AuthDB.getUserByEmail(email);
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      // Audit failed login attempt
      auditLog("auth", "login_failed", {
        attemptedUser: username || email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        requestId: req.id
      });
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    AuthDB.updateUserLogin(user.id);

    const token = createToken(user.id);
    const refreshToken = createRefreshToken(user.id);

    // SECURITY: Set httpOnly cookies for browser auth
    if (token) setAuthCookie(res, token);
    if (refreshToken) setRefreshCookie(res, refreshToken);

    // Track refresh token family
    try {
      if (refreshToken) {
        const decoded = jwt.decode(refreshToken);
        if (decoded?.family) _REFRESH_FAMILIES.set(decoded.family, { userId: user.id, currentJti: decoded.jti, rotatedAt: Date.now() });
      }
    } catch {}

    // Audit successful login
    auditLog("auth", "login_success", {
      userId: user.id,
      username: user.username,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      ok: true,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token: token || undefined // Only return token if JWT is available
    });
  });

  router.get("/me", (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Not authenticated" });
    res.json({
      ok: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        scopes: req.user.scopes
      }
    });
  });

  // Logout - clears auth cookie + blacklists token (Tier 1: Auth Hardening)
  router.post("/logout", (req, res) => {
    // Blacklist current access token so it can't be replayed
    const cookieToken = req.cookies?.concord_auth;
    if (cookieToken && jwt) {
      try {
        const decoded = jwt.decode(cookieToken);
        if (decoded?.jti) {
          const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 7 * 86400000;
          _TOKEN_BLACKLIST.revoke(decoded.jti, expiresAt, decoded.userId || decoded.sub || (req.user && req.user.id));
        }
      } catch {}
    }

    // Also revoke refresh token
    const refreshCookie = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshCookie && jwt) {
      try {
        const decoded = jwt.decode(refreshCookie);
        if (decoded?.jti) _TOKEN_BLACKLIST.revoke(decoded.jti, Date.now() + 30 * 86400000, decoded.userId || decoded.sub || (req.user && req.user.id));
        if (decoded?.family) _REFRESH_FAMILIES.delete(decoded.family);
      } catch {}
    }

    // Audit logout
    if (req.user) {
      auditLog("auth", "logout", {
        userId: req.user.id,
        username: req.user.username,
        ip: req.ip,
        userAgent: req.headers["user-agent"]
      });
    }

    // Clear auth cookies
    clearAuthCookie(res);

    res.json({ ok: true, message: "Logged out successfully" });
  });

  // ---- Refresh Token Endpoint (Tier 1: Auth Hardening) ----
  router.post("/refresh", (req, res) => {
    const refreshCookie = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshCookie) {
      return res.status(401).json({ ok: false, error: "No refresh token provided", code: "REFRESH_MISSING" });
    }

    const decoded = verifyToken(refreshCookie);
    if (!decoded || decoded.type !== "refresh") {
      clearAuthCookie(res);
      return res.status(401).json({ ok: false, error: "Invalid or expired refresh token", code: "REFRESH_INVALID" });
    }

    // Check token family for theft detection (refresh token rotation)
    const family = _REFRESH_FAMILIES.get(decoded.family);
    if (family && family.currentJti !== decoded.jti) {
      // This refresh token was already used! Possible token theft.
      // Revoke the entire family and force re-login.
      _TOKEN_BLACKLIST.revokeAllForUser(decoded.userId);
      _REFRESH_FAMILIES.delete(decoded.family);
      clearAuthCookie(res);
      auditLog("security", "refresh_token_reuse", {
        userId: decoded.userId,
        family: decoded.family,
        ip: req.ip,
        userAgent: req.headers["user-agent"]
      });
      return res.status(401).json({ ok: false, error: "Token reuse detected. All sessions revoked for security.", code: "TOKEN_THEFT_DETECTED" });
    }

    // Revoke old refresh token
    _TOKEN_BLACKLIST.revoke(decoded.jti, decoded.exp ? decoded.exp * 1000 : Date.now() + 30 * 86400000, decoded.userId);

    // Issue new token pair (rotation)
    const user = AuthDB.getUser(decoded.userId);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    const newAccessToken = createToken(user.id);
    const newRefreshToken = createRefreshToken(user.id);

    setAuthCookie(res, newAccessToken);
    if (newRefreshToken) setRefreshCookie(res, newRefreshToken);

    // Update family tracking
    try {
      const newDecoded = jwt.decode(newRefreshToken);
      if (newDecoded?.family) {
        _REFRESH_FAMILIES.set(newDecoded.family, { userId: user.id, currentJti: newDecoded.jti, rotatedAt: Date.now() });
      }
    } catch {}

    auditLog("auth", "token_refresh", { userId: user.id, ip: req.ip });

    res.json({
      ok: true,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token: newAccessToken
    });
  });

  // ---- Revoke All Sessions (Tier 1: Auth Hardening) ----
  router.post("/revoke-all-sessions", (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Not authenticated" });

    _TOKEN_BLACKLIST.revokeAllForUser(req.user.id);

    // Clear own family entries
    for (const [family, entry] of _REFRESH_FAMILIES) {
      if (entry.userId === req.user.id) _REFRESH_FAMILIES.delete(family);
    }

    auditLog("auth", "revoke_all_sessions", {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    clearAuthCookie(res);
    res.json({ ok: true, message: "All sessions revoked. Please log in again." });
  });

  // CSRF Token endpoint - provides token for state-changing requests
  router.get("/csrf-token", (req, res) => {
    const csrfToken = generateCsrfToken(req.user?.id || req.ip);

    // Set CSRF cookie (readable by JS for double-submit pattern)
    res.cookie("csrf_token", csrfToken, {
      httpOnly: false, // JS needs to read this
      secure: NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/"
    });

    res.json({ ok: true, csrfToken });
  });

  // Audit log endpoint (admin only) - uses SQLite for persistent logs
  router.get("/audit-log", requireRole("owner", "admin"), (req, res) => {
    const { limit = 100, offset = 0, category, action, userId, startDate, endDate } = req.query;

    // Use AuditDB for SQLite-backed queries (falls back to memory)
    const logs = AuditDB.query({
      limit: Number(limit),
      offset: Number(offset),
      category,
      action,
      userId,
      startDate,
      endDate
    });

    const total = AuditDB.count({ category, userId });

    res.json({
      ok: true,
      total,
      offset: Number(offset),
      limit: Number(limit),
      persistent: db !== null, // Indicates if using SQLite
      logs
    });
  });

  router.post("/api-keys", requireRole("owner", "admin"), validate("apiKeyCreate"), (req, res) => {
    const { name, scopes } = req.validated || req.body;
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);

    // SECURITY: Store only the hash, not the raw key
    AuthDB.createApiKey({
      id: uid("apikey"),
      userId: req.user.id,
      name,
      keyHash: hashedKey,
      keyPrefix: apiKey.slice(0, 8),
      scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    });

    // Audit log API key creation
    auditLog("api_key", "created", {
      userId: req.user.id,
      keyName: name,
      ip: req.ip,
      requestId: req.id
    });

    // Return the raw key ONCE - user must save it, we can't recover it
    res.status(201).json({
      ok: true,
      apiKey, // Raw key - only returned once
      name,
      scopes,
      warning: "Save this API key now. It cannot be retrieved again."
    });
  });

  router.get("/api-keys", (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Not authenticated" });

    // Get keys for user (or all keys for owner)
    const userKeys = req.user.role === "owner"
      ? AuthDB.getAllApiKeys()
      : AuthDB.getApiKeysByUser(req.user.id);

    const keys = userKeys.map(data => ({
      id: data.id,
      keyPrefix: data.keyPrefix + "...",
      name: data.name,
      scopes: data.scopes,
      createdAt: data.createdAt,
      lastUsedAt: data.lastUsedAt
    }));

    res.json({ ok: true, apiKeys: keys });
  });

  router.delete("/api-keys/:keyId", (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const keyId = req.params.keyId;
    const deleted = AuthDB.deleteApiKey(keyId, req.user.id);

    if (deleted) {
      auditLog("api_key", "deleted", {
        userId: req.user.id,
        keyId,
        ip: req.ip,
        requestId: req.id
      });
      return res.json({ ok: true });
    }

    res.status(404).json({ ok: false, error: "API key not found" });
  });

  // API Key Rotation - creates new key and invalidates old one atomically
  router.post("/api-keys/:keyId/rotate", requireRole("owner", "admin"), (req, res) => {
    const keyId = req.params.keyId;

    // Find the existing key
    const allKeys = AuthDB.getAllApiKeys();
    const existingKey = allKeys.find(k => k.id === keyId && k.userId === req.user.id);

    if (!existingKey) {
      return res.status(404).json({ ok: false, error: "API key not found" });
    }

    // Generate new key
    const newApiKey = generateApiKey();
    const newHashedKey = hashApiKey(newApiKey);

    // Create new key with same name and scopes
    AuthDB.createApiKey({
      id: uid("apikey"),
      userId: req.user.id,
      name: existingKey.name + " (rotated)",
      keyHash: newHashedKey,
      keyPrefix: newApiKey.slice(0, 8),
      scopes: existingKey.scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    });

    // Delete old key
    AuthDB.deleteApiKey(keyId, req.user.id);

    // Audit log rotation
    auditLog("api_key", "rotated", {
      userId: req.user.id,
      oldKeyId: keyId,
      newKeyPrefix: newApiKey.slice(0, 8),
      ip: req.ip,
      requestId: req.id
    });

    structuredLog("info", "api_key_rotated", {
      userId: req.user.id,
      keyName: existingKey.name
    });

    res.status(201).json({
      ok: true,
      apiKey: newApiKey,
      warning: "Save this API key now. It cannot be retrieved again. The old key has been invalidated."
    });
  });

  // Password change endpoint
  router.post("/change-password", (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "Both current and new password required" });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({ ok: false, error: "New password must be at least 12 characters" });
    }

    // Verify current password
    const user = AuthDB.getUser(req.user.id);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      auditLog("auth", "password_change_failed", {
        userId: req.user.id,
        reason: "invalid_current_password",
        ip: req.ip,
        requestId: req.id
      });
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }

    // Update password in database
    if (db) {
      const stmt = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
      stmt.run(hashPassword(newPassword), req.user.id);
    } else {
      user.passwordHash = hashPassword(newPassword);
      saveAuthData();
    }

    auditLog("auth", "password_changed", {
      userId: req.user.id,
      ip: req.ip,
      requestId: req.id
    });

    structuredLog("info", "password_changed", { userId: req.user.id });

    res.json({ ok: true, message: "Password changed successfully" });
  });

  return router;
};
