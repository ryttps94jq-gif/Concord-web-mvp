# ADR 003: Local-First Sovereignty

## Status
Accepted

## Context
Users need full control over their knowledge data. Cloud dependencies create lock-in, privacy risks, and availability concerns.

## Decision
All core functionality works without internet. Cloud LLM is opt-in only (requires both env config AND per-session consent). Data is stored locally in SQLite/JSON. Federation is optional.

## Consequences
- **Pro**: Works offline, air-gapped deployments possible
- **Pro**: No vendor lock-in for core features
- **Pro**: GDPR compliance simplified (data never leaves machine)
- **Con**: No collaborative features without explicit federation setup
- **Con**: LLM-enhanced features require local Ollama or explicit cloud opt-in
