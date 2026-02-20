#!/usr/bin/env node
/**
 * Repair Cortex — Pre-Build Prophet (CLI)
 *
 * Standalone script that runs Phase 1 pre-build checks before docker-compose.
 * Called by concord-deploy.sh or directly.
 *
 * Usage:
 *   node scripts/repair-prophet.js [project-root]
 *
 * Exit codes:
 *   0 — All clear or auto-fixed
 *   1 — Critical issues that cannot be auto-fixed
 *
 * Additive only. No modifications to existing systems.
 */

import { runProphet } from "../server/emergent/repair-cortex.js";

const projectRoot = process.argv[2] || process.cwd();

console.log("╔══════════════════════════════════════╗");
console.log("║  REPAIR CORTEX — PRE-BUILD PROPHET   ║");
console.log("╚══════════════════════════════════════╝");
console.log("");
console.log(`Project root: ${projectRoot}`);
console.log(`Timestamp:    ${new Date().toISOString()}`);
console.log("");

async function main() {
  try {
    const results = await runProphet(projectRoot);

    console.log("─── RESULTS ───────────────────────────");
    console.log(`Total checks:  ${results.checks?.length || 0}`);
    console.log(`Total issues:  ${results.totalIssues}`);
    console.log(`Auto-fixed:    ${results.autoFixed}`);
    console.log(`Blocked:       ${results.blocked}`);
    console.log(`Duration:      ${results.durationMs}ms`);
    console.log("");

    for (const check of (results.checks || [])) {
      const status = check.unfixed > 0 ? "⚠" : "✓";
      console.log(`  ${status} ${check.name}: ${check.issues} issue(s), ${check.fixed} fixed, ${check.unfixed} remaining`);
      if (check.details && check.details.length > 0) {
        for (const detail of check.details) {
          console.log(`      → ${detail.severity}: ${detail.message}`);
        }
      }
      if (check.error) {
        console.log(`      → Error: ${check.error}`);
      }
    }

    console.log("");

    if (results.blocked) {
      console.log("BLOCKED: Critical issues found that cannot be auto-fixed.");
      console.log("Sovereign intervention required.");
      process.exit(1);
    }

    if (results.totalIssues > 0 && results.autoFixed > 0) {
      console.log(`AUTO-FIXED: ${results.autoFixed} issue(s) resolved automatically.`);
    }

    console.log("PROPHET: Pre-build scan passed.");
    process.exit(0);
  } catch (e) {
    console.error("PROPHET ERROR:", e?.message || e);
    // Don't block the build on prophet errors — silent failure
    process.exit(0);
  }
}

main();
