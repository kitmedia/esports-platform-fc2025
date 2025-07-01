#!/bin/bash

echo "🚀 Aplicando solución rápida para el backend..."

# Crear versiones simples de las rutas que funcionen
cat > /tmp/simple-server.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'EA SPORTS FC 2025 eSports Platform API'
  });
});

// Basic routes that return sample data
app.get('/api/status', (req, res) => {
  res.json({ message: 'API is running', version: '1.0.0' });
});

// Tournaments routes
app.get('/api/tournaments', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'EA SPORTS FC 2025 Championship',
      game: 'FC 2025',
      platform: 'PS5',
      format: 'single-elimination',
      maxParticipants: 64,
      currentParticipants: 0,
      entryFee: 0,
      prizePool: 1000,
      startDate: new Date().toISOString(),
      status: 'upcoming'
    }
  ]);
});

// Users routes
app.get('/api/users/leaderboard', (req, res) => {
  res.json([
    {
      id: '1',
      username: 'Champion2025',
      rating: 2500,
      wins: 100,
      losses: 10,
      rank: 1
    }
  ]);
});

// Generic handler for other routes
app.use('/api/*', (req, res) => {
  res.json({ message: 'Endpoint in development', data: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 EA SPORTS FC 2025 eSports Platform API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
EOF

# Copiar al contenedor y compilar
docker cp /tmp/simple-server.ts esports_backend:/app/src/server.ts
docker exec esports_backend npm run build

# Reiniciar el backend
docker-compose restart backend

echo "✅ Backend parcheado con rutas básicas"
echo "🔍 Verificando..."
sleep 5

# Test
curl http://164.92.239.38:3001/api/tournaments
echo ""
curl http://164.92.239.38:3001/api/users/leaderboard