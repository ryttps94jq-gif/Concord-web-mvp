# ADR 005: Redis as Optional Infrastructure

## Status
Accepted

## Context
Token revocation needs to survive process restarts and work across multiple instances. However, requiring Redis violates the local-first principle.

## Decision
Use a three-tier storage strategy: in-memory Map (primary, synchronous), Redis (optional, for multi-instance sync), SQLite (persistent fallback). The in-memory Map is always authoritative for the current process. Redis syncs on startup via `syncFromRedis()`.

## Consequences
- **Pro**: Single-instance deployments work without Redis
- **Pro**: Multi-instance deployments get cross-process token revocation
- **Pro**: Redis TTL auto-cleans expired tokens
- **Con**: Without Redis, token revocation is lost on restart (mitigated by SQLite persistence)
- **Mitigation**: SQLite `sessions.is_revoked` provides persistence for single-instance
