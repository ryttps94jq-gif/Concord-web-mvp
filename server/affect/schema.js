/**
 * Concord ATS — Zod Schemas
 * Validation schemas for affective state, events, and policy.
 */

// Zod is optional in the server; graceful fallback
let z = null;
try { z = (await import("zod")).z || (await import("zod")).default?.z; } catch { /* optional */ }

/** Clamp a number to [min, max] */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

// --- Schemas (when zod is available) ---

export const AffectEventSchema = z ? z.object({
  id: z.string().optional(),
  ts: z.number().optional(),
  type: z.enum([
    "USER_MESSAGE", "SYSTEM_RESULT", "ERROR", "SUCCESS",
    "TIMEOUT", "CONFLICT", "SAFETY_BLOCK", "GOAL_PROGRESS",
    "TOOL_RESULT", "FEEDBACK", "SESSION_START", "SESSION_END",
    "CUSTOM"
  ]),
  intensity: z.number().min(0).max(1).default(0.5),
  polarity: z.number().min(-1).max(1).optional().default(0),
  payload: z.record(z.unknown()).optional().default({}),
  source: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    agentId: z.string().optional(),
    lens: z.string().optional(),
    route: z.string().optional(),
  }).optional().default({}),
}) : null;

export const AffectStateSchema = z ? z.object({
  v: z.number().min(0).max(1),
  a: z.number().min(0).max(1),
  s: z.number().min(0).max(1),
  c: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  t: z.number().min(0).max(1),
  f: z.number().min(0).max(1),
  ts: z.number(),
  meta: z.object({
    mode: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
}) : null;

export const AffectResetSchema = z ? z.object({
  sessionId: z.string(),
  mode: z.enum(["baseline", "cooldown"]).optional().default("baseline"),
}) : null;

// --- Validation helpers (work with or without zod) ---

const VALID_EVENT_TYPES = new Set([
  "USER_MESSAGE", "SYSTEM_RESULT", "ERROR", "SUCCESS",
  "TIMEOUT", "CONFLICT", "SAFETY_BLOCK", "GOAL_PROGRESS",
  "TOOL_RESULT", "FEEDBACK", "SESSION_START", "SESSION_END",
  "CUSTOM"
]);

/**
 * Validate and normalize an affect event.
 * Works with or without zod.
 */
export function validateEvent(raw) {
  if (AffectEventSchema) {
    const parsed = AffectEventSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    return { ok: true, event: parsed.data };
  }

  // Manual validation fallback
  if (!raw || typeof raw !== "object") return { ok: false, error: "Event must be an object" };
  if (!VALID_EVENT_TYPES.has(raw.type)) return { ok: false, error: `Invalid event type: ${raw.type}` };

  return {
    ok: true,
    event: {
      id: raw.id || undefined,
      ts: raw.ts || undefined,
      type: raw.type,
      intensity: clamp(raw.intensity ?? 0.5, 0, 1),
      polarity: clamp(raw.polarity ?? 0, -1, 1),
      payload: (raw.payload && typeof raw.payload === "object") ? raw.payload : {},
      source: (raw.source && typeof raw.source === "object") ? raw.source : {},
    }
  };
}

/**
 * Validate a session ID.
 */
export function validateSessionId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 256;
}

export { clamp };
