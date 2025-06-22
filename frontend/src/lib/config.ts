// Environment configuration for different deployment environments

export const config = {
  // API Configuration
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003',
  
  // App Configuration
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'TapVote',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  
  // Feature Flags
  features: {
    aiPolls: process.env.NEXT_PUBLIC_ENABLE_AI_POLLS === 'true',
    predictions: process.env.NEXT_PUBLIC_ENABLE_PREDICTIONS === 'true',
    translations: process.env.NEXT_PUBLIC_ENABLE_TRANSLATIONS === 'true',
  },
  
  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Analytics
  analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID,
  
  // Error Reporting
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
}

// Helper function to get API endpoint
export const getApiUrl = (endpoint: string) => {
  const baseUrl = config.apiUrl.endsWith('/') 
    ? config.apiUrl.slice(0, -1) 
    : config.apiUrl
  
  const cleanEndpoint = endpoint.startsWith('/') 
    ? endpoint 
    : `/${endpoint}`
    
  return `${baseUrl}${cleanEndpoint}`
}

// Validate required environment variables
export const validateEnvironment = () => {
  if (config.isProduction) {
    const required = [
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_APP_URL'
    ]
    
    const missing = required.filter(key => !process.env[key])
    
    if (missing.length > 0) {
      console.warn('Missing required environment variables:', missing)
    }
  }
}

// Initialize environment validation
if (typeof window === 'undefined') {
  validateEnvironment()
}