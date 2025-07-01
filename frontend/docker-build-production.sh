#!/bin/bash

# Docker build script for production deployment
# This script builds the frontend Docker image with production API URLs

echo "Building frontend Docker image for production..."

# Build the Docker image with production environment variables
docker build \
  --build-arg VITE_API_URL=http://164.92.239.38:3001 \
  --build-arg VITE_WS_URL=http://164.92.239.38:3001 \
  -t esports-frontend:production \
  .

echo "Docker build complete!"
echo "To run the container: docker run -p 80:80 esports-frontend:production"
echo "Frontend will connect to API at: http://164.92.239.38:3001/api"