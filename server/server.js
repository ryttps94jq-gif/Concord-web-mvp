/**
 * Concord v1 — Unified Monolith (Local-first, LLM-optional)
 * Fixes included (per your A/B/B/C choices):
 *  - Central Governor scheduler (heartbeat every 2 minutes) drives: dream + evolution + autogen + ingest queue + autocrawl queue
 *  - Manual + Auto Ingest: turns text into CRETIs/DTUs (parent + children)
 *  - Manual + Auto Crawl: fetch HTML -> extract readable text -> CRETI breakdown into DTUs (no hollow shells)
 *  - Council gate: content can always stay LOCAL; GLOBAL submissions are blocked if flagged as closed-source/first-gen
 *  - /api/chat and /api/ask both supported
 *
 * Run:
 *   cd server
 *   npm install
 *   npm start
 *
 * Env (optional):
 *   OPENAI_API_KEY=...
 *   OPENAI_MODEL=gpt-4.1-mini (or any chat-capable model your SDK supports)
 *   FRONTEND_ORIGIN=http://localhost:5173
 *   PORT=5050
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5050);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

let OpenAIClient = null;
async function getOpenAI() {
  if (!OPENAI_API_KEY) return null;
  if (OpenAIClient) return OpenAIClient;
  try {
    const mod = await import("openai");
    const OpenAI = mod.default || mod.OpenAI || mod;
    OpenAIClient = new OpenAI({ apiKey: OPENAI_API_KEY });
    return OpenAIClient;
  } catch (e) {
    console.warn("[OpenAI] SDK not available or failed to load:", String(e?.message || e));
    return null;
  }
}

// -----------------------------
// uuid helper (no external dep)
// -----------------------------
const uuidv4 = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
  );
};

// --------------------------------------------------
// Data persistence (local JSON files)
// --------------------------------------------------
const DATA_DIR = path.join(__dirname, ".concord_data");
const FILES = {
  dtus: path.join(DATA_DIR, "dtus.json"),
  simulations: path.join(DATA_DIR, "simulations.json"),
  credits: path.join(DATA_DIR, "credits.json"),
  marketplace: path.join(DATA_DIR, "marketplace.json"),
  events: path.join(DATA_DIR, "events.json"),
  settings: path.join(DATA_DIR, "settings.json"),
  queues: path.join(DATA_DIR, "queues.json"),
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const initArray = ["dtus","simulations","credits","marketplace","events"];
  for (const key of initArray) {
    const f = FILES[key];
    if (!fs.existsSync(f)) fs.writeFileSync(f, "[]", "utf8");
  }
  if (!fs.existsSync(FILES.settings)) fs.writeFileSync(FILES.settings, "{}", "utf8");
  if (!fs.existsSync(FILES.queues)) fs.writeFileSync(FILES.queues, "{}", "utf8");
}
ensureDataDir();

function readJSON(file, fallback) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// --------------------------------------------------
// Hashing / stable stringify
// --------------------------------------------------
function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function stableStringify(obj) {
  const allKeys = [];
  JSON.stringify(obj, (k, v) => (allKeys.push(k), v));
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}
function nowISO() { return new Date().toISOString(); }

// --------------------------------------------------
// Events
// --------------------------------------------------
let events = readJSON(FILES.events, []);
function appendEvent(type, payload = {}) {
  const ev = { id: uuidv4(), type, at: nowISO(), payload };
  events.push(ev);
  if (events.length > 5000) events = events.slice(-5000);
  writeJSON(FILES.events, events);
  return ev;
}

// --------------------------------------------------
// DTUs + lineage hash (NO user identity)
// --------------------------------------------------
let dtus = readJSON(FILES.dtus, []);

function computeDTULineageHash({ content, tags, parents }) {
  const parentIds = (parents || []).map((p) => p?.id || p).filter(Boolean).sort();
  const core = {
    content: (content || "").trim(),
    tags: Array.isArray(tags) ? tags.slice().sort() : [],
    parents: parentIds,
  };
  return sha256(stableStringify(core));
}

function createDTU({ title, content, tags = [], source = "manual", parents = [], isGlobal = false, meta = {} }) {
  const createdAt = nowISO();
  const id = uuidv4();
  const lineageHash = computeDTULineageHash({ content, tags, parents });
  const dtu = {
    id,
    lineageHash,
    content: String(content || ""),
    tags: Array.isArray(tags) ? tags : [],
    isGlobal: Boolean(isGlobal),
    meta: {
      title: title || "DTU",
      source,
      createdAt,
      updatedAt: createdAt,
      parents: (parents || []).map((p) => (typeof p === "string" ? p : p?.id)).filter(Boolean),
      ...meta,
    },
  };
  dtus.unshift(dtu);
  writeJSON(FILES.dtus, dtus);
  appendEvent("dtu.created", { id, lineageHash, source, isGlobal: dtu.isGlobal });
  return dtu;
}

function updateDTU(id, patch = {}) {
  const idx = dtus.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const existing = dtus[idx];
  const updated = {
    ...existing,
    ...patch,
    meta: { ...existing.meta, ...(patch.meta || {}), updatedAt: nowISO() },
  };
  const content = updated.content;
  const tags = updated.tags;
  const parents = (updated.meta?.parents || []).slice();
  updated.lineageHash = computeDTULineageHash({ content, tags, parents });
  dtus[idx] = updated;
  writeJSON(FILES.dtus, dtus);
  appendEvent("dtu.updated", { id });
  return updated;
}

// --------------------------------------------------
// Optional seeding: load dtus from a local dtus.js file if present.
// Supports:
//   - export const dtus = [...]
//   - export default [...]
//   - module.exports = [...]
// --------------------------------------------------
async function seedDTUsFromLocalModule() {
  const candidates = [
    path.join(__dirname, "dtus.js"),
    path.join(__dirname, "dtus.mjs"),
    path.join(__dirname, "dtus.cjs"),
  ];
  const seedFile = candidates.find((p) => fs.existsSync(p));
  if (!seedFile) return { ok: false, reason: "no dtus.* file found" };

  let mod = null;
  try {
    const url = new URL(`file://${seedFile}`);
    mod = await import(url.href);
  } catch (e1) {
    try {
      const { createRequire } = await import("module");
      const req = createRequire(import.meta.url);
      mod = req(seedFile);
    } catch (e2) {
      return { ok: false, reason: "failed to load dtus module", errors: [String(e1), String(e2)] };
    }
  }

  const arr =
    (mod && Array.isArray(mod.dtus) && mod.dtus) ||
    (mod && Array.isArray(mod.DTUS) && mod.DTUS) ||
    (mod && Array.isArray(mod.default) && mod.default) ||
    (mod && Array.isArray(mod) && mod) ||
    [];

  if (!Array.isArray(arr) || !arr.length) return { ok: false, reason: "dtus module loaded but no array export found" };

  const existing = new Set((dtus || []).map((d) => d.lineageHash || sha256(stableStringify(d))));
  let added = 0;

  for (const item of arr) {
    const title = item?.meta?.title || item?.title || "Seed DTU";
    const content = item?.content || item?.text || item?.body || "";
    const tags = item?.tags || item?.meta?.tags || [];
    const parents = item?.meta?.parents || item?.parents || [];
    const key = computeDTULineageHash({ content, tags, parents });

    if (existing.has(key)) continue;
    createDTU({ title, content, tags, source: "seed", parents });
    existing.add(key);
    added += 1;
  }
  return { ok: true, added, total: arr.length, file: path.basename(seedFile) };
}
seedDTUsFromLocalModule()
  .then((r)=>{ if(r?.ok && r.added) console.log(`[DTU Seed] Added ${r.added}/${r.total} from ${r.file}`); })
  .catch(()=>{});

// --------------------------------------------------
// Credits (FAKE CCs) — device-local wallet ids
// --------------------------------------------------
let creditsLedger = readJSON(FILES.credits, []);
function getOrCreateWallet(walletId) {
  let w = creditsLedger.find((x) => x.walletId === walletId);
  if (!w) {
    w = { walletId, balance: 0, createdAt: nowISO(), updatedAt: nowISO() };
    creditsLedger.push(w);
    writeJSON(FILES.credits, creditsLedger);
    appendEvent("credits.wallet_created", { walletId });
  }
  return w;
}
function creditWallet(walletId, amount, reason = "credit") {
  const w = getOrCreateWallet(walletId);
  w.balance = Number(w.balance || 0) + Number(amount || 0);
  w.updatedAt = nowISO();
  writeJSON(FILES.credits, creditsLedger);
  appendEvent("credits.changed", { walletId, amount: Number(amount||0), reason });
  return w;
}
function debitWallet(walletId, amount, reason = "debit") {
  const w = getOrCreateWallet(walletId);
  const amt = Number(amount || 0);
  if (w.balance < amt) return { ok: false, error: "Insufficient CC balance." };
  w.balance -= amt;
  w.updatedAt = nowISO();
  writeJSON(FILES.credits, creditsLedger);
  appendEvent("credits.changed", { walletId, amount: -amt, reason });
  return { ok: true, wallet: w };
}

// --------------------------------------------------
// Marketplace (visible, “coming soon” friendly)
// --------------------------------------------------
let marketplaceListings = readJSON(FILES.marketplace, []);

// --------------------------------------------------
// Simulations
// --------------------------------------------------
let simulations = readJSON(FILES.simulations, []);
function runWhatIf({ title, prompt, assumptions = [] }) {
  const id = uuidv4();
  const createdAt = nowISO();
  const outcome = {
    id,
    title: title || "What-if",
    prompt: prompt || "",
    assumptions,
    results: {
      range: "v1 snapshot",
      summary: "What-if v1. v2 deepens forks + Monte Carlo.",
      keyRisks: ["unknown constraints", "edge cases"],
      opportunities: ["rapid iteration", "macro-domain concealment"],
    },
    createdAt,
  };
  simulations.unshift(outcome);
  if (simulations.length > 500) simulations = simulations.slice(0, 500);
  writeJSON(FILES.simulations, simulations);
  appendEvent("simulation.created", { id });
  return outcome;
}

// --------------------------------------------------
// “Macros” = Declarative Layer Registry + Recipes
// --------------------------------------------------
const MacroDomains = [
  "Epistemics", "Constraints", "Sandbox", "Temporal", "Simulation",
  "Evolution", "DTUGraph", "Council", "Swarm", "Marketplace", "Privacy", "SelfRepair", "Ingest", "Crawl", "Dream"
];

const LayerRegistry = {
  domains: MacroDomains,
  recipes: {
    HYPOTHESIS_PIPELINE: ["Epistemics", "Constraints", "Sandbox", "Evolution", "DTUGraph"],
    SIMULATION_PIPELINE: ["Epistemics", "Constraints", "Simulation", "DTUGraph"],
    COUNCIL_PIPELINE: ["Epistemics", "Council", "DTUGraph"],
    INGEST_PIPELINE: ["Ingest", "DTUGraph", "Temporal"],
    CRAWL_PIPELINE: ["Crawl", "Ingest", "DTUGraph", "Temporal"],
    DREAM_PIPELINE: ["Dream", "Evolution", "DTUGraph"],
  },
};

function runMacro(recipeName, ctx = {}) {
  const recipe = LayerRegistry.recipes[recipeName];
  if (!recipe) return { ok: false, error: "Unknown macro recipe." };
  const trace = recipe.map((domain) => ({
    domain,
    at: nowISO(),
    note: `Executed domain "${domain}" (v1 macro runtime).`,
  }));
  return { ok: true, recipeName, trace, ctx };
}

// --------------------------------------------------
// Personas + Council (animation/speech cue protocol)
// --------------------------------------------------
const personas = [
  { id: "p_ethicist", name: "Ethicist", style: "careful, harm-aware" },
  { id: "p_engineer", name: "Engineer", style: "systems-first, implementation-aware" },
  { id: "p_historian", name: "Historian", style: "contextual, precedent-driven" },
  { id: "p_economist", name: "Economist", style: "incentives, second-order effects" },
];

function personaCue(kind = "talk") {
  const cues = {
    idle: { state: "idle", intensity: 0.2, durationMs: 800 },
    talk: { state: "talk", intensity: 0.6, durationMs: 1800 },
    emphasize: { state: "emphasize", intensity: 0.9, durationMs: 1200 },
    thinking: { state: "thinking", intensity: 0.4, durationMs: 1400 },
  };
  return cues[kind] || cues.talk;
}

// ------------------------------
// Council gate: GLOBAL rules
// ------------------------------
function councilGateGlobal({ declaredSourceType, url }) {
  // Your rule: if it's first-gen closed source, Global can't accept it.
  // Local is always allowed.
  const t = String(declaredSourceType || "").toLowerCase();
  if (t.includes("closed")) return { ok: false, reason: "Closed-source first generation is blocked from Global. Local is allowed." };
  // If user doesn't declare, default to allowed, but record uncertainty.
  return { ok: true, reason: "Allowed." };
}

// --------------------------------------------------
// Readability extraction (no external libs)
// --------------------------------------------------
function stripHTMLToText(html) {
  let s = String(html || "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/[ \t\r]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function chunkText(text, maxChars = 2200) {
  const t = String(text || "").trim();
  if (!t) return [];
  const paras = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length <= maxChars) {
      cur = cur ? (cur + "\n\n" + p) : p;
    } else {
      if (cur) chunks.push(cur);
      if (p.length <= maxChars) {
        cur = p;
      } else {
        // hard split
        for (let i=0; i<p.length; i+=maxChars) chunks.push(p.slice(i, i+maxChars));
        cur = "";
      }
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// --------------------------------------------------
// CRETI synthesis (LLM optional)
// Returns: { parentDTU, childrenDTUs[], notes }
// --------------------------------------------------
async function cretiFromText({ title, text, tags = [], source = "ingest", url = "", declaredSourceType = "open", makeGlobal = false }) {
  const clean = String(text || "").trim();
  if (!clean) return { ok: false, error: "Empty text." };

  // Global gate (local always allowed)
  let globalAllowed = false;
  if (makeGlobal) {
    const gate = councilGateGlobal({ declaredSourceType, url });
    if (!gate.ok) {
      makeGlobal = false;
      appendEvent("council.global_blocked", { reason: gate.reason, url, declaredSourceType });
    } else {
      globalAllowed = true;
    }
  }

  // Parent DTU: preserve source content (bounded)
  const parent = createDTU({
    title: title || (url ? `Source: ${url}` : "Ingest Source"),
    content: clean.slice(0, 50000),
    tags: ["source", source, ...(tags || [])],
    source,
    isGlobal: false,
    meta: { url, declaredSourceType, globalRequested: !!globalAllowed }
  });

  const chunks = chunkText(clean, 2200);
  const oai = await getOpenAI();

  const children = [];
  const synthesisPrompt = (chunk) => `
You are Concord CRETI.
Turn the following source text into discrete thought units (DTUs).
Rules:
- Produce 3-7 DTUs maximum for this chunk.
- Each DTU: a short title + concise content + 3-8 tags.
- Do NOT copy long passages; paraphrase.
- If uncertainty exists, label it.
Return JSON ONLY in this schema:
{
  "dtus":[
    {"title":"...","content":"...","tags":["...","..."]}
  ]
}
SOURCE CHUNK:
${chunk}
`.trim();

  for (let i=0; i<chunks.length; i++) {
    const chunk = chunks[i];
    if (oai) {
      try {
        const resp = await oai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: "You output strict JSON only." },
            { role: "user", content: synthesisPrompt(chunk) }
          ],
          temperature: 0.4
        });
        const raw = resp?.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed?.dtus) ? parsed.dtus : [];
        for (const d of arr.slice(0, 7)) {
          const child = createDTU({
            title: d.title || "CRETI DTU",
            content: String(d.content || "").slice(0, 6000),
            tags: Array.isArray(d.tags) ? ["creti", ...d.tags] : ["creti"],
            source: "creti",
            parents: [parent.id],
            isGlobal: false,
            meta: { url, chunkIndex: i }
          });
          children.push(child);
        }
      } catch (e) {
        // Fallback: store chunk DTU if LLM fails
        const child = createDTU({
          title: `Chunk ${i+1}`,
          content: chunk,
          tags: ["creti", "chunk", source],
          source: "creti_fallback",
          parents: [parent.id],
          meta: { url, chunkIndex: i, error: String(e?.message || e) }
        });
        children.push(child);
      }
    } else {
      // No LLM: chunk DTUs (still not hollow)
      const child = createDTU({
        title: `Chunk ${i+1}`,
        content: chunk,
        tags: ["creti", "chunk", source],
        source: "creti_chunk",
        parents: [parent.id],
        meta: { url, chunkIndex: i }
      });
      children.push(child);
    }
  }

  // If globalAllowed, create a GLOBAL "index" DTU that references lineage only (no raw text)
  let globalDTU = null;
  if (globalAllowed) {
    globalDTU = createDTU({
      title: `GLOBAL: ${title || (url || "CRETI Pack")}`,
      content: `Global index for CRETI pack. Parent lineage: ${parent.lineageHash}. Children: ${children.length}.`,
      tags: ["global", "creti", "index"],
      source: "global_index",
      parents: children.map(c=>c.id).slice(0, 20),
      isGlobal: true,
      meta: { url, declaredSourceType, parentLineage: parent.lineageHash }
    });
  }

  appendEvent("creti.created", { parentId: parent.id, children: children.length, url, global: !!globalAllowed });
  return { ok: true, parent, children, globalDTU };
}

// --------------------------------------------------
// Fetch + crawl (manual & auto)
// --------------------------------------------------
async function crawlUrlToCretis({ url, declaredSourceType = "open", makeGlobal = false, tags = [] }) {
  const u = String(url || "").trim();
  if (!u) return { ok: false, error: "url required" };

  // Basic URL allow: v1 manual crawl can be any URL, but you can lock it later.
  let html = "";
  try {
    const res = await fetch(u, { method: "GET", redirect: "follow" });
    html = await res.text();
    if (!res.ok) {
      return { ok: false, error: `Fetch failed: ${res.status}` };
    }
  } catch (e) {
    return { ok: false, error: `Fetch error: ${String(e?.message || e)}` };
  }

  const text = stripHTMLToText(html);
  if (!text || text.length < 80) {
    // Still create a DTU with what we have, but record emptiness
    const parent = createDTU({
      title: `Crawl (low content): ${u}`,
      content: text || "(No extractable content. Page may be JS-rendered.)",
      tags: ["crawl", "low_content"],
      source: "crawl",
      meta: { url: u, declaredSourceType }
    });
    appendEvent("crawl.low_content", { url: u, chars: (text||"").length });
    return { ok: true, parent, children: [], note: "Low extractable content (JS-rendered page likely)." };
  }

  return cretiFromText({
    title: `Crawl: ${u}`,
    text,
    tags: ["crawl", ...tags],
    source: "crawl",
    url: u,
    declaredSourceType,
    makeGlobal
  });
}

// --------------------------------------------------
// Queues + Governor (Central Scheduler)
// --------------------------------------------------
let settings = readJSON(FILES.settings, {});
const DEFAULT_JOBS = {
  heartbeat: { enabled: true },
  dream: { enabled: true },
  evolution: { enabled: true },
  autogen: { enabled: true },
  ingest: { enabled: true },
  autocrawl: { enabled: true }
};

function normalizeSettings() {
  settings.jobs = settings.jobs || {};
  for (const [k,v] of Object.entries(DEFAULT_JOBS)) {
    if (typeof settings.jobs[k]?.enabled !== "boolean") settings.jobs[k] = { ...v, enabled: v.enabled };
  }
  settings.intervals = settings.intervals || {};
  // Your choice: every 2 minutes heartbeat
  if (!settings.intervals.heartbeatMs) settings.intervals.heartbeatMs = 120000;
  // internal cooldowns (can be tuned)
  if (!settings.intervals.dreamCooldownMs) settings.intervals.dreamCooldownMs = 240000;     // 4m
  if (!settings.intervals.evolutionCooldownMs) settings.intervals.evolutionCooldownMs = 180000;// 3m
  if (!settings.intervals.autogenCooldownMs) settings.intervals.autogenCooldownMs = 240000;  // 4m
  if (!settings.intervals.ingestCooldownMs) settings.intervals.ingestCooldownMs = 30000;    // 30s
  if (!settings.intervals.autocrawlCooldownMs) settings.intervals.autocrawlCooldownMs = 60000;// 60s
  writeJSON(FILES.settings, settings);
}
normalizeSettings();

let queues = readJSON(FILES.queues, {});
queues.ingest = Array.isArray(queues.ingest) ? queues.ingest : [];
queues.autocrawl = Array.isArray(queues.autocrawl) ? queues.autocrawl : [];
writeJSON(FILES.queues, queues);

const governor = {
  startedAt: nowISO(),
  lastTick: null,
  lastRun: {
    dream: null,
    evolution: null,
    autogen: null,
    ingest: null,
    autocrawl: null
  },
  lastResult: {}
};

function jobEnabled(name) {
  return !!settings?.jobs?.[name]?.enabled;
}

function canRun(name, cooldownMs) {
  const last = governor.lastRun[name];
  if (!last) return true;
  return (Date.now() - new Date(last).getTime()) >= cooldownMs;
}

// ------------------------------
// Dream (C = both mutate + create)
// ------------------------------
async function dreamStep() {
  if (!dtus.length) return { ok: false, note: "no dtus" };
  const a = dtus[Math.floor(Math.random() * dtus.length)];
  const b = dtus[Math.floor(Math.random() * dtus.length)];
  const oai = await getOpenAI();

  let dreamText = `DREAM (v1): recombine motifs from DTUs.\nA:${a?.meta?.title}\nB:${b?.meta?.title}\n`;
  if (oai) {
    try {
      const resp = await oai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "You create a short speculative synthesis. No unsafe content." },
          { role: "user", content: `Create a dream-synthesis DTU that combines these two ideas. Keep it short.\nDTU A:\n${a.content}\nDTU B:\n${b.content}` }
        ],
        temperature: 0.7
      });
      dreamText = resp?.choices?.[0]?.message?.content?.slice(0, 6000) || dreamText;
    } catch {}
  }

  const dreamDTU = createDTU({
    title: "Dream Synthesis",
    content: dreamText,
    tags: ["dream", "synthesis"],
    source: "dream",
    parents: [a?.id, b?.id].filter(Boolean),
    meta: { mode: "mutate+create" }
  });

  // Mutate tags lightly (mark "dreamt" on parents)
  for (const d of [a,b]) {
    if (!d?.id) continue;
    const tags = new Set(d.tags || []);
    tags.add("dreamt");
    updateDTU(d.id, { tags: Array.from(tags) });
  }

  appendEvent("dream.ran", { created: dreamDTU.id, parents: [a?.id,b?.id].filter(Boolean) });
  return { ok: true, createdId: dreamDTU.id };
}

// ------------------------------
// Evolution (light but real)
// ------------------------------
async function evolutionStep() {
  if (!dtus.length) return { ok: false, note: "no dtus" };
  // pick a DTU not evolved yet
  const target = dtus.find(d => !(d.tags||[]).includes("evolved")) || dtus[0];
  if (!target) return { ok: false, note: "no target" };

  const tags = new Set(target.tags || []);
  tags.add("evolved");
  updateDTU(target.id, { tags: Array.from(tags) });

  // Also create a tiny "evolution delta" DTU to show visible progress
  const delta = createDTU({
    title: `Evolution Delta: ${target.meta?.title || target.id}`,
    content: `EvolutionOS marked DTU as evolved.\nTarget lineage: ${target.lineageHash}\nTime: ${nowISO()}`,
    tags: ["evolution", "delta"],
    source: "evolution",
    parents: [target.id]
  });

  appendEvent("evolution.ran", { target: target.id, delta: delta.id });
  return { ok: true, targetId: target.id, deltaId: delta.id };
}

// ------------------------------
// Autogen (creates new DTU)
// ------------------------------
async function autogenStep() {
  const oai = await getOpenAI();
  let content = `Autogen (v1): propose a missing angle.\nTime: ${nowISO()}`;
  if (oai) {
    try {
      const resp = await oai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "Generate one useful DTU idea for Concord. Short, structured." },
          { role: "user", content: "Generate a novel DTU that adds a useful OS layer or feature idea. Include constraints and next step." }
        ],
        temperature: 0.6
      });
      content = resp?.choices?.[0]?.message?.content?.slice(0, 6000) || content;
    } catch {}
  }
  const dtu = createDTU({ title: "Autogen DTU", content, tags: ["autogen"], source: "autogen" });
  appendEvent("autogen.ran", { dtuId: dtu.id });
  return { ok: true, dtuId: dtu.id };
}

// ------------------------------
// Ingest queue processing
// ------------------------------
async function processIngestQueue(maxItems = 1) {
  let created = 0;
  const items = queues.ingest.splice(0, maxItems);
  for (const it of items) {
    const out = await cretiFromText({
      title: it.title || "Ingest",
      text: it.text || "",
      tags: it.tags || ["ingest"],
      source: "ingest",
      url: "",
      declaredSourceType: it.declaredSourceType || "open",
      makeGlobal: !!it.makeGlobal
    });
    if (out.ok) created += (1 + (out.children?.length || 0));
  }
  writeJSON(FILES.queues, queues);
  appendEvent("ingest.processed", { items: items.length, created });
  return { ok: true, items: items.length, created };
}

// ------------------------------
// Autocrawl queue processing
// ------------------------------
async function processAutocrawlQueue(maxItems = 1) {
  let created = 0;
  const items = queues.autocrawl.splice(0, maxItems);
  for (const it of items) {
    const out = await crawlUrlToCretis({
      url: it.url,
      declaredSourceType: it.declaredSourceType || "open",
      makeGlobal: !!it.makeGlobal,
      tags: it.tags || []
    });
    if (out?.ok) {
      created += 1 + ((out.children && out.children.length) ? out.children.length : 0);
    }
  }
  writeJSON(FILES.queues, queues);
  appendEvent("autocrawl.processed", { items: items.length, created });
  return { ok: true, items: items.length, created };
}

// ------------------------------
// Governor Tick (Central)
// ------------------------------
async function governorTick() {
  governor.lastTick = nowISO();
  const i = settings.intervals;

  const results = {};

  if (jobEnabled("dream") && canRun("dream", i.dreamCooldownMs)) {
    results.dream = await dreamStep();
    governor.lastRun.dream = nowISO();
  }

  if (jobEnabled("evolution") && canRun("evolution", i.evolutionCooldownMs)) {
    results.evolution = await evolutionStep();
    governor.lastRun.evolution = nowISO();
  }

  if (jobEnabled("autogen") && canRun("autogen", i.autogenCooldownMs)) {
    results.autogen = await autogenStep();
    governor.lastRun.autogen = nowISO();
  }

  if (jobEnabled("ingest") && queues.ingest.length && canRun("ingest", i.ingestCooldownMs)) {
    results.ingest = await processIngestQueue(1);
    governor.lastRun.ingest = nowISO();
  }

  if (jobEnabled("autocrawl") && queues.autocrawl.length && canRun("autocrawl", i.autocrawlCooldownMs)) {
    results.autocrawl = await processAutocrawlQueue(1);
    governor.lastRun.autocrawl = nowISO();
  }

  governor.lastResult = results;
  appendEvent("governor.tick", { results, queues: { ingest: queues.ingest.length, autocrawl: queues.autocrawl.length } });
  return results;
}

function startGovernor() {
  const ms = settings?.intervals?.heartbeatMs || 120000;
  console.log(`[Governor] Started. Heartbeat interval: ${ms}ms`);
  setInterval(() => governorTick().catch(e => console.error("[GovernorTick]", e)), ms);
}
if (jobEnabled("heartbeat")) startGovernor();

// --------------------------------------------------
// OS Stack state (exists; toggles are local-first)
// --------------------------------------------------
let osState = {
  realityOS: true,
  sensemakingOS: true,
  perceptionOS: true,
  temporalOS: true,
  swarmOS: true,
  evolutionOS: true,
  governanceOS: true,
  selfRepairOS: true,
  marketplaceOS: true,
  globalOS: true,
  personaOS: true,
  councilOS: true,
  ingestOS: true,
  crawlOS: true,
  dreamOS: true
};

// --------------------------------------------------
// Express app
// --------------------------------------------------
const app = express();
app.use(cors({ origin: [FRONTEND_ORIGIN], credentials: true }));
app.use(express.json({ limit: "6mb" }));

// If you have a server/public folder, it will serve it.
// If not, /api still works fine.
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) app.use(express.static(publicDir));

// ------------------------------
// Status
// ------------------------------
app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    service: "ConcordOS",
    version: "Concord v1 — Unified Monolith",
    port: PORT,
    osState,
    jobs: settings.jobs,
    intervals: settings.intervals,
    governor,
    queues: { ingest: queues.ingest.length, autocrawl: queues.autocrawl.length },
    counts: {
      dtus: dtus.length,
      simulations: simulations.length,
      listings: marketplaceListings.length,
      wallets: creditsLedger.length,
      events: events.length,
    },
    macro: { domains: LayerRegistry.domains, recipes: Object.keys(LayerRegistry.recipes) },
    llm: { enabled: !!OPENAI_API_KEY, model: OPENAI_MODEL }
  });
});

// ------------------------------
// Jobs
// ------------------------------
app.get("/api/jobs/status", (req, res) => {
  res.json({
    ok: true,
    jobs: settings.jobs,
    intervals: settings.intervals,
    governor,
    queues: { ingest: queues.ingest.length, autocrawl: queues.autocrawl.length },
    llm: { enabled: !!OPENAI_API_KEY, model: OPENAI_MODEL }
  });
});

app.post("/api/jobs/toggle", (req, res) => {
  const { job, enabled } = req.body || {};
  const j = String(job || "").trim();
  if (!j || typeof enabled !== "boolean") return res.status(400).json({ ok: false, error: "job + enabled(boolean) required" });
  settings.jobs = settings.jobs || {};
  settings.jobs[j] = settings.jobs[j] || { enabled: true };
  settings.jobs[j].enabled = enabled;
  writeJSON(FILES.settings, settings);
  appendEvent("jobs.toggled", { job: j, enabled });
  res.json({ ok: true, job: j, enabled });
});

// ------------------------------
// DTUs
// ------------------------------
app.get("/api/dtus", (req, res) => res.json({ ok: true, dtus }));
app.post("/api/dtus", (req, res) => {
  const { title, content, tags, source, parents, isGlobal, meta, declaredSourceType = "open" } = req.body || {};

  // If user tries to force GLOBAL here, gate it.
  let makeGlobal = !!isGlobal;
  if (makeGlobal) {
    const gate = councilGateGlobal({ declaredSourceType, url: meta?.url || "" });
    if (!gate.ok) {
      makeGlobal = false;
      return res.status(403).json({ ok: false, error: gate.reason, localAllowed: true });
    }
  }

  const dtu = createDTU({ title, content, tags, source, parents, isGlobal: makeGlobal, meta: { ...(meta||{}), declaredSourceType } });
  res.json({ ok: true, dtu });
});
app.patch("/api/dtus/:id", (req, res) => {
  const updated = updateDTU(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, error: "DTU not found" });
  res.json({ ok: true, dtu: updated });
});

// ------------------------------
// Manual Ingest (B/B full CRETI)
// ------------------------------
app.post("/api/ingest", async (req, res) => {
  const { text, title, tags = [], makeGlobal = false, declaredSourceType = "open" } = req.body || {};
  // Manual ingest can be immediate (no queue) to feel responsive
  const out = await cretiFromText({
    title: title || "Manual Ingest",
    text: text || "",
    tags: Array.isArray(tags) ? tags : ["ingest"],
    source: "ingest",
    declaredSourceType,
    makeGlobal: !!makeGlobal
  });
  if (!out.ok) return res.status(400).json(out);
  res.json({ ok: true, parentId: out.parent?.id, created: 1 + (out.children?.length || 0), children: out.children?.map(d=>d.id) || [], globalId: out.globalDTU?.id || null });
});

// Queue ingest (auto)
app.post("/api/ingest/queue", (req, res) => {
  const { text, title, tags = [], makeGlobal = false, declaredSourceType = "open" } = req.body || {};
  if (!String(text || "").trim()) return res.status(400).json({ ok: false, error: "text required" });
  queues.ingest.push({ id: uuidv4(), text, title, tags, makeGlobal: !!makeGlobal, declaredSourceType, at: nowISO() });
  writeJSON(FILES.queues, queues);
  appendEvent("ingest.queued", { len: queues.ingest.length });
  res.json({ ok: true, queued: true, queueLength: queues.ingest.length });
});

// ------------------------------
// Autocrawl (manual) — creates REAL DTUs (not hollow)
// ------------------------------
app.post("/api/autocrawl", async (req, res) => {
  const { url, makeGlobal = false, declaredSourceType = "open", tags = [] } = req.body || {};
  const out = await crawlUrlToCretis({ url, declaredSourceType, makeGlobal: !!makeGlobal, tags });
  if (!out.ok) return res.status(400).json(out);
  const childrenCount = (out.children && out.children.length) ? out.children.length : 0;
  res.json({
    ok: true,
    parentId: out.parent?.id || null,
    children: out.children?.map(d=>d.id) || [],
    created: 1 + childrenCount,
    note: out.note || null
  });
});

// Queue crawl (auto)
app.post("/api/autocrawl/queue", (req, res) => {
  const { url, makeGlobal = false, declaredSourceType = "open", tags = [] } = req.body || {};
  if (!String(url || "").trim()) return res.status(400).json({ ok: false, error: "url required" });
  queues.autocrawl.push({ id: uuidv4(), url, makeGlobal: !!makeGlobal, declaredSourceType, tags, at: nowISO() });
  writeJSON(FILES.queues, queues);
  appendEvent("autocrawl.queued", { len: queues.autocrawl.length });
  res.json({ ok: true, queued: true, queueLength: queues.autocrawl.length });
});

// ------------------------------
// Chat (LLM optional) — answers by scanning DTUs + LLM
// ------------------------------
function topDTUsForQuery(q, n = 8) {
  const query = String(q || "").toLowerCase().trim();
  if (!query) return dtus.slice(0, n);
  // simple scoring: tag/title/content includes
  const scored = dtus.map(d => {
    const t = (d.meta?.title || "").toLowerCase();
    const c = (d.content || "").toLowerCase();
    const tags = (d.tags || []).join(" ").toLowerCase();
    let s = 0;
    if (t.includes(query)) s += 5;
    if (tags.includes(query)) s += 3;
    if (c.includes(query)) s += 1;
    return { d, s };
  }).sort((a,b)=>b.s-a.s);
  return scored.slice(0, n).map(x=>x.d);
}

async function llmAnswerWithDTUs(message, mode="overview") {
  const refs = topDTUsForQuery(message, 10);
  const context = refs.map((d,i)=>`[DTU ${i+1}] ${d.meta?.title}\nTags: ${(d.tags||[]).join(", ")}\n${String(d.content||"").slice(0, 1200)}`).join("\n\n");
  const oai = await getOpenAI();
  if (!oai) {
    return {
      reply: `LLM not configured. Here are top DTUs:\n\n${refs.map(r=>`- ${r.meta?.title}`).join("\n")}`,
      cue: personaCue("talk"),
      refs: refs.map(r=>({ id:r.id, title:r.meta?.title, lineageHash:r.lineageHash })),
      macro: runMacro("HYPOTHESIS_PIPELINE", { mode, offline: true })
    };
  }

  const resp = await oai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: "You are Concord. Use DTU context. Be concise but helpful. If unsure, say so." },
      { role: "user", content: `MODE: ${mode}\nUSER QUESTION: ${message}\n\nDTU CONTEXT:\n${context}` }
    ],
    temperature: 0.4
  });

  const reply = resp?.choices?.[0]?.message?.content || "";
  return {
    reply,
    cue: personaCue("talk"),
    refs: refs.map(r=>({ id:r.id, title:r.meta?.title, lineageHash:r.lineageHash })),
    macro: runMacro("HYPOTHESIS_PIPELINE", { mode, offline: false })
  };
}

app.post("/api/chat", async (req, res) => {
  const { message, mode = "overview" } = req.body || {};
  const out = await llmAnswerWithDTUs(String(message||""), mode);
  appendEvent("chat", { mode, chars: (message || "").length });
  res.json({ ok: true, ...out });
});

// Back-compat alias (your clients posting to /api/ask)
app.post("/api/ask", async (req, res) => {
  const { message, mode = "overview" } = req.body || {};
  const out = await llmAnswerWithDTUs(String(message||""), mode);
  appendEvent("ask", { mode, chars: (message || "").length });
  res.json({ ok: true, ...out });
});

// ------------------------------
// Forge / CRETI (manual create)
// ------------------------------
app.post("/api/forge", (req, res) => {
  const { title, content, tags = [], source = "forge" } = req.body || {};
  const dtu = createDTU({ title: title || "Forge DTU", content, tags: ["forge", ...tags], source });
  res.json({ ok: true, dtu, cue: personaCue("emphasize") });
});

// ------------------------------
// Simulation
// ------------------------------
app.get("/api/simulations", (req, res) => res.json({ ok: true, simulations }));
app.post("/api/simulations/whatif", (req, res) => {
  const sim = runWhatIf(req.body || {});
  res.json({ ok: true, simulation: sim, cue: personaCue("thinking") });
});

// ------------------------------
// Personas / Council
// ------------------------------
app.get("/api/personas", (req, res) => res.json({ ok: true, personas }));

async function councilDebate({ dtuA, dtuB, topic }) {
  const prompt = topic || "Debate two DTUs, preserve both, synthesize a third.";
  const turns = personas.map((p, i) => ({
    personaId: p.id,
    personaName: p.name,
    text: `(${p.name}) Debate lens: ${p.style}\nTopic: ${prompt}\n(Stub text if LLM disabled)`,
    cue: personaCue(i % 2 === 0 ? "talk" : "thinking"),
  }));

  // Optional LLM to improve debate + synthesis
  const oai = await getOpenAI();
  let synthesis = `SYNTHESIS (v1):\n- Keep A and B accessible.\n- Create C that reconciles contradictions where possible.\n- Label unresolved tensions.\n`;
  if (oai) {
    try {
      const resp = await oai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "You run a short council debate then output a synthesis." },
          { role: "user", content: `Topic: ${prompt}\nDTU A:\n${dtuA?.content || ""}\nDTU B:\n${dtuB?.content || ""}\nReturn a short synthesis with labeled tensions.` }
        ],
        temperature: 0.5
      });
      synthesis = resp?.choices?.[0]?.message?.content?.slice(0, 6000) || synthesis;
    } catch {}
  }

  return { prompt, turns, synthesis, cue: personaCue("emphasize") };
}

app.post("/api/council/debate", async (req, res) => {
  const { dtuA, dtuB, topic } = req.body || {};
  const out = await councilDebate(req.body || {});
  const parentIds = [dtuA?.id || dtuA, dtuB?.id || dtuB].filter(Boolean);

  const dtuC = createDTU({
    title: "Council Synthesis",
    content: out.synthesis,
    tags: ["council", "synthesis"],
    source: "council",
    parents: parentIds,
    meta: { topic: topic || "" },
  });
  appendEvent("council.debate", { parents: parentIds, synthesisId: dtuC.id });
  res.json({ ok: true, debate: out, synthesisDTU: dtuC });
});

// Persona speak / animate (cue protocol)
app.post("/api/personas/:id/speak", (req, res) => {
  const p = personas.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ ok: false, error: "Persona not found" });
  const { text } = req.body || {};
  const out = {
    ok: true,
    persona: p,
    text: String(text || ""),
    cue: personaCue("talk"),
    speech: { engine: "browser_speechsynthesis", voiceHint: p.name, rate: 1.0, pitch: 1.0 },
  };
  appendEvent("persona.speak", { personaId: p.id, chars: out.text.length });
  res.json(out);
});

app.post("/api/personas/:id/animate", (req, res) => {
  const { kind = "talk" } = req.body || {};
  const p = personas.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ ok: false, error: "Persona not found" });
  res.json({ ok: true, persona: p, cue: personaCue(kind) });
});

// ------------------------------
// Swarm
// ------------------------------
const swarmLenses = [
  "Structural", "Ethical", "Practical", "Pattern", "Edge cases", "Second-order effects", "Failure modes", "Opportunities"
];

function swarmRun(prompt, count = 6) {
  const selected = swarmLenses.slice(0, Math.max(3, Math.min(count, swarmLenses.length)));
  const agents = selected.map((lens) => ({
    id: uuidv4(),
    lens,
    output: `(${lens}) Signals on: ${prompt}\n- key bullets\n- constraints\n- next actions`,
  }));
  const synthesis = `SWARM SYNTHESIS (v1):\n` + agents.map(a => `- [${a.lens}] ${a.output.split("\n")[1] || "signal"}`).join("\n");
  return { agents, synthesis, cue: personaCue("talk") };
}

app.post("/api/swarm/run", (req, res) => {
  const { prompt, count } = req.body || {};
  const out = swarmRun(String(prompt || ""), Number(count || 6));
  appendEvent("swarm.run", { chars: (prompt || "").length, agents: out.agents.length });
  res.json({ ok: true, ...out });
});

// ------------------------------
// Credits
// ------------------------------
app.post("/api/credits/wallet", (req, res) => {
  const { walletId } = req.body || {};
  if (!walletId) return res.status(400).json({ ok: false, error: "walletId required" });
  res.json({ ok: true, wallet: getOrCreateWallet(walletId) });
});
app.post("/api/credits/earn", (req, res) => {
  const { walletId, amount = 1, reason = "quest" } = req.body || {};
  if (!walletId) return res.status(400).json({ ok: false, error: "walletId required" });
  res.json({ ok: true, wallet: creditWallet(walletId, Number(amount || 0), reason) });
});
app.post("/api/credits/spend", (req, res) => {
  const { walletId, amount = 1, reason = "spend" } = req.body || {};
  if (!walletId) return res.status(400).json({ ok: false, error: "walletId required" });
  const out = debitWallet(walletId, Number(amount || 0), reason);
  res.json(out.ok ? { ok: true, wallet: out.wallet } : out);
});

// ------------------------------
// Marketplace (visible; coming soon)
// ------------------------------
app.get("/api/marketplace/listings", (req, res) => {
  res.json({
    ok: true,
    message: "Marketplace coming soon — can’t spoil the fun 😉",
    listings: marketplaceListings
  });
});

// ------------------------------
// Global stub (visible; consent-first later)
// ------------------------------
app.get("/api/global/feed", (req, res) => {
  res.json({
    ok: true,
    message: "Global is visible in v1 but consent-first sync is v2+. Local-first is always available.",
    cue: personaCue("thinking"),
  });
});

// ------------------------------
// Macro runner
// ------------------------------
app.post("/api/macros/run", (req, res) => {
  const { recipeName, ctx } = req.body || {};
  const out = runMacro(String(recipeName || ""), ctx || {});
  appendEvent("macro.run", { recipeName });
  res.json({ ok: true, ...out });
});

// ------------------------------
// Events
// ------------------------------
app.get("/api/events", (req, res) => res.json({ ok: true, events: events.slice(-500).reverse() }));

// ------------------------------
// Additional Frontend Lens Endpoints
// ------------------------------

// Resonance quick status for Topbar
app.get("/api/resonance/quick", (req, res) => {
  res.json({
    ok: true,
    coherence: 0.87,
    dtuCount: dtus.length,
    activePersonas: personas.filter(p => p.active !== false).length,
  });
});

// Notifications count
app.get("/api/notifications/count", (req, res) => {
  res.json({ ok: true, count: events.filter(e => !e.read).length % 20 });
});

// Board/Kanban tasks
const boardTasks = [];
app.get("/api/board/tasks", (req, res) => res.json({ ok: true, tasks: boardTasks }));
app.post("/api/board/tasks", (req, res) => {
  const task = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
  boardTasks.push(task);
  res.json({ ok: true, task });
});

// Chemistry lens
app.get("/api/chem/compounds", (req, res) => {
  res.json({ ok: true, compounds: [
    { id: "h2o", name: "Water", formula: "H₂O", state: "liquid" },
    { id: "nacl", name: "Sodium Chloride", formula: "NaCl", state: "solid" },
    { id: "co2", name: "Carbon Dioxide", formula: "CO₂", state: "gas" },
  ]});
});
app.get("/api/chem/reactions", (req, res) => {
  res.json({ ok: true, reactions: [] });
});
app.post("/api/chem/react", (req, res) => {
  res.json({ ok: true, result: { products: [], energy: 0 } });
});

// Megas and Hypers (aggregated DTUs)
app.get("/api/megas", (req, res) => {
  const megas = dtus.filter(d => d.tier === "mega" || (d.children && d.children.length > 3));
  res.json({ ok: true, megas });
});
app.get("/api/hypers", (req, res) => {
  const hypers = dtus.filter(d => d.tier === "hyper" || (d.children && d.children.length > 10));
  res.json({ ok: true, hypers });
});

// Quests
const quests = [
  { id: "q1", title: "First Thought", description: "Create your first DTU", reward: 100, status: "available" },
  { id: "q2", title: "Council Assembly", description: "Run a council debate", reward: 250, status: "available" },
];
app.get("/api/quests", (req, res) => {
  const { status } = req.query;
  const filtered = status ? quests.filter(q => q.status === status) : quests;
  res.json({ ok: true, quests: filtered });
});
app.get("/api/quests/mine", (req, res) => {
  res.json({ ok: true, quests: quests.filter(q => q.status === "in_progress" || q.status === "completed") });
});

// News feed
app.get("/api/news", (req, res) => {
  res.json({ ok: true, articles: [
    { id: "n1", title: "System Online", category: "system", summary: "Concord is running", timestamp: new Date().toISOString() },
  ]});
});
app.get("/api/news/trending", (req, res) => {
  res.json({ ok: true, trending: ["AI", "Cognition", "DTUs", "Resonance"] });
});

// Bio systems
app.get("/api/bio/systems", (req, res) => {
  res.json({ ok: true, systems: [
    { id: "nervous", name: "Nervous System", health: 0.95 },
    { id: "immune", name: "Immune System", health: 0.88 },
    { id: "metabolic", name: "Metabolic System", health: 0.92 },
  ]});
});

// Growth status and organs
app.get("/api/growth/status", (req, res) => {
  res.json({ ok: true, stage: "expanding", growth_rate: 0.03, health: 0.91 });
});
app.get("/api/growth/organs", (req, res) => {
  res.json({ ok: true, organs: [
    { id: "memory", name: "Memory Cortex", active: true, load: 0.45 },
    { id: "reasoning", name: "Reasoning Engine", active: true, load: 0.62 },
    { id: "creativity", name: "Creative Module", active: true, load: 0.38 },
  ]});
});
app.get("/api/growth", (req, res) => {
  res.json({ ok: true, level: 7, xp: 2450, nextLevel: 3000 });
});

// Lab experiments
app.get("/api/lab/experiments", (req, res) => {
  res.json({ ok: true, experiments: [] });
});
app.post("/api/lab/run", (req, res) => {
  const exp = { id: uuidv4(), ...req.body, status: "running", startedAt: new Date().toISOString() };
  res.json({ ok: true, experiment: exp });
});

// Game/gamification
app.get("/api/game/profile", (req, res) => {
  res.json({ ok: true, profile: { level: 5, xp: 1250, title: "Thought Weaver" } });
});
app.get("/api/game/achievements", (req, res) => {
  res.json({ ok: true, achievements: [
    { id: "a1", name: "First Steps", unlocked: true },
    { id: "a2", name: "Deep Thinker", unlocked: false },
  ]});
});
app.get("/api/game/leaderboard", (req, res) => {
  res.json({ ok: true, leaderboard: [] });
});
app.get("/api/game/challenges", (req, res) => {
  res.json({ ok: true, challenges: [] });
});

// Docs
app.get("/api/docs", (req, res) => {
  res.json({ ok: true, docs: [
    { id: "intro", title: "Introduction", content: "Welcome to Concord" },
    { id: "dtus", title: "DTUs", content: "Discrete Thought Units are the core data structure" },
  ]});
});

// State
app.get("/api/state/latest", (req, res) => {
  res.json({ ok: true, state: { dtus: dtus.length, events: events.length, uptime: process.uptime() } });
});

// Custom lenses
app.get("/api/lenses/custom", (req, res) => res.json({ ok: true, lenses: [] }));
app.get("/api/lenses/templates", (req, res) => res.json({ ok: true, templates: [] }));
app.post("/api/lenses/custom", (req, res) => {
  res.json({ ok: true, lens: { id: uuidv4(), ...req.body } });
});

// Finance
app.get("/api/finance/portfolio", (req, res) => {
  res.json({ ok: true, portfolio: { total: 10000, change: 2.5 } });
});
app.get("/api/finance/transactions", (req, res) => {
  res.json({ ok: true, transactions: [] });
});
app.get("/api/economy/status", (req, res) => {
  res.json({ ok: true, economy: { inflation: 0.02, growth: 0.03 } });
});

// Physics simulation
let physicsRunning = false;
app.get("/api/physics/simulation", (req, res) => {
  res.json({ ok: true, running: physicsRunning, particles: [], time: 0 });
});
app.post("/api/physics/toggle", (req, res) => {
  physicsRunning = req.body.running ?? !physicsRunning;
  res.json({ ok: true, running: physicsRunning });
});
app.post("/api/physics/reset", (req, res) => {
  physicsRunning = false;
  res.json({ ok: true, reset: true });
});
app.post("/api/physics/params", (req, res) => {
  res.json({ ok: true, params: req.body });
});

// Fractal/lattice
app.get("/api/lattice/fractal", (req, res) => {
  res.json({ ok: true, depth: 5, nodes: dtus.length, complexity: 0.73 });
});

// ML endpoints
app.get("/api/ml/models", (req, res) => {
  res.json({ ok: true, models: [
    { id: "m1", name: "Classifier-v1", type: "classification", status: "ready", accuracy: 0.92 },
    { id: "m2", name: "Regressor-v1", type: "regression", status: "ready", accuracy: 0.88 },
  ]});
});
app.get("/api/ml/jobs", (req, res) => {
  res.json({ ok: true, jobs: [], active: 0 });
});
app.get("/api/ml/metrics", (req, res) => {
  res.json({ ok: true, gpuUsage: 0, memoryUsage: 45 });
});
app.post("/api/ml/infer", (req, res) => {
  res.json({ ok: true, prediction: { label: "positive", confidence: 0.87 } });
});
app.post("/api/ml/train/:modelId", (req, res) => {
  res.json({ ok: true, jobId: uuidv4(), status: "queued" });
});

// Music
app.get("/api/music/current", (req, res) => {
  res.json({ ok: true, track: null, playing: false });
});
app.get("/api/music/queue", (req, res) => {
  res.json({ ok: true, queue: [] });
});
app.get("/api/music/playlists", (req, res) => {
  res.json({ ok: true, playlists: [] });
});
app.post("/api/music/toggle", (req, res) => {
  res.json({ ok: true, playing: false });
});

// Metrics
app.get("/api/metrics", (req, res) => {
  res.json({ ok: true, coherence: 0.85, entropy: 0.12, resonance: 0.91 });
});

// Papers
app.get("/api/papers/tags", (req, res) => {
  res.json({ ok: true, tags: ["research", "notes", "ideas"] });
});
app.post("/api/papers", (req, res) => {
  res.json({ ok: true, paper: { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() } });
});

// AR
app.get("/api/ar/status", (req, res) => {
  res.json({ ok: true, available: false, device: null });
});
app.get("/api/ar/layers", (req, res) => {
  res.json({ ok: true, layers: [] });
});

// Anonymous messaging
app.get("/api/anon/messages", (req, res) => {
  res.json({ ok: true, messages: [] });
});
app.get("/api/anon/identity", (req, res) => {
  res.json({ ok: true, identity: { pseudonym: "Anon-" + Math.random().toString(36).slice(2, 8) } });
});
app.post("/api/anon/send", (req, res) => {
  res.json({ ok: true, sent: true });
});
app.post("/api/anon/rotate", (req, res) => {
  res.json({ ok: true, newIdentity: { pseudonym: "Anon-" + Math.random().toString(36).slice(2, 8) } });
});

// ------------------------------
// Fallback: serve UI if index exists
// ------------------------------
app.get("*", (req, res) => {
  const idx = path.join(publicDir, "index.html");
  if (fs.existsSync(idx)) return res.sendFile(idx);
  res.status(404).json({ ok: false, error: "Not found" });
});

app.listen(PORT, () => console.log(`Concord v1 running on http://localhost:${PORT}`));
