import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChartBarIcon,
  TrophyIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  PlayIcon,
  CalendarIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { analyticsApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const timeframeOptions = [
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 3 Months' },
  { value: 'year', label: 'Last Year' },
]

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState('month')
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'tournaments' | 'streaming'>('overview')

  const { data: globalStats, isLoading: globalLoading } = useQuery({
    queryKey: ['analytics', 'global'],
    queryFn: analyticsApi.getGlobalStats,
  })

  const { data: userAnalytics, isLoading: userLoading } = useQuery({
    queryKey: ['analytics', 'user', timeframe],
    queryFn: () => analyticsApi.getUserAnalytics(timeframe),
  })

  const { data: performanceMetrics } = useQuery({
    queryKey: ['analytics', 'performance'],
    queryFn: analyticsApi.getPerformanceMetrics,
    enabled: activeTab === 'performance',
  })

  const { data: streamingAnalytics } = useQuery({
    queryKey: ['analytics', 'streaming', timeframe],
    queryFn: () => analyticsApi.getStreamingAnalytics(timeframe),
    enabled: activeTab === 'streaming',
  })

  const formatChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true }
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.abs(change),
      isPositive: change >= 0
    }
  }

  const StatCard = ({ 
    title, 
    value, 
    previousValue, 
    icon: Icon, 
    color = 'text-gray-600 dark:text-gray-400',
    format = 'number' 
  }: any) => {
    const change = formatChange(value, previousValue)
    
    const formatValue = (val: number) => {
      switch (format) {
        case 'currency':
          return `$${val.toLocaleString()}`
        case 'percentage':
          return `${val.toFixed(1)}%`
        case 'time':
          const hours = Math.floor(val / 60)
          const minutes = val % 60
          return `${hours}h ${minutes}m`
        default:
          return val.toLocaleString()
      }
    }

    return (
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatValue(value)}
            </p>
            {previousValue !== undefined && (
              <div className="flex items-center mt-1">
                {change.isPositive ? (
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm ${
                  change.isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {change.value.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  vs previous period
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Analytics
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your performance and tournament statistics
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="input"
          >
            {timeframeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Stats (for admins/overview) */}
      {globalStats && (
        <div className="card p-6 mb-8 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Platform Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {globalStats.totalUsers?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Users
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {globalStats.activeTournaments?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Active Tournaments
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                ${globalStats.totalPrizePool?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Prize Pool
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {globalStats.liveMatches?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Live Matches
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'performance', label: 'Performance', icon: TrophyIcon },
            { id: 'tournaments', label: 'Tournaments', icon: UserGroupIcon },
            { id: 'streaming', label: 'Streaming', icon: PlayIcon },
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
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {userLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : userAnalytics ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Matches Played"
                  value={userAnalytics.matchesPlayed || 0}
                  previousValue={userAnalytics.previousMatchesPlayed}
                  icon={ChartBarIcon}
                  color="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  title="Win Rate"
                  value={userAnalytics.winRate * 100 || 0}
                  previousValue={userAnalytics.previousWinRate * 100}
                  icon={TrophyIcon}
                  color="text-green-600 dark:text-green-400"
                  format="percentage"
                />
                <StatCard
                  title="Earnings"
                  value={userAnalytics.earnings || 0}
                  previousValue={userAnalytics.previousEarnings}
                  icon={CurrencyDollarIcon}
                  color="text-yellow-600 dark:text-yellow-400"
                  format="currency"
                />
                <StatCard
                  title="Play Time"
                  value={userAnalytics.playTimeMinutes || 0}
                  previousValue={userAnalytics.previousPlayTimeMinutes}
                  icon={ClockIcon}
                  color="text-purple-600 dark:text-purple-400"
                  format="time"
                />
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Match Performance Trend
                  </h3>
                  <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <ChartBarIcon className="mx-auto h-12 w-12 mb-2" />
                      <p>Performance chart coming soon</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Tournament Participation
                  </h3>
                  <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <TrophyIcon className="mx-auto h-12 w-12 mb-2" />
                      <p>Tournament chart coming soon</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Activity
                </h3>
                {userAnalytics.recentMatches && userAnalytics.recentMatches.length > 0 ? (
                  <div className="space-y-3">
                    {userAnalytics.recentMatches.map((match: any) => (
                      <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            match.result === 'WIN' ? 'bg-green-500' :
                            match.result === 'LOSS' ? 'bg-red-500' :
                            'bg-yellow-500'
                          }`} />
                          <span className="font-medium text-gray-900 dark:text-white">
                            vs {match.opponent}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {match.score}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(match.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CalendarIcon className="mx-auto h-12 w-12 mb-2" />
                    <p>No recent matches</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No analytics data available
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Start playing matches to see your analytics.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-8">
          {performanceMetrics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                  title="Average Goals per Match"
                  value={performanceMetrics.avgGoalsPerMatch || 0}
                  icon={TrophyIcon}
                  color="text-green-600 dark:text-green-400"
                  format="number"
                />
                <StatCard
                  title="Best Win Streak"
                  value={performanceMetrics.bestWinStreak || 0}
                  icon={ArrowTrendingUpIcon}
                  color="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  title="Current Rating"
                  value={performanceMetrics.currentRating || 1200}
                  icon={ChartBarIcon}
                  color="text-purple-600 dark:text-purple-400"
                />
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Performance Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {performanceMetrics.wins || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Wins</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">
                      {performanceMetrics.losses || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Losses</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                      {performanceMetrics.draws || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Draws</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {performanceMetrics.totalGoals || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Goals</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-6">
              <div className="text-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tournaments' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Tournament Statistics
            </h3>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <TrophyIcon className="mx-auto h-12 w-12 mb-2" />
              <p>Tournament analytics coming soon</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'streaming' && (
        <div className="space-y-6">
          {streamingAnalytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Views"
                value={streamingAnalytics.totalViews || 0}
                previousValue={streamingAnalytics.previousViews}
                icon={EyeIcon}
                color="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                title="Streaming Hours"
                value={streamingAnalytics.streamingHours || 0}
                previousValue={streamingAnalytics.previousStreamingHours}
                icon={ClockIcon}
                color="text-green-600 dark:text-green-400"
              />
              <StatCard
                title="Peak Viewers"
                value={streamingAnalytics.peakViewers || 0}
                icon={UserGroupIcon}
                color="text-purple-600 dark:text-purple-400"
              />
              <StatCard
                title="Average Viewers"
                value={streamingAnalytics.avgViewers || 0}
                icon={EyeIcon}
                color="text-yellow-600 dark:text-yellow-400"
              />
            </div>
          ) : (
            <div className="card p-6">
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <PlayIcon className="mx-auto h-12 w-12 mb-2" />
                <p>Start streaming to see analytics</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}