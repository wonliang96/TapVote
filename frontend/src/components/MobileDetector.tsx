'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface MobileDetectorProps {
  children: React.ReactNode
  forceMobile?: boolean
}

export default function MobileDetector({ children, forceMobile = false }: MobileDetectorProps) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if user prefers mobile view
    const prefersMobile = localStorage.getItem('prefersMobile') === 'true'
    
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isSmallScreen = window.innerWidth <= 768
    
    // Force mobile view if requested or on mobile device/small screen
    if (forceMobile || prefersMobile || isMobile || isSmallScreen) {
      if (!window.location.pathname.startsWith('/mobile')) {
        router.push('/mobile')
      }
    }
  }, [router, forceMobile])

  return <>{children}</>
}