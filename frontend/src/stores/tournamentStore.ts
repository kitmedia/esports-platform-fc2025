import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { api } from '@/services/api'
import { Tournament, TournamentParticipant, Match } from '@/types'

interface TournamentState {
  tournaments: Tournament[]
  currentTournament: Tournament | null
  participants: TournamentParticipant[]
  matches: Match[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchTournaments: () => Promise<void>
  fetchTournament: (id: string) => Promise<void>
  createTournament: (data: any) => Promise<Tournament>
  updateTournament: (id: string, data: any) => Promise<Tournament>
  deleteTournament: (id: string) => Promise<void>
  joinTournament: (id: string) => Promise<void>
  leaveTournament: (id: string) => Promise<void>
  fetchParticipants: (tournamentId: string) => Promise<void>
  fetchMatches: (tournamentId: string) => Promise<void>
  setCurrentTournament: (tournament: Tournament | null) => void
  clearError: () => void
}

export const useTournamentStore = create<TournamentState>()(
  devtools(
    (set, get) => ({
      tournaments: [],
      currentTournament: null,
      participants: [],
      matches: [],
      isLoading: false,
      error: null,

      fetchTournaments: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.tournaments.getAll()
          set({ tournaments: response.tournaments, isLoading: false })
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      fetchTournament: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
          const tournament = await api.tournaments.getById(id)
          set({ currentTournament: tournament, isLoading: false })
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      createTournament: async (data: any) => {
        set({ isLoading: true, error: null })
        try {
          const tournament = await api.tournaments.create(data)
          set((state) => ({
            tournaments: [...state.tournaments, tournament],
            isLoading: false
          }))
          return tournament
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      updateTournament: async (id: string, data: any) => {
        set({ isLoading: true, error: null })
        try {
          const tournament = await api.tournaments.update(id, data)
          set((state) => ({
            tournaments: state.tournaments.map(t => 
              t.id === id ? tournament : t
            ),
            currentTournament: state.currentTournament?.id === id ? tournament : state.currentTournament,
            isLoading: false
          }))
          return tournament
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      deleteTournament: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
          await api.tournaments.delete(id)
          set((state) => ({
            tournaments: state.tournaments.filter(t => t.id !== id),
            currentTournament: state.currentTournament?.id === id ? null : state.currentTournament,
            isLoading: false
          }))
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      joinTournament: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
          await api.tournaments.join(id)
          // Refresh tournament data
          await get().fetchTournament(id)
          await get().fetchParticipants(id)
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      leaveTournament: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
          await api.tournaments.leave(id)
          // Refresh tournament data
          await get().fetchTournament(id)
          await get().fetchParticipants(id)
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      fetchParticipants: async (tournamentId: string) => {
        try {
          const participants = await api.tournaments.getParticipants(tournamentId)
          set({ participants })
        } catch (error: any) {
          set({ error: error.message })
        }
      },

      fetchMatches: async (tournamentId: string) => {
        try {
          const matches = await api.tournaments.getMatches(tournamentId)
          set({ matches })
        } catch (error: any) {
          set({ error: error.message })
        }
      },

      setCurrentTournament: (tournament: Tournament | null) => {
        set({ currentTournament: tournament })
      },

      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'tournament-store'
    }
  )
)