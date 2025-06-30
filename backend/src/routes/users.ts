import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { validateRequest, CommonSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, adminMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatar: z.string().url().optional(),
  platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional(),
  country: z.string().length(2).optional(),
  bio: z.string().max(500).optional()
});

const UserFiltersSchema = z.object({
  search: z.string().optional(),
  platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional(),
  role: z.enum(['USER', 'ORGANIZER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
});

export default function userRoutes(prisma: PrismaClient) {
  // Get users (public endpoint with limited data)
  router.get('/',
    validateRequest({ query: UserFiltersSchema }),
    asyncHandler(async (req: any, res: any) => {
      const where: any = {};
      
      if (req.query.search) {
        where.OR = [
          { username: { contains: req.query.search, mode: 'insensitive' } },
          { displayName: { contains: req.query.search, mode: 'insensitive' } }
        ];
      }
      
      if (req.query.platform) {
        where.platform = req.query.platform;
      }
      
      // Only show active users in public listing
      where.status = 'ACTIVE';

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          platform: true,
          currentElo: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              tournaments: true,
              tournamentParticipations: true
            }
          }
        },
        orderBy: { currentElo: 'desc' },
        take: req.query.limit,
        skip: req.query.offset
      });

      res.json({
        success: true,
        data: users,
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: users.length === req.query.limit
        }
      });
    })
  );

  // Get single user profile
  router.get('/:id',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          platform: true,
          currentElo: true,
          isVerified: true,
          country: true,
          bio: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              tournaments: true,
              tournamentParticipations: true
            }
          }
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
    })
  );

  // Update user profile (own profile)
  router.put('/profile',
    validateRequest({ body: UpdateProfileSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const updatedUser = await prisma.user.update({
        where: { id: req.user!.userId },
        data: req.body,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatar: true,
          platform: true,
          currentElo: true,
          isVerified: true,
          country: true,
          bio: true
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    })
  );

  // Get user statistics
  router.get('/:id/stats',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const userId = req.params.id;

      // Get tournament participations
      const participations = await prisma.tournamentParticipant.findMany({
        where: { userId },
        include: {
          tournament: {
            select: { id: true, name: true, format: true, status: true }
          }
        }
      });

      // Get match results
      const matches = await prisma.match.findMany({
        where: {
          participants: {
            some: { userId }
          }
        },
        include: {
          results: {
            where: { status: 'VALIDATED' }
          },
          participants: {
            include: {
              user: { select: { id: true, username: true } }
            }
          }
        }
      });

      // Calculate statistics
      const totalTournaments = participations.length;
      const completedTournaments = participations.filter(p => p.tournament.status === 'COMPLETED').length;
      const totalMatches = matches.length;
      const wonMatches = matches.filter(match => {
        const result = match.results[0];
        if (!result) return false;
        
        const userParticipant = match.participants.find(p => p.userId === userId);
        if (!userParticipant) return false;
        
        const isPlayer1 = userParticipant.side === 1;
        return isPlayer1 
          ? result.player1Score > result.player2Score
          : result.player2Score > result.player1Score;
      }).length;

      const winRate = totalMatches > 0 ? wonMatches / totalMatches : 0;

      // Get recent match history
      const recentMatches = matches
        .slice(-10)
        .map(match => {
          const result = match.results[0];
          const opponent = match.participants.find(p => p.userId !== userId);
          return {
            id: match.id,
            opponent: opponent?.user?.username || 'Unknown',
            result: result ? `${result.player1Score}-${result.player2Score}` : 'Pending',
            date: match.completedAt || match.scheduledAt
          };
        });

      res.json({
        success: true,
        data: {
          tournaments: {
            total: totalTournaments,
            completed: completedTournaments,
            active: totalTournaments - completedTournaments
          },
          matches: {
            total: totalMatches,
            won: wonMatches,
            lost: totalMatches - wonMatches,
            winRate: Math.round(winRate * 100)
          },
          recentMatches
        }
      });
    })
  );

  // Get user tournaments
  router.get('/:id/tournaments',
    validateRequest({ 
      params: CommonSchemas.id,
      query: z.object({
        status: z.enum(['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CHECK_IN', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      const where: any = {
        participants: {
          some: { userId: req.params.id }
        }
      };

      if (req.query.status) {
        where.status = req.query.status;
      }

      const tournaments = await prisma.tournament.findMany({
        where,
        include: {
          organizer: {
            select: { id: true, username: true, displayName: true }
          },
          _count: {
            select: { participants: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: req.query.limit,
        skip: req.query.offset
      });

      res.json({
        success: true,
        data: tournaments,
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: tournaments.length === req.query.limit
        }
      });
    })
  );

  // Get user matches
  router.get('/:id/matches',
    validateRequest({ 
      params: CommonSchemas.id,
      query: z.object({
        status: z.enum(['PENDING', 'READY', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      const where: any = {
        participants: {
          some: { userId: req.params.id }
        }
      };

      if (req.query.status) {
        where.status = req.query.status;
      }

      const matches = await prisma.match.findMany({
        where,
        include: {
          tournament: {
            select: { id: true, name: true }
          },
          participants: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatar: true }
              }
            }
          },
          results: {
            where: { status: 'VALIDATED' },
            take: 1
          }
        },
        orderBy: { scheduledAt: 'desc' },
        take: req.query.limit,
        skip: req.query.offset
      });

      res.json({
        success: true,
        data: matches,
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: matches.length === req.query.limit
        }
      });
    })
  );

  // Get leaderboard
  router.get('/leaderboard',
    validateRequest({
      query: z.object({
        platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('50')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      const where: any = {
        status: 'ACTIVE'
      };

      if (req.query.platform) {
        where.platform = req.query.platform;
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          platform: true,
          currentElo: true,
          isVerified: true,
          country: true,
          _count: {
            select: {
              tournamentParticipations: true
            }
          }
        },
        orderBy: { currentElo: 'desc' },
        take: req.query.limit
      });

      res.json({
        success: true,
        data: users.map((user, index) => ({
          ...user,
          rank: index + 1
        }))
      });
    })
  );

  // Admin routes
  
  // Get all users (admin only)
  router.get('/admin/all',
    adminMiddleware,
    validateRequest({ query: UserFiltersSchema }),
    asyncHandler(async (req: any, res: any) => {
      const where: any = {};
      
      if (req.query.search) {
        where.OR = [
          { username: { contains: req.query.search, mode: 'insensitive' } },
          { displayName: { contains: req.query.search, mode: 'insensitive' } },
          { email: { contains: req.query.search, mode: 'insensitive' } }
        ];
      }
      
      if (req.query.platform) {
        where.platform = req.query.platform;
      }
      
      if (req.query.role) {
        where.role = req.query.role;
      }
      
      if (req.query.status) {
        where.status = req.query.status;
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatar: true,
          platform: true,
          role: true,
          status: true,
          currentElo: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: req.query.limit,
        skip: req.query.offset
      });

      res.json({
        success: true,
        data: users,
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: users.length === req.query.limit
        }
      });
    })
  );

  // Update user status (admin only)
  router.patch('/:id/status',
    adminMiddleware,
    validateRequest({ 
      params: CommonSchemas.id,
      body: z.object({
        status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
        reason: z.string().optional()
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const updatedUser = await prisma.user.update({
        where: { id: req.params.id },
        data: { 
          status: req.body.status,
          // TODO: Log the status change with reason
        },
        select: {
          id: true,
          username: true,
          status: true
        }
      });

      res.json({
        success: true,
        message: `User status updated to ${req.body.status}`,
        data: updatedUser
      });
    })
  );

  return router;
}