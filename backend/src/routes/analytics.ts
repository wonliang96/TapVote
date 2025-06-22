import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AnalyticsService } from '../services/analyticsService'
import { globalCache } from '../services/cacheService'
import { authMiddleware } from '../middleware/auth'
import { rateLimitMiddleware } from '../middleware/rateLimit'
import { logger } from '../lib/logger'

const router = express.Router()
const prisma = new PrismaClient()
const analyticsService = new AnalyticsService()

// Apply rate limiting
router.use(rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 100 })) // 100 requests per 15 minutes

/**
 * Get dashboard metrics (admin/moderator only)
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied. Moderator privileges required.' })
    }

    const { timeframe = 'week' } = req.query

    const cacheKey = `analytics:dashboard:${timeframe}`
    const cachedMetrics = await globalCache.get(cacheKey)
    
    if (cachedMetrics) {
      return res.json(cachedMetrics)
    }

    const metrics = await analyticsService.getDashboardMetrics(timeframe as any)

    // Cache for 10 minutes
    await globalCache.set(cacheKey, metrics, 600)

    res.json({
      metrics,
      timeframe,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching dashboard metrics:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' })
  }
})

/**
 * Get poll analytics
 * GET /api/analytics/polls/:pollId
 */
router.get('/polls/:pollId', authMiddleware, async (req, res) => {
  try {
    const { pollId } = req.params

    // Check if user has permission to view analytics
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { creatorId: true }
    })

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' })
    }

    if (poll.creatorId !== req.user.id && !req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const cacheKey = `analytics:poll:${pollId}`
    const cachedAnalytics = await globalCache.get(cacheKey)
    
    if (cachedAnalytics) {
      return res.json(cachedAnalytics)
    }

    const analytics = await analyticsService.getPollAnalytics(pollId)

    // Cache for 5 minutes
    await globalCache.set(cacheKey, analytics, 300)

    res.json({
      analytics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching poll analytics:', error)
    
    if (error.message === 'Poll not found') {
      return res.status(404).json({ error: 'Poll not found' })
    }
    
    res.status(500).json({ error: 'Failed to fetch poll analytics' })
  }
})

/**
 * Get user analytics
 * GET /api/analytics/users/:userId
 */
router.get('/users/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params

    // Users can only view their own analytics unless they're moderators
    if (userId !== req.user.id && !req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const cacheKey = `analytics:user:${userId}`
    const cachedAnalytics = await globalCache.get(cacheKey)
    
    if (cachedAnalytics) {
      return res.json(cachedAnalytics)
    }

    const analytics = await analyticsService.getUserAnalytics(userId)

    // Cache for 30 minutes
    await globalCache.set(cacheKey, analytics, 1800)

    res.json({
      analytics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching user analytics:', error)
    
    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' })
    }
    
    res.status(500).json({ error: 'Failed to fetch user analytics' })
  }
})

/**
 * Generate analytics report
 * POST /api/analytics/reports
 */
router.post('/reports', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied. Moderator privileges required.' })
    }

    const { type, timeframe, filters } = req.body

    if (!type || !timeframe) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, timeframe' 
      })
    }

    const validTypes = ['user', 'poll', 'category', 'overall']
    const validTimeframes = ['day', 'week', 'month', 'year']

    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
      })
    }

    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ 
        error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}` 
      })
    }

    const report = await analyticsService.generateReport(type, timeframe, filters)

    // Track report generation
    await analyticsService.trackEvent({
      userId: req.user.id,
      sessionId: req.sessionID,
      eventType: 'report_generated',
      entityType: 'REPORT',
      properties: {
        type,
        timeframe,
        filters
      }
    })

    res.json({
      report,
      type,
      timeframe,
      filters,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error generating analytics report:', error)
    
    if (error.message.includes('Invalid report type')) {
      return res.status(400).json({ error: error.message })
    }
    
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

/**
 * Track custom analytics event
 * POST /api/analytics/events
 */
router.post('/events', async (req, res) => {
  try {
    const { eventType, entityType, entityId, properties, sessionId } = req.body

    if (!eventType || !sessionId) {
      return res.status(400).json({ 
        error: 'Missing required fields: eventType, sessionId' 
      })
    }

    await analyticsService.trackEvent({
      userId: req.user?.id,
      sessionId,
      eventType,
      entityType,
      entityId,
      properties,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    })

    res.status(201).json({
      message: 'Event tracked successfully',
      eventType,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error tracking analytics event:', error)
    res.status(500).json({ error: 'Failed to track event' })
  }
})

/**
 * Track poll view
 * POST /api/analytics/polls/:pollId/view
 */
router.post('/polls/:pollId/view', async (req, res) => {
  try {
    const { pollId } = req.params
    const { sessionId, metadata } = req.body

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' })
    }

    await analyticsService.trackPollView(
      pollId,
      req.user?.id,
      sessionId,
      {
        ...metadata,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        ipAddress: req.ip
      }
    )

    res.status(201).json({
      message: 'Poll view tracked',
      pollId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error tracking poll view:', error)
    res.status(500).json({ error: 'Failed to track poll view' })
  }
})

/**
 * Track vote
 * POST /api/analytics/polls/:pollId/vote
 */
router.post('/polls/:pollId/vote', async (req, res) => {
  try {
    const { pollId } = req.params
    const { optionId, sessionId } = req.body

    if (!optionId || !sessionId) {
      return res.status(400).json({ 
        error: 'Missing required fields: optionId, sessionId' 
      })
    }

    await analyticsService.trackVote(pollId, optionId, req.user?.id, sessionId)

    res.status(201).json({
      message: 'Vote tracked',
      pollId,
      optionId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error tracking vote:', error)
    res.status(500).json({ error: 'Failed to track vote' })
  }
})

/**
 * Get analytics trends
 * GET /api/analytics/trends
 */
router.get('/trends', authMiddleware, async (req, res) => {
  try {
    const { metric = 'polls', timeframe = 'week', granularity = 'day' } = req.query

    if (!req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied. Moderator privileges required.' })
    }

    const cacheKey = `analytics:trends:${metric}:${timeframe}:${granularity}`
    const cachedTrends = await globalCache.get(cacheKey)
    
    if (cachedTrends) {
      return res.json(cachedTrends)
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    
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
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
    }

    // Generate time buckets based on granularity
    const buckets = []
    const current = new Date(startDate)
    
    while (current <= endDate) {
      buckets.push({
        date: new Date(current),
        value: 0
      })
      
      switch (granularity) {
        case 'hour':
          current.setHours(current.getHours() + 1)
          break
        case 'day':
          current.setDate(current.getDate() + 1)
          break
        case 'week':
          current.setDate(current.getDate() + 7)
          break
        case 'month':
          current.setMonth(current.getMonth() + 1)
          break
      }
    }

    // Fetch data based on metric
    let data = []
    switch (metric) {
      case 'polls':
        data = await prisma.poll.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: { createdAt: true }
        })
        break
      case 'votes':
        data = await prisma.vote.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: { createdAt: true }
        })
        break
      case 'users':
        data = await prisma.user.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: { createdAt: true }
        })
        break
    }

    // Map data to buckets
    data.forEach(item => {
      const itemDate = new Date(item.createdAt)
      const bucketIndex = buckets.findIndex(bucket => {
        const bucketStart = new Date(bucket.date)
        const bucketEnd = new Date(bucket.date)
        
        switch (granularity) {
          case 'hour':
            bucketEnd.setHours(bucketEnd.getHours() + 1)
            break
          case 'day':
            bucketEnd.setDate(bucketEnd.getDate() + 1)
            break
          case 'week':
            bucketEnd.setDate(bucketEnd.getDate() + 7)
            break
          case 'month':
            bucketEnd.setMonth(bucketEnd.getMonth() + 1)
            break
        }
        
        return itemDate >= bucketStart && itemDate < bucketEnd
      })
      
      if (bucketIndex !== -1) {
        buckets[bucketIndex].value++
      }
    })

    const result = {
      metric,
      timeframe,
      granularity,
      trends: buckets,
      summary: {
        total: data.length,
        average: buckets.length > 0 ? Math.round(data.length / buckets.length * 100) / 100 : 0,
        peak: Math.max(...buckets.map(b => b.value)),
        low: Math.min(...buckets.map(b => b.value))
      },
      timestamp: new Date().toISOString()
    }

    // Cache for 1 hour
    await globalCache.set(cacheKey, result, 3600)

    res.json(result)

  } catch (error) {
    logger.error('Error fetching analytics trends:', error)
    res.status(500).json({ error: 'Failed to fetch trends' })
  }
})

/**
 * Get real-time analytics
 * GET /api/analytics/realtime
 */
router.get('/realtime', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isModerator) {
      return res.status(403).json({ error: 'Access denied. Moderator privileges required.' })
    }

    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000)
    const last1Hour = new Date(Date.now() - 60 * 60 * 1000)

    const [recentVotes, recentPolls, recentUsers, activeUsers] = await Promise.all([
      prisma.vote.count({
        where: { createdAt: { gte: last5Minutes } }
      }),
      prisma.poll.count({
        where: { createdAt: { gte: last5Minutes } }
      }),
      prisma.user.count({
        where: { createdAt: { gte: last1Hour } }
      }),
      prisma.user.count({
        where: { lastActiveAt: { gte: last5Minutes } }
      })
    ])

    const realtimeData = {
      activeUsers,
      recentActivity: {
        votes: recentVotes,
        polls: recentPolls,
        newUsers: recentUsers
      },
      timestamp: new Date().toISOString()
    }

    res.json(realtimeData)

  } catch (error) {
    logger.error('Error fetching real-time analytics:', error)
    res.status(500).json({ error: 'Failed to fetch real-time analytics' })
  }
})

export default router