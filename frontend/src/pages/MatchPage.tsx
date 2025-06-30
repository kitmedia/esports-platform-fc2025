import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlayIcon,
  PauseIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
  CameraIcon
} from '@heroicons/react/24/outline'
import { matchApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function MatchPage() {
  const { id } = useParams<{ id: string }>()
  const [playerScore, setPlayerScore] = useState(0)
  const [opponentScore, setOpponentScore] = useState(0)
  const [matchTime, setMatchTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchApi.getMatch(id!),
    enabled: !!id,
  })

  const submitResultMutation = useMutation({
    mutationFn: (data: { playerScore: number; opponentScore: number; screenshot?: File }) => 
      matchApi.submitResult(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] })
    },
  })

  const reportIssueMutation = useMutation({
    mutationFn: (data: { reason: string; description: string }) => 
      matchApi.reportIssue(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] })
    },
  })

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying) {
      interval = setInterval(() => {
        setMatchTime((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isPlaying])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmitResult = () => {
    const data: any = { playerScore, opponentScore }
    if (screenshotFile) {
      data.screenshot = screenshotFile
    }
    submitResultMutation.mutate(data)
  }

  const handleScreenshotUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setScreenshotFile(file)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Match not found
          </h1>
        </div>
      </div>
    )
  }

  const isPlayer = match.player1Id === user?.id || match.player2Id === user?.id
  const opponent = match.player1Id === user?.id ? match.player2 : match.player1

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Match Header */}
      <div className="card p-6 mb-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Tournament Match
          </h1>
          <div className="flex items-center justify-center space-x-8 text-lg">
            <div className="text-center">
              <div className="font-semibold text-gray-900 dark:text-white">
                {match.player1.displayName || match.player1.username}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Rating: {match.player1.rating || 1200}
              </div>
            </div>
            
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              VS
            </div>
            
            <div className="text-center">
              <div className="font-semibold text-gray-900 dark:text-white">
                {match.player2.displayName || match.player2.username}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Rating: {match.player2.rating || 1200}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center items-center space-x-4">
            <span className={`badge ${
              match.status === 'SCHEDULED' ? 'badge-warning' :
              match.status === 'LIVE' ? 'badge-success' :
              match.status === 'COMPLETED' ? 'badge-secondary' :
              'badge-primary'
            }`}>
              {match.status}
            </span>
            {match.scheduledTime && (
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <ClockIcon className="h-4 w-4 mr-1" />
                {new Date(match.scheduledTime).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Match Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer and Score */}
          <div className="card p-6">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {formatTime(matchTime)}
              </div>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`btn-${isPlaying ? 'outline' : 'primary'} flex items-center`}
                >
                  {isPlaying ? (
                    <>
                      <PauseIcon className="h-5 w-5 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-5 w-5 mr-2" />
                      Start
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Score Input */}
            {isPlayer && match.status === 'LIVE' && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={playerScore}
                    onChange={(e) => setPlayerScore(parseInt(e.target.value) || 0)}
                    className="input text-center text-2xl font-bold w-20 mx-auto"
                  />
                </div>
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Opponent Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(parseInt(e.target.value) || 0)}
                    className="input text-center text-2xl font-bold w-20 mx-auto"
                  />
                </div>
              </div>
            )}

            {/* Current Scores Display */}
            {match.status === 'COMPLETED' && (
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Final Score
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {match.player1Score || 0}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {match.player1.displayName || match.player1.username}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {match.player2Score || 0}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {match.player2.displayName || match.player2.username}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Screenshot Upload */}
            {isPlayer && match.status === 'LIVE' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Match Screenshot (Optional)
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  <label
                    htmlFor="screenshot-upload"
                    className="btn-outline flex items-center cursor-pointer"
                  >
                    <CameraIcon className="h-5 w-5 mr-2" />
                    Upload Screenshot
                  </label>
                  {screenshotFile && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {screenshotFile.name}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isPlayer && match.status === 'LIVE' && (
              <div className="flex space-x-4">
                <button
                  onClick={handleSubmitResult}
                  disabled={submitResultMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {submitResultMutation.isPending ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-5 w-5 mr-2" />
                      Submit Result
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {/* Open report modal */}}
                  className="btn-outline border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  Report Issue
                </button>
              </div>
            )}
          </div>

          {/* Streaming */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Streaming
              </h3>
              <span className="badge-secondary">
                {match.streamingRequired ? 'Required' : 'Optional'}
              </span>
            </div>

            {match.stream ? (
              <div className="space-y-4">
                <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                  <div className="text-center text-white">
                    <VideoCameraIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>Stream Player</p>
                    <p className="text-sm opacity-75">Integration coming soon</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Stream Status: <span className="text-green-600 dark:text-green-400">Live</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Viewers: {match.stream.viewerCount || 0}
                    </p>
                  </div>
                  
                  <button className="btn-primary">
                    <VideoCameraIcon className="h-5 w-5 mr-2" />
                    Start Stream
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h4 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  No stream active
                </h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {match.streamingRequired 
                    ? 'Streaming is required for this match'
                    : 'Start streaming to share your gameplay'
                  }
                </p>
                <button className="btn-primary mt-4">
                  <VideoCameraIcon className="h-5 w-5 mr-2" />
                  Start Stream
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Match Chat
            </h3>
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
          </div>

          <div className="h-96 flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-blue-600 dark:text-blue-400">System:</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    Match started. Good luck to both players!
                  </span>
                </div>
                
                {/* Sample messages */}
                <div className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {opponent?.displayName || opponent?.username}:
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    Good luck! 🎮
                  </span>
                </div>
              </div>
            </div>

            {/* Chat Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a message..."
                className="input flex-1 text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    // Send message
                    setChatMessage('')
                  }
                }}
              />
              <button className="btn-primary text-sm px-3">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}