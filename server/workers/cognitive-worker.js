/**
 * Cognitive Worker Thread — Runs CPU-intensive pipeline stages off the main thread.
 *
 * Architecture (Option A — Single Worker):
 *   Main Thread                          Cognitive Worker
 *       |                                     |
 *       |-- postMessage({type:'tick',...}) --> |
 *       |                                     |-- runPipeline(snapshot, {variant:'dream'})
 *       |   (serving HTTP freely)             |-- runPipeline(snapshot, {variant:null})    [autogen]
 *       |                                     |-- runPipeline(snapshot, {variant:'evolution'})
 *       |                                     |-- runPipeline(snapshot, {variant:'synth'})
 *       |<-- postMessage({type:'tick-result'})|
 *       |-- merge results into STATE          |
 *
 * The worker runs the 6-stage autogen pipeline for each cognitive task.
 * It operates on a serialized snapshot of STATE — never touches main-thread STATE directly.
 * Results are candidates + pipeline state deltas that the main thread merges.
 *
 * What stays on main thread:
 *   - DTU commits (via macro system)
 *   - Ingest queue processing
 *   - Bridge heartbeat tick
 *   - Plugin ticks
 *   - Local self-upgrade
 *   - Qualia hooks
 */

import { parentPort } from "node:worker_threads";
import { runPipeline, ensurePipelineState } from "../emergent/autogen-pipeline.js";

// ── LLM callback for Ollama (runs fetch from worker thread) ──────────────────

function makeOllamaCallback(ollamaConfig) {
  if (!ollamaConfig?.enabled || !ollamaConfig?.url) return null;

  return async (prompt, options = {}) => {
    const payload = {
      model: options.model || ollamaConfig.model || "llama3.2",
      prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.maxTokens || 800,
      },
    };
    if (options.system) payload.system = options.system;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch(`${ollamaConfig.url}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!res.ok) return { ok: false, error: `ollama_http_${res.status}` };
      const data = await res.json();
      return { ok: true, text: data.response || "", source: "ollama" };
    } catch (e) {
      clearTimeout(t);
      return { ok: false, error: e.message, source: "ollama" };
    }
  };
}

// ── Reconstruct STATE-like object from snapshot ──────────────────────────────

function hydrateSnapshot(snapshot) {
  return {
    dtus: new Map(snapshot.dtus),                       // [[id, dtu], ...]
    shadowDtus: new Map(snapshot.shadowDtus || []),
    settings: snapshot.settings || {},
    _autogenPipeline: snapshot.pipelineState || null,
    _governanceConfig: snapshot.governanceConfig || null,
  };
}

// ── Run all cognitive pipeline tasks ─────────────────────────────────────────

async function runCognitiveTick(msg) {
  const { snapshot, settings, ollamaConfig } = msg;

  const STATE = hydrateSnapshot(snapshot);
  ensurePipelineState(STATE);

  const callOllama = makeOllamaCallback(ollamaConfig);
  const results = {
    candidates: [],
    pipelineStateDelta: null,
    errors: [],
    timings: {},
  };

  const t0 = Date.now();

  // ── Autogen ────────────────────────────────────────────────────────────────
  if (settings.autogenEnabled) {
    const ts = Date.now();
    try {
      const r = await runPipeline(STATE, { callOllama });
      results.candidates.push({
        task: "autogen",
        ok: r?.ok || false,
        candidate: r?.candidate || null,
        trace: r?.trace || null,
        writePolicy: r?.writePolicy || null,
        error: r?.error || null,
      });
    } catch (e) {
      results.errors.push(`autogen: ${e.message}`);
    }
    results.timings.autogen = Date.now() - ts;
  }

  // ── Dream ──────────────────────────────────────────────────────────────────
  if (settings.dreamEnabled) {
    const ts = Date.now();
    try {
      const r = await runPipeline(STATE, {
        variant: "dream",
        callOllama,
        seed: "Concord heartbeat dream",
      });
      results.candidates.push({
        task: "dream",
        ok: r?.ok || false,
        candidate: r?.candidate || null,
        trace: r?.trace || null,
        writePolicy: r?.writePolicy || null,
        error: r?.error || null,
      });
    } catch (e) {
      results.errors.push(`dream: ${e.message}`);
    }
    results.timings.dream = Date.now() - ts;
  }

  // ── Evolution ──────────────────────────────────────────────────────────────
  if (settings.evolutionEnabled) {
    const ts = Date.now();
    try {
      const r = await runPipeline(STATE, {
        variant: "evolution",
        callOllama,
      });
      results.candidates.push({
        task: "evolution",
        ok: r?.ok || false,
        candidate: r?.candidate || null,
        trace: r?.trace || null,
        writePolicy: r?.writePolicy || null,
        error: r?.error || null,
      });
    } catch (e) {
      results.errors.push(`evolution: ${e.message}`);
    }
    results.timings.evolution = Date.now() - ts;
  }

  // ── Synthesize ─────────────────────────────────────────────────────────────
  if (settings.synthEnabled) {
    const ts = Date.now();
    try {
      const r = await runPipeline(STATE, {
        variant: "synth",
        callOllama,
      });
      results.candidates.push({
        task: "synthesize",
        ok: r?.ok || false,
        candidate: r?.candidate || null,
        trace: r?.trace || null,
        writePolicy: r?.writePolicy || null,
        error: r?.error || null,
      });
    } catch (e) {
      results.errors.push(`synthesize: ${e.message}`);
    }
    results.timings.synthesize = Date.now() - ts;
  }

  // Capture pipeline state delta for main thread to merge
  results.pipelineStateDelta = STATE._autogenPipeline;
  results.timings.total = Date.now() - t0;

  return results;
}

// ── Message Handler ──────────────────────────────────────────────────────────

let tickInProgress = false;

parentPort.on("message", async (msg) => {
  if (msg.type === "tick") {
    if (tickInProgress) {
      parentPort.postMessage({
        type: "tick-result",
        results: { candidates: [], errors: ["tick_skipped_already_running"], timings: {} },
      });
      return;
    }

    tickInProgress = true;
    try {
      const results = await runCognitiveTick(msg);
      parentPort.postMessage({ type: "tick-result", results });
    } catch (e) {
      parentPort.postMessage({
        type: "tick-result",
        results: { candidates: [], errors: [`fatal: ${e.message}`], timings: {} },
      });
    } finally {
      tickInProgress = false;
    }
  }

  if (msg.type === "shutdown") {
    process.exit(0);
  }
});

parentPort.postMessage({ type: "ready" });
