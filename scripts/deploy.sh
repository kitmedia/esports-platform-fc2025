#!/bin/bash
# EA SPORTS FC 2025 eSports Platform - Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 EA SPORTS FC 2025 eSports Platform Deployment${NC}"
echo "================================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  dev        - Start development environment"
    echo "  prod       - Start production environment"
    echo "  monitoring - Start with monitoring stack"
    echo "  logging    - Start with logging stack"
    echo "  full       - Start with all services"
    echo "  stop       - Stop all services"
    echo "  restart    - Restart all services"
    echo "  logs       - Show service logs"
    echo "  status     - Show service status"
    echo "  backup     - Create database backup"
    echo "  ssl        - Generate SSL certificates"
    exit 1
}

# Parse command line arguments
MODE=${1:-dev}

case $MODE in
    "dev")
        echo -e "${YELLOW}🔧 Starting development environment...${NC}"
        docker-compose up -d postgres redis
        sleep 5
        docker-compose up -d backend frontend
        ;;
    "prod")
        echo -e "${YELLOW}🌐 Starting production environment...${NC}"
        if [ ! -f ".env.production" ]; then
            echo -e "${RED}❌ .env.production file not found. Please create it first.${NC}"
            exit 1
        fi
        docker-compose -f docker-compose.yml -f docker-compose.production.yml --env-file .env.production up -d
        ;;
    "monitoring")
        echo -e "${YELLOW}📊 Starting with monitoring stack...${NC}"
        docker-compose --profile monitoring up -d
        ;;
    "logging")
        echo -e "${YELLOW}📝 Starting with logging stack...${NC}"
        docker-compose --profile logging up -d
        ;;
    "full")
        echo -e "${YELLOW}🎯 Starting full stack...${NC}"
        docker-compose --profile monitoring --profile logging --profile production up -d
        ;;
    "stop")
        echo -e "${YELLOW}🛑 Stopping all services...${NC}"
        docker-compose down
        docker-compose -f docker-compose.production.yml down 2>/dev/null || true
        ;;
    "restart")
        echo -e "${YELLOW}🔄 Restarting services...${NC}"
        docker-compose restart
        ;;
    "logs")
        echo -e "${YELLOW}📋 Showing service logs...${NC}"
        docker-compose logs -f --tail=100
        ;;
    "status")
        echo -e "${YELLOW}ℹ️  Service status:${NC}"
        docker-compose ps
        ;;
    "backup")
        echo -e "${YELLOW}💾 Creating database backup...${NC}"
        docker-compose exec postgres /usr/local/bin/backup-postgres.sh
        ;;
    "ssl")
        echo -e "${YELLOW}🔒 Generating SSL certificates...${NC}"
        if [ -z "$DOMAIN_NAME" ]; then
            echo -e "${RED}❌ DOMAIN_NAME environment variable not set${NC}"
            exit 1
        fi
        docker-compose --profile ssl run --rm certbot
        ;;
    *)
        echo -e "${RED}❌ Invalid option: $MODE${NC}"
        show_usage
        ;;
esac

# Wait for services to be ready
if [[ "$MODE" == "dev" || "$MODE" == "prod" || "$MODE" == "full" ]]; then
    echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
    sleep 10
    
    # Check if backend is healthy
    for i in {1..30}; do
        if curl -f http://localhost:3001/health &>/dev/null; then
            echo -e "${GREEN}✅ Backend is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Backend failed to start${NC}"
            exit 1
        fi
        sleep 2
    done
    
    # Check if frontend is healthy
    for i in {1..30}; do
        if curl -f http://localhost:3000/health &>/dev/null || curl -f http://localhost:3000 &>/dev/null; then
            echo -e "${GREEN}✅ Frontend is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Frontend failed to start${NC}"
            exit 1
        fi
        sleep 2
    done
    
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo "================================================"
    echo -e "${BLUE}📍 Access URLs:${NC}"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:3001/api"
    echo "   Database: localhost:5432"
    echo "   Redis: localhost:6379"
    
    if [[ "$MODE" == "monitoring" || "$MODE" == "full" ]]; then
        echo "   Prometheus: http://localhost:9090"
        echo "   Grafana: http://localhost:3002 (admin/admin123)"
    fi
    
    if [[ "$MODE" == "logging" || "$MODE" == "full" ]]; then
        echo "   Elasticsearch: http://localhost:9200"
        echo "   Kibana: http://localhost:5601"
    fi
    
    if [[ "$MODE" == "prod" || "$MODE" == "full" ]]; then
        echo "   MinIO Console: http://localhost:9001"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 Useful commands:${NC}"
    echo "   View logs: ./scripts/deploy.sh logs"
    echo "   Check status: ./scripts/deploy.sh status"
    echo "   Stop services: ./scripts/deploy.sh stop"
    echo "   Create backup: ./scripts/deploy.sh backup"
fi