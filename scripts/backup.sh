#!/bin/bash
# Concord Automated Backup
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Backup SQLite database
cp /data/db/concord.db "$BACKUP_DIR/concord_$TIMESTAMP.db" 2>/dev/null

# Backup state JSON
cp /data/concord_state.json "$BACKUP_DIR/state_$TIMESTAMP.json" 2>/dev/null

# Compress
tar -czf "$BACKUP_DIR/concord_backup_$TIMESTAMP.tar.gz" \
  "$BACKUP_DIR/concord_$TIMESTAMP.db" \
  "$BACKUP_DIR/state_$TIMESTAMP.json" 2>/dev/null

# Cleanup individual files
rm -f "$BACKUP_DIR/concord_$TIMESTAMP.db" "$BACKUP_DIR/state_$TIMESTAMP.json" 2>/dev/null

# Rotate: keep last 30 backups
ls -t "$BACKUP_DIR"/concord_backup_*.tar.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null

echo "[Backup] Completed: concord_backup_$TIMESTAMP.tar.gz"
