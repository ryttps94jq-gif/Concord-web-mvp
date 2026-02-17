// ---- macro registry ----
/**
 * Macros are deterministic callable blocks.
 * Signature: async (ctx, input) => output
 * ctx provides access to state, helpers, llm, and macro runner.
 */
const MACROS = new Map(); // domain -> Map(name -> fn)

function register(domain, name, fn, spec={}) {
  if (!MACROS.has(domain)) MACROS.set(domain, new Map());
  MACROS.get(domain).set(name, { fn, spec: { domain, name, ...spec } });
}

function listDomains() { return Array.from(MACROS.keys()).sort(); }
function listMacros(domain) {
  const d = MACROS.get(domain);
  if (!d) return [];
  return Array.from(d.values()).map(x => x.spec);
}

/**
 * Create a runMacro function bound to the given dependencies.
 * deps must provide: { inLatticeReality, _c2log, _c2founderOverrideAllowed, STATE }
 */
function createRunMacro(deps) {
  const { inLatticeReality, _c2log, _c2founderOverrideAllowed } = deps;

  return function runMacro(domain, name, input, ctx) {
    // v3: permissioned cognition (macro-level ACL). Defaults open for local-first dev.
    const actor = ctx?.actor || { role: "owner", scopes: ["*"] };
    if (typeof globalThis.canRunMacro === "function" && !globalThis.canRunMacro(actor, domain, name)) {
      throw new Error(`forbidden: ${domain}.${name}`);
    }

    // Chicken2: reality guard (full blast) with founder recovery valve
    // NOTE: Read-only DTU hydration must never be blocked (frontend boot path).
    const _path = ctx?.reqMeta?.path || "";
    const _method = (ctx?.reqMeta?.method || "").toUpperCase();

    const safeReadBypass =
      _method === "GET" && (
        // Absolute path-based safe reads (frontend boot must never be blocked)
        _path === "/api/status" ||
        _path.startsWith("/api/dtus") ||
        _path.startsWith("/api/dtu") ||
        _path.startsWith("/api/settings") ||
        _path.startsWith("/api/lens") ||
        _path.startsWith("/api/goals") ||
        _path.startsWith("/api/growth") ||
        _path.startsWith("/api/metrics") ||
        _path.startsWith("/api/resonance") ||
        _path.startsWith("/api/lattice") ||

        // Domain/name allowlist for read-only macros (covers alternate routers)
        (domain === "system" && (name === "status" || name === "getStatus")) ||
        (domain === "dtu" && (name === "list" || name === "get" || name === "search" || name === "recent" || name === "stats" || name === "count" || name === "export")) ||
        (domain === "settings" && (name === "get" || name === "status")) ||
        (domain === "lens" && (name === "list" || name === "get" || name === "export")) ||
        (domain === "goals" && (name === "list" || name === "get" || name === "status"))
      );

    if (!safeReadBypass) {
      const c2 = inLatticeReality({ type:"macro", domain, name, input, ctx });
      if (!c2.ok) {
        // Founder valve: allow explicit override for one call if actor is founder/owner and passes ?override=1 on reqMeta or input.override=true
        // Founder valve + safe-read bypass for frontend hydration (DTU/status reads)
        const reqPath = String(ctx?.reqMeta?.path || ctx?.reqMeta?.pathname || ctx?.reqMeta?.originalUrl || ctx?.reqMeta?.url || "");
        const reqMethod = String(ctx?.reqMeta?.method || "").toUpperCase();

        const safeReadBypass =
          reqMethod === "GET" && (
            reqPath === "/api/status" ||
            reqPath.startsWith("/api/dtus") ||
            reqPath.startsWith("/api/dtu") ||
            reqPath.startsWith("/api/settings") ||
            reqPath.startsWith("/api/lens") ||
            reqPath.startsWith("/api/goals") ||
            reqPath.startsWith("/api/growth") ||
            reqPath.startsWith("/api/metrics") ||
            reqPath.startsWith("/api/resonance") ||
            reqPath.startsWith("/api/lattice") ||

            // Domain/name allowlist for read-only macros (covers alternate routers)
            (domain === "system" && (name === "status" || name === "getStatus")) ||
            (domain === "dtu" && (name === "list" || name === "get" || name === "search" || name === "recent" || name === "stats" || name === "count" || name === "export")) ||
            (domain === "settings" && (name === "get" || name === "status")) ||
            (domain === "lens" && (name === "list" || name === "get" || name === "export")) ||
            (domain === "goals" && (name === "list" || name === "get" || name === "status"))
          );

        const internalTick =
          !ctx?.reqMeta && (ctx?.internal === true || ["system","owner","founder"].includes(String(ctx?.actor?.role || "")));
        const allowOverride =
          safeReadBypass ||
          internalTick ||
          (_c2founderOverrideAllowed(ctx) && (ctx?.reqMeta?.override === true || input?.override === true));
        _c2log("c2.guard", "inLatticeReality evaluated", { domain, name, ok: c2.ok, severity: c2.severity, reason: c2.reason, allowOverride });
        if (!allowOverride) {
          const err = new Error(`c2_guard_reject:${c2.reason}`);
          err.meta = { c2 };
          throw err;
        }
      }
    }

    const d = MACROS.get(domain);
    if (!d) throw new Error(`macro domain not found: ${domain}`);
    const m = d.get(name);
    if (!m) throw new Error(`macro not found: ${domain}.${name}`);
    return m.fn(ctx, input ?? {});
  };
}

export { MACROS, register, listDomains, listMacros, createRunMacro };
