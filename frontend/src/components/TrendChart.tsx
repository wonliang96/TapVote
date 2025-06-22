'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { CalendarIcon } from '@heroicons/react/24/outline'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface TrendData {
  date: string
  options: Array<{
    optionId: string
    optionText: string
    votes: number
    percentage: number
  }>
}

interface TrendChartProps {
  pollId: string
  options: Array<{
    id: string
    text: string
  }>
}

export default function TrendChart({ pollId, options }: TrendChartProps) {
  const { t } = useTranslation()
  const [trendData, setTrendData] = useState<Record<string, TrendData>>({})
  const [selectedDays, setSelectedDays] = useState(7)
  const [loading, setLoading] = useState(true)

  const colors = [
    '#3B82F6', // blue-500
    '#EF4444', // red-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#8B5CF6', // violet-500
    '#06B6D4', // cyan-500
  ]

  useEffect(() => {
    const fetchTrendData = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/polls/${pollId}/analytics?days=${selectedDays}`
        )
        const data = await response.json()
        setTrendData(data.analytics || {})
      } catch (error) {
        console.error('Failed to fetch trend data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrendData()
  }, [pollId, selectedDays])

  const chartData = {
    labels: Object.keys(trendData).sort(),
    datasets: options.map((option, index) => ({
      label: option.text,
      data: Object.keys(trendData)
        .sort()
        .map(date => {
          const dayData = trendData[date]
          const optionData = dayData?.find(d => d.optionId === option.id)
          return optionData?.percentage || 0
        }),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6
    }))
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.raw}%`
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Percentage (%)'
        },
        min: 0,
        max: 100
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  }

  const dayOptions = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' }
  ]

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 rounded w-32"></div>
            <div className="h-8 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const hasData = Object.keys(trendData).length > 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            Opinion Trends Over Time
          </h3>
        </div>
        
        <select
          value={selectedDays}
          onChange={(e) => setSelectedDays(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {dayOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {hasData ? (
        <div style={{ height: '300px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No trend data available yet</p>
            <p className="text-sm">Check back after a few days of voting activity</p>
          </div>
        </div>
      )}

      {hasData && (
        <div className="mt-4 text-sm text-gray-600">
          <p>
            Showing percentage distribution over the last {selectedDays} days. 
            Data is captured daily to track how opinions change over time.
          </p>
        </div>
      )}
    </div>
  )
}