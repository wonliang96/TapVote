'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  BoltIcon,
  TrophyIcon,
  ClockIcon,
  FireIcon
} from '@heroicons/react/24/outline'

interface PollOption {
  id: string
  text: string
  votes: number
  percentage?: number
}

interface Poll {
  id: string
  title: string
  question?: string
  description?: string
  options: PollOption[]
  totalVotes: number
  totalComments: number
  totalPredictions: number
  category: {
    slug: string
    name: string
    icon?: string
    color?: string
  }
  creator: {
    id: string
    username: string
    displayName: string
  }
  createdAt: Date
  expiresAt: Date | null
  userVoted: boolean
  votedOptionId?: string
  sourceType: string
  newsSourceUrl?: string
  aiGenerated: boolean
  aiConfidence?: number
  difficulty?: string
  isTrending: boolean
  trendingScore?: number
  isFromNews?: boolean
}

interface MobilePollCardProps {
  poll: Poll
  compact?: boolean
}

export default function MobilePollCard({ poll, compact = false }: MobilePollCardProps) {
  const { t } = useTranslation()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(poll.userVoted)
  const [localVotes, setLocalVotes] = useState(poll.options)

  const handleVote = async (optionId: string) => {
    if (hasVoted) return

    setSelectedOption(optionId)
    
    try {
      const sessionId = 'anonymous-' + Math.random().toString(36).substr(2, 9)
      
      const response = await fetch(`http://localhost:5003/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ optionId })
      })

      const data = await response.json()

      if (response.ok) {
        setHasVoted(true)
        setLocalVotes(prev => prev.map(option => {
          const result = data.results.find((r: any) => r.optionId === option.id)
          return result ? { ...option, votes: result.votes } : option
        }))
      } else {
        setSelectedOption(null)
      }
    } catch (error) {
      setSelectedOption(null)
    }
  }

  const getPercentage = (votes: number) => {
    const total = localVotes.reduce((sum, option) => sum + option.votes, 0)
    return total > 0 ? Math.round((votes / total) * 100) : 0
  }

  const topOption = localVotes.reduce((top, current) => 
    current.votes > top.votes ? current : top, localVotes[0])

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInHours < 1) return 'now'
    if (diffInHours < 24) return `${diffInHours}h`
    return `${diffInDays}d`
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2 flex-1">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
              style={{ backgroundColor: poll.category.color || '#3B82F6' }}
            >
              {poll.category.icon || '📊'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                {poll.category.name}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                {poll.isTrending && (
                  <div className="flex items-center space-x-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    <FireIcon className="h-3 w-3" />
                    <span>Hot</span>
                  </div>
                )}
                {poll.aiGenerated && (
                  <div className="flex items-center space-x-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    <BoltIcon className="h-3 w-3" />
                    <span>AI</span>
                  </div>
                )}
                {poll.totalPredictions > 0 && (
                  <div className="flex items-center space-x-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <TrophyIcon className="h-3 w-3" />
                    <span>{poll.totalPredictions}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {formatTimeAgo(poll.createdAt)}
            </div>
          </div>
        </div>

        <h3 className="text-base font-semibold text-gray-900 leading-snug mb-2">
          {poll.question || poll.title}
        </h3>
        
        {poll.description && !compact && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {poll.description}
          </p>
        )}
      </div>

      {/* Options */}
      <div className="px-4 pb-4">
        <div className="space-y-2">
          {localVotes.map((option, index) => {
            const percentage = getPercentage(option.votes)
            const isSelected = selectedOption === option.id || poll.votedOptionId === option.id
            const showResults = hasVoted
            const isLeading = showResults && option.id === topOption.id && option.votes > 0

            return (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={hasVoted}
                className={`relative w-full p-3 rounded-xl text-left transition-all duration-200 ${
                  showResults
                    ? isSelected
                      ? 'bg-blue-50 border-2 border-blue-200'
                      : isLeading
                      ? 'bg-green-50 border-2 border-green-200'
                      : 'bg-gray-50 border border-gray-200'
                    : 'bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium text-sm ${
                    showResults && isSelected ? 'text-blue-700' : 
                    showResults && isLeading ? 'text-green-700' : 'text-gray-900'
                  }`}>
                    {option.text}
                  </span>
                  
                  {showResults && (
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-bold ${
                        isSelected ? 'text-blue-700' : 
                        isLeading ? 'text-green-700' : 'text-gray-600'
                      }`}>
                        {percentage}%
                      </span>
                      {isLeading && <span className="text-green-600">👑</span>}
                      {isSelected && <span className="text-blue-600">✓</span>}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {showResults && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isSelected 
                            ? 'bg-blue-500' 
                            : isLeading 
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>{poll.totalVotes} votes</span>
            {poll.totalComments > 0 && <span>{poll.totalComments} comments</span>}
          </div>
          <div className="flex items-center space-x-1">
            <span>by {poll.creator.displayName}</span>
          </div>
        </div>
      </div>
    </div>
  )
}