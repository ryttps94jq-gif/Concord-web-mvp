#!/usr/bin/env node
/**
 * convert-dtus-to-packs.js
 *
 * Converts the monolithic dtus.js export into chunked JSONL packs with a
 * SHA-256 manifest.  Once generated, the server loads from packs (lazy,
 * streaming) instead of importing the full 3.9 MB JS module at startup.
 *
 * Usage:
 *   node server/scripts/convert-dtus-to-packs.js [--out <dir>] [--chunk-size <n>]
 *
 * Defaults:
 *   --out        DATA_DIR/dtu-packs  (or ./data/dtu-packs)
 *   --chunk-size 200                 (DTUs per JSONL file)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const OUT_DIR = getArg("--out", path.join(DATA_DIR, "dtu-packs"));
const CHUNK_SIZE = Number(getArg("--chunk-size", "200"));

async function main() {
  console.log("[convert-dtus-to-packs] Loading dtus.js...");
  const mod = await import("../dtus.js");
  const dtus = mod?.DTUS ?? mod?.dtus ?? mod?.default ?? [];
  if (!Array.isArray(dtus) || dtus.length === 0) {
    console.error("[convert-dtus-to-packs] No DTUs found in dtus.js");
    process.exit(1);
  }
  console.log(`[convert-dtus-to-packs] Found ${dtus.length} DTUs`);

  // Create output directory
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const chunks = [];
  for (let i = 0; i < dtus.length; i += CHUNK_SIZE) {
    const slice = dtus.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE);
    const fileName = `chunk-${String(chunkIndex).padStart(4, "0")}.jsonl`;
    const filePath = path.join(OUT_DIR, fileName);

    const content = slice.map(d => JSON.stringify(d)).join("\n") + "\n";
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");

    fs.writeFileSync(filePath, content, "utf-8");
    chunks.push({ file: fileName, count: slice.length, sha256 });
    console.log(`  wrote ${fileName} (${slice.length} DTUs, ${(content.length / 1024).toFixed(1)} KB)`);
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalDtus: dtus.length,
    chunkSize: CHUNK_SIZE,
    chunks
  };

  const manifestPath = path.join(OUT_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  const totalSizeKB = chunks.reduce((acc, c) => {
    const p = path.join(OUT_DIR, c.file);
    return acc + fs.statSync(p).size;
  }, 0) / 1024;

  console.log(`\n[convert-dtus-to-packs] Done!`);
  console.log(`  ${chunks.length} chunks, ${dtus.length} DTUs, ${totalSizeKB.toFixed(0)} KB total`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`\nThe server will now load from packs instead of dtus.js on next restart.`);
}

main().catch(e => { console.error(e); process.exit(1); });
