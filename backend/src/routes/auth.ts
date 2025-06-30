import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService';
import { validateRequest, CommonSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { rateLimitMiddleware, authMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().min(1).max(50).optional(),
  platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional()
});

const LoginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required')
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128)
});

const ResetPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

const ConfirmResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128)
});

export default function authRoutes(authService: AuthService) {
  // Register
  router.post('/register',
    rateLimitMiddleware(authService, 'register', 5, 900), // 5 attempts per 15 minutes
    validateRequest({ body: RegisterSchema }),
    asyncHandler(async (req: any, res: any) => {
      const result = await authService.register(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result
      });
    })
  );

  // Login
  router.post('/login',
    rateLimitMiddleware(authService, 'login', 10, 900), // 10 attempts per 15 minutes
    validateRequest({ body: LoginSchema }),
    asyncHandler(async (req: any, res: any) => {
      const result = await authService.login(req.body);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    })
  );

  // Refresh token
  router.post('/refresh',
    rateLimitMiddleware(authService, 'refresh', 20, 900), // 20 attempts per 15 minutes
    validateRequest({ body: RefreshTokenSchema }),
    asyncHandler(async (req: any, res: any) => {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    })
  );

  // Logout
  router.post('/logout',
    authMiddleware(authService),
    asyncHandler(async (req: any, res: any) => {
      await authService.logout(req.user.userId);
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
    })
  );

  // Change password
  router.post('/change-password',
    authMiddleware(authService),
    rateLimitMiddleware(authService, 'change-password', 5, 3600), // 5 attempts per hour
    validateRequest({ body: ChangePasswordSchema }),
    asyncHandler(async (req: any, res: any) => {
      await authService.changePassword(req.user.userId, req.body);
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    })
  );

  // Request password reset
  router.post('/reset-password',
    rateLimitMiddleware(authService, 'reset-password', 3, 3600), // 3 attempts per hour
    validateRequest({ body: ResetPasswordSchema }),
    asyncHandler(async (req: any, res: any) => {
      await authService.resetPassword(req.body.email);
      
      res.json({
        success: true,
        message: 'Password reset email sent (if account exists)'
      });
    })
  );

  // Confirm password reset
  router.post('/reset-password/confirm',
    rateLimitMiddleware(authService, 'confirm-reset', 5, 3600), // 5 attempts per hour
    validateRequest({ body: ConfirmResetSchema }),
    asyncHandler(async (req: any, res: any) => {
      await authService.confirmPasswordReset(req.body.token, req.body.newPassword);
      
      res.json({
        success: true,
        message: 'Password reset successful'
      });
    })
  );

  // Get current user
  router.get('/me',
    authMiddleware(authService),
    asyncHandler(async (req: any, res: any) => {
      const user = await authService.getUserById(req.user.userId);
      
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
    })
  );

  // Update profile
  router.put('/profile',
    authMiddleware(authService),
    validateRequest({
      body: z.object({
        displayName: z.string().min(1).max(50).optional(),
        avatar: z.string().url().optional(),
        platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional()
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      const updatedUser = await authService.updateUserProfile(req.user.userId, req.body);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    })
  );

  // Discord OAuth callback (placeholder)
  router.post('/oauth/discord',
    validateRequest({
      body: z.object({
        code: z.string().min(1, 'Discord authorization code is required'),
        state: z.string().optional()
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement Discord OAuth flow
      // This would exchange the code for user data and create/login user
      
      const mockDiscordData = {
        id: '123456789',
        username: 'discorduser',
        email: 'user@example.com',
        avatar: 'https://cdn.discordapp.com/avatars/123/abc.png'
      };
      
      const result = await authService.handleDiscordOAuth(mockDiscordData);
      
      res.json({
        success: true,
        message: 'Discord login successful',
        data: result
      });
    })
  );

  // Verify token (for external services)
  router.post('/verify',
    validateRequest({
      body: z.object({
        token: z.string().min(1, 'Token is required')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      try {
        const decoded = await authService.verifyAccessToken(req.body.token);
        
        res.json({
          success: true,
          data: {
            valid: true,
            user: decoded
          }
        });
      } catch (error) {
        res.json({
          success: true,
          data: {
            valid: false,
            error: 'Invalid token'
          }
        });
      }
    })
  );

  return router;
}