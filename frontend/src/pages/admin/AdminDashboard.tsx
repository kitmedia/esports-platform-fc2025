import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  UsersIcon,
  TrophyIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  EyeIcon,
  ClockIcon,
  ShieldCheckIcon,
  BellIcon,
  CogIcon
} from '@heroicons/react/24/outline'
import { adminApi, analyticsApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function AdminDashboard() {
  const [timeframe, setTimeframe] = useState('week')

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.getDashboard,
  })

  const { data: globalStats } = useQuery({
    queryKey: ['analytics', 'global'],
    queryFn: analyticsApi.getGlobalStats,
  })

  const { data: recentReports } = useQuery({
    queryKey: ['admin', 'reports', 'recent'],
    queryFn: () => adminApi.getReports({ limit: 5 }),
  })

  const StatCard = ({ title, value, change, icon: Icon, color, href }: any) => (
    <Link to={href} className="card p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {change && (
            <p className={`text-sm ${
              change > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {change > 0 ? '+' : ''}{change}% from last period
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Link>
  )

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor platform activity and manage the community
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="input"
          >
            <option value="day">Last 24 hours</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 3 months</option>
          </select>
          <Link to="/admin/settings" className="btn-outline">
            <CogIcon className="w-4 h-4 mr-2" />
            Settings
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={dashboardData?.totalUsers?.toLocaleString() || '0'}
          change={dashboardData?.userGrowth}
          icon={UsersIcon}
          color="bg-blue-600"
          href="/admin/users"
        />
        <StatCard
          title="Active Tournaments"
          value={dashboardData?.activeTournaments?.toLocaleString() || '0'}
          change={dashboardData?.tournamentGrowth}
          icon={TrophyIcon}
          color="bg-green-600"
          href="/admin/tournaments"
        />
        <StatCard
          title="Total Revenue"
          value={`$${dashboardData?.totalRevenue?.toLocaleString() || '0'}`}
          change={dashboardData?.revenueGrowth}
          icon={CurrencyDollarIcon}
          color="bg-yellow-600"
          href="/admin/payments"
        />
        <StatCard
          title="Pending Reports"
          value={dashboardData?.pendingReports?.toLocaleString() || '0'}
          icon={ExclamationTriangleIcon}
          color="bg-red-600"
          href="/admin/reports"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            User Growth
          </h3>
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <ChartBarIcon className="mx-auto h-12 w-12 mb-2" />
              <p>User growth chart coming soon</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tournament Activity
          </h3>
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <TrophyIcon className="mx-auto h-12 w-12 mb-2" />
              <p>Tournament activity chart coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Link
          to="/admin/users/new"
          className="card p-6 text-center hover:shadow-lg transition-shadow"
        >
          <UsersIcon className="mx-auto h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Create Admin User
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add new admin or moderator
          </p>
        </Link>

        <Link
          to="/admin/tournaments/featured"
          className="card p-6 text-center hover:shadow-lg transition-shadow"
        >
          <TrophyIcon className="mx-auto h-8 w-8 text-green-600 dark:text-green-400 mb-3" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Feature Tournament
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Promote tournament on homepage
          </p>
        </Link>

        <Link
          to="/admin/announcements/new"
          className="card p-6 text-center hover:shadow-lg transition-shadow"
        >
          <BellIcon className="mx-auto h-8 w-8 text-purple-600 dark:text-purple-400 mb-3" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            Send Announcement
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Broadcast message to users
          </p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Reports
            </h3>
            <Link 
              to="/admin/reports" 
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500"
            >
              View all →
            </Link>
          </div>

          {recentReports && recentReports.length > 0 ? (
            <div className="space-y-4">
              {recentReports.map((report: any) => (
                <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      report.priority === 'high' ? 'bg-red-500' :
                      report.priority === 'medium' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {report.type}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        by {report.reporterName} • {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/admin/reports/${report.id}`}
                    className="btn-outline text-sm"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <ShieldCheckIcon className="mx-auto h-12 w-12 mb-2" />
              <p>No recent reports</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Status
            </h3>
            <div className="flex items-center text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              All systems operational
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">API Status</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Healthy</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Database</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">WebSocket</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Payment Gateway</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Processing</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Streaming Service</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Online</span>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last Updated</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Statistics */}
      {globalStats && (
        <div className="mt-8">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Platform Statistics
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {globalStats.totalUsers?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Registered Users
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {globalStats.activeTournaments?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Active Tournaments
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {globalStats.totalMatches?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Matches Played
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  ${globalStats.totalPrizePool?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Prize Pool
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {globalStats.onlineUsers?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Online Now
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {globalStats.liveMatches?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Live Matches
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}