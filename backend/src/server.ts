import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import tournamentRoutes from './routes/tournaments';
import matchRoutes from './routes/matches';
import paymentRoutes from './routes/payments';
import streamingRoutes from './routes/streaming';
import aiRoutes from './routes/ai';
import arbitrationRoutes from './routes/arbitration';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/arbitration', arbitrationRoutes);
app.use('/api/admin', adminRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EA SPORTS FC 2025 eSports Platform API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;