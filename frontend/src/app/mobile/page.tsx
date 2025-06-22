'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import Header from '@/components/Header'
import MobilePollCard from '@/components/MobilePollCard'
import { 
  FireIcon, 
  BoltIcon, 
  TrophyIcon,
  PlusIcon,
  Bars3Icon
} from '@heroicons/react/24/outline'
import { getApiUrl } from '@/lib/config'

interface Poll {
  id: string
  title: string
  question?: string
  description?: string
  options: Array<{
    id: string
    text: string
    votes: number
    percentage?: number
  }>
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

export default function MobilePage() {
  const { t, i18n } = useTranslation()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trending' | 'predictions' | 'all'>('trending')
  const [generatingAI, setGeneratingAI] = useState(false)

  useEffect(() => {
    if (i18n.isInitialized) {
      fetchPolls()
    }
  }, [i18n.language, i18n.isInitialized])

  const fetchPolls = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/polls?language=${i18n.language}`))
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const data = await response.json()
      const pollsWithDates = (data.polls || []).map((poll: any) => ({
        ...poll,
        question: poll.title,
        createdAt: new Date(poll.createdAt),
        expiresAt: poll.expiresAt ? new Date(poll.expiresAt) : null,
        category: poll.category || { slug: 'general', name: 'General', icon: '📊', color: '#3B82F6' },
        totalVotes: poll.totalVotes || 0,
        totalComments: poll.totalComments || 0,
        totalPredictions: poll.totalPredictions || 0,
        userVoted: poll.userVoted || false,
        isFromNews: poll.sourceType === 'NEWS',
        aiGenerated: poll.aiGenerated || false,
        isTrending: poll.isTrending || false,
        creator: poll.creator || { id: 'unknown', username: 'unknown', displayName: 'TapVote' },
        description: poll.description || null
      }))
      setPolls(pollsWithDates)
    } catch (error) {
      console.error('Failed to fetch polls:', error)
      setPolls([])
    } finally {
      setLoading(false)
    }
  }

  const generateAIPoll = async () => {
    if (generatingAI) return
    
    setGeneratingAI(true)
    try {
      const response = await fetch(getApiUrl('/api/ai-polls/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'technology',
          difficulty: 'MEDIUM',
          language: i18n.language
        })
      })

      if (response.ok) {
        await fetchPolls()
      }
    } catch (error) {
      console.error('Error generating AI poll:', error)
    } finally {
      setGeneratingAI(false)
    }
  }

  const trendingPolls = polls.filter(poll => poll.isTrending)
  const predictionPolls = polls.filter(poll => poll.totalPredictions > 0)
  const aiPolls = polls.filter(poll => poll.aiGenerated)

  const getFilteredPolls = () => {
    switch (activeTab) {
      case 'trending': return trendingPolls
      case 'predictions': return predictionPolls
      default: return polls
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="px-4 py-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 rounded mb-1 w-20"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </div>
                </div>
                <div className="h-5 bg-gray-200 rounded mb-3 w-3/4"></div>
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-10 bg-gray-100 rounded-xl"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Mobile Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">TapVote</h1>
          <p className="text-blue-100 text-sm">
            Predict the future, earn rewards
          </p>
          <div className="flex justify-center space-x-4 mt-4 text-xs">
            <div className="text-center">
              <div className="font-semibold">{polls.length}+</div>
              <div className="text-blue-200">Active Markets</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">24/7</div>
              <div className="text-blue-200">Live Trading</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">AI</div>
              <div className="text-blue-200">Powered</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex">
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center ${
              activeTab === 'trending'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <FireIcon className="h-4 w-4" />
              <span>Trending</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center ${
              activeTab === 'predictions'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <TrophyIcon className="h-4 w-4" />
              <span>Markets</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <Bars3Icon className="h-4 w-4" />
              <span>All</span>
            </div>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex space-x-2">
          <Link
            href="/create"
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-xl text-sm font-medium text-center active:scale-95 transition-transform"
          >
            + Create Poll
          </Link>
          <button
            onClick={generateAIPoll}
            disabled={generatingAI}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-xl text-sm font-medium text-center active:scale-95 transition-transform disabled:opacity-50"
          >
            {generatingAI ? '⚡ Generating...' : '🤖 AI Poll'}
          </button>
        </div>
      </div>

      {/* Polls List */}
      <div className="px-4 py-4">
        {getFilteredPolls().length > 0 ? (
          <div className="space-y-4">
            {getFilteredPolls().map((poll) => (
              <MobilePollCard key={poll.id} poll={poll} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No {activeTab} polls yet
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Be the first to create a poll and start earning!
            </p>
            <Link
              href="/create"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Poll
            </Link>
          </div>
        )}
      </div>

      {/* Bottom padding for mobile */}
      <div className="h-20"></div>
    </div>
  )
}