# ADR 004: DTU as Atomic Knowledge Unit

## Status
Accepted

## Context
Knowledge needs a standard unit that is versionable, linkable, and machine-processable while remaining human-readable.

## Decision
The Discrete Thought Unit (DTU) is the atomic unit of knowledge. Each DTU contains: human-readable summary, machine-readable core (definitions, invariants, claims), mathematical formalization, and lineage links. DTUs compose into MEGAs (clusters) and HYPERs (meta-clusters).

## Consequences
- **Pro**: Every piece of knowledge has a consistent structure
- **Pro**: Lineage tracking enables provenance and conflict detection
- **Pro**: Machine and human views of the same knowledge coexist
- **Con**: Simple notes feel over-structured
- **Mitigation**: Auto-forge mode fills structure from minimal input
