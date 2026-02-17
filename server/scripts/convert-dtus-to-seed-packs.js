#!/usr/bin/env node
/**
 * convert-dtus-to-seed-packs.js
 *
 * Converts the monolithic dtus.js export into semantically-grouped JSON pack
 * files under server/data/seed/, organized by the `meta.part` field.
 *
 * Output files:
 *   data/seed/dtus-root.json      — the root DTU (dtu_root_fixed_point)
 *   data/seed/dtus-part1.json     — Part 1 entries (1–60)
 *   data/seed/dtus-part2.json     — Part 2 entries (61–120)
 *   data/seed/dtus-part3a.json    — Part 3 Alien Intelligence (121–180)
 *   data/seed/dtus-part3b.json    — Part 3 Introspection + Cultural (1001–2000)
 *   data/seed/dtus-part4.json     — Part 4 entries (181–240)
 *   data/seed/dtus-part5.json     — Part 5 entries (241–300)
 *   data/seed/dtus-part6.json     — Part 6 entries (301–360)
 *   data/seed/dtus-part7.json     — Part 7 entries (361–420)
 *   data/seed/dtus-part8.json     — Part 8 entries (421–480)
 *   data/seed/dtus-unassigned.json— entries with no meta.part (481–1000)
 *   data/seed/manifest.json       — lists all pack files with entry counts
 *
 * Usage:
 *   node server/scripts/convert-dtus-to-seed-packs.js
 *
 * The key benefit: instead of parsing a 3.8 MB JavaScript module at startup,
 * the server loads small JSON files. JSON.parse is significantly faster than
 * JS module parsing.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, "..", "data", "seed");

/**
 * Maps a DTU's meta.part string (or lack thereof) + its id to a pack file key.
 */
function classifyDTU(dtu) {
  // Root DTU gets its own file
  if (dtu.id === "dtu_root_fixed_point") return "root";

  const part = dtu.meta && dtu.meta.part;
  if (!part) return "unassigned";

  // Match "Part N:" prefix
  if (part.startsWith("Part 1:")) return "part1";
  if (part.startsWith("Part 2:")) return "part2";
  if (part.startsWith("Part 4:")) return "part4";
  if (part.startsWith("Part 5:")) return "part5";
  if (part.startsWith("Part 6:")) return "part6";
  if (part.startsWith("Part 7:")) return "part7";
  if (part.startsWith("Part 8:")) return "part8";

  // Part 3 has two sub-groups distinguished by content
  if (part.startsWith("Part 3:")) {
    if (part.includes("Introspection") || part.includes("1001")) return "part3b";
    return "part3a";
  }

  return "unassigned";
}

/** Ordered list of pack keys and their output filenames */
const PACK_ORDER = [
  { key: "root",       file: "dtus-root.json",       label: "Root DTU" },
  { key: "part1",      file: "dtus-part1.json",      label: "Part 1: Core First-Order + Immediate Geometries (1-60)" },
  { key: "part2",      file: "dtus-part2.json",      label: "Part 2: ETCC Core, Indices, and Constraint Geometry (61-120)" },
  { key: "part3a",     file: "dtus-part3a.json",     label: "Part 3a: Alien Intelligence Morphologies (121-180)" },
  { key: "part3b",     file: "dtus-part3b.json",     label: "Part 3b: Introspection + Cultural Procedural Layer (1001-2000)" },
  { key: "part4",      file: "dtus-part4.json",      label: "Part 4: Civilization Architectures (181-240)" },
  { key: "part5",      file: "dtus-part5.json",      label: "Part 5: Climate, Ecology, Infrastructure (241-300)" },
  { key: "part6",      file: "dtus-part6.json",      label: "Part 6: Mathematics, Computation, Physics (301-360)" },
  { key: "part7",      file: "dtus-part7.json",      label: "Part 7: Cognition, Psychology, Language (361-420)" },
  { key: "part8",      file: "dtus-part8.json",      label: "Part 8: Meta-Closure, Recursive Self-Application (421-480)" },
  { key: "unassigned", file: "dtus-unassigned.json",  label: "Unassigned DTUs (481-1000)" },
];

async function main() {
  console.log("[convert-dtus-to-seed-packs] Loading dtus.js...");
  const mod = await import("../dtus.js");
  const dtus = mod.DTUS || mod.dtus || mod.default || [];
  if (!Array.isArray(dtus) || dtus.length === 0) {
    console.error("[convert-dtus-to-seed-packs] No DTUs found in dtus.js");
    process.exit(1);
  }
  console.log(`[convert-dtus-to-seed-packs] Found ${dtus.length} DTUs`);

  // Group DTUs by pack key
  const groups = {};
  for (const packDef of PACK_ORDER) {
    groups[packDef.key] = [];
  }

  for (const dtu of dtus) {
    const key = classifyDTU(dtu);
    if (!groups[key]) {
      console.warn(`[convert-dtus-to-seed-packs] Unknown classification "${key}" for DTU ${dtu.id}, adding to unassigned`);
      groups["unassigned"].push(dtu);
    } else {
      groups[key].push(dtu);
    }
  }

  // Create output directory
  fs.mkdirSync(SEED_DIR, { recursive: true });

  // Write each pack file
  const packs = [];
  let totalSize = 0;

  for (const packDef of PACK_ORDER) {
    const entries = groups[packDef.key];
    if (entries.length === 0) {
      console.log(`  skipping ${packDef.file} (0 entries)`);
      continue;
    }

    const filePath = path.join(SEED_DIR, packDef.file);
    const content = JSON.stringify(entries, null, 2);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");

    fs.writeFileSync(filePath, content, "utf-8");
    const sizeKB = (Buffer.byteLength(content, "utf-8") / 1024).toFixed(1);
    totalSize += Buffer.byteLength(content, "utf-8");

    packs.push({
      file: packDef.file,
      label: packDef.label,
      count: entries.length,
      sizeKB: Number(sizeKB),
      sha256,
    });
    console.log(`  wrote ${packDef.file} — ${entries.length} DTUs, ${sizeKB} KB`);
  }

  // Write manifest
  const manifest = {
    version: 2,
    format: "seed-packs",
    generatedAt: new Date().toISOString(),
    totalDtus: dtus.length,
    packCount: packs.length,
    packs,
  };

  const manifestPath = path.join(SEED_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\n[convert-dtus-to-seed-packs] Done!`);
  console.log(`  ${packs.length} pack files, ${dtus.length} DTUs total`);
  console.log(`  Total size: ${(totalSize / 1024).toFixed(0)} KB`);
  console.log(`  Manifest: ${manifestPath}`);

  // Verify counts
  const totalInPacks = packs.reduce((s, p) => s + p.count, 0);
  if (totalInPacks !== dtus.length) {
    console.error(`\n  WARNING: Pack total (${totalInPacks}) does not match DTU count (${dtus.length})!`);
    process.exit(1);
  }
  console.log(`  Integrity check passed: ${totalInPacks} DTUs across ${packs.length} packs`);
}

main().catch(e => { console.error(e); process.exit(1); });
