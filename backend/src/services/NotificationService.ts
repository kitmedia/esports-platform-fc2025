import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

interface NotificationData {
  userId: string;
  type: 'TOURNAMENT_UPDATE' | 'MATCH_READY' | 'MATCH_RESULT' | 'DISPUTE_RESOLVED' | 'PRIZE_AWARDED' | 'SYSTEM';
  title: string;
  message: string;
  data?: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class NotificationService {
  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer
  ) {}

  // ===== REAL-TIME NOTIFICATIONS =====

  async sendNotification(notification: NotificationData): Promise<void> {
    try {
      // Store notification in database
      const dbNotification = await this.prisma.notification.create({
        data: {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: notification.priority,
          isRead: false
        }
      });

      // Send real-time notification via WebSocket
      this.io.to(`user:${notification.userId}`).emit('notification', {
        id: dbNotification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        createdAt: dbNotification.createdAt
      });

      // Send critical notifications to all user sessions
      if (notification.priority === 'CRITICAL') {
        this.io.to(`user:${notification.userId}`).emit('critical_notification', {
          id: dbNotification.id,
          title: notification.title,
          message: notification.message
        });
      }

    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async sendBulkNotifications(notifications: NotificationData[]): Promise<void> {
    const promises = notifications.map(notification => this.sendNotification(notification));
    await Promise.allSettled(promises);
  }

  // ===== TOURNAMENT NOTIFICATIONS =====

  async notifyTournamentStart(tournamentId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: { user: true }
        }
      }
    });

    if (!tournament) return;

    const notifications: NotificationData[] = tournament.participants.map(participant => ({
      userId: participant.userId!,
      type: 'TOURNAMENT_UPDATE',
      title: 'Tournament Starting!',
      message: `${tournament.name} is about to begin. Please check in now.`,
      data: { tournamentId },
      priority: 'HIGH'
    }));

    await this.sendBulkNotifications(notifications);

    // Broadcast to tournament room
    this.io.to(`tournament:${tournamentId}`).emit('tournament_starting', {
      tournamentId,
      name: tournament.name
    });
  }

  async notifyMatchReady(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          include: { user: true }
        },
        tournament: true
      }
    });

    if (!match) return;

    const notifications: NotificationData[] = match.participants.map(participant => ({
      userId: participant.userId!,
      type: 'MATCH_READY',
      title: 'Match Ready!',
      message: `Your match in ${match.tournament.name} is ready to start.`,
      data: { matchId, tournamentId: match.tournamentId },
      priority: 'HIGH'
    }));

    await this.sendBulkNotifications(notifications);

    // Broadcast to match room
    this.io.to(`match:${matchId}`).emit('match_ready', {
      matchId,
      tournamentName: match.tournament.name
    });
  }

  async notifyMatchResult(matchId: string, winnerId: string, loserId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        results: { where: { status: 'VALIDATED' } }
      }
    });

    if (!match || match.results.length === 0) return;

    const result = match.results[0];

    // Notify winner
    await this.sendNotification({
      userId: winnerId,
      type: 'MATCH_RESULT',
      title: 'Victory! 🏆',
      message: `You won your match in ${match.tournament.name}!`,
      data: { 
        matchId, 
        tournamentId: match.tournamentId,
        score: `${result.player1Score}-${result.player2Score}`,
        result: 'win'
      },
      priority: 'MEDIUM'
    });

    // Notify loser
    await this.sendNotification({
      userId: loserId,
      type: 'MATCH_RESULT',
      title: 'Match Complete',
      message: `Your match in ${match.tournament.name} has ended.`,
      data: { 
        matchId, 
        tournamentId: match.tournamentId,
        score: `${result.player1Score}-${result.player2Score}`,
        result: 'loss'
      },
      priority: 'MEDIUM'
    });

    // Broadcast to tournament room
    this.io.to(`tournament:${match.tournamentId}`).emit('match_completed', {
      matchId,
      winnerId,
      loserId,
      score: `${result.player1Score}-${result.player2Score}`
    });
  }

  // ===== DISPUTE NOTIFICATIONS =====

  async notifyDisputeCreated(disputeId: string): Promise<void> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        match: { include: { tournament: true } },
        reporter: true
      }
    });

    if (!dispute) return;

    // Notify tournament organizer
    await this.sendNotification({
      userId: dispute.match.tournament.organizerId,
      type: 'DISPUTE_RESOLVED',
      title: 'New Dispute Reported',
      message: `A dispute has been reported for a match in ${dispute.match.tournament.name}.`,
      data: { disputeId, matchId: dispute.matchId },
      priority: 'HIGH'
    });

    // Broadcast to tournament room
    this.io.to(`tournament:${dispute.match.tournamentId}`).emit('dispute_created', {
      disputeId,
      matchId: dispute.matchId
    });
  }

  async notifyDisputeResolved(disputeId: string): Promise<void> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        match: { 
          include: { 
            tournament: true,
            participants: { include: { user: true } }
          } 
        }
      }
    });

    if (!dispute) return;

    const notifications: NotificationData[] = dispute.match.participants.map(participant => ({
      userId: participant.userId!,
      type: 'DISPUTE_RESOLVED',
      title: 'Dispute Resolved',
      message: `The dispute for your match in ${dispute.match.tournament.name} has been resolved.`,
      data: { 
        disputeId, 
        matchId: dispute.matchId,
        resolution: dispute.resolution 
      },
      priority: 'MEDIUM'
    }));

    await this.sendBulkNotifications(notifications);
  }

  // ===== PRIZE NOTIFICATIONS =====

  async notifyPrizeAwarded(userId: string, tournamentId: string, position: number, amount: number): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) return;

    const positionText = this.getPositionText(position);

    await this.sendNotification({
      userId,
      type: 'PRIZE_AWARDED',
      title: `Congratulations! 🏆`,
      message: `You placed ${positionText} in ${tournament.name} and earned $${amount}!`,
      data: { 
        tournamentId, 
        position, 
        amount,
        tournamentName: tournament.name 
      },
      priority: 'HIGH'
    });
  }

  // ===== SYSTEM NOTIFICATIONS =====

  async notifySystemMaintenance(userIds: string[], scheduledTime: Date): Promise<void> {
    const notifications: NotificationData[] = userIds.map(userId => ({
      userId,
      type: 'SYSTEM',
      title: 'Scheduled Maintenance',
      message: `System maintenance is scheduled for ${scheduledTime.toLocaleString()}. Please save your progress.`,
      data: { scheduledTime: scheduledTime.toISOString() },
      priority: 'MEDIUM'
    }));

    await this.sendBulkNotifications(notifications);

    // Broadcast system-wide
    this.io.emit('system_maintenance', {
      scheduledTime: scheduledTime.toISOString()
    });
  }

  async notifyFeatureUpdate(userIds: string[], feature: string, description: string): Promise<void> {
    const notifications: NotificationData[] = userIds.map(userId => ({
      userId,
      type: 'SYSTEM',
      title: 'New Feature Available!',
      message: `${feature}: ${description}`,
      data: { feature },
      priority: 'LOW'
    }));

    await this.sendBulkNotifications(notifications);
  }

  // ===== NOTIFICATION MANAGEMENT =====

  async getUserNotifications(
    userId: string, 
    limit: number = 20, 
    offset: number = 0,
    unreadOnly: boolean = false
  ) {
    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    return await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { 
        id: notificationId, 
        userId 
      },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });

    // Emit read status update
    this.io.to(`user:${userId}`).emit('notification_read', { notificationId });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { 
        userId, 
        isRead: false 
      },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });

    // Emit bulk read status update
    this.io.to(`user:${userId}`).emit('all_notifications_read');
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { 
        id: notificationId, 
        userId 
      }
    });

    this.io.to(`user:${userId}`).emit('notification_deleted', { notificationId });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.notification.count({
      where: { 
        userId, 
        isRead: false 
      }
    });
  }

  // ===== REAL-TIME UPDATES =====

  async broadcastTournamentUpdate(tournamentId: string, update: any): Promise<void> {
    this.io.to(`tournament:${tournamentId}`).emit('tournament_update', update);
  }

  async broadcastMatchUpdate(matchId: string, update: any): Promise<void> {
    this.io.to(`match:${matchId}`).emit('match_update', update);
  }

  async broadcastLeaderboardUpdate(tournamentId: string, leaderboard: any): Promise<void> {
    this.io.to(`tournament:${tournamentId}`).emit('leaderboard_update', leaderboard);
  }

  // ===== HELPER METHODS =====

  private getPositionText(position: number): string {
    if (position === 1) return '1st place';
    if (position === 2) return '2nd place';
    if (position === 3) return '3rd place';
    return `${position}th place`;
  }

  // ===== EMAIL NOTIFICATIONS (Future Enhancement) =====

  async sendEmailNotification(
    userId: string, 
    subject: string, 
    htmlContent: string
  ): Promise<void> {
    // TODO: Implement email sending with SendGrid or similar
    console.log(`Email notification to user ${userId}: ${subject}`);
  }

  // ===== PUSH NOTIFICATIONS (Future Enhancement) =====

  async sendPushNotification(
    userId: string, 
    title: string, 
    body: string, 
    data?: any
  ): Promise<void> {
    // TODO: Implement push notifications for mobile app
    console.log(`Push notification to user ${userId}: ${title}`);
  }
}