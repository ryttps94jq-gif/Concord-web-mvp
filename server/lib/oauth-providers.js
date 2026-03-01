/**
 * Concord Cognitive Engine — OAuth Provider Configuration & Utilities
 *
 * Handles Google and Apple OAuth authorization code flows.
 * Uses Node.js built-in fetch (Node 18+) for token exchange — no external OAuth libraries.
 *
 * Environment variables:
 *   Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 *   Apple:  APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
 */

import crypto from "crypto";

// ── Provider Configuration ──────────────────────────────────────────────────

const GOOGLE_CONFIG = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
  scopes: ["openid", "email", "profile"],
};

const APPLE_CONFIG = {
  authUrl: "https://appleid.apple.com/auth/authorize",
  tokenUrl: "https://appleid.apple.com/auth/token",
  scopes: ["name", "email"],
};

// ── Utility: check if a provider is configured ──────────────────────────────

/**
 * Returns which OAuth providers have valid configuration.
 * @returns {{ google: boolean, apple: boolean }}
 */
export function getAvailableProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
  };
}

// ── State Parameter (CSRF protection) ───────────────────────────────────────

/**
 * Generate a cryptographically random state parameter for OAuth flows.
 * @returns {string} Hex-encoded random state
 */
export function generateOAuthState() {
  return crypto.randomBytes(32).toString("hex");
}

// ── Google OAuth ────────────────────────────────────────────────────────────

/**
 * Build the Google OAuth consent screen URL.
 * @param {string} state - CSRF state parameter
 * @returns {string} Full authorization URL
 */
export function getGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${process.env.PUBLIC_URL || "http://localhost:5050"}/api/auth/google/callback`,
    response_type: "code",
    scope: GOOGLE_CONFIG.scopes.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Exchange a Google authorization code for user info.
 * @param {string} code - Authorization code from Google callback
 * @returns {Promise<{ email: string, name: string, picture: string, sub: string }>}
 */
export async function exchangeGoogleCode(code) {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.PUBLIC_URL || "http://localhost:5050"}/api/auth/google/callback`;

  // Step 1: Exchange code for tokens
  const tokenResponse = await fetch(GOOGLE_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text();
    throw new Error(`Google token exchange failed (${tokenResponse.status}): ${errBody}`);
  }

  const tokens = await tokenResponse.json();

  // Step 2: Decode the id_token to get user info (avoids extra API call)
  if (tokens.id_token) {
    const payload = decodeJwtPayload(tokens.id_token);
    if (payload && payload.email) {
      return {
        email: payload.email,
        name: payload.name || "",
        picture: payload.picture || "",
        sub: payload.sub,
      };
    }
  }

  // Fallback: fetch user info from the userinfo endpoint
  const userInfoResponse = await fetch(GOOGLE_CONFIG.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error(`Google userinfo fetch failed (${userInfoResponse.status})`);
  }

  const userInfo = await userInfoResponse.json();
  return {
    email: userInfo.email,
    name: userInfo.name || "",
    picture: userInfo.picture || "",
    sub: userInfo.sub,
  };
}

// ── Apple Sign In ───────────────────────────────────────────────────────────

/**
 * Build the Apple Sign In authorization URL.
 * @param {string} state - CSRF state parameter
 * @returns {string} Full authorization URL
 */
export function getAppleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: process.env.APPLE_REDIRECT_URI || `${process.env.PUBLIC_URL || "http://localhost:5050"}/api/auth/apple/callback`,
    response_type: "code",
    scope: APPLE_CONFIG.scopes.join(" "),
    state,
    response_mode: "form_post", // Apple requires form_post for scopes
  });
  return `${APPLE_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Generate the Apple client_secret JWT.
 *
 * Apple requires a JWT signed with the app's private key as the client_secret
 * for token exchange. The JWT has a max lifetime of 6 months.
 *
 * @returns {string} JWT client secret
 */
function generateAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 15777000; // ~6 months

  const header = {
    alg: "ES256",
    kid: process.env.APPLE_KEY_ID,
  };

  const payload = {
    iss: process.env.APPLE_TEAM_ID,
    iat: now,
    exp: expiry,
    aud: "https://appleid.apple.com",
    sub: process.env.APPLE_CLIENT_ID,
  };

  // Construct the JWT manually using the ES256 algorithm
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Parse the PEM private key and sign
  const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  const derSignature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  const encodedSignature = base64UrlEncode(derSignature);

  return `${signingInput}.${encodedSignature}`;
}

/**
 * Exchange an Apple authorization code for user info.
 * @param {string} code - Authorization code from Apple callback
 * @returns {Promise<{ email: string, name: string, sub: string }>}
 */
export async function exchangeAppleCode(code) {
  const clientSecret = generateAppleClientSecret();
  const redirectUri = process.env.APPLE_REDIRECT_URI || `${process.env.PUBLIC_URL || "http://localhost:5050"}/api/auth/apple/callback`;

  const tokenResponse = await fetch(APPLE_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.APPLE_CLIENT_ID,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text();
    throw new Error(`Apple token exchange failed (${tokenResponse.status}): ${errBody}`);
  }

  const tokens = await tokenResponse.json();

  // Apple returns user info in the id_token JWT
  if (!tokens.id_token) {
    throw new Error("Apple token response missing id_token");
  }

  const payload = decodeJwtPayload(tokens.id_token);
  if (!payload || !payload.sub) {
    throw new Error("Apple id_token payload missing sub claim");
  }

  return {
    email: payload.email || "",
    name: "", // Apple only sends name on FIRST authorization — handled in the route via form data
    sub: payload.sub,
  };
}

// ── JWT Decoding Utilities ──────────────────────────────────────────────────

/**
 * Decode a JWT payload without verification.
 * Used for extracting user info from id_tokens already validated by the provider.
 * @param {string} token - JWT string
 * @returns {object|null} Decoded payload or null
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Base64url encode a string or Buffer (RFC 7515).
 * @param {string|Buffer} input
 * @returns {string}
 */
function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");
  return buf.toString("base64url");
}
