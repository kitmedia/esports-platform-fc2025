import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AIService } from '../services/AIService';
import { validateRequest, CommonSchemas, validateImageUpload } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Validation schemas
const SubmitResultSchema = z.object({
  player1Score: z.number().min(0).max(50),
  player2Score: z.number().min(0).max(50),
  additionalData: z.object({
    matchDuration: z.number().optional(),
    screenshots: z.array(z.string()).optional(),
    notes: z.string().max(500).optional()
  }).optional()
});

const ReportDisputeSchema = z.object({
  reason: z.enum(['INCORRECT_RESULT', 'CONNECTION_ISSUE', 'CHEATING', 'NO_SHOW', 'OTHER']),
  description: z.string().min(10).max(1000),
  evidence: z.array(z.string()).optional()
});

const MatchFiltersSchema = z.object({
  tournamentId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'READY', 'LIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED']).optional(),
  userId: z.string().uuid().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
});

export default function matchRoutes(prisma: PrismaClient, aiService: AIService) {
  // Get matches with filters
  router.get('/',
    validateRequest({ query: MatchFiltersSchema }),
    asyncHandler(async (req: any, res: any) => {
      const where: any = {};
      
      if (req.query.tournamentId) {
        where.tournamentId = req.query.tournamentId;
      }
      
      if (req.query.status) {
        where.status = req.query.status;
      }
      
      if (req.query.userId) {
        where.participants = {
          some: {
            userId: req.query.userId
          }
        };
      }

      const matches = await prisma.match.findMany({
        where,
        include: {
          tournament: {
            select: { id: true, name: true, format: true }
          },
          participants: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatar: true, currentElo: true }
              },
              team: {
                select: { id: true, name: true, tag: true, avatar: true }
              }
            }
          },
          results: {
            where: { status: 'VALIDATED' },
            orderBy: { createdAt: 'desc' },
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

  // Get single match
  router.get('/:id',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const match = await prisma.match.findUnique({
        where: { id: req.params.id },
        include: {
          tournament: true,
          participants: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatar: true, currentElo: true }
              },
              team: {
                select: { id: true, name: true, tag: true, avatar: true }
              }
            }
          },
          results: {
            include: {
              submittedBy: {
                select: { id: true, username: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          disputes: {
            include: {
              reporter: {
                select: { id: true, username: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found'
        });
      }

      res.json({
        success: true,
        data: match
      });
    })
  );

  // Submit match result
  router.post('/:id/result',
    validateRequest({ 
      params: CommonSchemas.id,
      body: SubmitResultSchema 
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const match = await prisma.match.findUnique({
        where: { id: req.params.id },
        include: {
          participants: true,
          tournament: true
        }
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found'
        });
      }

      // Verify user is a participant
      const isParticipant = match.participants.some(p => p.userId === req.user!.userId);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Only match participants can submit results'
        });
      }

      // Check if match is in correct status
      if (match.status !== 'LIVE' && match.status !== 'READY') {
        return res.status(400).json({
          success: false,
          message: 'Match is not in a state where results can be submitted'
        });
      }

      // Create match result
      const result = await prisma.matchResult.create({
        data: {
          matchId: req.params.id,
          submittedById: req.user!.userId,
          player1Score: req.body.player1Score,
          player2Score: req.body.player2Score,
          status: 'PENDING',
          additionalData: req.body.additionalData || {}
        }
      });

      // Update match status
      await prisma.match.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED' }
      });

      res.json({
        success: true,
        message: 'Match result submitted successfully',
        data: result
      });
    })
  );

  // Submit result with screenshot (AI validation)
  router.post('/:id/result/screenshot',
    upload.single('screenshot'),
    validateImageUpload,
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const match = await prisma.match.findUnique({
        where: { id: req.params.id },
        include: { participants: true }
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found'
        });
      }

      // Verify user is a participant
      const isParticipant = match.participants.some(p => p.userId === req.user!.userId);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Only match participants can submit results'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Screenshot is required'
        });
      }

      try {
        // Use AI service to validate the screenshot
        const aiResult = await aiService.validateMatchResult(req.file.buffer, req.file.mimetype);

        // Create match result with AI validation
        const result = await prisma.matchResult.create({
          data: {
            matchId: req.params.id,
            submittedById: req.user!.userId,
            player1Score: aiResult.player1Score,
            player2Score: aiResult.player2Score,
            status: aiResult.confidence > 0.8 ? 'VALIDATED' : 'PENDING',
            screenshotUrl: `screenshot_${Date.now()}.png`, // TODO: Upload to cloud storage
            aiValidation: {
              confidence: aiResult.confidence,
              anomalies: aiResult.anomalies,
              ocrText: aiResult.ocrText
            }
          }
        });

        // Update match status
        await prisma.match.update({
          where: { id: req.params.id },
          data: { 
            status: aiResult.confidence > 0.8 ? 'COMPLETED' : 'PENDING'
          }
        });

        res.json({
          success: true,
          message: aiResult.confidence > 0.8 
            ? 'Match result validated automatically' 
            : 'Match result submitted for manual review',
          data: {
            result,
            aiValidation: {
              confidence: aiResult.confidence,
              anomalies: aiResult.anomalies,
              autoValidated: aiResult.confidence > 0.8
            }
          }
        });

      } catch (error) {
        console.error('AI validation error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to process screenshot. Please try again or submit manually.'
        });
      }
    })
  );

  // Validate/reject a result (for admins/organizers)
  router.patch('/:id/result/:resultId/validate',
    validateRequest({ 
      params: z.object({
        id: z.string().uuid(),
        resultId: z.string().uuid()
      }),
      body: z.object({
        action: z.enum(['VALIDATE', 'REJECT']),
        reason: z.string().optional()
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Check if user has permission to validate results
      
      const result = await prisma.matchResult.update({
        where: { id: req.params.resultId },
        data: {
          status: req.body.action === 'VALIDATE' ? 'VALIDATED' : 'REJECTED',
          validatedById: req.user!.userId,
          validatedAt: new Date(),
          validationReason: req.body.reason
        }
      });

      if (req.body.action === 'VALIDATE') {
        // Update match status to completed
        await prisma.match.update({
          where: { id: req.params.id },
          data: { status: 'COMPLETED' }
        });
      }

      res.json({
        success: true,
        message: `Result ${req.body.action.toLowerCase()}d successfully`,
        data: result
      });
    })
  );

  // Report dispute
  router.post('/:id/dispute',
    validateRequest({ 
      params: CommonSchemas.id,
      body: ReportDisputeSchema 
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const match = await prisma.match.findUnique({
        where: { id: req.params.id },
        include: { participants: true }
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found'
        });
      }

      // Verify user is a participant
      const isParticipant = match.participants.some(p => p.userId === req.user!.userId);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Only match participants can report disputes'
        });
      }

      // Check if dispute already exists
      const existingDispute = await prisma.dispute.findFirst({
        where: {
          matchId: req.params.id,
          status: { in: ['OPEN', 'UNDER_REVIEW'] }
        }
      });

      if (existingDispute) {
        return res.status(400).json({
          success: false,
          message: 'A dispute is already active for this match'
        });
      }

      const dispute = await prisma.dispute.create({
        data: {
          matchId: req.params.id,
          reporterId: req.user!.userId,
          reason: req.body.reason,
          description: req.body.description,
          evidence: req.body.evidence || [],
          status: 'OPEN'
        }
      });

      // Update match status to disputed
      await prisma.match.update({
        where: { id: req.params.id },
        data: { status: 'DISPUTED' }
      });

      res.json({
        success: true,
        message: 'Dispute reported successfully',
        data: dispute
      });
    })
  );

  // Get match disputes
  router.get('/:id/disputes',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const disputes = await prisma.dispute.findMany({
        where: { matchId: req.params.id },
        include: {
          reporter: {
            select: { id: true, username: true, displayName: true }
          },
          votes: {
            include: {
              arbiter: {
                select: { id: true, username: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: disputes
      });
    })
  );

  // Start match (for live matches)
  router.post('/:id/start',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const match = await prisma.match.findUnique({
        where: { id: req.params.id },
        include: { participants: true }
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found'
        });
      }

      // Verify user is a participant
      const isParticipant = match.participants.some(p => p.userId === req.user!.userId);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Only match participants can start the match'
        });
      }

      if (match.status !== 'READY') {
        return res.status(400).json({
          success: false,
          message: 'Match is not ready to start'
        });
      }

      const updatedMatch = await prisma.match.update({
        where: { id: req.params.id },
        data: {
          status: 'LIVE',
          startedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Match started successfully',
        data: updatedMatch
      });
    })
  );

  return router;
}