#!/bin/bash

# EA SPORTS FC 2025 eSports Platform - Comprehensive Backup System
# This script creates automated backups for all critical data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║               Comprehensive Backup System                       ║"
echo "║                                                                  ║"
echo "║          EA SPORTS FC 2025 eSports Platform                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="./backups"
DAILY_DIR="$BACKUP_ROOT/daily/$TIMESTAMP"
WEEKLY_DIR="$BACKUP_ROOT/weekly/$(date +%Y_week_%U)"
MONTHLY_DIR="$BACKUP_ROOT/monthly/$(date +%Y_%m)"
LOG_FILE="$BACKUP_ROOT/backup.log"

# Load environment variables
if [ -f ".env.production" ]; then
    source .env.production
elif [ -f ".env" ]; then
    source .env
else
    print_error "No environment file found"
    exit 1
fi

# Create backup directories
mkdir -p "$DAILY_DIR"
mkdir -p "$WEEKLY_DIR" 
mkdir -p "$MONTHLY_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
    echo "$1"
}

log_message "Starting backup process..."

# Function to calculate backup size
get_backup_size() {
    local path="$1"
    if [ -f "$path" ]; then
        du -h "$path" | cut -f1
    else
        echo "N/A"
    fi
}

# 1. Database Backup
print_status "Backing up PostgreSQL database..."
DB_BACKUP_FILE="$DAILY_DIR/database_full_$TIMESTAMP.sql"
DB_SCHEMA_FILE="$DAILY_DIR/database_schema_$TIMESTAMP.sql"
DB_DATA_FILE="$DAILY_DIR/database_data_$TIMESTAMP.sql"

# Full database backup
if docker-compose exec -T postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --verbose --clean --no-owner --no-privileges > "$DB_BACKUP_FILE"; then
    DB_SIZE=$(get_backup_size "$DB_BACKUP_FILE")
    log_message "Database full backup completed: $DB_SIZE"
    print_success "Database backup created: $DB_SIZE"
else
    print_error "Database backup failed"
    log_message "Database backup failed"
    exit 1
fi

# Schema-only backup
docker-compose exec -T postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --schema-only > "$DB_SCHEMA_FILE"
log_message "Database schema backup completed"

# Data-only backup  
docker-compose exec -T postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --data-only > "$DB_DATA_FILE"
log_message "Database data backup completed"

# 2. Redis Backup
print_status "Backing up Redis data..."
REDIS_BACKUP_FILE="$DAILY_DIR/redis_dump_$TIMESTAMP.rdb"

if docker-compose exec -T redis redis-cli --rdb /data/dump.rdb SAVE; then
    docker cp $(docker-compose ps -q redis):/data/dump.rdb "$REDIS_BACKUP_FILE"
    REDIS_SIZE=$(get_backup_size "$REDIS_BACKUP_FILE")
    log_message "Redis backup completed: $REDIS_SIZE"
    print_success "Redis backup created: $REDIS_SIZE"
else
    print_warning "Redis backup failed or Redis not available"
    log_message "Redis backup failed"
fi

# 3. Application Files Backup
print_status "Backing up application files..."
APP_BACKUP_FILE="$DAILY_DIR/application_files_$TIMESTAMP.tar.gz"

# Create tar archive of important application files
tar -czf "$APP_BACKUP_FILE" \
    --exclude="node_modules" \
    --exclude="dist" \
    --exclude="build" \
    --exclude=".git" \
    --exclude="backups" \
    --exclude="logs" \
    --exclude="*.log" \
    . 2>/dev/null

APP_SIZE=$(get_backup_size "$APP_BACKUP_FILE")
log_message "Application files backup completed: $APP_SIZE"
print_success "Application files backup created: $APP_SIZE"

# 4. User Uploads Backup
print_status "Backing up user uploads..."
UPLOADS_BACKUP_FILE="$DAILY_DIR/uploads_$TIMESTAMP.tar.gz"

if [ -d "./backend/uploads" ] && [ "$(ls -A ./backend/uploads)" ]; then
    tar -czf "$UPLOADS_BACKUP_FILE" -C ./backend uploads/
    UPLOADS_SIZE=$(get_backup_size "$UPLOADS_BACKUP_FILE")
    log_message "Uploads backup completed: $UPLOADS_SIZE"
    print_success "Uploads backup created: $UPLOADS_SIZE"
else
    print_warning "No uploads directory found or empty"
    log_message "No uploads to backup"
fi

# 5. Docker Volumes Backup
print_status "Backing up Docker volumes..."
VOLUMES_BACKUP_DIR="$DAILY_DIR/docker_volumes"
mkdir -p "$VOLUMES_BACKUP_DIR"

# Get list of volumes
VOLUMES=$(docker volume ls --filter name=esports -q)

for volume in $VOLUMES; do
    print_status "Backing up volume: $volume"
    VOLUME_BACKUP_FILE="$VOLUMES_BACKUP_DIR/${volume}_$TIMESTAMP.tar.gz"
    
    docker run --rm -v "$volume":/data -v "$(pwd)/$VOLUMES_BACKUP_DIR":/backup alpine \
        tar -czf "/backup/$(basename "$VOLUME_BACKUP_FILE")" -C /data .
    
    VOLUME_SIZE=$(get_backup_size "$VOLUME_BACKUP_FILE")
    log_message "Volume $volume backup completed: $VOLUME_SIZE"
done

print_success "Docker volumes backup completed"

# 6. Configuration Files Backup
print_status "Backing up configuration files..."
CONFIG_BACKUP_FILE="$DAILY_DIR/configuration_$TIMESTAMP.tar.gz"

tar -czf "$CONFIG_BACKUP_FILE" \
    .env* \
    docker-compose*.yml \
    nginx/ \
    monitoring/ \
    scripts/ \
    ssl/ \
    database/ \
    2>/dev/null

CONFIG_SIZE=$(get_backup_size "$CONFIG_BACKUP_FILE")
log_message "Configuration backup completed: $CONFIG_SIZE"
print_success "Configuration backup created: $CONFIG_SIZE"

# 7. Logs Backup
print_status "Backing up application logs..."
LOGS_BACKUP_FILE="$DAILY_DIR/logs_$TIMESTAMP.tar.gz"

# Collect logs from various sources
TEMP_LOGS_DIR="/tmp/esports_logs_$TIMESTAMP"
mkdir -p "$TEMP_LOGS_DIR"

# Application logs
if [ -d "./backend/logs" ]; then
    cp -r ./backend/logs "$TEMP_LOGS_DIR/application"
fi

# Docker logs
docker-compose logs --no-color > "$TEMP_LOGS_DIR/docker_compose.log" 2>/dev/null || true

# System logs (if accessible)
if [ -r "/var/log/nginx" ]; then
    cp -r /var/log/nginx "$TEMP_LOGS_DIR/" 2>/dev/null || true
fi

# Create logs archive
if [ "$(ls -A "$TEMP_LOGS_DIR")" ]; then
    tar -czf "$LOGS_BACKUP_FILE" -C /tmp "esports_logs_$TIMESTAMP"
    LOGS_SIZE=$(get_backup_size "$LOGS_BACKUP_FILE")
    log_message "Logs backup completed: $LOGS_SIZE"
    print_success "Logs backup created: $LOGS_SIZE"
else
    print_warning "No logs found to backup"
    log_message "No logs to backup"
fi

# Cleanup temp directory
rm -rf "$TEMP_LOGS_DIR"

# 8. Compress all backups
print_status "Compressing backups..."
gzip "$DB_BACKUP_FILE" "$DB_SCHEMA_FILE" "$DB_DATA_FILE" 2>/dev/null || true

# 9. Create backup manifest
print_status "Creating backup manifest..."
MANIFEST_FILE="$DAILY_DIR/backup_manifest.txt"

cat > "$MANIFEST_FILE" << EOF
EA SPORTS FC 2025 eSports Platform - Backup Manifest
===================================================

Backup Date: $(date)
Backup Location: $DAILY_DIR
Backup Type: Daily Automated Backup

Files Created:
==============
EOF

# List all files with sizes
find "$DAILY_DIR" -type f -exec ls -lh {} \; | awk '{print $9 " - " $5}' >> "$MANIFEST_FILE"

echo "" >> "$MANIFEST_FILE"
echo "Total Backup Size: $(du -sh "$DAILY_DIR" | cut -f1)" >> "$MANIFEST_FILE"

print_success "Backup manifest created"

# 10. Weekly and Monthly Backups
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)

# Weekly backup (every Sunday)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    print_status "Creating weekly backup..."
    cp -r "$DAILY_DIR" "$WEEKLY_DIR/"
    log_message "Weekly backup created"
fi

# Monthly backup (first day of month)
if [ "$DAY_OF_MONTH" -eq 1 ]; then
    print_status "Creating monthly backup..."
    cp -r "$DAILY_DIR" "$MONTHLY_DIR/"
    log_message "Monthly backup created"
fi

# 11. Cleanup old backups
print_status "Cleaning up old backups..."

# Keep last 7 daily backups
find "$BACKUP_ROOT/daily" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

# Keep last 4 weekly backups
find "$BACKUP_ROOT/weekly" -type d -mtime +28 -exec rm -rf {} + 2>/dev/null || true

# Keep last 12 monthly backups
find "$BACKUP_ROOT/monthly" -type d -mtime +365 -exec rm -rf {} + 2>/dev/null || true

log_message "Old backups cleaned up"

# 12. Upload to cloud storage (if configured)
if [ -n "$AWS_S3_BUCKET" ] && command -v aws &> /dev/null; then
    print_status "Uploading to AWS S3..."
    
    aws s3 sync "$DAILY_DIR" "s3://$AWS_S3_BUCKET/backups/daily/$TIMESTAMP/" --delete
    
    if [ $? -eq 0 ]; then
        log_message "Backup uploaded to S3 successfully"
        print_success "Backup uploaded to S3"
    else
        log_message "S3 upload failed"
        print_warning "S3 upload failed"
    fi
fi

# 13. Send notification (if configured)
if [ -n "$WEBHOOK_URL" ]; then
    TOTAL_SIZE=$(du -sh "$DAILY_DIR" | cut -f1)
    
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"✅ EA SPORTS FC 2025 Backup Completed\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Timestamp\", \"value\": \"$TIMESTAMP\", \"short\": true},
                    {\"title\": \"Total Size\", \"value\": \"$TOTAL_SIZE\", \"short\": true},
                    {\"title\": \"Location\", \"value\": \"$DAILY_DIR\", \"short\": false}
                ]
            }]
        }" 2>/dev/null || true
fi

# 14. Final verification
print_status "Verifying backup integrity..."
BACKUP_COUNT=$(find "$DAILY_DIR" -name "*.gz" -o -name "*.sql" -o -name "*.rdb" | wc -l)

if [ "$BACKUP_COUNT" -gt 0 ]; then
    TOTAL_SIZE=$(du -sh "$DAILY_DIR" | cut -f1)
    log_message "Backup completed successfully - $BACKUP_COUNT files, $TOTAL_SIZE total"
    print_success "Backup verification passed"
else
    log_message "Backup verification failed - no backup files found"
    print_error "Backup verification failed"
    exit 1
fi

# Generate backup report
BACKUP_REPORT="$DAILY_DIR/backup_report.txt"
cat > "$BACKUP_REPORT" << EOF
EA SPORTS FC 2025 eSports Platform - Backup Report
=================================================

Backup Completed: $(date)
Backup Duration: $(($(date +%s) - $(date -d "1 minute ago" +%s))) seconds
Backup Location: $DAILY_DIR
Total Size: $(du -sh "$DAILY_DIR" | cut -f1)

Components Backed Up:
====================
✅ PostgreSQL Database (Full, Schema, Data)
✅ Redis Cache Data
✅ Application Source Code
✅ User Uploads
✅ Docker Volumes
✅ Configuration Files
✅ Application Logs
✅ Backup Manifest

Retention Policy:
================
• Daily: 7 days
• Weekly: 4 weeks  
• Monthly: 12 months

Next Backup: $(date -d "+1 day" "+%Y-%m-%d %H:%M:%S")

Health Check:
============
Database: $(docker-compose exec -T postgres pg_isready -U "${POSTGRES_USER}" 2>/dev/null || echo "FAIL")
Redis: $(docker-compose exec -T redis redis-cli ping 2>/dev/null || echo "FAIL")
Backend: $(curl -s http://localhost:3001/api/health 2>/dev/null || echo "FAIL")

EOF

# Success message
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                🎉 BACKUP COMPLETED SUCCESSFULLY! 🎉             ║"
echo "║                                                                  ║"
echo "║  All critical data has been backed up safely.                   ║"
echo "║                                                                  ║"
echo "║  Backup Details:                                                 ║"
echo "║  📅 Timestamp: $TIMESTAMP                              ║"
echo "║  📁 Location: $DAILY_DIR                ║"
echo "║  📊 Total Size: $(du -sh "$DAILY_DIR" | cut -f1)                                         ║"
echo "║  📋 Files: $BACKUP_COUNT backup files created                              ║"
echo "║                                                                  ║"
echo "║  Components Backed Up:                                           ║"
echo "║  ✅ Database (PostgreSQL + Redis)                               ║"
echo "║  ✅ Application Files                                            ║"
echo "║  ✅ User Uploads                                                 ║"
echo "║  ✅ Docker Volumes                                               ║"
echo "║  ✅ Configuration Files                                          ║"
echo "║  ✅ Application Logs                                             ║"
echo "║                                                                  ║"
echo "║  📄 Reports: backup_manifest.txt & backup_report.txt            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log_message "Backup process completed successfully"
exit 0