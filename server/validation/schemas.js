// ---- Validation Schemas (Zod) ----
// Extracted from server.js — ESM module

let z = null;
try { z = (await import("zod")).z || (await import("zod")).default?.z; } catch { /* optional */ }

const schemas = {};
if (z) {
  schemas.dtuCreate = z.object({
    title: z.string().min(1).max(500),
    content: z.string().max(100000).optional(),
    tier: z.enum(["regular", "mega", "hyper"]).optional().default("regular"),
    tags: z.array(z.string().max(50)).max(40).optional().default([]),
    creti: z.string().max(50000).optional(),
    source: z.string().max(100).optional()
  });

  schemas.dtuUpdate = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500).optional(),
    content: z.string().max(100000).optional(),
    tier: z.enum(["regular", "mega", "hyper"]).optional(),
    tags: z.array(z.string().max(50)).max(40).optional(),
    creti: z.string().max(50000).optional()
  });

  schemas.userRegister = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    email: z.string().email(),
    password: z.string().min(12).max(100)
  });

  schemas.userLogin = z.object({
    username: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string()
  }).refine(d => d.username || d.email, { message: "Username or email required" });

  schemas.apiKeyCreate = z.object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.string()).optional().default(["read"])
  });

  schemas.pagination = z.object({
    limit: z.coerce.number().min(1).max(1000).optional().default(50),
    offset: z.coerce.number().min(0).optional().default(0),
    q: z.string().max(500).optional()
  });
}

// Validation middleware factory
function validate(schemaName) {
  return (req, res, next) => {
    if (!z || !schemas[schemaName]) return next();
    const result = schemas[schemaName].safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: result.error.errors
      });
    }
    req.validated = result.data;
    next();
  };
}

export { schemas, validate };
