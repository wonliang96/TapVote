'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import Header from '@/components/Header'
import PollCard from '@/components/PollCard'
import PredictionMarketCard from '@/components/PredictionMarketCard'
import MobileDetector from '@/components/MobileDetector'
import { PullToRefresh, FloatingActionButton } from '@/components/MobileOptimized'
import { FireIcon, ChartBarIcon, PlusIcon, TrophyIcon } from '@heroicons/react/24/outline'
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
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)

  useEffect(() => {
    // Only fetch when i18n is ready
    if (i18n.isInitialized) {
      fetchPolls()
    }
  }, [i18n.language, i18n.isInitialized])

  const fetchPolls = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const response = await fetch(getApiUrl(`/api/polls?language=${i18n.language}`), {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const pollsWithDates = (data.polls || []).map((poll: any) => ({
        ...poll,
        question: poll.title, // Map title to question for backwards compatibility
        createdAt: new Date(poll.createdAt),
        expiresAt: poll.expiresAt ? new Date(poll.expiresAt) : null,
        category: poll.category || { slug: 'general', name: 'General' },
        totalVotes: poll.totalVotes || 0,
        totalComments: poll.totalComments || 0,
        totalPredictions: poll.totalPredictions || 0,
        userVoted: poll.userVoted || false,
        isFromNews: poll.sourceType === 'NEWS',
        aiGenerated: poll.aiGenerated || false,
        isTrending: poll.isTrending || false,
        creator: poll.creator || { id: 'unknown', username: 'unknown', displayName: 'Unknown' },
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

  const trendingPolls = polls.filter(poll => poll.isTrending)
  const aiPolls = polls.filter(poll => poll.aiGenerated)
  const newsPolls = polls.filter(poll => poll.isFromNews)
  const regularPolls = polls.filter(poll => !poll.aiGenerated && !poll.isFromNews && !poll.isTrending)
  const predictionMarkets = polls.filter(poll => poll.totalPredictions > 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            {/* Hero skeleton */}
            <div className="text-center py-16 sm:py-24 mb-16">
              <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 max-w-2xl mx-auto"></div>
              <div className="h-6 bg-gray-200 rounded-lg mb-8 max-w-xl mx-auto"></div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <div className="h-12 w-32 bg-gray-200 rounded-xl"></div>
                <div className="h-12 w-40 bg-gray-200 rounded-xl"></div>
                <div className="h-12 w-28 bg-gray-200 rounded-xl"></div>
              </div>
            </div>
            
            {/* Polls skeleton */}
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 mb-4"></div>
                  <div className="p-6">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                      <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded-lg mb-4 w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded-lg mb-6 w-1/2"></div>
                    <div className="space-y-4">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="h-16 bg-gray-100 rounded-xl"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  const handleRefresh = async () => {
    await fetchPolls()
  }

  const generateAIPoll = async () => {
    if (generatingAI) return
    
    setGeneratingAI(true)
    try {
      const response = await fetch(getApiUrl('/api/ai-polls/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'technology',
          difficulty: 'MEDIUM',
          language: i18n.language
        })
      })

      if (response.ok) {
        // Refresh polls to show the new AI-generated poll
        await fetchPolls()
        // Show success message
        setNotification({type: 'success', message: '🤖 AI Poll generated successfully!'})
        setTimeout(() => setNotification(null), 5000)
      } else {
        throw new Error('Failed to generate AI poll')
      }
    } catch (error) {
      console.error('Error generating AI poll:', error)
      setNotification({type: 'error', message: 'Failed to generate AI poll. Please try again.'})
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setGeneratingAI(false)
    }
  }

  return (
    <MobileDetector>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Header />
      
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border max-w-sm transform transition-all duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Hero Section */}
        <div className="relative py-16 sm:py-24">
          <div className="text-center">
            {/* Floating background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-20 left-10 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
              <div className="absolute top-20 right-10 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
              <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>
            
            <div className="relative z-10">
              <div className="mb-8">
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium mb-4">
                  🌍 Multilingual • 🗳️ Real-time • 📊 Analytics
                </span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {t('appName')}
                </span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
                Create, vote, and discuss on polls in{' '}
                <span className="font-semibold text-blue-600">multiple languages</span>.
                <br />
                Share your opinions and see what the world thinks.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <Link 
                  href="/create"
                  className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('createPoll')}
                </Link>

                <button 
                  onClick={() => generateAIPoll()}
                  disabled={generatingAI}
                  className={`group inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl ${generatingAI ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  {generatingAI ? (
                    <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                  {generatingAI ? 'Generating...' : '🤖 Generate AI Poll'}
                </button>
                
                <Link 
                  href="/categories"
                  className="inline-flex items-center px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
                  </svg>
                  {t('categories')}
                </Link>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{polls.length}+</div>
                  <div className="text-gray-600">Active Polls</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">3</div>
                  <div className="text-gray-600">Languages</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-pink-600">∞</div>
                  <div className="text-gray-600">Opinions</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trending Section */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl">
                <FireIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {t('trending')}
                </h2>
                <p className="text-gray-600">Most popular polls right now</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <div className="flex items-center px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></div>
                Live
              </div>
            </div>
          </div>

          {trendingPolls.length > 0 ? (
            <div className="grid gap-6">
              {trendingPolls.map((poll, index) => (
                <div key={poll.id} className="transform hover:scale-[1.01] transition-all duration-200">
                  <div className="relative">
                    {index === 0 && (
                      <div className="absolute -top-3 -left-3 z-10">
                        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                          🔥 Trending #1
                        </div>
                      </div>
                    )}
                    <PollCard poll={poll} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mb-6">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">📊</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                No polls available yet
              </h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Be the first to create a poll and start the conversation! Share your thoughts with the world.
              </p>
              <Link 
                href="/create"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200"
              >
                Create First Poll
              </Link>
            </div>
          )}
        </div>

        {/* AI-Generated Polls Section */}
        {aiPolls.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    🤖 AI-Generated Polls
                  </h2>
                  <p className="text-gray-600">Powered by trending topics and news</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-2">
                <div className="flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
                  AI-Powered
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              {aiPolls.map((poll) => (
                <div key={poll.id} className="transform hover:scale-[1.01] transition-all duration-200">
                  <div className="relative">
                    <div className="absolute -top-3 -right-3 z-10">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg flex items-center space-x-1">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        <span>AI {poll.aiConfidence && `${Math.round(poll.aiConfidence * 100)}%`}</span>
                      </div>
                    </div>
                    <PollCard poll={poll} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prediction Markets Section */}
        {predictionMarkets.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl">
                  <TrophyIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    🎯 Prediction Markets
                  </h2>
                  <p className="text-gray-600">Place your bets and test your forecasting skills</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-2">
                <div className="flex items-center px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
                  Live Markets
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {predictionMarkets.map((poll) => (
                <PredictionMarketCard
                  key={poll.id}
                  pollId={poll.id}
                  title={poll.title}
                  totalPredictions={poll.totalPredictions}
                  className="transform hover:scale-[1.02] transition-all duration-200"
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular Polls Section */}
        {regularPolls.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Community Polls
                  </h2>
                  <p className="text-gray-600">Created by our community members</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              {regularPolls.map((poll) => (
                <div key={poll.id} className="transform hover:scale-[1.01] transition-all duration-200">
                  <PollCard poll={poll} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending News Polls */}
        {newsPolls.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-6">
              <ChartBarIcon className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-gray-900">
                {t('trendingNewsPolls')}
              </h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {t('basedOnNews')}
              </span>
            </div>

            <div className="space-y-6">
              {newsPolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              ))}
            </div>
          </div>
        )}
        </main>
      </PullToRefresh>
      
      {/* Mobile Floating Action Button */}
      <div className="md:hidden">
        <FloatingActionButton
          onClick={() => window.location.href = '/create'}
          icon={<PlusIcon className="h-6 w-6" />}
          label="Create Poll"
        />
        </div>
      </div>
    </MobileDetector>
  )
}
