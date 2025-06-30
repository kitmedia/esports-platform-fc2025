#!/bin/bash
# EA SPORTS FC 2025 eSports Platform - Backup Cron Setup

set -e

# Install cron if not present
which cron > /dev/null || apk add --no-cache dcron

# Create backup script with executable permissions
cp /usr/local/bin/backup-postgres.sh /usr/local/bin/backup-postgres-exec.sh
chmod +x /usr/local/bin/backup-postgres-exec.sh

# Set up cron job
echo "${BACKUP_SCHEDULE:-0 2 * * *} /usr/local/bin/backup-postgres-exec.sh >> /var/log/backup.log 2>&1" | crontab -

echo "Backup cron job scheduled: ${BACKUP_SCHEDULE:-0 2 * * *}"
echo "Starting cron daemon..."

# Start cron in foreground
crond -f -d 8