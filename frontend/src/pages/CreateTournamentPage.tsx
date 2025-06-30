import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { 
  SparklesIcon, 
  CalendarIcon, 
  TrophyIcon, 
  UserGroupIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline'
import { tournamentApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const createTournamentSchema = z.object({
  name: z.string().min(3, 'Tournament name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  format: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS']),
  maxParticipants: z.number().min(4).max(256),
  prizePool: z.number().min(0),
  registrationEndDate: z.string(),
  startDate: z.string(),
  rules: z.string().optional(),
  isPublic: z.boolean(),
  requireApproval: z.boolean(),
  streamingRequired: z.boolean(),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL']).optional(),
})

type CreateTournamentData = z.infer<typeof createTournamentSchema>

const formatOptions = [
  { 
    value: 'SINGLE_ELIMINATION', 
    label: 'Single Elimination',
    description: 'Players are eliminated after one loss. Fast and decisive.'
  },
  { 
    value: 'DOUBLE_ELIMINATION', 
    label: 'Double Elimination',
    description: 'Players get a second chance in the losers bracket.'
  },
  { 
    value: 'ROUND_ROBIN', 
    label: 'Round Robin',
    description: 'Every player plays against every other player.'
  },
  { 
    value: 'SWISS', 
    label: 'Swiss System',
    description: 'Players with similar records are paired together.'
  },
]

const skillLevelOptions = [
  { value: 'BEGINNER', label: 'Beginner', description: 'New to competitive FIFA' },
  { value: 'INTERMEDIATE', label: 'Intermediate', description: 'Some tournament experience' },
  { value: 'ADVANCED', label: 'Advanced', description: 'Experienced competitive player' },
  { value: 'PROFESSIONAL', label: 'Professional', description: 'Pro-level competition' },
]

export default function CreateTournamentPage() {
  const [useAI, setUseAI] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateTournamentData>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: {
      format: 'SINGLE_ELIMINATION',
      maxParticipants: 16,
      prizePool: 0,
      isPublic: true,
      requireApproval: false,
      streamingRequired: false,
    },
  })

  const createMutation = useMutation({
    mutationFn: tournamentApi.createTournament,
    onSuccess: (data) => {
      navigate(`/tournaments/${data.id}`)
    },
  })

  const aiSuggestionsMutation = useMutation({
    mutationFn: tournamentApi.getAISuggestions,
    onSuccess: (data) => {
      setAiSuggestions(data)
      // Apply AI suggestions to form
      if (data.name) setValue('name', data.name)
      if (data.description) setValue('description', data.description)
      if (data.format) setValue('format', data.format)
      if (data.maxParticipants) setValue('maxParticipants', data.maxParticipants)
    },
  })

  const watchedFields = watch()

  const generateAISuggestions = () => {
    aiSuggestionsMutation.mutate({
      preferences: {
        skillLevel: watchedFields.skillLevel,
        format: watchedFields.format,
        maxParticipants: watchedFields.maxParticipants,
      }
    })
  }

  const onSubmit = (data: CreateTournamentData) => {
    createMutation.mutate(data)
  }

  const getTomorrowDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().slice(0, 16)
  }

  const getNextWeekDate = () => {
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    return nextWeek.toISOString().slice(0, 16)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Create Tournament
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Set up your FIFA tournament with our AI-powered assistance
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* AI Assistant */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <SparklesIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Tournament Assistant
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setUseAI(!useAI)}
              className={`btn-outline text-sm ${useAI ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
            >
              {useAI ? 'Disable AI' : 'Enable AI'}
            </button>
          </div>

          {useAI && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Let our AI help you create the perfect tournament setup based on your preferences.
              </p>
              
              <button
                type="button"
                onClick={generateAISuggestions}
                disabled={aiSuggestionsMutation.isPending}
                className="btn-primary text-sm"
              >
                {aiSuggestionsMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Generating suggestions...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Get AI Suggestions
                  </>
                )}
              </button>

              {aiSuggestions && (
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <h3 className="font-medium text-primary-900 dark:text-primary-100 mb-2">
                    AI Suggestions Applied
                  </h3>
                  <ul className="text-sm text-primary-700 dark:text-primary-300 space-y-1">
                    <li>• Optimized tournament format and bracket size</li>
                    <li>• Suggested prize pool distribution</li>
                    <li>• Recommended tournament duration</li>
                    <li>• Auto-generated engaging description</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tournament Name *
              </label>
              <input
                {...register('name')}
                type="text"
                className="input w-full"
                placeholder="Enter an exciting tournament name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                {...register('description')}
                rows={4}
                className="input w-full"
                placeholder="Describe your tournament, rules, and what makes it special..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Skill Level
              </label>
              <select {...register('skillLevel')} className="input w-full">
                <option value="">Any Skill Level</option>
                {skillLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prize Pool ($)
              </label>
              <input
                {...register('prizePool', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                className="input w-full"
                placeholder="0.00"
              />
              {errors.prizePool && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.prizePool.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tournament Format */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Tournament Format
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Format *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formatOptions.map((option) => (
                  <label
                    key={option.value}
                    className="relative flex cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      {...register('format')}
                      type="radio"
                      value={option.value}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {errors.format && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.format.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Participants *
              </label>
              <select {...register('maxParticipants', { valueAsNumber: true })} className="input w-full">
                <option value={4}>4 Players</option>
                <option value={8}>8 Players</option>
                <option value={16}>16 Players</option>
                <option value={32}>32 Players</option>
                <option value={64}>64 Players</option>
                <option value={128}>128 Players</option>
                <option value={256}>256 Players</option>
              </select>
              {errors.maxParticipants && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.maxParticipants.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Schedule
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Registration Deadline *
              </label>
              <input
                {...register('registrationEndDate')}
                type="datetime-local"
                min={getTomorrowDate()}
                className="input w-full"
              />
              {errors.registrationEndDate && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.registrationEndDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tournament Start Date *
              </label>
              <input
                {...register('startDate')}
                type="datetime-local"
                min={getNextWeekDate()}
                className="input w-full"
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Tournament Settings
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  {...register('isPublic')}
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <label className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Public Tournament
                </label>
              </div>
              <InformationCircleIcon className="h-5 w-5 text-gray-400" title="Anyone can find and join this tournament" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  {...register('requireApproval')}
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <label className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Require Registration Approval
                </label>
              </div>
              <InformationCircleIcon className="h-5 w-5 text-gray-400" title="Manually approve each participant" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  {...register('streamingRequired')}
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <label className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Streaming Required
                </label>
              </div>
              <InformationCircleIcon className="h-5 w-5 text-gray-400" title="Participants must stream their matches" />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Rules (Optional)
            </label>
            <textarea
              {...register('rules')}
              rows={4}
              className="input w-full"
              placeholder="Specify any additional rules, restrictions, or requirements..."
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/tournaments')}
            className="btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary"
          >
            {createMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating tournament...
              </>
            ) : (
              'Create Tournament'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}