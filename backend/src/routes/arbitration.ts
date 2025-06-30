import { Router } from 'express';
import { z } from 'zod';
import { ArbitrationService } from '../services/ArbitrationService';
import { validateRequest, CommonSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, adminMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const VoteSchema = z.object({
  decision: z.enum(['ACCEPT_RESULT', 'REJECT_RESULT', 'REQUIRE_REMATCH']),
  reasoning: z.string().min(10).max(1000),
  confidence: z.number().min(1).max(10)
});

const DisputeFiltersSchema = z.object({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED']).optional(),
  category: z.enum(['RESULT_DISPUTE', 'CONDUCT_VIOLATION', 'TECHNICAL_ISSUE', 'CHEATING_ALLEGATION']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
});

export default function arbitrationRoutes(arbitrationService: ArbitrationService) {
  // Get arbitration service status
  router.get('/status',
    asyncHandler(async (req: any, res: any) => {
      res.json({
        success: true,
        data: {
          available: true,
          features: {
            decentralizedVoting: true,
            aiAnalysis: true,
            escalationSystem: true,
            consensusAlgorithm: true
          },
          activeArbiters: 25,
          averageResolutionTime: '2.5 hours',
          consensusThreshold: 0.7
        }
      });
    })
  );

  // Get disputes (with filters)
  router.get('/disputes',
    validateRequest({ query: DisputeFiltersSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const disputes = await arbitrationService.getDisputes({
        status: req.query.status,
        category: req.query.category,
        priority: req.query.priority,
        limit: req.query.limit,
        offset: req.query.offset
      });

      res.json({
        success: true,
        data: disputes,
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: disputes.length === req.query.limit
        }
      });
    })
  );

  // Get single dispute
  router.get('/disputes/:id',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const dispute = await arbitrationService.getDispute(req.params.id);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          message: 'Dispute not found'
        });
      }

      res.json({
        success: true,
        data: dispute
      });
    })
  );

  // Submit dispute (this would be called from matches route, but including for completeness)
  router.post('/disputes',
    validateRequest({
      body: z.object({
        matchId: z.string().uuid(),
        category: z.enum(['RESULT_DISPUTE', 'CONDUCT_VIOLATION', 'TECHNICAL_ISSUE', 'CHEATING_ALLEGATION']),
        description: z.string().min(20).max(2000),
        evidence: z.array(z.string()).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM')
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const dispute = await arbitrationService.submitDispute({
        ...req.body,
        reporterId: req.user!.userId
      });

      res.status(201).json({
        success: true,
        message: 'Dispute submitted successfully',
        data: dispute
      });
    })
  );

  // Vote on dispute (for arbiters)
  router.post('/disputes/:id/vote',
    validateRequest({ 
      params: CommonSchemas.id,
      body: VoteSchema 
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Check if user is qualified arbiter
      
      const vote = await arbitrationService.voteOnDispute(
        req.params.id,
        {
          ...req.body,
          arbiterId: req.user!.userId
        }
      );

      res.json({
        success: true,
        message: 'Vote submitted successfully',
        data: vote
      });
    })
  );

  // Get dispute votes
  router.get('/disputes/:id/votes',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const votes = await arbitrationService.getDisputeVotes(req.params.id);

      res.json({
        success: true,
        data: votes
      });
    })
  );

  // Calculate consensus (admin or automated)
  router.post('/disputes/:id/calculate-consensus',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const consensus = await arbitrationService.calculateConsensus(req.params.id);

      res.json({
        success: true,
        message: 'Consensus calculated',
        data: consensus
      });
    })
  );

  // Get arbitration statistics
  router.get('/stats',
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement arbitration statistics
      res.json({
        success: true,
        data: {
          totalDisputes: 156,
          resolvedDisputes: 142,
          averageResolutionTime: '2.5 hours',
          consensusRate: 0.91,
          topArbiters: [
            { id: '1', username: 'arbiter1', totalVotes: 45, accuracy: 0.94 },
            { id: '2', username: 'arbiter2', totalVotes: 38, accuracy: 0.92 }
          ],
          resolutionsByCategory: {
            'RESULT_DISPUTE': 89,
            'CONDUCT_VIOLATION': 34,
            'TECHNICAL_ISSUE': 23,
            'CHEATING_ALLEGATION': 10
          }
        }
      });
    })
  );

  // Get my arbitration activity
  router.get('/my-activity',
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Get user's arbitration activity
      res.json({
        success: true,
        data: {
          totalVotes: 23,
          accuracy: 0.91,
          reputation: 4.7,
          votesThisMonth: 8,
          pendingDisputes: 3,
          recentVotes: []
        }
      });
    })
  );

  // Apply to become arbiter
  router.post('/apply-arbiter',
    validateRequest({
      body: z.object({
        experience: z.string().min(50).max(1000),
        motivation: z.string().min(50).max(1000),
        availability: z.enum(['PART_TIME', 'REGULAR', 'FULL_TIME']),
        languages: z.array(z.string()).min(1)
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement arbiter application
      res.json({
        success: true,
        message: 'Arbiter application submitted successfully',
        data: {
          applicationId: 'app_' + Math.random().toString(36).substring(7),
          status: 'under_review',
          estimatedReviewTime: '3-5 business days'
        }
      });
    })
  );

  // Admin routes

  // Get all disputes (admin)
  router.get('/admin/disputes',
    adminMiddleware,
    validateRequest({ query: DisputeFiltersSchema }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement admin dispute view with more details
      res.json({
        success: true,
        data: [],
        message: 'Admin disputes endpoint - to be implemented'
      });
    })
  );

  // Escalate dispute (admin)
  router.post('/admin/disputes/:id/escalate',
    adminMiddleware,
    validateRequest({ 
      params: CommonSchemas.id,
      body: z.object({
        reason: z.string().min(10).max(500),
        assignToAdmin: z.string().uuid().optional()
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement dispute escalation
      res.json({
        success: true,
        message: 'Dispute escalated successfully'
      });
    })
  );

  // Override dispute resolution (admin)
  router.post('/admin/disputes/:id/override',
    adminMiddleware,
    validateRequest({ 
      params: CommonSchemas.id,
      body: z.object({
        decision: z.enum(['ACCEPT_RESULT', 'REJECT_RESULT', 'REQUIRE_REMATCH']),
        reasoning: z.string().min(20).max(1000)
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement admin override
      res.json({
        success: true,
        message: 'Dispute resolution overridden by admin'
      });
    })
  );

  // Manage arbiters (admin)
  router.get('/admin/arbiters',
    adminMiddleware,
    validateRequest({
      query: z.object({
        status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement arbiter management
      res.json({
        success: true,
        data: [],
        message: 'Arbiter management endpoint - to be implemented'
      });
    })
  );

  // Update arbiter status (admin)
  router.patch('/admin/arbiters/:id/status',
    adminMiddleware,
    validateRequest({ 
      params: CommonSchemas.id,
      body: z.object({
        status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']),
        reason: z.string().optional()
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement arbiter status update
      res.json({
        success: true,
        message: `Arbiter status updated to ${req.body.status}`
      });
    })
  );

  return router;
}