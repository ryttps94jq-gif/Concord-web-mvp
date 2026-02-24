# Concord Cognitive Engine — Architecture

## Four-Brain Architecture

Concord runs four Ollama instances with CPU pinning for true parallel cognition:

| Brain | Model | Role | Port |
|-------|-------|------|------|
| Conscious (7B) | qwen2.5:7b | Chat, deep reasoning, council deliberation | 11434 |
| Subconscious (1.5B) | qwen2.5:1.5b | Autogen, dream, evolution, synthesis, birth | 11435 |
| Utility (3B) | qwen2.5:3b | Lens interactions, entity actions, quick tasks | 11436 |
| Repair (0.5B) | qwen2.5:0.5b | Error detection, auto-fix, runtime repair | 11437 |

When no OPENAI_API_KEY is set, `ctx.llm.chat()` routes to the conscious brain via Ollama.
`initThreeBrains()` probes each brain on startup and auto-pulls models if missing.

## DTU Lifecycle

```
Created (regular DTU, ~5KB in heap)
  → Lives in heap, gets accessed, cited, activated
  → Cluster detection finds it belongs to a group

Absorbed into MEGA (~5KB freed, MEGA grows ~2-3KB)
  → Archived to disk, removed from heap
  → Lineage preserved, rehydratable on demand

MEGA lives in heap (~15KB, representing 5-20 originals)
  → Cluster detection finds related MEGAs

Absorbed into HYPER (~15KB freed, HYPER grows ~5-10KB)

HYPER lives in heap (~30KB, representing 50-200 originals)
  → Long-term persistent knowledge layer

Forgetting (unconsolidatable DTUs only)
  → Low-salience DTUs that no cluster wants
  → Converted to tombstones, never truly deleted
```

### Consolidation Constants (Hardware-Derived)

- Memory ceiling: ~170,000 DTUs in-heap (1.3GB available)
- Consolidation runs every 30 ticks (~7.5 minutes)
- MEGA: 5-20 regular DTUs → 1 consolidated MEGA
- HYPER: 3-10 MEGAs → 1 meta-consolidated HYPER
- Effective compression ratio: ~33:1 (regular → HYPER)
- Forgetting engine only handles unconsolidatable noise

## Entity Lifecycle

```
Birth (createNewbornEntity)
  → Body instantiation (166 organs, all at maturity 0)
  → Species classification
  → Economy account initialization

Growth (heartbeat ticks)
  → decideBehavior: entity chooses what to do
  → processExperience: organ maturity increases
  → ageEntity: telomere shortens
  → Sleep/wake cycle: fatigue accumulates, sleep consolidates

Reproduction (when mature enough)
  → Two compatible parents
  → Offspring inherits trait mix + mutations
  → New body instantiated

Death (when death conditions met)
  → Telomere depleted, homeostasis collapse, or sovereign decree
  → Memorial DTU created
  → Knowledge preserved via consolidation
```

### Entity Limits (Hardware-Derived)

- Max active entities: 200 (hard cap)
- Target active entities: 100 (optimal for 8 vCPU)
- LLM inferences per hour: 400 (subconscious brain capacity)
- Budget: 2 inferences per entity per hour

## Three-Gate Permission System

Every frontend API call passes through three gates in `server.js`:

1. **Gate 1 (authMiddleware)**: `publicReadPaths` array — path prefix allowlist for unauthenticated GET requests
2. **Gate 2 (runMacro)**: `publicReadDomains` object — domain+macro name allowlist
3. **Gate 3 (Chicken2)**: `_safeReadPaths` array + `safeReadBypass` boolean — bypass for the lattice reality guard

All three gates must allow a request for it to succeed without authentication.
POST endpoints require JWT/cookie auth but bypass the public read gates.

## Heartbeat Tick

The governor heartbeat fires every 15 seconds (configurable). Each tick:

1. **Pipeline macros** (when enabled): autogen, dream, evolution, synthesis
2. **Queue processing**: jobs, queue, ingest, crawl
3. **Goal heartbeat** + agent scheduler
4. **Emergent system ticks** (see WIRING_SPEC.md for full list):
   - Biological: body decay, sleep, death, emotions, drift, time, wounds
   - Economy: UBI distribution (10th), health checks (100th)
   - Growth: decideBehavior, aging, experience processing
   - Cognitive: teaching (20th), attention, evidence (15th), purpose
   - Culture: tradition emergence, adherence
   - Consolidation: MEGA/HYPER formation (30th)
   - Forgetting: prune low-salience DTUs (50th)
   - Security: threat surface scan (30th)
   - Meta: breakthrough clusters (100th), meta-derivation (200th)
   - Self-healing: dream review when idle (20th)
5. **Kernel metrics tick**: homeostasis, organ wear

## Economy

### Platform Economy
- Stripe integration for subscriptions
- Fee tracking by type
- Withdrawal processing

### Entity Economy (Five Resource Types)
- COMPUTE, ENERGY, ATTENTION, SOCIAL_CAPITAL, DATA, INNOVATION, INFLUENCE, MEMORY
- UBI: +1 COMPUTE per entity every 10 ticks
- Income from contributions (DTU promotion, teaching, research)
- Sinks: web exploration, deep reasoning, publishing, reproduction
- Inflation tax at 20% supply growth
- Wealth cap at 15% of total supply

## Culture Layer

Emergent cultural traditions arise from repeated entity behaviors:
- Types: PRACTICE, RITUAL, CUSTOM, IDIOM, TABOO
- Status lifecycle: emerging → established → fading → extinct
- Adherence tracking per entity
- Cultural stories and retellings
- `cultureTick()` runs every heartbeat

## Repair Cortex

The repair brain (0.5B) runs a continuous loop:
- Detects runtime errors and pattern violations
- Generates fix proposals
- Applies safe patches with rollback capability
- Tracks fix success rate
