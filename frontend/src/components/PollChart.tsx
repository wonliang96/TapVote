'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface PollOption {
  id: string
  text: string
  votes: number
}

interface VoteHistory {
  timestamp: string
  optionId: string
  votes: number
}

interface PollChartProps {
  options: PollOption[]
  totalVotes: number
  type?: 'bar' | 'doughnut' | 'line' | 'timeline'
  height?: number
  voteHistory?: VoteHistory[]
}

export default function PollChart({ 
  options, 
  totalVotes, 
  type = 'bar',
  height = 300,
  voteHistory = []
}: PollChartProps) {
  const colors = [
    '#3B82F6', // blue-500
    '#EF4444', // red-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#8B5CF6', // violet-500
    '#06B6D4', // cyan-500
  ]

  // Generate timeline data if type is timeline
  const getTimelineData = () => {
    if (type !== 'timeline' || !voteHistory.length) {
      return {
        labels: options.map(option => option.text),
        datasets: [
          {
            label: 'Votes',
            data: options.map(option => option.votes),
            backgroundColor: type === 'doughnut' 
              ? colors.slice(0, options.length)
              : colors[0] + '80',
            borderColor: type === 'doughnut' 
              ? colors.slice(0, options.length)
              : colors[0],
            borderWidth: 2,
            ...(type === 'line' && {
              fill: false,
              tension: 0.4
            })
          }
        ]
      }
    }

    // Group vote history by timestamp
    const timeLabels = [...new Set(voteHistory.map(v => new Date(v.timestamp).toLocaleDateString()))].sort()
    
    const datasets = options.map((option, index) => {
      const optionHistory = voteHistory.filter(v => v.optionId === option.id)
      const data = timeLabels.map(timeLabel => {
        const dayHistory = optionHistory.filter(v => 
          new Date(v.timestamp).toLocaleDateString() === timeLabel
        )
        return dayHistory.length > 0 ? dayHistory[dayHistory.length - 1].votes : 0
      })

      return {
        label: option.text,
        data,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        fill: false,
        tension: 0.4
      }
    })

    return { labels: timeLabels, datasets }
  }

  const data = getTimelineData()

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: type === 'doughnut' ? 'right' : 'top',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const percentage = totalVotes > 0 
              ? Math.round((context.raw / totalVotes) * 100)
              : 0
            return `${context.label}: ${context.raw} votes (${percentage}%)`
          }
        }
      }
    }
  }

  const chartOptions = {
    ...commonOptions,
    ...(type !== 'doughnut' && {
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    })
  }

  const renderChart = () => {
    switch (type) {
      case 'doughnut':
        return <Doughnut data={data} options={chartOptions} />
      case 'line':
      case 'timeline':
        return <Line data={data} options={chartOptions} />
      default:
        return <Bar data={data} options={chartOptions} />
    }
  }

  return (
    <div style={{ height }}>
      {renderChart()}
    </div>
  )
}