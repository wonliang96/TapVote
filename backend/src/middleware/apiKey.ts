import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { logger } from '../lib/logger'

const prisma = new PrismaClient()

interface ApiKeyRequest extends Request {
  apiKey?: any
}

export const validateApiKey = (requiredPermissions: string[] = []) => {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers['x-api-key'] as string

      if (!apiKey) {
        return res.status(401).json({
          error: 'API key is required'
        })
      }

      // Find and validate API key
      const keyRecord = await prisma.apiKey.findUnique({
        where: { key: apiKey, isActive: true }
      })

      if (!keyRecord) {
        return res.status(401).json({
          error: 'Invalid API key'
        })
      }

      // Check if API key has expired
      if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
        return res.status(401).json({
          error: 'API key has expired'
        })
      }

      // Check permissions
      if (requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.every(permission =>
          keyRecord.permissions.includes(permission)
        )

        if (!hasPermission) {
          return res.status(403).json({
            error: 'Insufficient permissions for this operation'
          })
        }
      }

      // Check rate limiting (simple implementation)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      // This is a simplified rate limit check
      // In production, you'd want to use Redis or similar for more accurate rate limiting
      const recentUsage = await prisma.apiKey.count({
        where: {
          key: apiKey,
          lastUsed: {
            gte: oneHourAgo
          }
        }
      })

      if (recentUsage >= keyRecord.rateLimit) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          limit: keyRecord.rateLimit,
          resetTime: oneHourAgo.getTime() + 60 * 60 * 1000
        })
      }

      // Attach API key info to request
      req.apiKey = keyRecord

      next()

    } catch (error) {
      logger.error('Error validating API key:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export default validateApiKey