#!/bin/bash

# EA SPORTS FC 2025 eSports Platform - Database Optimization Script
# This script optimizes the PostgreSQL database for production performance

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
echo "║               Database Optimization Script                      ║"
echo "║                                                                  ║"
echo "║          EA SPORTS FC 2025 eSports Platform                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Load environment variables
if [ -f ".env.production" ]; then
    source .env.production
elif [ -f ".env" ]; then
    source .env
else
    print_error "No environment file found"
    exit 1
fi

# Database connection details
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${POSTGRES_DB:-esports_platform}
DB_USER=${POSTGRES_USER:-esports}

print_status "Optimizing database: $DB_NAME on $DB_HOST:$DB_PORT"

# Function to execute SQL commands
execute_sql() {
    local sql="$1"
    local description="$2"
    
    print_status "$description"
    docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "$sql" || {
        print_error "Failed to execute: $description"
        return 1
    }
    print_success "Completed: $description"
}

# Create performance monitoring views
print_status "Creating performance monitoring views..."

execute_sql "
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgstattuple;
" "Installing performance extensions"

execute_sql "
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 20;
" "Creating slow queries view"

execute_sql "
CREATE OR REPLACE VIEW table_stats AS
SELECT
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_tup_hot_upd as hot_updates,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;
" "Creating table statistics view"

# Create optimized indexes
print_status "Creating optimized indexes for performance..."

execute_sql "
-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_hash ON users USING hash(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_lower ON users(lower(username));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(\"createdAt\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(\"isVerified\") WHERE \"isVerified\" = true;
" "Creating user indexes"

execute_sql "
-- Tournaments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_start_date ON tournaments(\"startDate\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_organizer ON tournaments(\"organizerId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_public ON tournaments(\"isPublic\") WHERE \"isPublic\" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_game_mode ON tournaments(\"gameMode\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_entry_fee ON tournaments(\"entryFee\") WHERE \"entryFee\" > 0;
" "Creating tournament indexes"

execute_sql "
-- Matches table indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_tournament ON matches(\"tournamentId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_player1 ON matches(\"player1Id\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_player2 ON matches(\"player2Id\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_scheduled ON matches(\"scheduledAt\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_winner ON matches(\"winnerId\") WHERE \"winnerId\" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_round ON matches(round);
" "Creating match indexes"

execute_sql "
-- Tournament participants indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participants_tournament ON \"TournamentParticipant\"(\"tournamentId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participants_user ON \"TournamentParticipant\"(\"userId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participants_registered ON \"TournamentParticipant\"(\"registeredAt\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participants_checkin ON \"TournamentParticipant\"(\"isCheckedIn\") WHERE \"isCheckedIn\" = true;
" "Creating participant indexes"

execute_sql "
-- Notifications indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user ON notifications(\"userId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications(\"isRead\") WHERE \"isRead\" = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created ON notifications(\"createdAt\");
" "Creating notification indexes"

execute_sql "
-- Payments indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user ON payments(\"userId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_tournament ON payments(\"tournamentId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_stripe ON payments(\"stripePaymentIntentId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created ON payments(\"createdAt\");
" "Creating payment indexes"

execute_sql "
-- Teams indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_captain ON teams(\"captainId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_public ON teams(\"isPublic\") WHERE \"isPublic\" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_created ON teams(\"createdAt\");
" "Creating team indexes"

execute_sql "
-- Streams indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_streamer ON streams(\"streamerId\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_match ON streams(\"matchId\") WHERE \"matchId\" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_created ON streams(\"createdAt\");
" "Creating stream indexes"

# Create composite indexes for common queries
execute_sql "
-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_tournament_status ON matches(\"tournamentId\", status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_status_start ON tournaments(status, \"startDate\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_verified ON users(role, \"isVerified\");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread ON notifications(\"userId\", \"isRead\") WHERE \"isRead\" = false;
" "Creating composite indexes"

# Analyze tables for updated statistics
print_status "Analyzing tables for query optimization..."
execute_sql "ANALYZE;" "Updating table statistics"

# Vacuum tables to reclaim space
print_status "Vacuuming tables to optimize storage..."
execute_sql "VACUUM ANALYZE;" "Vacuuming and analyzing all tables"

# Create database maintenance functions
execute_sql "
CREATE OR REPLACE FUNCTION get_database_size() 
RETURNS TABLE(database_name text, size_pretty text, size_bytes bigint) AS \$\$
BEGIN
    RETURN QUERY
    SELECT 
        current_database()::text as database_name,
        pg_size_pretty(pg_database_size(current_database()))::text as size_pretty,
        pg_database_size(current_database()) as size_bytes;
END;
\$\$ LANGUAGE plpgsql;
" "Creating database size function"

execute_sql "
CREATE OR REPLACE FUNCTION get_table_sizes() 
RETURNS TABLE(
    table_name text, 
    row_count bigint, 
    total_size_pretty text, 
    index_size_pretty text,
    total_size_bytes bigint
) AS \$\$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::text,
        t.n_tup_ins + t.n_tup_upd as row_count,
        pg_size_pretty(pg_total_relation_size(c.oid))::text as total_size_pretty,
        pg_size_pretty(pg_indexes_size(c.oid))::text as index_size_pretty,
        pg_total_relation_size(c.oid) as total_size_bytes
    FROM pg_stat_user_tables t
    JOIN pg_class c ON c.relname = t.tablename
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
\$\$ LANGUAGE plpgsql;
" "Creating table size function"

execute_sql "
CREATE OR REPLACE FUNCTION get_index_usage() 
RETURNS TABLE(
    table_name text,
    index_name text,
    times_used bigint,
    size_pretty text
) AS \$\$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::text as table_name,
        i.relname::text as index_name,
        s.idx_tup_read as times_used,
        pg_size_pretty(pg_relation_size(i.oid))::text as size_pretty
    FROM pg_stat_user_indexes s
    JOIN pg_class t ON t.oid = s.relid
    JOIN pg_class i ON i.oid = s.indexrelid
    ORDER BY s.idx_tup_read DESC;
END;
\$\$ LANGUAGE plpgsql;
" "Creating index usage function"

# Set up automatic maintenance
execute_sql "
-- Optimize autovacuum settings for high-activity tables
ALTER TABLE users SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE tournaments SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE matches SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE notifications SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);
" "Optimizing autovacuum settings"

# Create performance monitoring script
cat > scripts/db-monitor.sh << 'EOF'
#!/bin/bash
# Database Performance Monitoring Script

source .env.production 2>/dev/null || source .env

echo "=== Database Performance Report ==="
echo "Generated: $(date)"
echo

# Database size
echo "Database Size:"
docker-compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT * FROM get_database_size();"
echo

# Table sizes
echo "Top 10 Largest Tables:"
docker-compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT * FROM get_table_sizes() LIMIT 10;"
echo

# Slow queries
echo "Slowest Queries:"
docker-compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT * FROM slow_queries LIMIT 10;"
echo

# Index usage
echo "Most Used Indexes:"
docker-compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT * FROM get_index_usage() LIMIT 15;"
echo

# Connection stats
echo "Connection Statistics:"
docker-compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "
SELECT 
    state,
    count(*) as connections,
    max(now() - state_change) as max_duration
FROM pg_stat_activity 
WHERE pid != pg_backend_pid()
GROUP BY state;"
echo

# Cache hit ratio
echo "Cache Hit Ratio:"
docker-compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "
SELECT 
    'Database' as type,
    round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as hit_ratio
FROM pg_stat_database
WHERE datname = current_database()
UNION ALL
SELECT 
    'Tables' as type,
    round(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2) as hit_ratio
FROM pg_statio_user_tables;"
EOF

chmod +x scripts/db-monitor.sh

# Create database backup script
cat > scripts/db-backup.sh << 'EOF'
#!/bin/bash
# Database Backup Script

set -e

source .env.production 2>/dev/null || source .env

BACKUP_DIR="./backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."

# Full database backup
docker-compose exec -T postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --verbose --clean --no-owner --no-privileges > "$BACKUP_DIR/full_backup.sql"

# Schema-only backup
docker-compose exec -T postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --schema-only > "$BACKUP_DIR/schema_backup.sql"

# Data-only backup
docker-compose exec -T postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --data-only > "$BACKUP_DIR/data_backup.sql"

# Compress backups
gzip "$BACKUP_DIR"/*.sql

echo "Backup completed: $BACKUP_DIR"

# Clean old backups (keep 30 days)
find ./backups -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

echo "Old backups cleaned"
EOF

chmod +x scripts/db-backup.sh

print_success "Database optimization completed!"

# Generate optimization report
cat > database-optimization-report.txt << EOF
Database Optimization Report
===========================

Date: $(date)
Database: $DB_NAME
Host: $DB_HOST:$DB_PORT

Optimizations Applied:
=====================
✅ Performance extensions installed (pg_stat_statements, pgstattuple)
✅ Optimized indexes created for all major tables
✅ Composite indexes for complex queries
✅ Autovacuum settings tuned for high-activity tables
✅ Performance monitoring views created
✅ Database maintenance functions created
✅ Monitoring and backup scripts generated

Created Indexes:
===============
- User table: email hash, username, role, verification status
- Tournament table: status, dates, organizer, game mode
- Match table: tournament, players, status, scheduling
- Participant table: tournament, user, registration
- Notification table: user, read status, type
- Payment table: user, tournament, status, stripe ID
- Team table: captain, visibility, creation date
- Stream table: streamer, status, match association

Monitoring Tools:
================
- slow_queries view: Monitor performance issues
- table_stats view: Track table activity
- get_database_size(): Check database size
- get_table_sizes(): Monitor table growth
- get_index_usage(): Track index effectiveness

Scripts Created:
===============
- scripts/db-monitor.sh: Performance monitoring
- scripts/db-backup.sh: Automated backups

Next Steps:
==========
1. Run: ./scripts/db-monitor.sh (check performance)
2. Setup: Cron job for daily backups
3. Monitor: Query performance regularly
4. Review: Index usage monthly

EOF

print_success "Optimization report saved to database-optimization-report.txt"

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                Database Optimization Complete!                  ║"
echo "║                                                                  ║"
echo "║  Your database has been optimized for production performance.   ║"
echo "║                                                                  ║"
echo "║  Monitoring Commands:                                            ║"
echo "║  📊 Performance: ./scripts/db-monitor.sh                        ║"
echo "║  💾 Backup: ./scripts/db-backup.sh                              ║"
echo "║                                                                  ║"
echo "║  Key Improvements:                                               ║"
echo "║  ⚡ 20+ optimized indexes created                               ║"
echo "║  📈 Performance monitoring enabled                              ║"
echo "║  🔧 Autovacuum settings tuned                                   ║"
echo "║  📊 Query optimization tools installed                          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

exit 0
EOF

chmod +x scripts/db-optimize.sh