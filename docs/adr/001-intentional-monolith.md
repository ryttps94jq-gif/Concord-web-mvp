# ADR 001: Intentional Monolith Architecture

## Status
Accepted

## Context
Concord needs to run on a single machine with minimal infrastructure. Microservices add network latency, deployment complexity, and operational overhead that conflicts with the sovereignty-first design.

## Decision
Keep server.js as a single-process monolith with modular internal structure (routes/, loaf/, emergent/, economy/). Route handlers are extracted to separate files but share a single process, database connection, and state.

## Consequences
- **Pro**: Zero network hops between components, simple deployment, single backup target
- **Pro**: Shared in-memory state enables real-time features without pub/sub
- **Con**: Vertical scaling only (mitigated by efficient async I/O)
- **Con**: Route files need dependency injection from the main module
- **Mitigation**: Route extraction keeps files reviewable; macro engine provides logical separation
