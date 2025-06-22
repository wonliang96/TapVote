'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'

interface OAuthLoginProps {
  onSuccess?: (user: any) => void
  onError?: (error: string) => void
  className?: string
}

export default function OAuthLogin({ onSuccess, onError, className = '' }: OAuthLoginProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  // Google OAuth login
  const handleGoogleLogin = async () => {
    setLoading('google')
    
    try {
      // In production, this would use Google's OAuth SDK
      // For demo purposes, we'll simulate the OAuth flow
      
      // Create a popup window for OAuth
      const width = 500
      const height = 600
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      
      // Simulate OAuth redirect URL
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=your-google-client-id&` +
        `redirect_uri=${encodeURIComponent(window.location.origin + '/auth/google/callback')}&` +
        `scope=email profile&` +
        `response_type=code&` +
        `state=${Math.random().toString(36).substring(7)}`
      
      const popup = window.open(
        authUrl,
        'google-oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      )
      
      // Listen for the popup to close or receive a message
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          setLoading(null)
          
          // Simulate successful OAuth response
          setTimeout(() => {
            const mockUser = {
              id: 'google_' + Math.random().toString(36).substring(7),
              email: 'user@gmail.com',
              name: 'Google User',
              provider: 'google',
              avatar: 'https://via.placeholder.com/100?text=G'
            }
            
            // Store auth data
            localStorage.setItem('token', 'mock-google-jwt-token')
            localStorage.setItem('user', JSON.stringify(mockUser))
            
            onSuccess?.(mockUser)
            router.push('/')
          }, 1000)
        }
      }, 1000)
      
    } catch (error) {
      console.error('Google OAuth error:', error)
      onError?.('Failed to sign in with Google')
      setLoading(null)
    }
  }

  // Apple OAuth login
  const handleAppleLogin = async () => {
    setLoading('apple')
    
    try {
      // In production, this would use Apple's Sign In SDK
      // For demo purposes, we'll simulate the OAuth flow
      
      const width = 500
      const height = 600
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      
      // Simulate Apple Sign In URL
      const authUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=your-apple-client-id&` +
        `redirect_uri=${encodeURIComponent(window.location.origin + '/auth/apple/callback')}&` +
        `scope=name email&` +
        `response_type=code&` +
        `response_mode=form_post&` +
        `state=${Math.random().toString(36).substring(7)}`
      
      const popup = window.open(
        authUrl,
        'apple-oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      )
      
      // Listen for the popup to close
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          setLoading(null)
          
          // Simulate successful OAuth response
          setTimeout(() => {
            const mockUser = {
              id: 'apple_' + Math.random().toString(36).substring(7),
              email: 'user@icloud.com',
              name: 'Apple User',
              provider: 'apple',
              avatar: 'https://via.placeholder.com/100?text=🍎'
            }
            
            // Store auth data
            localStorage.setItem('token', 'mock-apple-jwt-token')
            localStorage.setItem('user', JSON.stringify(mockUser))
            
            onSuccess?.(mockUser)
            router.push('/')
          }, 1000)
        }
      }, 1000)
      
    } catch (error) {
      console.error('Apple OAuth error:', error)
      onError?.('Failed to sign in with Apple')
      setLoading(null)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Google Sign In */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading !== null}
        className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 rounded-xl shadow-sm bg-white text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'google' ? (
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            <span>Connecting...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            {/* Google Icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </div>
        )}
      </button>

      {/* Apple Sign In */}
      <button
        onClick={handleAppleLogin}
        disabled={loading !== null}
        className="w-full flex items-center justify-center px-6 py-3 border border-gray-900 rounded-xl shadow-sm bg-black text-white font-medium hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'apple' ? (
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-white rounded-full animate-spin"></div>
            <span>Connecting...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            {/* Apple Icon */}
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.017 0C9.396 0 6.83.343 4.54.994c-1.04.296-1.957.756-2.72 1.363C.84 3.078.284 4.025.084 5.099.014 5.556 0 6.024 0 6.5v11c0 .476.014.944.084 1.401.2 1.074.756 2.021 1.736 2.742.763.607 1.68 1.067 2.72 1.363C6.83 23.657 9.396 24 12.017 24c2.62 0 5.186-.343 7.477-.994 1.04-.296 1.957-.756 2.72-1.363.98-.721 1.536-1.668 1.736-2.742.07-.457.084-.925.084-1.401v-11c0-.476-.014-.944-.084-1.401-.2-1.074-.756-2.021-1.736-2.742-.763-.607-1.68-1.067-2.72-1.363C17.203.343 14.637 0 12.017 0zM12 5.5c1.86 0 3.5.69 4.6 1.8 1.1 1.11 1.4 2.6 1.4 4.2 0 1.6-.3 3.09-1.4 4.2-1.1 1.1-2.74 1.8-4.6 1.8s-3.5-.7-4.6-1.8c-1.1-1.11-1.4-2.6-1.4-4.2 0-1.6.3-3.09 1.4-4.2C8.5 6.19 10.14 5.5 12 5.5z"/>
            </svg>
            <span>Continue with Apple</span>
          </div>
        )}
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with email</span>
        </div>
      </div>
    </div>
  )
}

// Production-ready OAuth implementation would require:
// 1. Proper client IDs for Google and Apple
// 2. Backend endpoints to handle OAuth callbacks
// 3. JWT token validation and user creation
// 4. Secure token storage (httpOnly cookies)
// 5. Error handling for OAuth failures
// 6. PKCE for security (Apple requires it)

/*
Backend implementation example:

// Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI
      })
    })
    
    const tokens = await tokenResponse.json()
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    
    const googleUser = await userResponse.json()
    
    // Create or find user in database
    let user = await User.findOne({ email: googleUser.email })
    if (!user) {
      user = await User.create({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        provider: 'google',
        providerId: googleUser.id
      })
    }
    
    // Generate JWT
    const jwt = generateJWT(user)
    
    // Send success response
    res.redirect(`${process.env.FRONTEND_URL}?token=${jwt}`)
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
  }
})

// Apple OAuth callback
app.post('/auth/apple/callback', async (req, res) => {
  const { code, id_token } = req.body
  
  try {
    // Verify Apple ID token
    const decodedToken = jwt.verify(id_token, getApplePublicKey())
    
    // Create or find user
    let user = await User.findOne({ email: decodedToken.email })
    if (!user) {
      user = await User.create({
        email: decodedToken.email,
        name: decodedToken.name || 'Apple User',
        provider: 'apple',
        providerId: decodedToken.sub
      })
    }
    
    // Generate JWT
    const jwt = generateJWT(user)
    
    res.redirect(`${process.env.FRONTEND_URL}?token=${jwt}`)
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
  }
})
*/