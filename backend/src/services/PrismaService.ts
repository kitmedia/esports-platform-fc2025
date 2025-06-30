import { PrismaClient } from '@prisma/client';

export class PrismaService {
  private prisma: PrismaClient;
  private connected = false;

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.connected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.prisma.$disconnect();
      this.connected = false;
      console.log('🔌 Database disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Expose Prisma client for use in other services
  get client(): PrismaClient {
    if (!this.connected) {
      throw new Error('Database not connected. Call initialize() first.');
    }
    return this.prisma;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Transaction wrapper
  async transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(fn);
  }
}