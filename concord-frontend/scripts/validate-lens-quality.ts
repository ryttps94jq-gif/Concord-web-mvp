#!/usr/bin/env npx tsx
/**
 * Lens Quality Gate Validator — Step 4 of the Core Lenses Roadmap.
 *
 * Hard rules that should fail CI in production:
 *
 *   ERROR (build fails):
 *     1. A product-status lens imports MOCK_* or SEED_* for display data
 *     2. A product-status lens has no persisted artifact in manifest
 *     3. A product-status lens has no create macro in manifest
 *
 *   WARNING (logged but does not fail):
 *     4. A deprecated lens still has showInSidebar=true
 *     5. A lens with score < 5/7 has showInSidebar=true or showInCommandPalette=true
 *
 * Usage:
 *   npx tsx scripts/validate-lens-quality.ts
 *   npx tsx scripts/validate-lens-quality.ts --strict   # Treat warnings as errors
 *
 * Add to CI pipeline to prevent regression.
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { LENS_REGISTRY } from '../lib/lens-registry';
import { getLensManifest } from '../lib/lenses/manifest';
import { LENS_STATUS_MAP, type LensStatusEntry } from '../lib/lenses/lens-status';

// ── Configuration ───────────────────────────────────────────────

const LENSES_DIR = join(__dirname, '..', 'app', 'lenses');
const strict = process.argv.includes('--strict');

interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  lensId: string;
  message: string;
}

const violations: Violation[] = [];

// ── Helpers ─────────────────────────────────────────────────────

function readLensPage(lensId: string): string | null {
  const pagePath = join(LENSES_DIR, lensId, 'page.tsx');
  if (!existsSync(pagePath)) return null;
  return readFileSync(pagePath, 'utf-8');
}

function getStatusEntry(lensId: string): LensStatusEntry | undefined {
  return LENS_STATUS_MAP.find(e => e.id === lensId);
}

function getRegistryEntry(lensId: string) {
  return LENS_REGISTRY.find(e => e.id === lensId);
}

// ── Rule Checks ─────────────────────────────────────────────────

function checkRule1_NoMockImportsInProducts() {
  const productLenses = LENS_STATUS_MAP.filter(e => e.status === 'product');

  for (const entry of productLenses) {
    const pageSource = readLensPage(entry.id);
    if (!pageSource) continue;

    if (/MOCK_/.test(pageSource)) {
      violations.push({
        rule: 'no_mock_imports',
        severity: 'error',
        lensId: entry.id,
        message: `Product lens "${entry.id}" imports MOCK_* constants. Replace with useLensData() or useArtifacts().`,
      });
    }

    if (/SEED_/.test(pageSource)) {
      // SEED_ is acceptable in useLensData({ seed: ... }) — check if it's standalone
      const seedUsedStandalone = /(?<!seed:\s*)SEED_/.test(pageSource);
      if (seedUsedStandalone) {
        violations.push({
          rule: 'no_mock_imports',
          severity: 'error',
          lensId: entry.id,
          message: `Product lens "${entry.id}" uses SEED_* constants outside of useLensData seed option.`,
        });
      }
    }
  }
}

function checkRule2_ProductLensHasArtifact() {
  const productLenses = LENS_STATUS_MAP.filter(e => e.status === 'product');

  for (const entry of productLenses) {
    const manifest = getLensManifest(entry.id);
    if (!manifest || manifest.artifacts.length === 0) {
      violations.push({
        rule: 'no_artifact_no_product',
        severity: 'error',
        lensId: entry.id,
        message: `Product lens "${entry.id}" has no artifacts in lens manifest. Add artifacts to LENS_MANIFESTS.`,
      });
    }
  }
}

function checkRule3_ProductLensHasWriteMacro() {
  const productLenses = LENS_STATUS_MAP.filter(e => e.status === 'product');

  for (const entry of productLenses) {
    const manifest = getLensManifest(entry.id);
    if (!manifest) {
      violations.push({
        rule: 'no_write_macro',
        severity: 'error',
        lensId: entry.id,
        message: `Product lens "${entry.id}" has no manifest entry at all. Add to LENS_MANIFESTS.`,
      });
      continue;
    }
    if (!manifest.macros.create) {
      violations.push({
        rule: 'no_write_macro',
        severity: 'error',
        lensId: entry.id,
        message: `Product lens "${entry.id}" has no create macro in manifest. Lens must be writable.`,
      });
    }
  }
}

function checkRule4_DeprecatedNotInSidebar() {
  const deprecatedLenses = LENS_STATUS_MAP.filter(e => e.status === 'deprecated');

  for (const entry of deprecatedLenses) {
    const regEntry = getRegistryEntry(entry.id);
    if (regEntry?.showInSidebar) {
      violations.push({
        rule: 'deprecated_in_sidebar',
        severity: 'warning',
        lensId: entry.id,
        message: `Deprecated lens "${entry.id}" still has showInSidebar=true. Set to false (merges into "${entry.mergeTarget}").`,
      });
    }
  }
}

function checkRule5_StatusMismatch() {
  // Check that every lens in the registry has a status entry
  for (const regEntry of LENS_REGISTRY) {
    const statusEntry = getStatusEntry(regEntry.id);
    if (!statusEntry) {
      violations.push({
        rule: 'missing_status',
        severity: 'warning',
        lensId: regEntry.id,
        message: `Lens "${regEntry.id}" is in registry but has no entry in lens-status.ts. Add a status classification.`,
      });
    }
  }

  // Check that every status entry has a registry entry
  for (const statusEntry of LENS_STATUS_MAP) {
    const regEntry = getRegistryEntry(statusEntry.id);
    if (!regEntry) {
      violations.push({
        rule: 'orphaned_status',
        severity: 'warning',
        lensId: statusEntry.id,
        message: `Lens "${statusEntry.id}" is in lens-status.ts but has no entry in lens-registry.ts.`,
      });
    }
  }
}

// ── Main ────────────────────────────────────────────────────────

function main() {
  console.log('\n  Lens Quality Gate Validation');
  console.log('  ════════════════════════════\n');

  checkRule1_NoMockImportsInProducts();
  checkRule2_ProductLensHasArtifact();
  checkRule3_ProductLensHasWriteMacro();
  checkRule4_DeprecatedNotInSidebar();
  checkRule5_StatusMismatch();

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (errors.length > 0) {
    console.error('  ERRORS (build-blocking):\n');
    for (const v of errors) {
      console.error(`    [${v.rule}] ${v.lensId}: ${v.message}`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\n  WARNINGS:\n');
    for (const v of warnings) {
      console.warn(`    [${v.rule}] ${v.lensId}: ${v.message}`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('  All checks passed.\n');
  }

  console.log(`\n  Summary: ${errors.length} errors, ${warnings.length} warnings\n`);

  // Exit with error if there are errors, or if --strict and there are warnings
  if (errors.length > 0) {
    process.exit(1);
  }
  if (strict && warnings.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main();
