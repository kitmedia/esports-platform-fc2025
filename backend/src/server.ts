import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Import services
import { PrismaService } from './services/PrismaService';
import { RedisService } from './services/RedisService';
import { AuthService } from './services/AuthService';
import { AIService } from './services/AIService';
import { TournamentService } from './services/TournamentService';
import { StreamingService } from './services/StreamingService';
import { PaymentService } from './services/PaymentService';
import { NotificationService } from './services/NotificationService';
import { ArbitrationService } from './services/ArbitrationService';
import { DiscordBotService } from './services/DiscordBotService';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import tournamentRoutes from './routes/tournaments';
import matchRoutes from './routes/matches';
import aiRoutes from './routes/ai';
import streamingRoutes from './routes/streaming';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import arbitrationRoutes from './routes/arbitration';

// Import middleware
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { validateRequest } from './middleware/validation';

// Import WebSocket handlers
import { initializeWebSocket } from './websocket/socketManager';

// Load environment variables
dotenv.config();

class ESportsServer {
    private app: Application;
    private server: any;
    private io: SocketIOServer;
    private port: number;
    
    // Services
    private prisma: PrismaService;
    private redis: RedisService;
    private auth: AuthService;
    private ai: AIService;
    private tournament: TournamentService;
    private streaming: StreamingService;
    private payment: PaymentService;
    private notification: NotificationService;
    private arbitration: ArbitrationService;
    private discordBot: DiscordBotService;

    constructor() {
        this.app = express();
        this.port = parseInt(process.env.PORT || '3001');
        this.server = createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: process.env.FRONTEND_URL || "*",
                methods: ["GET", "POST"],
                credentials: true
            }
        });

        this.initializeServices();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    private async initializeServices(): Promise<void> {
        console.log(chalk.cyan('🔧 Initializing services...'));

        try {
            // Core services
            this.prisma = new PrismaService();
            await this.prisma.initialize();

            this.redis = new RedisService();
            await this.redis.initialize();

            // Business services
            this.auth = new AuthService(this.prisma, this.redis);
            this.ai = new AIService();
            this.tournament = new TournamentService(this.prisma, this.ai);
            this.streaming = new StreamingService(this.ai);
            this.payment = new PaymentService(this.prisma);
            this.notification = new NotificationService(this.prisma, this.io);
            this.arbitration = new ArbitrationService(this.prisma, this.ai);
            this.discordBot = new DiscordBotService(this.prisma);

            // Initialize services
            await this.ai.initialize();
            await this.payment.initialize();
            await this.discordBot.initialize();

            console.log(chalk.green('✅ All services initialized successfully'));
        } catch (error) {
            console.error(chalk.red('❌ Failed to initialize services:'), error);
            process.exit(1);
        }
    }

    private setupMiddleware(): void {
        console.log(chalk.cyan('🔧 Setting up middleware...'));

        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
                    scriptSrc: ["'self'", "https:"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:", "https:"],
                }
            }
        }));

        // CORS
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || "*",
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use(limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Compression
        this.app.use(compression());

        // Logging
        this.app.use(logger);

        console.log(chalk.green('✅ Middleware setup complete'));
    }

    private setupRoutes(): void {
        console.log(chalk.cyan('🔧 Setting up routes...'));

        // Health check
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                services: {
                    database: this.prisma.isConnected(),
                    redis: this.redis.isConnected(),
                    ai: this.ai.isReady()
                }
            });
        });

        // API routes
        this.app.use('/api/auth', authRoutes(this.auth));
        this.app.use('/api/users', authMiddleware(this.auth), userRoutes(this.prisma));
        this.app.use('/api/tournaments', authMiddleware(this.auth), tournamentRoutes(this.tournament));
        this.app.use('/api/matches', authMiddleware(this.auth), matchRoutes(this.prisma, this.ai));
        this.app.use('/api/ai', authMiddleware(this.auth), aiRoutes(this.ai));
        this.app.use('/api/streaming', authMiddleware(this.auth), streamingRoutes(this.streaming));
        this.app.use('/api/payments', authMiddleware(this.auth), paymentRoutes(this.payment));
        this.app.use('/api/arbitration', authMiddleware(this.auth), arbitrationRoutes(this.arbitration));
        this.app.use('/api/admin', authMiddleware(this.auth), adminRoutes(this.prisma));

        // Catch all for undefined routes
        this.app.all('*', (req: Request, res: Response) => {
            res.status(404).json({
                success: false,
                message: `Route ${req.method} ${req.path} not found`
            });
        });

        console.log(chalk.green('✅ Routes setup complete'));
    }

    private setupWebSocket(): void {
        console.log(chalk.cyan('🔧 Setting up WebSocket...'));
        
        initializeWebSocket(this.io, {
            prisma: this.prisma,
            auth: this.auth,
            tournament: this.tournament,
            notification: this.notification,
            ai: this.ai
        });

        console.log(chalk.green('✅ WebSocket setup complete'));
    }

    private setupErrorHandling(): void {
        this.app.use(errorHandler);

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());

        // Unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
        });

        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error(chalk.red('Uncaught Exception:'), error);
            this.shutdown(1);
        });
    }

    public async start(): Promise<void> {
        try {
            this.server.listen(this.port, () => {
                console.log(chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    🏆 EA SPORTS FC 2025 eSports Platform                   ║
║                                                              ║
║    🚀 Server running on: http://localhost:${this.port}                 ║
║    📊 API Docs: http://localhost:${this.port}/api/docs              ║
║    🎮 WebSocket: ws://localhost:${this.port}                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
                `));

                console.log(chalk.green(`
🎯 Available Features:
  • 🧠 AI Tournament Assistant
  • 🤖 Automatic Result Validation (OCR + AI)
  • 🎥 Live Streaming Integration
  • 🧑‍⚖️ Decentralized Arbitration System
  • 🧩 Discord Bot Integration
  • 💳 Stripe Payment Processing
  • 📊 Advanced Analytics & ELO System
  • 🌍 Multi-language Support
  • 📱 Real-time WebSocket Updates
  • 🔐 OAuth (Discord, Twitch, EA Connect)
                `));

                console.log(chalk.yellow(`
💡 AI Features Status:
  • OpenAI API: ${this.ai.isReady() ? '✅ Ready' : '❌ Not configured'}
  • OCR Engine: ✅ Ready (Tesseract.js)
  • Result Validation: ✅ Ready
  • Tournament Assistant: ✅ Ready
                `));
            });
        } catch (error) {
            console.error(chalk.red('❌ Failed to start server:'), error);
            process.exit(1);
        }
    }

    private async shutdown(exitCode: number = 0): Promise<void> {
        console.log(chalk.yellow('🔄 Shutting down server...'));

        try {
            // Close WebSocket connections
            this.io.close();

            // Close HTTP server
            this.server.close();

            // Disconnect from services
            await this.prisma.disconnect();
            await this.redis.disconnect();

            console.log(chalk.green('✅ Server shut down gracefully'));
            process.exit(exitCode);
        } catch (error) {
            console.error(chalk.red('❌ Error during shutdown:'), error);
            process.exit(1);
        }
    }
}

// Start the server
const server = new ESportsServer();
server.start().catch((error) => {
    console.error(chalk.red('❌ Failed to start server:'), error);
    process.exit(1);
});