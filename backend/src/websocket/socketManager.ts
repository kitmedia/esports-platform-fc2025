import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/AuthService';
import { TournamentService } from '../services/TournamentService';
import { NotificationService } from '../services/NotificationService';
import { AIService } from '../services/AIService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  role?: string;
}

interface SocketServices {
  prisma: PrismaClient;
  auth: AuthService;
  tournament: TournamentService;
  notification: NotificationService;
  ai: AIService;
}

export function initializeWebSocket(io: SocketIOServer, services: SocketServices) {
  const { prisma, auth, tournament, notification, ai } = services;

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = await auth.verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.role = decoded.role;
      
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.username} (${socket.userId}) connected via WebSocket`);

    // Join user-specific room for notifications
    socket.join(`user:${socket.userId}`);

    // Send initial connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      username: socket.username,
      role: socket.role,
      timestamp: new Date().toISOString()
    });

    // === TOURNAMENT EVENTS ===

    // Join tournament room
    socket.on('join_tournament', async (data: { tournamentId: string }) => {
      try {
        const tournament = await prisma.tournament.findUnique({
          where: { id: data.tournamentId },
          include: {
            participants: {
              where: { userId: socket.userId }
            }
          }
        });

        if (!tournament) {
          socket.emit('error', { message: 'Tournament not found' });
          return;
        }

        // Check if user is participant or organizer
        const isParticipant = tournament.participants.length > 0;
        const isOrganizer = tournament.organizerId === socket.userId;
        const isAdmin = socket.role === 'ADMIN' || socket.role === 'SUPER_ADMIN';

        if (!isParticipant && !isOrganizer && !isAdmin && !tournament.isPublic) {
          socket.emit('error', { message: 'Access denied to tournament' });
          return;
        }

        socket.join(`tournament:${data.tournamentId}`);
        socket.emit('tournament_joined', { tournamentId: data.tournamentId });

        // Send current tournament status
        const tournamentData = await tournament.getTournament(data.tournamentId);
        socket.emit('tournament_update', tournamentData);

      } catch (error) {
        socket.emit('error', { message: 'Failed to join tournament' });
      }
    });

    // Leave tournament room
    socket.on('leave_tournament', (data: { tournamentId: string }) => {
      socket.leave(`tournament:${data.tournamentId}`);
      socket.emit('tournament_left', { tournamentId: data.tournamentId });
    });

    // === MATCH EVENTS ===

    // Join match room
    socket.on('join_match', async (data: { matchId: string }) => {
      try {
        const match = await prisma.match.findUnique({
          where: { id: data.matchId },
          include: {
            participants: true,
            tournament: true
          }
        });

        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        // Check if user is participant, organizer, or admin
        const isParticipant = match.participants.some(p => p.userId === socket.userId);
        const isOrganizer = match.tournament.organizerId === socket.userId;
        const isAdmin = socket.role === 'ADMIN' || socket.role === 'SUPER_ADMIN';

        if (!isParticipant && !isOrganizer && !isAdmin) {
          socket.emit('error', { message: 'Access denied to match' });
          return;
        }

        socket.join(`match:${data.matchId}`);
        socket.emit('match_joined', { matchId: data.matchId });

      } catch (error) {
        socket.emit('error', { message: 'Failed to join match' });
      }
    });

    // Leave match room
    socket.on('leave_match', (data: { matchId: string }) => {
      socket.leave(`match:${data.matchId}`);
      socket.emit('match_left', { matchId: data.matchId });
    });

    // Match check-in
    socket.on('match_checkin', async (data: { matchId: string }) => {
      try {
        const match = await prisma.match.findUnique({
          where: { id: data.matchId },
          include: { participants: true }
        });

        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        const participant = match.participants.find(p => p.userId === socket.userId);
        if (!participant) {
          socket.emit('error', { message: 'You are not a participant in this match' });
          return;
        }

        // Update participant check-in status
        await prisma.matchParticipant.update({
          where: { id: participant.id },
          data: { checkedInAt: new Date() }
        });

        // Broadcast to match room
        io.to(`match:${data.matchId}`).emit('participant_checked_in', {
          matchId: data.matchId,
          userId: socket.userId,
          username: socket.username
        });

        // Check if all participants are checked in
        const allParticipants = await prisma.matchParticipant.findMany({
          where: { matchId: data.matchId }
        });

        const allCheckedIn = allParticipants.every(p => p.checkedInAt !== null);
        if (allCheckedIn) {
          // Update match status to ready
          await prisma.match.update({
            where: { id: data.matchId },
            data: { status: 'READY' }
          });

          io.to(`match:${data.matchId}`).emit('match_ready', {
            matchId: data.matchId,
            message: 'All participants checked in - match is ready to start!'
          });

          // Notify via notification service
          await notification.notifyMatchReady(data.matchId);
        }

      } catch (error) {
        socket.emit('error', { message: 'Check-in failed' });
      }
    });

    // Real-time score updates
    socket.on('score_update', async (data: { 
      matchId: string; 
      player1Score: number; 
      player2Score: number; 
      timestamp: string;
    }) => {
      try {
        const match = await prisma.match.findUnique({
          where: { id: data.matchId },
          include: { participants: true }
        });

        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        const isParticipant = match.participants.some(p => p.userId === socket.userId);
        if (!isParticipant) {
          socket.emit('error', { message: 'Only participants can update scores' });
          return;
        }

        // Broadcast score update to match room
        io.to(`match:${data.matchId}`).emit('live_score_update', {
          matchId: data.matchId,
          player1Score: data.player1Score,
          player2Score: data.player2Score,
          timestamp: data.timestamp,
          updatedBy: socket.userId
        });

      } catch (error) {
        socket.emit('error', { message: 'Score update failed' });
      }
    });

    // === CHAT EVENTS ===

    // Tournament chat
    socket.on('tournament_chat', async (data: { 
      tournamentId: string; 
      message: string; 
    }) => {
      try {
        // Moderate message content
        const moderation = await ai.moderateContent(data.message);
        
        if (!moderation.isAppropriate) {
          socket.emit('message_rejected', { 
            reason: 'Message contains inappropriate content',
            details: moderation.flaggedReasons
          });
          return;
        }

        const chatMessage = {
          id: 'msg_' + Math.random().toString(36).substring(7),
          tournamentId: data.tournamentId,
          userId: socket.userId,
          username: socket.username,
          message: data.message,
          timestamp: new Date().toISOString()
        };

        // TODO: Store chat message in database
        
        // Broadcast to tournament room
        io.to(`tournament:${data.tournamentId}`).emit('tournament_chat_message', chatMessage);

      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Match chat
    socket.on('match_chat', async (data: { 
      matchId: string; 
      message: string; 
    }) => {
      try {
        const moderation = await ai.moderateContent(data.message);
        
        if (!moderation.isAppropriate) {
          socket.emit('message_rejected', { 
            reason: 'Message contains inappropriate content',
            details: moderation.flaggedReasons
          });
          return;
        }

        const chatMessage = {
          id: 'msg_' + Math.random().toString(36).substring(7),
          matchId: data.matchId,
          userId: socket.userId,
          username: socket.username,
          message: data.message,
          timestamp: new Date().toISOString()
        };

        // Broadcast to match room
        io.to(`match:${data.matchId}`).emit('match_chat_message', chatMessage);

      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // === STREAMING EVENTS ===

    // Join stream as viewer
    socket.on('join_stream', (data: { streamId: string }) => {
      socket.join(`stream:${data.streamId}`);
      
      // Increment viewer count
      io.to(`stream:${data.streamId}`).emit('viewer_joined', {
        streamId: data.streamId,
        userId: socket.userId,
        username: socket.username
      });
    });

    // Leave stream
    socket.on('leave_stream', (data: { streamId: string }) => {
      socket.leave(`stream:${data.streamId}`);
      
      // Decrement viewer count
      io.to(`stream:${data.streamId}`).emit('viewer_left', {
        streamId: data.streamId,
        userId: socket.userId
      });
    });

    // Stream reactions (likes, cheers, etc.)
    socket.on('stream_reaction', (data: { 
      streamId: string; 
      type: 'like' | 'cheer' | 'wow' | 'fire';
    }) => {
      io.to(`stream:${data.streamId}`).emit('stream_reaction', {
        streamId: data.streamId,
        type: data.type,
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date().toISOString()
      });
    });

    // === BRACKET UPDATES ===

    // Request bracket refresh
    socket.on('request_bracket_update', async (data: { tournamentId: string }) => {
      try {
        const tournamentData = await tournament.getTournament(data.tournamentId);
        socket.emit('bracket_update', {
          tournamentId: data.tournamentId,
          brackets: tournamentData?.brackets || []
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get bracket update' });
      }
    });

    // === NOTIFICATIONS ===

    // Mark notification as read
    socket.on('mark_notification_read', async (data: { notificationId: string }) => {
      try {
        await notification.markNotificationRead(data.notificationId, socket.userId!);
      } catch (error) {
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });

    // Get unread notification count
    socket.on('get_unread_count', async () => {
      try {
        const count = await notification.getUnreadCount(socket.userId!);
        socket.emit('unread_count', { count });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get unread count' });
      }
    });

    // === TYPING INDICATORS ===

    // User typing in tournament chat
    socket.on('typing_start', (data: { roomType: 'tournament' | 'match'; roomId: string }) => {
      socket.to(`${data.roomType}:${data.roomId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        roomType: data.roomType,
        roomId: data.roomId
      });
    });

    // User stopped typing
    socket.on('typing_stop', (data: { roomType: 'tournament' | 'match'; roomId: string }) => {
      socket.to(`${data.roomType}:${data.roomId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        roomType: data.roomType,
        roomId: data.roomId
      });
    });

    // === PRESENCE ===

    // Update user presence
    socket.on('update_presence', (data: { status: 'online' | 'away' | 'busy' | 'offline' }) => {
      // Broadcast presence to relevant rooms
      socket.rooms.forEach(room => {
        if (room.startsWith('tournament:') || room.startsWith('match:')) {
          socket.to(room).emit('user_presence_update', {
            userId: socket.userId,
            username: socket.username,
            status: data.status,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    // === DISCONNECT HANDLING ===

    socket.on('disconnect', () => {
      console.log(`User ${socket.username} (${socket.userId}) disconnected`);
      
      // Broadcast user offline status to all rooms they were in
      socket.rooms.forEach(room => {
        if (room.startsWith('tournament:') || room.startsWith('match:') || room.startsWith('stream:')) {
          socket.to(room).emit('user_disconnected', {
            userId: socket.userId,
            username: socket.username,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    // === ERROR HANDLING ===

    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.username}:`, error);
      socket.emit('error', { message: 'An unexpected error occurred' });
    });
  });

  // Broadcast functions for external use
  return {
    // Broadcast tournament update
    broadcastTournamentUpdate: (tournamentId: string, update: any) => {
      io.to(`tournament:${tournamentId}`).emit('tournament_update', update);
    },

    // Broadcast match update
    broadcastMatchUpdate: (matchId: string, update: any) => {
      io.to(`match:${matchId}`).emit('match_update', update);
    },

    // Broadcast to user
    broadcastToUser: (userId: string, event: string, data: any) => {
      io.to(`user:${userId}`).emit(event, data);
    },

    // Broadcast system announcement
    broadcastSystemAnnouncement: (announcement: any) => {
      io.emit('system_announcement', announcement);
    },

    // Get connection stats
    getConnectionStats: () => {
      const sockets = io.sockets.sockets;
      const totalConnections = sockets.size;
      const userConnections = new Map();

      sockets.forEach((socket: AuthenticatedSocket) => {
        if (socket.userId) {
          userConnections.set(socket.userId, (userConnections.get(socket.userId) || 0) + 1);
        }
      });

      return {
        totalConnections,
        uniqueUsers: userConnections.size,
        averageConnectionsPerUser: uniqueUsers > 0 ? totalConnections / userConnections.size : 0
      };
    }
  };
}