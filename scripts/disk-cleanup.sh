#!/bin/bash
# Disk Cleanup — run after every deploy and on cron
# Crontab: 0 */6 * * * /var/www/concord-cognitive-engine/scripts/disk-cleanup.sh
set -euo pipefail

echo "[disk-cleanup] Starting cleanup at $(date)"

# Docker cleanup: remove dangling images, stopped containers, unused networks
docker system prune -f --volumes --filter "until=48h" 2>/dev/null || true
docker builder prune -f --filter "until=48h" 2>/dev/null || true

# Journal vacuum
journalctl --vacuum-size=100M 2>/dev/null || true

# Log rotation cleanup
find /var/log -name "*.gz" -delete 2>/dev/null || true
find /var/log -name "*.1" -delete 2>/dev/null || true

# Qdrant snapshot bomb prevention — prune if snapshots exceed 25GB
QDRANT_DIR=$(docker volume inspect concord_qdrant_data -f '{{.Mountpoint}}' 2>/dev/null || echo "")
if [ -n "$QDRANT_DIR" ] && [ -d "$QDRANT_DIR/snapshots" ]; then
  SNAP_SIZE=$(du -sb "$QDRANT_DIR/snapshots" 2>/dev/null | cut -f1)
  if [ "${SNAP_SIZE:-0}" -gt 25000000000 ]; then
    rm -rf "$QDRANT_DIR/snapshots"/*
    echo "[disk-cleanup] Pruned Qdrant snapshots (was $(( SNAP_SIZE / 1000000000 ))GB)"
  fi
fi

# Prometheus data check — warn if over 10GB
PROM_DIR=$(docker volume inspect concord_prometheus_data -f '{{.Mountpoint}}' 2>/dev/null || echo "")
if [ -n "$PROM_DIR" ] && [ -d "$PROM_DIR" ]; then
  PROM_SIZE=$(du -sb "$PROM_DIR" 2>/dev/null | cut -f1)
  if [ "${PROM_SIZE:-0}" -gt 10000000000 ]; then
    echo "[disk-cleanup] WARNING: Prometheus data is $(( PROM_SIZE / 1000000000 ))GB — consider reducing retention"
  fi
fi

# Ollama model cache cleanup — remove unused models older than 7 days
for vol in concord_ollama-conscious-data concord_ollama-subconscious-data concord_ollama-utility-data concord_ollama-repair-data; do
  OLLAMA_DIR=$(docker volume inspect "$vol" -f '{{.Mountpoint}}' 2>/dev/null || echo "")
  if [ -n "$OLLAMA_DIR" ] && [ -d "$OLLAMA_DIR/models/blobs" ]; then
    # Clean orphan temp files older than 2 days
    find "$OLLAMA_DIR/models/blobs" -name "sha256-*-partial-*" -mtime +2 -delete 2>/dev/null || true
  fi
done

echo "[disk-cleanup] Disk after cleanup:"
df -h / 2>/dev/null || df -h
echo "[disk-cleanup] Done at $(date)"
