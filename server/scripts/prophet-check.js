/**
 * Prophet Pre-Build Check — Repair Cortex Phase 1
 *
 * Runs preventive analysis before a build to catch known failure patterns.
 * Exit code 0 = clear to build, exit code 1 = blockers found.
 *
 * Usage: node server/scripts/prophet-check.js [projectRoot]
 */

import { runProphet } from "../emergent/repair-cortex.js";

const projectRoot = process.argv[2] || process.cwd();

try {
  const report = await runProphet(projectRoot);

  if (report?.blockers?.length) {
    console.error("[Prophet] Build blockers found:");
    for (const b of report.blockers) {
      console.error(`  - ${b.pattern || b.message || b}`);
    }
    process.exit(1);
  }

  const warningCount = report?.warnings?.length || 0;
  console.log(`[Prophet] Pre-flight clear. ${warningCount} warning${warningCount !== 1 ? "s" : ""}.`);
  if (warningCount > 0) {
    for (const w of report.warnings) {
      console.warn(`  ⚠ ${w.pattern || w.message || w}`);
    }
  }
  process.exit(0);
} catch (e) {
  console.warn("[Prophet] Check failed (non-blocking):", e.message);
  // Prophet failure should not block builds — exit clean
  process.exit(0);
}
