import express from 'express'
import { PredictionMarketService } from '../services/predictionMarket'
// import { AnalyticsService } from '../services/analyticsService'
// import { globalCache } from '../services/cacheService'
import { optionalAuth } from '../middleware/auth'
// import { rateLimitMiddleware } from '../middleware/rateLimit'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'

const router = express.Router()
const predictionMarketService = new PredictionMarketService()
// const analyticsService = new AnalyticsService()

// // Apply rate limiting
// router.use(rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 100 })) // 100 requests per 15 minutes

/**
 * Create a new prediction
 * POST /api/predictions
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { pollId, optionId, confidence, points, reasoning } = req.body
    const userId = req.user?.id
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required for predictions' })
    }

    // Validate required fields
    if (!pollId || !optionId || confidence === undefined || !points) {
      return res.status(400).json({
        error: 'Missing required fields: pollId, optionId, confidence, points'
      })
    }

    // Validate confidence range
    if (confidence < 0 || confidence > 1) {
      return res.status(400).json({
        error: 'Confidence must be between 0 and 1'
      })
    }

    // Check if user has enough points (assuming points are tracked in user reputation)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputation: true }
    })
    
    if (!user || user.reputation < points) {
      return res.status(400).json({
        error: 'Insufficient points for this prediction'
      })
    }

    const prediction = await predictionMarketService.createPrediction({
      userId,
      pollId,
      optionId,
      confidence,
      points,
      reasoning
    })

    // Track analytics
    await analyticsService.trackPrediction(pollId, prediction.id, userId, confidence, points)

    // Invalidate relevant caches
    // await globalCache.invalidatePoll(pollId)

    res.status(201).json({
      prediction,
      message: 'Prediction created successfully'
    })

  } catch (error) {
    logger.error('Error creating prediction:', error)
    
    if (error.message.includes('not active')) {
      return res.status(400).json({ error: error.message })
    }
    if (error.message.includes('expired')) {
      return res.status(400).json({ error: error.message })
    }
    if (error.message.includes('between')) {
      return res.status(400).json({ error: error.message })
    }
    
    res.status(500).json({ error: 'Failed to create prediction' })
  }
})

/**
 * Get market odds for a poll
 * GET /api/predictions/polls/:pollId/odds
 */
router.get('/polls/:pollId/odds', async (req, res) => {
  try {
    const { pollId } = req.params

    // const cacheKey = `market:odds:${pollId}`
    // const cachedOdds = await globalCache.get(cacheKey)
    
    // if (cachedOdds) {
    //   return res.json(cachedOdds)
    // }

    const marketOdds = await predictionMarketService.getMarketOdds(pollId)
    
    // Cache for 30 seconds (frequent updates for active markets)
    // await globalCache.set(cacheKey, marketOdds, 30)

    res.json(marketOdds)

  } catch (error) {
    logger.error('Error fetching market odds:', error)
    
    if (error.message === 'Poll not found') {
      return res.status(404).json({ error: 'Poll not found' })
    }
    
    res.status(500).json({ error: 'Failed to fetch market odds' })
  }
})

/**
 * Get market analytics for a poll
 * GET /api/predictions/polls/:pollId/analytics
 */
router.get('/polls/:pollId/analytics', optionalAuth, async (req, res) => {
  try {
    const { pollId } = req.params

    const cacheKey = `market:analytics:${pollId}`
    // const cachedAnalytics = await globalCache.get(cacheKey)
    
    if (cachedAnalytics) {
      return res.json(cachedAnalytics)
    }

    const analytics = await predictionMarketService.getMarketAnalytics(pollId)
    
    // Cache for 5 minutes
    // await globalCache.set(cacheKey, analytics, 300)

    res.json(analytics)

  } catch (error) {
    logger.error('Error fetching market analytics:', error)
    res.status(500).json({ error: 'Failed to fetch market analytics' })
  }
})

/**
 * Get prediction leaderboard
 * GET /api/predictions/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { timeframe = 'all', limit = 50 } = req.query

    const cacheKey = `leaderboard:${timeframe}:${limit}`
    // const cachedLeaderboard = await globalCache.get(cacheKey)
    
    if (cachedLeaderboard) {
      return res.json(cachedLeaderboard)
    }

    const leaderboard = await predictionMarketService.getLeaderboard(
      timeframe as any,
      Number(limit)
    )
    
    // Cache for 10 minutes
    // await globalCache.set(cacheKey, leaderboard, 600)

    res.json({
      leaderboard,
      timeframe,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching leaderboard:', error)
    res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
})

/**
 * Get user's predictions
 * GET /api/predictions/users/:userId
 */
router.get('/users/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params
    const { page = 1, limit = 20, status } = req.query

    // Users can only view their own predictions unless they're moderators
    if (userId !== req.user.id && !req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const whereClause: any = { userId }
    if (status === 'resolved') {
      whereClause.isResolved = true
    } else if (status === 'active') {
      whereClause.isResolved = false
    }

    const [predictions, totalCount] = await Promise.all([
      prisma.prediction.findMany({
        where: whereClause,
        include: {
          poll: {
            include: {
              pollTranslations: {
                where: { language: 'en' }
              },
              category: {
                include: {
                  categoryTranslations: {
                    where: { language: 'en' }
                  }
                }
              }
            }
          },
          option: {
            include: {
              pollOptionTranslations: {
                where: { language: 'en' }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.prediction.count({ where: whereClause })
    ])

    res.json({
      predictions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    })

  } catch (error) {
    logger.error('Error fetching user predictions:', error)
    res.status(500).json({ error: 'Failed to fetch predictions' })
  }
})

/**
 * Resolve a poll (admin/moderator only)
 * POST /api/predictions/polls/:pollId/resolve
 */
router.post('/polls/:pollId/resolve', optionalAuth, async (req, res) => {
  try {
    const { pollId } = req.params
    const { winningOptionId, resolutionSource } = req.body

    // Check if user is moderator or poll creator
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { creatorId: true }
    })

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' })
    }

    if (!req.user.isModerator && poll.creatorId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Only moderators or poll creators can resolve polls' 
      })
    }

    if (!winningOptionId || !resolutionSource) {
      return res.status(400).json({
        error: 'Missing required fields: winningOptionId, resolutionSource'
      })
    }

    await predictionMarketService.resolvePoll(pollId, winningOptionId, resolutionSource)

    // Track analytics
    await analyticsService.trackEvent({
      userId: req.user.id,
      sessionId: req.sessionID,
      eventType: 'poll_resolved',
      entityType: 'POLL',
      entityId: pollId,
      properties: {
        winningOptionId,
        resolutionSource,
        resolvedBy: req.user.id
      }
    })

    // Invalidate all related caches
    // await globalCache.invalidatePoll(pollId)
    // await globalCache.clearPattern('leaderboard:*')

    res.json({
      message: 'Poll resolved successfully',
      pollId,
      winningOptionId,
      resolutionSource
    })

  } catch (error) {
    logger.error('Error resolving poll:', error)
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message })
    }
    if (error.message.includes('already resolved')) {
      return res.status(400).json({ error: error.message })
    }
    
    res.status(500).json({ error: 'Failed to resolve poll' })
  }
})

/**
 * Get poll predictions summary
 * GET /api/predictions/polls/:pollId/summary
 */
router.get('/polls/:pollId/summary', async (req, res) => {
  try {
    const { pollId } = req.params

    const predictions = await prisma.prediction.findMany({
      where: { pollId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            reputation: true
          }
        },
        option: {
          include: {
            pollOptionTranslations: {
              where: { language: 'en' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Group predictions by option
    const predictionsByOption = predictions.reduce((acc: any, prediction) => {
      const optionId = prediction.optionId
      if (!acc[optionId]) {
        acc[optionId] = {
          option: prediction.option,
          predictions: [],
          totalPoints: 0,
          averageConfidence: 0,
          uniquePredictors: new Set()
        }
      }
      
      acc[optionId].predictions.push(prediction)
      acc[optionId].totalPoints += prediction.points
      acc[optionId].uniquePredictors.add(prediction.userId)
      
      return acc
    }, {})

    // Calculate averages and convert sets to counts
    Object.keys(predictionsByOption).forEach(optionId => {
      const option = predictionsByOption[optionId]
      option.averageConfidence = option.predictions.reduce((sum: number, p: any) => sum + p.confidence, 0) / option.predictions.length
      option.uniquePredictors = option.uniquePredictors.size
      option.topPredictors = option.predictions
        .sort((a: any, b: any) => b.points - a.points)
        .slice(0, 5)
        .map((p: any) => ({
          user: p.user,
          points: p.points,
          confidence: p.confidence,
          reasoning: p.reasoning
        }))
    })

    res.json({
      pollId,
      totalPredictions: predictions.length,
      totalVolume: predictions.reduce((sum, p) => sum + p.points, 0),
      uniquePredictors: new Set(predictions.map(p => p.userId)).size,
      predictionsByOption: Object.values(predictionsByOption),
      recentPredictions: predictions.slice(0, 10)
    })

  } catch (error) {
    logger.error('Error fetching poll predictions summary:', error)
    res.status(500).json({ error: 'Failed to fetch predictions summary' })
  }
})

/**
 * Get user's prediction statistics
 * GET /api/predictions/users/:userId/stats
 */
router.get('/users/:userId/stats', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params
    const { timeframe = 'all' } = req.query

    // Users can only view their own stats unless they're moderators
    if (userId !== req.user.id && !req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const startDate = timeframe !== 'all' ? new Date() : null
    if (startDate) {
      switch (timeframe) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1)
          break
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
      }
    }

    const whereClause: any = { userId }
    if (startDate) {
      whereClause.createdAt = { gte: startDate }
    }

    const [predictions, resolvedPredictions] = await Promise.all([
      prisma.prediction.findMany({
        where: whereClause,
        include: {
          poll: {
            select: {
              resolvedAt: true,
              resolutionResult: true
            }
          }
        }
      }),
      prisma.prediction.findMany({
        where: {
          ...whereClause,
          isResolved: true
        }
      })
    ])

    const totalPredictions = predictions.length
    const totalStake = predictions.reduce((sum, p) => sum + p.points, 0)
    const totalPayout = resolvedPredictions.reduce((sum, p) => sum + (p.payout || 0), 0)
    const winningPredictions = resolvedPredictions.filter(p => (p.payout || 0) > 0)
    const winRate = resolvedPredictions.length > 0 ? (winningPredictions.length / resolvedPredictions.length) * 100 : 0
    const roi = totalStake > 0 ? ((totalPayout - totalStake) / totalStake) * 100 : 0
    const averageConfidence = predictions.length > 0 
      ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length 
      : 0

    res.json({
      userId,
      timeframe,
      stats: {
        totalPredictions,
        resolvedPredictions: resolvedPredictions.length,
        activePredictions: totalPredictions - resolvedPredictions.length,
        totalStake,
        totalPayout,
        netProfit: totalPayout - totalStake,
        winRate: Math.round(winRate * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        bestWin: winningPredictions.length > 0 
          ? Math.max(...winningPredictions.map(p => p.payout || 0))
          : 0,
        currentStreak: 0 // Would need to calculate based on recent predictions
      }
    })

  } catch (error) {
    logger.error('Error fetching user prediction stats:', error)
    res.status(500).json({ error: 'Failed to fetch prediction statistics' })
  }
})

/**
 * Get trending predictions
 * GET /api/predictions/trending
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const trendingPolls = await prisma.poll.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gt: new Date()
        },
        predictions: {
          some: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        }
      },
      include: {
        pollTranslations: {
          where: { language: 'en' }
        },
        category: {
          include: {
            categoryTranslations: {
              where: { language: 'en' }
            }
          }
        },
        _count: {
          select: {
            predictions: true,
            votes: true
          }
        }
      },
      orderBy: {
        trendingScore: 'desc'
      },
      take: Number(limit)
    })

    // Get market odds for each trending poll
    const trendingWithOdds = await Promise.all(
      trendingPolls.map(async (poll) => {
        try {
          const odds = await predictionMarketService.getMarketOdds(poll.id)
          return {
            ...poll,
            marketOdds: odds
          }
        } catch (error) {
          return {
            ...poll,
            marketOdds: []
          }
        }
      })
    )

    res.json({
      trending: trendingWithOdds,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching trending predictions:', error)
    res.status(500).json({ error: 'Failed to fetch trending predictions' })
  }
})

export default router