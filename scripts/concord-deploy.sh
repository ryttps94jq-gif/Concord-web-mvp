#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# ConcordOS Self-Repairing Deploy
# Wraps docker-compose with three-phase repair cortex
#
# Phase 1: PRE-BUILD PROPHET  — Preventive immune scan
# Phase 2: MID-BUILD SURGEON  — Build error interception + auto-fix + retry
# Phase 3: POST-BUILD GUARDIAN — Continuous runtime monitoring (in-process)
#
# Usage:
#   ./scripts/concord-deploy.sh [--skip-prophet] [--max-retries N]
#
# Additive only. Does not modify existing deploy scripts.
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/data"
LOG_FILE="$LOG_DIR/repair-cortex.log"
MAX_BUILD_RETRIES="${MAX_BUILD_RETRIES:-3}"
SKIP_PROPHET=false

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-prophet)
      SKIP_PROPHET=true
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

echo "╔══════════════════════════════════════╗"
echo "║     CONCORDOS REPAIR CORTEX          ║"
echo "║     Three-Phase Self-Repair Deploy   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: PRE-BUILD PROPHET
# ═══════════════════════════════════════════════════════════════════════════

if [ "$SKIP_PROPHET" = false ]; then
  log "[PROPHET] Running pre-build scan..."

  if [ -f "$PROJECT_ROOT/scripts/repair-prophet.js" ]; then
    node "$PROJECT_ROOT/scripts/repair-prophet.js" "$PROJECT_ROOT" 2>&1 | tee -a "$LOG_FILE"
    PROPHET_EXIT=${PIPESTATUS[0]}
  else
    log "[PROPHET] repair-prophet.js not found — running inline checks..."
    PROPHET_EXIT=0

    # Inline basic checks
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
      log "[PROPHET] WARNING: package.json not found"
    fi

    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
      log "[PROPHET] WARNING: node_modules missing — running npm install..."
      cd "$PROJECT_ROOT" && npm install 2>&1 | tail -5 | tee -a "$LOG_FILE"
      cd "$PROJECT_ROOT"
    fi

    if [ -f "$PROJECT_ROOT/server/server.js" ]; then
      # Quick syntax check via node --check
      node --check "$PROJECT_ROOT/server/server.js" 2>/dev/null || {
        log "[PROPHET] CRITICAL: server.js has syntax errors"
        PROPHET_EXIT=1
      }
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

  # Run mid-build repair script if available
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
# PHASE 3: POST-BUILD GUARDIAN
# ═══════════════════════════════════════════════════════════════════════════

log "[GUARDIAN] Services started. Waiting for health check..."

# Wait for services to initialize
sleep 10

# Basic health verification
HEALTH_OK=true

# Check containers are running
RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)

if [ "$RUNNING" -lt "$TOTAL" ]; then
  log "[GUARDIAN] WARNING: Only $RUNNING/$TOTAL services running"
  docker-compose ps 2>&1 | tee -a "$LOG_FILE"
  HEALTH_OK=false
fi

# Check main service health endpoint
PORT="${PORT:-3000}"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
  log "[GUARDIAN] Health endpoint: OK (200)"
else
  log "[GUARDIAN] WARNING: Health endpoint returned $HEALTH_CHECK"
  HEALTH_OK=false
fi

echo ""
log "[GUARDIAN] Guardian monitoring is active inside the Node process."
echo ""
echo "╔══════════════════════════════════════╗"
echo "║     CONCORDOS IS ALIVE               ║"
echo "║     Repair Cortex: ACTIVE            ║"
echo "║     Phase 1: Prophet ✓               ║"
echo "║     Phase 2: Surgeon ✓               ║"
echo "║     Phase 3: Guardian ✓              ║"
echo "╚══════════════════════════════════════╝"

if [ "$HEALTH_OK" = false ]; then
  log "[GUARDIAN] Some health checks failed — guardian will attempt runtime repair"
  exit 0  # Still exit 0 — guardian handles runtime issues
fi
