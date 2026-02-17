#!/bin/bash
# Concord Restore Script
# Restores from a backup snapshot:
#   - SQLite database
#   - Artifacts directory (optional)
#
# Usage:
#   ./restore.sh                        # Restore latest backup
#   ./restore.sh concord-20240101.db    # Restore specific DB backup

set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/concord.db}"
ARTIFACTS_DIR="$DATA_DIR/artifacts"
BACKUP_DIR="$DATA_DIR/backups"

mkdir -p "$(dirname "$DB_PATH")"
mkdir -p "$ARTIFACTS_DIR"

echo "[Restore] Starting restore..."

# Determine which backup to restore
if [ "${1:-}" != "" ]; then
  BACKUP_DB="$BACKUP_DIR/$1"
else
  # Find latest DB backup
  BACKUP_DB=$(ls -t "$BACKUP_DIR"/concord-*.db 2>/dev/null | head -1 || echo "")
fi

if [ -z "$BACKUP_DB" ] || [ ! -f "$BACKUP_DB" ]; then
  echo "[Restore] ERROR: No backup found. Available backups:"
  ls -lh "$BACKUP_DIR" 2>/dev/null || echo "  (none)"
  exit 1
fi

echo "[Restore] Using database backup: $BACKUP_DB"

# 1. Restore database
if [ -f "$DB_PATH" ]; then
  echo "[Restore] Moving current DB to $DB_PATH.pre-restore"
  mv "$DB_PATH" "$DB_PATH.pre-restore"
fi
cp "$BACKUP_DB" "$DB_PATH"
echo "[Restore] Database restored"

# 2. Restore artifacts (find matching timestamp)
BACKUP_TIMESTAMP=$(basename "$BACKUP_DB" | sed 's/concord-\(.*\)\.db/\1/')
BACKUP_TAR="$BACKUP_DIR/artifacts-$BACKUP_TIMESTAMP.tar.gz"

if [ -f "$BACKUP_TAR" ]; then
  echo "[Restore] Restoring artifacts from $BACKUP_TAR..."
  tar -xzf "$BACKUP_TAR" -C "$DATA_DIR"
  echo "[Restore] Artifacts restored"
else
  echo "[Restore] No matching artifact archive found for timestamp $BACKUP_TIMESTAMP — skipping"
fi

# 3. Integrity check (optional)
if command -v sqlite3 &>/dev/null; then
  echo "[Restore] Running integrity check..."
  RESULT=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)
  if [ "$RESULT" = "ok" ]; then
    echo "[Restore] Integrity check: OK"
  else
    echo "[Restore] WARNING: Integrity check returned: $RESULT"
  fi
fi

echo "[Restore] Done."
