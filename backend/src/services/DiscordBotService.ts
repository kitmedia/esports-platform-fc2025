import { PrismaClient } from '@prisma/client';

interface DiscordBotConfig {
  token?: string;
  clientId?: string;
  guildId?: string;
}

interface TournamentBot {
  tournamentId: string;
  guildId: string;
  channelId: string;
  botConfig: any;
}

export class DiscordBotService {
  private config: DiscordBotConfig;
  private initialized = false;
  private activeBots: Map<string, TournamentBot> = new Map();

  constructor(private prisma: PrismaClient) {
    this.config = {
      token: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
      guildId: process.env.DISCORD_GUILD_ID
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.token) {
      console.log('🤖 Discord bot service disabled (no token provided)');
      return;
    }

    try {
      // TODO: Initialize Discord.js client
      // For now, just mark as initialized
      this.initialized = true;
      console.log('✅ Discord bot service initialized');
    } catch (error) {
      console.error('❌ Discord bot initialization failed:', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ===== TOURNAMENT BOT CREATION =====

  async createTournamentBot(
    tournamentId: string,
    guildId: string,
    organizerId: string
  ): Promise<TournamentBot> {
    if (!this.initialized) {
      throw new Error('Discord bot service not initialized');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { organizer: true }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.organizerId !== organizerId) {
      throw new Error('Only tournament organizer can create Discord bot');
    }

    // Create Discord channel for tournament
    const channelName = `tournament-${tournament.name.toLowerCase().replace(/\s+/g, '-')}`;
    
    // TODO: Implement actual Discord channel creation
    const channelId = `mock_channel_${Date.now()}`;

    const botConfig = {
      tournamentId,
      guildId,
      channelId,
      commands: this.generateTournamentCommands(),
      webhooks: {
        matchResults: true,
        bracketUpdates: true,
        announcements: true
      },
      roles: {
        participant: `tournament-${tournamentId}-participant`,
        organizer: `tournament-${tournamentId}-organizer`
      }
    };

    // Store bot configuration
    await this.prisma.discordBot.create({
      data: {
        tournamentId,
        guildId,
        channelId,
        config: botConfig,
        isActive: true
      }
    });

    const tournamentBot: TournamentBot = {
      tournamentId,
      guildId,
      channelId,
      botConfig
    };

    this.activeBots.set(tournamentId, tournamentBot);

    // Send initial welcome message
    await this.sendTournamentWelcome(tournamentId);

    return tournamentBot;
  }

  // ===== DISCORD COMMANDS =====

  private generateTournamentCommands() {
    return [
      {
        name: 'tournament-info',
        description: 'Get tournament information',
        type: 1 // CHAT_INPUT
      },
      {
        name: 'register',
        description: 'Register for the tournament',
        type: 1
      },
      {
        name: 'brackets',
        description: 'View current tournament brackets',
        type: 1
      },
      {
        name: 'my-matches',
        description: 'View your upcoming matches',
        type: 1
      },
      {
        name: 'submit-result',
        description: 'Submit match result with screenshot',
        type: 1,
        options: [
          {
            name: 'match-id',
            description: 'Match ID',
            type: 3, // STRING
            required: true
          },
          {
            name: 'screenshot',
            description: 'Match result screenshot',
            type: 11, // ATTACHMENT
            required: true
          }
        ]
      },
      {
        name: 'leaderboard',
        description: 'View tournament leaderboard',
        type: 1
      }
    ];
  }

  async handleSlashCommand(interaction: any): Promise<void> {
    const { commandName, options, user, guildId } = interaction;

    // Find tournament bot for this guild
    const bot = Array.from(this.activeBots.values())
      .find(b => b.guildId === guildId);

    if (!bot) {
      await this.replyToInteraction(interaction, 'No active tournament in this server.');
      return;
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: bot.tournamentId },
      include: { participants: true }
    });

    if (!tournament) {
      await this.replyToInteraction(interaction, 'Tournament not found.');
      return;
    }

    switch (commandName) {
      case 'tournament-info':
        await this.handleTournamentInfo(interaction, tournament);
        break;
      
      case 'register':
        await this.handleRegistration(interaction, tournament, user.id);
        break;
      
      case 'brackets':
        await this.handleBrackets(interaction, tournament);
        break;
      
      case 'my-matches':
        await this.handleMyMatches(interaction, tournament, user.id);
        break;
      
      case 'submit-result':
        await this.handleSubmitResult(interaction, tournament, options);
        break;
      
      case 'leaderboard':
        await this.handleLeaderboard(interaction, tournament);
        break;
      
      default:
        await this.replyToInteraction(interaction, 'Unknown command.');
    }
  }

  private async handleTournamentInfo(interaction: any, tournament: any): Promise<void> {
    const embed = {
      title: `🏆 ${tournament.name}`,
      description: tournament.description,
      fields: [
        {
          name: 'Format',
          value: tournament.format,
          inline: true
        },
        {
          name: 'Participants',
          value: `${tournament.participants.length}/${tournament.maxParticipants}`,
          inline: true
        },
        {
          name: 'Entry Fee',
          value: tournament.entryFee > 0 ? `$${tournament.entryFee}` : 'Free',
          inline: true
        },
        {
          name: 'Prize Pool',
          value: tournament.prizePool > 0 ? `$${tournament.prizePool}` : 'None',
          inline: true
        },
        {
          name: 'Status',
          value: tournament.status,
          inline: true
        }
      ],
      color: 0x00ff00,
      timestamp: new Date().toISOString()
    };

    await this.replyToInteraction(interaction, { embeds: [embed] });
  }

  private async handleRegistration(interaction: any, tournament: any, discordUserId: string): Promise<void> {
    // Find user by Discord ID
    const user = await this.prisma.user.findFirst({
      where: { discordId: discordUserId }
    });

    if (!user) {
      await this.replyToInteraction(interaction, 
        'You need to link your Discord account on the platform first. Visit our website to connect your accounts.');
      return;
    }

    // Check if already registered
    const existingParticipant = await this.prisma.tournamentParticipant.findFirst({
      where: {
        tournamentId: tournament.id,
        userId: user.id
      }
    });

    if (existingParticipant) {
      await this.replyToInteraction(interaction, 'You are already registered for this tournament!');
      return;
    }

    // Check registration constraints
    if (tournament.status !== 'REGISTRATION_OPEN') {
      await this.replyToInteraction(interaction, 'Registration is not currently open.');
      return;
    }

    if (tournament.participants.length >= tournament.maxParticipants) {
      await this.replyToInteraction(interaction, 'Tournament is full!');
      return;
    }

    // Register participant
    try {
      await this.prisma.tournamentParticipant.create({
        data: {
          tournamentId: tournament.id,
          userId: user.id,
          status: 'REGISTERED'
        }
      });

      await this.replyToInteraction(interaction, 
        `✅ Successfully registered for ${tournament.name}! Check the website for bracket updates.`);

      // Add tournament role to user
      await this.addTournamentRole(interaction.user.id, tournament.id);

    } catch (error) {
      await this.replyToInteraction(interaction, 'Registration failed. Please try again.');
    }
  }

  private async handleBrackets(interaction: any, tournament: any): Promise<void> {
    const webUrl = process.env.FRONTEND_URL || 'https://your-platform.com';
    const bracketUrl = `${webUrl}/tournaments/${tournament.id}/brackets`;

    const embed = {
      title: `🗂️ ${tournament.name} - Brackets`,
      description: `View the current tournament brackets and match results.`,
      url: bracketUrl,
      color: 0x0099ff,
      fields: [
        {
          name: 'View Brackets',
          value: `[Click here to view live brackets](${bracketUrl})`,
          inline: false
        }
      ]
    };

    await this.replyToInteraction(interaction, { embeds: [embed] });
  }

  private async handleMyMatches(interaction: any, tournament: any, discordUserId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { discordId: discordUserId }
    });

    if (!user) {
      await this.replyToInteraction(interaction, 'Discord account not linked to platform.');
      return;
    }

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId: tournament.id,
        participants: {
          some: { userId: user.id }
        },
        status: { in: ['PENDING', 'READY', 'LIVE'] }
      },
      include: {
        participants: {
          include: {
            user: { select: { username: true } }
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    if (matches.length === 0) {
      await this.replyToInteraction(interaction, 'You have no upcoming matches.');
      return;
    }

    const embed = {
      title: '📅 Your Upcoming Matches',
      fields: matches.slice(0, 5).map(match => {
        const opponent = match.participants.find(p => p.userId !== user.id);
        return {
          name: `Match ${match.matchNumber}`,
          value: `vs ${opponent?.user?.username || 'TBD'}\nStatus: ${match.status}`,
          inline: true
        };
      }),
      color: 0xff9900
    };

    await this.replyToInteraction(interaction, { embeds: [embed] });
  }

  private async handleSubmitResult(interaction: any, tournament: any, options: any): Promise<void> {
    // This would handle result submission with screenshot
    // For now, redirect to website
    const webUrl = process.env.FRONTEND_URL || 'https://your-platform.com';
    await this.replyToInteraction(interaction, 
      `Please submit match results on the website: ${webUrl}/tournaments/${tournament.id}`);
  }

  private async handleLeaderboard(interaction: any, tournament: any): Promise<void> {
    // Get top performers
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      include: {
        user: { select: { username: true, currentElo: true } }
      },
      orderBy: { currentElo: 'desc' },
      take: 10
    });

    const embed = {
      title: `🏆 ${tournament.name} - Leaderboard`,
      description: 'Top participants by ELO rating',
      fields: participants.map((participant, index) => ({
        name: `#${index + 1} ${participant.user?.username}`,
        value: `ELO: ${participant.currentElo}`,
        inline: true
      })),
      color: 0xffd700
    };

    await this.replyToInteraction(interaction, { embeds: [embed] });
  }

  // ===== TOURNAMENT NOTIFICATIONS =====

  async sendTournamentWelcome(tournamentId: string): Promise<void> {
    const bot = this.activeBots.get(tournamentId);
    if (!bot) return;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) return;

    const welcomeMessage = {
      embeds: [{
        title: `🏆 Welcome to ${tournament.name}!`,
        description: 'This channel will provide updates throughout the tournament.',
        fields: [
          {
            name: 'Commands',
            value: '• `/tournament-info` - Get tournament details\n• `/register` - Register for tournament\n• `/brackets` - View brackets\n• `/my-matches` - View your matches',
            inline: false
          }
        ],
        color: 0x00ff00
      }]
    };

    await this.sendToChannel(bot.channelId, welcomeMessage);
  }

  async notifyMatchReady(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        participants: {
          include: {
            user: { select: { username: true, discordId: true } }
          }
        }
      }
    });

    if (!match) return;

    const bot = this.activeBots.get(match.tournamentId);
    if (!bot) return;

    const participants = match.participants
      .filter(p => p.user?.discordId)
      .map(p => `<@${p.user!.discordId}>`)
      .join(' ');

    const message = {
      content: `${participants}`,
      embeds: [{
        title: '⚔️ Match Ready!',
        description: `Match ${match.matchNumber} is ready to start.`,
        fields: [
          {
            name: 'Players',
            value: match.participants.map(p => p.user?.username).join(' vs '),
            inline: false
          }
        ],
        color: 0xff0000
      }]
    };

    await this.sendToChannel(bot.channelId, message);
  }

  async notifyTournamentComplete(tournamentId: string, winnerId: string): Promise<void> {
    const bot = this.activeBots.get(tournamentId);
    if (!bot) return;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          where: { userId: winnerId },
          include: { user: true }
        }
      }
    });

    if (!tournament) return;

    const winner = tournament.participants[0];
    const discordMention = winner?.user?.discordId ? `<@${winner.user.discordId}>` : winner?.user?.username;

    const message = {
      embeds: [{
        title: `🏆 ${tournament.name} Complete!`,
        description: `Congratulations to our champion!`,
        fields: [
          {
            name: 'Winner',
            value: discordMention || 'Unknown',
            inline: true
          },
          {
            name: 'Prize',
            value: tournament.prizePool > 0 ? `$${tournament.prizePool}` : 'Glory!',
            inline: true
          }
        ],
        color: 0xffd700
      }]
    };

    await this.sendToChannel(bot.channelId, message);
  }

  // ===== HELPER METHODS =====

  private async replyToInteraction(interaction: any, content: any): Promise<void> {
    // TODO: Implement actual Discord interaction reply
    console.log('Discord reply:', content);
  }

  private async sendToChannel(channelId: string, message: any): Promise<void> {
    // TODO: Implement actual Discord message sending
    console.log(`Discord message to ${channelId}:`, message);
  }

  private async addTournamentRole(discordUserId: string, tournamentId: string): Promise<void> {
    // TODO: Implement Discord role assignment
    console.log(`Adding tournament role to ${discordUserId} for tournament ${tournamentId}`);
  }

  // ===== BOT MANAGEMENT =====

  async deactivateTournamentBot(tournamentId: string): Promise<void> {
    const bot = this.activeBots.get(tournamentId);
    if (bot) {
      await this.prisma.discordBot.updateMany({
        where: { tournamentId },
        data: { isActive: false }
      });

      this.activeBots.delete(tournamentId);
    }
  }

  async getActiveBots(): Promise<TournamentBot[]> {
    return Array.from(this.activeBots.values());
  }
}