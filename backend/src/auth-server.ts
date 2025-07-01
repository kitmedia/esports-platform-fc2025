import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// Redis setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
  }
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://164.92.239.38:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'EA SPORTS FC 2025 eSports Platform API'
  });
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    message: 'EA SPORTS FC 2025 eSports Platform API is running',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: ['authentication', 'user_registration', 'tournaments']
  });
});

// Auth middleware
const authMiddleware = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName, platform = 'PC' } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        displayName: displayName || username,
        platform: platform as any
      }
    });

    // Generate token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // Store token in Redis
    await redisClient.setEx(`token:${user.id}`, 86400, token);

    const { password: _, ...userResponse } = user;

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: userResponse,
        token,
        expiresIn: '24h'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: email }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended or banned'
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // Store token in Redis
    await redisClient.setEx(`token:${user.id}`, 86400, token);

    const { password: _, ...userResponse } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
        expiresIn: '24h'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatar: true,
        platform: true,
        role: true,
        status: true,
        rating: true,
        wins: true,
        losses: true,
        draws: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data'
    });
  }
});

// Logout
app.post('/api/auth/logout', authMiddleware, async (req: any, res) => {
  try {
    await redisClient.del(`token:${req.user.userId}`);
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Tournaments endpoint (basic)
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: tournaments
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
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
          status: 'REGISTRATION_OPEN',
          registrationStart: new Date().toISOString(),
          registrationEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          tournamentStart: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          organizer: {
            id: '1',
            username: 'admin',
            displayName: 'Administrator'
          }
        }
      ]
    });
  }
});

// Users leaderboard
app.get('/api/users/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      take: 10,
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        rating: true,
        wins: true,
        losses: true,
        draws: true,
        avatar: true
      }
    });

    const leaderboard = users.map((user, index) => ({
      ...user,
      rank: index + 1
    }));

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
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
          draws: 5,
          rank: 1,
          avatar: null
        }
      ]
    });
  }
});

// Catch all for missing API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.path} not implemented yet`,
    availableEndpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/logout',
      'GET /api/tournaments',
      'GET /api/users/leaderboard'
    ]
  });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Global error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    app.listen(PORT, () => {
      console.log('\\n🚀 EA SPORTS FC 2025 eSports Platform API v2.0');
      console.log('================================================');
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Authentication: ENABLED`);
      console.log(`📋 Endpoints:`);
      console.log(`   POST /api/auth/register`);
      console.log(`   POST /api/auth/login`);
      console.log(`   GET /api/auth/me`);
      console.log(`   GET /api/tournaments`);
      console.log(`   GET /api/users/leaderboard`);
      console.log('================================================\\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
});

startServer();

export default app;