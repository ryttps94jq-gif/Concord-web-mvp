/**
 * Per-User Rate Limiting for Concord Cognitive Engine
 *
 * Endpoint-specific rate limits that prevent abuse without impacting normal usage.
 * Uses in-memory maps with automatic cleanup of stale entries.
 */

const rateLimits = new Map(); // key → { count, windowStart }

const LIMITS = {
  'conscious.chat': { max: 30, windowMs: 60000 },       // 30/min — GPU: conversational speed
  'utility.call': { max: 60, windowMs: 60000 },          // 60/min — GPU: entities need real-time interaction
  'marketplace.submit': { max: 5, windowMs: 3600000 },   // 5/hour — governance, not hardware
  'global.pull': { max: 20, windowMs: 3600000 },         // 20/hour — stays same
  'semantic.search': { max: 100, windowMs: 60000 },      // 100/min — GPU: embedding search is near-instant
  'default': { max: 120, windowMs: 60000 },              // 120/min — GPU: room for background + user
};

/**
 * Check if a user has exceeded the rate limit for an endpoint.
 * @param {string} userId - User ID or IP address
 * @param {string} endpoint - Endpoint category name
 * @returns {{ allowed: boolean, remaining: number, retryAfter?: number }}
 */
function checkRateLimit(userId, endpoint) {
  const limit = LIMITS[endpoint] || LIMITS.default;
  const key = `${userId}:${endpoint}`;

  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, windowStart: Date.now() });
    return { allowed: true, remaining: limit.max - 1 };
  }

  const entry = rateLimits.get(key);

  // Window expired — reset
  if (Date.now() - entry.windowStart > limit.windowMs) {
    rateLimits.set(key, { count: 1, windowStart: Date.now() });
    return { allowed: true, remaining: limit.max - 1 };
  }

  // Within window
  entry.count++;
  const remaining = limit.max - entry.count;

  if (remaining < 0) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.windowStart + limit.windowMs - Date.now()) / 1000),
    };
  }

  return { allowed: true, remaining };
}

/**
 * Express middleware factory for rate limiting.
 * @param {string} endpoint - Endpoint category name
 * @returns {import('express').RequestHandler}
 */
function rateLimitMiddleware(endpoint) {
  return (req, res, next) => {
    const userId = req.user?.id || req.user?.userId || req.ip;
    const result = checkRateLimit(userId, endpoint);

    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: result.retryAfter,
        endpoint,
      });
    }

    next();
  };
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStart > 3600000) rateLimits.delete(key);
  }
}, 300000);

export { checkRateLimit, rateLimitMiddleware, LIMITS };
