#!/bin/bash
# Concord Offsite Restore — S3
#
# Downloads a backup from S3 and restores it using the existing local
# restore script. Supports listing available backups, restoring the
# latest, or restoring a specific timestamp.
#
# Usage:
#   ./restore-s3.sh                    # Restore latest from S3
#   ./restore-s3.sh 20240101_120000    # Restore specific timestamp
#   ./restore-s3.sh --list             # List available S3 backups
#   ./restore-s3.sh --list-detail      # List with sizes and dates
#
# Env vars:
#   AWS_BUCKET            — S3 bucket name (required)
#   AWS_REGION            — AWS region (default: us-east-1)
#   AWS_ACCESS_KEY_ID     — AWS access key (or use IAM role)
#   AWS_SECRET_ACCESS_KEY — AWS secret key
#   BACKUP_ENCRYPTION_KEY — Optional decryption key (must match encryption key)
#   DATA_DIR              — Data directory (default: /data)
#   DB_PATH               — SQLite DB path (default: $DATA_DIR/db/concord.db)
#
# Exit codes:
#   0 — success
#   1 — configuration error
#   2 — S3 download failed
#   3 — restore failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-/data}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/concord.db}"
BACKUP_DIR="$DATA_DIR/backups"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_BUCKET="${AWS_BUCKET:-}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
S3_PREFIX="concord-backups"
RESTORE_TIMESTAMP="${1:-}"

mkdir -p "$BACKUP_DIR"

# ── Validate configuration ──────────────────────────────────────────────
if [ -z "$AWS_BUCKET" ]; then
  echo "[S3-Restore] ERROR: AWS_BUCKET environment variable is required"
  echo "  Set AWS_BUCKET to the S3 bucket containing your backups"
  exit 1
fi

# ── Helper: List S3 backups ─────────────────────────────────────────────
list_s3_backups() {
  local detail="${1:-false}"

  echo "[S3-Restore] Available backups in s3://${AWS_BUCKET}/${S3_PREFIX}/"
  echo ""

  if command -v aws &>/dev/null; then
    echo "Database backups:"
    echo "─────────────────────────────────────────────────────────"

    if [ "$detail" = "true" ]; then
      aws s3 ls "s3://${AWS_BUCKET}/${S3_PREFIX}/db/" \
        --region "$AWS_REGION" 2>/dev/null | while read -r line; do
        # Parse: 2024-01-01 12:00:00  1234567 concord-20240101_120000.db.gz
        local date_part size_part file_part
        date_part=$(echo "$line" | awk '{print $1, $2}')
        size_part=$(echo "$line" | awk '{print $3}')
        file_part=$(echo "$line" | awk '{print $4}')
        local ts
        ts=$(echo "$file_part" | sed 's/concord-\(.*\)\.db\.gz/\1/')

        # Format size
        local human_size
        if [ "$size_part" -gt 1073741824 ] 2>/dev/null; then
          human_size="$(echo "scale=2; $size_part / 1073741824" | bc 2>/dev/null || echo "$size_part") GB"
        elif [ "$size_part" -gt 1048576 ] 2>/dev/null; then
          human_size="$(echo "scale=2; $size_part / 1048576" | bc 2>/dev/null || echo "$size_part") MB"
        elif [ "$size_part" -gt 1024 ] 2>/dev/null; then
          human_size="$(echo "scale=2; $size_part / 1024" | bc 2>/dev/null || echo "$size_part") KB"
        else
          human_size="${size_part} B"
        fi

        printf "  %-20s  %10s  %s\n" "$ts" "$human_size" "$date_part"
      done
    else
      aws s3 ls "s3://${AWS_BUCKET}/${S3_PREFIX}/db/" \
        --region "$AWS_REGION" 2>/dev/null | awk '{print $4}' | \
        sed 's/concord-\(.*\)\.db\.gz/  \1/' | sort -r
    fi

    echo ""
    echo "Artifact backups:"
    echo "─────────────────────────────────────────────────────────"
    aws s3 ls "s3://${AWS_BUCKET}/${S3_PREFIX}/artifacts/" \
      --region "$AWS_REGION" 2>/dev/null | awk '{print "  " $4}' | sort -r

    if [ -z "$(aws s3 ls "s3://${AWS_BUCKET}/${S3_PREFIX}/artifacts/" --region "$AWS_REGION" 2>/dev/null)" ]; then
      echo "  (none)"
    fi
  else
    echo "[S3-Restore] ERROR: aws CLI is required for listing S3 backups"
    echo "  Install the AWS CLI or use: ./restore-s3.sh <timestamp>"
    exit 1
  fi
}

# ── Helper: Download from S3 ────────────────────────────────────────────
download_from_s3() {
  local s3_key="$1"
  local local_path="$2"

  echo "[S3-Restore] Downloading s3://${AWS_BUCKET}/${s3_key} to ${local_path}"

  if command -v aws &>/dev/null; then
    local aws_args=(
      s3 cp "s3://${AWS_BUCKET}/${s3_key}" "$local_path"
      --region "$AWS_REGION"
    )

    if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
      aws_args+=(--sse-c AES256 --sse-c-key "$BACKUP_ENCRYPTION_KEY")
    fi

    if ! aws "${aws_args[@]}" 2>&1; then
      echo "[S3-Restore] ERROR: Download failed for $s3_key"
      return 1
    fi
  else
    # Fallback: curl with AWS Signature V4
    echo "[S3-Restore] aws CLI not found, using curl with Signature V4"

    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
      echo "[S3-Restore] ERROR: AWS credentials required for curl fallback"
      return 1
    fi

    local host="${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com"
    local uri="/${s3_key}"
    local amz_date
    amz_date=$(date -u +%Y%m%dT%H%M%SZ)
    local date_stamp
    date_stamp=$(date -u +%Y%m%d)

    local payload_hash="UNSIGNED-PAYLOAD"
    local content_type="application/octet-stream"
    local credential_scope="${date_stamp}/${AWS_REGION}/s3/aws4_request"
    local signed_headers="host;x-amz-content-sha256;x-amz-date"
    local canonical_headers="host:${host}\nx-amz-content-sha256:${payload_hash}\nx-amz-date:${amz_date}"
    local canonical_request="GET\n${uri}\n\n${canonical_headers}\n\n${signed_headers}\n${payload_hash}"

    local canonical_hash
    canonical_hash=$(printf '%b' "$canonical_request" | openssl dgst -sha256 -hex 2>/dev/null | awk '{print $NF}')

    local string_to_sign="AWS4-HMAC-SHA256\n${amz_date}\n${credential_scope}\n${canonical_hash}"

    # Derive signing key
    local k_date k_region k_service k_signing signature
    k_date=$(printf '%s' "$date_stamp" | openssl dgst -sha256 -mac HMAC -macopt "key:AWS4${AWS_SECRET_ACCESS_KEY}" -binary 2>/dev/null)
    k_region=$(printf '%s' "$AWS_REGION" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$(printf '%s' "$k_date" | xxd -p -c 256)" -binary 2>/dev/null)
    k_service=$(printf '%s' "s3" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$(printf '%s' "$k_region" | xxd -p -c 256)" -binary 2>/dev/null)
    k_signing=$(printf '%s' "aws4_request" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$(printf '%s' "$k_service" | xxd -p -c 256)" -binary 2>/dev/null)

    signature=$(printf '%b' "$string_to_sign" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$(printf '%s' "$k_signing" | xxd -p -c 256)" -hex 2>/dev/null | awk '{print $NF}')

    local authorization="AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}"

    local http_code
    http_code=$(curl -s -o "$local_path" -w "%{http_code}" \
      -X GET \
      "https://${host}${uri}" \
      -H "Host: ${host}" \
      -H "x-amz-content-sha256: ${payload_hash}" \
      -H "x-amz-date: ${amz_date}" \
      -H "Authorization: ${authorization}" \
      --max-time 600)

    if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
      echo "[S3-Restore] ERROR: Download failed with HTTP $http_code for $s3_key"
      rm -f "$local_path"
      return 1
    fi
  fi

  local dl_size
  dl_size=$(stat -c%s "$local_path" 2>/dev/null || stat -f%z "$local_path" 2>/dev/null || echo 0)
  echo "[S3-Restore] Downloaded $dl_size bytes to $local_path"
  return 0
}

# ── Handle --list / --list-detail ────────────────────────────────────────
if [ "$RESTORE_TIMESTAMP" = "--list" ]; then
  list_s3_backups "false"
  exit 0
fi

if [ "$RESTORE_TIMESTAMP" = "--list-detail" ]; then
  list_s3_backups "true"
  exit 0
fi

# ── Determine which backup to restore ────────────────────────────────────
echo "══════════════════════════════════════════════════════════════"
echo "[S3-Restore] Starting S3 restore"
echo "══════════════════════════════════════════════════════════════"

if [ -z "$RESTORE_TIMESTAMP" ]; then
  # Find latest backup in S3
  echo "[S3-Restore] No timestamp specified — finding latest backup..."

  if command -v aws &>/dev/null; then
    LATEST_KEY=$(aws s3 ls "s3://${AWS_BUCKET}/${S3_PREFIX}/db/" \
      --region "$AWS_REGION" 2>/dev/null | sort -r | head -1 | awk '{print $4}')

    if [ -z "$LATEST_KEY" ]; then
      echo "[S3-Restore] ERROR: No backups found in s3://${AWS_BUCKET}/${S3_PREFIX}/db/"
      exit 2
    fi

    RESTORE_TIMESTAMP=$(echo "$LATEST_KEY" | sed 's/concord-\(.*\)\.db\.gz/\1/')
    echo "[S3-Restore] Latest backup: $RESTORE_TIMESTAMP"
  else
    echo "[S3-Restore] ERROR: aws CLI required to find latest backup"
    echo "  Specify a timestamp: ./restore-s3.sh 20240101_120000"
    exit 1
  fi
fi

DB_S3_KEY="${S3_PREFIX}/db/concord-${RESTORE_TIMESTAMP}.db.gz"
ARTIFACTS_S3_KEY="${S3_PREFIX}/artifacts/artifacts-${RESTORE_TIMESTAMP}.tar.gz"
LOCAL_DB_BACKUP="$BACKUP_DIR/concord-${RESTORE_TIMESTAMP}.db.gz"
LOCAL_ARTIFACTS_BACKUP="$BACKUP_DIR/artifacts-${RESTORE_TIMESTAMP}.tar.gz"

# ── Download DB backup ──────────────────────────────────────────────────
echo ""
echo "── Downloading database backup ────────────────────────────"

if ! download_from_s3 "$DB_S3_KEY" "$LOCAL_DB_BACKUP"; then
  echo "[S3-Restore] ERROR: Failed to download database backup"
  echo "[S3-Restore] Tried: s3://${AWS_BUCKET}/${DB_S3_KEY}"
  exit 2
fi

# ── Download artifacts backup (optional, non-fatal) ─────────────────────
echo ""
echo "── Downloading artifacts backup ───────────────────────────"

if download_from_s3 "$ARTIFACTS_S3_KEY" "$LOCAL_ARTIFACTS_BACKUP" 2>/dev/null; then
  echo "[S3-Restore] Artifacts backup downloaded"
else
  echo "[S3-Restore] No artifacts backup found for timestamp $RESTORE_TIMESTAMP (continuing)"
  rm -f "$LOCAL_ARTIFACTS_BACKUP"
fi

# ── Run local restore ───────────────────────────────────────────────────
echo ""
echo "── Running local restore ──────────────────────────────────"

if ! bash "$SCRIPT_DIR/restore.sh" "concord-${RESTORE_TIMESTAMP}.db.gz"; then
  echo "[S3-Restore] ERROR: Local restore failed"
  exit 3
fi

# ── Report results ──────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "[S3-Restore] Restore completed successfully"
echo "  Timestamp restored: $RESTORE_TIMESTAMP"
echo "  Source:             s3://${AWS_BUCKET}/${DB_S3_KEY}"
echo "  Database:           $DB_PATH"

if [ -f "$LOCAL_ARTIFACTS_BACKUP" ]; then
  echo "  Artifacts:          restored"
else
  echo "  Artifacts:          not available for this timestamp"
fi

echo "══════════════════════════════════════════════════════════════"

# Output JSON for programmatic consumption
cat <<STATUSJSON
---RESTORE_STATUS_JSON---
{
  "timestamp": "$RESTORE_TIMESTAMP",
  "status": "completed",
  "source": "s3",
  "s3_bucket": "$AWS_BUCKET",
  "s3_db_key": "$DB_S3_KEY",
  "s3_artifacts_key": "$ARTIFACTS_S3_KEY",
  "artifacts_restored": $([ -f "$LOCAL_ARTIFACTS_BACKUP" ] && echo "true" || echo "false")
}
STATUSJSON
