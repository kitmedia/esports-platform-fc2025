import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  VideoCameraIcon,
  CogIcon,
  EyeIcon,
  MicrophoneIcon,
  ComputerDesktopIcon,
  PlayIcon,
  StopIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline'
import { streamingApi } from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

interface StreamingSetupProps {
  matchId?: string
  tournamentId?: string
  onStreamStart?: (streamData: any) => void
  onStreamStop?: () => void
}

export default function StreamingSetup({
  matchId,
  tournamentId,
  onStreamStart,
  onStreamStop,
}: StreamingSetupProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamKey, setStreamKey] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [obsConnected, setObsConnected] = useState(false)
  const [streamTitle, setStreamTitle] = useState('')
  const [streamDescription, setStreamDescription] = useState('')
  const [streamQuality, setStreamQuality] = useState('1080p')
  const [streamPrivacy, setStreamPrivacy] = useState('public')

  const { data: streamStatus } = useQuery({
    queryKey: ['streaming', 'status'],
    queryFn: streamingApi.getStatus,
    refetchInterval: 5000,
  })

  const createStreamMutation = useMutation({
    mutationFn: streamingApi.createStream,
    onSuccess: (data) => {
      setStreamKey(data.streamKey)
      setStreamUrl(data.streamUrl)
    },
  })

  const startStreamMutation = useMutation({
    mutationFn: (streamId: string) => streamingApi.startStream(streamId),
    onSuccess: (data) => {
      setIsStreaming(true)
      onStreamStart?.(data)
    },
  })

  const stopStreamMutation = useMutation({
    mutationFn: (streamId: string) => streamingApi.stopStream(streamId),
    onSuccess: () => {
      setIsStreaming(false)
      onStreamStop?.()
    },
  })

  const checkOBSConnection = async () => {
    try {
      // This would connect to OBS WebSocket
      // For now, we'll simulate the connection
      setTimeout(() => {
        setObsConnected(true)
      }, 1000)
    } catch (error) {
      console.error('Failed to connect to OBS:', error)
      setObsConnected(false)
    }
  }

  const handleCreateStream = () => {
    createStreamMutation.mutate({
      matchId,
      tournamentId,
      title: streamTitle,
      description: streamDescription,
      quality: streamQuality,
      privacy: streamPrivacy,
    })
  }

  const handleStartStream = () => {
    if (streamKey) {
      startStreamMutation.mutate(streamKey)
    }
  }

  const handleStopStream = () => {
    if (streamKey) {
      stopStreamMutation.mutate(streamKey)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  useEffect(() => {
    checkOBSConnection()
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Streaming Setup
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your stream settings and connect to OBS Studio
        </p>
      </div>

      {/* Stream Status */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Stream Status
          </h3>
          <div className={`flex items-center ${
            isStreaming ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
          }`}>
            <div className={`w-3 h-3 rounded-full mr-2 ${
              isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
            }`} />
            {isStreaming ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <VideoCameraIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Stream Quality
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {streamQuality}
              </div>
            </div>
          </div>

          <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <EyeIcon className="w-8 h-8 text-green-600 dark:text-green-400 mr-3" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Viewers
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {streamStatus?.viewerCount || 0}
              </div>
            </div>
          </div>

          <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <ComputerDesktopIcon className={`w-8 h-8 mr-3 ${
              obsConnected 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`} />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                OBS Status
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {obsConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          {!isStreaming ? (
            <button
              onClick={handleStartStream}
              disabled={!streamKey || !obsConnected || startStreamMutation.isPending}
              className="btn-primary flex items-center"
            >
              {startStreamMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <PlayIcon className="w-5 h-5 mr-2" />
              )}
              Start Stream
            </button>
          ) : (
            <button
              onClick={handleStopStream}
              disabled={stopStreamMutation.isPending}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
            >
              {stopStreamMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <StopIcon className="w-5 h-5 mr-2" />
              )}
              Stop Stream
            </button>
          )}
        </div>
      </div>

      {/* Stream Configuration */}
      {!streamKey && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Stream Configuration
          </h3>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stream Title
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter stream title"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stream Description
              </label>
              <textarea
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                placeholder="Describe your stream"
                rows={3}
                className="input w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stream Quality
                </label>
                <select
                  value={streamQuality}
                  onChange={(e) => setStreamQuality(e.target.value)}
                  className="input w-full"
                >
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="1440p">1440p (2K)</option>
                  <option value="2160p">2160p (4K)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Privacy
                </label>
                <select
                  value={streamPrivacy}
                  onChange={(e) => setStreamPrivacy(e.target.value)}
                  className="input w-full"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCreateStream}
                disabled={!streamTitle || createStreamMutation.isPending}
                className="btn-primary"
              >
                {createStreamMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Stream'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OBS Setup */}
      {streamKey && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            OBS Studio Setup
          </h3>

          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Setup Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open OBS Studio</li>
                    <li>Go to Settings → Stream</li>
                    <li>Set Service to "Custom"</li>
                    <li>Copy the Server URL and Stream Key below</li>
                    <li>Click "Apply" and "OK"</li>
                    <li>Start streaming in OBS</li>
                  </ol>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Server URL
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={streamUrl}
                  readOnly
                  className="input flex-1 bg-gray-50 dark:bg-gray-800"
                />
                <button
                  onClick={() => copyToClipboard(streamUrl)}
                  className="ml-2 btn-outline"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stream Key
              </label>
              <div className="flex">
                <input
                  type="password"
                  value={streamKey}
                  readOnly
                  className="input flex-1 bg-gray-50 dark:bg-gray-800"
                />
                <button
                  onClick={() => copyToClipboard(streamKey)}
                  className="ml-2 btn-outline"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Keep your stream key private. Never share it publicly.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center">
                <ComputerDesktopIcon className={`w-6 h-6 mr-3 ${
                  obsConnected 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-400'
                }`} />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    OBS Studio Connection
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {obsConnected ? 'Ready to stream' : 'Not connected'}
                  </div>
                </div>
              </div>
              
              {obsConnected ? (
                <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <button
                  onClick={checkOBSConnection}
                  className="btn-outline"
                >
                  Test Connection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stream Analytics */}
      {isStreaming && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Live Analytics
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {streamStatus?.viewerCount || 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Current Viewers
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {streamStatus?.peakViewers || 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Peak Viewers
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {streamStatus?.duration || '00:00'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Duration
              </div>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {streamStatus?.bitrate || 0} kbps
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Bitrate
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Streaming Tips */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Streaming Tips
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Technical Requirements
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Stable internet connection (5+ Mbps upload)</li>
              <li>• OBS Studio or similar streaming software</li>
              <li>• Decent computer hardware (CPU/GPU)</li>
              <li>• Good microphone for clear audio</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Best Practices
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Test your setup before important matches</li>
              <li>• Use a consistent streaming schedule</li>
              <li>• Engage with your viewers in chat</li>
              <li>• Maintain good lighting and audio</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}