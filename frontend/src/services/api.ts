import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Create axios instance
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        await useAuthStore.getState().refreshAuth()
        const newToken = useAuthStore.getState().token
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        useAuthStore.getState().logout()
        window.location.href = '/auth/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (credentials: { identifier: string; password: string }) =>
    api.post('/auth/login', credentials),

  register: (data: {
    username: string
    email: string
    password: string
    displayName?: string
    platform?: string
  }) => api.post('/auth/register', data),

  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get('/auth/me'),

  updateProfile: (data: any) => api.put('/auth/profile'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
}

// Tournament API
export const tournamentApi = {
  getTournaments: (params?: any) => api.get('/tournaments', { params }),

  getTournament: (id: string) => api.get(`/tournaments/${id}`),

  createTournament: (data: any) => api.post('/tournaments', data),

  updateTournament: (id: string, data: any) => api.put(`/tournaments/${id}`, data),

  deleteTournament: (id: string) => api.delete(`/tournaments/${id}`),

  joinTournament: (id: string, data?: any) =>
    api.post(`/tournaments/${id}/join`, data),

  leaveTournament: (id: string) =>
    api.delete(`/tournaments/${id}/join`),

  registerForTournament: (id: string, data?: any) =>
    api.post(`/tournaments/${id}/register`, data),

  unregisterFromTournament: (id: string) =>
    api.delete(`/tournaments/${id}/register`),

  generateBrackets: (id: string, data: any) =>
    api.post(`/tournaments/${id}/brackets`, data),

  getTournamentBracket: (id: string) => api.get(`/tournaments/${id}/bracket`),

  getTournamentParticipants: (id: string) => api.get(`/tournaments/${id}/participants`),

  getTournamentStats: (id: string) => api.get(`/tournaments/${id}/stats`),

  getMyTournaments: () => api.get('/tournaments/my'),

  getAISuggestions: (data: any) => api.post('/tournaments/ai/suggestions', data),

  approveTournament: (id: string) => api.post(`/tournaments/${id}/approve`),

  rejectTournament: (id: string, reason: string) => 
    api.post(`/tournaments/${id}/reject`, { reason }),
}

// Match API
export const matchApi = {
  getMatches: (params?: any) => api.get('/matches', { params }),

  getMatch: (id: string) => api.get(`/matches/${id}`),

  submitResult: (id: string, data: any) => api.post(`/matches/${id}/result`, data),

  submitResultWithScreenshot: (id: string, formData: FormData) =>
    api.post(`/matches/${id}/result/screenshot`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  reportDispute: (id: string, data: any) => api.post(`/matches/${id}/dispute`, data),

  reportIssue: (id: string, data: any) => api.post(`/matches/${id}/issue`, data),

  startMatch: (id: string) => api.post(`/matches/${id}/start`),

  endMatch: (id: string) => api.post(`/matches/${id}/end`),

  forfeitMatch: (id: string) => api.post(`/matches/${id}/forfeit`),

  checkIn: (id: string) => api.post(`/matches/${id}/checkin`),

  getMatchHistory: (userId: string, params?: any) => 
    api.get(`/matches/history/${userId}`, { params }),

  validateResult: (id: string, screenshot?: File) => {
    const formData = new FormData()
    if (screenshot) formData.append('screenshot', screenshot)
    return api.post(`/matches/${id}/validate`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// AI API
export const aiApi = {
  getStatus: () => api.get('/ai/status'),

  suggestTournamentFormat: (data: any) => api.post('/ai/tournament/suggest', data),

  generateEventDescription: (data: any) => api.post('/ai/tournament/description', data),

  translateText: (data: { text: string; targetLanguage: string }) =>
    api.post('/ai/translate', data),

  validateResult: (formData: FormData) =>
    api.post('/ai/validate/result', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  moderateContent: (data: { content: string }) => api.post('/ai/moderate', data),

  predictMatch: (data: any) => api.post('/ai/predict/match', data),
}

// User API
export const userApi = {
  getUsers: (params?: any) => api.get('/users', { params }),

  getUser: (id: string) => api.get(`/users/${id}`),

  getProfile: () => api.get('/users/profile'),

  updateProfile: (data: any) => api.patch('/users/profile', data),

  getStats: () => api.get('/users/stats'),

  getUserStats: (id: string) => api.get(`/users/${id}/stats`),

  getRecentMatches: () => api.get('/users/matches/recent'),

  getUserTournaments: (id: string, params?: any) =>
    api.get(`/users/${id}/tournaments`, { params }),

  getUserMatches: (id: string, params?: any) =>
    api.get(`/users/${id}/matches`, { params }),

  getLeaderboard: (params?: any) => api.get('/users/leaderboard', { params }),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  getNotifications: () => api.get('/users/notifications'),

  markNotificationRead: (id: string) => api.patch(`/users/notifications/${id}/read`),

  markAllNotificationsRead: () => api.post('/users/notifications/read-all'),

  getAchievements: () => api.get('/users/achievements'),

  getTournamentHistory: (params?: any) => api.get('/users/tournaments', { params }),

  getMatchHistory: (params?: any) => api.get('/users/matches', { params }),

  updateSettings: (data: any) => api.patch('/users/settings', data),

  getSettings: () => api.get('/users/settings'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/users/change-password', data),

  deleteAccount: () => api.delete('/users/account'),

  reportUser: (userId: string, data: { reason: string; description: string }) =>
    api.post(`/users/${userId}/report`, data),

  blockUser: (userId: string) => api.post(`/users/${userId}/block`),

  unblockUser: (userId: string) => api.delete(`/users/${userId}/block`),

  getBlockedUsers: () => api.get('/users/blocked'),

  followUser: (userId: string) => api.post(`/users/${userId}/follow`),

  unfollowUser: (userId: string) => api.delete(`/users/${userId}/follow`),

  getFollowers: (userId?: string) => api.get(`/users/${userId || 'me'}/followers`),

  getFollowing: (userId?: string) => api.get(`/users/${userId || 'me'}/following`),
}

// Streaming API
export const streamingApi = {
  getStatus: () => api.get('/streaming/status'),

  createStream: (data: any) => api.post('/streaming/create', data),

  getStream: (id: string) => api.get(`/streaming/${id}`),

  updateStreamConfig: (id: string, data: any) => api.put(`/streaming/${id}/config`, data),

  startStream: (id: string) => api.post(`/streaming/${id}/start`),

  stopStream: (id: string) => api.post(`/streaming/${id}/stop`),

  createClip: (data: any) => api.post('/streaming/clip', data),

  getStreamClips: (id: string, params?: any) =>
    api.get(`/streaming/${id}/clips`, { params }),

  detectHighlights: (id: string) => api.post(`/streaming/${id}/highlights/detect`),

  getLiveStreams: (params?: any) => api.get('/streaming/live/all', { params }),
}

// Payment API
export const paymentApi = {
  getStatus: () => api.get('/payments/status'),

  createTournamentPayment: (data: any) => api.post('/payments/tournament/entry', data),

  createSubscription: (data: any) => api.post('/payments/subscription', data),

  getMyPayments: () => api.get('/payments/my-payments'),

  getPayment: (id: string) => api.get(`/payments/${id}`),

  getPlans: () => api.get('/payments/plans'),

  cancelSubscription: (subscriptionId: string) => 
    api.post(`/payments/subscription/${subscriptionId}/cancel`),

  requestRefund: (paymentId: string, reason: string) =>
    api.post(`/payments/${paymentId}/refund`, { reason }),

  getPaymentMethods: () => api.get('/payments/methods'),

  addPaymentMethod: (data: any) => api.post('/payments/methods', data),

  removePaymentMethod: (methodId: string) => api.delete(`/payments/methods/${methodId}`),

  getEarnings: () => api.get('/payments/earnings'),

  requestPayout: (data: any) => api.post('/payments/payout', data),

  getPayoutHistory: () => api.get('/payments/payouts'),
}

// Chat API
export const chatApi = {
  getTournamentMessages: (tournamentId: string, params?: any) =>
    api.get(`/chat/tournament/${tournamentId}`, { params }),

  sendTournamentMessage: (tournamentId: string, message: string) =>
    api.post(`/chat/tournament/${tournamentId}`, { message }),

  getMatchMessages: (matchId: string, params?: any) =>
    api.get(`/chat/match/${matchId}`, { params }),

  sendMatchMessage: (matchId: string, message: string) =>
    api.post(`/chat/match/${matchId}`, { message }),

  getDirectMessages: (userId: string, params?: any) =>
    api.get(`/chat/direct/${userId}`, { params }),

  sendDirectMessage: (userId: string, message: string) =>
    api.post(`/chat/direct/${userId}`, { message }),

  deleteMessage: (messageId: string) => api.delete(`/chat/messages/${messageId}`),

  reportMessage: (messageId: string, reason: string) =>
    api.post(`/chat/messages/${messageId}/report`, { reason }),
}

// Analytics API
export const analyticsApi = {
  getGlobalStats: () => api.get('/analytics/global'),

  getUserAnalytics: (timeframe: string) => 
    api.get('/analytics/user', { params: { timeframe } }),

  getTournamentAnalytics: (tournamentId: string) =>
    api.get(`/analytics/tournament/${tournamentId}`),

  getMatchAnalytics: (matchId: string) =>
    api.get(`/analytics/match/${matchId}`),

  getStreamingAnalytics: (timeframe: string) =>
    api.get('/analytics/streaming', { params: { timeframe } }),

  getPerformanceMetrics: () => api.get('/analytics/performance'),

  getEngagementMetrics: () => api.get('/analytics/engagement'),
}

// Admin API
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),

  getUsers: (params?: any) => api.get('/admin/users', { params }),

  banUser: (userId: string, reason: string, duration?: number) =>
    api.post(`/admin/users/${userId}/ban`, { reason, duration }),

  unbanUser: (userId: string) => api.delete(`/admin/users/${userId}/ban`),

  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),

  getTournaments: (params?: any) => api.get('/admin/tournaments', { params }),

  moderateTournament: (tournamentId: string, action: string, reason?: string) =>
    api.post(`/admin/tournaments/${tournamentId}/moderate`, { action, reason }),

  getReports: (params?: any) => api.get('/admin/reports', { params }),

  handleReport: (reportId: string, action: string, notes?: string) =>
    api.post(`/admin/reports/${reportId}/handle`, { action, notes }),

  getPayments: (params?: any) => api.get('/admin/payments', { params }),

  processRefund: (paymentId: string, amount: number, reason: string) =>
    api.post(`/admin/payments/${paymentId}/refund`, { amount, reason }),

  getSystemLogs: (params?: any) => api.get('/admin/logs', { params }),

  updateSystemSettings: (settings: any) => api.put('/admin/settings', settings),

  getSystemSettings: () => api.get('/admin/settings'),
}

export default api