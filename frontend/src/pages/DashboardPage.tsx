import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  TrophyIcon,
  ChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  FireIcon
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { tournamentApi, userApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['user', 'stats'],
    queryFn: () => userApi.getStats(),
    enabled: !!user,
  })

  const { data: myTournaments, isLoading: tournamentsLoading } = useQuery({
    queryKey: ['tournaments', 'my'],
    queryFn: () => tournamentApi.getMyTournaments(),
    enabled: !!user,
  })

  const { data: recentMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ['matches', 'recent'],
    queryFn: () => userApi.getRecentMatches(),
    enabled: !!user,
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const stats = [
    {
      name: 'Tournaments Played',
      value: userStats?.tournamentsPlayed || 0,
      icon: TrophyIcon,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      name: 'Matches Won',
      value: userStats?.matchesWon || 0,
      icon: ArrowTrendingUpIcon,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      name: 'Total Earnings',
      value: `$${userStats?.totalEarnings || 0}`,
      icon: CurrencyDollarIcon,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    },
    {
      name: 'Current Rating',
      value: userStats?.rating || 1200,
      icon: FireIcon,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.displayName || user?.username}!
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Here's your tournament activity and performance overview
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="card p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.name}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Tournaments */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              My Tournaments
            </h2>
            <Link
              to="/tournaments/create"
              className="btn-primary text-sm"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Create
            </Link>
          </div>

          {tournamentsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : myTournaments && myTournaments.length > 0 ? (
            <div className="space-y-4">
              {myTournaments.slice(0, 5).map((tournament: any) => (
                <Link
                  key={tournament.id}
                  to={`/tournaments/${tournament.id}`}
                  className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {tournament.name}
                      </h3>
                      <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        {tournament._count?.participants || 0}/{tournament.maxParticipants}
                        {tournament.prizePool > 0 && (
                          <>
                            <TrophyIcon className="h-4 w-4 ml-3 mr-1" />
                            ${tournament.prizePool}
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`badge ${
                      tournament.status === 'REGISTRATION_OPEN' ? 'badge-success' :
                      tournament.status === 'LIVE' ? 'badge-danger' :
                      tournament.status === 'UPCOMING' ? 'badge-warning' :
                      'badge-secondary'
                    }`}>
                      {tournament.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
              
              {myTournaments.length > 5 && (
                <Link
                  to="/profile/tournaments"
                  className="block text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 py-2"
                >
                  View all {myTournaments.length} tournaments →
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <TrophyIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                No tournaments yet
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Join or create your first tournament to get started.
              </p>
              <div className="mt-4 flex justify-center space-x-3">
                <Link to="/tournaments" className="btn-outline text-sm">
                  Browse Tournaments
                </Link>
                <Link to="/tournaments/create" className="btn-primary text-sm">
                  Create Tournament
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Recent Matches */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Recent Matches
            </h2>
            <Link
              to="/profile/matches"
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500"
            >
              View all →
            </Link>
          </div>

          {matchesLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : recentMatches && recentMatches.length > 0 ? (
            <div className="space-y-4">
              {recentMatches.slice(0, 5).map((match: any) => (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          vs {match.opponent?.displayName || match.opponent?.username}
                        </span>
                        <span className={`badge text-xs ${
                          match.result === 'WIN' ? 'badge-success' :
                          match.result === 'LOSS' ? 'badge-danger' :
                          'badge-warning'
                        }`}>
                          {match.result}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {formatDate(match.scheduledTime)}
                        <ChartBarIcon className="h-4 w-4 ml-3 mr-1" />
                        {match.playerScore}-{match.opponentScore}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                No matches yet
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Your match history will appear here once you start playing.
              </p>
              <div className="mt-4">
                <Link to="/tournaments" className="btn-primary text-sm">
                  Find Tournaments
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/tournaments"
            className="card p-6 text-center hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            <TrophyIcon className="mx-auto h-8 w-8 text-primary-600 dark:text-primary-400" />
            <h3 className="mt-2 font-medium text-gray-900 dark:text-white">
              Browse Tournaments
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Find and join tournaments
            </p>
          </Link>

          <Link
            to="/tournaments/create"
            className="card p-6 text-center hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            <PlusIcon className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" />
            <h3 className="mt-2 font-medium text-gray-900 dark:text-white">
              Create Tournament
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Host your own tournament
            </p>
          </Link>

          <Link
            to="/leaderboard"
            className="card p-6 text-center hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            <ChartBarIcon className="mx-auto h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h3 className="mt-2 font-medium text-gray-900 dark:text-white">
              Leaderboard
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Check global rankings
            </p>
          </Link>

          <Link
            to="/profile"
            className="card p-6 text-center hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            <UserGroupIcon className="mx-auto h-8 w-8 text-purple-600 dark:text-purple-400" />
            <h3 className="mt-2 font-medium text-gray-900 dark:text-white">
              My Profile
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and edit profile
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}