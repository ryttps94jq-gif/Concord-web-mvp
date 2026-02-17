# ADR 002: Macro-First Execution Model

## Status
Accepted

## Context
API endpoints need to perform complex knowledge operations (create DTUs, run simulations, govern). Direct database manipulation in route handlers would scatter business logic.

## Decision
All business logic runs through `runMacro(domain, action, input, ctx)`. Route handlers are thin HTTP adapters that call macros and return results. Macros are pure deterministic functions registered by domain.

## Consequences
- **Pro**: Business logic is testable without HTTP
- **Pro**: New capabilities are added by registering macros, not modifying routes
- **Pro**: Macros can be composed and chained
- **Con**: Extra indirection for simple CRUD
- **Mitigation**: Common patterns (list, get, create) are standardized across domains
