#!/bin/bash

# Build script for production deployment
# This script builds the frontend with production API URLs

echo "Building frontend for production..."

# Export production environment variables
export VITE_API_URL=http://164.92.239.38:3001
export VITE_WS_URL=http://164.92.239.38:3001

# Clean previous build
rm -rf dist

# Install dependencies
npm install

# Build the application
npm run build

echo "Build complete! The production build is in the 'dist' directory."
echo "Frontend will connect to API at: $VITE_API_URL/api"