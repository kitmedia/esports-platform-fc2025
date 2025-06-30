import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'

interface User {
  id: string
  username: string
  email: string
  displayName: string | null
  avatar: string | null
  role: string
  currentElo: number
  isVerified: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthActions {
  login: (credentials: { identifier: string; password: string }) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<void>
  checkAuth: () => void
  updateUser: (updates: Partial<User>) => void
}

interface RegisterData {
  username: string
  email: string
  password: string
  displayName?: string
  platform?: string
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (credentials) => {
        set({ isLoading: true })
        try {
          const response = await authApi.login(credentials)
          const { user, accessToken, refreshToken } = response.data
          
          set({
            user,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false
          })
          
          toast.success('Login successful!')
        } catch (error: any) {
          set({ isLoading: false })
          toast.error(error.response?.data?.message || 'Login failed')
          throw error
        }
      },

      register: async (data) => {
        set({ isLoading: true })
        try {
          const response = await authApi.register(data)
          const { user, accessToken, refreshToken } = response.data
          
          set({
            user,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false
          })
          
          toast.success('Registration successful!')
        } catch (error: any) {
          set({ isLoading: false })
          toast.error(error.response?.data?.message || 'Registration failed')
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false
        })
        toast.success('Logged out successfully')
      },

      refreshAuth: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          get().logout()
          return
        }

        try {
          const response = await authApi.refreshToken(refreshToken)
          const { accessToken, refreshToken: newRefreshToken } = response.data
          
          set({
            token: accessToken,
            refreshToken: newRefreshToken
          })
        } catch (error) {
          get().logout()
          throw error
        }
      },

      checkAuth: () => {
        set({ isLoading: true })
        
        const { token, user } = get()
        
        if (token && user) {
          set({ isAuthenticated: true, isLoading: false })
        } else {
          set({ isLoading: false })
        }
      },

      updateUser: (updates) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...updates } })
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)