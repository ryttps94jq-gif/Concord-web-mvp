# Concord Cognitive Engine

A governed, local-first cognitive operating system built around DTUs (Discrete Thought Units) with macro-driven architecture, optional LLM enhancement, and council-based governance.

## What is Concord?

Concord is **not** a generic project management or collaboration SaaS. It is a **cognitive operating system** that:

- **Forges DTUs** (Discrete Thought Units) - atomic knowledge containers
- **Consolidates knowledge** into MEGA/HYPER nodes for memory compression
- **Governs information** with council rules for credibility, deduplication, and legality
- **Runs sandboxed macros** - deterministic functions that power all logic
- **Enhances optionally with LLM** - local-first by default, cloud AI opt-in only

## Architecture

For the production hardening roadmap, see [`docs/CONCORD_REALITY_PLAN.md`](docs/CONCORD_REALITY_PLAN.md).

### Intentional Monolith Design

The server is intentionally structured as a single comprehensive file (`server.js`). This is a **deliberate architectural choice** for:

- **Open Source Visibility**: Full transparency - anyone can audit the complete system
- **IP Moat Protection**: The depth of interconnected logic creates a natural barrier against casual forking
- **Atomic Deployment**: Single file ensures consistent deployments with no module version mismatches
- **Macro-First Architecture**: Nearly all logic is expressed as macros, making the monolith a cohesive macro registry

### Core Concepts

| Concept | Description |
|---------|-------------|
| **DTU** | Discrete Thought Unit - atomic knowledge container with metadata, tags, and relationships |
| **MEGA DTU** | Consolidated node combining multiple related DTUs |
| **HYPER DTU** | Higher-order consolidation of MEGAs for large-scale knowledge compression |
| **Macro** | Deterministic function registered in the macro system |
| **Council** | Governance layer for voting, credibility scoring, and content moderation |
| **Resonance** | Metric for knowledge relevance and connection strength |

### Stack

**Backend:**
- Node.js 18+ with ESM modules
- Express.js with security middleware (Helmet, rate limiting)
- Optional: PostgreSQL, Redis, MeiliSearch, better-sqlite3
- Optional: LLM integration (OpenAI, Ollama)

**Frontend:**
- Next.js 15 with App Router
- React 18 with TypeScript (strict mode)
- Zustand for state management
- TanStack Query for server state
- Tailwind CSS with custom Lattice Empire theme
- Dexie (IndexedDB) for offline-first capability

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/concord-cognitive-engine.git
cd concord-cognitive-engine

# Install dependencies
cd server && npm install
cd ../concord-frontend && npm install
```

### Configuration

```bash
# Copy environment template
cp .env.example .env

# Required: Set these values
JWT_SECRET=your-64-char-secret-here    # openssl rand -hex 64
ADMIN_PASSWORD=your-admin-password     # minimum 12 characters
```

### Running

```bash
# Development - Terminal 1 (Backend)
cd server && npm run dev

# Development - Terminal 2 (Frontend)
cd concord-frontend && npm run dev

# Production
cd server && npm start
cd concord-frontend && npm run build && npm start
```

### Docker

```bash
# Build images
docker build -t concord-backend ./server
docker build -t concord-frontend ./concord-frontend

# Run with docker-compose (if available)
docker-compose up
```

## API Overview

The API provides 40+ endpoints organized by domain:

| Domain | Endpoints | Description |
|--------|-----------|-------------|
| `/api/auth` | login, register, logout, me | Authentication with JWT/cookies |
| `/api/dtus` | list, create, update | DTU CRUD operations |
| `/api/forge` | manual, hybrid, auto, fromSource | DTU creation modes |
| `/api/chat` | send, ask | Conversational interface |
| `/api/council` | vote, tally, credibility | Governance operations |
| `/api/graph` | query, visual, force | Knowledge graph queries |
| `/api/marketplace` | browse, install, submit | Plugin ecosystem |

Full API documentation: [`server/openapi.yaml`](server/openapi.yaml)

## Security

### Authentication

- **httpOnly cookies** (recommended for browsers)
- **JWT Bearer tokens** (for programmatic access)
- **API Keys** (for service-to-service)
- **CSRF protection** on all state-changing requests

### Input Validation

All inputs are sanitized against:
- XSS patterns (script tags, event handlers, javascript: URIs)
- SQL injection patterns
- Prototype pollution
- Null byte injection

### Rate Limiting

- API endpoints: 100 requests/minute (configurable)
- Authentication: 10 requests/minute
- Nginx layer: 10-30 requests/second

### LLM Security Considerations

When using LLM features with external APIs:

1. **Prompt Injection**: User inputs are not directly concatenated into system prompts
2. **Data Exfiltration**: LLM responses are validated before storage
3. **Opt-in Only**: Cloud LLM requires explicit environment config AND session opt-in
4. **Local Alternative**: Ollama provides fully local LLM capability

## Ethos Invariants

Concord enforces immutable principles (cannot be changed by configuration):

```javascript
ETHOS_INVARIANTS = {
  LOCAL_FIRST_DEFAULT: true,      // No cloud by default
  NO_TELEMETRY: true,             // Never phones home
  NO_ADS: true,                   // No advertising ever
  NO_SECRET_MONITORING: true,     // No hidden tracking
  NO_USER_PROFILING: true,        // No behavioral profiling
  CLOUD_LLM_OPT_IN_ONLY: true,    // Explicit consent required
  PERSONA_SOVEREIGNTY: true,      // Users own their personas
}
```

## Testing

```bash
# Backend tests
cd server && npm test

# Frontend tests
cd concord-frontend && npm test

# E2E tests
cd concord-frontend && npm run test:e2e

# Type checking
cd concord-frontend && npm run type-check
```

## Project Structure

```
concord-cognitive-engine/
├── server/
│   ├── server.js          # Macro-Max Monolith (intentional)
│   ├── openapi.yaml       # API specification
│   └── tests/             # Backend tests
├── concord-frontend/
│   ├── app/               # Next.js App Router (64 lens pages)
│   ├── components/        # React components (148+)
│   ├── lib/               # Utilities, API client, types
│   ├── hooks/             # Custom React hooks
│   └── store/             # Zustand state management
├── nginx/                 # Reverse proxy configuration
└── data/                  # Persistent storage
```

## Dependency Policy

### Update Schedule

- **Security patches**: Applied within 48 hours of disclosure
- **Minor versions**: Monthly review and update cycle
- **Major versions**: Quarterly evaluation with migration planning

### Optional Dependencies

Core functionality works without optional dependencies. These enhance capability:

| Dependency | Purpose | Fallback |
|------------|---------|----------|
| `better-sqlite3` | Persistent storage | In-memory JSON |
| `redis` | Caching, pub/sub | In-memory cache |
| `meilisearch` | Full-text search | Basic string matching |
| `@xenova/transformers` | Local embeddings | Keyword extraction |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

CONCORD SOURCE LICENSE — COMMUNITY EDITION (CSL-CE 1.0)

(DRAFT — Source-Available License)
(Not legal advice — for public release until formal review)

⸻

1. Purpose

The Concord Source License – Community Edition (“License”) enables individuals, students, researchers, and open-source contributors to freely use, run, study, and modify ConcordOS for personal and self-hosted purposes.

This License exists to protect:
	•	the integrity of the Concord ecosystem,
	•	the DTU economy,
	•	the Concord lexicon and architecture,
	•	the Global Concord network,
	•	and the Creator Marketplace

…from unauthorized commercial exploitation, repackaging, or rebranding.

This License is designed to be friendly to the community while ensuring Concord cannot be “sniped,” cloned, or commercialized by third parties without written permission from the Concord Project Owner.

⸻

2. Definitions

“Software” – All ConcordOS source files, models, schemas, DTU systems, documentation, and accompanying assets in this repository.

“Owner” – The creator and maintainer of the Concord Project.

“Self-Hosted Use” – Running the Software for personal, research, educational, or internal organizational purposes, without charging users or offering it as a service.

“Commercial Use” – Offering, selling, hosting, licensing, monetizing, or distributing the Software or any derivative for financial benefit, credits, tokens, royalties, subscriptions, or institutional income.

“Derivative Marketplace” – Any platform that publishes, distributes, trades, licenses, or monetizes DTUs, Hyper-DTUs, simulation assets, personas, or lineage-derived structures.

“Competing Global Network” – Any public deployment attempting to replicate, replace, compete with, or fork the official Concord Global infrastructure.

⸻

3. Rights Granted (Community-Friendly)

Under this License, and subject to the Restrictions below, You MAY:

✔ 1. Use the Software for personal, educational, and research purposes.

✔ 2. Run private, self-hosted Concord nodes.

✔ 3. Modify the Software for non-commercial experimentation.

✔ 4. Create DTUs, personas, simulations, and extensions for private use.

✔ 5. Contribute improvements back to the community via pull request.

✔ 6. Teach, study, analyze, or learn from the Software.

✔ 7. Fork the repository for personal or research use (non-commercial).

These rights are perpetual, worldwide, and irrevocable so long as you follow this License.

⸻

4. Restrictions (Anti-Sniping Protections)

You MAY NOT:

❌ 1. Sell, license, or commercially distribute the Software.

❌ 2. Offer Concord as a hosted service (“Concord-as-a-Service”).

❌ 3. Operate or publish a Derivative Marketplace.

❌ 4. Create, operate, or assist a Competing Global Network.

❌ 5. Monetize DTUs, Hyper-DTUs, lineage graphs, simulations, or Concord-derived assets.

❌ 6. Rebrand, rename, or misrepresent the Software as your own product.

❌ 7. Modify and redistribute the Software for commercial purposes.

❌ 8. Use the Software in any product that charges users directly or indirectly.

❌ 9. Use Concord trademarks without written permission.

❌ 10. Use Concord’s architecture or lexicon to bootstrap a competing ecosystem.

If you wish to do any of these things, you must obtain written permission from the Owner.

⸻

5. Commercial Licensing Path

Commercial hosting, enterprise deployment, integration with paid systems, marketplace operations, or running Concord-based public networks requires a separate commercial agreement with the Concord Project Owner.

Permission may be granted or denied at the Owner’s sole discretion.

⸻

6. Trademark Notice

“Concord,” “ConcordOS,” “DTU,” “Hyper-DTU,” “Concord Global,” “Concord Marketplace,” and associated names, logos, and terminology are not licensed under this agreement.

Use of these marks requires explicit written permission.

⸻

7. Redistribution Rules (Community-Safe)

You MAY redistribute modified versions only if:
	•	You include this License in full,
	•	The distribution is non-commercial,
	•	You clearly state:
“This is a modified, unofficial version of ConcordOS and not the official Concord project.”

This keeps the community open while ensuring the brand identity stays protected.

⸻

8. Warranty Disclaimer

The Software is provided “AS IS,” without warranty or liability.

---

Built with sovereignty in mind. Your thoughts, your rules.
