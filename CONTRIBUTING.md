# Contributing to Concord Cognitive Engine

## Development Setup

### Prerequisites
- Node.js >= 18
- npm >= 9

### Quick Start
```bash
# Clone the repository
git clone <repo-url>
cd concord-cognitive-engine

# Start the server
cd server
cp .env.example .env    # Edit .env with your settings
npm install
npm run dev

# In another terminal, start the frontend
cd concord-frontend
npm install
npm run dev
```

### Using Docker Compose
```bash
cp .env.example .env    # Edit .env with required values
docker compose up
```

## Testing

### Server
```bash
cd server
npm test              # Run all tests
npm run test:coverage # With coverage
npm run lint          # Lint check
```

### Frontend
```bash
cd concord-frontend
npm run test:run      # Unit tests
npm run test:coverage # With coverage
npm run test:e2e      # E2E tests (requires Playwright)
npm run test:a11y     # Accessibility tests
npm run type-check    # TypeScript check
npm run lint          # Lint check
```

## Architecture

- **Server**: Node.js + Express, ESM, SQLite via better-sqlite3
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Tests**: Node.js built-in test runner (server), Vitest + Playwright (frontend)

See [docs/adr/](docs/adr/) for Architecture Decision Records.

## Code Style

- Server: ESM imports, Node.js built-in test runner
- Frontend: TypeScript strict, Next.js App Router conventions, Tailwind CSS
- Follow existing patterns in the codebase
- Run `npm run lint` before submitting PRs

## Pull Requests

- Fill out the PR template completely
- Ensure CI passes (lint, tests, type-check, build)
- Request review from `@concord-team`
