import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { RedisService } from './RedisService';
import { z } from 'zod';

// Validation schemas
const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional(),
  platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional()
});

const LoginSchema = z.object({
  identifier: z.string(), // email or username
  password: z.string()
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128)
});

interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface AuthResult {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    avatar: string | null;
    role: string;
    currentElo: number;
    isVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly SALT_ROUNDS = 12;

  constructor(
    private prisma: PrismaClient,
    private redis: RedisService
  ) {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
    
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.warn('⚠️ JWT secrets not set in environment variables');
    }
  }

  // ===== REGISTRATION =====

  async register(data: z.infer<typeof RegisterSchema>): Promise<AuthResult> {
    const validatedData = RegisterSchema.parse(data);

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === validatedData.email) {
        throw new Error('Email already registered');
      }
      if (existingUser.username === validatedData.username) {
        throw new Error('Username already taken');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, this.SALT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username: validatedData.username,
        email: validatedData.email,
        password: hashedPassword,
        displayName: validatedData.displayName || validatedData.username,
        platform: validatedData.platform || 'PC',
        role: 'USER',
        currentElo: 1200, // Starting ELO
        isVerified: false
      }
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        currentElo: user.currentElo,
        isVerified: user.isVerified
      },
      accessToken,
      refreshToken
    };
  }

  // ===== LOGIN =====

  async login(data: z.infer<typeof LoginSchema>): Promise<AuthResult> {
    const validatedData = LoginSchema.parse(data);

    // Find user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.identifier },
          { username: validatedData.identifier }
        ]
      }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if user is banned
    if (user.status === 'BANNED') {
      throw new Error('Account is banned');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        currentElo: user.currentElo,
        isVerified: user.isVerified
      },
      accessToken,
      refreshToken
    };
  }

  // ===== TOKEN MANAGEMENT =====

  private async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, { 
      expiresIn: this.ACCESS_TOKEN_EXPIRY 
    });

    const refreshToken = jwt.sign(payload, this.JWT_REFRESH_SECRET, { 
      expiresIn: this.REFRESH_TOKEN_EXPIRY 
    });

    // Store refresh token in Redis
    await this.redis.set(
      `refresh_token:${user.id}`,
      refreshToken,
      7 * 24 * 60 * 60 // 7 days
    );

    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as TokenPayload;
      
      // Check if refresh token exists in Redis
      const storedToken = await this.redis.get(`refresh_token:${decoded.userId}`);
      if (storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get current user data
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || user.status === 'BANNED') {
        throw new Error('User not found or banned');
      }

      // Generate new tokens
      return await this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.redis.del(`refresh_token:${userId}`);
  }

  // ===== TOKEN VERIFICATION =====

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      
      // Additional validation - check if user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, status: true }
      });

      if (!user || user.status === 'BANNED') {
        throw new Error('User not found or banned');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  // ===== PASSWORD MANAGEMENT =====

  async changePassword(userId: string, data: z.infer<typeof ChangePasswordSchema>): Promise<void> {
    const validatedData = ChangePasswordSchema.parse(data);

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(validatedData.currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, this.SALT_ROUNDS);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Revoke all refresh tokens for security
    await this.revokeRefreshToken(userId);
  }

  async resetPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Don't reveal if email exists for security
      return;
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email },
      this.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in Redis
    await this.redis.set(
      `reset_token:${user.id}`,
      resetToken,
      3600 // 1 hour
    );

    // TODO: Send email with reset link
    console.log(`Password reset token for ${email}: ${resetToken}`);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      
      // Check if reset token exists in Redis
      const storedToken = await this.redis.get(`reset_token:${decoded.userId}`);
      if (storedToken !== token) {
        throw new Error('Invalid reset token');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update password
      await this.prisma.user.update({
        where: { id: decoded.userId },
        data: { password: hashedPassword }
      });

      // Clean up reset token
      await this.redis.del(`reset_token:${decoded.userId}`);
      
      // Revoke all refresh tokens
      await this.revokeRefreshToken(decoded.userId);
    } catch (error) {
      throw new Error('Invalid or expired reset token');
    }
  }

  // ===== OAUTH PROVIDERS =====

  async handleDiscordOAuth(discordData: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  }): Promise<AuthResult> {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { discordId: discordData.id },
          { email: discordData.email }
        ]
      }
    });

    if (!user) {
      // Create new user from Discord data
      user = await this.prisma.user.create({
        data: {
          username: discordData.username,
          email: discordData.email,
          discordId: discordData.id,
          displayName: discordData.username,
          avatar: discordData.avatar,
          isVerified: true, // Discord accounts are considered verified
          role: 'USER',
          currentElo: 1200
        }
      });
    } else if (!user.discordId) {
      // Link existing account with Discord
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { 
          discordId: discordData.id,
          isVerified: true
        }
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        currentElo: user.currentElo,
        isVerified: user.isVerified
      },
      accessToken,
      refreshToken
    };
  }

  // ===== USER MANAGEMENT =====

  async getUserById(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatar: true,
        role: true,
        currentElo: true,
        isVerified: true,
        platform: true,
        createdAt: true,
        lastLoginAt: true
      }
    });
  }

  async updateUserProfile(userId: string, data: {
    displayName?: string;
    avatar?: string;
    platform?: string;
  }) {
    return await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatar: true,
        role: true,
        currentElo: true,
        isVerified: true,
        platform: true
      }
    });
  }

  // ===== RATE LIMITING =====

  async checkRateLimit(identifier: string, action: string, limit: number, window: number): Promise<boolean> {
    const key = `rate_limit:${action}:${identifier}`;
    const current = await this.redis.incrementCounter(key, window);
    return current <= limit;
  }

  // ===== LOGOUT =====

  async logout(userId: string): Promise<void> {
    await this.revokeRefreshToken(userId);
  }
}