import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import compression from 'compression';

// Database and Redis
import { prisma } from './config/database';
import { redisClient, connectRedis } from './config/redis';

// Services
import { AuthService } from './services/AuthService';
import { RedisService } from './services/RedisService';

// Import route functions
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Redis service
const redisService = new RedisService();

// Initialize services
const authService = new AuthService(prisma, redisService);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://164.92.239.38:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'EA SPORTS FC 2025 eSports Platform API'
  });
});

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'EA SPORTS FC 2025 eSports Platform API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes(authService));

// Basic routes for other endpoints to prevent 404s
app.get('/api/tournaments', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'EA SPORTS FC 2025 Championship',
        description: 'The ultimate FC 2025 tournament',
        format: 'SINGLE_ELIMINATION',
        gameMode: 'ULTIMATE_TEAM',
        platform: 'PC',
        maxParticipants: 64,
        currentParticipants: 0,
        entryFee: 0,
        prizePool: 1000,
        registrationStart: new Date().toISOString(),
        registrationEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tournamentStart: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'REGISTRATION_OPEN'
      }
    ]
  });
});

app.get('/api/users/leaderboard', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        username: 'Champion2025',
        displayName: 'FC Champion',
        rating: 2500,
        wins: 100,
        losses: 10,
        rank: 1,
        avatar: null
      }
    ]
  });
});

// Catch all route for API
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', err);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// Database and Redis connection
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected successfully');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log('\\n🚀 EA SPORTS FC 2025 eSports Platform API');
      console.log('================================================');
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🎮 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📋 API Documentation: http://localhost:${PORT}/api/status`);
      console.log('================================================\\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\\n🔄 Received SIGTERM, shutting down gracefully...');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\\n🔄 Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});

export default app;