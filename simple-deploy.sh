#!/bin/bash

echo "🚀 Simple Production Deployment..."

# Create a simplified .env file with just the essentials
cat > .env << 'EOF'
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_51234567890
OBS_WEBSOCKET_URL=ws://164.92.239.38:4444
VITE_API_URL=http://164.92.239.38:3001
VITE_WS_URL=ws://164.92.239.38:3001

# Database
POSTGRES_DB=esports_platform
POSTGRES_USER=esports_user
POSTGRES_PASSWORD=esports_password
REDIS_PASSWORD=redis_password

# JWT
JWT_SECRET=your_super_secure_jwt_secret_min_32_characters_long
JWT_REFRESH_SECRET=your_super_secure_refresh_jwt_secret_different

# Basic settings
NODE_ENV=production
PORT=3001
EOF

# Stop any running containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.production.yml down

# Build and start with the base docker-compose
echo "🔄 Starting services..."
docker-compose up -d --build

echo "✅ Simple deployment complete!"
echo "🌐 Frontend: http://164.92.239.38"
echo "🔧 API: http://164.92.239.38:3001"
echo "🔍 Debug: http://164.92.239.38/debug.html"

# Show logs for debugging
echo "📋 Recent logs:"
docker-compose logs --tail=20