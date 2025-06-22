'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface SwipeableCardProps {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  className?: string
}

export function SwipeableCard({ children, onSwipeLeft, onSwipeRight, className = '' }: SwipeableCardProps) {
  const [startX, setStartX] = useState(0)
  const [currentX, setCurrentX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX)
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const x = e.touches[0].clientX
    setCurrentX(x - startX)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    
    const threshold = 100
    if (Math.abs(currentX) > threshold) {
      if (currentX > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (currentX < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }
    
    setIsDragging(false)
    setCurrentX(0)
  }

  return (
    <div
      ref={cardRef}
      className={`touch-pan-x ${className}`}
      style={{
        transform: isDragging ? `translateX(${currentX * 0.3}px)` : 'translateX(0)',
        transition: isDragging ? 'none' : 'transform 0.3s ease-out'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  )
}

interface TouchFeedbackButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function TouchFeedbackButton({ 
  children, 
  onClick, 
  disabled = false, 
  className = '',
  variant = 'primary'
}: TouchFeedbackButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  
  const baseClasses = 'touch-target tap-feedback transition-all duration-150 rounded-xl font-semibold text-center'
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg active:shadow-md',
    secondary: 'bg-white border-2 border-gray-200 text-gray-700 shadow-sm active:shadow-none',
    ghost: 'bg-transparent text-blue-600 active:bg-blue-50'
  }
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      onTouchStart={() => !disabled && setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        transform: isPressed && !disabled ? 'scale(0.95)' : 'scale(1)'
      }}
    >
      {children}
    </button>
  )
}

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [startY, setStartY] = useState(0)
  
  const threshold = 100

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      const currentY = e.touches[0].clientY
      const distance = Math.max(0, currentY - startY)
      setPullDistance(Math.min(distance, threshold * 1.5))
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      await onRefresh()
      setIsRefreshing(false)
    }
    setPullDistance(0)
  }

  return (
    <div
      className="pull-to-refresh"
      style={{
        transform: `translateY(${Math.min(pullDistance * 0.5, 30)}px)`
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {pullDistance > 20 && (
        <div className="flex justify-center py-4">
          <div className={`transition-all duration-300 ${
            isRefreshing 
              ? 'animate-spin text-blue-600' 
              : pullDistance >= threshold 
              ? 'text-green-600 scale-110' 
              : 'text-gray-400'
          }`}>
            {isRefreshing ? (
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="text-2xl">
                {pullDistance >= threshold ? '🚀' : '⬇️'}
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

// Mobile-optimized bottom sheet for mobile actions
interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
}

export function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className={`
        absolute bottom-0 left-0 right-0 
        bg-white rounded-t-2xl shadow-2xl
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        max-h-[80vh] overflow-y-auto
      `}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        {/* Title */}
        {title && (
          <div className="px-6 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
        )}
        
        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Mobile optimized FAB (Floating Action Button)
interface FABProps {
  onClick: () => void
  icon: ReactNode
  label?: string
  className?: string
}

export function FloatingActionButton({ onClick, icon, label, className = '' }: FABProps) {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-40
        w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600
        text-white rounded-full shadow-2xl
        flex items-center justify-center
        transition-all duration-300 ease-out
        hover:scale-110 active:scale-95
        hover:shadow-3xl
        ${className}
      `}
      aria-label={label}
    >
      {icon}
    </button>
  )
}