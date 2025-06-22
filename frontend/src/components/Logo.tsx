'use client'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Logo({ className = '', showText = true, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: showText ? 'h-8' : 'h-6 w-6',
    md: showText ? 'h-10' : 'h-8 w-8', 
    lg: showText ? 'h-12' : 'h-10 w-10'
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Logo Icon */}
      <div className={`${sizeClasses[size]} flex items-center justify-center`}>
        <svg 
          viewBox="0 0 40 40" 
          className="w-full h-full"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background Circle */}
          <circle 
            cx="20" 
            cy="20" 
            r="18" 
            fill="url(#gradient)" 
            stroke="url(#borderGradient)" 
            strokeWidth="2"
          />
          
          {/* Voting Box Icon */}
          <rect 
            x="12" 
            y="13" 
            width="16" 
            height="12" 
            rx="2" 
            fill="white" 
            opacity="0.9"
          />
          
          {/* Ballot Slot */}
          <rect 
            x="18" 
            y="10" 
            width="4" 
            height="6" 
            rx="1" 
            fill="white" 
            opacity="0.8"
          />
          
          {/* Checkmarks */}
          <path 
            d="M15 18 L17 20 L21 16" 
            stroke="#3B82F6" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          
          {/* Definitions */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#BE185D" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* Logo Text */}
      {showText && (
        <span className={`font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent ${textSizes[size]}`}>
          TapVote
        </span>
      )}
    </div>
  )
}