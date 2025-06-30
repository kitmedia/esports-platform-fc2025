import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from './authStore'

interface SocketState {
  socket: Socket | null
  isConnected: boolean
  connectedUsers: Record<string, any>
  
  // Actions
  connect: () => void
  disconnect: () => void
  joinRoom: (room: string) => void
  leaveRoom: (room: string) => void
  emit: (event: string, data?: any) => void
  on: (event: string, callback: (data: any) => void) => void
  off: (event: string, callback?: (data: any) => void) => void
}

export const useSocketStore = create<SocketState>()(
  devtools(
    (set, get) => ({
      socket: null,
      isConnected: false,
      connectedUsers: {},

      connect: () => {
        const { socket } = get()
        if (socket?.connected) return

        const { user } = useAuthStore.getState()
        if (!user) return

        const newSocket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
          auth: {
            userId: user.id,
            username: user.username
          },
          transports: ['websocket', 'polling']
        })

        newSocket.on('connect', () => {
          console.log('Socket connected:', newSocket.id)
          set({ isConnected: true })
        })

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected')
          set({ isConnected: false, connectedUsers: {} })
        })

        newSocket.on('user_connected', (userData) => {
          set((state) => ({
            connectedUsers: {
              ...state.connectedUsers,
              [userData.id]: userData
            }
          }))
        })

        newSocket.on('user_disconnected', (userId) => {
          set((state) => {
            const { [userId]: removed, ...rest } = state.connectedUsers
            return { connectedUsers: rest }
          })
        })

        newSocket.on('users_list', (users) => {
          const usersMap = users.reduce((acc: Record<string, any>, user: any) => {
            acc[user.id] = user
            return acc
          }, {})
          set({ connectedUsers: usersMap })
        })

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error)
          set({ isConnected: false })
        })

        set({ socket: newSocket })
      },

      disconnect: () => {
        const { socket } = get()
        if (socket) {
          socket.disconnect()
          set({ socket: null, isConnected: false, connectedUsers: {} })
        }
      },

      joinRoom: (room: string) => {
        const { socket } = get()
        if (socket?.connected) {
          socket.emit('join_room', room)
        }
      },

      leaveRoom: (room: string) => {
        const { socket } = get()
        if (socket?.connected) {
          socket.emit('leave_room', room)
        }
      },

      emit: (event: string, data?: any) => {
        const { socket } = get()
        if (socket?.connected) {
          socket.emit(event, data)
        }
      },

      on: (event: string, callback: (data: any) => void) => {
        const { socket } = get()
        if (socket) {
          socket.on(event, callback)
        }
      },

      off: (event: string, callback?: (data: any) => void) => {
        const { socket } = get()
        if (socket) {
          if (callback) {
            socket.off(event, callback)
          } else {
            socket.off(event)
          }
        }
      }
    }),
    {
      name: 'socket-store'
    }
  )
)