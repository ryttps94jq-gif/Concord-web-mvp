#!/bin/bash
# SSL Auto-Renewal for Concord Cognitive Engine
# Let's Encrypt certs expire every 90 days.
# Certbot only renews if within 30 days of expiry.
#
# Cron: 0 2,14 * * * /path/to/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1

set -euo pipefail

echo "[ssl] $(date) — Starting renewal check..."

# Renew certs
if certbot renew --quiet --deploy-hook "docker compose restart frontend nginx" 2>&1; then
  echo "[ssl] $(date) — Renewal check complete"
else
  echo "[ssl] $(date) — Renewal FAILED"
  exit 1
fi
