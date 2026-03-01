#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Rollback Concord Cognitive Engine to a previous deployment revision
#
# Usage:
#   ./scripts/rollback.sh staging
#   ./scripts/rollback.sh production
#   ./scripts/rollback.sh production 5       # rollback to specific revision
#   ./scripts/rollback.sh staging --backend-only
#   ./scripts/rollback.sh staging --frontend-only
#
# Prerequisites:
#   - kubectl configured with the target cluster
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

NAMESPACE="concord"
BACKEND_ONLY=false
FRONTEND_ONLY=false

# ── Parse arguments ──────────────────────────────────────────────────────
ENVIRONMENT="${1:-}"
shift || true

REVISION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only)
      BACKEND_ONLY=true
      shift
      ;;
    --frontend-only)
      FRONTEND_ONLY=true
      shift
      ;;
    [0-9]*)
      REVISION="$1"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Validate ─────────────────────────────────────────────────────────────
if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: $0 <staging|production> [revision] [--backend-only] [--frontend-only]"
  echo ""
  echo "Examples:"
  echo "  $0 staging                  # rollback both to previous revision"
  echo "  $0 production 5             # rollback both to revision 5"
  echo "  $0 staging --backend-only   # rollback only backend"
  exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Error: environment must be 'staging' or 'production'"
  exit 1
fi

# ── Helpers ──────────────────────────────────────────────────────────────
ts() { date "+%Y-%m-%dT%H:%M:%S"; }

log() {
  echo "[$(ts)] $1"
}

# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "========================================================"
echo "  Concord Kubernetes Rollback"
echo "  Environment: $ENVIRONMENT"
echo "  Revision:    ${REVISION:-previous}"
echo "  Namespace:   $NAMESPACE"
echo "========================================================"
echo ""

# ── Production safety gate ───────────────────────────────────────────────
if [[ "$ENVIRONMENT" == "production" ]]; then
  echo "WARNING: You are about to rollback PRODUCTION."
  echo ""

  # Show current state
  log "Current deployment state:"
  echo ""
  echo "--- Backend ---"
  kubectl rollout history deployment/concord-backend -n "$NAMESPACE" 2>/dev/null | tail -5 || echo "  (no history)"
  echo ""
  echo "--- Frontend ---"
  kubectl rollout history deployment/concord-frontend -n "$NAMESPACE" 2>/dev/null | tail -5 || echo "  (no history)"
  echo ""

  read -r -p "Type 'rollback-production' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "rollback-production" ]]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

# ── Verify connectivity ─────────────────────────────────────────────────
log "Checking cluster connectivity..."
if ! kubectl cluster-info > /dev/null 2>&1; then
  echo "Error: cannot connect to Kubernetes cluster."
  exit 1
fi

# ── Rollback backend ────────────────────────────────────────────────────
if [[ "$FRONTEND_ONLY" == false ]]; then
  log "Rolling back backend deployment..."
  if [[ -n "$REVISION" ]]; then
    kubectl rollout undo deployment/concord-backend -n "$NAMESPACE" \
      --to-revision="$REVISION"
  else
    kubectl rollout undo deployment/concord-backend -n "$NAMESPACE"
  fi

  log "Waiting for backend rollback to complete..."
  kubectl rollout status deployment/concord-backend -n "$NAMESPACE" --timeout=300s
  log "Backend rollback complete."
fi

# ── Rollback frontend ───────────────────────────────────────────────────
if [[ "$BACKEND_ONLY" == false ]]; then
  log "Rolling back frontend deployment..."
  if [[ -n "$REVISION" ]]; then
    kubectl rollout undo deployment/concord-frontend -n "$NAMESPACE" \
      --to-revision="$REVISION"
  else
    kubectl rollout undo deployment/concord-frontend -n "$NAMESPACE"
  fi

  log "Waiting for frontend rollback to complete..."
  kubectl rollout status deployment/concord-frontend -n "$NAMESPACE" --timeout=180s
  log "Frontend rollback complete."
fi

# ── Health verification ─────────────────────────────────────────────────
log "Verifying post-rollback health..."

kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=concord-backend \
  -n "$NAMESPACE" --timeout=120s 2>/dev/null || true

# Port-forward and check health
kubectl port-forward svc/concord-backend 5050:5050 -n "$NAMESPACE" &
PF_PID=$!
sleep 5

HEALTH=$(curl -sf http://localhost:5050/health 2>/dev/null || echo "UNAVAILABLE")
READY=$(curl -sf http://localhost:5050/ready 2>/dev/null || echo "UNAVAILABLE")

kill $PF_PID 2>/dev/null || true

log "Health: $HEALTH"
log "Ready:  $READY"

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "========================================================"
log "Rollback on $ENVIRONMENT completed."
echo ""
echo "Current state:"
kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/part-of=concord-cognitive-engine 2>/dev/null || true
echo "========================================================"
