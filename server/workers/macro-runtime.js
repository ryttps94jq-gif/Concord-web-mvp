/**
 * Macro Runtime — Isolated macro execution environment for worker threads.
 *
 * Workers can't access the main thread's MACROS registry or STATE directly.
 * Instead, this module:
 *   1. Maintains a hydrated STATE snapshot (read-only, periodically synced)
 *   2. Imports specific heavy-computation modules directly
 *   3. Routes macro calls to the appropriate module function
 *
 * This is intentionally limited — only macros that are safe to run in isolation
 * (read-heavy, no STATE writes) are supported. Write operations return results
 * that the main thread applies.
 */

import { runPipeline, ensurePipelineState } from "../emergent/autogen-pipeline.js";

let _snapshot = null;

/**
 * Update the STATE snapshot from main thread.
 */
export function syncSnapshot(snapshot) {
  if (!snapshot) return;
  _snapshot = {
    dtus: new Map(snapshot.dtus || []),
    shadowDtus: new Map(snapshot.shadowDtus || []),
    settings: snapshot.settings || {},
    _autogenPipeline: snapshot.pipelineState || null,
    _governanceConfig: snapshot.governanceConfig || null,
    // Read-only indices for search operations
    emergents: snapshot.emergents ? new Map(snapshot.emergents) : new Map(),
    sessions: snapshot.sessions ? new Map(snapshot.sessions) : new Map(),
  };
}

/**
 * Run a macro in isolation using the snapshot.
 * Returns the result; any new DTUs or modifications are returned as data
 * for the main thread to merge.
 */
export async function runMacroIsolated(domain, name, input, actorInfo) {
  if (!_snapshot) {
    throw new Error("worker_no_snapshot: STATE not yet synced");
  }

  const key = `${domain}.${name}`;

  // Route to known heavy operations
  switch (key) {
    // ── Pipeline operations ──────────────────────────────────────────────────
    case "system.autogen":
      return runIsolatedPipeline(null, input);

    case "system.dream":
      return runIsolatedPipeline("dream", input);

    case "system.evolution":
      return runIsolatedPipeline("evolution", input);

    case "system.synthesize":
      return runIsolatedPipeline("synth", input);

    // ── Search operations (read-only on snapshot) ────────────────────────────
    case "search.query":
    case "search.semantic":
      return runIsolatedSearch(input);

    // ── DTU analysis (read-only) ─────────────────────────────────────────────
    case "dtu.cluster":
      return runIsolatedCluster(input);

    default:
      // For unrecognized heavy macros, return an error so main thread falls back
      throw new Error(`worker_unsupported_macro: ${key}`);
  }
}

// ── Isolated Pipeline ────────────────────────────────────────────────────────

async function runIsolatedPipeline(variant, input) {
  ensurePipelineState(_snapshot);

  const opts = { variant };
  if (input?.seed) opts.seed = input.seed;

  const result = await runPipeline(_snapshot, opts);
  return {
    ok: result?.ok || false,
    candidate: result?.candidate || null,
    trace: result?.trace || null,
    writePolicy: result?.writePolicy || null,
    pipelineStateDelta: _snapshot._autogenPipeline,
    _workerResult: true,
  };
}

// ── Isolated Search ──────────────────────────────────────────────────────────

function runIsolatedSearch(input) {
  const query = (input?.q || input?.query || "").toLowerCase();
  if (!query) return { ok: true, results: [], total: 0 };

  const results = [];
  for (const [id, dtu] of _snapshot.dtus) {
    const title = (dtu.title || "").toLowerCase();
    const summary = (dtu.human?.summary || "").toLowerCase();
    const tags = (dtu.tags || []).join(" ").toLowerCase();

    if (title.includes(query) || summary.includes(query) || tags.includes(query)) {
      results.push({ id, title: dtu.title, score: title.includes(query) ? 1.0 : 0.5 });
    }
    if (results.length >= (input?.limit || 50)) break;
  }

  return { ok: true, results, total: results.length, _workerResult: true };
}

// ── Isolated Cluster ─────────────────────────────────────────────────────────

function runIsolatedCluster(input) {
  // Basic clustering by tags — the full implementation runs on main thread
  const threshold = input?.threshold || 0.38;
  const clusters = new Map();

  for (const [id, dtu] of _snapshot.dtus) {
    const key = (dtu.tags || []).sort().join(",") || "untagged";
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(id);
  }

  const clusterResults = [];
  for (const [key, ids] of clusters) {
    if (ids.length >= 2) {
      clusterResults.push({ tags: key.split(","), count: ids.length, dtuIds: ids.slice(0, 10) });
    }
  }

  return { ok: true, clusters: clusterResults, total: clusterResults.length, _workerResult: true };
}
