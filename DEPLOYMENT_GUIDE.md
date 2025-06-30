# 🚀 EA SPORTS FC 2025 eSports Platform - Deployment Guide

## 📋 Prerequisites

- **Node.js** 20+ and npm 10+
- **Docker** and Docker Compose
- **Git** for version control
- **PostgreSQL** 15+ (if not using Docker)
- **Redis** 7+ (if not using Docker)

## 🏗️ Quick Setup

### 1. Clone and Setup
```bash
git clone <repository-url>
cd esports-platform-fc2025
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 2. Configure Environment
```bash
# Copy and edit environment file
cp .env.example .env
nano .env
```

**Required Environment Variables:**
```env
# Database
DATABASE_URL=postgresql://esports:your_password@localhost:5432/esports_platform
REDIS_URL=redis://:your_redis_password@localhost:6379

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# API Keys
OPENAI_API_KEY=sk-your_openai_api_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
DISCORD_BOT_TOKEN=your_discord_bot_token

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## 🔧 Development Mode

### Start Development Environment
```bash
./scripts/dev.sh
```

This will start:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **Database**: PostgreSQL on port 5432
- **Redis**: Redis on port 6379

### Manual Development Setup
```bash
# Start databases
docker-compose up -d postgres redis

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## 🚀 Production Deployment

### Option 1: Docker Compose (Recommended)
```bash
# Start all production services
./scripts/prod.sh

# Or manually:
docker-compose -f docker-compose.yml up -d --build
```

### Option 2: Manual Production Setup
```bash
# Build backend
cd backend
npm ci --only=production
npx prisma generate
npm run build

# Build frontend
cd ../frontend
npm ci --only=production
npm run build

# Start with PM2 (recommended for production)
npm install -g pm2
pm2 start ecosystem.config.js
```

## 🌐 Production Services

Once deployed, access:
- **Frontend**: http://localhost (or your domain)
- **API**: http://localhost/api
- **Admin Panel**: http://localhost/admin
- **Monitoring**: http://localhost:9090 (Prometheus)
- **Grafana**: http://localhost:3001 (Grafana dashboards)

## 🔐 Security Checklist

### Before Production:
- [ ] Change all default passwords in `.env`
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure CORS for your domain only
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure backup strategy
- [ ] Set up monitoring and alerts

### SSL/HTTPS Setup:
```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d yourdomain.com

# Auto-renew
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Health endpoints
curl http://localhost:3001/api/health
curl http://localhost/health
```

### Database Maintenance
```bash
# Backup database
pg_dump -h localhost -U esports esports_platform > backup.sql

# Restore database
psql -h localhost -U esports esports_platform < backup.sql

# Run migrations
cd backend && npx prisma migrate deploy
```

### Performance Monitoring
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **Logs**: `docker-compose logs`

## 🛠️ Troubleshooting

### Common Issues:

**Port conflicts:**
```bash
# Check what's using ports
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001

# Kill processes
sudo kill -9 <PID>
```

**Database connection issues:**
```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres
cd backend && npx prisma migrate reset
```

**Memory issues:**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Monitor memory usage
docker stats
```

**Permission issues:**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

## 📈 Scaling

### Horizontal Scaling:
```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# Use nginx load balancer
docker-compose --profile production up -d
```

### Database Optimization:
```sql
-- Add indexes for better performance
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_users_email ON users(email);
```

## 🔄 Updates & Maintenance

### Update Platform:
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Run any new migrations
cd backend && npx prisma migrate deploy
```

### Backup Strategy:
```bash
# Daily database backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U esports esports_platform > backups/db_backup_$DATE.sql
find backups/ -name "*.sql" -mtime +30 -delete
```

## 📞 Support

For issues or questions:
1. Check the logs: `docker-compose logs`
2. Review this guide
3. Check GitHub issues
4. Contact support team

## 🎯 Features Included

✅ **Complete Tournament Management System**
✅ **Real-time Match Streaming**
✅ **AI-Powered Analytics**
✅ **Payment Processing (Stripe)**
✅ **Discord Integration**
✅ **Admin Panel**
✅ **WebSocket Real-time Features**
✅ **Comprehensive Error Handling**
✅ **Production-ready Deployment**
✅ **Monitoring & Logging**

---

🏆 **EA SPORTS FC 2025 eSports Platform** - Ready for production use!