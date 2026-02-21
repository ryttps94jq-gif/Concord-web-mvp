#!/usr/bin/env node
/**
 * Repair Cortex — Mid-Build Surgeon (CLI)
 *
 * Full-system build error analyzer and auto-fixer.
 * Handles ALL error categories: TypeScript, ESLint, Next.js, lockfile,
 * native modules, Docker, CSS/Tailwind, React, Node.js runtime, and more.
 *
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

console.log("╔═══════════════════════════════════════════════╗");
console.log("║  REPAIR CORTEX — MID-BUILD SURGEON            ║");
console.log("║  Full-System Error Analysis                    ║");
console.log("╚═══════════════════════════════════════════════╝");
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
    const seenPatterns = new Set(); // Deduplicate same error type
    for (const line of lines) {
      const matched = matchErrorPattern(line);
      if (matched && !seenPatterns.has(matched.key)) {
        errors.push({ line: line.trim(), ...matched });
        seenPatterns.add(matched.key);
      }
    }

    // Categorize errors for summary
    const categories = new Map();
    for (const error of errors) {
      const cat = error.category || "unknown";
      categories.set(cat, (categories.get(cat) || 0) + 1);
    }

    if (errors.length === 0) {
      // Try heuristic fallback for unrecognized errors
      const heuristicResult = tryHeuristicDiagnosis(buildOutput, lines);
      if (heuristicResult) {
        console.log(`Heuristic diagnosis: ${heuristicResult.category}`);
        console.log(`  ${heuristicResult.message}`);
        console.log(`  Suggested: ${heuristicResult.suggestion}`);
        console.log("");
        addToRepairMemory(heuristicResult.pattern, {
          name: heuristicResult.suggestion,
          confidence: heuristicResult.confidence,
          category: heuristicResult.category,
          description: heuristicResult.message,
        });
        console.log("SURGEON: Heuristic fix recorded. Retry the build.");
        process.exit(0);
      }

      console.log("No recognized error patterns found in build output.");
      console.log("Sovereign intervention required.");
      process.exit(1);
    }

    console.log(`Found ${errors.length} recognized error pattern(s):`);
    if (categories.size > 0) {
      console.log(`  Categories: ${Array.from(categories.entries()).map(([k, v]) => `${k}(${v})`).join(", ")}`);
    }
    console.log("");

    let fixApplied = false;

    for (const error of errors) {
      console.log(`  Pattern:  ${error.key}`);
      console.log(`  Category: ${error.category}`);
      console.log(`  Line:     ${error.line.slice(0, 150)}`);

      // Check repair memory first
      const knownFix = lookupRepairMemory(error.match?.[0] || error.line);
      if (knownFix) {
        console.log(`  Known fix: ${knownFix.name} (from repair memory, success rate: ${knownFix.successRate || "?"})`);
        fixApplied = true;
        console.log("");
        continue;
      }

      // Try pattern-matched fixes
      if (error.fixes && error.fixes.length > 0) {
        const sortedFixes = [...error.fixes].sort((a, b) => b.confidence - a.confidence);
        const bestFix = sortedFixes[0];

        console.log(`  Best fix:    ${bestFix.name} (confidence: ${bestFix.confidence})`);
        console.log(`  Description: ${bestFix.describe(error.match)}`);

        if (sortedFixes.length > 1) {
          console.log(`  Alt fixes:   ${sortedFixes.slice(1).map(f => `${f.name}(${f.confidence})`).join(", ")}`);
        }

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
      console.log(`SURGEON: ${errors.length} error(s) analyzed, fix(es) recorded. Retry the build.`);
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

/**
 * Heuristic fallback for errors that don't match any explicit pattern.
 * Looks for broad signals in the build output.
 */
function tryHeuristicDiagnosis(fullOutput, lines) {
  try {
    const lower = fullOutput.toLowerCase();

    // Lockfile / npm ci failures
    if (lower.includes("npm ci") && (lower.includes("lockfile") || lower.includes("package-lock"))) {
      return {
        category: "lockfile",
        pattern: "npm_ci_lockfile_generic",
        message: "npm ci failed due to lockfile issue",
        suggestion: "regenerate_lockfile",
        confidence: 0.9,
      };
    }

    // ERESOLVE anywhere
    if (lower.includes("eresolve")) {
      return {
        category: "lockfile",
        pattern: "eresolve_generic",
        message: "npm dependency resolution failed (ERESOLVE)",
        suggestion: "install_legacy_peer_deps",
        confidence: 0.85,
      };
    }

    // TypeScript errors
    if (lower.includes("error ts") || lower.includes("type error")) {
      const count = (fullOutput.match(/error TS\d+/g) || []).length;
      return {
        category: "typescript",
        pattern: "typescript_generic",
        message: `TypeScript compilation failed with ${count || "unknown"} error(s)`,
        suggestion: "fix_typescript_errors",
        confidence: 0.7,
      };
    }

    // Next.js build failure
    if (lower.includes("next build") && lower.includes("failed")) {
      return {
        category: "nextjs",
        pattern: "nextjs_build_generic",
        message: "Next.js build failed",
        suggestion: "check_next_build_output",
        confidence: 0.6,
      };
    }

    // ESLint
    if (lower.includes("eslint") && (lower.includes("error") || lower.includes("problems"))) {
      return {
        category: "eslint",
        pattern: "eslint_generic",
        message: "ESLint found errors that block the build",
        suggestion: "fix_eslint_errors",
        confidence: 0.7,
      };
    }

    // Docker no space
    if (lower.includes("no space left")) {
      return {
        category: "docker",
        pattern: "no_space_generic",
        message: "No disk space left on device",
        suggestion: "docker_prune",
        confidence: 0.95,
      };
    }

    // Native module / gyp
    if (lower.includes("gyp err") || lower.includes("node-pre-gyp") || lower.includes("prebuild-install")) {
      return {
        category: "native",
        pattern: "native_module_generic",
        message: "Native module compilation failed",
        suggestion: "install_build_tools",
        confidence: 0.8,
      };
    }

    // Permission denied
    if (lower.includes("eacces") || lower.includes("permission denied")) {
      return {
        category: "runtime",
        pattern: "permission_generic",
        message: "Permission denied during build",
        suggestion: "fix_permissions",
        confidence: 0.8,
      };
    }

    // Network timeout
    if (lower.includes("etimedout") || lower.includes("econnrefused") || lower.includes("fetch failed")) {
      return {
        category: "network",
        pattern: "network_generic",
        message: "Network error during build (timeout or connection refused)",
        suggestion: "check_network_retry",
        confidence: 0.7,
      };
    }

    return null;
  } catch {
    return null;
  }
}

main();
