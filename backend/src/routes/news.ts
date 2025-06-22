import express from 'express'
import { query } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { NewsService } from '../services/newsService'
import { globalCache } from '../services/cacheService'
import { AnalyticsService } from '../services/analyticsService'
import { authMiddleware } from '../middleware/auth'
import { rateLimitMiddleware } from '../middleware/rateLimit'
import { logger } from '../lib/logger'

const router = express.Router()
const prisma = new PrismaClient()
const newsService = new NewsService()
const analyticsService = new AnalyticsService()

// Apply rate limiting
router.use(rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 50 })) // 50 requests per 15 minutes

/**
 * Get latest news articles
 * GET /api/news/latest
 */
router.get('/latest', async (req, res) => {
  try {
    const { category, limit = 20 } = req.query

    const cacheKey = `news:latest:${category || 'all'}:${limit}`
    const cachedNews = await globalCache.get(cacheKey)
    
    if (cachedNews) {
      return res.json(cachedNews)
    }

    let articles
    if (category) {
      articles = await newsService.getNewsByCategory(category as string, Number(limit))
    } else {
      articles = await newsService.fetchLatestNews()
    }

    const result = {
      articles: articles.slice(0, Number(limit)),
      timestamp: new Date().toISOString()
    }

    // Cache for 15 minutes
    await globalCache.set(cacheKey, result, 900)

    res.json(result)

  } catch (error) {
    logger.error('Error fetching latest news:', error)
    res.status(500).json({ error: 'Failed to fetch news articles' })
  }
})

/**
 * Get trending keywords and topics
 * GET /api/news/trending-keywords
 */
router.get('/trending-keywords', async (req, res) => {
  try {
    const { limit = 20 } = req.query

    const cacheKey = `news:trending:keywords:${limit}`
    const cachedKeywords = await globalCache.get(cacheKey)
    
    if (cachedKeywords) {
      return res.json(cachedKeywords)
    }

    const trendingKeywords = await newsService.getTrendingKeywords(Number(limit))

    const result = {
      keywords: trendingKeywords,
      timestamp: new Date().toISOString()
    }

    // Cache for 10 minutes
    await globalCache.set(cacheKey, result, 600)

    res.json(result)

  } catch (error) {
    logger.error('Error fetching trending keywords:', error)
    res.status(500).json({ error: 'Failed to fetch trending keywords' })
  }
})

/**
 * Search news articles
 * GET /api/news/search
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category, language, sources, dateFrom, dateTo, limit = 20 } = req.query

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const filters: any = {}
    if (category) filters.category = category as string
    if (language) filters.language = language as string
    if (sources) filters.sources = (sources as string).split(',')
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string)
    if (dateTo) filters.dateTo = new Date(dateTo as string)

    const articles = await newsService.searchNews(q, filters)

    res.json({
      query: q,
      articles: articles.slice(0, Number(limit)),
      totalResults: articles.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error searching news:', error)
    res.status(500).json({ error: 'Failed to search news articles' })
  }
})

/**
 * Get poll suggestions based on news
 * GET /api/news/poll-suggestions
 */
router.get('/poll-suggestions', authMiddleware, async (req, res) => {
  try {
    const cacheKey = 'news:poll-suggestions'
    const cachedSuggestions = await globalCache.get(cacheKey)
    
    if (cachedSuggestions) {
      return res.json(cachedSuggestions)
    }

    const suggestions = await newsService.getPollSuggestions()

    const result = {
      suggestions,
      timestamp: new Date().toISOString()
    }

    // Cache for 30 minutes
    await globalCache.set(cacheKey, result, 1800)

    res.json(result)

  } catch (error) {
    logger.error('Error fetching poll suggestions:', error)
    res.status(500).json({ error: 'Failed to fetch poll suggestions' })
  }
})

/**
 * Analyze news sentiment
 * POST /api/news/analyze-sentiment
 */
router.post('/analyze-sentiment', authMiddleware, async (req, res) => {
  try {
    const { keywords, category, timeframe = '24h' } = req.body

    let articles = []
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      articles = await newsService.searchNews(keywords.join(' '), {
        category,
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000)
      })
    } else if (category) {
      articles = await newsService.getNewsByCategory(category)
    } else {
      articles = await newsService.fetchLatestNews()
    }

    const sentiment = await newsService.analyzeNewsSentiment(articles.slice(0, 100))

    // Track analytics
    await analyticsService.trackEvent({
      userId: req.user.id,
      sessionId: req.sessionID,
      eventType: 'news_sentiment_analyzed',
      entityType: 'NEWS',
      properties: {
        keywords,
        category,
        articlesAnalyzed: articles.length
      }
    })

    res.json({
      sentiment,
      articlesAnalyzed: articles.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error analyzing news sentiment:', error)
    res.status(500).json({ error: 'Failed to analyze sentiment' })
  }
})

/**
 * Get news-based polls
 * GET /api/news/polls
 */
router.get('/polls', async (req, res) => {
  try {
    const { language = 'en', page = 1, limit = 10, category } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const whereClause: any = {
      OR: [
        { sourceType: 'NEWS' },
        { aiGenerated: true }
      ],
      isActive: true
    }

    if (category) {
      whereClause.category = { slug: category }
    }

    const [newsPolls, total] = await Promise.all([
      prisma.poll.findMany({
        where: whereClause,
        include: {
          pollTranslations: {
            where: { language: language as string }
          },
          options: {
            include: {
              pollOptionTranslations: {
                where: { language: language as string }
              },
              _count: {
                select: { votes: true }
              }
            }
          },
          category: {
            include: {
              categoryTranslations: {
                where: { language: language as string }
              }
            }
          },
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          },
          _count: {
            select: { 
              votes: true,
              comments: true,
              predictions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.poll.count({ where: whereClause })
    ])

    const formattedPolls = newsPolls.map(poll => ({
      id: poll.id,
      title: poll.pollTranslations[0]?.title || 'Translation not available',
      description: poll.pollTranslations[0]?.description,
      options: poll.options.map(option => ({
        id: option.id,
        text: option.pollOptionTranslations[0]?.text || 'Translation not available',
        votes: option._count.votes,
        percentage: poll._count.votes > 0 
          ? Math.round((option._count.votes / poll._count.votes) * 100) 
          : 0
      })),
      totalVotes: poll._count.votes,
      totalComments: poll._count.comments,
      totalPredictions: poll._count.predictions,
      category: {
        slug: poll.category.slug,
        name: poll.category.categoryTranslations[0]?.name || poll.category.slug
      },
      creator: poll.creator,
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
      newsSourceUrl: poll.newsSourceUrl,
      sourceType: poll.sourceType,
      aiGenerated: poll.aiGenerated,
      aiConfidence: poll.aiConfidence,
      difficulty: poll.difficulty,
      tags: poll.tags
    }))

    res.json({
      polls: formattedPolls,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching news-based polls:', error)
    res.status(500).json({ error: 'Failed to fetch news-based polls' })
  }
})

/**
 * Get news analytics and trends
 * GET /api/news/analytics
 */
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const { timeframe = 'week' } = req.query

    const cacheKey = `news:analytics:${timeframe}`
    const cachedAnalytics = await globalCache.get(cacheKey)
    
    if (cachedAnalytics) {
      return res.json(cachedAnalytics)
    }

    // Get trending topics
    const trendingKeywords = await newsService.getTrendingKeywords(10)
    
    // Get recent news sentiment
    const recentArticles = await newsService.fetchLatestNews()
    const sentiment = await newsService.analyzeNewsSentiment(recentArticles.slice(0, 50))

    // Get news-based polls statistics
    const newsPolls = await prisma.poll.count({
      where: {
        OR: [
          { sourceType: 'NEWS' },
          { aiGenerated: true }
        ]
      }
    })

    const result = {
      trendingKeywords: trendingKeywords.slice(0, 10),
      sentiment,
      newsPolls,
      recentArticles: recentArticles.slice(0, 5).map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        publishedAt: article.publishedAt,
        source: article.source,
        category: article.category,
        sentiment: article.sentiment,
        importance: article.importance
      })),
      timestamp: new Date().toISOString()
    }

    // Cache for 1 hour
    await globalCache.set(cacheKey, result, 3600)

    res.json(result)

  } catch (error) {
    logger.error('Error fetching news analytics:', error)
    res.status(500).json({ error: 'Failed to fetch news analytics' })
  }
})

export default router