#!/bin/bash
# Endpoint Smoke Test — Zero 404s, Zero 500s
# Run after system has been up for at least 2 minutes.
# Usage: ./scripts/endpoint-audit.sh [base_url]
set -euo pipefail

BASE="${1:-https://concord-os.org}"
PASS=0
FAIL=0
WARN=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

check() {
  local method=$1 path=$2 expected=$3 description=$4
  local status
  status=$(curl -sk -o /dev/null -w "%{http_code}" -X "$method" "$BASE$path" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    PASS=$((PASS + 1))
    printf "${GREEN}PASS${NC} %s %s — %s (got %s)\n" "$method" "$path" "$description" "$status"
  elif [ "$status" = "000" ]; then
    FAIL=$((FAIL + 1))
    printf "${RED}FAIL${NC} %s %s — %s (connection refused)\n" "$method" "$path" "$description"
  elif [ "$status" = "401" ] && [ "$expected" != "401" ]; then
    WARN=$((WARN + 1))
    printf "${YELLOW}WARN${NC} %s %s — %s (got 401, auth may be required)\n" "$method" "$path" "$description"
  else
    FAIL=$((FAIL + 1))
    printf "${RED}FAIL${NC} %s %s — %s (expected %s, got %s)\n" "$method" "$path" "$description" "$expected" "$status"
  fi
}

echo "════════════════════════════════════════════════════════════════"
echo " ConcordOS Endpoint Audit — $BASE"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "── System Endpoints (no auth) ──"
check GET  /api/status          200 "System status"
check GET  /health              200 "Nginx health"
check GET  /ready               200 "Backend readiness"

echo ""
echo "── Auth Endpoints ──"
check POST /api/auth/csrf-token 200 "CSRF token generation"
check GET  /api/auth/me         401 "Auth check (unauthenticated)"

echo ""
echo "── DTU Endpoints ──"
check GET  /api/dtus            200 "DTU list"
check GET  /api/dtus/paginated  200 "DTU paginated list"

echo ""
echo "── Graph Endpoints ──"
check GET  /api/graph/force     200 "Force graph"
check GET  /api/graph/visual    200 "Visual graph"

echo ""
echo "── Emergent Endpoints ──"
check GET  /api/emergent/entities 200 "Emergent entities"

echo ""
echo "── Lattice/Resonance ──"
check GET  /api/lattice/resonance 200 "Lattice resonance"

echo ""
echo "── Search ──"
check GET  /api/search/indexed  200 "Indexed search"

echo ""
echo "── Brain ──"
check GET  /api/brain/status    200 "Brain status"
check GET  /api/brain/health    200 "Brain health"

echo ""
echo "── Learning Verification ──"
check GET  /api/learning/dashboard  200 "Learning dashboard"
check GET  /api/learning/retrieval  200 "Retrieval hit rate"
check GET  /api/learning/substrate  200 "Substrate stats"

echo ""
echo "── Economic System ──"
check GET  /api/economy/status  200 "Economy status"

echo ""
echo "── WebSocket ──"
check GET  /socket.io/          200 "Socket.io handshake"

echo ""
echo "════════════════════════════════════════════════════════════════"
printf " Results: ${GREEN}%d passed${NC}, ${RED}%d failed${NC}, ${YELLOW}%d warnings${NC}\n" "$PASS" "$FAIL" "$WARN"
echo "════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FIX: Any 404 = route not registered. Any 500 = runtime error in handler."
  exit 1
fi
