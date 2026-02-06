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

[License details here]

---

Built with sovereignty in mind. Your thoughts, your rules.
