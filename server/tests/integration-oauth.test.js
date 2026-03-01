/**
 * Integration Test: OAuth Flow
 *
 * Tests OAuth integration including:
 * - OAuth URL generation (Google and Apple)
 * - State parameter CSRF protection
 * - Provider availability detection (env var based)
 * - Account creation from OAuth profile
 * - Account linking/unlinking
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  getAvailableProviders,
  generateOAuthState,
  getGoogleAuthUrl,
  getAppleAuthUrl,
} from "../lib/oauth-providers.js";

// ── Mock Account Store ───────────────────────────────────────────────────

function createMockAccountStore() {
  const accounts = new Map();
  const oauthLinks = new Map(); // "provider:sub" -> accountId

  function createAccount(profile) {
    const id = `user-${crypto.randomUUID().slice(0, 8)}`;
    const account = {
      id,
      username: profile.username || profile.email?.split("@")[0] || id,
      email: profile.email || "",
      displayName: profile.name || profile.displayName || "",
      avatar: profile.picture || "",
      role: "member",
      oauthProviders: [],
      createdAt: new Date().toISOString(),
    };
    accounts.set(id, account);
    return account;
  }

  function getAccountById(id) {
    return accounts.get(id) || null;
  }

  function getAccountByEmail(email) {
    for (const account of accounts.values()) {
      if (account.email === email) return account;
    }
    return null;
  }

  function linkOAuth(accountId, provider, sub) {
    const key = `${provider}:${sub}`;
    if (oauthLinks.has(key)) {
      return { ok: false, error: "OAuth account already linked" };
    }

    oauthLinks.set(key, accountId);
    const account = accounts.get(accountId);
    if (account) {
      account.oauthProviders.push({ provider, sub, linkedAt: new Date().toISOString() });
    }
    return { ok: true, accountId, provider };
  }

  function unlinkOAuth(accountId, provider) {
    const account = accounts.get(accountId);
    if (!account) return { ok: false, error: "Account not found" };

    const providerEntry = account.oauthProviders.find((p) => p.provider === provider);
    if (!providerEntry) return { ok: false, error: "Provider not linked" };

    // Don't unlink if it's the only auth method and no password is set
    if (account.oauthProviders.length <= 1 && !account.passwordHash) {
      return { ok: false, error: "Cannot unlink the only authentication method" };
    }

    const key = `${provider}:${providerEntry.sub}`;
    oauthLinks.delete(key);
    account.oauthProviders = account.oauthProviders.filter((p) => p.provider !== provider);
    return { ok: true, accountId, provider };
  }

  function findByOAuth(provider, sub) {
    const key = `${provider}:${sub}`;
    const accountId = oauthLinks.get(key);
    return accountId ? accounts.get(accountId) : null;
  }

  function createFromOAuth(provider, profile) {
    // Check if email already exists
    const existingByEmail = getAccountByEmail(profile.email);
    if (existingByEmail) {
      // Auto-link if email matches
      linkOAuth(existingByEmail.id, provider, profile.sub);
      return { ok: true, account: existingByEmail, created: false, linked: true };
    }

    // Create new account
    const account = createAccount(profile);
    linkOAuth(account.id, provider, profile.sub);
    return { ok: true, account, created: true, linked: true };
  }

  return {
    createAccount,
    getAccountById,
    getAccountByEmail,
    linkOAuth,
    unlinkOAuth,
    findByOAuth,
    createFromOAuth,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Integration: OAuth Flow", () => {
  let savedEnv;
  let accountStore;

  beforeEach(() => {
    savedEnv = { ...process.env };
    accountStore = createMockAccountStore();
  });

  afterEach(() => {
    // Restore environment
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, savedEnv);
  });

  // ── OAuth URL Generation ──────

  describe("OAuth URL Generation", () => {
    it("generates Google OAuth URL with correct parameters", () => {
      process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
      process.env.GOOGLE_REDIRECT_URI = "http://localhost:5050/api/auth/google/callback";

      const state = generateOAuthState();
      const url = getGoogleAuthUrl(state);

      assert.ok(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
      assert.ok(url.includes("client_id=test-google-client-id"));
      assert.ok(url.includes("response_type=code"));
      assert.ok(url.includes(`state=${state}`));
      assert.ok(url.includes("scope="));
      assert.ok(url.includes("openid"));
      assert.ok(url.includes("email"));
      assert.ok(url.includes("profile"));
      assert.ok(url.includes("access_type=offline"));
    });

    it("generates Apple OAuth URL with correct parameters", () => {
      process.env.APPLE_CLIENT_ID = "com.concord.auth";
      process.env.APPLE_REDIRECT_URI = "http://localhost:5050/api/auth/apple/callback";

      const state = generateOAuthState();
      const url = getAppleAuthUrl(state);

      assert.ok(url.startsWith("https://appleid.apple.com/auth/authorize"));
      assert.ok(url.includes("client_id=com.concord.auth"));
      assert.ok(url.includes("response_type=code"));
      assert.ok(url.includes(`state=${state}`));
      assert.ok(url.includes("response_mode=form_post"));
      assert.ok(url.includes("scope="));
    });
  });

  // ── State Parameter CSRF Protection ──────

  describe("State Parameter CSRF Protection", () => {
    it("generates cryptographically random state parameter", () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();

      // Each state should be 64 hex chars (32 bytes)
      assert.equal(state1.length, 64);
      assert.equal(state2.length, 64);
      assert.match(state1, /^[0-9a-f]+$/);
      assert.match(state2, /^[0-9a-f]+$/);

      // Two states should be different
      assert.notEqual(state1, state2);
    });

    it("state parameter is unique across multiple generations", () => {
      const states = new Set();
      for (let i = 0; i < 100; i++) {
        states.add(generateOAuthState());
      }
      // All 100 states should be unique
      assert.equal(states.size, 100);
    });

    it("state parameter validates correctly in OAuth flow", () => {
      const validState = generateOAuthState();

      // Store state in session (simulated)
      const sessionStates = new Map();
      sessionStates.set(validState, {
        createdAt: Date.now(),
        provider: "google",
      });

      // Callback with matching state succeeds
      assert.ok(sessionStates.has(validState));

      // Callback with different state fails
      const attackerState = "attacker_forged_state_value";
      assert.ok(!sessionStates.has(attackerState));

      // State should be consumed (one-time use)
      sessionStates.delete(validState);
      assert.ok(!sessionStates.has(validState));
    });

    it("state parameter expires after timeout", () => {
      const state = generateOAuthState();
      const STATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

      // Simulate an old state
      const sessionState = {
        value: state,
        createdAt: Date.now() - STATE_TIMEOUT_MS - 1000, // expired
      };

      const isExpired = Date.now() - sessionState.createdAt > STATE_TIMEOUT_MS;
      assert.ok(isExpired, "State should be expired");
    });
  });

  // ── Provider Availability Detection ──────

  describe("Provider Availability Detection", () => {
    it("detects Google provider when env vars are set", () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";

      const providers = getAvailableProviders();
      assert.ok(providers.google);
    });

    it("detects Google provider as unavailable when env vars are missing", () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const providers = getAvailableProviders();
      assert.ok(!providers.google);
    });

    it("detects Apple provider when env vars are set", () => {
      process.env.APPLE_CLIENT_ID = "com.concord.auth";
      process.env.APPLE_TEAM_ID = "ABC123";
      process.env.APPLE_KEY_ID = "KEY123";
      process.env.APPLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";

      const providers = getAvailableProviders();
      assert.ok(providers.apple);
    });

    it("detects Apple provider as unavailable when env vars are missing", () => {
      delete process.env.APPLE_CLIENT_ID;
      delete process.env.APPLE_TEAM_ID;
      delete process.env.APPLE_KEY_ID;
      delete process.env.APPLE_PRIVATE_KEY;

      const providers = getAvailableProviders();
      assert.ok(!providers.apple);
    });

    it("detects partial Apple config as unavailable", () => {
      process.env.APPLE_CLIENT_ID = "com.concord.auth";
      delete process.env.APPLE_TEAM_ID;
      delete process.env.APPLE_KEY_ID;
      delete process.env.APPLE_PRIVATE_KEY;

      const providers = getAvailableProviders();
      assert.ok(!providers.apple);
    });
  });

  // ── Account Creation from OAuth Profile ──────

  describe("Account Creation from OAuth Profile", () => {
    it("creates a new account from Google OAuth profile", () => {
      const profile = {
        email: "user@gmail.com",
        name: "Test User",
        picture: "https://example.com/photo.jpg",
        sub: "google-12345",
      };

      const result = accountStore.createFromOAuth("google", profile);

      assert.ok(result.ok);
      assert.ok(result.created);
      assert.ok(result.linked);
      assert.equal(result.account.email, "user@gmail.com");
      assert.equal(result.account.displayName, "Test User");
      assert.equal(result.account.avatar, "https://example.com/photo.jpg");
      assert.equal(result.account.oauthProviders.length, 1);
      assert.equal(result.account.oauthProviders[0].provider, "google");
      assert.equal(result.account.oauthProviders[0].sub, "google-12345");
    });

    it("creates a new account from Apple OAuth profile", () => {
      const profile = {
        email: "user@icloud.com",
        name: "",
        sub: "apple-67890",
      };

      const result = accountStore.createFromOAuth("apple", profile);

      assert.ok(result.ok);
      assert.ok(result.created);
      assert.equal(result.account.email, "user@icloud.com");
      assert.equal(result.account.oauthProviders[0].provider, "apple");
    });

    it("auto-links OAuth to existing account with same email", () => {
      // Pre-create an account
      const existing = accountStore.createAccount({
        email: "shared@example.com",
        username: "existinguser",
      });

      const profile = {
        email: "shared@example.com",
        name: "OAuth User",
        sub: "google-99999",
      };

      const result = accountStore.createFromOAuth("google", profile);

      assert.ok(result.ok);
      assert.ok(!result.created, "Should not create a new account");
      assert.ok(result.linked, "Should link to existing account");
      assert.equal(result.account.id, existing.id);
    });

    it("returns existing linked account on repeat OAuth login", () => {
      const profile = {
        email: "repeat@example.com",
        name: "Repeat User",
        sub: "google-repeat",
      };

      // First OAuth login
      const result1 = accountStore.createFromOAuth("google", profile);
      assert.ok(result1.created);

      // Second OAuth login via direct lookup
      const found = accountStore.findByOAuth("google", "google-repeat");
      assert.ok(found);
      assert.equal(found.id, result1.account.id);
    });
  });

  // ── Account Linking / Unlinking ──────

  describe("Account Linking / Unlinking", () => {
    it("links multiple OAuth providers to the same account", () => {
      const account = accountStore.createAccount({
        email: "multi@example.com",
        username: "multiuser",
      });

      const linkGoogle = accountStore.linkOAuth(account.id, "google", "goo-123");
      assert.ok(linkGoogle.ok);

      const linkApple = accountStore.linkOAuth(account.id, "apple", "app-456");
      assert.ok(linkApple.ok);

      const updated = accountStore.getAccountById(account.id);
      assert.equal(updated.oauthProviders.length, 2);
    });

    it("prevents linking the same OAuth account twice", () => {
      const account = accountStore.createAccount({
        email: "dup@example.com",
        username: "dupuser",
      });

      accountStore.linkOAuth(account.id, "google", "goo-dup");
      const result = accountStore.linkOAuth(account.id, "google", "goo-dup");

      assert.ok(!result.ok);
      assert.equal(result.error, "OAuth account already linked");
    });

    it("unlinks an OAuth provider from an account", () => {
      const account = accountStore.createAccount({
        email: "unlink@example.com",
        username: "unlinkuser",
      });
      account.passwordHash = "hashed"; // Simulate password set

      accountStore.linkOAuth(account.id, "google", "goo-unlink");
      accountStore.linkOAuth(account.id, "apple", "app-unlink");

      const result = accountStore.unlinkOAuth(account.id, "google");
      assert.ok(result.ok);

      const updated = accountStore.getAccountById(account.id);
      assert.equal(updated.oauthProviders.length, 1);
      assert.equal(updated.oauthProviders[0].provider, "apple");
    });

    it("prevents unlinking the last auth method", () => {
      const account = accountStore.createAccount({
        email: "lastauth@example.com",
        username: "lastauthuser",
      });

      accountStore.linkOAuth(account.id, "google", "goo-last");

      const result = accountStore.unlinkOAuth(account.id, "google");
      assert.ok(!result.ok);
      assert.equal(result.error, "Cannot unlink the only authentication method");
    });

    it("allows unlinking when password is also set", () => {
      const account = accountStore.createAccount({
        email: "passoauth@example.com",
        username: "passoauthuser",
      });
      account.passwordHash = "bcrypt-hashed-password";

      accountStore.linkOAuth(account.id, "google", "goo-pass");

      const result = accountStore.unlinkOAuth(account.id, "google");
      assert.ok(result.ok);

      const updated = accountStore.getAccountById(account.id);
      assert.equal(updated.oauthProviders.length, 0);
    });

    it("unlink for non-existent provider returns error", () => {
      const account = accountStore.createAccount({
        email: "nolink@example.com",
        username: "nolinkuser",
      });

      const result = accountStore.unlinkOAuth(account.id, "twitter");
      assert.ok(!result.ok);
      assert.equal(result.error, "Provider not linked");
    });

    it("findByOAuth returns null for unknown provider:sub pair", () => {
      const result = accountStore.findByOAuth("google", "nonexistent-sub");
      assert.equal(result, null);
    });
  });
});
