import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrophyIcon,
  UserGroupIcon,
  CalendarIcon,
  ChartBarIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  ClockIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import { tournamentApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<'overview' | 'bracket' | 'participants' | 'chat'>('overview')
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: tournament, isLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => tournamentApi.getTournament(id!),
    enabled: !!id,
  })

  const { data: bracket } = useQuery({
    queryKey: ['tournament', id, 'bracket'],
    queryFn: () => tournamentApi.getTournamentBracket(id!),
    enabled: !!id && activeTab === 'bracket',
  })

  const { data: participants } = useQuery({
    queryKey: ['tournament', id, 'participants'],
    queryFn: () => tournamentApi.getTournamentParticipants(id!),
    enabled: !!id && activeTab === 'participants',
  })

  const joinMutation = useMutation({
    mutationFn: () => tournamentApi.joinTournament(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => tournamentApi.leaveTournament(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
    },
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REGISTRATION_OPEN':
        return 'badge-success'
      case 'LIVE':
        return 'badge-danger'
      case 'UPCOMING':
        return 'badge-warning'
      case 'COMPLETED':
        return 'badge-secondary'
      default:
        return 'badge-primary'
    }
  }

  const isParticipant = tournament?.participants?.some((p: any) => p.userId === user?.id)
  const canJoin = tournament?.status === 'REGISTRATION_OPEN' && 
                  tournament.participants?.length < tournament.maxParticipants &&
                  !isParticipant

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tournament not found
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            The tournament you're looking for doesn't exist or has been removed.
          </p>
          <Link to="/tournaments" className="btn-primary mt-4">
            Browse Tournaments
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tournament Header */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-4">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {tournament.name}
              </h1>
              <span className={`badge ${getStatusColor(tournament.status)}`}>
                {tournament.status.replace('_', ' ')}
              </span>
            </div>

            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
              {tournament.description}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <UserGroupIcon className="h-5 w-5 mr-2" />
                <span className="text-sm">
                  {tournament.participants?.length || 0}/{tournament.maxParticipants} players
                </span>
              </div>

              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <ChartBarIcon className="h-5 w-5 mr-2" />
                <span className="text-sm">{tournament.format.replace('_', ' ')}</span>
              </div>

              {tournament.prizePool > 0 && (
                <div className="flex items-center text-success-600 dark:text-success-400">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">${tournament.prizePool}</span>
                </div>
              )}

              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <CalendarIcon className="h-5 w-5 mr-2" />
                <span className="text-sm">
                  {new Date(tournament.startDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 lg:mt-0 lg:ml-6 flex flex-col space-y-3">
            {user ? (
              <>
                {canJoin && (
                  <button
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="btn-primary"
                  >
                    {joinMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-5 w-5 mr-2" />
                        Join Tournament
                      </>
                    )}
                  </button>
                )}

                {isParticipant && tournament.status === 'REGISTRATION_OPEN' && (
                  <button
                    onClick={() => leaveMutation.mutate()}
                    disabled={leaveMutation.isPending}
                    className="btn-outline border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {leaveMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Leaving...
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="h-5 w-5 mr-2" />
                        Leave Tournament
                      </>
                    )}
                  </button>
                )}

                {isParticipant && tournament.status === 'LIVE' && (
                  <Link to={`/tournaments/${id}/match`} className="btn-primary">
                    <PlayIcon className="h-5 w-5 mr-2" />
                    Enter Match
                  </Link>
                )}
              </>
            ) : (
              <Link to="/auth/login" className="btn-primary">
                Login to Join
              </Link>
            )}

            <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Organized by {tournament.organizer?.displayName || tournament.organizer?.username}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: TrophyIcon },
            { id: 'bracket', label: 'Bracket', icon: ChartBarIcon },
            { id: 'participants', label: 'Participants', icon: UserGroupIcon },
            { id: 'chat', label: 'Chat', icon: ChatBubbleLeftRightIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Tournament Details */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Tournament Details
              </h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Format</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">{tournament.format.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Registration Deadline</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">{formatDate(tournament.registrationEndDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">{formatDate(tournament.startDate)}</dd>
                </div>
                {tournament.skillLevel && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Skill Level</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{tournament.skillLevel}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Streaming</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {tournament.streamingRequired ? 'Required' : 'Optional'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Rules */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Rules & Information
              </h3>
              <div className="prose prose-sm dark:prose-invert">
                {tournament.rules ? (
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {tournament.rules}
                  </p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    Standard tournament rules apply. Good luck and have fun!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bracket' && (
          <div className="card p-6">
            {tournament.status === 'REGISTRATION_OPEN' ? (
              <div className="text-center py-12">
                <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Bracket not generated yet
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  The tournament bracket will be available once registration closes.
                </p>
              </div>
            ) : bracket ? (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tournament Bracket
                </h3>
                {/* Bracket visualization would go here */}
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Interactive bracket visualization coming soon...
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            )}
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Participants ({tournament.participants?.length || 0})
              </h3>
            </div>

            {participants ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {participants.map((participant: any) => (
                  <div key={participant.id} className="flex items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {participant.user.displayName || participant.user.username}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Joined {new Date(participant.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {participant.user.rating && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Rating: {participant.user.rating}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="card p-6">
            <div className="text-center py-12">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                Tournament Chat
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Real-time chat feature coming soon...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}