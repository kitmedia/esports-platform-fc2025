import { PrismaClient, DisputeCategory, DisputeStatus, ArbitrationDecision } from '@prisma/client';
import { AIService } from './AIService';

interface DisputeAnalysis {
  category: DisputeCategory;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  confidence: number;
  suggestedResolution: ArbitrationDecision;
  reasoning: string[];
  requiredEvidence: string[];
  estimatedResolutionTime: number; // hours
}

interface ArbitrationConsensus {
  finalDecision: ArbitrationDecision;
  consensusLevel: number; // 0-1, where 1 is unanimous
  votes: {
    decision: ArbitrationDecision;
    count: number;
    percentage: number;
    averageConfidence: number;
  }[];
  reasoning: string;
  resolved: boolean;
}

interface ArbitrationPool {
  totalArbiters: number;
  activeArbiters: number;
  averageRating: number;
  specializations: { [key: string]: number };
  availableSlots: number;
}

export class ArbitrationService {
  constructor(
    private prisma: PrismaClient,
    private aiService: AIService
  ) {}

  // ===== DISPUTE CREATION & ANALYSIS =====

  async submitDispute(data: {
    tournamentId: string;
    matchId?: string;
    reportedBy: string;
    category: DisputeCategory;
    description: string;
    evidence?: any[];
  }): Promise<any> {
    
    // AI-powered initial analysis
    const analysis = await this.analyzeDispute(data);
    
    // Create dispute with AI analysis
    const dispute = await this.prisma.dispute.create({
      data: {
        tournamentId: data.tournamentId,
        matchId: data.matchId,
        reportedBy: data.reportedBy,
        category: data.category,
        description: data.description,
        evidence: data.evidence || [],
        status: 'OPEN',
        priority: analysis.priority
      },
      include: {
        tournament: {
          select: { name: true, organizerId: true }
        },
        match: {
          select: { round: true, position: true, status: true }
        },
        reporter: {
          select: { username: true, displayName: true }
        }
      }
    });

    // Auto-assign arbiters based on category and availability
    await this.assignArbiters(dispute.id, data.category, analysis.priority);

    // Send notifications to assigned arbiters
    await this.notifyArbiters(dispute.id);

    return {
      ...dispute,
      aiAnalysis: analysis
    };
  }

  private async analyzeDispute(data: {
    category: DisputeCategory;
    description: string;
    evidence?: any[];
  }): Promise<DisputeAnalysis> {
    
    // Use AI to analyze dispute description and evidence
    let aiAnalysis: any = null;
    
    if (this.aiService.isReady()) {
      try {
        const prompt = `
        Analyze this eSports tournament dispute:
        Category: ${data.category}
        Description: ${data.description}
        Evidence items: ${data.evidence?.length || 0}
        
        Provide analysis including:
        - Priority level (LOW/MEDIUM/HIGH/URGENT)
        - Suggested resolution (APPROVE_ORIGINAL/APPROVE_DISPUTE/REMATCH/DISQUALIFY_BOTH/ESCALATE)
        - Confidence score (0-1)
        - Reasoning points
        - Required evidence for resolution
        - Estimated resolution time in hours
        
        Respond in JSON format.
        `;

        // This would be replaced with actual AI call
        // const response = await this.aiService.analyzeContent(prompt);
        // aiAnalysis = JSON.parse(response);
        
      } catch (error) {
        console.error('AI analysis failed:', error);
      }
    }

    // Fallback analysis based on category
    return this.generateFallbackAnalysis(data.category, data.description, data.evidence);
  }

  private generateFallbackAnalysis(
    category: DisputeCategory,
    description: string,
    evidence?: any[]
  ): DisputeAnalysis {
    
    const analysis: DisputeAnalysis = {
      category,
      priority: 'MEDIUM',
      confidence: 0.7,
      suggestedResolution: 'ESCALATE',
      reasoning: [],
      requiredEvidence: [],
      estimatedResolutionTime: 2
    };

    switch (category) {
      case 'WRONG_RESULT':
        analysis.priority = 'HIGH';
        analysis.suggestedResolution = 'APPROVE_DISPUTE';
        analysis.reasoning = [
          'Score disputes require careful evidence review',
          'Screenshots and match codes are critical',
          'Player testimony should be considered'
        ];
        analysis.requiredEvidence = [
          'Match result screenshot',
          'Game completion confirmation',
          'Optional: Video recording'
        ];
        analysis.estimatedResolutionTime = 1;
        break;

      case 'NO_SHOW':
        analysis.priority = 'MEDIUM';
        analysis.suggestedResolution = 'APPROVE_ORIGINAL';
        analysis.reasoning = [
          'No-show cases are usually straightforward',
          'Check connection logs and communication history',
          'Consider grace period policies'
        ];
        analysis.requiredEvidence = [
          'Connection attempt logs',
          'Communication records',
          'Tournament rules verification'
        ];
        analysis.estimatedResolutionTime = 0.5;
        break;

      case 'CHEATING':
        analysis.priority = 'URGENT';
        analysis.suggestedResolution = 'ESCALATE';
        analysis.reasoning = [
          'Cheating allegations require thorough investigation',
          'Video evidence is essential',
          'Multiple arbiter review recommended'
        ];
        analysis.requiredEvidence = [
          'Video proof of alleged cheating',
          'Game replay files if available',
          'Witness statements',
          'Technical analysis'
        ];
        analysis.estimatedResolutionTime = 6;
        break;

      case 'TECHNICAL_ISSUE':
        analysis.priority = 'MEDIUM';
        analysis.suggestedResolution = 'REMATCH';
        analysis.reasoning = [
          'Technical issues often warrant rematch',
          'Verify if issue affected game outcome',
          'Check if issue was reported promptly'
        ];
        analysis.requiredEvidence = [
          'Error screenshots/logs',
          'Connection quality data',
          'Timing of issue report'
        ];
        analysis.estimatedResolutionTime = 1;
        break;

      case 'RULE_VIOLATION':
        analysis.priority = 'HIGH';
        analysis.suggestedResolution = 'APPROVE_DISPUTE';
        analysis.reasoning = [
          'Rule violations must be enforced consistently',
          'Review tournament rules and precedents',
          'Consider severity of violation'
        ];
        analysis.requiredEvidence = [
          'Proof of rule violation',
          'Tournament rules reference',
          'Previous similar cases'
        ];
        analysis.estimatedResolutionTime = 2;
        break;

      default:
        analysis.reasoning = ['General dispute requiring manual review'];
        analysis.requiredEvidence = ['Relevant documentation'];
    }

    // Adjust priority based on description keywords
    const urgentKeywords = ['cheating', 'hacking', 'exploit', 'fraud'];
    const highKeywords = ['wrong', 'incorrect', 'unfair', 'violation'];
    
    const descLower = description.toLowerCase();
    
    if (urgentKeywords.some(keyword => descLower.includes(keyword))) {
      analysis.priority = 'URGENT';
      analysis.estimatedResolutionTime *= 2; // More time for urgent cases
    } else if (highKeywords.some(keyword => descLower.includes(keyword))) {
      analysis.priority = 'HIGH';
    }

    return analysis;
  }

  // ===== ARBITER MANAGEMENT =====

  private async assignArbiters(
    disputeId: string,
    category: DisputeCategory,
    priority: string
  ): Promise<void> {
    
    // Determine number of arbiters needed based on priority
    const arbitersNeeded = this.getArbitersNeeded(priority);
    
    // Find qualified arbiters
    const qualifiedArbiters = await this.findQualifiedArbiters(category, arbitersNeeded);
    
    // Assign arbiters to dispute
    for (const arbiter of qualifiedArbiters) {
      await this.prisma.arbitrationVote.create({
        data: {
          disputeId,
          arbiterId: arbiter.id,
          vote: 'ESCALATE', // Initial state, to be updated when arbiter votes
          confidence: 0.5
        }
      });
    }
  }

  private getArbitersNeeded(priority: string): number {
    switch (priority) {
      case 'URGENT': return 5; // Cheating, fraud cases
      case 'HIGH': return 3;   // Rule violations, wrong results
      case 'MEDIUM': return 2; // Technical issues, no-shows
      case 'LOW': return 1;    // Minor disputes
      default: return 2;
    }
  }

  private async findQualifiedArbiters(
    category: DisputeCategory,
    count: number
  ): Promise<any[]> {
    
    // Find users with arbiter permissions who are active and qualified
    const arbiters = await this.prisma.user.findMany({
      where: {
        role: { in: ['MODERATOR', 'ADMIN'] },
        isActive: true,
        isBanned: false
      },
      select: {
        id: true,
        username: true,
        role: true,
        // Could add specialization fields here
      },
      take: count * 2 // Get more than needed for selection
    });

    // Filter by specialization and availability
    const qualified = arbiters.filter(arbiter => {
      // Check if arbiter has capacity (not too many active disputes)
      return true; // Simplified for now
    });

    // Sort by qualification score (experience, rating, etc.)
    qualified.sort((a, b) => {
      // Prioritize admins over moderators
      if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
      if (b.role === 'ADMIN' && a.role !== 'ADMIN') return 1;
      
      // Could add more sophisticated scoring here
      return 0;
    });

    return qualified.slice(0, count);
  }

  // ===== VOTING SYSTEM =====

  async submitVote(
    disputeId: string,
    arbiterId: string,
    vote: ArbitrationDecision,
    reasoning?: string,
    confidence: number = 0.8
  ): Promise<void> {
    
    // Verify arbiter is assigned to this dispute
    const existingVote = await this.prisma.arbitrationVote.findUnique({
      where: {
        disputeId_arbiterId: {
          disputeId,
          arbiterId
        }
      }
    });

    if (!existingVote) {
      throw new Error('Arbiter not assigned to this dispute');
    }

    // Update vote
    await this.prisma.arbitrationVote.update({
      where: {
        disputeId_arbiterId: {
          disputeId,
          arbiterId
        }
      },
      data: {
        vote,
        reasoning,
        confidence: Math.max(0.1, Math.min(1.0, confidence))
      }
    });

    // Check if all votes are in and calculate consensus
    await this.checkConsensus(disputeId);
  }

  private async checkConsensus(disputeId: string): Promise<void> {
    const votes = await this.prisma.arbitrationVote.findMany({
      where: { disputeId },
      include: {
        arbiter: {
          select: { username: true, role: true }
        }
      }
    });

    // Check if all arbiters have voted (excluding initial ESCALATE votes)
    const realVotes = votes.filter(v => v.vote !== 'ESCALATE');
    const totalArbiters = votes.length;

    if (realVotes.length < totalArbiters) {
      return; // Not all votes are in yet
    }

    // Calculate consensus
    const consensus = this.calculateConsensus(realVotes);
    
    // If consensus reached, resolve dispute
    if (consensus.consensusLevel >= 0.6) { // 60% consensus threshold
      await this.resolveDispute(disputeId, consensus);
    } else {
      // Escalate to higher authority if no consensus
      await this.escalateDispute(disputeId, 'No consensus reached among arbiters');
    }
  }

  private calculateConsensus(votes: any[]): ArbitrationConsensus {
    const voteCounts: { [key: string]: any[] } = {};
    
    // Group votes by decision
    for (const vote of votes) {
      if (!voteCounts[vote.vote]) {
        voteCounts[vote.vote] = [];
      }
      voteCounts[vote.vote].push(vote);
    }

    // Calculate statistics for each decision
    const voteStats = Object.entries(voteCounts).map(([decision, voteList]) => ({
      decision: decision as ArbitrationDecision,
      count: voteList.length,
      percentage: voteList.length / votes.length,
      averageConfidence: voteList.reduce((sum, v) => sum + v.confidence, 0) / voteList.length
    }));

    // Sort by count (most votes first)
    voteStats.sort((a, b) => b.count - a.count);

    const topDecision = voteStats[0];
    const consensusLevel = topDecision.percentage;

    // Generate reasoning based on votes
    const reasoning = this.generateConsensusReasoning(voteStats, votes);

    return {
      finalDecision: topDecision.decision,
      consensusLevel,
      votes: voteStats,
      reasoning,
      resolved: consensusLevel >= 0.6
    };
  }

  private generateConsensusReasoning(voteStats: any[], votes: any[]): string {
    const topDecision = voteStats[0];
    const topVotes = votes.filter(v => v.vote === topDecision.decision);
    
    let reasoning = `Arbiters reached ${(topDecision.percentage * 100).toFixed(1)}% consensus for ${topDecision.decision}. `;
    
    // Include reasoning from votes
    const reasonings = topVotes
      .filter(v => v.reasoning)
      .map(v => v.reasoning);
    
    if (reasonings.length > 0) {
      reasoning += `Key points: ${reasonings.slice(0, 3).join('; ')}.`;
    }

    return reasoning;
  }

  // ===== DISPUTE RESOLUTION =====

  private async resolveDispute(
    disputeId: string,
    consensus: ArbitrationConsensus
  ): Promise<void> {
    
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        match: true,
        tournament: true
      }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Update dispute status
    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolution: consensus.reasoning
      }
    });

    // Apply resolution actions
    await this.applyResolution(dispute, consensus.finalDecision);

    // Notify relevant parties
    await this.notifyResolution(disputeId, consensus);
  }

  private async applyResolution(
    dispute: any,
    decision: ArbitrationDecision
  ): Promise<void> {
    
    switch (decision) {
      case 'APPROVE_ORIGINAL':
        // Keep original result, no action needed
        console.log(`Dispute ${dispute.id}: Original result upheld`);
        break;

      case 'APPROVE_DISPUTE':
        // Reverse result if this was a score dispute
        if (dispute.matchId && dispute.category === 'WRONG_RESULT') {
          await this.reverseMatchResult(dispute.matchId);
        }
        break;

      case 'REMATCH':
        // Schedule a rematch
        if (dispute.matchId) {
          await this.scheduleRematch(dispute.matchId);
        }
        break;

      case 'DISQUALIFY_BOTH':
        // Disqualify both participants
        if (dispute.matchId) {
          await this.disqualifyMatchParticipants(dispute.matchId);
        }
        break;

      case 'ESCALATE':
        // This shouldn't happen at resolution stage
        await this.escalateDispute(dispute.id, 'Resolution escalated by arbiters');
        break;
    }
  }

  private async reverseMatchResult(matchId: string): Promise<void> {
    // Find current validated result
    const currentResult = await this.prisma.matchResult.findFirst({
      where: { matchId, status: 'VALIDATED' },
      orderBy: { submittedAt: 'desc' }
    });

    if (currentResult) {
      // Create new result with reversed scores
      await this.prisma.matchResult.create({
        data: {
          matchId,
          submittedBy: 'SYSTEM_ARBITRATION',
          player1Score: currentResult.player2Score,
          player2Score: currentResult.player1Score,
          status: 'VALIDATED',
          validatedAt: new Date(),
          validatedBy: 'ARBITRATION_SYSTEM'
        }
      });

      // Mark old result as disputed
      await this.prisma.matchResult.update({
        where: { id: currentResult.id },
        data: { status: 'DISPUTED' }
      });
    }
  }

  private async scheduleRematch(matchId: string): Promise<void> {
    // Update match status to require rematch
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'PENDING',
        completedAt: null,
        // Could schedule for specific time
      }
    });
  }

  private async disqualifyMatchParticipants(matchId: string): Promise<void> {
    // Mark match as cancelled and update tournament standings
    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'CANCELLED' }
    });

    // Could also update participant standings here
  }

  private async escalateDispute(disputeId: string, reason: string): Promise<void> {
    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'ESCALATED',
        resolution: `Escalated: ${reason}`
      }
    });

    // Notify admins about escalation
    console.log(`Dispute ${disputeId} escalated: ${reason}`);
  }

  // ===== NOTIFICATIONS =====

  private async notifyArbiters(disputeId: string): Promise<void> {
    // Send notifications to assigned arbiters
    const votes = await this.prisma.arbitrationVote.findMany({
      where: { disputeId },
      include: {
        arbiter: { select: { id: true, email: true } },
        dispute: { select: { category: true, description: true } }
      }
    });

    for (const vote of votes) {
      // Send email/push notification to arbiter
      console.log(`Notifying arbiter ${vote.arbiter.id} about dispute ${disputeId}`);
    }
  }

  private async notifyResolution(
    disputeId: string,
    consensus: ArbitrationConsensus
  ): Promise<void> {
    // Notify dispute reporter and affected parties
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        reporter: { select: { id: true, email: true } }
      }
    });

    if (dispute) {
      console.log(`Notifying dispute resolution for ${disputeId}: ${consensus.finalDecision}`);
    }
  }

  // ===== PUBLIC API METHODS =====

  async getDispute(disputeId: string): Promise<any> {
    return await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        tournament: { select: { name: true } },
        match: { select: { round: true, position: true } },
        reporter: { select: { username: true, displayName: true } },
        votes: {
          include: {
            arbiter: { select: { username: true, role: true } }
          }
        }
      }
    });
  }

  async getActiveDisputes(): Promise<any[]> {
    return await this.prisma.dispute.findMany({
      where: {
        status: { in: ['OPEN', 'UNDER_REVIEW'] }
      },
      include: {
        tournament: { select: { name: true } },
        reporter: { select: { username: true } },
        _count: { select: { votes: true } }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async getArbitrationPool(): Promise<ArbitrationPool> {
    const arbiters = await this.prisma.user.findMany({
      where: {
        role: { in: ['MODERATOR', 'ADMIN'] },
        isActive: true,
        isBanned: false
      }
    });

    const activeDisputes = await this.prisma.dispute.count({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } }
    });

    return {
      totalArbiters: arbiters.length,
      activeArbiters: arbiters.filter(a => a.lastLoginAt && 
        new Date().getTime() - new Date(a.lastLoginAt).getTime() < 7 * 24 * 60 * 60 * 1000
      ).length,
      averageRating: 4.2, // Would calculate from actual ratings
      specializations: {
        'Technical Issues': 5,
        'Rule Violations': 8,
        'Score Disputes': 12,
        'Cheating': 3
      },
      availableSlots: Math.max(0, arbiters.length * 3 - activeDisputes) // Each arbiter can handle ~3 disputes
    };
  }

  async getArbitrationStats(): Promise<{
    totalDisputes: number;
    resolvedDisputes: number;
    averageResolutionTime: number;
    consensusRate: number;
    topCategories: { category: string; count: number }[];
  }> {
    const disputes = await this.prisma.dispute.findMany({
      select: {
        category: true,
        status: true,
        createdAt: true,
        resolvedAt: true
      }
    });

    const resolved = disputes.filter(d => d.status === 'RESOLVED');
    const resolutionTimes = resolved
      .filter(d => d.resolvedAt)
      .map(d => new Date(d.resolvedAt!).getTime() - new Date(d.createdAt).getTime());

    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / (1000 * 60 * 60) // hours
      : 0;

    // Count by category
    const categoryCounts: { [key: string]: number } = {};
    disputes.forEach(d => {
      categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalDisputes: disputes.length,
      resolvedDisputes: resolved.length,
      averageResolutionTime,
      consensusRate: 0.85, // Would calculate from actual consensus data
      topCategories
    };
  }
}