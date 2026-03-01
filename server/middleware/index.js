/**
 * @fileoverview Centralized middleware configuration for the Concord server.
 * Extracted from server.js to improve modularity while preserving the monolith architecture.
 *
 * Configures: CSP nonce, Helmet, compression, body parsing, idempotency,
 * CORS, request ID, request logging, sanitization, rate limiting, metrics,
 * cookie parsing, auth, write-auth, and CSRF.
 */

import crypto from "crypto";

/**
 * Configure all middleware on the Express app.
 *
 * @param {import('express').Application} app - Express application instance
 * @param {object} deps - Dependencies injected from server.js
 * @param {typeof import('express')} deps.express - Express module
 * @param {Function|null} deps.helmet - Helmet middleware (optional)
 * @param {Function} deps.cors - CORS middleware
 * @param {Function|null} deps.compression - Compression middleware (optional)
 * @param {Function|null} deps.rateLimiter - Rate limiter instance (optional)
 * @param {Function} deps.idempotencyMiddleware - Idempotency middleware
 * @param {Function} deps.requestIdMiddleware - Request ID middleware
 * @param {Function} deps.requestLoggerMiddleware - Structured logging middleware
 * @param {Function} deps.sanitizationMiddleware - Input sanitization middleware
 * @param {Function|null} deps.requestTimeoutMiddleware - Request timeout middleware (optional)
 * @param {Function} deps.metricsMiddleware - Prometheus metrics middleware
 * @param {Function} deps.cookieParserMiddleware - Cookie parsing middleware
 * @param {Function} deps.authMiddleware - Authentication middleware
 * @param {Function} deps.productionWriteAuthMiddleware - Production write-auth middleware
 * @param {Function} deps.csrfMiddleware - CSRF protection middleware
 * @param {string} deps.NODE_ENV - Current environment
 */
export default function configureMiddleware(app, deps) {
  const {
    express,
    helmet,
    cors,
    compression,
    rateLimiter,
    idempotencyMiddleware,
    requestIdMiddleware,
    requestLoggerMiddleware,
    sanitizationMiddleware,
    requestTimeoutMiddleware,
    metricsMiddleware,
    cookieParserMiddleware,
    authMiddleware,
    productionWriteAuthMiddleware,
    csrfMiddleware,
    NODE_ENV,
  } = deps;

  // ---- CSP Nonce Generation ----
  // Generate a per-request nonce for Content-Security-Policy script integrity
  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  // ---- Helmet: Security Headers ----
  if (helmet) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: NODE_ENV === "production"
            ? ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`, "'unsafe-inline'"]
            : ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`, "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Required for styled-components/emotion
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:", ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) : [])],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: NODE_ENV === "production",
      hsts: NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      permissionsPolicy: {
        features: {
          camera: ["'none'"],
          microphone: ["'self'"],
          geolocation: ["'none'"],
          payment: ["'none'"],
        },
      },
    }));
  }

  // ---- Expose CSP Nonce to Frontend ----
  app.use((req, res, next) => {
    if (res.locals.cspNonce) {
      res.setHeader('X-CSP-Nonce', res.locals.cspNonce);
    }
    next();
  });

  // ---- Compression ----
  if (compression) app.use(compression());

  // ---- Body Parsing (per-endpoint size limits) ----
  // Strict limits for chatty endpoints; generous for bulk operations
  const BODY_LIMITS = {
    '/api/chat': '256kb',
    '/api/ask': '256kb',
    '/api/chat/stream': '256kb',
    '/api/chat/feedback': '16kb',
    '/api/auth/register': '16kb',
    '/api/auth/login': '16kb',
    '/api/auth/change-password': '4kb',
    '/api/shared-session': '64kb',
  };

  app.use((req, res, next) => {
    // Find most specific matching route prefix
    const matchedLimit = Object.entries(BODY_LIMITS).find(([prefix]) => req.url.startsWith(prefix));
    const limit = matchedLimit ? matchedLimit[1] : '10mb';
    express.json({ limit, verify: (innerReq, _res, buf) => {
      if (innerReq.url === '/api/economy/webhook') innerReq.rawBody = buf;
    } })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ---- Idempotency ----
  // Category 2: Double-submit prevention via Idempotency-Key header
  app.use(idempotencyMiddleware);

  // ---- CORS ----
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : [];
  const corsOptions = {
    origin: (origin, callback) => {
      // Requests with no Origin header come from same-origin requests, server-to-server
      // calls, health checks (curl/Docker), and non-browser clients. Browsers always
      // send an Origin header on cross-origin requests, so no-origin is safe to allow.
      if (!origin) {
        return callback(null, true);
      }
      // In development, allow localhost
      if (NODE_ENV !== "production" && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
        return callback(null, true);
      }
      // Explicit allowlist takes priority
      if (allowedOrigins.length > 0) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.warn("[CORS] Rejected origin:", origin);
        const err = new Error("Origin blocked");
        err.code = "ORIGIN_BLOCKED";
        err.reason = `Origin not allowed: ${origin}`;
        return callback(err, false);
      }
      // ALLOWED_ORIGINS not configured
      if (NODE_ENV === "production") {
        // Production fallback: allow same-host origins (different ports/protocols).
        // This handles the common case where ALLOWED_ORIGINS isn't set but the frontend
        // is on the same host. Log a warning so the operator knows to set the env var.
        try {
          const originUrl = new URL(origin);
          const serverHost = process.env.SERVER_HOST || process.env.HOSTNAME || "";
          if (serverHost && originUrl.hostname === serverHost) {
            console.warn("[CORS] WARNING: Allowing same-host origin without ALLOWED_ORIGINS:", origin, "— Set ALLOWED_ORIGINS for production.");
            return callback(null, true);
          }
        } catch { /* invalid origin URL, fall through to reject */ }
        console.error("[CORS] REJECTED: No ALLOWED_ORIGINS configured in production. Origin:", origin, "— Set ALLOWED_ORIGINS=https://your-frontend-domain");
        const err = new Error("CORS not configured");
        err.code = "CORS_NOT_CONFIGURED";
        return callback(err, false);
      }
      // In development, allow all origins with a warning
      console.warn("[CORS] WARNING: No ALLOWED_ORIGINS set. Allowing origin:", origin, "— Set ALLOWED_ORIGINS env var to restrict.");
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Requested-With", "X-Session-ID", "X-CSRF-Token", "X-XSRF-Token", "X-Request-ID", "Idempotency-Key"],
    exposedHeaders: ["X-Request-ID"],
  };
  app.use(cors(corsOptions));

  // ---- Request Tracking & Logging ----
  app.use(requestIdMiddleware);       // Add request ID to all requests
  app.use(requestLoggerMiddleware);   // Structured JSON logging
  app.use(sanitizationMiddleware);    // Sanitize input

  // ---- Request Timeouts ----
  if (requestTimeoutMiddleware) app.use(requestTimeoutMiddleware);

  // ---- Rate Limiting ----
  if (rateLimiter) app.use(rateLimiter);

  // ---- Metrics ----
  app.use(metricsMiddleware);

  // ---- Auth Pipeline ----
  app.use(cookieParserMiddleware);          // Parse cookies before auth
  app.use(authMiddleware);                  // Authentication
  app.use(productionWriteAuthMiddleware);   // Enforce auth on all writes in production
  app.use(csrfMiddleware);                  // CSRF protection after auth
}
