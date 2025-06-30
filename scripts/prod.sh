#!/bin/bash

# EA SPORTS FC 2025 eSports Platform - Production Launcher
# Quick access script for production deployment

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
echo "║                Production Quick Launcher                        ║"
echo "║                                                                  ║"
echo "║          EA SPORTS FC 2025 eSports Platform                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running in correct directory
if [ ! -f "docker-compose.production.yml" ]; then
    print_error "docker-compose.production.yml not found"
    print_status "Make sure you're running this from the project root directory"
    exit 1
fi

# Parse command line arguments
COMMAND="$1"

case "$COMMAND" in
    "start"|"up"|"")
        print_status "Starting production environment..."
        
        # Check if Docker is available
        if ! command -v docker &> /dev/null; then
            print_warning "Docker is not installed on this system"
            print_status "To run in production, you need to:"
            echo "1. Install Docker and Docker Compose"
            echo "2. Configure your production server"
            echo "3. Run this script on your production server"
            echo ""
            print_status "For development, use: ./scripts/dev.sh"
            echo ""
            print_status "Production deployment guide: PRODUCTION_GUIDE.md"
            exit 1
        fi
        
        # Check if docker-compose command exists
        if command -v docker-compose &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker-compose"
        elif docker compose version &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker compose"
        else
            print_error "Docker Compose not found"
            print_status "Please install Docker Compose"
            exit 1
        fi
        
        # Start with production configuration
        $DOCKER_COMPOSE_CMD -f docker-compose.production.yml up -d
        
        print_success "Production environment started!"
        print_status "Services will be available at:"
        echo "  🌐 Frontend: https://esports-fc2025.com"
        echo "  🔧 API: https://api.esports-fc2025.com"
        echo "  👨‍💼 Admin: https://admin.esports-fc2025.com"
        echo "  📊 Monitoring: https://monitoring.esports-fc2025.com"
        ;;
        
    "stop"|"down")
        print_status "Stopping production environment..."
        docker-compose -f docker-compose.production.yml down
        print_success "Production environment stopped!"
        ;;
        
    "restart")
        print_status "Restarting production environment..."
        docker-compose -f docker-compose.production.yml restart
        print_success "Production environment restarted!"
        ;;
        
    "logs")
        print_status "Showing production logs..."
        docker-compose -f docker-compose.production.yml logs -f
        ;;
        
    "status"|"ps")
        print_status "Production environment status:"
        docker-compose -f docker-compose.production.yml ps
        ;;
        
    "deploy")
        print_status "Running full production deployment..."
        ./scripts/prod-deploy.sh
        ;;
        
    "backup")
        print_status "Running system backup..."
        ./scripts/backup-system.sh
        ;;
        
    "health")
        print_status "Checking system health..."
        ./scripts/disaster-recovery.sh health-check
        ;;
        
    "ssl")
        print_status "Setting up SSL certificates..."
        ./scripts/ssl-setup.sh
        ;;
        
    "optimize")
        print_status "Optimizing database..."
        ./scripts/db-optimize.sh
        ;;
        
    "monitor")
        print_status "Opening monitoring dashboard..."
        if command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:3002"  # Grafana
        elif command -v open &> /dev/null; then
            open "http://localhost:3002"      # macOS
        else
            print_status "Monitoring available at: http://localhost:3002"
        fi
        ;;
        
    "build")
        print_status "Building production images..."
        docker-compose -f docker-compose.production.yml build --no-cache
        print_success "Production images built!"
        ;;
        
    "scale")
        REPLICAS=${2:-2}
        print_status "Scaling backend to $REPLICAS replicas..."
        docker-compose -f docker-compose.production.yml up -d --scale backend=$REPLICAS
        print_success "Backend scaled to $REPLICAS replicas!"
        ;;
        
    "exec")
        SERVICE=${2:-backend}
        print_status "Accessing $SERVICE container..."
        docker-compose -f docker-compose.production.yml exec $SERVICE bash
        ;;
        
    "clean")
        print_warning "This will remove all stopped containers, networks, and unused images"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker system prune -f
            docker volume prune -f
            print_success "System cleaned!"
        else
            print_status "Clean operation cancelled"
        fi
        ;;
        
    "update")
        print_status "Updating platform to latest version..."
        git pull origin main
        docker-compose -f docker-compose.production.yml build --no-cache
        docker-compose -f docker-compose.production.yml up -d
        print_success "Platform updated!"
        ;;
        
    "help"|"-h"|"--help")
        echo ""
        echo "EA SPORTS FC 2025 eSports Platform - Production Commands"
        echo "========================================================"
        echo ""
        echo "Usage: ./scripts/prod.sh [COMMAND] [OPTIONS]"
        echo ""
        echo "Commands:"
        echo "  start, up        Start production environment"
        echo "  stop, down       Stop production environment"
        echo "  restart          Restart all services"
        echo "  logs             Show live logs"
        echo "  status, ps       Show service status"
        echo "  deploy           Full production deployment"
        echo "  backup           Create system backup"
        echo "  health           Check system health"
        echo "  ssl              Setup SSL certificates"
        echo "  optimize         Optimize database"
        echo "  monitor          Open monitoring dashboard"
        echo "  build            Build production images"
        echo "  scale [N]        Scale backend to N replicas"
        echo "  exec [service]   Access service container"
        echo "  clean            Clean Docker system"
        echo "  update           Update to latest version"
        echo "  help             Show this help"
        echo ""
        echo "Examples:"
        echo "  ./scripts/prod.sh start"
        echo "  ./scripts/prod.sh scale 3"
        echo "  ./scripts/prod.sh exec backend"
        echo "  ./scripts/prod.sh logs"
        echo ""
        ;;
        
    *)
        print_error "Unknown command: $COMMAND"
        print_status "Use './scripts/prod.sh help' for available commands"
        exit 1
        ;;
esac

exit 0