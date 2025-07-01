#!/bin/bash

echo "🚀 Fixing Production Deployment..."

# Ensure environment variables are loaded
export $(cat .env.production | grep -v '^#' | xargs)

# Copy debug.html to the nginx static directory for quick access
mkdir -p ./nginx/html/
cp debug.html ./nginx/html/

# Build frontend with correct configuration
echo "📦 Building frontend..."
cd frontend
docker build --no-cache \
  --build-arg VITE_API_URL=http://164.92.239.38:3001 \
  --build-arg VITE_WS_URL=ws://164.92.239.38:3001 \
  -t esports-frontend:latest .

if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful"
    cd ..
    
    # Start services
    echo "🔄 Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    echo "✅ Production deployment complete!"
    echo "🌐 Frontend: http://164.92.239.38"
    echo "🔧 API: http://164.92.239.38:3001"
    echo "🔍 Debug: http://164.92.239.38/debug.html"
else
    echo "❌ Frontend build failed"
    cd ..
    exit 1
fi