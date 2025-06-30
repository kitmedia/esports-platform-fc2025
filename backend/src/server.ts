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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EA SPORTS FC 2025 eSports Platform API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;