#!/bin/bash
# Concord Restore Script
# Restores from a backup snapshot:
#   - SQLite database (supports both .db and .db.gz formats)
#   - Artifacts directory (optional)
#
# Usage:
#   ./restore.sh                              # Restore latest backup
#   ./restore.sh concord-20240101.db          # Restore specific DB backup
#   ./restore.sh concord-20240101.db.gz       # Restore specific compressed backup

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
  BACKUP_FILE="$BACKUP_DIR/$1"
else
  # Find latest DB backup (prefer compressed)
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/concord-*.db.gz 2>/dev/null | head -1 || echo "")
  if [ -z "$BACKUP_FILE" ]; then
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/concord-*.db 2>/dev/null | head -1 || echo "")
  fi
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "[Restore] ERROR: No backup found. Available backups:"
  ls -lh "$BACKUP_DIR" 2>/dev/null || echo "  (none)"
  exit 1
fi

echo "[Restore] Using backup: $BACKUP_FILE"

# Decompress if needed
CLEANUP_TEMP=false
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "[Restore] Decompressing backup..."
  RESTORE_DB="${BACKUP_FILE%.gz}"
  gunzip -k "$BACKUP_FILE"
  CLEANUP_TEMP=true
else
  RESTORE_DB="$BACKUP_FILE"
fi

# Verify integrity before replacing
if command -v sqlite3 &>/dev/null; then
  echo "[Restore] Running integrity check..."
  RESULT=$(sqlite3 "$RESTORE_DB" "PRAGMA integrity_check;" 2>&1)
  if [ "$RESULT" = "ok" ]; then
    echo "[Restore] Integrity check: OK"
  else
    echo "[Restore] INTEGRITY CHECK FAILED: $RESULT"
    echo "[Restore] Aborting restore."
    if [ "$CLEANUP_TEMP" = true ]; then rm -f "$RESTORE_DB"; fi
    exit 1
  fi
fi

# Backup current before replacing
if [ -f "$DB_PATH" ]; then
  echo "[Restore] Moving current DB to $DB_PATH.pre-restore"
  mv "$DB_PATH" "$DB_PATH.pre-restore"
fi

# Replace with backup
cp "$RESTORE_DB" "$DB_PATH"
echo "[Restore] Database restored"

# Clean up temp decompressed file
if [ "$CLEANUP_TEMP" = true ]; then
  rm -f "$RESTORE_DB"
fi

# Restore artifacts (find matching timestamp)
BACKUP_BASENAME=$(basename "$BACKUP_FILE")
BACKUP_TIMESTAMP=$(echo "$BACKUP_BASENAME" | sed 's/concord-\(.*\)\.db\(\.gz\)\?/\1/')
BACKUP_TAR="$BACKUP_DIR/artifacts-$BACKUP_TIMESTAMP.tar.gz"

if [ -f "$BACKUP_TAR" ]; then
  echo "[Restore] Restoring artifacts from $BACKUP_TAR..."
  tar -xzf "$BACKUP_TAR" -C "$DATA_DIR"
  echo "[Restore] Artifacts restored"
else
  echo "[Restore] No matching artifact archive found for timestamp $BACKUP_TIMESTAMP — skipping"
fi

echo "[Restore] Done."
