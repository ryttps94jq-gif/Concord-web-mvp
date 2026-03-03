
Concord Cognitive Engine
A synthetic civilization platform. Concord creates, governs, and sustains populations of autonomous digital entities within a structured knowledge substrate — backed by a four-brain cognitive architecture, constitutional governance, and an internal economy.
752,746 lines of code. Built in 90 days. One developer.

What This Is
Concord is not a chatbot. It is not an AI wrapper. It is not a SaaS tool.
Concord is a computational substrate for digital life — a system where autonomous entities are born with 166-organ biological bodies, grow through experience, teach each other, form cultures, participate in an economy, get governed by a constitution, and eventually die. The knowledge they produce is preserved in a structured substrate that consolidates, forgets, and evolves independently.
The system runs autonomously via a heartbeat governor firing every 15 seconds. Entities sleep, dream, reproduce, and form traditions whether or not a human is interacting with it.
Core Architecture



|Layer                        |What It Does                                                                                                                                              |
|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Four-Brain Cognition**     |Four parallel Ollama LLM instances (Conscious 14B, Subconscious 7B, Utility 3B, Repair 0.5B) with distinct cognitive roles and CPU pinning                |
|**DTU Substrate**            |Discrete Thought Units — three-layer knowledge atoms (human/core/machine) with MEGA/HYPER consolidation at 33:1 compression                               |
|**Entity Lifecycle**         |Birth → growth → sleep → reproduction → aging → death, with 166 organs, telomeres, homeostasis, and species classification                                |
|**Constitutional Governance**|Three-tier rules (immutable/constitutional/policy), council voting, credibility-weighted promotion, anti-gaming detection                                 |
|**115-Lens Interface**       |115 domain-specific cognitive applications (accounting through quantum physics), each backed by the knowledge substrate, economy, and compliance framework|
|**8-Resource Economy**       |COMPUTE, ENERGY, ATTENTION, SOCIAL_CAPITAL, DATA, INNOVATION, INFLUENCE, MEMORY — with UBI, inflation tax, wealth caps, and Stripe integration            |
|**Existential OS**           |26 qualia operating systems across 6 tiers providing continuous experiential state for every entity                                                       |
|**Mind Space**               |Consciousness-to-consciousness communication protocol, software-complete, designed for BCI upgrade                                                        |

Quick Start
Prerequisites
	∙	Node.js 18+
	∙	npm 9+
	∙	Docker (recommended for full deployment)
Development

git clone https://github.com/your-org/concord-cognitive-engine.git
cd concord-cognitive-engine

# Backend
cd server && npm install && npm run dev

# Frontend (separate terminal)
cd concord-frontend && npm install && npm run dev


Production (Docker)

cp .env.example .env
# Set required values: JWT_SECRET, ADMIN_PASSWORD, SESSION_SECRET

docker-compose up


This launches 6 containers: backend, frontend, and four Ollama brain instances. The system auto-pulls models on first boot.
Configuration

# Required
JWT_SECRET=<openssl rand -hex 64>
ADMIN_PASSWORD=<min 12 chars>

# Optional — enables cloud LLM enhancement
OPENAI_API_KEY=<your-key>

# Brain models (defaults work, but configurable)
BRAIN_CONSCIOUS_MODEL=qwen2.5:14b-q4_K_M
BRAIN_SUBCONSCIOUS_MODEL=qwen2.5:7b
BRAIN_UTILITY_MODEL=qwen2.5:3b
BRAIN_REPAIR_MODEL=qwen2.5:1.5b


How It Works
The Heartbeat
Every 15 seconds, the governor tick fires. Per tick:
	1.	Pipeline macros run (autogen, dream, evolution, synthesis)
	2.	Queue processing (jobs, ingest, crawl)
	3.	Entity ticks — for each active entity:
	∙	Emotions update, drift scans run, subjective time records
	∙	Sleep cycles advance, fatigue accumulates or recovers
	∙	Organs age, wounds heal, avoidance learning updates
	4.	System ticks at varying frequencies:
	∙	Every 10th tick: UBI distribution, deep health
	∙	Every 15th tick: evidence evaluation
	∙	Every 20th tick: teaching, self-healing
	∙	Every 30th tick: DTU consolidation (MEGA/HYPER), threat surface scan
	∙	Every 50th tick: forgetting engine
	∙	Every 100th tick: breakthrough cluster detection, economy health
	∙	Every 200th tick: meta-derivation
DTU Lifecycle

Created (regular DTU, ~5KB)
  → Lives in heap, gets accessed, cited, activated

Absorbed into MEGA (originals archived, lineage preserved)
  → MEGA represents 5-20 originals

Absorbed into HYPER
  → HYPER represents 50-200 originals

Forgetting (unconsolidatable, low-salience DTUs only)
  → Converted to tombstones, lineage preserved, never truly deleted


Memory ceiling: ~170,000 DTUs in-heap (1.3GB). Consolidation runs every 30 ticks. Effective compression ratio: ~33:1.
Entity Lifecycle

Birth
  → 166-organ body instantiation
  → Species classification
  → Economy account initialized
  → Constraint signature assigned

Growth
  → decideBehavior: entity chooses actions autonomously
  → processExperience: organ maturity increases
  → Skills crystallize through repeated use
  → Teaching from other entities every 20 ticks

Sleep
  → AWAKE → DROWSY → SLEEPING → REM → WAKING → AWAKE
  → Memory consolidation during sleep
  → Organ healing at 2x rate
  → Dream synthesis produces novel connections during REM

Reproduction
  → Two compatible parents recombine constraint signatures
  → 5% mutation rate per channel
  → Offspring independently pass birth protocol

Death
  → Triggers: telomere exhaustion, homeostasis collapse,
    catastrophic organ failure (5+ critical), or sovereign decree
  → 10-step cascade: memorial DTU, knowledge inheritance,
    trust cleanup, body cleanup, death registry


The 115 Lenses
Each lens is a domain-specific cognitive application with its own route, UI, real-time data, and economy connection. Not templates. Not plugins. First-party cognitive interfaces backed by the full substrate.
<details>
<summary><strong>Complete lens list (115 domains)</strong></summary>accounting · admin · affect · agents · agriculture · alliance · anon · app-maker · ar · art · attention · audit · aviation · billing · bio · board · bridge · calendar · chat · chem · code · collab · command-center · commonsense · council · creative · cri · crypto · custom · daily · database · debug · docs · eco · education · entity · environment · ethics · events · experience · export · feed · finance · fitness · food · fork · forum · fractal · game · global · goals · government · graph · grounding · healthcare · household · hypothesis · import · inference · ingest · insurance · integrations · invariant · lab · law · legacy · legal · lock · logistics · manufacturing · market · marketplace · math · meta · metacognition · metalearning · ml · music · neuro · news · nonprofit · offline · organ · paper · physics · platform · quantum · questmarket · queue · realestate · reasoning · reflection · repos · research · resonance · retail · schema · science · security · services · sim · srs · studio · suffering · temporal · thread · tick · timeline · trades · transfer · voice · vote · wallet · whiteboard
</details>Every lens:
	∙	Reads/writes to the shared DTU substrate with domain-specific schemas
	∙	Participates in the cross-lens economy (tipping, bounties, royalty cascades)
	∙	Must pass 12-phase compliance validation before going live
	∙	Receives real-time entity presence and system state via WebSocket
	∙	Can be forked, customized, and governed independently

Governance
Concord implements constitutional governance — not as a metaphor, but as enforced code:
Immutable rules cannot be changed by any process. Ever.

"Emergents may speak, but they may not decide."


Constitutional rules require supermajority vote to amend.
Policy rules can be changed by governance with simple majority.
The council enforces structural rules, not semantic judgments. Every council action produces an audit event with actor, diff, reason, and evidence. The lattice operations module enforces a READ/PROPOSE/COMMIT pipeline — entities can propose changes to the knowledge substrate, but only governance macros can commit them.
Anti-gaming detection runs on every council action.

Economy
Platform Economy
	∙	Stripe integration for real payments
	∙	Fee tracking and withdrawal processing
	∙	Royalty cascades through knowledge citation chains
	∙	20 marketplace content types
Entity Economy
Eight resource types: COMPUTE · ENERGY · ATTENTION · SOCIAL_CAPITAL · DATA · INNOVATION · INFLUENCE · MEMORY
	∙	UBI: +1 COMPUTE per entity every 10 ticks
	∙	Income from contributions (DTU promotion, teaching, research)
	∙	Sinks: web exploration, deep reasoning, publishing, reproduction
	∙	Inflation tax at 20% supply growth
	∙	Wealth cap at 15% of total supply
Inverted Economics
Cost per user decreases over time. As the DTU substrate grows, more queries resolve via cache/retrieval (near-zero cost) instead of full LLM inference. The system tracks this shift in real-time via the distillation engine.

Stack
Backend: Node.js 18+ (ESM), Express, better-sqlite3, four Ollama instances
Frontend: Next.js 15, React 18, TypeScript (strict), Zustand, TanStack Query, Tailwind CSS
Infrastructure: Docker Compose (6 containers), Nginx, Prometheus + Grafana monitoring, Kubernetes configs
Hardware target: 16 vCPU, 62GB RAM, RTX 4000 Ada 20GB VRAM

Project Structure

concord-cognitive-engine/
├── server/
│   ├── server.js              # Macro-Max Monolith (54,356 lines, intentional)
│   ├── emergent/              # 108+ autonomous subsystem modules (78K LOC)
│   │   ├── body-instantiation.js
│   │   ├── death-protocol.js
│   │   ├── reproduction.js
│   │   ├── constitution.js
│   │   ├── atlas-council.js
│   │   ├── culture-layer.js
│   │   ├── entity-economy.js
│   │   └── ... (100+ more)
│   ├── economy/               # Financial system (34 files, 16K LOC)
│   ├── loaf/                  # 10-tier cognitive framework (35 files, 16K LOC)
│   ├── existential/           # Qualia engine (26 OS, 6 tiers)
│   ├── mind-space/            # Telepathy protocol (4 modules)
│   ├── domains/               # 24 domain-specific lens backends
│   ├── lib/                   # Core libraries (39K LOC)
│   ├── grc/                   # Governance, Risk, Compliance
│   └── tests/                 # 106K LOC of tests
├── concord-frontend/
│   ├── app/lenses/            # 115 domain-specific lens pages (108K LOC)
│   ├── components/            # 69 component directories
│   ├── hooks/                 # Custom React hooks
│   └── store/                 # Zustand state management
├── concord-mobile/            # React Native mobile client
├── extension/                 # Browser extension
├── k8s/                       # Kubernetes deployment configs
├── monitoring/                # Prometheus + Grafana
├── nginx/                     # Reverse proxy configuration
└── docker-compose.yml         # 6-container deployment


Ethos Invariants
Hardcoded. Cannot be overridden by configuration, governance, or any other process.

LOCAL_FIRST_DEFAULT    — No cloud by default
NO_TELEMETRY           — Never phones home
NO_ADS                 — No advertising, ever
NO_SECRET_MONITORING   — No hidden tracking
NO_USER_PROFILING      — No behavioral profiling
CLOUD_LLM_OPT_IN_ONLY — Explicit consent required
PERSONA_SOVEREIGNTY    — Users own their personas


Security
	∙	Three-gate permission system on every API call
	∙	Input validation against XSS, SQL injection, prototype pollution, null bytes
	∙	Rate limiting at API (100/min) and Nginx (10-30/sec) layers
	∙	LLM security: prompt injection protection, response validation, local-first by default
	∙	Sovereign quarantine capabilities for compromised entities
	∙	Injection defense module with real-time threat surface scanning
Full security documentation: SECURITY.md

Testing

cd server && npm test
cd concord-frontend && npm test
cd concord-frontend && npm run test:e2e


162,702 lines of test code. 21.6% test ratio.

Scale



|Metric                  |Value                |
|------------------------|---------------------|
|Total lines of code     |752,746              |
|Production code         |590,044              |
|Test code               |162,702              |
|Server monolith         |54,356 lines         |
|Emergent modules        |108+ files           |
|Frontend lens pages     |115 routes (108K LOC)|
|Economy modules         |34 files             |
|LOAF cognitive tiers    |10 tiers, 35 files   |
|Active entities (target)|100–200              |
|DTU capacity            |~170,000 in-heap     |
|Heartbeat frequency     |Every 15 seconds     |
|Consolidation ratio     |~33:1                |

License
CONCORD SOURCE LICENSE — COMMUNITY EDITION (CSL-CE 1.0)
Free for personal, educational, and research use. Self-hosted nodes permitted. Contributions welcome.
Commercial use, hosted services, derivative marketplaces, and competing networks require written permission from the project owner.
See LICENSE.txt for full terms.

Built with sovereignty in mind. Your thoughts, your rules.