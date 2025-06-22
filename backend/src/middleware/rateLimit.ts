import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

interface RateLimitOptions {
  windowMs: number
  max: number
  message?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export const rateLimitMiddleware = (options: RateLimitOptions) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: options.message || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.round(options.windowMs / 1000)
      })
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health'
    }
  })
}

// Preset rate limiters for different use cases
export const strictRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests, please try again later.'
})

export const moderateRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: 'Too many requests, please try again later.'
})

export const lenientRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: 'Too many requests, please try again later.'
})

export default rateLimitMiddleware