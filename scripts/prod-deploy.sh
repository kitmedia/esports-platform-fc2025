#!/bin/bash

# EA SPORTS FC 2025 eSports Platform - Production Deployment Script
# This script deploys the complete platform to production environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
echo "║               Production Deployment Script                      ║"
echo "║                                                                  ║"
echo "║          EA SPORTS FC 2025 eSports Platform                     ║"
echo "║                                                                  ║"
echo "║        🚀 Deploying to Production Environment 🚀               ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi

# Check environment file
if [ ! -f ".env.production" ]; then
    print_error ".env.production file not found"
    print_status "Please create .env.production with your production settings"
    exit 1
fi

# Check SSL certificates
if [ ! -f "ssl/fullchain.pem" ] || [ ! -f "ssl/privkey.pem" ]; then
    print_warning "SSL certificates not found"
    print_status "Run ./scripts/ssl-setup.sh first to set up SSL certificates"
    read -p "Continue without SSL? (y/N): " continue_without_ssl
    if [[ ! $continue_without_ssl =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_success "Pre-deployment checks passed!"

# Load environment variables
source .env.production

# Backup current deployment (if exists)
if [ "$(docker ps -q -f name=esports_)" ]; then
    print_status "Backing up current deployment..."
    
    # Create backup directory
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # Backup database
    print_status "Backing up database..."
    docker exec esports_postgres_prod pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > $BACKUP_DIR/database_backup.sql
    
    # Backup uploads
    print_status "Backing up uploads..."
    docker cp esports_backend_prod:/app/uploads $BACKUP_DIR/
    
    print_success "Backup created at $BACKUP_DIR"
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.production.yml down

# Pull latest images
print_status "Pulling latest base images..."
docker-compose -f docker-compose.production.yml pull

# Build production images
print_status "Building production images..."
docker-compose -f docker-compose.production.yml build --no-cache

# Start database first
print_status "Starting database services..."
docker-compose -f docker-compose.production.yml up -d postgres redis

# Wait for database to be ready
print_status "Waiting for database to be ready..."
sleep 30

# Run database migrations
print_status "Running database migrations..."
docker-compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy

# Seed database if needed
if [ ! -f ".production_seeded" ]; then
    print_status "Seeding production database..."
    docker-compose -f docker-compose.production.yml run --rm backend npm run db:seed
    touch .production_seeded
    print_success "Database seeded successfully!"
fi

# Start all services
print_status "Starting all production services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 60

# Health check
print_status "Running health checks..."

# Check backend health
backend_health=$(docker-compose -f docker-compose.production.yml exec -T backend curl -f http://localhost:3001/api/health 2>/dev/null || echo "FAIL")
if [[ $backend_health == *"healthy"* ]]; then
    print_success "Backend service is healthy"
else
    print_error "Backend service health check failed"
    docker-compose -f docker-compose.production.yml logs backend
    exit 1
fi

# Check frontend health
frontend_health=$(docker-compose -f docker-compose.production.yml exec -T frontend curl -f http://localhost/health 2>/dev/null || echo "FAIL")
if [[ $frontend_health == *"healthy"* ]]; then
    print_success "Frontend service is healthy"
else
    print_error "Frontend service health check failed"
    docker-compose -f docker-compose.production.yml logs frontend
    exit 1
fi

# Check database connection
db_health=$(docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} 2>/dev/null || echo "FAIL")
if [[ $db_health == *"accepting connections"* ]]; then
    print_success "Database is healthy"
else
    print_error "Database health check failed"
    exit 1
fi

# Check Redis connection
redis_health=$(docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping 2>/dev/null || echo "FAIL")
if [[ $redis_health == "PONG" ]]; then
    print_success "Redis is healthy"
else
    print_error "Redis health check failed"
    exit 1
fi

# Setup monitoring
print_status "Setting up monitoring..."

# Wait for Prometheus to start
sleep 30

# Check Prometheus
prometheus_health=$(curl -f http://localhost:9090/-/healthy 2>/dev/null || echo "FAIL")
if [[ $prometheus_health == "Prometheus is Healthy." ]]; then
    print_success "Prometheus is healthy"
else
    print_warning "Prometheus health check failed"
fi

# Check Grafana
grafana_health=$(curl -f http://localhost:3002/api/health 2>/dev/null || echo "FAIL")
if [[ $grafana_health == *"ok"* ]]; then
    print_success "Grafana is healthy"
else
    print_warning "Grafana health check failed"
fi

# Setup log rotation
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/esports-platform > /dev/null << EOF
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

# Setup system monitoring
print_status "Setting up system monitoring..."

# Create monitoring user
sudo useradd -r -s /bin/false esports-monitor 2>/dev/null || true

# Setup systemd service for health monitoring
sudo tee /etc/systemd/system/esports-health-monitor.service > /dev/null << EOF
[Unit]
Description=EA SPORTS FC 2025 eSports Platform Health Monitor
After=docker.service

[Service]
Type=simple
User=esports-monitor
ExecStart=/usr/local/bin/esports-health-check.sh
Restart=always
RestartSec=300

[Install]
WantedBy=multi-user.target
EOF

# Create health check script
sudo tee /usr/local/bin/esports-health-check.sh > /dev/null << 'EOF'
#!/bin/bash
cd /opt/esports-platform-fc2025
while true; do
    if ! docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
        echo "$(date): Some services are down, restarting..." >> /var/log/esports-health.log
        docker-compose -f docker-compose.production.yml restart
    fi
    sleep 300
done
EOF

sudo chmod +x /usr/local/bin/esports-health-check.sh

# Enable and start health monitor
sudo systemctl enable esports-health-monitor.service
sudo systemctl start esports-health-monitor.service

# Setup firewall rules
print_status "Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 3001/tcp  # Backend API
    sudo ufw allow 3002/tcp  # Grafana
    sudo ufw allow 9090/tcp  # Prometheus
    sudo ufw --force enable
    print_success "UFW firewall configured"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-port=3001/tcp
    sudo firewall-cmd --permanent --add-port=3002/tcp
    sudo firewall-cmd --permanent --add-port=9090/tcp
    sudo firewall-cmd --reload
    print_success "Firewalld configured"
else
    print_warning "No firewall detected. Please configure manually."
fi

# Performance optimizations
print_status "Applying performance optimizations..."

# Docker daemon optimization
sudo tee /etc/docker/daemon.json > /dev/null << EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2",
    "storage-opts": [
        "overlay2.override_kernel_check=true"
    ]
}
EOF

# Restart Docker daemon
sudo systemctl restart docker

# Wait for Docker to restart
sleep 10

# Restart services after Docker restart
print_status "Restarting services after Docker optimization..."
docker-compose -f docker-compose.production.yml up -d

# Final deployment report
print_status "Generating deployment report..."

cat > deployment-report.txt << EOF
EA SPORTS FC 2025 eSports Platform - Production Deployment Report
================================================================

Deployment Date: $(date)
Environment: Production

Services Status:
================
$(docker-compose -f docker-compose.production.yml ps)

Health Checks:
==============
- Backend API: $(curl -s http://localhost:3001/api/health 2>/dev/null || echo "FAIL")
- Frontend: $(curl -s http://localhost/health 2>/dev/null || echo "FAIL")
- Database: $(docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U ${POSTGRES_USER} 2>/dev/null || echo "FAIL")
- Redis: $(docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping 2>/dev/null || echo "FAIL")
- Prometheus: $(curl -s http://localhost:9090/-/healthy 2>/dev/null || echo "FAIL")
- Grafana: $(curl -s http://localhost:3002/api/health 2>/dev/null || echo "FAIL")

URLs:
=====
- Main Application: https://${DOMAIN:-esports-fc2025.com}
- API Endpoint: https://${API_DOMAIN:-api.esports-fc2025.com}
- Admin Panel: https://${ADMIN_DOMAIN:-admin.esports-fc2025.com}
- Monitoring: https://${MONITORING_DOMAIN:-monitoring.esports-fc2025.com}

Resource Usage:
===============
$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}")

Next Steps:
===========
1. Update DNS records to point to this server
2. Test all functionality
3. Configure monitoring alerts
4. Set up backup schedule
5. Monitor performance metrics

EOF

print_success "Deployment report saved to deployment-report.txt"

# Success message
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                🎉 PRODUCTION DEPLOYMENT COMPLETE! 🎉            ║"
echo "║                                                                  ║"
echo "║  EA SPORTS FC 2025 eSports Platform is now running in           ║"
echo "║  production mode with all services operational.                 ║"
echo "║                                                                  ║"
echo "║  Access URLs:                                                    ║"
echo "║  🌐 Main App: https://${DOMAIN:-esports-fc2025.com}                            ║"
echo "║  🔧 API: https://${API_DOMAIN:-api.esports-fc2025.com}                         ║"
echo "║  👨‍💼 Admin: https://${ADMIN_DOMAIN:-admin.esports-fc2025.com}                    ║"
echo "║  📊 Monitoring: https://${MONITORING_DOMAIN:-monitoring.esports-fc2025.com}          ║"
echo "║                                                                  ║"
echo "║  Credentials:                                                    ║"
echo "║  📧 Admin: admin@esports.com / admin123                         ║"
echo "║  📊 Grafana: ${GRAFANA_USER:-admin} / [configured password]                    ║"
echo "║                                                                  ║"
echo "║  Management Commands:                                            ║"
echo "║  📋 View logs: docker-compose -f docker-compose.production.yml logs -f ║"
echo "║  🔄 Restart: docker-compose -f docker-compose.production.yml restart   ║"
echo "║  📊 Status: docker-compose -f docker-compose.production.yml ps         ║"
echo "║                                                                  ║"
echo "║  🚀 Platform is ready for live tournaments! 🚀                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

print_success "Production deployment completed successfully!"
exit 0