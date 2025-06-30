import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 5000

  connect(): void {
    const token = useAuthStore.getState().token
    if (!token) return

    const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001'

    this.socket = io(WS_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      toast.success('Connected to real-time updates', { id: 'websocket-status' })
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      toast.error('Lost connection to real-time updates', { id: 'websocket-status' })
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.attemptReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.attemptReconnect()
    })

    // Authentication
    this.socket.on('connected', (data) => {
      console.log('Authenticated:', data)
    })

    // Tournament events
    this.socket.on('tournament_joined', (data) => {
      console.log('Joined tournament:', data.tournamentId)
    })

    this.socket.on('tournament_update', (data) => {
      // Handle tournament updates
      console.log('Tournament update:', data)
    })

    this.socket.on('tournament_chat_message', (message) => {
      // Handle chat messages
      console.log('Chat message:', message)
    })

    // Match events
    this.socket.on('match_joined', (data) => {
      console.log('Joined match:', data.matchId)
    })

    this.socket.on('match_ready', (data) => {
      toast.success(`Match ${data.matchId} is ready to start!`)
    })

    this.socket.on('participant_checked_in', (data) => {
      console.log('Participant checked in:', data)
    })

    this.socket.on('live_score_update', (data) => {
      console.log('Live score update:', data)
    })

    this.socket.on('match_chat_message', (message) => {
      console.log('Match chat:', message)
    })

    // Notifications
    this.socket.on('notification', (notification) => {
      toast(notification.title, {
        icon: this.getNotificationIcon(notification.type),
        duration: 6000,
      })
    })

    this.socket.on('critical_notification', (notification) => {
      toast.error(notification.title, {
        duration: 10000,
      })
    })

    // Streaming events
    this.socket.on('viewer_joined', (data) => {
      console.log('Viewer joined stream:', data)
    })

    this.socket.on('stream_reaction', (data) => {
      console.log('Stream reaction:', data)
    })

    // Error handling
    this.socket.on('error', (error) => {
      toast.error(error.message)
    })

    this.socket.on('message_rejected', (data) => {
      toast.error(`Message rejected: ${data.reason}`)
    })
  }

  private getNotificationIcon(type: string): string {
    switch (type) {
      case 'MATCH_READY':
        return '⚔️'
      case 'TOURNAMENT_START':
        return '🏆'
      case 'PRIZE_AWARDED':
        return '💰'
      case 'DISPUTE_RESOLVED':
        return '⚖️'
      default:
        return '📢'
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      toast.error('Failed to reconnect. Please refresh the page.', {
        id: 'websocket-status',
        duration: 0,
      })
      return
    }

    this.reconnectAttempts++
    
    setTimeout(() => {
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      this.connect()
    }, this.reconnectInterval * this.reconnectAttempts)
  }

  // Tournament methods
  joinTournament(tournamentId: string): void {
    this.socket?.emit('join_tournament', { tournamentId })
  }

  leaveTournament(tournamentId: string): void {
    this.socket?.emit('leave_tournament', { tournamentId })
  }

  sendTournamentMessage(tournamentId: string, message: string): void {
    this.socket?.emit('tournament_chat', { tournamentId, message })
  }

  // Match methods
  joinMatch(matchId: string): void {
    this.socket?.emit('join_match', { matchId })
  }

  leaveMatch(matchId: string): void {
    this.socket?.emit('leave_match', { matchId })
  }

  checkInToMatch(matchId: string): void {
    this.socket?.emit('match_checkin', { matchId })
  }

  sendMatchMessage(matchId: string, message: string): void {
    this.socket?.emit('match_chat', { matchId, message })
  }

  sendScoreUpdate(matchId: string, player1Score: number, player2Score: number): void {
    this.socket?.emit('score_update', {
      matchId,
      player1Score,
      player2Score,
      timestamp: new Date().toISOString()
    })
  }

  // Streaming methods
  joinStream(streamId: string): void {
    this.socket?.emit('join_stream', { streamId })
  }

  leaveStream(streamId: string): void {
    this.socket?.emit('leave_stream', { streamId })
  }

  sendStreamReaction(streamId: string, type: 'like' | 'cheer' | 'wow' | 'fire'): void {
    this.socket?.emit('stream_reaction', { streamId, type })
  }

  // Typing indicators
  startTyping(roomType: 'tournament' | 'match', roomId: string): void {
    this.socket?.emit('typing_start', { roomType, roomId })
  }

  stopTyping(roomType: 'tournament' | 'match', roomId: string): void {
    this.socket?.emit('typing_stop', { roomType, roomId })
  }

  // Presence
  updatePresence(status: 'online' | 'away' | 'busy' | 'offline'): void {
    this.socket?.emit('update_presence', { status })
  }

  // Notifications
  markNotificationRead(notificationId: string): void {
    this.socket?.emit('mark_notification_read', { notificationId })
  }

  getUnreadCount(): void {
    this.socket?.emit('get_unread_count')
  }

  // Bracket updates
  requestBracketUpdate(tournamentId: string): void {
    this.socket?.emit('request_bracket_update', { tournamentId })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export const wsService = new WebSocketService()

// Auto-connect when authenticated
useAuthStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      wsService.connect()
    } else {
      wsService.disconnect()
    }
  }
)