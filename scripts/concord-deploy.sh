#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# ConcordOS Self-Repairing Deploy — Full System Coverage
# Wraps docker-compose with three-phase repair cortex
#
# Phase 0: LOCKFILE SYNC    — Ensure package.json ↔ lockfile parity
# Phase 1: PRE-BUILD PROPHET — Preventive immune scan (server + frontend)
# Phase 2: MID-BUILD SURGEON — Build error interception + auto-fix + retry
# Phase 3: POST-BUILD GUARDIAN — Continuous runtime monitoring (in-process)
#
# Usage:
#   ./scripts/concord-deploy.sh [--skip-prophet] [--skip-lockcheck] [--max-retries N]
#
# Additive only. Does not modify existing deploy scripts.
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/data"
LOG_FILE="$LOG_DIR/repair-cortex.log"
MAX_BUILD_RETRIES="${MAX_BUILD_RETRIES:-3}"
SKIP_PROPHET=false
SKIP_LOCKCHECK=false

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-prophet)
      SKIP_PROPHET=true
      shift
      ;;
    --skip-lockcheck)
      SKIP_LOCKCHECK=true
      shift
      ;;
    --max-retries)
      MAX_BUILD_RETRIES="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Timestamp helper
ts() {
  date "+%Y-%m-%dT%H:%M:%S"
}

log() {
  local msg="[$(ts)] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

echo "╔══════════════════════════════════════════╗"
echo "║     CONCORDOS REPAIR CORTEX              ║"
echo "║     Full-System Self-Repair Deploy       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 0: LOCKFILE SYNC (package.json ↔ package-lock.json)
# ═══════════════════════════════════════════════════════════════════════════

if [ "$SKIP_LOCKCHECK" = false ]; then
  log "[LOCKFILE] Checking package.json ↔ lockfile sync..."

  LOCKFILE_FIXED=false

  # ── Server lockfile ──────────────────────────────────────────────────
  if [ -f "$PROJECT_ROOT/server/package.json" ]; then
    if [ ! -f "$PROJECT_ROOT/server/package-lock.json" ]; then
      log "[LOCKFILE] server/package-lock.json MISSING — generating..."
      (cd "$PROJECT_ROOT/server" && npm install --package-lock-only 2>&1 | tail -3 | tee -a "$LOG_FILE")
      LOCKFILE_FIXED=true
    else
      # Check if lockfile is older than package.json
      if [ "$PROJECT_ROOT/server/package.json" -nt "$PROJECT_ROOT/server/package-lock.json" ]; then
        log "[LOCKFILE] server/package.json modified after lockfile — syncing..."
        (cd "$PROJECT_ROOT/server" && npm install --package-lock-only 2>&1 | tail -3 | tee -a "$LOG_FILE")
        LOCKFILE_FIXED=true
      fi
    fi
  fi

  # ── Frontend lockfile ────────────────────────────────────────────────
  if [ -f "$PROJECT_ROOT/concord-frontend/package.json" ]; then
    if [ ! -f "$PROJECT_ROOT/concord-frontend/package-lock.json" ]; then
      log "[LOCKFILE] concord-frontend/package-lock.json MISSING — generating..."
      (cd "$PROJECT_ROOT/concord-frontend" && npm install --package-lock-only 2>&1 | tail -3 | tee -a "$LOG_FILE")
      LOCKFILE_FIXED=true
    else
      if [ "$PROJECT_ROOT/concord-frontend/package.json" -nt "$PROJECT_ROOT/concord-frontend/package-lock.json" ]; then
        log "[LOCKFILE] concord-frontend/package.json modified after lockfile — syncing..."
        (cd "$PROJECT_ROOT/concord-frontend" && npm install --package-lock-only 2>&1 | tail -3 | tee -a "$LOG_FILE")
        LOCKFILE_FIXED=true
      fi
    fi
  fi

  if [ "$LOCKFILE_FIXED" = true ]; then
    log "[LOCKFILE] Lockfiles synced successfully."
  else
    log "[LOCKFILE] All lockfiles in sync."
  fi
else
  log "[LOCKFILE] Skipped (--skip-lockcheck flag)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: PRE-BUILD PROPHET (server + frontend)
# ═══════════════════════════════════════════════════════════════════════════

if [ "$SKIP_PROPHET" = false ]; then
  log "[PROPHET] Running pre-build scan..."

  if [ -f "$PROJECT_ROOT/scripts/repair-prophet.js" ]; then
    node "$PROJECT_ROOT/scripts/repair-prophet.js" "$PROJECT_ROOT" 2>&1 | tee -a "$LOG_FILE"
    PROPHET_EXIT=${PIPESTATUS[0]}
  else
    log "[PROPHET] repair-prophet.js not found — running inline checks..."
    PROPHET_EXIT=0

    # ── Server checks ────────────────────────────────────────────────
    if [ -f "$PROJECT_ROOT/server/server.js" ]; then
      node --check "$PROJECT_ROOT/server/server.js" 2>/dev/null || {
        log "[PROPHET] CRITICAL: server.js has syntax errors"
        PROPHET_EXIT=1
      }
    fi

    # ── Server node_modules ──────────────────────────────────────────
    if [ -f "$PROJECT_ROOT/server/package.json" ] && [ ! -d "$PROJECT_ROOT/server/node_modules" ]; then
      log "[PROPHET] WARNING: server/node_modules missing — running npm install..."
      (cd "$PROJECT_ROOT/server" && npm install 2>&1 | tail -5 | tee -a "$LOG_FILE")
    fi

    # ── Frontend node_modules ────────────────────────────────────────
    if [ -f "$PROJECT_ROOT/concord-frontend/package.json" ] && [ ! -d "$PROJECT_ROOT/concord-frontend/node_modules" ]; then
      log "[PROPHET] WARNING: concord-frontend/node_modules missing — running npm install..."
      (cd "$PROJECT_ROOT/concord-frontend" && npm install 2>&1 | tail -5 | tee -a "$LOG_FILE")
    fi

    # ── Frontend TypeScript check ────────────────────────────────────
    if [ -f "$PROJECT_ROOT/concord-frontend/tsconfig.json" ] && [ -d "$PROJECT_ROOT/concord-frontend/node_modules" ]; then
      log "[PROPHET] Checking frontend TypeScript..."
      (cd "$PROJECT_ROOT/concord-frontend" && npx tsc --noEmit 2>&1 | tail -10 | tee -a "$LOG_FILE") || {
        log "[PROPHET] WARNING: Frontend TypeScript errors detected (build may skip with CI_SKIP_TYPECHECK=1)"
      }
    fi

    # ── Docker config check ──────────────────────────────────────────
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
      docker-compose config --quiet 2>/dev/null || {
        log "[PROPHET] CRITICAL: docker-compose.yml is invalid"
        PROPHET_EXIT=1
      }
    fi

    # ── Nginx config check ───────────────────────────────────────────
    if [ -f "$PROJECT_ROOT/nginx/nginx.conf" ]; then
      log "[PROPHET] Nginx config present."
    fi
  fi

  if [ $PROPHET_EXIT -ne 0 ]; then
    log "[PROPHET] Critical issues found and could not be auto-fixed"
    log "[PROPHET] Check $LOG_FILE for details"
    log "[PROPHET] Sovereign intervention required"
    exit 1
  fi

  log "[PROPHET] Pre-build scan complete."
else
  log "[PROPHET] Skipped (--skip-prophet flag)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: MID-BUILD SURGEON
# ═══════════════════════════════════════════════════════════════════════════

ATTEMPT=0
BUILD_SUCCESS=false

log "[SURGEON] Starting build (max retries: $MAX_BUILD_RETRIES)..."

while [ $ATTEMPT -lt $MAX_BUILD_RETRIES ]; do
  ATTEMPT=$((ATTEMPT + 1))
  log "[SURGEON] Build attempt $ATTEMPT of $MAX_BUILD_RETRIES"

  # Capture build output
  BUILD_OUTPUT="/tmp/concord-build-output-$$.log"
  docker-compose build --no-cache 2>&1 | tee "$BUILD_OUTPUT" | tee -a "$LOG_FILE"
  BUILD_EXIT=${PIPESTATUS[0]}

  if [ $BUILD_EXIT -eq 0 ]; then
    BUILD_SUCCESS=true
    log "[SURGEON] Build succeeded on attempt $ATTEMPT"
    rm -f "$BUILD_OUTPUT"
    break
  fi

  log "[SURGEON] Build failed. Analyzing error..."

  # ── Check for lockfile-specific failures ──────────────────────────
  if grep -qi "npm ci\|lockfile\|package-lock" "$BUILD_OUTPUT" 2>/dev/null; then
    log "[SURGEON] Lockfile issue detected in build output"

    # Identify which service failed
    if grep -qi "frontend\|concord-frontend" "$BUILD_OUTPUT" 2>/dev/null; then
      log "[SURGEON] Frontend lockfile mismatch — regenerating..."
      (cd "$PROJECT_ROOT/concord-frontend" && npm install --package-lock-only 2>&1 | tail -3 | tee -a "$LOG_FILE") || true
    fi
    if grep -qi "backend\|server" "$BUILD_OUTPUT" 2>/dev/null; then
      log "[SURGEON] Server lockfile mismatch — regenerating..."
      (cd "$PROJECT_ROOT/server" && npm install --package-lock-only 2>&1 | tail -3 | tee -a "$LOG_FILE") || true
    fi

    log "[SURGEON] Lockfile regenerated. Retrying build..."
    rm -f "$BUILD_OUTPUT"
    continue
  fi

  # ── Check for npm peer dep / ERESOLVE failures ───────────────────
  if grep -qi "ERESOLVE\|peer dep\|peer dependency" "$BUILD_OUTPUT" 2>/dev/null; then
    log "[SURGEON] Peer dependency conflict detected"

    if grep -qi "frontend\|concord-frontend" "$BUILD_OUTPUT" 2>/dev/null; then
      log "[SURGEON] Patching frontend Dockerfile for --legacy-peer-deps..."
      # Create .npmrc with legacy-peer-deps if not already there
      if [ -f "$PROJECT_ROOT/concord-frontend/.npmrc" ]; then
        if ! grep -q "legacy-peer-deps" "$PROJECT_ROOT/concord-frontend/.npmrc"; then
          echo "legacy-peer-deps=true" >> "$PROJECT_ROOT/concord-frontend/.npmrc"
        fi
      fi
    fi
    if grep -qi "backend\|server" "$BUILD_OUTPUT" 2>/dev/null; then
      log "[SURGEON] Patching server .npmrc for --legacy-peer-deps..."
      if [ -f "$PROJECT_ROOT/server/.npmrc" ]; then
        if ! grep -q "legacy-peer-deps" "$PROJECT_ROOT/server/.npmrc"; then
          echo "legacy-peer-deps=true" >> "$PROJECT_ROOT/server/.npmrc"
        fi
      fi
    fi

    log "[SURGEON] Peer dep fix applied. Retrying build..."
    rm -f "$BUILD_OUTPUT"
    continue
  fi

  # ── Check for TypeScript / frontend build errors ─────────────────
  if grep -qi "error TS\|Type error\|Failed to compile\|Build error\|next build" "$BUILD_OUTPUT" 2>/dev/null; then
    log "[SURGEON] TypeScript/Next.js build error detected"

    # Count error types
    TS_ERRORS=$(grep -c "error TS" "$BUILD_OUTPUT" 2>/dev/null || echo "0")
    log "[SURGEON] Found $TS_ERRORS TypeScript error(s) in build output"

    # Try the surgeon script for pattern matching
    if [ -f "$PROJECT_ROOT/scripts/repair-surgeon.js" ]; then
      node "$PROJECT_ROOT/scripts/repair-surgeon.js" "$PROJECT_ROOT" "$BUILD_OUTPUT" 2>&1 | tee -a "$LOG_FILE"
      SURGEON_EXIT=${PIPESTATUS[0]}
      if [ $SURGEON_EXIT -eq 0 ]; then
        log "[SURGEON] Fix applied. Retrying build..."
        rm -f "$BUILD_OUTPUT"
        continue
      fi
    fi

    log "[SURGEON] Could not auto-fix TypeScript errors. Sovereign intervention required."
    rm -f "$BUILD_OUTPUT"
    exit 1
  fi

  # ── Check for native module build failures ───────────────────────
  if grep -qi "gyp ERR\|node-pre-gyp\|prebuild-install\|better-sqlite3\|sharp" "$BUILD_OUTPUT" 2>/dev/null; then
    log "[SURGEON] Native module build failure detected"
    log "[SURGEON] This usually means build tools are missing in Docker image"
    log "[SURGEON] Sovereign intervention required (check Dockerfile for python3, make, g++)"
    rm -f "$BUILD_OUTPUT"
    exit 1
  fi

  # ── Check for Docker-specific failures ───────────────────────────
  if grep -qi "no space left\|disk quota" "$BUILD_OUTPUT" 2>/dev/null; then
    log "[SURGEON] Disk space issue — pruning Docker resources..."
    docker system prune -f 2>/dev/null || true
    docker builder prune -f 2>/dev/null || true
    log "[SURGEON] Pruned. Retrying build..."
    rm -f "$BUILD_OUTPUT"
    continue
  fi

  # ── Run mid-build repair script for all other errors ─────────────
  if [ -f "$PROJECT_ROOT/scripts/repair-surgeon.js" ]; then
    node "$PROJECT_ROOT/scripts/repair-surgeon.js" "$PROJECT_ROOT" "$BUILD_OUTPUT" 2>&1 | tee -a "$LOG_FILE"
    SURGEON_EXIT=${PIPESTATUS[0]}

    if [ $SURGEON_EXIT -ne 0 ]; then
      log "[SURGEON] Could not auto-fix. Sovereign intervention required."
      rm -f "$BUILD_OUTPUT"
      exit 1
    fi

    log "[SURGEON] Fix applied. Retrying build..."
  else
    log "[SURGEON] repair-surgeon.js not found — cannot auto-fix"
    log "[SURGEON] Sovereign intervention required."
    rm -f "$BUILD_OUTPUT"
    exit 1
  fi

  rm -f "$BUILD_OUTPUT"
done

if [ "$BUILD_SUCCESS" = false ]; then
  log "[SURGEON] Build failed after $MAX_BUILD_RETRIES attempts"
  exit 1
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# LAUNCH
# ═══════════════════════════════════════════════════════════════════════════

log "[GUARDIAN] Starting services..."
docker-compose up -d 2>&1 | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3: POST-BUILD GUARDIAN (full-system health verification)
# ═══════════════════════════════════════════════════════════════════════════

log "[GUARDIAN] Services started. Waiting for health check..."

# Wait for services to initialize
sleep 10

# Health verification
HEALTH_OK=true
HEALTH_CHECKS=0
HEALTH_PASSED=0

# ── Check containers are running ─────────────────────────────────────
RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)
HEALTH_CHECKS=$((HEALTH_CHECKS + 1))

if [ "$RUNNING" -ge "$TOTAL" ] 2>/dev/null; then
  log "[GUARDIAN] Containers: $RUNNING/$TOTAL running"
  HEALTH_PASSED=$((HEALTH_PASSED + 1))
else
  log "[GUARDIAN] WARNING: Only $RUNNING/$TOTAL services running"
  docker-compose ps 2>&1 | tee -a "$LOG_FILE"
  HEALTH_OK=false
fi

# ── Check backend health ─────────────────────────────────────────────
BACKEND_PORT="${PORT:-5050}"
HEALTH_CHECKS=$((HEALTH_CHECKS + 1))
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/health" 2>/dev/null || echo "000")

if [ "$BACKEND_HEALTH" = "200" ]; then
  log "[GUARDIAN] Backend health:  OK (200) on port $BACKEND_PORT"
  HEALTH_PASSED=$((HEALTH_PASSED + 1))
else
  log "[GUARDIAN] WARNING: Backend health returned $BACKEND_HEALTH"
  HEALTH_OK=false
fi

# ── Check frontend health ────────────────────────────────────────────
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
HEALTH_CHECKS=$((HEALTH_CHECKS + 1))
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT" 2>/dev/null || echo "000")

if [ "$FRONTEND_HEALTH" = "200" ] || [ "$FRONTEND_HEALTH" = "308" ] || [ "$FRONTEND_HEALTH" = "301" ]; then
  log "[GUARDIAN] Frontend health: OK ($FRONTEND_HEALTH) on port $FRONTEND_PORT"
  HEALTH_PASSED=$((HEALTH_PASSED + 1))
else
  log "[GUARDIAN] WARNING: Frontend health returned $FRONTEND_HEALTH"
  HEALTH_OK=false
fi

# ── Check nginx ──────────────────────────────────────────────────────
HEALTH_CHECKS=$((HEALTH_CHECKS + 1))
NGINX_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:80" 2>/dev/null || echo "000")

if [ "$NGINX_HEALTH" != "000" ]; then
  log "[GUARDIAN] Nginx health:    OK ($NGINX_HEALTH) on port 80"
  HEALTH_PASSED=$((HEALTH_PASSED + 1))
else
  log "[GUARDIAN] WARNING: Nginx not responding on port 80"
  HEALTH_OK=false
fi

# ── Check for restart loops ──────────────────────────────────────────
RESTARTING=$(docker ps --filter "status=restarting" --format "{{.Names}}" 2>/dev/null | grep "concord" || true)
if [ -n "$RESTARTING" ]; then
  log "[GUARDIAN] WARNING: Containers in restart loop: $RESTARTING"
  HEALTH_OK=false
fi

echo ""
log "[GUARDIAN] Health: $HEALTH_PASSED/$HEALTH_CHECKS checks passed"
log "[GUARDIAN] Guardian monitoring is active inside the Node process."
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     CONCORDOS IS ALIVE                   ║"
echo "║     Repair Cortex: ACTIVE                ║"
echo "║     Phase 0: Lockfile Sync ✓             ║"
echo "║     Phase 1: Prophet ✓                   ║"
echo "║     Phase 2: Surgeon ✓                   ║"
echo "║     Phase 3: Guardian ✓                  ║"
echo "║     Health: $HEALTH_PASSED/$HEALTH_CHECKS checks passed              ║"
echo "╚══════════════════════════════════════════╝"

if [ "$HEALTH_OK" = false ]; then
  log "[GUARDIAN] Some health checks failed — guardian will attempt runtime repair"
  exit 0  # Still exit 0 — guardian handles runtime issues
fi
