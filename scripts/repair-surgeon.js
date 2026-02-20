#!/usr/bin/env node
/**
 * Repair Cortex — Mid-Build Surgeon (CLI)
 *
 * Standalone script that analyzes build errors and attempts auto-fix.
 * Called by concord-deploy.sh between build retries.
 *
 * Usage:
 *   node scripts/repair-surgeon.js [project-root] [build-output-file]
 *
 * Exit codes:
 *   0 — Fix applied (retry the build)
 *   1 — Could not fix (escalate to sovereign)
 *
 * Additive only. No modifications to existing systems.
 */

import fs from "fs";
import {
  matchErrorPattern,
  addToRepairMemory,
  lookupRepairMemory,
} from "../server/emergent/repair-cortex.js";

const projectRoot = process.argv[2] || process.cwd();
const buildOutputFile = process.argv[3] || "/tmp/build-output.log";

console.log("╔══════════════════════════════════════╗");
console.log("║  REPAIR CORTEX — MID-BUILD SURGEON   ║");
console.log("╚══════════════════════════════════════╝");
console.log("");
console.log(`Project root:  ${projectRoot}`);
console.log(`Build output:  ${buildOutputFile}`);
console.log(`Timestamp:     ${new Date().toISOString()}`);
console.log("");

function main() {
  try {
    // Read the build output
    if (!fs.existsSync(buildOutputFile)) {
      console.error("Build output file not found:", buildOutputFile);
      process.exit(1);
    }

    const buildOutput = fs.readFileSync(buildOutputFile, "utf-8");
    const lines = buildOutput.split("\n").filter(l => l.trim());

    console.log(`Analyzing ${lines.length} lines of build output...`);
    console.log("");

    // Scan each line for known error patterns
    const errors = [];
    for (const line of lines) {
      const matched = matchErrorPattern(line);
      if (matched) {
        errors.push({ line: line.trim(), ...matched });
      }
    }

    if (errors.length === 0) {
      console.log("No recognized error patterns found in build output.");
      console.log("Sovereign intervention required.");
      process.exit(1);
    }

    console.log(`Found ${errors.length} recognized error pattern(s):`);
    console.log("");

    let fixApplied = false;

    for (const error of errors) {
      console.log(`  Pattern: ${error.key}`);
      console.log(`  Category: ${error.category}`);
      console.log(`  Line: ${error.line.slice(0, 120)}`);

      // Check repair memory first
      const knownFix = lookupRepairMemory(error.match?.[0] || error.line);
      if (knownFix) {
        console.log(`  Known fix: ${knownFix.name} (from repair memory)`);
        fixApplied = true;
        continue;
      }

      // Try pattern-matched fixes
      if (error.fixes && error.fixes.length > 0) {
        const sortedFixes = [...error.fixes].sort((a, b) => b.confidence - a.confidence);
        const bestFix = sortedFixes[0];

        console.log(`  Best fix: ${bestFix.name} (confidence: ${bestFix.confidence})`);
        console.log(`  Description: ${bestFix.describe(error.match)}`);

        // Record in repair memory
        addToRepairMemory(error.match?.[0] || error.line, {
          name: bestFix.name,
          confidence: bestFix.confidence,
          category: error.category,
          description: bestFix.describe(error.match),
        });

        fixApplied = true;
      } else {
        console.log("  No fixes available for this pattern");
      }

      console.log("");
    }

    if (fixApplied) {
      console.log("SURGEON: Fix(es) recorded. Retry the build.");
      process.exit(0);
    } else {
      console.log("SURGEON: No fixes could be applied. Sovereign intervention required.");
      process.exit(1);
    }
  } catch (e) {
    console.error("SURGEON ERROR:", e?.message || e);
    process.exit(1);
  }
}

main();
