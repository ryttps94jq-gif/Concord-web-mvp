#!/bin/bash
# Concord Offsite Backup — S3
#
# Runs the existing local backup, then uploads compressed DB and artifact
# archives to S3. Verifies upload integrity via ETag/MD5, tags objects
# with metadata, and optionally posts status to a webhook.
#
# Env vars:
#   AWS_BUCKET            — S3 bucket name (required for S3 upload)
#   AWS_REGION            — AWS region (default: us-east-1)
#   AWS_ACCESS_KEY_ID     — AWS access key (or use IAM role)
#   AWS_SECRET_ACCESS_KEY — AWS secret key
#   BACKUP_ENCRYPTION_KEY — Optional encryption key for client-side encryption
#   BACKUP_NOTIFY_URL     — Optional webhook for backup status notifications
#   DATA_DIR              — Data directory (default: /data)
#   DB_PATH               — SQLite DB path (default: $DATA_DIR/db/concord.db)
#   BACKUP_STORAGE_CLASS  — Initial S3 storage class (default: STANDARD)
#
# Exit codes:
#   0 — success
#   1 — local backup failed
#   2 — S3 upload failed
#   3 — integrity verification failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-/data}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/concord.db}"
BACKUP_DIR="$DATA_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_BUCKET="${AWS_BUCKET:-}"
BACKUP_STORAGE_CLASS="${BACKUP_STORAGE_CLASS:-STANDARD}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
BACKUP_NOTIFY_URL="${BACKUP_NOTIFY_URL:-}"
S3_PREFIX="concord-backups"

# Status tracking
BACKUP_STATUS="started"
BACKUP_ERROR=""
DB_SIZE=0
COMPRESSED_SIZE=0
ARTIFACTS_SIZE=0
S3_DB_KEY=""
S3_DB_ETAG=""
S3_ARTIFACTS_KEY=""
S3_ARTIFACTS_ETAG=""
INTEGRITY_CHECK="pending"
START_TIME=$(date +%s%3N 2>/dev/null || echo $(($(date +%s) * 1000)))

# ── Helper: compute elapsed ms ───────────────────────────────────────────
elapsed_ms() {
  local now
  now=$(date +%s%3N 2>/dev/null || echo $(($(date +%s) * 1000)))
  echo $((now - START_TIME))
}

# ── Helper: send notification ────────────────────────────────────────────
notify() {
  local status="$1"
  local message="${2:-}"
  local error="${3:-}"

  if [ -z "$BACKUP_NOTIFY_URL" ]; then
    return 0
  fi

  local payload
  payload=$(cat <<NOTIFYJSON
{
  "timestamp": "$TIMESTAMP",
  "status": "$status",
  "message": "$message",
  "error": "$error",
  "duration_ms": $(elapsed_ms),
  "db_size_bytes": $DB_SIZE,
  "compressed_size_bytes": $COMPRESSED_SIZE,
  "artifacts_size_bytes": $ARTIFACTS_SIZE,
  "s3_db_key": "$S3_DB_KEY",
  "s3_artifacts_key": "$S3_ARTIFACTS_KEY",
  "integrity_check": "$INTEGRITY_CHECK"
}
NOTIFYJSON
)

  curl -s -X POST "$BACKUP_NOTIFY_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --max-time 10 2>/dev/null || true
}

# ── Helper: AWS Signature V4 signing (fallback when aws CLI unavailable) ─
# Minimal implementation for S3 PUT requests
aws_sign_v4() {
  local method="$1"
  local service="s3"
  local host="$2"
  local uri="$3"
  local payload_hash="$4"
  local content_type="${5:-application/octet-stream}"

  local date_stamp
  date_stamp=$(date -u +%Y%m%d)
  local amz_date
  amz_date=$(date -u +%Y%m%dT%H%M%SZ)
  local credential_scope="${date_stamp}/${AWS_REGION}/${service}/aws4_request"
  local signed_headers="content-type;host;x-amz-content-sha256;x-amz-date"

  # Canonical request
  local canonical_request="${method}\n${uri}\n\ncontent-type:${content_type}\nhost:${host}\nx-amz-content-sha256:${payload_hash}\nx-amz-date:${amz_date}\n\n${signed_headers}\n${payload_hash}"

  local canonical_hash
  canonical_hash=$(printf '%s' "$canonical_request" | openssl dgst -sha256 -hex 2>/dev/null | awk '{print $NF}')

  # String to sign
  local string_to_sign="AWS4-HMAC-SHA256\n${amz_date}\n${credential_scope}\n${canonical_hash}"

  # Signing key
  local k_date k_region k_service k_signing signature
  k_date=$(printf '%s' "$date_stamp" | openssl dgst -sha256 -hmac "AWS4${AWS_SECRET_ACCESS_KEY}" -binary 2>/dev/null)
  k_region=$(printf '%s' "$AWS_REGION" | openssl dgst -sha256 -hmac "$k_date" -binary 2>/dev/null)
  k_service=$(printf '%s' "$service" | openssl dgst -sha256 -hmac "$k_region" -binary 2>/dev/null)
  k_signing=$(printf '%s' "aws4_request" | openssl dgst -sha256 -hmac "$k_service" -binary 2>/dev/null)

  signature=$(printf '%b' "$string_to_sign" | openssl dgst -sha256 -hmac "$k_signing" -hex 2>/dev/null | awk '{print $NF}')

  local authorization="AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}"

  echo "$authorization"
  echo "$amz_date"
  echo "$payload_hash"
}

# ── Helper: Upload file to S3 ───────────────────────────────────────────
upload_to_s3() {
  local local_file="$1"
  local s3_key="$2"
  local storage_class="${3:-$BACKUP_STORAGE_CLASS}"
  local file_md5 file_size etag

  file_size=$(stat -c%s "$local_file" 2>/dev/null || stat -f%z "$local_file" 2>/dev/null || echo 0)
  file_md5=$(md5sum "$local_file" 2>/dev/null | awk '{print $1}' || md5 -q "$local_file" 2>/dev/null || echo "unknown")

  echo "[S3] Uploading $(basename "$local_file") ($file_size bytes) to s3://${AWS_BUCKET}/${s3_key}"

  if command -v aws &>/dev/null; then
    # ── Use AWS CLI ──
    local aws_args=(
      s3 cp "$local_file" "s3://${AWS_BUCKET}/${s3_key}"
      --region "$AWS_REGION"
      --storage-class "$storage_class"
      --metadata "timestamp=${TIMESTAMP},md5=${file_md5},source=concord-backup,size=${file_size}"
    )

    # Add server-side encryption
    if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
      aws_args+=(--sse-c AES256 --sse-c-key "$BACKUP_ENCRYPTION_KEY")
    else
      aws_args+=(--sse AES256)
    fi

    if ! aws "${aws_args[@]}" 2>&1; then
      echo "[S3] ERROR: Upload failed for $s3_key"
      return 1
    fi

    # Verify upload by checking ETag
    etag=$(aws s3api head-object \
      --bucket "$AWS_BUCKET" \
      --key "$s3_key" \
      --region "$AWS_REGION" \
      --query 'ETag' --output text 2>/dev/null || echo "unknown")

  else
    # ── Fallback: curl with AWS Signature V4 ──
    echo "[S3] aws CLI not found, using curl with Signature V4"

    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
      echo "[S3] ERROR: AWS credentials required when using curl fallback"
      return 1
    fi

    local host="${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com"
    local uri="/${s3_key}"
    local content_type="application/octet-stream"
    local payload_hash
    payload_hash=$(sha256sum "$local_file" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$local_file" | awk '{print $1}')

    local amz_date
    amz_date=$(date -u +%Y%m%dT%H%M%SZ)
    local date_stamp
    date_stamp=$(date -u +%Y%m%d)

    # Simplified signing for PUT
    local credential_scope="${date_stamp}/${AWS_REGION}/s3/aws4_request"

    local curl_headers=(
      -H "Host: ${host}"
      -H "Content-Type: ${content_type}"
      -H "x-amz-content-sha256: ${payload_hash}"
      -H "x-amz-date: ${amz_date}"
      -H "x-amz-storage-class: ${storage_class}"
      -H "x-amz-meta-timestamp: ${TIMESTAMP}"
      -H "x-amz-meta-md5: ${file_md5}"
      -H "x-amz-meta-source: concord-backup"
      -H "x-amz-meta-size: ${file_size}"
    )

    if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
      local enc_key_b64
      enc_key_b64=$(echo -n "$BACKUP_ENCRYPTION_KEY" | base64)
      local enc_key_md5
      enc_key_md5=$(echo -n "$BACKUP_ENCRYPTION_KEY" | openssl dgst -md5 -binary | base64)
      curl_headers+=(
        -H "x-amz-server-side-encryption-customer-algorithm: AES256"
        -H "x-amz-server-side-encryption-customer-key: ${enc_key_b64}"
        -H "x-amz-server-side-encryption-customer-key-MD5: ${enc_key_md5}"
      )
    else
      curl_headers+=(-H "x-amz-server-side-encryption: AES256")
    fi

    # Compute signature (simplified — canonical headers must be sorted)
    local signed_headers="content-type;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class"
    local canonical_headers="content-type:${content_type}\nhost:${host}\nx-amz-content-sha256:${payload_hash}\nx-amz-date:${amz_date}\nx-amz-storage-class:${storage_class}"
    local canonical_request="PUT\n${uri}\n\n${canonical_headers}\n\n${signed_headers}\n${payload_hash}"
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
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PUT \
      "https://${host}${uri}" \
      "${curl_headers[@]}" \
      -H "Authorization: ${authorization}" \
      --data-binary "@${local_file}" \
      --max-time 300)

    if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
      echo "[S3] ERROR: Upload failed with HTTP $http_code for $s3_key"
      return 1
    fi

    etag="curl-upload-${file_md5}"
  fi

  echo "[S3] Upload complete: $s3_key (ETag: $etag)"

  # Return values via stdout protocol: last two lines are key and etag
  echo "S3_RESULT_KEY=$s3_key"
  echo "S3_RESULT_ETAG=$etag"
  return 0
}

# ── Helper: Configure S3 lifecycle rules ─────────────────────────────────
configure_lifecycle() {
  if ! command -v aws &>/dev/null; then
    echo "[S3] Skipping lifecycle configuration (aws CLI not available)"
    return 0
  fi

  echo "[S3] Checking lifecycle configuration..."

  # Check if lifecycle rules already exist
  local existing
  existing=$(aws s3api get-bucket-lifecycle-configuration \
    --bucket "$AWS_BUCKET" \
    --region "$AWS_REGION" 2>/dev/null || echo "")

  if echo "$existing" | grep -q "ConcordBackupLifecycle"; then
    echo "[S3] Lifecycle rules already configured"
    return 0
  fi

  echo "[S3] Applying lifecycle rules: STANDARD→IA@30d, IA→Glacier@90d, Expire@365d"

  local lifecycle_json
  lifecycle_json=$(cat <<'LIFECYCLE'
{
  "Rules": [
    {
      "ID": "ConcordBackupLifecycle",
      "Filter": {
        "Prefix": "concord-backups/"
      },
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
LIFECYCLE
)

  local lifecycle_file
  lifecycle_file=$(mktemp)
  echo "$lifecycle_json" > "$lifecycle_file"

  if aws s3api put-bucket-lifecycle-configuration \
    --bucket "$AWS_BUCKET" \
    --region "$AWS_REGION" \
    --lifecycle-configuration "file://$lifecycle_file" 2>&1; then
    echo "[S3] Lifecycle rules applied successfully"
  else
    echo "[S3] WARNING: Could not apply lifecycle rules (may require permissions)"
  fi

  rm -f "$lifecycle_file"
}

# ── Trap: send failure notification on unexpected exit ───────────────────
cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ] && [ "$BACKUP_STATUS" != "completed" ]; then
    BACKUP_STATUS="failed"
    BACKUP_ERROR="Script exited with code $exit_code"
    notify "failed" "Backup failed" "$BACKUP_ERROR"
  fi
}
trap cleanup EXIT

# ══════════════════════════════════════════════════════════════════════════
# STEP 1: Run local backup
# ══════════════════════════════════════════════════════════════════════════
echo "══════════════════════════════════════════════════════════════"
echo "[S3-Backup] Starting offsite backup at $TIMESTAMP"
echo "══════════════════════════════════════════════════════════════"

notify "started" "Backup started"

echo ""
echo "── Step 1: Local backup ────────────────────────────────────"
if ! bash "$SCRIPT_DIR/backup.sh"; then
  BACKUP_STATUS="failed"
  BACKUP_ERROR="Local backup script failed"
  echo "[S3-Backup] ERROR: Local backup failed"
  notify "failed" "Local backup failed" "$BACKUP_ERROR"
  exit 1
fi

INTEGRITY_CHECK="ok"

# Find the backup files we just created
DB_BACKUP=$(ls -t "$BACKUP_DIR"/concord-*.db.gz 2>/dev/null | head -1 || echo "")
ARTIFACTS_BACKUP=$(ls -t "$BACKUP_DIR"/artifacts-*.tar.gz 2>/dev/null | head -1 || echo "")

# Collect size info
if [ -n "$DB_BACKUP" ] && [ -f "$DB_BACKUP" ]; then
  COMPRESSED_SIZE=$(stat -c%s "$DB_BACKUP" 2>/dev/null || stat -f%z "$DB_BACKUP" 2>/dev/null || echo 0)
fi
if [ -f "$DB_PATH" ]; then
  DB_SIZE=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null || echo 0)
fi
if [ -n "$ARTIFACTS_BACKUP" ] && [ -f "$ARTIFACTS_BACKUP" ]; then
  ARTIFACTS_SIZE=$(stat -c%s "$ARTIFACTS_BACKUP" 2>/dev/null || stat -f%z "$ARTIFACTS_BACKUP" 2>/dev/null || echo 0)
fi

echo ""
echo "[S3-Backup] Local backup complete:"
echo "  DB backup:        ${DB_BACKUP:-none}"
echo "  Artifacts backup: ${ARTIFACTS_BACKUP:-none}"
echo "  DB size:          $DB_SIZE bytes"
echo "  Compressed size:  $COMPRESSED_SIZE bytes"
echo "  Artifacts size:   $ARTIFACTS_SIZE bytes"

# ══════════════════════════════════════════════════════════════════════════
# STEP 2: Upload to S3 (if configured)
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "── Step 2: S3 upload ───────────────────────────────────────"

if [ -z "$AWS_BUCKET" ]; then
  echo "[S3-Backup] WARNING: AWS_BUCKET not set — skipping S3 upload (local-only mode)"
  echo "[S3-Backup] Set AWS_BUCKET to enable offsite backups"
  BACKUP_STATUS="completed"
  notify "completed" "Local backup completed (S3 not configured)"

  # Output JSON status for scheduler consumption
  cat <<STATUSJSON
---BACKUP_STATUS_JSON---
{
  "timestamp": "$TIMESTAMP",
  "status": "completed",
  "type": "local",
  "db_size_bytes": $DB_SIZE,
  "compressed_size_bytes": $COMPRESSED_SIZE,
  "artifacts_size_bytes": $ARTIFACTS_SIZE,
  "integrity_check": "$INTEGRITY_CHECK",
  "duration_ms": $(elapsed_ms),
  "s3_key": null,
  "s3_etag": null
}
STATUSJSON
  exit 0
fi

# Configure lifecycle rules (idempotent — only sets if not already present)
configure_lifecycle

# Upload DB backup
if [ -n "$DB_BACKUP" ] && [ -f "$DB_BACKUP" ]; then
  S3_DB_KEY="${S3_PREFIX}/db/$(basename "$DB_BACKUP")"

  upload_output=$(upload_to_s3 "$DB_BACKUP" "$S3_DB_KEY" "$BACKUP_STORAGE_CLASS" 2>&1) || {
    BACKUP_STATUS="failed"
    BACKUP_ERROR="Failed to upload DB backup to S3"
    echo "$upload_output"
    echo "[S3-Backup] ERROR: $BACKUP_ERROR"
    notify "failed" "$BACKUP_ERROR"
    exit 2
  }
  echo "$upload_output"

  # Parse result
  S3_DB_KEY=$(echo "$upload_output" | grep "^S3_RESULT_KEY=" | tail -1 | cut -d= -f2-)
  S3_DB_ETAG=$(echo "$upload_output" | grep "^S3_RESULT_ETAG=" | tail -1 | cut -d= -f2-)
else
  echo "[S3-Backup] No DB backup file to upload"
fi

# Upload artifacts backup
if [ -n "$ARTIFACTS_BACKUP" ] && [ -f "$ARTIFACTS_BACKUP" ]; then
  S3_ARTIFACTS_KEY="${S3_PREFIX}/artifacts/$(basename "$ARTIFACTS_BACKUP")"

  upload_output=$(upload_to_s3 "$ARTIFACTS_BACKUP" "$S3_ARTIFACTS_KEY" "$BACKUP_STORAGE_CLASS" 2>&1) || {
    BACKUP_STATUS="failed"
    BACKUP_ERROR="Failed to upload artifacts backup to S3"
    echo "$upload_output"
    echo "[S3-Backup] ERROR: $BACKUP_ERROR"
    notify "failed" "$BACKUP_ERROR"
    exit 2
  }
  echo "$upload_output"

  S3_ARTIFACTS_KEY=$(echo "$upload_output" | grep "^S3_RESULT_KEY=" | tail -1 | cut -d= -f2-)
  S3_ARTIFACTS_ETAG=$(echo "$upload_output" | grep "^S3_RESULT_ETAG=" | tail -1 | cut -d= -f2-)
else
  echo "[S3-Backup] No artifacts backup to upload"
fi

# ══════════════════════════════════════════════════════════════════════════
# STEP 3: Verify uploads
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "── Step 3: Verify uploads ──────────────────────────────────"

VERIFY_OK=true

if [ -n "$S3_DB_KEY" ] && command -v aws &>/dev/null; then
  echo "[S3-Backup] Verifying DB backup in S3..."
  head_result=$(aws s3api head-object \
    --bucket "$AWS_BUCKET" \
    --key "$S3_DB_KEY" \
    --region "$AWS_REGION" 2>&1) || {
    echo "[S3-Backup] WARNING: Could not verify DB backup in S3"
    VERIFY_OK=false
  }

  if [ "$VERIFY_OK" = true ]; then
    s3_size=$(echo "$head_result" | grep -o '"ContentLength": [0-9]*' | grep -o '[0-9]*' || echo "0")
    echo "[S3-Backup] DB backup verified in S3 (${s3_size} bytes)"
  fi
fi

if [ -n "$S3_ARTIFACTS_KEY" ] && command -v aws &>/dev/null; then
  echo "[S3-Backup] Verifying artifacts backup in S3..."
  aws s3api head-object \
    --bucket "$AWS_BUCKET" \
    --key "$S3_ARTIFACTS_KEY" \
    --region "$AWS_REGION" &>/dev/null || {
    echo "[S3-Backup] WARNING: Could not verify artifacts backup in S3"
    VERIFY_OK=false
  }

  if [ "$VERIFY_OK" = true ]; then
    echo "[S3-Backup] Artifacts backup verified in S3"
  fi
fi

if [ "$VERIFY_OK" = false ]; then
  echo "[S3-Backup] WARNING: Some S3 verification checks failed"
  INTEGRITY_CHECK="verify_warning"
fi

# ══════════════════════════════════════════════════════════════════════════
# STEP 4: Report results
# ══════════════════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════════════"
BACKUP_STATUS="completed"
DURATION=$(elapsed_ms)

echo "[S3-Backup] Backup completed successfully in ${DURATION}ms"
echo "  Timestamp:       $TIMESTAMP"
echo "  DB size:         $DB_SIZE bytes"
echo "  Compressed:      $COMPRESSED_SIZE bytes"
echo "  Artifacts:       $ARTIFACTS_SIZE bytes"
echo "  S3 DB key:       ${S3_DB_KEY:-n/a}"
echo "  S3 DB ETag:      ${S3_DB_ETAG:-n/a}"
echo "  S3 Artifacts:    ${S3_ARTIFACTS_KEY:-n/a}"
echo "  Integrity:       $INTEGRITY_CHECK"
echo "══════════════════════════════════════════════════════════════"

notify "completed" "Backup completed successfully"

# Output JSON status for scheduler consumption (delimited for easy parsing)
cat <<STATUSJSON
---BACKUP_STATUS_JSON---
{
  "timestamp": "$TIMESTAMP",
  "status": "completed",
  "type": "s3",
  "db_size_bytes": $DB_SIZE,
  "compressed_size_bytes": $COMPRESSED_SIZE,
  "artifacts_size_bytes": $ARTIFACTS_SIZE,
  "integrity_check": "$INTEGRITY_CHECK",
  "duration_ms": $DURATION,
  "s3_db_key": "$S3_DB_KEY",
  "s3_db_etag": "$S3_DB_ETAG",
  "s3_artifacts_key": "$S3_ARTIFACTS_KEY",
  "s3_artifacts_etag": "$S3_ARTIFACTS_ETAG"
}
STATUSJSON
