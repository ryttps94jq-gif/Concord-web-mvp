#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Deploy Concord Cognitive Engine to Kubernetes
#
# Usage:
#   ./scripts/deploy.sh staging
#   ./scripts/deploy.sh production
#   ./scripts/deploy.sh staging --image-tag abc1234
#   ./scripts/deploy.sh production --dry-run
#
# Prerequisites:
#   - kubectl configured with the target cluster
#   - Docker images already built and pushed to the registry
#   - k8s/ directory with all manifests
#
# Environment variables:
#   REGISTRY          Docker registry (default: ghcr.io)
#   IMAGE_OWNER       Image owner/org (default: concord-os)
#   IMAGE_TAG         Image tag (default: latest)
#   KUBECONFIG        Path to kubeconfig (default: ~/.kube/config)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"

# ── Defaults ─────────────────────────────────────────────────────────────
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_OWNER="${IMAGE_OWNER:-concord-os}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="concord"
DRY_RUN=false

# ── Parse arguments ──────────────────────────────────────────────────────
ENVIRONMENT="${1:-}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Validate ─────────────────────────────────────────────────────────────
if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: $0 <staging|production> [--image-tag TAG] [--dry-run]"
  exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Error: environment must be 'staging' or 'production'"
  exit 1
fi

BACKEND_IMAGE="${REGISTRY}/${IMAGE_OWNER}/concord-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${REGISTRY}/${IMAGE_OWNER}/concord-frontend:${IMAGE_TAG}"

# ── Helpers ──────────────────────────────────────────────────────────────
ts() { date "+%Y-%m-%dT%H:%M:%S"; }

log() {
  echo "[$(ts)] $1"
}

kube() {
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] kubectl $*"
  else
    kubectl "$@"
  fi
}

# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "========================================================"
echo "  Concord Kubernetes Deploy"
echo "  Environment: $ENVIRONMENT"
echo "  Backend:     $BACKEND_IMAGE"
echo "  Frontend:    $FRONTEND_IMAGE"
echo "  Namespace:   $NAMESPACE"
echo "  Dry run:     $DRY_RUN"
echo "========================================================"
echo ""

# ── Production safety gate ───────────────────────────────────────────────
if [[ "$ENVIRONMENT" == "production" && "$DRY_RUN" == false ]]; then
  echo "WARNING: You are about to deploy to PRODUCTION."
  echo ""
  read -r -p "Type 'deploy-production' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "deploy-production" ]]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

# ── Step 1: Verify manifests exist ──────────────────────────────────────
log "Verifying K8s manifests..."
REQUIRED_FILES=(
  "namespace.yaml"
  "configmap.yaml"
  "pvc.yaml"
  "backend-deployment.yaml"
  "backend-service.yaml"
  "frontend-deployment.yaml"
  "frontend-service.yaml"
  "ingress.yaml"
  "hpa.yaml"
  "network-policies.yaml"
  "cronjob-backup.yaml"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$K8S_DIR/$f" ]]; then
    echo "Error: missing manifest: $K8S_DIR/$f"
    exit 1
  fi
done
log "All manifests present."

# ── Step 2: Verify cluster connectivity ─────────────────────────────────
log "Checking cluster connectivity..."
if [ "$DRY_RUN" = false ]; then
  if ! kubectl cluster-info > /dev/null 2>&1; then
    echo "Error: cannot connect to Kubernetes cluster."
    echo "Check your KUBECONFIG or kubectl context."
    exit 1
  fi
  log "Cluster connected."
fi

# ── Step 3: Record pre-deploy state ────────────────────────────────────
if [ "$DRY_RUN" = false ]; then
  log "Recording pre-deploy revision..."
  BACKEND_REV=$(kubectl rollout history deployment/concord-backend -n "$NAMESPACE" 2>/dev/null \
    | tail -2 | head -1 | awk '{print $1}' || echo "0")
  FRONTEND_REV=$(kubectl rollout history deployment/concord-frontend -n "$NAMESPACE" 2>/dev/null \
    | tail -2 | head -1 | awk '{print $1}' || echo "0")
  log "Backend revision: $BACKEND_REV, Frontend revision: $FRONTEND_REV"
fi

# ── Step 4: Apply manifests ─────────────────────────────────────────────
log "Applying namespace and configuration..."
kube apply -f "$K8S_DIR/namespace.yaml"
kube apply -f "$K8S_DIR/configmap.yaml"
kube apply -f "$K8S_DIR/pvc.yaml"
kube apply -f "$K8S_DIR/network-policies.yaml"

# Apply secrets only in staging (production uses external secrets management)
if [[ "$ENVIRONMENT" == "staging" ]]; then
  log "Applying secrets (staging)..."
  kube apply -f "$K8S_DIR/secrets.yaml"
fi

log "Applying backend..."
kube apply -f "$K8S_DIR/backend-deployment.yaml"
kube apply -f "$K8S_DIR/backend-service.yaml"

log "Applying frontend..."
kube apply -f "$K8S_DIR/frontend-deployment.yaml"
kube apply -f "$K8S_DIR/frontend-service.yaml"

log "Applying ingress, autoscaling, and backup..."
kube apply -f "$K8S_DIR/ingress.yaml"
kube apply -f "$K8S_DIR/hpa.yaml"
kube apply -f "$K8S_DIR/cronjob-backup.yaml"

# ── Step 5: Set image tags ──────────────────────────────────────────────
log "Setting image tags..."
kube set image deployment/concord-backend \
  backend="$BACKEND_IMAGE" -n "$NAMESPACE"
kube set image deployment/concord-frontend \
  frontend="$FRONTEND_IMAGE" -n "$NAMESPACE"

# ── Step 6: Wait for rollout ────────────────────────────────────────────
if [ "$DRY_RUN" = false ]; then
  log "Waiting for backend rollout..."
  kubectl rollout status deployment/concord-backend -n "$NAMESPACE" --timeout=600s

  log "Waiting for frontend rollout..."
  kubectl rollout status deployment/concord-frontend -n "$NAMESPACE" --timeout=300s
fi

# ── Step 7: Health verification ─────────────────────────────────────────
if [ "$DRY_RUN" = false ]; then
  log "Running health verification..."

  kubectl wait --for=condition=ready pod \
    -l app.kubernetes.io/name=concord-backend \
    -n "$NAMESPACE" --timeout=120s

  # Port-forward for health check
  kubectl port-forward svc/concord-backend 5050:5050 -n "$NAMESPACE" &
  PF_PID=$!
  sleep 5

  HEALTH_OK=false
  for i in $(seq 1 5); do
    HEALTH=$(curl -sf http://localhost:5050/health 2>/dev/null || echo "")
    if [ -n "$HEALTH" ]; then
      log "Health check passed on attempt $i"
      HEALTH_OK=true
      break
    fi
    log "Health check attempt $i/5 failed, retrying..."
    sleep 3
  done

  kill $PF_PID 2>/dev/null || true

  if [ "$HEALTH_OK" = false ]; then
    log "CRITICAL: Health check failed. Initiating rollback..."
    bash "$SCRIPT_DIR/rollback.sh" "$ENVIRONMENT"
    exit 1
  fi
fi

# ── Done ────────────────────────────────────────────────────────────────
echo ""
echo "========================================================"
log "Deploy to $ENVIRONMENT completed successfully."
echo "  Backend:  $BACKEND_IMAGE"
echo "  Frontend: $FRONTEND_IMAGE"
echo "========================================================"
