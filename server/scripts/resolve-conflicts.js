#!/usr/bin/env node
/**
 * resolve-conflicts.js
 *
 * Reads server/server.js, resolves all 15 merge-conflict regions according to
 * the rules supplied by the developer, and writes the result back.
 *
 * Rules per conflict number (1-indexed, counted in order of appearance):
 *   1           -> BOTH  (replace entire conflict block with a hand-crafted snippet)
 *   2, 3, 15    -> OURS  (keep lines between <<<<<<< and =======)
 *   4-14        -> THEIRS (keep lines between ======= and >>>>>>>)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FILE = resolve(__dirname, "..", "server.js");

// ── Conflict-1 replacement (BOTH sides, manually merged) ────────────────────
const CONFLICT_1_REPLACEMENT = `import { ConcordError, ValidationError, NotFoundError, AuthenticationError, AuthorizationError, ConflictError, RateLimitError, ServiceUnavailableError, DatabaseError } from "./lib/errors.js";
import { asyncHandler, createErrorMiddleware } from "./lib/async-handler.js";
import { init as initGRC, formatAndValidate as grcFormatAndValidate, getGRCSystemPrompt } from "./grc/index.js";
import configureMiddleware from "./middleware/index.js";

// ---- "Everything Real" imports: migration runner + durable endpoints ----
import { runMigrations as runSchemaMigrations } from "./migrate.js";
import { registerDurableEndpoints } from "./durable.js";

// ---- Guidance Layer v1: events, SSE, inspector, undo, suggestions ----
import { registerGuidanceEndpoints } from "./guidance.js";

// ---- Economy System: ledger, balances, transfers, withdrawals ----
import {
  registerEconomyEndpoints,
  hasSufficientBalance,
  calculateFee,
  FEES,
  PLATFORM_ACCOUNT_ID,
  recordTransactionBatch,
  generateTxId,
  checkRefIdProcessed,
  validateBalance as economyValidateBalance,
  economyAudit,
  auditCtx,
  createPurchase,
  transitionPurchase,
  recordSettlement,
} from "./economy/index.js";`;

// ── Which conflicts keep OURS vs THEIRS ─────────────────────────────────────
const OURS_SET = new Set([2, 3, 15]);
// Conflict 1 is special (BOTH), everything else is THEIRS.

// ── Read & process ──────────────────────────────────────────────────────────
const src = readFileSync(FILE, "utf8");
const lines = src.split("\n");

const out = [];
let conflictNum = 0;

// State machine: "normal" | "ours" | "theirs"
let state = "normal";
let currentConflict = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (state === "normal") {
    if (line.startsWith("<<<<<<<")) {
      // Entering a new conflict region
      conflictNum++;
      currentConflict = conflictNum;
      state = "ours";
      continue;
    }
    // Normal line - keep it.
    out.push(line);
    continue;
  }

  if (state === "ours") {
    if (line.startsWith("=======")) {
      state = "theirs";
      continue;
    }
    // We are inside the OURS block.
    if (currentConflict === 1) {
      // Skip - we will inject the combined text later.
      continue;
    }
    if (OURS_SET.has(currentConflict)) {
      out.push(line);
    }
    // If THEIRS conflict, skip ours lines.
    continue;
  }

  if (state === "theirs") {
    if (line.startsWith(">>>>>>>")) {
      // End of conflict region.
      if (currentConflict === 1) {
        // Inject the hand-crafted merged text.
        out.push(CONFLICT_1_REPLACEMENT);
      }
      state = "normal";
      continue;
    }
    // We are inside the THEIRS block.
    if (currentConflict === 1) {
      // Skip - replacement injected at closing marker.
      continue;
    }
    if (!OURS_SET.has(currentConflict)) {
      // THEIRS conflict - keep theirs lines.
      out.push(line);
    }
    // If OURS conflict, skip theirs lines.
    continue;
  }
}

// ── Write result ────────────────────────────────────────────────────────────
const result = out.join("\n");
writeFileSync(FILE, result, "utf8");

// Sanity check: no leftover conflict markers
const leftover = (result.match(/^<{7}/gm) || []).length;
if (leftover > 0) {
  console.error(`ERROR: ${leftover} conflict marker(s) remain!`);
  process.exit(1);
}

console.log(`Resolved ${conflictNum} conflict(s). No conflict markers remain.`);
console.log(`Written to ${FILE} (${result.length} bytes, ${out.length} lines).`);

// ── Post-resolution syntax fixes ────────────────────────────────────────────
// The THEIRS side of conflicts 13 and 14 contained })); closings for endpoints
// that use bare `async (req, res) =>` (no asyncHandler wrapper), which only
// need `});`. Fix them.
const src2 = readFileSync(FILE, "utf8");
const lines2 = src2.split("\n");

// Find app.post('/api/economic/tokens/purchase', async ... and its }));
// Find app.post('/api/economic/webhook', async ... and its }));
// Strategy: for each endpoint, find its opening line, track braces to its
// closing })); and replace with });

function fixExtraParenForEndpoint(linesArr, routePattern) {
  let depth = 0;
  let inBlock = false;
  let openLine = -1;
  for (let i = 0; i < linesArr.length; i++) {
    if (!inBlock && linesArr[i].includes(routePattern)) {
      inBlock = true;
      openLine = i;
      depth = 0;
      // Count braces on this line
      for (const ch of linesArr[i]) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      continue;
    }
    if (inBlock) {
      for (const ch of linesArr[i]) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth <= 0 && linesArr[i].trim() === '}));') {
        linesArr[i] = linesArr[i].replace('}));', '});');
        console.log(`Fixed extra paren at line ${i + 1} for ${routePattern}`);
        break;
      }
    }
  }
  return linesArr;
}

let fixedLines = [...lines2];
fixedLines = fixExtraParenForEndpoint(fixedLines, "'/api/economic/tokens/purchase'");
fixedLines = fixExtraParenForEndpoint(fixedLines, "'/api/economic/webhook'");
writeFileSync(FILE, fixedLines.join("\n"), "utf8");
console.log("Post-resolution syntax fixes applied.");
