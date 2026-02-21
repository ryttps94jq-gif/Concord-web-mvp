/**
 * Macro Executor — Worker thread that runs CPU-intensive macros off the main thread.
 *
 * Each worker maintains a read-only STATE snapshot synced from the main thread.
 * Heavy macros (search, hypothesis, pipeline stages, etc.) run here so the
 * main thread stays responsive for HTTP.
 *
 * Results are returned to the main thread which applies any STATE mutations.
 */

import { parentPort, workerData } from "node:worker_threads";
import { runMacroIsolated, syncSnapshot } from "./macro-runtime.js";

const workerId = workerData?.workerId ?? -1;

parentPort.on("message", async (msg) => {
  if (msg.type === "state-sync") {
    syncSnapshot(msg.state);
    return;
  }

  if (msg.type === "exec") {
    try {
      const result = await runMacroIsolated(
        msg.domain,
        msg.name,
        msg.input || {},
        msg.actorInfo || {},
      );
      parentPort.postMessage({ type: "exec-result", result });
    } catch (err) {
      parentPort.postMessage({ type: "exec-result", error: err.message });
    }
    return;
  }

  if (msg.type === "shutdown") {
    process.exit(0);
  }
});

parentPort.postMessage({ type: "ready", workerId });
