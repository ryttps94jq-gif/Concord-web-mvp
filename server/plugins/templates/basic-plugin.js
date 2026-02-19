/**
 * Basic Plugin Template
 *
 * Copy this file to server/plugins/installed/<your-plugin-name>/index.js
 * and modify to suit your needs.
 *
 * Required exports:
 *   - id:          Unique plugin identifier (namespace.name format)
 *   - name:        Human-readable name
 *   - version:     SemVer string
 *   - description: What this plugin does
 *   - init(ctx):   Called once on load, receives sandboxed context
 *   - destroy():   Called on unload, clean up timers/listeners
 *
 * Optional exports:
 *   - macros:      { "domain.action": handler } — registered as macros
 *   - hooks:       { "dtu:afterCreate": handler } — lifecycle hooks
 *   - tick(ctx):   Called every heartbeat tick if present
 *   - author:      Attribution string
 *   - license:     SPDX license identifier
 */

export const id = "example.hello-world";
export const name = "Hello World";
export const version = "1.0.0";
export const description = "A minimal example plugin that logs on startup.";
export const author = "Concord";
export const license = "MIT";

let _ctx = null;

export function init(ctx) {
  _ctx = ctx;
  ctx.log("info", "Hello World plugin initialized!");
  return { ok: true };
}

export function destroy() {
  _ctx = null;
}

export const macros = {
  "hello.greet": (_macroCtx, input = {}) => {
    const who = input.name || "World";
    return { ok: true, message: `Hello, ${who}!` };
  },
};

export const hooks = {
  "dtu:afterCreate": (dtu) => {
    // Called after every DTU creation — lightweight only
  },
};

export function tick(ctx) {
  // Called on heartbeat tick — keep this fast
}
