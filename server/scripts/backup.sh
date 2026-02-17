#!/bin/bash
# Concord Backup Script
# Creates a snapshot of:
#   - SQLite database (online backup)
#   - Artifacts directory
# Stores in /data/backups/ with a date-stamped filename.
# Retains rolling window of 7 backups.

set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/concord.db}"
ARTIFACTS_DIR="$DATA_DIR/artifacts"
BACKUP_DIR="$DATA_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETAIN_COUNT=7

mkdir -p "$BACKUP_DIR"

echo "[Backup] Starting backup at $TIMESTAMP"

# 1. SQLite online backup
if [ -f "$DB_PATH" ]; then
  BACKUP_DB="$BACKUP_DIR/concord-$TIMESTAMP.db"
  echo "[Backup] Copying database..."
  # Use sqlite3 .backup for online-safe copy, fall back to cp
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_DB'"
  else
    cp "$DB_PATH" "$BACKUP_DB"
  fi
  echo "[Backup] Database backed up to $BACKUP_DB"
else
  echo "[Backup] No database found at $DB_PATH — skipping DB backup"
fi

# 2. Artifacts tar snapshot
if [ -d "$ARTIFACTS_DIR" ] && [ "$(ls -A "$ARTIFACTS_DIR" 2>/dev/null)" ]; then
  BACKUP_TAR="$BACKUP_DIR/artifacts-$TIMESTAMP.tar.gz"
  echo "[Backup] Archiving artifacts..."
  tar -czf "$BACKUP_TAR" -C "$DATA_DIR" artifacts
  echo "[Backup] Artifacts backed up to $BACKUP_TAR"
else
  echo "[Backup] No artifacts directory found — skipping"
fi

# 3. Prune old backups (keep RETAIN_COUNT most recent of each type)
echo "[Backup] Pruning old backups (keeping $RETAIN_COUNT most recent)..."
cd "$BACKUP_DIR"

# Prune DB backups
ls -t concord-*.db 2>/dev/null | tail -n +$((RETAIN_COUNT + 1)) | xargs -r rm -f

# Prune artifact archives
ls -t artifacts-*.tar.gz 2>/dev/null | tail -n +$((RETAIN_COUNT + 1)) | xargs -r rm -f

echo "[Backup] Done. Backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" 2>/dev/null || echo "  (empty)"
