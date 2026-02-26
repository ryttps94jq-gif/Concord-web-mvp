#!/bin/bash
# ConcordOS Deployment Verification — Phase 10
# Runs the full verification suite after docker compose up.
# Usage: ./scripts/verify-deployment.sh [base_url]
set -euo pipefail

BASE="${1:-https://concord-os.org}"
PASS=0
FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

pass() { PASS=$((PASS + 1)); printf "${GREEN}✓${NC} %s\n" "$1"; }
fail() { FAIL=$((FAIL + 1)); printf "${RED}✗${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$1"; }
section() { echo ""; printf "${BOLD}── %s ──${NC}\n" "$1"; }

# ═══════════════════════════════════════════════════════════════
section "10A: Docker Container Health"
# ═══════════════════════════════════════════════════════════════

# Check all containers are running
CONTAINERS=$(docker compose ps --format json 2>/dev/null | grep -c '"running"' || echo "0")
if [ "$CONTAINERS" -ge 6 ]; then
  pass "All containers running ($CONTAINERS services)"
else
  fail "Only $CONTAINERS containers running (expected >= 6)"
fi

# Check for restart loops
RESTARTING=$(docker compose ps 2>/dev/null | grep -c "Restarting" || echo "0")
if [ "$RESTARTING" -eq 0 ]; then
  pass "No containers in restart loop"
else
  fail "$RESTARTING container(s) restarting"
fi

# ═══════════════════════════════════════════════════════════════
section "10B: Service Reachability"
# ═══════════════════════════════════════════════════════════════

# Backend health
STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE/api/status" 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then
  pass "Backend returns 200 on /api/status"
else
  fail "Backend returned $STATUS on /api/status"
fi

# Frontend serves HTML
FRONTEND=$(curl -sk "$BASE" 2>/dev/null | head -5 | grep -c "html" || echo "0")
if [ "$FRONTEND" -gt 0 ]; then
  pass "Frontend serves HTML"
else
  fail "Frontend did not return HTML"
fi

# WebSocket reachable
WS_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE/socket.io/" 2>/dev/null || echo "000")
if [ "$WS_STATUS" != "000" ] && [ "$WS_STATUS" != "502" ]; then
  pass "WebSocket endpoint reachable (status: $WS_STATUS)"
else
  fail "WebSocket endpoint unreachable"
fi

# Ollama models loaded
for brain in conscious subconscious utility repair; do
  CONTAINER="concord-ollama-$brain"
  MODEL_COUNT=$(docker exec "$CONTAINER" ollama list 2>/dev/null | tail -n +2 | wc -l || echo "0")
  if [ "$MODEL_COUNT" -gt 0 ]; then
    pass "Ollama $brain has $MODEL_COUNT model(s) loaded"
  else
    warn "Ollama $brain has no models loaded yet (may still be pulling)"
  fi
done

# ═══════════════════════════════════════════════════════════════
section "10C: 5-Minute Soak Checks"
# ═══════════════════════════════════════════════════════════════

# DTU count growing
DTU_COUNT=$(curl -sk "$BASE/api/status" 2>/dev/null | grep -o '"dtus":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
if [ "$DTU_COUNT" -gt 0 ]; then
  pass "DTU count: $DTU_COUNT"
else
  fail "DTU count is 0 — substrate may not have loaded"
fi

# Error count in recent logs
ERROR_COUNT=$(docker logs --tail 100 concord-backend 2>&1 | grep -ci "error" || echo "0")
if [ "$ERROR_COUNT" -lt 5 ]; then
  pass "Backend error count in last 100 lines: $ERROR_COUNT"
else
  fail "Backend has $ERROR_COUNT errors in last 100 log lines"
fi

# Brain status
BRAIN_STATUS=$(curl -sk "$BASE/api/brain/status" 2>/dev/null || echo "{}")
BRAINS_ONLINE=$(echo "$BRAIN_STATUS" | grep -o '"enabled":true' | wc -l || echo "0")
if [ "$BRAINS_ONLINE" -ge 3 ]; then
  pass "$BRAINS_ONLINE brains online"
elif [ "$BRAINS_ONLINE" -ge 1 ]; then
  warn "Only $BRAINS_ONLINE brain(s) online (expected >= 3)"
else
  fail "No brains online"
fi

# ═══════════════════════════════════════════════════════════════
section "Endpoint Audit"
# ═══════════════════════════════════════════════════════════════

# Run the endpoint audit script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$SCRIPT_DIR/endpoint-audit.sh" ]; then
  "$SCRIPT_DIR/endpoint-audit.sh" "$BASE" || true
else
  warn "endpoint-audit.sh not found or not executable"
fi

# ═══════════════════════════════════════════════════════════════
section "Summary"
# ═══════════════════════════════════════════════════════════════

echo ""
printf "Verification: ${GREEN}%d passed${NC}, ${RED}%d failed${NC}\n" "$PASS" "$FAIL"

if [ "$FAIL" -eq 0 ]; then
  printf "\n${GREEN}${BOLD}DEPLOYMENT VERIFIED${NC}\n"
  exit 0
else
  printf "\n${RED}${BOLD}DEPLOYMENT HAS ISSUES — fix before production${NC}\n"
  exit 1
fi
