#!/usr/bin/env node
/**
 * DTU Pack Converter — converts dtus.js mega-export to chunked JSONL packs
 *
 * Usage:
 *   node scripts/dtu-pack.js                          # Convert dtus.js → data/dtu-packs/
 *   node scripts/dtu-pack.js --input ./dtus.js        # Custom input path
 *   node scripts/dtu-pack.js --output ./packs         # Custom output directory
 *   node scripts/dtu-pack.js --chunk-size 500         # DTUs per chunk (default: 500)
 *   node scripts/dtu-pack.js --verify                 # Verify existing packs against manifest
 *
 * Output format:
 *   data/dtu-packs/
 *   ├── manifest.json         # SHA-256 hashes + metadata for all chunks
 *   ├── chunk-000.jsonl       # First N DTUs, one JSON object per line
 *   ├── chunk-001.jsonl
 *   └── ...
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, '..');

// ---- CLI args ----
const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function opt(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const INPUT_PATH = opt('input', path.join(SERVER_DIR, 'dtus.js'));
const OUTPUT_DIR = opt('output', path.join(SERVER_DIR, 'data', 'dtu-packs'));
const CHUNK_SIZE = Number(opt('chunk-size', '500'));
const VERIFY_MODE = flag('verify');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ---- Verify mode ----
async function verifyPacks() {
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('No manifest.json found at', manifestPath);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Verifying ${manifest.chunks.length} chunks (${manifest.totalDtus} DTUs)...`);

  let errors = 0;
  let totalLines = 0;

  for (const chunk of manifest.chunks) {
    const chunkPath = path.join(OUTPUT_DIR, chunk.file);
    if (!fs.existsSync(chunkPath)) {
      console.error(`  MISSING: ${chunk.file}`);
      errors++;
      continue;
    }
    const content = fs.readFileSync(chunkPath, 'utf-8');
    const hash = sha256(content);
    if (hash !== chunk.sha256) {
      console.error(`  HASH MISMATCH: ${chunk.file} (expected ${chunk.sha256.slice(0, 12)}..., got ${hash.slice(0, 12)}...)`);
      errors++;
      continue;
    }
    const lines = content.trim().split('\n').filter(l => l.trim());
    if (lines.length !== chunk.count) {
      console.error(`  COUNT MISMATCH: ${chunk.file} (expected ${chunk.count}, got ${lines.length})`);
      errors++;
      continue;
    }
    // Validate each line is valid JSON
    for (let i = 0; i < lines.length; i++) {
      try { JSON.parse(lines[i]); } catch (e) {
        console.error(`  INVALID JSON: ${chunk.file} line ${i + 1}: ${e.message}`);
        errors++;
      }
    }
    totalLines += lines.length;
    console.log(`  OK: ${chunk.file} (${chunk.count} DTUs, ${hash.slice(0, 12)}...)`);
  }

  if (errors === 0) {
    console.log(`\nAll ${manifest.chunks.length} chunks verified OK (${totalLines} DTUs total).`);
  } else {
    console.error(`\nVerification FAILED: ${errors} error(s).`);
    process.exit(1);
  }
}

// ---- Convert mode ----
async function convert() {
  console.log(`Loading DTUs from ${INPUT_PATH}...`);

  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Input file not found: ${INPUT_PATH}`);
    console.error('Provide --input <path> or ensure dtus.js exists in the server directory.');
    process.exit(1);
  }

  // Dynamic import of the dtus.js module
  const mod = await import(INPUT_PATH);
  const seed = mod?.dtus ?? mod?.default ?? mod?.DTUS ?? null;
  const dtus = Array.isArray(seed) ? seed : (Array.isArray(seed?.dtus) ? seed.dtus : []);

  if (dtus.length === 0) {
    console.error('No DTUs found in module. Expected export: export const dtus = [...]');
    process.exit(1);
  }

  console.log(`Found ${dtus.length} DTUs. Chunking into groups of ${CHUNK_SIZE}...`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const chunks = [];
  for (let i = 0; i < dtus.length; i += CHUNK_SIZE) {
    const slice = dtus.slice(i, i + CHUNK_SIZE);
    const chunkIdx = Math.floor(i / CHUNK_SIZE);
    const fileName = `chunk-${String(chunkIdx).padStart(3, '0')}.jsonl`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    // Write JSONL: one JSON object per line
    const content = slice.map(dtu => JSON.stringify(dtu)).join('\n') + '\n';
    fs.writeFileSync(filePath, content, 'utf-8');

    const hash = sha256(content);
    chunks.push({
      file: fileName,
      index: chunkIdx,
      count: slice.length,
      offsetStart: i,
      offsetEnd: i + slice.length - 1,
      sha256: hash,
      bytes: Buffer.byteLength(content),
    });

    console.log(`  Written: ${fileName} (${slice.length} DTUs, ${hash.slice(0, 12)}...)`);
  }

  // Write manifest
  const manifest = {
    version: 1,
    format: 'jsonl',
    createdAt: new Date().toISOString(),
    sourceFile: path.basename(INPUT_PATH),
    sourceSha256: sha256(fs.readFileSync(INPUT_PATH, 'utf-8')),
    totalDtus: dtus.length,
    chunkSize: CHUNK_SIZE,
    chunks,
  };

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\nManifest written: ${manifestPath}`);
  console.log(`Total: ${dtus.length} DTUs → ${chunks.length} chunks`);
}

// ---- Add streaming pack loader to server ----
// This function can be imported by server.js to load DTUs from packs
export async function loadDtuPacks(packDir) {
  const manifestPath = path.join(packDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, error: 'No manifest.json found', dtus: [] };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const dtus = [];
  let errors = 0;

  for (const chunk of manifest.chunks) {
    const chunkPath = path.join(packDir, chunk.file);
    if (!fs.existsSync(chunkPath)) { errors++; continue; }

    const content = fs.readFileSync(chunkPath, 'utf-8');
    const hash = sha256(content);
    if (hash !== chunk.sha256) {
      console.warn(`[DTU-Pack] Hash mismatch for ${chunk.file}, skipping`);
      errors++;
      continue;
    }

    const lines = content.trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        dtus.push(JSON.parse(line));
      } catch {
        errors++;
      }
    }
  }

  return {
    ok: errors === 0,
    totalDtus: dtus.length,
    expectedDtus: manifest.totalDtus,
    errors,
    dtus,
  };
}

// ---- Main ----
if (VERIFY_MODE) {
  await verifyPacks();
} else {
  await convert();
}
