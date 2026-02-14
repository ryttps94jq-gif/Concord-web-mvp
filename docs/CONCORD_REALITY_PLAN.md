# Concord 10/10 Reality Plan

This plan defines what "everything is real" means for Concord and turns it into an executable hardening roadmap.

## Definition of "real"

A lens is considered real only when all of the following are true:

1. **Durable state**: every user action persists to DB or object storage.
2. **Deterministic replay**: view state can be rebuilt from DB + event log.
3. **Jobs & artifacts**: heavy operations run asynchronously as jobs and produce artifacts.
4. **Permissions + audit**: every mutation checks ACL and emits an audit event.
5. **Observability**: every action emits trace/metric/log with request id.
6. **Export/import**: user data can be exported and re-imported.
7. **Crash safety**: restart does not lose work.
8. **Consistency gates**: quality gates prevent regressions.

---

## A) Persistence architecture (no user data loss)

### A1. Three-layer persistence

- **Authoritative metadata database** (SQLite/Postgres)
  - users, sessions, api_keys
  - dtus, dtu_versions
  - artifacts, artifact_versions
  - lens_items + scope mappings
  - marketplace listings/purchases/entitlements
  - jobs, job_runs, job_artifacts
  - audit logs
  - append-only event log index
- **Authoritative object storage** (local volume first, S3-compatible interface)
  - audio, images, video
  - project files
  - exports
  - large model outputs
- **Append-only event log**
  - events such as `DTU_CREATED`, `ARTIFACT_UPLOADED`, `LISTING_PUBLISHED`, `TRACK_RENDER_STARTED`, `TRACK_RENDER_FINISHED`

### A2. Crash-proof write rules

1. In-memory `Map` values may be cache only, never source of truth.
2. Mutation ordering:
   - commit DB transaction
   - commit file write (`fsync`)
   - append event record
3. All jobs must be idempotent and resumable.

### A3. Backups and restore

- Backups
  - nightly DB backup
  - hourly event-log delta snapshot
  - daily artifact snapshot (tar/rsync)
  - retention: 7 daily, 4 weekly, 6 monthly
- Restore
  - one command to restore DB + artifacts
  - integrity check via stored hashes
  - optional roll-forward via event log

### A4. Persistence acceptance

Create DTU + upload audio + publish listing, then hard-restart containers and verify:

- DTU still present
- artifacts still available
- jobs still visible with accurate status
- published listing still discoverable

---

## B) Global is canonical truth view

### B1. Required Global coverage

Global must be complete browsers for:

- DTUs
- artifacts
- jobs
- marketplace

### B2. Global UX requirements

- `Showing X of Y`
- pagination
- search + tags + type filters
- `Sync to lens/workspace`
- `Publish to marketplace`

### B3. API requirements

- `GET /api/dtus/paginated` → `items`, `total`, `facets`
- `GET /api/artifacts/paginated` → `items`, `total`, `facets`
- `GET /api/jobs/paginated` → `items`, `total`, `facets`
- `GET /api/marketplace/paginated` → `items`, `total`, `facets`

---

## C) Lens architecture: diverse UI, shared kernel

### C1. Lens Kernel (mandatory rails)

Every lens must use shared kernel services for:

- auth injection
- API client
- error normalization + toast surface
- permission prompts
- telemetry + correlation ids
- cache + pagination utilities
- seed-only entry via `useLensData({ seed })`

### C2. Lens Manifest contract

Each lens manifest must include:

- `lensId`, `version`, `category`
- capability flags
- default views/actions
- supported data types
- required permissions
- allowed export formats

Manifest validation is blocking in CI.

---

## D) Real logic layer: operators + workflows + jobs

### D1. Operators

Introduce explicit operators between substrate and views:

- `createThing`
- `editThing`
- `mergeThings`
- `dedupeThings`
- `exportThings`
- `publishThing`

Operator contract:

1. validate input (Zod)
2. execute transactional write(s)
3. emit event
4. return artifact/job reference
5. emit audit log

### D2. Workflows

Workflows are resumable job chains of operators (examples):

- `Generate → Review → Publish`
- `Import → Clean → Tag → Sync`
- `Record → Mix → Master → Release`

---

## E) Music/Studio reality roadmap

### E1. Studio durable model

- `studio_projects`
- `studio_tracks`
- `studio_clips`
- `studio_automation`
- `studio_effect_chains`
- `studio_renders`
- `studio_collabs` (optional)

Everything versioned.

### E2. Audio asset durable model

- `audio_assets`
- `audio_asset_versions`
- `storage_uri` blob references
- `waveform_uri` cache references

### E3. Rendering engine

Add worker/service container to run render jobs:

- timeline mixing
- effect-chain application (FFmpeg filters or LV2/LADSPA)
- WAV/MP3 export
- artifact write + job status updates

Endpoints:

- `POST /api/artistry/studio/render` → enqueue job
- `GET /api/artistry/studio/render/:id/status` → status polling

### E4. Vocal analyze/process/master

Replace `501` placeholders with jobs:

- analyze (pitch/tempo/loudness/noise profile)
- process (noise reduction/EQ/compression)
- master (normalization/limiter/true peak)

Each run writes a new artifact version (`original`, `processed`, `mastered`).

### E5. Safe release pipeline

Release requires:

- ownership check
- license/terms attachment
- stored artifact hash
- visibility selection (`private` / `unlisted` / `public`)
- distribution metadata

---

## F) Marketplace: structurally commerce-ready

### F1. Required tables

- `marketplace_listings`
- `marketplace_assets`
- `entitlements`
- `licenses`
- `license_versions`
- `creator_profiles`
- `payout_accounts` (future)
- `transactions` (future)

### F2. Required UI

- publish listing
- attach artifact
- assign license
- configure visibility/pricing
- enforce entitlement-gated download

---

## G) Account system hardening

- `AUTH_MODE` (`public` / `apikey` / `jwt`)
- registration toggle
- secure password hashing (`argon2`/`bcrypt`)
- API keys per user
- admin key revocation
- user/workspace scoping by default unless explicitly public

---

## H) Observability and no-silent-failure policy

### H1. Frontend

Global error banner/toast that handles auth/cors/network/server errors and supports copyable debug bundle.

### H2. Backend

Every request log contains at minimum:

- request-id
- user-id (if available)
- lens-id
- route
- latency
- status/result code

### H3. Dashboards

- endpoint error rate
- job queue health
- render durations
- artifact upload success
- auth failures

---

## I) Migration and schema versioning

- schema version table
- migrations folder
- startup migration runner
- rollback or forward-only+backup strategy

---

## J) Acceptance tests proving 10/10 readiness

### J1. End-to-end user acceptance

1. sign up
2. create DTU
3. create artifact
4. upload audio
5. run mix job
6. verify mastered artifact in Global
7. publish to marketplace
8. entitlement-gated download
9. restart services
10. verify all state persists

### J2. Chaos acceptance

- kill backend during active job
- restart
- verify job resumes or cleanly fails with retry path
- verify no corrupted artifacts

---

## Immediate implementation sequence (recommended)

1. **Persistence baseline**: DB migrations + artifact storage abstraction + append-only event log.
2. **Job durability**: persisted jobs table + resumable worker + idempotency keys.
3. **Global canonical APIs**: paginated endpoints with facets and totals.
4. **Lens kernel extraction**: shared auth/error/telemetry/pagination rails.
5. **Operator layer**: transactional operator library with event/audit hooks.
6. **Studio render MVP**: render queue + FFmpeg export pipeline + artifact versioning.
7. **Marketplace hardening**: listings/assets/licenses/entitlements data model and UI.
8. **Observability baseline**: request-id propagation + structured logs + dashboard starter set.
9. **Backup/restore automation**: scripted snapshots + restore verification command.
10. **Acceptance + chaos tests**: CI gate for 10/10 readiness checklist.
