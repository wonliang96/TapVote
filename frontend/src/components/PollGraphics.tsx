'use client'

import { useMemo } from 'react'

interface PollGraphicsProps {
  question: string
  category: string
  options: Array<{ text: string; votes: number }>
  className?: string
}

// Generate graphics based on poll content
export function PollGraphic({ question, category, options, className = '' }: PollGraphicsProps) {
  const graphic = useMemo(() => {
    // Determine graphic type based on category and content
    const lowerQuestion = question.toLowerCase()
    const lowerCategory = category.toLowerCase()
    
    // Technology-related polls
    if (lowerCategory.includes('tech') || 
        lowerQuestion.includes('ai') || 
        lowerQuestion.includes('technology') ||
        lowerQuestion.includes('programming') ||
        lowerQuestion.includes('software')) {
      return {
        type: 'technology',
        icon: '💻',
        gradient: 'from-blue-500 to-cyan-500',
        pattern: 'tech'
      }
    }
    
    // Environment/climate polls
    if (lowerCategory.includes('environment') || 
        lowerQuestion.includes('climate') ||
        lowerQuestion.includes('green') ||
        lowerQuestion.includes('sustainable') ||
        lowerQuestion.includes('renewable')) {
      return {
        type: 'environment',
        icon: '🌱',
        gradient: 'from-green-500 to-emerald-500',
        pattern: 'nature'
      }
    }
    
    // Politics polls
    if (lowerCategory.includes('politic') || 
        lowerQuestion.includes('election') ||
        lowerQuestion.includes('government') ||
        lowerQuestion.includes('policy')) {
      return {
        type: 'politics',
        icon: '🗳️',
        gradient: 'from-red-500 to-blue-500',
        pattern: 'civic'
      }
    }
    
    // Sports polls
    if (lowerCategory.includes('sport') || 
        lowerQuestion.includes('team') ||
        lowerQuestion.includes('game') ||
        lowerQuestion.includes('championship')) {
      return {
        type: 'sports',
        icon: '⚽',
        gradient: 'from-orange-500 to-yellow-500',
        pattern: 'sports'
      }
    }
    
    // Entertainment polls
    if (lowerCategory.includes('entertainment') || 
        lowerQuestion.includes('movie') ||
        lowerQuestion.includes('music') ||
        lowerQuestion.includes('celebrity')) {
      return {
        type: 'entertainment',
        icon: '🎬',
        gradient: 'from-purple-500 to-pink-500',
        pattern: 'entertainment'
      }
    }
    
    // Business/economy polls
    if (lowerCategory.includes('business') || 
        lowerQuestion.includes('economy') ||
        lowerQuestion.includes('market') ||
        lowerQuestion.includes('finance')) {
      return {
        type: 'business',
        icon: '📈',
        gradient: 'from-indigo-500 to-purple-500',
        pattern: 'business'
      }
    }
    
    // Default generic poll
    return {
      type: 'general',
      icon: '💭',
      gradient: 'from-gray-500 to-slate-500',
      pattern: 'general'
    }
  }, [question, category])

  const renderPattern = () => {
    switch (graphic.pattern) {
      case 'tech':
        return (
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
            <rect x="10" y="10" width="20" height="20" rx="2" fill="currentColor" />
            <rect x="40" y="10" width="20" height="20" rx="2" fill="currentColor" />
            <rect x="70" y="10" width="20" height="20" rx="2" fill="currentColor" />
            <rect x="25" y="40" width="20" height="20" rx="2" fill="currentColor" />
            <rect x="55" y="40" width="20" height="20" rx="2" fill="currentColor" />
            <rect x="10" y="70" width="20" height="20" rx="2" fill="currentColor" />
            <rect x="40" y="70" width="20" height="20" rx="2" fill="currentColor" />
            <rect x="70" y="70" width="20" height="20" rx="2" fill="currentColor" />
            <path d="M30 20 L40 20 M60 20 L70 20 M35 50 L55 50" stroke="currentColor" strokeWidth="1" />
          </svg>
        )
      
      case 'nature':
        return (
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
            <path d="M20 80 Q30 60 40 80 Q50 60 60 80 Q70 60 80 80" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="25" cy="30" r="8" fill="currentColor" />
            <circle cx="45" cy="25" r="6" fill="currentColor" />
            <circle cx="65" cy="35" r="7" fill="currentColor" />
            <circle cx="75" cy="20" r="5" fill="currentColor" />
            <path d="M15 85 L85 85" stroke="currentColor" strokeWidth="3" />
          </svg>
        )
      
      case 'civic':
        return (
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
            <rect x="30" y="20" width="40" height="60" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="35" y="30" width="8" height="6" fill="currentColor" />
            <rect x="57" y="30" width="8" height="6" fill="currentColor" />
            <rect x="35" y="45" width="30" height="3" fill="currentColor" />
            <rect x="35" y="55" width="25" height="3" fill="currentColor" />
            <rect x="35" y="65" width="20" height="3" fill="currentColor" />
          </svg>
        )
      
      case 'sports':
        return (
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M25 50 Q50 25 75 50 Q50 75 25 50" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M50 25 Q75 50 50 75 Q25 50 50 25" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="50" cy="50" r="3" fill="currentColor" />
          </svg>
        )
      
      case 'entertainment':
        return (
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
            <polygon points="30,70 50,20 70,70 60,70 50,40 40,70" fill="currentColor" />
            <circle cx="25" cy="25" r="8" fill="currentColor" />
            <circle cx="75" cy="25" r="8" fill="currentColor" />
            <circle cx="20" cy="75" r="6" fill="currentColor" />
            <circle cx="80" cy="75" r="6" fill="currentColor" />
          </svg>
        )
      
      case 'business':
        return (
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
            <rect x="20" y="60" width="8" height="20" fill="currentColor" />
            <rect x="35" y="45" width="8" height="35" fill="currentColor" />
            <rect x="50" y="30" width="8" height="50" fill="currentColor" />
            <rect x="65" y="50" width="8" height="30" fill="currentColor" />
            <path d="M20 60 L35 45 L50 30 L65 50 L80 25" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        )
      
      default:
        return (
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
            <circle cx="30" cy="30" r="15" fill="currentColor" />
            <circle cx="70" cy="30" r="10" fill="currentColor" />
            <circle cx="30" cy="70" r="8" fill="currentColor" />
            <circle cx="70" cy="70" r="12" fill="currentColor" />
            <circle cx="50" cy="50" r="6" fill="currentColor" />
          </svg>
        )
    }
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${graphic.gradient} opacity-20`} />
      
      {/* Pattern overlay */}
      <div className="relative z-10 text-white">
        {renderPattern()}
      </div>
      
      {/* Main icon */}
      <div className="absolute top-4 right-4 text-3xl z-20 opacity-80">
        {graphic.icon}
      </div>
      
      {/* Optional animated elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-2 left-2 w-2 h-2 bg-white rounded-full opacity-60 animate-pulse`} />
        <div className={`absolute bottom-4 left-6 w-1 h-1 bg-white rounded-full opacity-40 animate-pulse`} style={{ animationDelay: '1s' }} />
        <div className={`absolute top-8 right-8 w-1.5 h-1.5 bg-white rounded-full opacity-50 animate-pulse`} style={{ animationDelay: '2s' }} />
      </div>
    </div>
  )
}

// AI-generated avatars for poll options
export function OptionAvatar({ text, index, className = '' }: { text: string; index: number; className?: string }) {
  const colors = [
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-green-400 to-green-600', 
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-cyan-400 to-cyan-600'
  ]
  
  const emojis = ['🚀', '⭐', '💎', '🔥', '⚡', '🌟', '💫', '🎯', '🏆', '💡']
  
  // Generate deterministic emoji based on text
  const textHash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const emoji = emojis[textHash % emojis.length]
  
  return (
    <div className={`
      w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg
      ${colors[index % colors.length]} ${className}
    `}>
      {emoji}
    </div>
  )
}

// Data visualization components
export function MiniChart({ data, type = 'bar', className = '' }: { 
  data: number[]; 
  type?: 'bar' | 'line' | 'area'; 
  className?: string 
}) {
  const max = Math.max(...data)
  const normalized = data.map(val => (val / max) * 100)
  
  if (type === 'bar') {
    return (
      <div className={`flex items-end space-x-1 h-8 ${className}`}>
        {normalized.map((height, index) => (
          <div
            key={index}
            className="bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-sm min-w-2 transition-all duration-500"
            style={{ 
              height: `${Math.max(height, 8)}%`,
              animationDelay: `${index * 100}ms`
            }}
          />
        ))}
      </div>
    )
  }
  
  return (
    <svg className={`w-full h-8 ${className}`} viewBox="0 0 100 30">
      <path
        d={`M 0 ${30 - (normalized[0] * 0.25)} ${normalized.map((val, idx) => 
          `L ${(idx / (normalized.length - 1)) * 100} ${30 - (val * 0.25)}`
        ).join(' ')}`}
        stroke="url(#gradient)"
        strokeWidth="2"
        fill="none"
        className="animate-pulse"
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  )
}