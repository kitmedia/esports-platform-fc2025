import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  UserIcon,
  CameraIcon,
  TrophyIcon,
  ChartBarIcon,
  CalendarIcon,
  StarIcon,
  CogIcon,
  ShieldCheckIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../stores/authStore'
import { userApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  isPublic: z.boolean(),
  allowDirectMessages: z.boolean(),
  showOnlineStatus: z.boolean(),
})

type ProfileFormData = z.infer<typeof profileSchema>

const platforms = [
  { value: 'PLAYSTATION', label: 'PlayStation', icon: '🎮' },
  { value: 'XBOX', label: 'Xbox', icon: '🎮' },
  { value: 'PC', label: 'PC', icon: '💻' },
  { value: 'NINTENDO', label: 'Nintendo Switch', icon: '🎮' },
]

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'stats' | 'history'>('overview')
  
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: userApi.getProfile,
  })

  const { data: stats } = useQuery({
    queryKey: ['user', 'stats'],
    queryFn: userApi.getStats,
  })

  const { data: achievements } = useQuery({
    queryKey: ['user', 'achievements'],
    queryFn: userApi.getAchievements,
  })

  const { data: tournamentHistory } = useQuery({
    queryKey: ['user', 'tournaments'],
    queryFn: () => userApi.getTournamentHistory({ limit: 10 }),
    enabled: activeTab === 'history',
  })

  const updateProfileMutation = useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] })
      setIsEditing(false)
    },
  })

  const uploadAvatarMutation = useMutation({
    mutationFn: userApi.uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] })
      setSelectedFile(null)
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile || {},
  })

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data)
  }

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      uploadAvatarMutation.mutate(file)
    }
  }

  const handleEditToggle = () => {
    if (isEditing) {
      reset(profile)
    } else {
      reset(profile)
    }
    setIsEditing(!isEditing)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="card p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
          {/* Avatar */}
          <div className="relative">
            <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-16 h-16 text-gray-400" />
              )}
            </div>
            
            <button
              onClick={() => document.getElementById('avatar-upload')?.click()}
              className="absolute bottom-0 right-0 p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
            >
              <CameraIcon className="w-4 h-4" />
            </button>
            
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {profile?.displayName || profile?.username || user?.username}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  @{profile?.username || user?.username}
                </p>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleEditToggle}
                  className="btn-outline flex items-center"
                >
                  {isEditing ? (
                    <>
                      <XMarkIcon className="w-4 h-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <PencilIcon className="w-4 h-4 mr-2" />
                      Edit Profile
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bio */}
            <p className="text-gray-600 dark:text-gray-300 mb-4 max-w-2xl">
              {profile?.bio || 'No bio available'}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.tournamentsPlayed || 0}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Tournaments
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.matchesWon || 0}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Wins
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.rating || 1200}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Rating
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600 dark:text-success-400">
                  ${stats?.totalEarnings || 0}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Earnings
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  {...register('displayName')}
                  type="text"
                  className="input w-full"
                  placeholder="Your display name"
                />
                {errors.displayName && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.displayName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Platform
                </label>
                <select {...register('platform')} className="input w-full">
                  <option value="">Select platform</option>
                  {platforms.map((platform) => (
                    <option key={platform.value} value={platform.value}>
                      {platform.icon} {platform.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  {...register('bio')}
                  rows={3}
                  className="input w-full"
                  placeholder="Tell us about yourself..."
                />
                {errors.bio && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.bio.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Country
                </label>
                <input
                  {...register('country')}
                  type="text"
                  className="input w-full"
                  placeholder="Your country"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <select {...register('timezone')} className="input w-full">
                  <option value="">Select timezone</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">GMT</option>
                  <option value="Europe/Paris">CET</option>
                  <option value="Asia/Tokyo">JST</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center">
                  <input
                    {...register('isPublic')}
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Public profile (visible to other users)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    {...register('allowDirectMessages')}
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Allow direct messages from other users
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    {...register('showOnlineStatus')}
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Show online status to other users
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleEditToggle}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="btn-primary"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: UserIcon },
            { id: 'achievements', label: 'Achievements', icon: TrophyIcon },
            { id: 'stats', label: 'Statistics', icon: ChartBarIcon },
            { id: 'history', label: 'Tournament History', icon: CalendarIcon },
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

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="space-y-4">
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CalendarIcon className="mx-auto h-12 w-12 mb-2" />
                <p>No recent activity</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Stats
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Win Rate</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats?.winRate ? `${(stats.winRate * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Best Ranking</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  #{stats?.bestRanking || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tournaments Won</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats?.tournamentsWon || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Average Goals</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {stats?.averageGoals?.toFixed(1) || '0.0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements && achievements.length > 0 ? (
            achievements.map((achievement: any) => (
              <div key={achievement.id} className="card p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <TrophyIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {achievement.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {achievement.description}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                </span>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No achievements yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Start competing in tournaments to earn achievements!
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Performance
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Matches</span>
                <span className="font-medium">{stats?.totalMatches || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Matches Won</span>
                <span className="font-medium text-green-600">{stats?.matchesWon || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Matches Lost</span>
                <span className="font-medium text-red-600">{stats?.matchesLost || 0}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Tournament Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tournaments Played</span>
                <span className="font-medium">{stats?.tournamentsPlayed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tournaments Won</span>
                <span className="font-medium text-yellow-600">{stats?.tournamentsWon || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Finals Reached</span>
                <span className="font-medium">{stats?.finalsReached || 0}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Financial
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Earnings</span>
                <span className="font-medium text-green-600">${stats?.totalEarnings || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Biggest Prize</span>
                <span className="font-medium">${stats?.biggestPrize || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Entry Fees Paid</span>
                <span className="font-medium">${stats?.entryFeesPaid || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {tournamentHistory && tournamentHistory.length > 0 ? (
            tournamentHistory.map((tournament: any) => (
              <div key={tournament.id} className="card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {tournament.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(tournament.startDate).toLocaleDateString()} • {tournament.format}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`badge ${
                      tournament.placement === 1 ? 'badge-success' :
                      tournament.placement <= 3 ? 'badge-warning' :
                      'badge-secondary'
                    }`}>
                      {tournament.placement ? `#${tournament.placement}` : 'Participated'}
                    </div>
                    {tournament.prizeWon > 0 && (
                      <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                        +${tournament.prizeWon}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No tournament history
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Your tournament participation will appear here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}