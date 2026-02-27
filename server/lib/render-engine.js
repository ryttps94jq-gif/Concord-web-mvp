/**
 * Render Engine — intercepts lens action output and converts to file artifacts.
 *
 * Architecture: one registry, one function.
 * Renderers register as "domain.action" → renderFn(artifact, actionResult).
 * renderAndAttach() looks up the renderer, generates the file, calls storeArtifact,
 * and attaches the ref to the DTU. Fire-and-forget from _lensEmitDTU.
 */

import { storeArtifact } from "./artifact-store.js";

const RENDERERS = new Map(); // "domain.action" → renderFn

/**
 * Register a renderer for a domain/action pair.
 * Use action="*" for a domain-level fallback.
 */
export function registerRenderer(domain, action, renderFn) {
  RENDERERS.set(`${domain}.${action}`, renderFn);
}

/**
 * Slugify a string for use as a filename.
 */
export function slugify(str) {
  return String(str || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Look up a renderer, generate the file, store it, and attach to the DTU.
 * Called fire-and-forget from _lensEmitDTU — never blocks DTU creation.
 */
export async function renderAndAttach(STATE, dtuId, domain, action, artifact, actionResult) {
  try {
    const renderer =
      RENDERERS.get(`${domain}.${action}`) ||
      RENDERERS.get(`${domain}.*`) ||
      null;

    if (!renderer) return { rendered: false };

    const { buffer, mimeType, filename } = await renderer(artifact, actionResult);
    if (!buffer || !mimeType || !filename) return { rendered: false };

    const ref = await storeArtifact(dtuId, buffer, mimeType, filename);

    // Attach to the DTU
    const dtu = STATE.dtus.get(dtuId);
    if (dtu) {
      dtu.artifact = ref;
      dtu.machine.rendered = true;
      dtu.machine.fileType = mimeType;
    }

    return { rendered: true, mimeType, sizeBytes: ref.sizeBytes };
  } catch {
    // Render failures are non-fatal — the DTU still exists without a file
    return { rendered: false };
  }
}

/**
 * Get the number of registered renderers (for diagnostics).
 */
export function getRendererCount() {
  return RENDERERS.size;
}

/**
 * Check if a renderer exists for a domain/action pair.
 */
export function hasRenderer(domain, action) {
  return RENDERERS.has(`${domain}.${action}`) || RENDERERS.has(`${domain}.*`);
}
