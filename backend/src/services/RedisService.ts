import { createClient, RedisClientType } from 'redis';

export class RedisService {
  private client: RedisClientType;
  private connected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('🔄 Redis connecting...');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis connected and ready');
      this.connected = true;
    });

    this.client.on('end', () => {
      console.log('🔌 Redis connection ended');
      this.connected = false;
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Cache operations
  async set(key: string, value: string | number | object, ttl?: number): Promise<void> {
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    if (ttl) {
      await this.client.setEx(key, ttl, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse JSON from Redis:', error);
      return null;
    }
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return (await this.client.expire(key, seconds)) === 1;
  }

  // Session management
  async setSession(sessionId: string, userId: string, userData: object, ttl: number = 86400): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = {
      userId,
      ...userData,
      lastActivity: Date.now()
    };
    
    await this.set(sessionKey, sessionData, ttl);
  }

  async getSession(sessionId: string): Promise<any | null> {
    const sessionKey = `session:${sessionId}`;
    return await this.getJson(sessionKey);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    await this.del(sessionKey);
  }

  // Rate limiting
  async incrementCounter(key: string, ttl: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, ttl);
    const results = await multi.exec();
    return results[0] as number;
  }

  // Tournament cache
  async cacheTournamentData(tournamentId: string, data: object, ttl: number = 300): Promise<void> {
    const key = `tournament:${tournamentId}`;
    await this.set(key, data, ttl);
  }

  async getCachedTournamentData<T = any>(tournamentId: string): Promise<T | null> {
    const key = `tournament:${tournamentId}`;
    return await this.getJson<T>(key);
  }

  // Match results cache
  async cacheMatchResult(matchId: string, result: object): Promise<void> {
    const key = `match:${matchId}:result`;
    await this.set(key, result, 3600); // Cache for 1 hour
  }

  async getCachedMatchResult<T = any>(matchId: string): Promise<T | null> {
    const key = `match:${matchId}:result`;
    return await this.getJson<T>(key);
  }

  // Leaderboard operations
  async updateLeaderboard(leaderboardName: string, userId: string, score: number): Promise<void> {
    const key = `leaderboard:${leaderboardName}`;
    await this.client.zAdd(key, { score, value: userId });
  }

  async getLeaderboard(leaderboardName: string, limit: number = 10): Promise<Array<{userId: string, score: number}>> {
    const key = `leaderboard:${leaderboardName}`;
    const results = await this.client.zRangeWithScores(key, 0, limit - 1, { REV: true });
    
    return results.map(result => ({
      userId: result.value,
      score: result.score
    }));
  }

  // Lock mechanism for critical operations
  async acquireLock(lockKey: string, ttl: number = 30): Promise<boolean> {
    const key = `lock:${lockKey}`;
    const result = await this.client.set(key, '1', { EX: ttl, NX: true });
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    const key = `lock:${lockKey}`;
    await this.del(key);
  }

  // Pub/Sub for real-time features
  async publish(channel: string, message: object): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        console.error('Failed to parse pub/sub message:', error);
      }
    });
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch (error) {
      return false;
    }
  }
}