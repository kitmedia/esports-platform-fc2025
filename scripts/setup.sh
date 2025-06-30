#!/bin/bash

# EA SPORTS FC 2025 eSports Platform - Setup Script
# This script sets up the complete development environment

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║        EA SPORTS FC 2025 eSports Platform - Setup Script       ║"
echo "║                                                                  ║"
echo "║  🏆 Revolutionary tournament platform with AI-powered features  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js found: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm found: $NPM_VERSION"
else
    print_error "npm is not installed. Please install npm."
    exit 1
fi

# Check Docker
if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker found: $DOCKER_VERSION"
else
    print_warning "Docker not found. Some features may not work without Docker."
fi

# Check Docker Compose
if command_exists docker-compose; then
    DOCKER_COMPOSE_VERSION=$(docker-compose --version)
    print_success "Docker Compose found: $DOCKER_COMPOSE_VERSION"
elif command_exists docker && docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_VERSION=$(docker compose version)
    print_success "Docker Compose found: $DOCKER_COMPOSE_VERSION"
else
    print_warning "Docker Compose not found. Some features may not work without Docker Compose."
fi

# Check Git
if command_exists git; then
    GIT_VERSION=$(git --version)
    print_success "Git found: $GIT_VERSION"
else
    print_error "Git is not installed. Please install Git."
    exit 1
fi

print_success "All prerequisites satisfied!"

# Setup environment files
print_status "Setting up environment files..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"
        print_warning "Please edit .env file with your configuration before proceeding!"
    else
        print_error ".env.example not found. Cannot create .env file."
        exit 1
    fi
else
    print_warning ".env file already exists. Skipping..."
fi

# Setup backend
print_status "Setting up backend..."
cd backend

if [ ! -d "node_modules" ]; then
    print_status "Installing backend dependencies..."
    npm install
    print_success "Backend dependencies installed!"
else
    print_warning "Backend node_modules already exists. Run 'npm install' manually if needed."
fi

# Generate Prisma client
print_status "Generating Prisma client..."
npx prisma generate
print_success "Prisma client generated!"

cd ..

# Setup frontend
print_status "Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install
    print_success "Frontend dependencies installed!"
else
    print_warning "Frontend node_modules already exists. Run 'npm install' manually if needed."
fi

cd ..

# Docker setup
if command_exists docker && command_exists docker-compose; then
    print_status "Setting up Docker environment..."
    
    # Create necessary directories
    mkdir -p nginx/logs
    mkdir -p monitoring/grafana/dashboards
    mkdir -p monitoring/grafana/datasources
    mkdir -p streaming/media
    
    print_success "Docker directories created!"
    
    # Start databases first
    print_status "Starting database services..."
    docker-compose up -d postgres redis
    
    # Wait for databases to be ready
    print_status "Waiting for databases to be ready..."
    sleep 10
    
    # Run database migrations
    print_status "Running database migrations..."
    cd backend
    npx prisma migrate deploy
    print_success "Database migrations completed!"
    
    # Seed database with initial data
    print_status "Seeding database with initial data..."
    npm run db:seed
    print_success "Database seeded!"
    
    cd ..
    
    print_success "Docker environment setup completed!"
else
    print_warning "Docker not available. Skipping Docker setup."
    print_warning "You'll need to manually set up PostgreSQL and Redis databases."
fi

# Create necessary directories
print_status "Creating application directories..."
mkdir -p backend/uploads
mkdir -p backend/logs
mkdir -p frontend/dist
mkdir -p database/backups
print_success "Application directories created!"

# Setup monitoring configuration
print_status "Setting up monitoring configuration..."

# Prometheus config
cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'esports-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/api/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

print_success "Monitoring configuration created!"

# Create nginx configuration
print_status "Setting up nginx configuration..."

cat > nginx/nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3001;
    }

    upstream frontend {
        server frontend:80;
    }

    server {
        listen 80;
        server_name localhost;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # WebSocket
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF

print_success "Nginx configuration created!"

# Create development script
print_status "Creating development scripts..."

cat > scripts/dev.sh << 'EOF'
#!/bin/bash

# Start development environment
echo "Starting EA SPORTS FC 2025 eSports Platform in development mode..."

# Start databases
docker-compose up -d postgres redis

# Wait for databases
sleep 5

# Start backend in development mode
cd backend
npm run dev &
BACKEND_PID=$!

# Start frontend in development mode
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend running on http://localhost:3001"
echo "Frontend running on http://localhost:3000"
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; docker-compose stop postgres redis; exit" INT
wait
EOF

chmod +x scripts/dev.sh

cat > scripts/prod.sh << 'EOF'
#!/bin/bash

# Start production environment
echo "Starting EA SPORTS FC 2025 eSports Platform in production mode..."

# Build and start all services
docker-compose -f docker-compose.yml up -d --build

echo "Platform running at http://localhost"
echo "Admin panel at http://localhost/admin"
echo "API at http://localhost/api"
echo "Monitoring at http://localhost:9090 (Prometheus) and http://localhost:3001 (Grafana)"
EOF

chmod +x scripts/prod.sh

print_success "Development scripts created!"

# Final setup message
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    🎉 SETUP COMPLETED! 🎉                       ║"
echo "║                                                                  ║"
echo "║  Your EA SPORTS FC 2025 eSports Platform is ready to run!       ║"
echo "║                                                                  ║"
echo "║  Next steps:                                                     ║"
echo "║  1. Edit .env file with your configuration                       ║"
echo "║  2. Run './scripts/dev.sh' for development                       ║"
echo "║  3. Run './scripts/prod.sh' for production                       ║"
echo "║                                                                  ║"
echo "║  URLs:                                                           ║"
echo "║  • Frontend: http://localhost:3000                               ║"
echo "║  • Backend API: http://localhost:3001                            ║"
echo "║  • Database: postgresql://localhost:5432                         ║"
echo "║  • Redis: redis://localhost:6379                                 ║"
echo "║                                                                  ║"
echo "║  Features included:                                              ║"
echo "║  ✅ AI-Powered Tournament Management                             ║"
echo "║  ✅ Real-time Streaming Integration                              ║"
echo "║  ✅ Advanced Analytics Dashboard                                 ║"
echo "║  ✅ Payment Processing (Stripe)                                  ║"
echo "║  ✅ Discord & Social Integration                                 ║"
echo "║  ✅ Admin Panel & Moderation Tools                               ║"
echo "║  ✅ WebSocket Real-time Features                                 ║"
echo "║  ✅ Comprehensive Error Handling                                 ║"
echo "║  ✅ Production-ready Deployment                                  ║"
echo "║                                                                  ║"
echo "║  Happy coding! 🚀                                               ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

print_success "Setup script completed successfully!"
print_warning "Don't forget to configure your .env file before starting the platform!"

exit 0