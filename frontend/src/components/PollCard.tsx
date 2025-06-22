'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  ChatBubbleLeftIcon, 
  ShareIcon, 
  NewspaperIcon,
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  BoltIcon,
  StarIcon 
} from '@heroicons/react/24/outline'
import PollChart from './PollChart'
import TranslationIndicator from './TranslationIndicator'
import { translationManager } from '@/lib/translation'
import { TouchFeedbackButton, SwipeableCard } from './MobileOptimized'
import { PollGraphic, OptionAvatar, MiniChart } from './PollGraphics'

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

interface PollCardProps {
  poll: Poll
}

export default function PollCard({ poll }: PollCardProps) {
  const { t, i18n } = useTranslation()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(poll.userVoted)
  const [localVotes, setLocalVotes] = useState(poll.options)
  const [showChart, setShowChart] = useState(false)
  const [translatedQuestion, setTranslatedQuestion] = useState(poll.question)
  const [translatedOptions, setTranslatedOptions] = useState(poll.options)
  const [isTranslating, setIsTranslating] = useState(false)

  // Translate poll content when language changes
  useEffect(() => {
    const translateContent = async () => {
      if (i18n.language === 'en') {
        setTranslatedQuestion(poll.question)
        setTranslatedOptions(poll.options)
        return
      }

      setIsTranslating(true)
      try {
        // Translate question
        const questionResult = await translationManager.translateText(
          poll.question,
          'en',
          i18n.language
        )
        setTranslatedQuestion(questionResult.text)

        // Translate options
        const translatedOpts = await Promise.all(
          poll.options.map(async (option) => {
            const optionResult = await translationManager.translateText(
              option.text,
              'en',
              i18n.language
            )
            return {
              ...option,
              text: optionResult.text
            }
          })
        )
        setTranslatedOptions(translatedOpts)
      } catch (error) {
        console.error('Translation failed:', error)
      } finally {
        setIsTranslating(false)
      }
    }

    translateContent()
  }, [i18n.language, poll])

  const handleVote = async (optionId: string) => {
    if (hasVoted) return

    setSelectedOption(optionId)
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const sessionId = 'anonymous-' + Math.random().toString(36).substr(2, 9)
      
      const response = await fetch(`http://localhost:5003/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          'x-session-id': sessionId
        },
        body: JSON.stringify({ optionId })
      })

      const data = await response.json()

      if (response.ok) {
        setHasVoted(true)
        // Update local votes with server response
        setLocalVotes(prev => prev.map(option => {
          const result = data.results.find((r: any) => r.optionId === option.id)
          return result ? { ...option, votes: result.votes } : option
        }))
      } else {
        // Reset if vote failed
        setSelectedOption(null)
        alert(data.error || 'Failed to cast vote')
      }
    } catch (error) {
      setSelectedOption(null)
      alert('Network error. Please try again.')
    }
  }

  const getPercentage = (votes: number) => {
    const total = localVotes.reduce((sum, option) => sum + option.votes, 0)
    return total > 0 ? Math.round((votes / total) * 100) : 0
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInHours < 1) return t('justNow')
    if (diffInHours < 24) return t('hoursAgo', { count: diffInHours })
    return t('daysAgo', { count: diffInDays })
  }

  const isExpired = poll.expiresAt && new Date() > poll.expiresAt

  return (
    <div className="group bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl hover:border-gray-200 transition-all duration-300 hover-lift">
      {/* Dynamic Graphics Header */}
      <div className="relative h-24 mb-4">
        <PollGraphic 
          question={translatedQuestion}
          category={poll.category}
          options={translatedOptions}
          className="absolute inset-0 rounded-t-2xl"
        />
      </div>

      {/* Header */}
      <div className="p-6 pb-4 relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-3 flex-wrap">
              <span className="inline-flex items-center text-sm font-semibold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-1.5 rounded-full border border-blue-200">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                {poll.category.name}
              </span>
              {poll.aiGenerated && (
                <div className="inline-flex items-center space-x-1 text-sm font-semibold text-purple-700 bg-gradient-to-r from-purple-50 to-purple-100 px-3 py-1.5 rounded-full border border-purple-200">
                  <BoltIcon className="h-3 w-3" />
                  <span>AI {poll.aiConfidence && `${Math.round(poll.aiConfidence * 100)}%`}</span>
                </div>
              )}
              {poll.isFromNews && (
                <div className="inline-flex items-center space-x-1 text-sm font-semibold text-green-700 bg-gradient-to-r from-green-50 to-green-100 px-3 py-1.5 rounded-full border border-green-200">
                  <NewspaperIcon className="h-3 w-3" />
                  <span>News</span>
                </div>
              )}
              {poll.isTrending && (
                <div className="inline-flex items-center space-x-1 text-sm font-semibold text-orange-700 bg-gradient-to-r from-orange-50 to-orange-100 px-3 py-1.5 rounded-full border border-orange-200">
                  <StarIcon className="h-3 w-3 fill-current" />
                  <span>Trending</span>
                </div>
              )}
              {poll.totalPredictions > 0 && (
                <div className="inline-flex items-center space-x-1 text-sm font-semibold text-emerald-700 bg-gradient-to-r from-emerald-50 to-emerald-100 px-3 py-1.5 rounded-full border border-emerald-200">
                  <span>🎯</span>
                  <span>{poll.totalPredictions} predictions</span>
                </div>
              )}
              {isExpired && (
                <span className="inline-flex items-center text-sm font-semibold text-red-700 bg-gradient-to-r from-red-50 to-red-100 px-3 py-1.5 rounded-full border border-red-200">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                  Expired
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isTranslating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-500">Translating...</span>
                </div>
              ) : (
                <>
                  {translatedQuestion}
                  {i18n.language !== 'en' && (
                    <TranslationIndicator 
                      originalText={poll.question}
                      originalLanguage="en"
                    />
                  )}
                </>
              )}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500 flex-wrap">
              <div className="flex items-center space-x-1">
                <span>By {poll.creator.displayName}</span>
              </div>
              <span>•</span>
              <span>{formatTimeAgo(poll.createdAt)}</span>
              <span>•</span>
              <span>{poll.totalVotes} {t('votes')}</span>
              {poll.totalComments > 0 && (
                <>
                  <span>•</span>
                  <span>{poll.totalComments} comments</span>
                </>
              )}
              {poll.expiresAt && !isExpired && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="h-3 w-3" />
                    <span>Expires {formatTimeAgo(poll.expiresAt)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Poll Options */}
      <div className="px-6 pb-6">
        <div className="space-y-4">
          {localVotes.map((option, index) => {
            const percentage = getPercentage(option.votes)
            const isSelected = selectedOption === option.id || poll.votedOptionId === option.id
            const showResults = hasVoted || isExpired
            const isWinning = showResults && option.votes === Math.max(...localVotes.map(o => o.votes)) && option.votes > 0

            return (
              <div key={option.id} className="relative group">
                <TouchFeedbackButton
                  onClick={() => handleVote(option.id)}
                  disabled={hasVoted || isExpired}
                  variant="ghost"
                  className={`relative w-full p-5 rounded-xl border-2 text-left ${
                    showResults
                      ? isSelected
                        ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-blue-100 shadow-lg'
                        : isWinning
                        ? 'border-green-400 bg-gradient-to-r from-green-50 to-green-100 shadow-md'
                        : 'border-gray-200 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100'
                  }`}
                >
                  {/* Option Avatar */}
                  <div className="absolute -top-2 -left-2">
                    <OptionAvatar 
                      text={option.text} 
                      index={index}
                      className={isSelected ? 'ring-2 ring-blue-500' : isWinning ? 'ring-2 ring-green-500' : ''}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`font-medium ${showResults && isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {translatedOptions.find(opt => opt.id === option.id)?.text || option.text}
                        {i18n.language !== 'en' && (
                          <TranslationIndicator 
                            originalText={option.text}
                            originalLanguage="en"
                          />
                        )}
                      </span>
                      {showResults && (
                        <MiniChart 
                          data={[option.votes]} 
                          className="w-8 opacity-60"
                        />
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      {showResults && (
                        <div className="flex items-center space-x-2">
                          <span className={`text-lg font-bold ${
                            isSelected ? 'text-blue-700' : isWinning ? 'text-green-700' : 'text-gray-600'
                          }`}>
                            {percentage}%
                          </span>
                          <span className="text-sm text-gray-500">
                            ({option.votes} {option.votes === 1 ? 'vote' : 'votes'})
                          </span>
                        </div>
                      )}
                      {isSelected && (
                        <div className="flex items-center space-x-1">
                          <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">Your choice</span>
                        </div>
                      )}
                      {isWinning && !isSelected && (
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium text-green-600">🏆 Leading</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {showResults && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            isSelected 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                              : isWinning 
                              ? 'bg-gradient-to-r from-green-500 to-green-600'
                              : 'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
                          style={{ 
                            width: `${percentage}%`,
                            animationDelay: `${index * 200}ms`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </TouchFeedbackButton>
              </div>
            )
          })}
        </div>

        {/* Chart Toggle */}
        {(hasVoted || isExpired) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowChart(!showChart)}
              className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ChartBarIcon className="h-4 w-4" />
              <span>{showChart ? 'Hide Chart' : 'Show Chart'}</span>
            </button>
          </div>
        )}

        {/* Chart Visualization */}
        {showChart && (hasVoted || isExpired) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <PollChart 
              options={localVotes}
              totalVotes={localVotes.reduce((sum, option) => sum + option.votes, 0)}
              type="doughnut"
              height={250}
            />
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button className="group flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
              <div className="p-1.5 rounded-lg group-hover:bg-blue-100 transition-colors">
                <ChatBubbleLeftIcon className="h-4 w-4" />
              </div>
              <span className="font-medium">{t('comments')}</span>
              <span className="text-xs bg-gray-200 group-hover:bg-blue-200 text-gray-600 group-hover:text-blue-700 px-2 py-0.5 rounded-full transition-colors">
                {poll.totalComments || 0}
              </span>
            </button>
            <button className="group flex items-center space-x-2 text-sm text-gray-600 hover:text-purple-600 transition-colors">
              <div className="p-1.5 rounded-lg group-hover:bg-purple-100 transition-colors">
                <ShareIcon className="h-4 w-4" />
              </div>
              <span className="font-medium">{t('share')}</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {poll.newsSourceUrl && (
              <a
                href={poll.newsSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all duration-200"
              >
                <NewspaperIcon className="h-4 w-4" />
                <span className="font-medium">View Source</span>
              </a>
            )}
            <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-lg border">
              {formatTimeAgo(poll.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}