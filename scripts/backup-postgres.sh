#!/bin/bash
# EA SPORTS FC 2025 eSports Platform - PostgreSQL Backup Script

set -e

# Configuration
BACKUP_DIR="/var/lib/postgresql/backup"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/esports_platform_${DATE}.sql"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting PostgreSQL backup at $(date)"

# Create database backup
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup created: $BACKUP_FILE"

# Calculate backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup size: $BACKUP_SIZE"

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "esports_platform_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

# List remaining backups
echo "Remaining backups:"
ls -lh "$BACKUP_DIR"/esports_platform_*.sql.gz 2>/dev/null || echo "No backups found"

echo "Backup completed successfully at $(date)"

# Optional: Upload to S3 if configured
if [ ! -z "$BACKUP_S3_BUCKET" ] && [ ! -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "Uploading backup to S3..."
    aws s3 cp "$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/database-backups/$(basename $BACKUP_FILE)"
    echo "Backup uploaded to S3"
fi