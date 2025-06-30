import { Router } from 'express';
import { z } from 'zod';
import { TournamentService } from '../services/TournamentService';
import { validateRequest, CommonSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, organizerMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const CreateTournamentSchema = z.object({
  name: z.string().min(3, 'Tournament name must be at least 3 characters').max(100),
  description: z.string().max(2000).optional(),
  format: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS', 'LEAGUE', 'CUSTOM']),
  gameMode: z.enum(['ULTIMATE_TEAM', 'KICK_OFF', 'CAREER_MODE', 'VOLTA_FOOTBALL', 'PRO_CLUBS']),
  maxParticipants: z.number().min(2).max(1024),
  minParticipants: z.number().min(2),
  teamSize: z.number().min(1).max(11).default(1),
  isTeamTournament: z.boolean().default(false),
  registrationStart: z.string().datetime(),
  registrationEnd: z.string().datetime(),
  tournamentStart: z.string().datetime(),
  entryFee: z.number().min(0).default(0),
  prizePool: z.number().min(0).default(0),
  isPublic: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  rules: z.array(z.string()).optional(),
  streamingEnabled: z.boolean().default(false),
  discordIntegration: z.boolean().default(false)
});

const UpdateTournamentSchema = CreateTournamentSchema.partial();

const RegisterSchema = z.object({
  teamId: z.string().uuid().optional()
});

const GenerateBracketsSchema = z.object({
  seedingMethod: z.enum(['random', 'elo', 'manual']).default('elo'),
  groupSize: z.number().min(2).max(8).optional()
});

const TournamentFiltersSchema = z.object({
  status: z.enum(['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CHECK_IN', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
  format: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS', 'LEAGUE', 'CUSTOM']).optional(),
  gameMode: z.enum(['ULTIMATE_TEAM', 'KICK_OFF', 'CAREER_MODE', 'VOLTA_FOOTBALL', 'PRO_CLUBS']).optional(),
  isPublic: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
});

export default function tournamentRoutes(tournamentService: TournamentService) {
  // Get tournaments with filters
  router.get('/',
    validateRequest({ query: TournamentFiltersSchema }),
    asyncHandler(async (req: any, res: any) => {
      const tournaments = await tournamentService.getTournaments(req.query);
      
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

  // Get single tournament
  router.get('/:id',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const tournament = await tournamentService.getTournament(req.params.id);
      
      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
      }
      
      res.json({
        success: true,
        data: tournament
      });
    })
  );

  // Create tournament
  router.post('/',
    organizerMiddleware,
    validateRequest({ body: CreateTournamentSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const tournament = await tournamentService.createTournament(req.body, req.user!.userId);
      
      res.status(201).json({
        success: true,
        message: 'Tournament created successfully',
        data: tournament
      });
    })
  );

  // Update tournament
  router.put('/:id',
    validateRequest({ 
      params: CommonSchemas.id,
      body: UpdateTournamentSchema 
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const tournament = await tournamentService.updateTournament(
        req.params.id, 
        req.body, 
        req.user!.userId
      );
      
      res.json({
        success: true,
        message: 'Tournament updated successfully',
        data: tournament
      });
    })
  );

  // Register for tournament
  router.post('/:id/register',
    validateRequest({ 
      params: CommonSchemas.id,
      body: RegisterSchema 
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const participant = await tournamentService.registerParticipant(
        req.params.id,
        req.user!.userId,
        req.body.teamId
      );
      
      res.json({
        success: true,
        message: 'Registration successful',
        data: participant
      });
    })
  );

  // Unregister from tournament
  router.delete('/:id/register',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      await tournamentService.unregisterParticipant(req.params.id, req.user!.userId);
      
      res.json({
        success: true,
        message: 'Unregistration successful'
      });
    })
  );

  // Generate brackets
  router.post('/:id/brackets',
    validateRequest({ 
      params: CommonSchemas.id,
      body: GenerateBracketsSchema 
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const brackets = await tournamentService.generateBrackets({
        tournamentId: req.params.id,
        ...req.body
      });
      
      res.json({
        success: true,
        message: 'Brackets generated successfully',
        data: brackets
      });
    })
  );

  // Get tournament statistics
  router.get('/:id/stats',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      const stats = await tournamentService.getTournamentStats(req.params.id);
      
      res.json({
        success: true,
        data: stats
      });
    })
  );

  // Get tournament participants
  router.get('/:id/participants',
    validateRequest({ 
      params: CommonSchemas.id,
      query: z.object({
        status: z.enum(['REGISTERED', 'CHECKED_IN', 'ELIMINATED', 'ACTIVE']).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // This would be implemented in TournamentService
      res.json({
        success: true,
        data: [],
        message: 'Participants endpoint - to be implemented'
      });
    })
  );

  // Get tournament matches
  router.get('/:id/matches',
    validateRequest({ 
      params: CommonSchemas.id,
      query: z.object({
        round: z.string().regex(/^\d+$/).transform(Number).optional(),
        status: z.enum(['PENDING', 'READY', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // This would be implemented in TournamentService
      res.json({
        success: true,
        data: [],
        message: 'Matches endpoint - to be implemented'
      });
    })
  );

  // Update tournament status
  router.patch('/:id/status',
    validateRequest({ 
      params: CommonSchemas.id,
      body: z.object({
        status: z.enum(['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CHECK_IN', 'LIVE', 'COMPLETED', 'CANCELLED'])
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const tournament = await tournamentService.updateTournament(
        req.params.id,
        { status: req.body.status },
        req.user!.userId
      );
      
      res.json({
        success: true,
        message: 'Tournament status updated',
        data: tournament
      });
    })
  );

  // Start check-in period
  router.post('/:id/check-in/start',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // This would implement check-in logic
      res.json({
        success: true,
        message: 'Check-in started - to be implemented'
      });
    })
  );

  // Participant check-in
  router.post('/:id/check-in',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // This would implement participant check-in
      res.json({
        success: true,
        message: 'Check-in successful - to be implemented'
      });
    })
  );

  // Get tournament leaderboard
  router.get('/:id/leaderboard',
    validateRequest({ 
      params: CommonSchemas.id,
      query: z.object({
        limit: z.string().regex(/^\d+$/).transform(Number).default('10')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // This would get current standings/leaderboard
      res.json({
        success: true,
        data: [],
        message: 'Leaderboard endpoint - to be implemented'
      });
    })
  );

  // Cancel tournament
  router.delete('/:id',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const tournament = await tournamentService.updateTournament(
        req.params.id,
        { status: 'CANCELLED' },
        req.user!.userId
      );
      
      res.json({
        success: true,
        message: 'Tournament cancelled',
        data: tournament
      });
    })
  );

  return router;
}