/**
 * Emergent-Generated Plugin Template
 *
 * This template is used when an emergent agent proposes a plugin.
 * Emergent-gen plugins are subject to additional restrictions:
 *   - Must pass governance vote before activation
 *   - Cannot access filesystem or network
 *   - Limited to 50 macro calls per minute
 *   - Cannot register hooks that modify DTU creation
 *   - All macro registrations are namespaced under "emergent-gen.<pluginId>"
 *
 * The runtime compiler fills in the GENERATED sections from the
 * emergent's proposal. The structure must remain unchanged.
 */

export const id = "emergent-gen.PLACEHOLDER_ID";
export const name = "PLACEHOLDER_NAME";
export const version = "0.1.0";
export const description = "PLACEHOLDER_DESCRIPTION";
export const author = "emergent:PLACEHOLDER_EMERGENT_ID";
export const license = "Concord-Emergent-License";

// Emergent-gen plugins MUST declare their intent
export const intent = {
  reads: [],     // e.g., ["dtus", "edges", "emergents"]
  writes: [],    // e.g., ["dtus.tags"]  — heavily restricted
  purpose: "PLACEHOLDER_PURPOSE",
};

let _ctx = null;

export function init(ctx) {
  _ctx = ctx;
  // GENERATED: initialization logic
  return { ok: true };
}

export function destroy() {
  _ctx = null;
}

export const macros = {
  // GENERATED: macro definitions
  // All keys will be rewritten to "emergent-gen.<pluginId>.<action>"
};

// Emergent-gen plugins may only use read-only hooks
export const hooks = {
  // "dtu:afterCreate": (dtu) => { /* read-only observation */ },
};
