import { PrismaClient, TournamentFormat, TournamentStatus, GameMode } from '@prisma/client';
import { AIService } from './AIService';
import { z } from 'zod';

// Validation schemas
const CreateTournamentSchema = z.object({
  name: z.string().min(3).max(100),
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
  requiresApproval: z.boolean().default(false)
});

const BracketGenerationSchema = z.object({
  tournamentId: z.string(),
  seedingMethod: z.enum(['random', 'elo', 'manual']).default('elo'),
  groupSize: z.number().min(2).max(8).optional()
});

interface BracketNode {
  id: string;
  round: number;
  position: number;
  participants: string[];
  winner?: string;
  status: 'pending' | 'ready' | 'completed';
  children?: BracketNode[];
}

interface TournamentStats {
  totalParticipants: number;
  completedMatches: number;
  pendingMatches: number;
  averageMatchDuration: number;
  topPerformers: any[];
  upsetCount: number;
}

export class TournamentService {
  constructor(
    private prisma: PrismaClient,
    private aiService: AIService
  ) {}

  // ===== TOURNAMENT CREATION =====

  async createTournament(data: any, organizerId: string) {
    const validatedData = CreateTournamentSchema.parse(data);

    // AI-powered tournament optimization
    const aiSuggestions = await this.aiService.suggestTournamentFormat(
      validatedData.maxParticipants,
      this.calculateTimeframe(validatedData.registrationStart, validatedData.tournamentStart),
      'mixed' // Could be determined from organizer history
    );

    // Generate AI description if not provided
    let description = validatedData.description;
    if (!description || description.length < 50) {
      const aiDescription = await this.aiService.generateEventDescription(
        validatedData.gameMode,
        validatedData.prizePool,
        ['Live Streaming', 'AI Validation', 'Real-time Brackets']
      );
      description = aiDescription.description;
    }

    const tournament = await this.prisma.tournament.create({
      data: {
        ...validatedData,
        description,
        organizerId,
        status: 'DRAFT',
        aiGenerated: !validatedData.description,
        aiSuggestions: {
          optimizedFormat: aiSuggestions.format,
          estimatedDuration: aiSuggestions.estimatedDuration,
          suggestions: aiSuggestions.suggestions,
          confidence: aiSuggestions.confidence
        }
      },
      include: {
        organizer: {
          select: { id: true, username: true, displayName: true, avatar: true }
        },
        _count: {
          select: { participants: true }
        }
      }
    });

    return tournament;
  }

  async updateTournament(tournamentId: string, data: any, userId: string) {
    // Verify ownership
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, organizerId: userId }
    });

    if (!tournament) {
      throw new Error('Tournament not found or access denied');
    }

    // Don't allow certain updates if tournament is live
    if (tournament.status === 'LIVE' && 
        (data.maxParticipants || data.format || data.tournamentStart)) {
      throw new Error('Cannot modify core settings while tournament is live');
    }

    return await this.prisma.tournament.update({
      where: { id: tournamentId },
      data,
      include: {
        organizer: {
          select: { id: true, username: true, displayName: true, avatar: true }
        },
        _count: {
          select: { participants: true }
        }
      }
    });
  }

  // ===== PARTICIPANT MANAGEMENT =====

  async registerParticipant(
    tournamentId: string,
    userId: string,
    teamId?: string
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { participants: true } } }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Validation checks
    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new Error('Registration is not open for this tournament');
    }

    if (tournament._count.participants >= tournament.maxParticipants) {
      throw new Error('Tournament is full');
    }

    if (new Date() > new Date(tournament.registrationEnd)) {
      throw new Error('Registration period has ended');
    }

    // Check if user is already registered
    const existingParticipant = await this.prisma.tournamentParticipant.findFirst({
      where: {
        tournamentId,
        OR: [
          { userId },
          { teamId }
        ]
      }
    });

    if (existingParticipant) {
      throw new Error('Already registered for this tournament');
    }

    // Get user's current ELO for seeding
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currentElo: true }
    });

    const participant = await this.prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        userId: tournament.isTeamTournament ? undefined : userId,
        teamId: tournament.isTeamTournament ? teamId : undefined,
        currentElo: user?.currentElo || 1200,
        status: tournament.requiresApproval ? 'REGISTERED' : 'REGISTERED'
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatar: true, currentElo: true }
        },
        team: {
          select: { id: true, name: true, tag: true, avatar: true }
        }
      }
    });

    // Auto-start tournament if minimum participants reached and auto-start enabled
    await this.checkAutoStart(tournamentId);

    return participant;
  }

  async unregisterParticipant(tournamentId: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status === 'LIVE') {
      throw new Error('Cannot unregister from a live tournament');
    }

    return await this.prisma.tournamentParticipant.delete({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId
        }
      }
    });
  }

  // ===== BRACKET GENERATION =====

  async generateBrackets(data: z.infer<typeof BracketGenerationSchema>) {
    const validatedData = BracketGenerationSchema.parse(data);
    const { tournamentId, seedingMethod } = validatedData;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, currentElo: true } },
            team: { select: { id: true, name: true, currentElo: true } }
          }
        }
      }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status !== 'REGISTRATION_CLOSED') {
      throw new Error('Tournament must be in registration closed state');
    }

    if (tournament.participants.length < tournament.minParticipants) {
      throw new Error('Not enough participants to generate brackets');
    }

    // Seed participants
    const seededParticipants = await this.seedParticipants(
      tournament.participants,
      seedingMethod
    );

    // Generate bracket structure based on format
    const brackets = await this.createBracketStructure(
      tournament.format,
      seededParticipants,
      tournamentId
    );

    // Update tournament status
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'CHECK_IN' }
    });

    return brackets;
  }

  private async seedParticipants(participants: any[], method: string) {
    switch (method) {
      case 'elo':
        return participants.sort((a, b) => {
          const eloA = a.user?.currentElo || a.team?.currentElo || 1200;
          const eloB = b.user?.currentElo || b.team?.currentElo || 1200;
          return eloB - eloA; // Highest ELO first
        });
      
      case 'random':
        return participants.sort(() => Math.random() - 0.5);
      
      case 'manual':
        // Return as-is, assuming manual seeding was done elsewhere
        return participants;
      
      default:
        return participants;
    }
  }

  private async createBracketStructure(
    format: TournamentFormat,
    participants: any[],
    tournamentId: string
  ) {
    switch (format) {
      case 'SINGLE_ELIMINATION':
        return await this.generateSingleEliminationBracket(participants, tournamentId);
      
      case 'DOUBLE_ELIMINATION':
        return await this.generateDoubleEliminationBracket(participants, tournamentId);
      
      case 'ROUND_ROBIN':
        return await this.generateRoundRobinBracket(participants, tournamentId);
      
      case 'SWISS':
        return await this.generateSwissBracket(participants, tournamentId);
      
      default:
        throw new Error(`Bracket generation for ${format} not implemented`);
    }
  }

  private async generateSingleEliminationBracket(participants: any[], tournamentId: string) {
    // Calculate number of rounds needed
    const rounds = Math.ceil(Math.log2(participants.length));
    
    // Create main bracket
    const bracket = await this.prisma.bracket.create({
      data: {
        tournamentId,
        name: 'Main',
        type: 'SINGLE_ELIMINATION',
        round: 1,
        position: 0
      }
    });

    // Generate first round matches
    const matches = [];
    for (let i = 0; i < participants.length; i += 2) {
      if (i + 1 < participants.length) {
        // Both participants available
        const match = await this.createMatch(
          tournamentId,
          bracket.id,
          1,
          Math.floor(i / 2),
          [participants[i], participants[i + 1]]
        );
        matches.push(match);
      } else {
        // Bye - participant advances automatically
        // This would be handled in the bracket visualization
      }
    }

    return { bracket, matches };
  }

  private async generateDoubleEliminationBracket(participants: any[], tournamentId: string) {
    // Create winners bracket
    const winnersBracket = await this.prisma.bracket.create({
      data: {
        tournamentId,
        name: 'Winners',
        type: 'DOUBLE_ELIMINATION_WINNERS',
        round: 1,
        position: 0
      }
    });

    // Create losers bracket
    const losersBracket = await this.prisma.bracket.create({
      data: {
        tournamentId,
        name: 'Losers',
        type: 'DOUBLE_ELIMINATION_LOSERS',
        round: 1,
        position: 1
      }
    });

    // Generate winners bracket first round
    const matches = [];
    for (let i = 0; i < participants.length; i += 2) {
      if (i + 1 < participants.length) {
        const match = await this.createMatch(
          tournamentId,
          winnersBracket.id,
          1,
          Math.floor(i / 2),
          [participants[i], participants[i + 1]]
        );
        matches.push(match);
      }
    }

    return { winnersBracket, losersBracket, matches };
  }

  private async generateRoundRobinBracket(participants: any[], tournamentId: string) {
    const bracket = await this.prisma.bracket.create({
      data: {
        tournamentId,
        name: 'Round Robin',
        type: 'ROUND_ROBIN',
        round: 1,
        position: 0
      }
    });

    // Generate all possible matchups
    const matches = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const match = await this.createMatch(
          tournamentId,
          bracket.id,
          1,
          matches.length,
          [participants[i], participants[j]]
        );
        matches.push(match);
      }
    }

    return { bracket, matches };
  }

  private async generateSwissBracket(participants: any[], tournamentId: string) {
    const rounds = Math.ceil(Math.log2(participants.length));
    
    const bracket = await this.prisma.bracket.create({
      data: {
        tournamentId,
        name: 'Swiss System',
        type: 'SWISS',
        round: 1,
        position: 0
      }
    });

    // Generate first round with random pairings
    const matches = [];
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const match = await this.createMatch(
          tournamentId,
          bracket.id,
          1,
          Math.floor(i / 2),
          [shuffled[i], shuffled[i + 1]]
        );
        matches.push(match);
      }
    }

    return { bracket, matches, totalRounds: rounds };
  }

  private async createMatch(
    tournamentId: string,
    bracketId: string,
    round: number,
    position: number,
    participants: any[]
  ) {
    const match = await this.prisma.match.create({
      data: {
        tournamentId,
        bracketId,
        round,
        position,
        status: 'PENDING',
        matchNumber: `R${round}-${position + 1}`
      }
    });

    // Create match participants
    for (let i = 0; i < participants.length; i++) {
      await this.prisma.matchParticipant.create({
        data: {
          matchId: match.id,
          userId: participants[i].userId,
          teamId: participants[i].teamId,
          side: i + 1
        }
      });
    }

    return match;
  }

  // ===== TOURNAMENT ANALYTICS =====

  async getTournamentStats(tournamentId: string): Promise<TournamentStats> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: {
            user: { select: { username: true, currentElo: true } },
            team: { select: { name: true, currentElo: true } }
          }
        },
        matches: {
          include: {
            results: true,
            participants: {
              include: {
                user: { select: { username: true } },
                team: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const completedMatches = tournament.matches.filter(m => m.status === 'COMPLETED');
    const pendingMatches = tournament.matches.filter(m => 
      m.status === 'PENDING' || m.status === 'READY' || m.status === 'LIVE'
    );

    // Calculate average match duration
    const matchDurations = completedMatches
      .filter(m => m.startedAt && m.completedAt)
      .map(m => 
        new Date(m.completedAt!).getTime() - new Date(m.startedAt!).getTime()
      );

    const averageMatchDuration = matchDurations.length > 0
      ? matchDurations.reduce((a, b) => a + b, 0) / matchDurations.length / (1000 * 60) // in minutes
      : 0;

    // Identify top performers
    const participantStats = tournament.participants.map(p => {
      const userMatches = completedMatches.filter(m =>
        m.participants.some(mp => mp.userId === p.userId || mp.teamId === p.teamId)
      );

      const wins = userMatches.filter(m => {
        const result = m.results.find(r => r.status === 'VALIDATED');
        if (!result) return false;
        
        const participant = m.participants.find(mp => mp.userId === p.userId || mp.teamId === p.teamId);
        const isPlayer1 = participant?.side === 1;
        
        return isPlayer1 
          ? result.player1Score > result.player2Score
          : result.player2Score > result.player1Score;
      }).length;

      return {
        participant: p,
        wins,
        totalMatches: userMatches.length,
        winRate: userMatches.length > 0 ? wins / userMatches.length : 0
      };
    });

    const topPerformers = participantStats
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
      .slice(0, 5);

    // Count upsets (lower ELO beating higher ELO by significant margin)
    const upsetCount = completedMatches.filter(m => {
      const result = m.results.find(r => r.status === 'VALIDATED');
      if (!result) return false;

      const p1 = m.participants.find(p => p.side === 1);
      const p2 = m.participants.find(p => p.side === 2);
      
      if (!p1 || !p2) return false;

      const participant1 = tournament.participants.find(tp => 
        tp.userId === p1.userId || tp.teamId === p1.teamId
      );
      const participant2 = tournament.participants.find(tp => 
        tp.userId === p2.userId || tp.teamId === p2.teamId
      );

      if (!participant1 || !participant2) return false;

      const elo1 = participant1.currentElo;
      const elo2 = participant2.currentElo;
      const eloDiff = Math.abs(elo1 - elo2);

      // Consider it an upset if ELO difference > 200 and underdog won
      if (eloDiff > 200) {
        const player1Won = result.player1Score > result.player2Score;
        const player1IsUnderdog = elo1 < elo2;
        
        return (player1Won && player1IsUnderdog) || (!player1Won && !player1IsUnderdog);
      }

      return false;
    }).length;

    return {
      totalParticipants: tournament.participants.length,
      completedMatches: completedMatches.length,
      pendingMatches: pendingMatches.length,
      averageMatchDuration,
      topPerformers,
      upsetCount
    };
  }

  // ===== HELPER METHODS =====

  private calculateTimeframe(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    if (diffHours <= 24) return 'short';
    if (diffHours <= 72) return 'medium';
    return 'long';
  }

  private async checkAutoStart(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { participants: true } } }
    });

    if (!tournament) return;

    // Auto-start logic could be implemented here
    // For now, just update status when registration closes
    if (new Date() >= new Date(tournament.registrationEnd) &&
        tournament.status === 'REGISTRATION_OPEN') {
      await this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'REGISTRATION_CLOSED' }
      });
    }
  }

  // ===== PUBLIC METHODS =====

  async getTournaments(filters: {
    status?: TournamentStatus;
    format?: TournamentFormat;
    gameMode?: GameMode;
    isPublic?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.format) where.format = filters.format;
    if (filters.gameMode) where.gameMode = filters.gameMode;
    if (filters.isPublic !== undefined) where.isPublic = filters.isPublic;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await this.prisma.tournament.findMany({
      where,
      include: {
        organizer: {
          select: { id: true, username: true, displayName: true, avatar: true }
        },
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 20,
      skip: filters.offset || 0
    });
  }

  async getTournament(tournamentId: string) {
    return await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        organizer: {
          select: { id: true, username: true, displayName: true, avatar: true }
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
        brackets: {
          include: {
            matches: {
              include: {
                participants: {
                  include: {
                    user: { select: { username: true, displayName: true } },
                    team: { select: { name: true, tag: true } }
                  }
                },
                results: {
                  where: { status: 'VALIDATED' }
                }
              }
            }
          }
        }
      }
    });
  }
}