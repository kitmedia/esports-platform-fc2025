import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  FunnelIcon, 
  MagnifyingGlassIcon, 
  TrophyIcon, 
  UserGroupIcon,
  CalendarIcon,
  PlusIcon 
} from '@heroicons/react/24/outline'
import { tournamentApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const formatOptions = [
  { value: '', label: 'All Formats' },
  { value: 'SINGLE_ELIMINATION', label: 'Single Elimination' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'SWISS', label: 'Swiss' },
]

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'REGISTRATION_OPEN', label: 'Registration Open' },
  { value: 'LIVE', label: 'Live' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'COMPLETED', label: 'Completed' },
]

export default function TournamentsPage() {
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState('')
  const [status, setStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  const { user } = useAuthStore()

  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments', { search, format, status }],
    queryFn: () => tournamentApi.getTournaments({ 
      search: search || undefined,
      format: format || undefined,
      status: status || undefined,
      limit: 20
    }),
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Tournaments
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Discover and join FIFA tournaments from around the world
          </p>
        </div>
        
        {user && (
          <Link
            to="/tournaments/create"
            className="btn-primary mt-4 sm:mt-0"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Tournament
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tournaments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center"
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            Filters
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="input w-full"
                >
                  {formatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input w-full"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tournament Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments?.data?.map((tournament: any) => (
            <Link
              key={tournament.id}
              to={`/tournaments/${tournament.id}`}
              className="card p-6 hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              {/* Tournament Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">
                    {tournament.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    by {tournament.organizer?.displayName || tournament.organizer?.username}
                  </p>
                </div>
                <span className="badge-primary">
                  {tournament.format.replace('_', ' ')}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {tournament.description}
              </p>

              {/* Tournament Stats */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-gray-500 dark:text-gray-400">
                    <UserGroupIcon className="h-4 w-4 mr-1" />
                    <span>{tournament._count?.participants || 0}/{tournament.maxParticipants} players</span>
                  </div>
                  {tournament.prizePool > 0 && (
                    <div className="flex items-center text-success-600 dark:text-success-400 font-medium">
                      <TrophyIcon className="h-4 w-4 mr-1" />
                      <span>${tournament.prizePool}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  <span>
                    {tournament.status === 'UPCOMING' 
                      ? `Starts ${formatDate(tournament.startDate)}`
                      : tournament.status === 'REGISTRATION_OPEN'
                      ? `Registration closes ${formatDate(tournament.registrationEndDate)}`
                      : tournament.status === 'LIVE'
                      ? 'Live now'
                      : 'Completed'
                    }
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span className={`badge ${
                  tournament.status === 'REGISTRATION_OPEN' ? 'badge-success' :
                  tournament.status === 'LIVE' ? 'badge-danger' :
                  tournament.status === 'UPCOMING' ? 'badge-warning' :
                  'badge-secondary'
                }`}>
                  {tournament.status.replace('_', ' ')}
                </span>

                {tournament.status === 'REGISTRATION_OPEN' && (
                  <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    Join now →
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!tournaments?.data || tournaments.data.length === 0) && (
        <div className="text-center py-12">
          <TrophyIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            No tournaments found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {search || format || status 
              ? 'Try adjusting your search or filters'
              : 'Get started by creating a new tournament.'
            }
          </p>
          {user && (
            <div className="mt-6">
              <Link
                to="/tournaments/create"
                className="btn-primary"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Tournament
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}