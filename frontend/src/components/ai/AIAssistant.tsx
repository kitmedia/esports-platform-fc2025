import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  ChartBarIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { aiApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface AIAssistantProps {
  context?: 'tournament' | 'match' | 'general'
  contextData?: any
  onClose?: () => void
}

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  suggestions?: string[]
}

const quickPrompts = {
  tournament: [
    'Help me create a balanced tournament bracket',
    'Suggest optimal tournament settings',
    'Generate a tournament description',
    'Recommend prize distribution'
  ],
  match: [
    'Analyze my match performance',
    'Suggest improvements for my gameplay',
    'Help me understand my opponent\'s strategy',
    'Predict match outcome'
  ],
  general: [
    'How can I improve my FIFA skills?',
    'What tournaments should I join?',
    'Explain the rating system',
    'Help me set up streaming'
  ]
}

export default function AIAssistant({ 
  context = 'general', 
  contextData, 
  onClose 
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: `Hello! I'm your AI assistant. I can help you with ${context} related questions and provide personalized recommendations. What would you like to know?`,
      timestamp: new Date(),
      suggestions: quickPrompts[context]
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      // This would call different AI endpoints based on context
      switch (context) {
        case 'tournament':
          return aiApi.suggestTournamentFormat({ 
            message, 
            contextData 
          })
        case 'match':
          return aiApi.predictMatch({ 
            message, 
            contextData 
          })
        default:
          return { 
            response: 'I understand your question. Here\'s what I can help you with...', 
            suggestions: quickPrompts[context] 
          }
      }
    },
    onMutate: () => {
      setIsTyping(true)
    },
    onSuccess: (data) => {
      const aiMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: data.response,
        timestamp: new Date(),
        suggestions: data.suggestions
      }
      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsTyping(false)
    }
  })

  const handleSendMessage = (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    
    sendMessageMutation.mutate(content)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(inputMessage)
    }
  }

  const getContextIcon = () => {
    switch (context) {
      case 'tournament':
        return TrophyIcon
      case 'match':
        return ChartBarIcon
      default:
        return SparklesIcon
    }
  }

  const getContextColor = () => {
    switch (context) {
      case 'tournament':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'match':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-purple-600 dark:text-purple-400'
    }
  }

  const ContextIcon = getContextIcon()

  return (
    <div className="flex flex-col h-full max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700`}>
            <ContextIcon className={`w-5 h-5 ${getContextColor()}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              AI Assistant
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {context} Support
            </p>
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              <div className="text-sm">{message.content}</div>
              
              {message.suggestions && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Quick suggestions:
                  </div>
                  {message.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(suggestion)}
                      className="block w-full text-left text-xs p-2 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  AI is thinking...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            rows={1}
            className="flex-1 input resize-none"
            disabled={sendMessageMutation.isPending}
          />
          <button
            onClick={() => handleSendMessage(inputMessage)}
            disabled={!inputMessage.trim() || sendMessageMutation.isPending}
            className="btn-primary p-2"
          >
            {sendMessageMutation.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}

// AI Features Components
export function AITournamentSuggestions({ tournamentData, onApplySuggestion }: any) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const generateSuggestions = async () => {
    setLoading(true)
    try {
      const response = await aiApi.suggestTournamentFormat(tournamentData)
      setSuggestions(response.suggestions || [])
    } catch (error) {
      console.error('Failed to generate suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Suggestions
          </h3>
        </div>
        <button
          onClick={generateSuggestions}
          className="btn-outline text-sm"
        >
          Generate Suggestions
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {suggestion.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {suggestion.description}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>Confidence: {suggestion.confidence}%</span>
                    <span>Impact: {suggestion.impact}</span>
                  </div>
                </div>
                <button
                  onClick={() => onApplySuggestion(suggestion)}
                  className="btn-primary text-sm ml-4"
                >
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <LightBulbIcon className="mx-auto w-12 h-12 mb-4" />
          <p>Click "Generate Suggestions" to get AI-powered recommendations</p>
        </div>
      )}
    </div>
  )
}

export function AIMatchPredictor({ matchData }: any) {
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const generatePrediction = async () => {
    setLoading(true)
    try {
      const response = await aiApi.predictMatch(matchData)
      setPrediction(response)
    } catch (error) {
      console.error('Failed to generate prediction:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Match Prediction
          </h3>
        </div>
        <button
          onClick={generatePrediction}
          disabled={loading}
          className="btn-outline text-sm"
        >
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : null}
          Predict Match
        </button>
      </div>

      {prediction ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {prediction.player1Probability}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {matchData.player1Name} Win Chance
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {prediction.player2Probability}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {matchData.player2Name} Win Chance
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Key Factors
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {prediction.factors?.map((factor: string, index: number) => (
                <li key={index}>• {factor}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
            Predictions are based on historical data and may not reflect actual outcomes
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <ChartBarIcon className="mx-auto w-12 h-12 mb-4" />
          <p>Generate AI-powered match predictions based on player statistics</p>
        </div>
      )}
    </div>
  )
}