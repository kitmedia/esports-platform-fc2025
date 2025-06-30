import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  TrophyIcon,
  ChartBarIcon,
  UserIcon,
  FireIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FunnelIcon,
  GlobeAltIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { userApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const timeframeOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: 'year', label: 'This Year' },
]

const categoryOptions = [
  { value: 'rating', label: 'Rating' },
  { value: 'tournaments_won', label: 'Tournaments Won' },
  { value: 'earnings', label: 'Total Earnings' },
  { value: 'matches_won', label: 'Matches Won' },
  { value: 'win_rate', label: 'Win Rate' },
]

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState('all')
  const [category, setCategory] = useState('rating')
  const [region, setRegion] = useState('global')
  
  const { user } = useAuthStore()

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard', { timeframe, category, region }],
    queryFn: () => userApi.getLeaderboard({ timeframe, category, region, limit: 100 }),
  })

  const { data: userRank } = useQuery({
    queryKey: ['user', 'rank', { timeframe, category, region }],
    queryFn: () => userApi.getLeaderboard({ 
      timeframe, 
      category, 
      region, 
      userId: user?.id 
    }),
    enabled: !!user,
  })

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-600 dark:text-yellow-400'
    if (rank === 2) return 'text-gray-500 dark:text-gray-400'
    if (rank === 3) return 'text-amber-600 dark:text-amber-400'
    return 'text-gray-700 dark:text-gray-300'
  }

  const formatValue = (value: number, category: string) => {
    switch (category) {
      case 'earnings':
        return `$${value.toLocaleString()}`
      case 'win_rate':
        return `${(value * 100).toFixed(1)}%`
      case 'rating':
        return value.toLocaleString()
      default:
        return value.toLocaleString()
    }
  }

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
    if (change < 0) return <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Leaderboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          See how you rank against the best FIFA players worldwide
        </p>
      </div>

      {/* Filters */}
      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Filters
          </h2>
          <FunnelIcon className="w-5 h-5 text-gray-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="input w-full"
            >
              {timeframeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="input w-full"
            >
              <option value="global">🌍 Global</option>
              <option value="north_america">🇺🇸 North America</option>
              <option value="europe">🇪🇺 Europe</option>
              <option value="asia">🌏 Asia</option>
              <option value="south_america">🇧🇷 South America</option>
              <option value="oceania">🇦🇺 Oceania</option>
              <option value="africa">🌍 Africa</option>
            </select>
          </div>
        </div>
      </div>

      {/* User Rank Card */}
      {user && userRank && (
        <div className="card p-6 mb-8 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-800 rounded-full flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Your avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Your Rank
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {user.displayName || user.username}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {getRankBadge(userRank.rank)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatValue(userRank.value, category)}
              </div>
              {userRank.change !== 0 && (
                <div className="flex items-center justify-end mt-1">
                  {getChangeIcon(userRank.change)}
                  <span className={`text-sm ml-1 ${
                    userRank.change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(userRank.change)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Players
            </h2>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <GlobeAltIcon className="w-4 h-4 mr-1" />
              {categoryOptions.find(c => c.value === category)?.label} • {timeframe}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {leaderboard.map((player: any, index: number) => (
              <div
                key={player.id}
                className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  player.id === user?.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`text-2xl font-bold ${getRankColor(index + 1)}`}>
                      {getRankBadge(index + 1)}
                    </div>
                    
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt={player.displayName || player.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    <div>
                      <Link
                        to={`/users/${player.id}`}
                        className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {player.displayName || player.username}
                      </Link>
                      <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        <span>{player.country}</span>
                        {player.platform && (
                          <span className="badge-secondary text-xs">
                            {player.platform}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatValue(player.value, category)}
                    </div>
                    
                    <div className="flex items-center justify-end space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      {player.tournamentStats && (
                        <div className="flex items-center">
                          <TrophyIcon className="w-4 h-4 mr-1" />
                          {player.tournamentStats.won}W
                        </div>
                      )}
                      
                      {player.matchStats && (
                        <div className="flex items-center">
                          <ChartBarIcon className="w-4 h-4 mr-1" />
                          {(player.matchStats.winRate * 100).toFixed(0)}%
                        </div>
                      )}

                      {player.change !== 0 && (
                        <div className="flex items-center">
                          {getChangeIcon(player.change)}
                          <span className={`ml-1 ${
                            player.change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {Math.abs(player.change)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              No data available
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Leaderboard data will appear here once players start competing.
            </p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="card p-6 text-center">
          <TrophyIcon className="mx-auto h-8 w-8 text-yellow-600 dark:text-yellow-400 mb-3" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {leaderboard?.length || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Ranked Players
          </div>
        </div>

        <div className="card p-6 text-center">
          <FireIcon className="mx-auto h-8 w-8 text-red-600 dark:text-red-400 mb-3" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {leaderboard?.[0]?.value ? formatValue(leaderboard[0].value, category) : '—'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Top Score
          </div>
        </div>

        <div className="card p-6 text-center">
          <CalendarIcon className="mx-auto h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            Daily
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Updates
          </div>
        </div>
      </div>
    </div>
  )
}