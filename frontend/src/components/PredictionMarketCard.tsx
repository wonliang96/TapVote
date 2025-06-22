'use client'

import { useState, useEffect } from 'react'
import { 
  TrophyIcon, 
  CurrencyDollarIcon,
  ChartBarIcon,
  StarIcon,
  BoltIcon
} from '@heroicons/react/24/outline'

interface MarketOdds {
  optionId: string
  option: string
  probability: number | null
  impliedOdds: string
  volume: number
  trend: 'up' | 'down' | 'stable'
  confidence: number
}

interface PredictionMarketCardProps {
  pollId: string
  title: string
  totalPredictions: number
  className?: string
}

export default function PredictionMarketCard({ 
  pollId, 
  title, 
  totalPredictions,
  className = '' 
}: PredictionMarketCardProps) {
  const [marketOdds, setMarketOdds] = useState<MarketOdds[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMarketOdds()
  }, [pollId])

  const fetchMarketOdds = async () => {
    try {
      const response = await fetch(`http://localhost:5003/api/predictions/polls/${pollId}/odds`)
      if (response.ok) {
        const data = await response.json()
        setMarketOdds(data)
      }
    } catch (error) {
      console.error('Failed to fetch market odds:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <span className="text-green-500">↗️</span>
      case 'down':
        return <span className="text-red-500">↘️</span>
      default:
        return <span className="text-gray-400">→</span>
    }
  }

  const getTopOption = () => {
    return marketOdds.reduce((top, current) => 
      (current.probability || 0) > (top.probability || 0) ? current : top
    , marketOdds[0])
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const topOption = getTopOption()

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <TrophyIcon className="h-5 w-5" />
            </div>
            <span className="font-semibold">Prediction Market</span>
          </div>
          <div className="flex items-center space-x-1">
            <BoltIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{totalPredictions} predictions</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 line-clamp-2">
          {title}
        </h3>

        {marketOdds.length > 0 ? (
          <div className="space-y-3">
            {marketOdds.slice(0, 3).map((odds, index) => (
              <div 
                key={odds.optionId}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  index === 0 && topOption.optionId === odds.optionId
                    ? 'border-green-300 bg-gradient-to-r from-green-50 to-green-100'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {index === 0 && topOption.optionId === odds.optionId && (
                      <div className="flex items-center space-x-1">
                        <StarIcon className="h-4 w-4 text-green-600 fill-current" />
                        <span className="text-xs font-semibold text-green-700">LEADING</span>
                      </div>
                    )}
                    <span className="font-medium text-gray-900 flex-1">
                      {odds.option}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center space-x-1">
                        <span className="text-sm font-bold text-gray-900">
                          {odds.probability ? `${Math.round(odds.probability * 100)}%` : 'N/A'}
                        </span>
                        {getTrendIcon(odds.trend)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {odds.impliedOdds}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center space-x-1">
                        <CurrencyDollarIcon className="h-3 w-3 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">
                          {odds.volume}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        volume
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar for probability */}
                {odds.probability && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          index === 0 && topOption.optionId === odds.optionId
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : 'bg-gradient-to-r from-blue-400 to-purple-500'
                        }`}
                        style={{ width: `${odds.probability * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {marketOdds.length > 3 && (
              <div className="text-center pt-2">
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  View all {marketOdds.length} options →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChartBarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">
              No predictions yet. Be the first to predict!
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <TrophyIcon className="h-4 w-4" />
              <span>{totalPredictions} predictions</span>
            </div>
            {marketOdds.length > 0 && (
              <div className="flex items-center space-x-1">
                <ChartBarIcon className="h-4 w-4" />
                <span>{marketOdds.length} options</span>
              </div>
            )}
          </div>
          
          <button className="inline-flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            <span>Place Prediction</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}