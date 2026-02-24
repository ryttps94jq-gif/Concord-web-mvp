#!/bin/bash
# Concord Disk Guardian — runs every 6 hours via cron
# Prevents disk from ever reaching 100%
# Install: chmod +x /root/disk-guardian.sh && crontab setup (see bottom)

THRESHOLD=80  # trigger cleanup at 80% usage
LOG="/var/log/disk-guardian.log"

usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
echo "$(date): Disk usage at ${usage}%" >> "$LOG"

if [ "$usage" -lt "$THRESHOLD" ]; then
  echo "$(date): Below threshold, no action needed" >> "$LOG"
  exit 0
fi

echo "$(date): CLEANING — usage ${usage}% exceeds ${THRESHOLD}%" >> "$LOG"

# 1. Docker cleanup (biggest offender)
docker system prune -f >> "$LOG" 2>&1
docker builder prune -af >> "$LOG" 2>&1

# 2. Qdrant snapshot cleanup — keep only latest snapshot per collection
for dir in /var/lib/docker/volumes/*qdrant*/_data/snapshots/*/; do
  if [ -d "$dir" ]; then
    ls -t "$dir"*.snapshot 2>/dev/null | tail -n +2 | xargs rm -f 2>/dev/null
    echo "$(date): Cleaned old snapshots in $dir" >> "$LOG"
  fi
done
# Also check common Qdrant paths
find /root -path "*/snapshots/*.snapshot" -mtime +1 -delete 2>/dev/null
find /opt -path "*/snapshots/*.snapshot" -mtime +1 -delete 2>/dev/null

# 3. Log rotation
journalctl --vacuum-size=100M >> "$LOG" 2>&1
find /var/log -name "*.gz" -delete 2>/dev/null
find /var/log -name "*.1" -delete 2>/dev/null
find /var/log -name "*.old" -delete 2>/dev/null

# 4. npm/node cache
rm -rf /root/.npm/_cacache 2>/dev/null
rm -rf /home/*/.npm/_cacache 2>/dev/null
rm -rf /tmp/npm-* 2>/dev/null

# 5. General temp cleanup
find /tmp -mtime +1 -delete 2>/dev/null

# 6. Concord artifact cleanup — remove unlinked artifacts older than 7 days
find /data/artifacts -mtime +7 -type f 2>/dev/null | head -100 | xargs rm -f 2>/dev/null

# Check result
new_usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
freed=$((usage - new_usage))
echo "$(date): DONE — freed ${freed}%, now at ${new_usage}%" >> "$LOG"

# If still above 90% after cleanup, emergency measures
if [ "$new_usage" -gt 90 ]; then
  echo "$(date): EMERGENCY — still at ${new_usage}%, removing ALL old Docker images" >> "$LOG"
  docker rmi $(docker images -q --filter "dangling=true") 2>/dev/null
  docker volume rm $(docker volume ls -qf dangling=true) 2>/dev/null

  # Remove all Qdrant snapshots (not just old ones)
  find / -name "*.snapshot" -path "*/qdrant*" -delete 2>/dev/null

  new_usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
  echo "$(date): After emergency cleanup: ${new_usage}%" >> "$LOG"
fi

# Keep log from growing forever
tail -500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
