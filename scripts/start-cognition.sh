#!/bin/bash
# ============================================================================
# Three-Brain Cognitive Architecture — Ollama Instance Manager
# ============================================================================
# Deploys three separate Ollama instances on the same machine with CPU pinning
# for true parallel cognition. All three brains share the same DTU substrate.
#
#   Brain 1 (Conscious)    — Qwen 2.5 7B   — Cores 0-3 — Port 11434
#   Brain 2 (Subconscious) — Qwen 2.5 1.5B — Cores 4-5 — Port 11435
#   Brain 3 (Utility)      — Qwen 2.5 3B   — Cores 6-7 — Port 11436
# ============================================================================

set -euo pipefail

CONSCIOUS_PORT=11434
SUBCONSCIOUS_PORT=11435
UTILITY_PORT=11436

CONSCIOUS_MODEL="qwen2.5:7b"
SUBCONSCIOUS_MODEL="qwen2.5:1.5b"
UTILITY_MODEL="qwen2.5:3b"

CONSCIOUS_CORES="0-3"
SUBCONSCIOUS_CORES="4-5"
UTILITY_CORES="6-7"

LOG_DIR="${LOG_DIR:-/var/log/concord}"
mkdir -p "$LOG_DIR"

log() {
  echo "[cognition] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

wait_for_ollama() {
  local port=$1
  local name=$2
  local max_attempts=30
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    if curl -sf "http://localhost:${port}/api/tags" > /dev/null 2>&1; then
      log "${name} is ready on port ${port}"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  log "ERROR: ${name} failed to start on port ${port} after ${max_attempts}s"
  return 1
}

# Kill existing instances
log "Stopping existing Ollama instances..."
pkill -f "ollama serve" 2>/dev/null || true
sleep 2

# Brain 1: Conscious — chat and deep reasoning (4 cores, ~5GB RAM)
log "Starting Brain 1 (Conscious) on port ${CONSCIOUS_PORT}, cores ${CONSCIOUS_CORES}..."
OLLAMA_HOST="0.0.0.0:${CONSCIOUS_PORT}" taskset -c "${CONSCIOUS_CORES}" ollama serve \
  > "${LOG_DIR}/brain-conscious.log" 2>&1 &
CONSCIOUS_PID=$!
log "Conscious PID: ${CONSCIOUS_PID}"

# Brain 2: Subconscious — autogen, dream, evolution, synthesis, birth (2 cores, ~1GB RAM)
log "Starting Brain 2 (Subconscious) on port ${SUBCONSCIOUS_PORT}, cores ${SUBCONSCIOUS_CORES}..."
OLLAMA_HOST="0.0.0.0:${SUBCONSCIOUS_PORT}" taskset -c "${SUBCONSCIOUS_CORES}" ollama serve \
  > "${LOG_DIR}/brain-subconscious.log" 2>&1 &
SUBCONSCIOUS_PID=$!
log "Subconscious PID: ${SUBCONSCIOUS_PID}"

# Brain 3: Utility — lens interactions, entity actions (2 cores, ~2.5GB RAM)
log "Starting Brain 3 (Utility) on port ${UTILITY_PORT}, cores ${UTILITY_CORES}..."
OLLAMA_HOST="0.0.0.0:${UTILITY_PORT}" taskset -c "${UTILITY_CORES}" ollama serve \
  > "${LOG_DIR}/brain-utility.log" 2>&1 &
UTILITY_PID=$!
log "Utility PID: ${UTILITY_PID}"

# Wait for all instances to be ready
log "Waiting for all brains to come online..."
wait_for_ollama "${CONSCIOUS_PORT}" "Conscious"
wait_for_ollama "${SUBCONSCIOUS_PORT}" "Subconscious"
wait_for_ollama "${UTILITY_PORT}" "Utility"

# Pull models
log "Pulling model for Conscious: ${CONSCIOUS_MODEL}..."
OLLAMA_HOST="0.0.0.0:${CONSCIOUS_PORT}" ollama pull "${CONSCIOUS_MODEL}"

log "Pulling model for Subconscious: ${SUBCONSCIOUS_MODEL}..."
OLLAMA_HOST="0.0.0.0:${SUBCONSCIOUS_PORT}" ollama pull "${SUBCONSCIOUS_MODEL}"

log "Pulling model for Utility: ${UTILITY_MODEL}..."
OLLAMA_HOST="0.0.0.0:${UTILITY_PORT}" ollama pull "${UTILITY_MODEL}"

log "============================================"
log "Three brains online"
log "  Conscious    (${CONSCIOUS_MODEL})    → http://localhost:${CONSCIOUS_PORT}"
log "  Subconscious (${SUBCONSCIOUS_MODEL}) → http://localhost:${SUBCONSCIOUS_PORT}"
log "  Utility      (${UTILITY_MODEL})      → http://localhost:${UTILITY_PORT}"
log "============================================"

# Verification
log "Verifying brain status..."
echo "Conscious models:"
curl -s "http://localhost:${CONSCIOUS_PORT}/api/tags" | grep -o '"name":"[^"]*"' || echo "  (none yet)"
echo "Subconscious models:"
curl -s "http://localhost:${SUBCONSCIOUS_PORT}/api/tags" | grep -o '"name":"[^"]*"' || echo "  (none yet)"
echo "Utility models:"
curl -s "http://localhost:${UTILITY_PORT}/api/tags" | grep -o '"name":"[^"]*"' || echo "  (none yet)"

# Keep running (trap for clean shutdown)
trap 'log "Shutting down brains..."; kill $CONSCIOUS_PID $SUBCONSCIOUS_PID $UTILITY_PID 2>/dev/null; exit 0' SIGTERM SIGINT

log "All brains running. Press Ctrl+C to stop."
wait
