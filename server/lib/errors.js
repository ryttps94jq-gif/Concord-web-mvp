/**
 * Centralized error class hierarchy for Concord backend.
 *
 * Usage:
 *   import { ValidationError, AuthError, NotFoundError } from './lib/errors.js';
 *
 *   throw new ValidationError('Email is required', { field: 'email' });
 *   throw new AuthError('Token expired');
 *   throw new NotFoundError('DTU', 'abc123');
 *
 * In error middleware:
 *   if (err instanceof ConcordError) {
 *     return res.status(err.statusCode).json(err.toJSON());
 *   }
 */

export class ConcordError extends Error {
  /**
   * @param {string} message
   * @param {string} code - Machine-readable error code
   * @param {number} statusCode - HTTP status code
   * @param {Record<string, unknown>} [context] - Additional context
   */
  constructor(message, code = 'CONCORD_ERROR', statusCode = 500, context) {
    super(message);
    this.name = 'ConcordError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }

  toJSON() {
    return {
      ok: false,
      error: this.message,
      code: this.code,
      ...(this.context ? { context: this.context } : {}),
    };
  }
}

/** 400 — Bad input */
export class ValidationError extends ConcordError {
  constructor(message, context) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

/** 401 — Not authenticated */
export class AuthError extends ConcordError {
  constructor(message = 'Authentication required', code = 'AUTH_REQUIRED') {
    super(message, code, 401);
    this.name = 'AuthError';
  }
}

/** 403 — Not authorized */
export class ForbiddenError extends ConcordError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, code, 403);
    this.name = 'ForbiddenError';
  }
}

/** 404 — Not found */
export class NotFoundError extends ConcordError {
  constructor(resource = 'Resource', id) {
    const msg = id ? `${resource} "${id}" not found` : `${resource} not found`;
    super(msg, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

/** 409 — Conflict (e.g. version mismatch) */
export class ConflictError extends ConcordError {
  constructor(message = 'Resource version conflict') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/** 429 — Rate limited */
export class RateLimitError extends ConcordError {
  constructor(retryAfterSecs) {
    const msg = retryAfterSecs
      ? `Rate limited. Retry after ${retryAfterSecs}s.`
      : 'Too many requests.';
    super(msg, 'RATE_LIMITED', 429, retryAfterSecs ? { retryAfter: retryAfterSecs } : undefined);
    this.name = 'RateLimitError';
  }
}

/** 500 — Internal error */
export class ServerError extends ConcordError {
  constructor(message = 'Internal server error', statusCode = 500) {
    super(message, 'SERVER_ERROR', statusCode);
    this.name = 'ServerError';
  }
}

/**
 * Express error handler middleware that knows about ConcordError subclasses.
 *
 * Usage: app.use(concordErrorHandler);
 */
export function concordErrorHandler(err, req, res, _next) {
  if (err instanceof ConcordError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Fallback for unknown errors
  const msg = String(err?.message || err || 'Unknown error');
  console.error('[concordErrorHandler]', msg, err?.stack || '');
  res.status(500).json({ ok: false, error: msg, code: 'INTERNAL_ERROR' });
}
