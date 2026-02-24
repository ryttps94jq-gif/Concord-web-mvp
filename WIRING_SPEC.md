# Backend Module Wiring Spec — Concord Cognitive Engine

> **Status**: Partially applied. See commit history for what's wired.

## CONTEXT

Concord has 108 emergent modules in `server/emergent/`. Most are fully implemented
but were NOT wired into the runtime. This spec documents the wiring pattern.

## WIRING PATTERN

```javascript
// In the heartbeat (server.js governorTick ~line 18700):
try { await someModuleTick(entityId); } catch {}

// Or at entity creation (emergent/store.js registerEmergent):
try { initializeModuleForEntity(entityId, entityData); } catch {}
```

Always wrap in `try/catch`. Never let a module crash the heartbeat.

## WIRED MODULES (Applied)

| # | Module | File | Wired Into | Status |
|---|--------|------|-----------|--------|
| 1 | Body Instantiation | body-instantiation.js | Entity creation + heartbeat | Pre-existing + enhanced |
| 2 | Sleep Consolidation | sleep-consolidation.js | Heartbeat | Pre-existing |
| 3 | Death Protocol | death-protocol.js | Heartbeat | Pre-existing |
| 4 | Relational Emotion | relational-emotion.js | Heartbeat + session.turn | **NEW** |
| 5 | Constitution | constitution.js | Macro execution pipeline | **NEW** |
| 6 | Species | species.js | Entity creation | Pre-existing + enhanced |
| 7 | Reproduction | reproduction.js | Registered as macro | **NEW** |
| 8 | Avoidance Learning | avoidance-learning.js | Heartbeat + macro errors | **NEW** |
| 9 | Drift Monitor | drift-monitor.js | Heartbeat | **NEW** |
| 10 | Subjective Time | subjective-time.js | Entity creation + heartbeat | **NEW** |
| 11 | Vulnerability Engine | vulnerability-engine.js | Heartbeat (every 5th tick) | **NEW** |
| 12 | Institutional Memory | institutional-memory.js | Heartbeat + macro writes | **NEW** |

## HEARTBEAT WIRING (governorTick)

After existing pipeline calls in `server/server.js` ~line 18740:

```
For each active entity:
  - tickEmotions (relational-emotion)
  - runDriftScan (drift-monitor)
  - recordTick (subjective-time)
  - tickWounds + decayAvoidances (avoidance-learning)

System-wide (every 5th tick):
  - assessAndAdapt (vulnerability-engine)

Every tick:
  - recordObservation (institutional-memory)
```

## MACRO PIPELINE WIRING (runMacro)

Before macro execution (write macros only):
- `checkRules` (constitution) — blocks if constitutional violation

After macro failure:
- `recordPain` (avoidance-learning) — learns from errors

After macro success (write macros):
- `recordObservation` (institutional-memory) — records decisions

## ENTITY CREATION WIRING (registerEmergent in store.js)

At entity registration:
- `instantiateBody` (body-instantiation) — gives entity organs
- `classifyEntity` (species) — assigns species classification
- `recordTick` (subjective-time) — initializes time perception

## CRITICAL RULES

- ALWAYS wrap module calls in `try/catch`
- Modules use module-level Maps for state — they manage themselves
- If a module import fails, log and continue — don't block startup
- Match the existing code style (const, camelCase, inline try/catch)
