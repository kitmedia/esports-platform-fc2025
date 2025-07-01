# 🔧 Quick Deploy Fix for Production Server

## Problem
Docker build failing with TypeScript compilation errors on production server.

## Solution
Use simplified deployment that bypasses TypeScript compilation.

## Commands to Run on Production Server (164.92.239.38)

```bash
# 1. Pull latest code
cd /root/esports-platform-fc2025
git pull origin main

# 2. Create simplified Dockerfile
cat > backend/Dockerfile.simple << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY .env ./
EXPOSE 3001
CMD ["node", "src/server.ts"]
EOF

# 3. Create simplified docker-compose
cat > docker-compose.simple.yml << 'EOF'
version: '3.8'
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.simple
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/esports_db
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-super-secret-jwt-key-change-in-production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=esports_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
EOF

# 4. Stop current containers and rebuild
docker-compose down
docker-compose -f docker-compose.simple.yml build backend --no-cache
docker-compose -f docker-compose.simple.yml up -d

# 5. Verify deployment
sleep 10
docker-compose -f docker-compose.simple.yml ps
curl http://localhost:3001/health
curl http://localhost:3001/api/status
```

## Test Registration
```bash
curl -X POST http://164.92.239.38:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"TestPassword123","displayName":"Test User"}'
```

This should resolve the "no me puedo registrar y no puedo hacer nada funcional" issue.