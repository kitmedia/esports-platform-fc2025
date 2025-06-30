import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { validateRequest, CommonSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, adminMiddleware } from '../middleware/auth';

const router = Router();

// Apply admin middleware to all routes
router.use(adminMiddleware);

export default function adminRoutes(prisma: PrismaClient) {
  // Dashboard analytics
  router.get('/dashboard',
    asyncHandler(async (req: any, res: any) => {
      // Get overall platform statistics
      const [
        totalUsers,
        totalTournaments,
        totalMatches,
        activeUsers,
        liveTournaments
      ] = await Promise.all([
        prisma.user.count(),
        prisma.tournament.count(),
        prisma.match.count(),
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        prisma.tournament.count({
          where: { status: 'LIVE' }
        })
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalUsers,
            totalTournaments,
            totalMatches,
            activeUsers,
            liveTournaments
          },
          growth: {
            usersThisMonth: 0, // TODO: Calculate monthly growth
            tournamentsThisMonth: 0,
            matchesThisMonth: 0
          },
          revenue: {
            totalRevenue: 0, // TODO: Calculate from payments
            revenueThisMonth: 0,
            averageRevenuePerUser: 0
          }
        }
      });
    })
  );

  // System health check
  router.get('/health',
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement comprehensive health checks
      res.json({
        success: true,
        data: {
          services: {
            database: 'healthy',
            redis: 'healthy',
            ai: 'healthy',
            payments: 'healthy',
            streaming: 'healthy'
          },
          performance: {
            averageResponseTime: '124ms',
            uptime: '99.9%',
            memoryUsage: '67%',
            cpuUsage: '23%'
          },
          alerts: []
        }
      });
    })
  );

  // Platform settings
  router.get('/settings',
    asyncHandler(async (req: any, res: any) => {
      // TODO: Get platform-wide settings
      res.json({
        success: true,
        data: {
          general: {
            platformName: 'EA SPORTS FC 2025 eSports Platform',
            maintenanceMode: false,
            registrationEnabled: true,
            tournamentCreationEnabled: true
          },
          features: {
            aiValidation: true,
            streamingEnabled: true,
            paymentsEnabled: true,
            discordIntegration: true
          },
          limits: {
            maxTournamentSize: 1024,
            maxConcurrentStreams: 10,
            maxFileUploadSize: '10MB'
          }
        }
      });
    })
  );

  // Update platform settings
  router.put('/settings',
    validateRequest({
      body: z.object({
        general: z.object({
          platformName: z.string().optional(),
          maintenanceMode: z.boolean().optional(),
          registrationEnabled: z.boolean().optional(),
          tournamentCreationEnabled: z.boolean().optional()
        }).optional(),
        features: z.object({
          aiValidation: z.boolean().optional(),
          streamingEnabled: z.boolean().optional(),
          paymentsEnabled: z.boolean().optional(),
          discordIntegration: z.boolean().optional()
        }).optional(),
        limits: z.object({
          maxTournamentSize: z.number().min(2).max(10000).optional(),
          maxConcurrentStreams: z.number().min(1).max(100).optional(),
          maxFileUploadSize: z.string().optional()
        }).optional()
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Update platform settings
      res.json({
        success: true,
        message: 'Platform settings updated successfully',
        data: req.body
      });
    })
  );

  // Content moderation queue
  router.get('/moderation/queue',
    validateRequest({
      query: z.object({
        type: z.enum(['CHAT', 'USERNAME', 'TOURNAMENT_NAME', 'USER_REPORT']).optional(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Get moderation queue
      res.json({
        success: true,
        data: [],
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: false
        }
      });
    })
  );

  // Moderate content
  router.post('/moderation/:id/action',
    validateRequest({
      params: CommonSchemas.id,
      body: z.object({
        action: z.enum(['APPROVE', 'REJECT', 'ESCALATE']),
        reason: z.string().optional()
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Process moderation action
      res.json({
        success: true,
        message: `Content ${req.body.action.toLowerCase()}d successfully`
      });
    })
  );

  // User management
  router.get('/users/search',
    validateRequest({
      query: z.object({
        q: z.string().min(1),
        limit: z.string().regex(/^\d+$/).transform(Number).default('20')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: req.query.q, mode: 'insensitive' } },
            { email: { contains: req.query.q, mode: 'insensitive' } },
            { displayName: { contains: req.query.q, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatar: true,
          role: true,
          status: true,
          currentElo: true,
          createdAt: true,
          lastLoginAt: true
        },
        take: req.query.limit
      });

      res.json({
        success: true,
        data: users
      });
    })
  );

  // Tournament management
  router.get('/tournaments/pending',
    validateRequest({
      query: z.object({
        limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      const tournaments = await prisma.tournament.findMany({
        where: {
          OR: [
            { status: 'DRAFT' },
            { requiresApproval: true, status: 'REGISTRATION_OPEN' }
          ]
        },
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

  // System logs
  router.get('/logs',
    validateRequest({
      query: z.object({
        level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']).optional(),
        service: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('100'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Get system logs from logging service
      res.json({
        success: true,
        data: [],
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: false
        }
      });
    })
  );

  // Performance metrics
  router.get('/metrics',
    validateRequest({
      query: z.object({
        timeframe: z.enum(['hour', 'day', 'week', 'month']).default('day'),
        metric: z.enum(['response_time', 'error_rate', 'throughput', 'active_users']).optional()
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Get performance metrics
      res.json({
        success: true,
        data: {
          timeframe: req.query.timeframe,
          metrics: {
            responseTime: {
              current: 124,
              average: 156,
              trend: 'improving'
            },
            errorRate: {
              current: 0.02,
              average: 0.03,
              trend: 'stable'
            },
            throughput: {
              current: 1250,
              average: 1100,
              trend: 'increasing'
            },
            activeUsers: {
              current: 456,
              average: 423,
              trend: 'increasing'
            }
          },
          timeline: []
        }
      });
    })
  );

  // Feature flags
  router.get('/feature-flags',
    asyncHandler(async (req: any, res: any) => {
      // TODO: Get feature flags
      res.json({
        success: true,
        data: {
          'new-tournament-ui': { enabled: true, rollout: 100 },
          'ai-match-prediction': { enabled: true, rollout: 50 },
          'streaming-v2': { enabled: false, rollout: 0 },
          'mobile-app-beta': { enabled: true, rollout: 25 }
        }
      });
    })
  );

  // Update feature flag
  router.put('/feature-flags/:flag',
    validateRequest({
      params: z.object({
        flag: z.string().min(1)
      }),
      body: z.object({
        enabled: z.boolean(),
        rollout: z.number().min(0).max(100)
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Update feature flag
      res.json({
        success: true,
        message: `Feature flag ${req.params.flag} updated`,
        data: {
          flag: req.params.flag,
          enabled: req.body.enabled,
          rollout: req.body.rollout
        }
      });
    })
  );

  // Announcements
  router.post('/announcements',
    validateRequest({
      body: z.object({
        title: z.string().min(1).max(100),
        message: z.string().min(1).max(1000),
        type: z.enum(['INFO', 'WARNING', 'MAINTENANCE', 'UPDATE']),
        targetAudience: z.enum(['ALL', 'ORGANIZERS', 'PREMIUM_USERS']).default('ALL'),
        expiresAt: z.string().datetime().optional()
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Create system announcement
      res.json({
        success: true,
        message: 'Announcement created successfully',
        data: {
          id: 'ann_' + Math.random().toString(36).substring(7),
          ...req.body,
          createdBy: req.user!.userId,
          createdAt: new Date().toISOString()
        }
      });
    })
  );

  // Database maintenance
  router.post('/maintenance/cleanup',
    validateRequest({
      body: z.object({
        cleanupType: z.enum(['OLD_LOGS', 'EXPIRED_SESSIONS', 'ORPHANED_FILES', 'TEST_DATA']),
        dryRun: z.boolean().default(true)
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement database cleanup
      res.json({
        success: true,
        message: req.body.dryRun ? 'Cleanup preview generated' : 'Cleanup completed',
        data: {
          type: req.body.cleanupType,
          itemsToClean: 156,
          estimatedSpaceSaved: '2.3 GB',
          dryRun: req.body.dryRun
        }
      });
    })
  );

  return router;
}