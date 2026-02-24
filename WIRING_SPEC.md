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

| # | Module | File | Wired Into | Tick Freq | Status |
|---|--------|------|-----------|-----------|--------|
| 1 | Body Instantiation | body-instantiation.js | Entity creation + heartbeat | Every tick | Pre-existing |
| 2 | Sleep Consolidation | sleep-consolidation.js | Heartbeat | Every tick | Pre-existing |
| 3 | Death Protocol | death-protocol.js | Heartbeat | Every tick | Pre-existing |
| 4 | Relational Emotion | relational-emotion.js | Heartbeat + session.turn | Every tick | Pre-existing |
| 5 | Constitution | constitution.js | Macro execution pipeline | On write | Pre-existing |
| 6 | Species | species.js | Entity creation | On create | Pre-existing |
| 7 | Reproduction | reproduction.js | Registered as macro | On demand | Pre-existing |
| 8 | Avoidance Learning | avoidance-learning.js | Heartbeat + macro errors | Every tick | Pre-existing |
| 9 | Drift Monitor | drift-monitor.js | Heartbeat | Every tick | Pre-existing |
| 10 | Subjective Time | subjective-time.js | Entity creation + heartbeat | Every tick | Pre-existing |
| 11 | Vulnerability Engine | vulnerability-engine.js | Heartbeat | Every 5th tick | Pre-existing |
| 12 | Institutional Memory | institutional-memory.js | Heartbeat + macro writes | Every tick | Pre-existing |
| 13 | Entity Economy | entity-economy.js | Heartbeat (UBI + health) | 10th/100th tick | **NEW** |
| 14 | Entity Growth | entity-growth.js | Heartbeat (decideBehavior) | Every tick | **NEW** |
| 15 | Dream Capture | dream-capture.js | Heartbeat (during sleep) | Every tick | **NEW** |
| 16 | Forgetting Engine | forgetting-engine.js | Heartbeat | Every 50th tick | **NEW** |
| 17 | Entity Teaching | entity-teaching.js | Heartbeat | Every 20th tick | **NEW** |
| 18 | Consequence Cascade | consequence-cascade.js | Heartbeat | Every tick | **NEW** |
| 19 | Deep Health | deep-health.js | Heartbeat | Every 10th tick | **NEW** |
| 20 | Purpose Tracking | purpose-tracking.js | Heartbeat | Every tick | **NEW** |
| 21 | Skills | skills.js | Heartbeat | Every 25th tick | **NEW** |
| 22 | Trust Network | trust-network.js | Heartbeat | Every 5th tick | **NEW** |
| 23 | Attention Allocator | attention-allocator.js | Heartbeat | Every tick | **NEW** |
| 24 | Evidence | evidence.js | Heartbeat | Every 15th tick | **NEW** |
| 25 | Threat Surface | threat-surface.js | Heartbeat | Every 30th tick | **NEW** |
| 26 | Breakthrough Clusters | breakthrough-clusters.js | Heartbeat | Every 100th tick | **NEW** |
| 27 | Meta-Derivation | meta-derivation.js | Heartbeat | Every 200th tick | **NEW** |
| 28 | Quest Engine | quest-engine.js | Heartbeat | Every 50th tick | **NEW** |
| 29 | Culture Layer | culture-layer.js | Heartbeat | Every tick | Pre-existing |
| 30 | Research Jobs | research-jobs.js | Heartbeat | Every tick | Pre-existing |
| 31 | Hypothesis Engine | hypothesis-engine.js | Heartbeat | Every tick | Pre-existing |
| 32 | Self-Healing | selfHealing.js | Heartbeat (idle) | Every 20th tick | **NEW** |
| 33 | Consolidation Pipeline | (server.js inline) | Heartbeat | Every 30th tick | **NEW** |

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
