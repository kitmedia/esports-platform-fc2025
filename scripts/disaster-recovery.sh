#!/bin/bash

# EA SPORTS FC 2025 eSports Platform - Disaster Recovery Script
# This script provides comprehensive disaster recovery capabilities

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
echo "║               Disaster Recovery System                          ║"
echo "║                                                                  ║"
echo "║          EA SPORTS FC 2025 eSports Platform                     ║"
echo "║                                                                  ║"
echo "║        🚨 EMERGENCY RECOVERY PROCEDURES 🚨                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Usage function
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list-backups          List available backups"
    echo "  restore-full          Complete system restoration"
    echo "  restore-database      Restore database only"
    echo "  restore-files         Restore application files only"
    echo "  restore-uploads       Restore user uploads only"
    echo "  emergency-start       Emergency system startup"
    echo "  health-check          System health verification"
    echo "  create-recovery-plan  Generate recovery documentation"
    echo ""
    echo "Options:"
    echo "  --backup-date DATE    Specify backup date (YYYYMMDD_HHMMSS)"
    echo "  --force               Skip confirmation prompts"
    echo "  --dry-run             Show what would be done without executing"
    echo ""
    echo "Examples:"
    echo "  $0 list-backups"
    echo "  $0 restore-full --backup-date 20240315_120000"
    echo "  $0 restore-database --force"
    echo "  $0 emergency-start"
}

# Parse command line arguments
COMMAND="$1"
BACKUP_DATE=""
FORCE=false
DRY_RUN=false

shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --backup-date)
            BACKUP_DATE="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Load environment variables
if [ -f ".env.production" ]; then
    source .env.production
elif [ -f ".env" ]; then
    source .env
else
    print_error "No environment file found"
    exit 1
fi

# Configuration
BACKUP_ROOT="./backups"
RECOVERY_LOG="./recovery_$(date +%Y%m%d_%H%M%S).log"

# Logging function
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$RECOVERY_LOG"
}

# Confirmation function
confirm() {
    if [ "$FORCE" = true ]; then
        return 0
    fi
    
    local message="$1"
    echo -e "${YELLOW}$message${NC}"
    read -p "Are you sure? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Operation cancelled."
        exit 1
    fi
}

# Execute or dry run
execute_command() {
    local cmd="$1"
    local description="$2"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY RUN] Would execute: $description"
        print_status "[DRY RUN] Command: $cmd"
    else
        print_status "Executing: $description"
        log_message "Executing: $cmd"
        eval "$cmd"
        if [ $? -eq 0 ]; then
            print_success "$description completed"
            log_message "$description completed successfully"
        else
            print_error "$description failed"
            log_message "$description failed"
            exit 1
        fi
    fi
}

# List available backups
list_backups() {
    print_status "Listing available backups..."
    
    if [ ! -d "$BACKUP_ROOT" ]; then
        print_error "No backup directory found at $BACKUP_ROOT"
        exit 1
    fi
    
    echo ""
    echo "Available Backups:"
    echo "=================="
    
    # Daily backups
    if [ -d "$BACKUP_ROOT/daily" ]; then
        echo ""
        echo "📅 Daily Backups:"
        find "$BACKUP_ROOT/daily" -maxdepth 1 -type d -name "*_*" | sort -r | while read -r backup_dir; do
            if [ -f "$backup_dir/backup_manifest.txt" ]; then
                backup_name=$(basename "$backup_dir")
                backup_size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
                backup_time=$(echo "$backup_name" | sed 's/_/ /' | sed 's/\(..\)\(..\)\(..\)/\1:\2:\3/')
                echo "  📁 $backup_name ($backup_size) - $backup_time"
            fi
        done
    fi
    
    # Weekly backups
    if [ -d "$BACKUP_ROOT/weekly" ]; then
        echo ""
        echo "📅 Weekly Backups:"
        find "$BACKUP_ROOT/weekly" -maxdepth 2 -name "*_*" -type d | sort -r | head -5 | while read -r backup_dir; do
            if [ -f "$backup_dir/backup_manifest.txt" ]; then
                backup_name=$(basename "$backup_dir")
                backup_size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
                echo "  📁 $backup_name ($backup_size)"
            fi
        done
    fi
    
    # Monthly backups
    if [ -d "$BACKUP_ROOT/monthly" ]; then
        echo ""
        echo "📅 Monthly Backups:"
        find "$BACKUP_ROOT/monthly" -maxdepth 2 -name "*_*" -type d | sort -r | head -3 | while read -r backup_dir; do
            if [ -f "$backup_dir/backup_manifest.txt" ]; then
                backup_name=$(basename "$backup_dir")
                backup_size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
                echo "  📁 $backup_name ($backup_size)"
            fi
        done
    fi
    
    echo ""
}

# Find backup directory
find_backup_dir() {
    local backup_date="$1"
    
    # If no date specified, use the latest backup
    if [ -z "$backup_date" ]; then
        backup_dir=$(find "$BACKUP_ROOT/daily" -maxdepth 1 -type d -name "*_*" | sort -r | head -1)
        if [ -z "$backup_dir" ]; then
            print_error "No backups found"
            exit 1
        fi
        print_status "Using latest backup: $(basename "$backup_dir")"
    else
        backup_dir="$BACKUP_ROOT/daily/$backup_date"
        if [ ! -d "$backup_dir" ]; then
            # Try weekly backups
            backup_dir=$(find "$BACKUP_ROOT/weekly" -name "*$backup_date*" -type d | head -1)
            if [ ! -d "$backup_dir" ]; then
                # Try monthly backups
                backup_dir=$(find "$BACKUP_ROOT/monthly" -name "*$backup_date*" -type d | head -1)
            fi
        fi
        
        if [ ! -d "$backup_dir" ]; then
            print_error "Backup not found for date: $backup_date"
            exit 1
        fi
    fi
    
    echo "$backup_dir"
}

# Emergency system startup
emergency_start() {
    print_status "Starting emergency recovery procedure..."
    log_message "Emergency startup initiated"
    
    confirm "This will attempt to start all services in emergency mode. Continue?"
    
    # Stop all services first
    execute_command "docker-compose down" "Stopping all services"
    
    # Remove corrupted containers
    execute_command "docker container prune -f" "Removing corrupted containers"
    
    # Remove unused volumes (be careful!)
    if [ "$FORCE" = true ]; then
        execute_command "docker volume prune -f" "Cleaning unused volumes"
    fi
    
    # Start minimal services first
    execute_command "docker-compose up -d postgres redis" "Starting core services"
    
    # Wait for core services
    print_status "Waiting for core services to stabilize..."
    sleep 30
    
    # Start application services
    execute_command "docker-compose up -d backend" "Starting backend service"
    sleep 20
    
    execute_command "docker-compose up -d frontend" "Starting frontend service"
    sleep 10
    
    # Start monitoring
    execute_command "docker-compose up -d prometheus grafana" "Starting monitoring services"
    
    print_success "Emergency startup completed"
    health_check
}

# Database restoration
restore_database() {
    local backup_dir="$1"
    
    print_status "Restoring database from backup..."
    log_message "Database restoration started from $backup_dir"
    
    # Find database backup files
    db_backup=$(find "$backup_dir" -name "database_full_*.sql.gz" | head -1)
    
    if [ -z "$db_backup" ]; then
        print_error "Database backup file not found in $backup_dir"
        exit 1
    fi
    
    confirm "This will completely replace the current database. Continue?"
    
    # Stop backend to prevent connections
    execute_command "docker-compose stop backend" "Stopping backend service"
    
    # Ensure database is running
    execute_command "docker-compose up -d postgres" "Starting PostgreSQL"
    sleep 10
    
    # Drop and recreate database
    execute_command "docker-compose exec -T postgres psql -U ${POSTGRES_USER} -c 'DROP DATABASE IF EXISTS ${POSTGRES_DB};'" "Dropping existing database"
    execute_command "docker-compose exec -T postgres psql -U ${POSTGRES_USER} -c 'CREATE DATABASE ${POSTGRES_DB};'" "Creating new database"
    
    # Restore database
    execute_command "gunzip -c '$db_backup' | docker-compose exec -T postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}" "Restoring database data"
    
    # Restart backend
    execute_command "docker-compose up -d backend" "Restarting backend service"
    
    print_success "Database restoration completed"
}

# Files restoration
restore_files() {
    local backup_dir="$1"
    
    print_status "Restoring application files..."
    log_message "Files restoration started from $backup_dir"
    
    # Find application backup
    app_backup=$(find "$backup_dir" -name "application_files_*.tar.gz" | head -1)
    
    if [ -z "$app_backup" ]; then
        print_error "Application files backup not found in $backup_dir"
        exit 1
    fi
    
    confirm "This will replace current application files. Continue?"
    
    # Stop services
    execute_command "docker-compose stop backend frontend" "Stopping application services"
    
    # Backup current files
    if [ "$FORCE" = false ]; then
        execute_command "mv . ../platform_backup_$(date +%s)" "Backing up current files"
    fi
    
    # Extract backup
    execute_command "tar -xzf '$app_backup'" "Extracting application files"
    
    # Rebuild images
    execute_command "docker-compose build --no-cache" "Rebuilding Docker images"
    
    # Restart services
    execute_command "docker-compose up -d" "Restarting all services"
    
    print_success "Files restoration completed"
}

# Uploads restoration
restore_uploads() {
    local backup_dir="$1"
    
    print_status "Restoring user uploads..."
    log_message "Uploads restoration started from $backup_dir"
    
    # Find uploads backup
    uploads_backup=$(find "$backup_dir" -name "uploads_*.tar.gz" | head -1)
    
    if [ -z "$uploads_backup" ]; then
        print_warning "Uploads backup not found in $backup_dir"
        return 0
    fi
    
    # Create uploads directory
    execute_command "mkdir -p ./backend/uploads" "Creating uploads directory"
    
    # Extract uploads
    execute_command "tar -xzf '$uploads_backup' -C ./backend/" "Extracting user uploads"
    
    # Fix permissions
    execute_command "chmod -R 755 ./backend/uploads" "Setting upload permissions"
    
    print_success "Uploads restoration completed"
}

# Full system restoration
restore_full() {
    print_status "Starting full system restoration..."
    log_message "Full system restoration initiated"
    
    local backup_dir
    backup_dir=$(find_backup_dir "$BACKUP_DATE")
    
    if [ ! -f "$backup_dir/backup_manifest.txt" ]; then
        print_error "Invalid backup directory: $backup_dir"
        exit 1
    fi
    
    print_status "Restoring from backup: $(basename "$backup_dir")"
    cat "$backup_dir/backup_manifest.txt"
    echo ""
    
    confirm "This will completely restore the system from backup. ALL CURRENT DATA WILL BE LOST. Continue?"
    
    # Stop all services
    execute_command "docker-compose down" "Stopping all services"
    
    # Restore database
    restore_database "$backup_dir"
    
    # Restore uploads
    restore_uploads "$backup_dir"
    
    # Restore Redis if backup exists
    redis_backup=$(find "$backup_dir" -name "redis_dump_*.rdb" | head -1)
    if [ -n "$redis_backup" ]; then
        print_status "Restoring Redis data..."
        execute_command "docker-compose stop redis" "Stopping Redis"
        execute_command "docker cp '$redis_backup' \$(docker-compose ps -q redis):/data/dump.rdb" "Restoring Redis data"
        execute_command "docker-compose start redis" "Starting Redis"
    fi
    
    # Start all services
    execute_command "docker-compose up -d" "Starting all services"
    
    # Wait for services to stabilize
    print_status "Waiting for services to stabilize..."
    sleep 60
    
    # Verify restoration
    health_check
    
    print_success "Full system restoration completed"
}

# Health check
health_check() {
    print_status "Performing system health check..."
    
    # Check database
    if docker-compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
        print_success "✅ Database is healthy"
    else
        print_error "❌ Database is not responding"
    fi
    
    # Check Redis
    if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        print_success "✅ Redis is healthy"
    else
        print_error "❌ Redis is not responding"
    fi
    
    # Check backend
    sleep 10  # Give backend time to start
    if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
        print_success "✅ Backend API is healthy"
    else
        print_error "❌ Backend API is not responding"
    fi
    
    # Check frontend
    if curl -f http://localhost/health >/dev/null 2>&1; then
        print_success "✅ Frontend is healthy"
    else
        print_error "❌ Frontend is not responding"
    fi
    
    # Service status
    echo ""
    print_status "Service Status:"
    docker-compose ps
}

# Create recovery plan
create_recovery_plan() {
    print_status "Generating disaster recovery plan..."
    
    cat > "DISASTER_RECOVERY_PLAN.md" << 'EOF'
# EA SPORTS FC 2025 eSports Platform - Disaster Recovery Plan

## Emergency Contacts
- System Administrator: [Your contact info]
- Database Administrator: [Your contact info]
- DevOps Team: [Your contact info]

## Quick Recovery Commands

### 1. Emergency System Startup
```bash
./scripts/disaster-recovery.sh emergency-start
```

### 2. List Available Backups
```bash
./scripts/disaster-recovery.sh list-backups
```

### 3. Full System Restoration
```bash
./scripts/disaster-recovery.sh restore-full --backup-date YYYYMMDD_HHMMSS
```

### 4. Database Only Restoration
```bash
./scripts/disaster-recovery.sh restore-database --backup-date YYYYMMDD_HHMMSS
```

### 5. Health Check
```bash
./scripts/disaster-recovery.sh health-check
```

## Recovery Scenarios

### Scenario 1: Complete System Failure
1. Assess damage and data loss
2. Identify latest clean backup
3. Perform full system restoration
4. Verify all services are operational
5. Update DNS if necessary

### Scenario 2: Database Corruption
1. Stop application services
2. Restore database from backup
3. Restart services
4. Verify data integrity

### Scenario 3: Application Code Issues
1. Stop affected services
2. Restore application files
3. Rebuild Docker images
4. Restart services

### Scenario 4: Partial Service Failure
1. Identify failing service
2. Restart specific service
3. Check logs for issues
4. Restore specific component if needed

## Backup Locations
- Local: ./backups/
- Daily retention: 7 days
- Weekly retention: 4 weeks
- Monthly retention: 12 months

## Critical File Locations
- Database backups: ./backups/daily/*/database_full_*.sql.gz
- Application files: ./backups/daily/*/application_files_*.tar.gz
- User uploads: ./backups/daily/*/uploads_*.tar.gz
- Configuration: ./backups/daily/*/configuration_*.tar.gz

## Post-Recovery Checklist
- [ ] All services running
- [ ] Database connectivity verified
- [ ] User authentication working
- [ ] File uploads functional
- [ ] Payment processing operational
- [ ] Monitoring systems active
- [ ] SSL certificates valid
- [ ] DNS resolution correct

## Prevention Measures
- Regular backup testing
- Monitoring and alerting
- Documentation updates
- Staff training
- Infrastructure redundancy

## Escalation Procedures
1. Level 1: Automated recovery attempts
2. Level 2: On-call engineer response
3. Level 3: Team lead involvement
4. Level 4: Management notification
5. Level 5: External vendor support

## Recovery Time Objectives (RTO)
- Database restoration: 30 minutes
- Full system restoration: 2 hours
- Service availability: 99.9% uptime target

## Recovery Point Objectives (RPO)
- Maximum data loss: 24 hours
- Backup frequency: Daily
- Critical data backup: Real-time replication (if configured)
EOF

    print_success "Disaster recovery plan created: DISASTER_RECOVERY_PLAN.md"
}

# Main execution
case "$COMMAND" in
    list-backups)
        list_backups
        ;;
    restore-full)
        restore_full
        ;;
    restore-database)
        backup_dir=$(find_backup_dir "$BACKUP_DATE")
        restore_database "$backup_dir"
        ;;
    restore-files)
        backup_dir=$(find_backup_dir "$BACKUP_DATE")
        restore_files "$backup_dir"
        ;;
    restore-uploads)
        backup_dir=$(find_backup_dir "$BACKUP_DATE")
        restore_uploads "$backup_dir"
        ;;
    emergency-start)
        emergency_start
        ;;
    health-check)
        health_check
        ;;
    create-recovery-plan)
        create_recovery_plan
        ;;
    "")
        print_error "No command specified"
        usage
        exit 1
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac

log_message "Disaster recovery operation completed: $COMMAND"
print_success "Recovery log saved to: $RECOVERY_LOG"