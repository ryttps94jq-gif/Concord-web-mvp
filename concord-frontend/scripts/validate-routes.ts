#!/usr/bin/env npx tsx
/**
 * FE-016: Build-time route validation.
 *
 * Compares filesystem lens routes against the canonical lens registry.
 * Detects:
 *   - Routes on disk that have no registry entry (orphaned pages)
 *   - Registry entries with no corresponding route directory (dead references)
 *
 * Usage:
 *   npx tsx scripts/validate-routes.ts
 *
 * Add to CI or `npm run lint` to prevent drift.
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Import the registry (relative to the project root)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getAllLensIds } = require('../lib/lens-registry');

const LENSES_DIR = join(__dirname, '..', 'app', 'lenses');

function getFileSystemLenses(): string[] {
  return readdirSync(LENSES_DIR).filter((entry) => {
    const full = join(LENSES_DIR, entry);
    // Only directories (skip error.tsx, loading.tsx, layout.tsx)
    return statSync(full).isDirectory();
  });
}

function validate() {
  const fsLenses = new Set(getFileSystemLenses());
  const registryLenses = new Set<string>(getAllLensIds());

  const orphaned: string[] = []; // On disk but not in registry
  const dead: string[] = [];     // In registry but not on disk

  for (const dir of fsLenses) {
    if (!registryLenses.has(dir)) {
      orphaned.push(dir);
    }
  }

  for (const id of registryLenses) {
    if (!fsLenses.has(id)) {
      dead.push(id);
    }
  }

  let exitCode = 0;

  if (orphaned.length > 0) {
    console.error('\n  ORPHANED ROUTES (on disk but missing from lens-registry.ts):');
    orphaned.forEach((r) => console.error(`    - app/lenses/${r}/`));
    exitCode = 1;
  }

  if (dead.length > 0) {
    console.error('\n  DEAD REGISTRY ENTRIES (in lens-registry.ts but no route directory):');
    dead.forEach((r) => console.error(`    - ${r}`));
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log(`  Route validation passed: ${fsLenses.size} routes, ${registryLenses.size} registry entries. All in sync.`);
  }

  process.exit(exitCode);
}

validate();
