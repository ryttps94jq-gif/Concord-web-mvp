/**
 * Artifact Schema Registry — defines expected structure for lens action output.
 *
 * Schemas used by quality-gate.js for structural validation.
 * Each schema defines required fields, types, ranges, and vocabulary references.
 */

const ARTIFACT_SCHEMAS = new Map();

export function registerSchema(domain, action, schema) {
  ARTIFACT_SCHEMAS.set(`${domain}.${action}`, schema);
}

export function getArtifactSchema(domain, action) {
  return ARTIFACT_SCHEMAS.get(`${domain}.${action}`)
    || ARTIFACT_SCHEMAS.get(`${domain}.*`)
    || null;
}

export function getSchemaCount() {
  return ARTIFACT_SCHEMAS.size;
}

// Load all domain schemas
import "./artifact-schemas/food-schemas.js";
import "./artifact-schemas/fitness-schemas.js";
import "./artifact-schemas/finance-schemas.js";
import "./artifact-schemas/healthcare-schemas.js";
import "./artifact-schemas/legal-schemas.js";
import "./artifact-schemas/music-schemas.js";
import "./artifact-schemas/realestate-schemas.js";
import "./artifact-schemas/education-schemas.js";
import "./artifact-schemas/trades-schemas.js";
import "./artifact-schemas/insurance-schemas.js";
