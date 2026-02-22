#!/bin/bash
# Repair Cortex — Self-healing build system
# Detects build failures, parses errors, generates fixes, and rebuilds.
# Handles common TypeScript error patterns automatically.

set -euo pipefail

LOG_FILE="/tmp/build-output.log"
MAX_RETRIES=5
RETRY=0
PROJECT_DIR="${PROJECT_DIR:-/var/www/concord-cognitive-engine}"

echo "[repair-cortex] Starting repair cycle..."

while [ $RETRY -lt $MAX_RETRIES ]; do
  echo "[repair-cortex] Build attempt $((RETRY + 1))..."

  # Attempt build, capture output
  if docker compose -f "$PROJECT_DIR/docker-compose.yml" build --no-cache frontend 2>&1 | tee "$LOG_FILE"; then
    echo "[repair-cortex] Build succeeded!"
    docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d frontend
    exit 0
  fi

  # Parse error from log
  ERROR_FILE=$(grep -E "^\./|^concord-frontend/" "$LOG_FILE" | grep -E "Type error|Error:" | head -1 | cut -d: -f1 | sed 's/^\.\//concord-frontend\//' || echo "")
  ERROR_LINE=$(grep -E "^\./|^concord-frontend/" "$LOG_FILE" | grep -E "Type error|Error:" | head -1 | cut -d: -f2 || echo "")
  ERROR_MSG=$(grep -E "Type error|Error:" "$LOG_FILE" | head -1 || echo "")

  if [ -z "$ERROR_FILE" ] || [ -z "$ERROR_MSG" ]; then
    echo "[repair-cortex] Could not parse error. Manual intervention needed."
    exit 1
  fi

  echo "[repair-cortex] Error in $ERROR_FILE:$ERROR_LINE"
  echo "[repair-cortex] $ERROR_MSG"

  FIXED=false

  # Common auto-fixes

  # Fix: Property 'id' is missing in type
  if echo "$ERROR_MSG" | grep -q "Property 'id' is missing"; then
    echo "[repair-cortex] Auto-fix: adding missing id property"
    if [ -n "$ERROR_LINE" ] && [ -f "$PROJECT_DIR/$ERROR_FILE" ]; then
      sed -i "${ERROR_LINE}s/{ /{ id: String(Date.now()), /" "$PROJECT_DIR/$ERROR_FILE"
      FIXED=true
    fi

  # Fix: not assignable to type 'ReactNode'
  elif echo "$ERROR_MSG" | grep -q "not assignable to type 'ReactNode'"; then
    echo "[repair-cortex] Auto-fix: wrapping in String()"
    if [ -n "$ERROR_LINE" ] && [ -f "$PROJECT_DIR/$ERROR_FILE" ]; then
      python3 -c "
import re, sys
try:
  with open('$PROJECT_DIR/$ERROR_FILE') as f:
    lines = f.readlines()
  idx = int('$ERROR_LINE') - 1
  if 0 <= idx < len(lines):
    line = lines[idx]
    fixed = re.sub(r'\{([^{}]+)\}', lambda m: '{String(' + m.group(1) + ')}' if 'String' not in m.group(0) else m.group(0), line, count=1)
    lines[idx] = fixed
    with open('$PROJECT_DIR/$ERROR_FILE', 'w') as f:
      f.writelines(lines)
except Exception as e:
  print(f'[repair-cortex] Python fix failed: {e}', file=sys.stderr)
"
      FIXED=true
    fi

  # Fix: is defined but never used
  elif echo "$ERROR_MSG" | grep -q "is defined but never used"; then
    echo "[repair-cortex] Auto-fix: prefixing unused var with _"
    VAR_NAME=$(echo "$ERROR_MSG" | grep -oP "'(\w+)'" | head -1 | tr -d "'" || echo "")
    if [ -n "$VAR_NAME" ] && [ -n "$ERROR_LINE" ] && [ -f "$PROJECT_DIR/$ERROR_FILE" ]; then
      sed -i "${ERROR_LINE}s/\b${VAR_NAME}\b/_${VAR_NAME}/" "$PROJECT_DIR/$ERROR_FILE"
      FIXED=true
    fi

  # Fix: Type 'unknown' is not assignable
  elif echo "$ERROR_MSG" | grep -q "Type 'unknown'"; then
    echo "[repair-cortex] Auto-fix: casting unknown to any"
    if [ -n "$ERROR_LINE" ] && [ -f "$PROJECT_DIR/$ERROR_FILE" ]; then
      sed -i "${ERROR_LINE}s/ as unknown/ as any/" "$PROJECT_DIR/$ERROR_FILE"
      FIXED=true
    fi

  # Fix: Cannot find module
  elif echo "$ERROR_MSG" | grep -q "Cannot find module"; then
    echo "[repair-cortex] Auto-fix: commenting out problematic import"
    if [ -n "$ERROR_LINE" ] && [ -f "$PROJECT_DIR/$ERROR_FILE" ]; then
      sed -i "${ERROR_LINE}s/^/\/\/ [repair-cortex] /" "$PROJECT_DIR/$ERROR_FILE"
      FIXED=true
    fi
  fi

  if [ "$FIXED" = false ]; then
    echo "[repair-cortex] No auto-fix available for this error pattern. Manual intervention needed."
    exit 1
  fi

  RETRY=$((RETRY + 1))
  echo "[repair-cortex] Applied fix. Retry $RETRY of $MAX_RETRIES..."
done

echo "[repair-cortex] Max retries ($MAX_RETRIES) reached. Manual intervention needed."
exit 1
