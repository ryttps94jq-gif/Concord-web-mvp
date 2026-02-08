/**
 * Product Lens Gate — The non-negotiable rule.
 *
 * A lens must have a primary artifact that survives without DTUs.
 * DTUs are exhaust — not the product.
 *
 * No new lens advances past 'viewer' status without passing this gate.
 * No lens appears in public UI with score < 5/7.
 *
 * This file defines:
 *   1. The 7 capability dimensions every product lens must satisfy
 *   2. The scoring function
 *   3. The gate check (pass/fail)
 *   4. Hard rules that should fail CI in production
 */

export interface LensCapability {
  /** Capability name */
  name: string;
  /** What it means concretely */
  description: string;
  /** How to verify it exists */
  verification: string;
  /** Weight (all equal at 1 for now) */
  weight: number;
}

/**
 * The 7 mandatory capabilities. A lens must score >= 5 to be public.
 */
export const LENS_CAPABILITIES: LensCapability[] = [
  {
    name: 'primary_artifact',
    description: 'Has at least one artifact type that persists without DTUs',
    verification: 'Lens manifest declares artifacts[] with at least one entry, AND lens store has create/get/update/delete macros',
    weight: 1,
  },
  {
    name: 'persistence',
    description: 'Artifacts are persisted to the lens artifact store (not just in-memory or SEED_ data)',
    verification: 'Lens page uses useLensData() or useArtifacts() hook with real API calls, NOT SEED_* or MOCK_* constants',
    weight: 1,
  },
  {
    name: 'editor_workspace',
    description: 'Has a dedicated editor or workspace UI for creating/modifying artifacts',
    verification: 'Lens page includes forms, editors, or interactive workspace — not just a read-only list or dashboard',
    weight: 1,
  },
  {
    name: 'engine',
    description: 'Has at least one computational engine that processes artifacts',
    verification: 'Lens manifest declares actions[] with at least one entry, AND a server-side macro handles the action',
    weight: 1,
  },
  {
    name: 'pipeline',
    description: 'Has at least one multi-step pipeline that chains engine operations',
    verification: 'Documented pipeline in productization-roadmap.ts with >= 3 steps, AND at least the first step is implemented',
    weight: 1,
  },
  {
    name: 'import_export',
    description: 'Can import data from and export to standard formats',
    verification: 'Lens manifest declares exports[] with at least one format, AND export macro is functional',
    weight: 1,
  },
  {
    name: 'dtu_exhaust',
    description: 'Automatically generates DTU exhaust for significant operations',
    verification: 'Server-side lens macros call _lensEmitDTU() on create/update/delete/run operations',
    weight: 1,
  },
];

export interface LensScore {
  /** Lens ID */
  lensId: string;
  /** Score per capability (0 or 1) */
  capabilities: Record<string, boolean>;
  /** Total score out of 7 */
  total: number;
  /** Max possible score */
  maxScore: number;
  /** Whether this lens passes the gate */
  passes: boolean;
  /** Whether this lens can be shown publicly */
  isPublicReady: boolean;
}

/** Minimum score to pass the Product Lens Gate */
export const GATE_PASS_THRESHOLD = 5;

/** Maximum score */
export const MAX_SCORE = LENS_CAPABILITIES.length;

/**
 * Score a lens against all 7 capabilities.
 * In practice this is called by the scoring script with actual filesystem checks.
 * This function takes pre-computed capability booleans.
 */
export function scoreLens(
  lensId: string,
  capabilities: Record<string, boolean>,
): LensScore {
  const total = Object.values(capabilities).filter(Boolean).length;
  return {
    lensId,
    capabilities,
    total,
    maxScore: MAX_SCORE,
    passes: total >= GATE_PASS_THRESHOLD,
    isPublicReady: total >= GATE_PASS_THRESHOLD,
  };
}

/**
 * Hard rules for CI. If any of these are true, the build should fail in production.
 */
export interface CIViolation {
  /** Rule ID */
  rule: string;
  /** Human-readable description */
  description: string;
  /** Lens ID that violated */
  lensId: string;
  /** Severity */
  severity: 'error' | 'warning';
}

export const CI_HARD_RULES = [
  {
    id: 'no_mock_imports',
    description: 'A lens page imports MOCK_* or SEED_* constants for display data',
    severity: 'error' as const,
    check: 'grep -r "MOCK_\\|SEED_" in lens page files',
  },
  {
    id: 'no_artifact_no_product',
    description: 'A lens with status=product has no persisted artifact',
    severity: 'error' as const,
    check: 'Cross-reference lens-status.ts product lenses against lens manifest artifacts',
  },
  {
    id: 'no_write_macro',
    description: 'A lens with status=product has no create macro in manifest',
    severity: 'error' as const,
    check: 'Cross-reference lens-status.ts product lenses against manifest macros.create',
  },
  {
    id: 'deprecated_in_sidebar',
    description: 'A deprecated lens still appears in sidebar navigation',
    severity: 'warning' as const,
    check: 'Cross-reference lens-status.ts deprecated lenses against lens-registry.ts showInSidebar',
  },
  {
    id: 'low_score_public',
    description: 'A lens with score < 5/7 is shown in public UI',
    severity: 'warning' as const,
    check: 'Run scoring script and compare against lens-registry.ts showInSidebar/showInCommandPalette',
  },
];
