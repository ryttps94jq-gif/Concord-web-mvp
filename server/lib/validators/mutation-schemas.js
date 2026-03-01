/**
 * Concord Cognitive Engine — Zod Validation Schemas for Mutation Routes
 *
 * Provides input validation for high-risk POST/PUT/PATCH endpoints
 * that previously accepted unvalidated request bodies.
 */
import { z } from "zod";

// === Financial Transactions (CRITICAL) ===

export const tipSchema = z.object({
  tipperId: z.string().min(1),
  creatorId: z.string().min(1),
  contentId: z.string().min(1),
  contentType: z.string().min(1),
  lensId: z.string().min(1),
  amount: z.number().positive().max(1000000),
});

export const bountyCreateSchema = z.object({
  posterId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  lensId: z.string().min(1),
  amount: z.number().positive().max(1000000),
  tags: z.array(z.string().max(100)).max(20).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const bountyClaimSchema = z.object({
  claimerId: z.string().min(1),
  posterId: z.string().min(1),
  solutionDtuId: z.string().min(1),
});

export const purchaseSchema = z.object({
  buyerId: z.string().min(1),
  dtuId: z.string().min(1),
  sellerId: z.string().min(1),
  amount: z.number().nonnegative().max(10000000),
  lensId: z.string().min(1),
});

// === Ingest Endpoints (HIGH) ===

export const ingestUrlSchema = z.object({
  url: z.string().url().max(2048),
});

export const ingestTextSchema = z.object({
  text: z.string().min(1).max(500000),
  title: z.string().max(500).optional(),
});

export const ingestSchema = z.object({
  text: z.string().max(500000).optional(),
  url: z.string().url().max(2048).optional(),
  title: z.string().max(500).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  makeGlobal: z.boolean().optional(),
  declaredSourceType: z.string().max(50).optional(),
}).refine(data => data.text || data.url, {
  message: "Either text or url must be provided",
});

export const ingestSubmitSchema = z.object({
  url: z.string().url().max(2048),
  userId: z.string().min(1).optional(),
  tier: z.enum(["local", "regional", "national", "global"]).optional(),
});

// === Research & Harness (HIGH) ===

export const researchRunSchema = z.object({
  engine: z.string().min(1).max(100),
  input: z.string().min(1).max(100000),
});

export const harnessRunSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  harness: z.string().max(200).optional(),
  input: z.unknown().optional(),
  options: z.record(z.unknown()).optional(),
});

// === Entity Registration (HIGH) ===

export const lensRegisterSchema = z.object({
  name: z.string().min(1).max(200),
  classification: z.string().min(1).max(100),
  version: z.string().max(50).optional(),
  protection_mode: z.string().max(50).optional(),
  creator_id: z.string().min(1).optional(),
  creator_type: z.string().max(50).optional(),
  federation_tiers: z.array(z.string()).optional(),
  artifact_types: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

// === Sovereign (CRITICAL) ===

export const decreeSchema = z.object({
  action: z.string().min(1).max(200),
  target: z.string().max(500).optional(),
  data: z.record(z.unknown()).optional(),
});

// === LLM (HIGH) ===

export const llmGenerateSchema = z.object({
  prompt: z.string().min(1).max(100000),
  mode: z.string().max(50).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32000).optional(),
});

// === API Keys (HIGH) ===

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.string().max(100)).optional(),
  expiresAt: z.string().datetime().optional(),
});

// === Storage (HIGH) ===

export const vaultStoreSchema = z.object({
  fileBase64: z.string().min(1),
  mimeType: z.string().min(1).max(200),
});

// === DMCA (HIGH) ===

export const dmcaSubmitSchema = z.object({
  complainantName: z.string().min(1).max(500),
  complainantEmail: z.string().email().max(320),
  contentUrl: z.string().max(2048).optional(),
  dtuId: z.string().optional(),
  description: z.string().min(10).max(10000),
  declaration: z.boolean(),
});

/**
 * Validation middleware factory.
 * Usage: app.post("/route", validateBody(schema), handler)
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues.map(i => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.validated = result.data;
    next();
  };
}
