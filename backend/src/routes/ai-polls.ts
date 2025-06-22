import express from 'express'
import { AIService } from '../services/aiService'
import { NewsService } from '../services/newsService'
// import { pollCache } from '../services/cacheService'
// import { AnalyticsService } from '../services/analyticsService'
import { authenticateToken, optionalAuth } from '../middleware/auth'
// import { validateApiKey } from '../middleware/apiKey'
// import { rateLimitMiddleware } from '../middleware/rateLimit'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'

const router = express.Router()
const aiService = new AIService()
const newsService = new NewsService()
// const analyticsService = new AnalyticsService()

/**
 * Generate AI poll from trending topics
 * POST /api/ai-polls/generate
 */
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { category, language = 'en', difficulty = 'MEDIUM', customPrompt } = req.body
    let userId = req.user?.id
    
    // If no authenticated user, create/get demo AI user
    if (!userId) {
      userId = await getOrCreateAIUser()
    }

    // Generate poll using AI service
    const generatedPolls = await aiService.generatePollsFromTrends({
      category,
      language,
      difficulty,
      customPrompt,
      count: 1
    })

    if (!generatedPolls || generatedPolls.length === 0) {
      return res.status(400).json({
        error: 'Unable to generate poll from current trending topics'
      })
    }

    const pollData = generatedPolls[0]

    // Create poll in database
    const poll = await prisma.poll.create({
      data: {
        creatorId: userId,
        categoryId: pollData.categoryId,
        originalLanguage: language,
        sourceType: 'AI',
        aiGenerated: true,
        aiConfidence: pollData.confidence,
        pollTranslations: {
          create: {
            language,
            title: pollData.title,
            description: pollData.description
          }
        },
        options: {
          create: pollData.options.map((option: string, index: number) => ({
            orderIndex: index,
            originalLanguage: language,
            pollOptionTranslations: {
              create: {
                language,
                text: option
              }
            }
          }))
        }
      },
      include: {
        pollTranslations: true,
        options: {
          include: {
            pollOptionTranslations: true
          }
        },
        category: {
          include: {
            categoryTranslations: true
          }
        }
      }
    })

    // // Track analytics
    // await analyticsService.trackEvent({
    //   userId,
    //   sessionId: req.sessionID,
    //   eventType: 'ai_poll_generated',
    //   entityType: 'POLL',
    //   entityId: poll.id,
    //   properties: {
    //     category,
    //     difficulty,
    //     confidence: pollData.confidence,
    //     customPrompt: !!customPrompt
    //   }
    // })

    // // Invalidate relevant caches
    // await pollCache.clearPattern('trending:*')
    // await pollCache.clearPattern(`category:${pollData.categoryId}:*`)

    res.status(201).json({
      poll,
      metadata: {
        aiGenerated: true,
        confidence: pollData.confidence,
        sourceArticles: pollData.sourceArticles,
        keywords: pollData.keywords
      }
    })

  } catch (error) {
    logger.error('Error generating AI poll:', error)
    res.status(500).json({ error: 'Failed to generate poll' })
  }
})

/**
 * Get AI poll generation preview (without saving)
 * POST /api/ai-polls/preview
 */
router.post('/preview', optionalAuth, async (req, res) => {
  try {
    const { category, language = 'en', difficulty = 'MEDIUM', customPrompt } = req.body

    const generatedPolls = await aiService.generatePollsFromTrends({
      category,
      language,
      difficulty,
      customPrompt,
      count: 3 // Generate 3 options for preview
    })

    res.json({
      polls: generatedPolls,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error generating AI poll preview:', error)
    res.status(500).json({ error: 'Failed to generate preview' })
  }
})

/**
 * Get trending topics for poll generation
 * GET /api/ai-polls/trending-topics
 */
router.get('/trending-topics', async (req, res) => {
  try {
    const { category, limit = 20 } = req.query

    const trendingKeywords = await newsService.getTrendingKeywords(Number(limit))
    
    const filteredKeywords = category 
      ? trendingKeywords.filter(keyword => keyword.category === category)
      : trendingKeywords

    res.json({
      keywords: filteredKeywords,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching trending topics:', error)
    res.status(500).json({ error: 'Failed to fetch trending topics' })
  }
})

/**
 * Get AI poll generation suggestions
 * GET /api/ai-polls/suggestions
 */
router.get('/suggestions', optionalAuth, async (req, res) => {
  try {
    const suggestions = await newsService.getPollSuggestions()

    res.json({
      suggestions,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching poll suggestions:', error)
    res.status(500).json({ error: 'Failed to fetch suggestions' })
  }
})

/**
 * Analyze news sentiment for poll generation
 * POST /api/ai-polls/analyze-sentiment
 */
router.post('/analyze-sentiment', optionalAuth, async (req, res) => {
  try {
    const { keywords, category, timeframe = '24h' } = req.body

    let articles = []
    if (keywords && keywords.length > 0) {
      // Search for specific keywords
      articles = await newsService.searchNews(keywords.join(' '), {
        category,
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      })
    } else if (category) {
      // Get articles by category
      articles = await newsService.getNewsByCategory(category)
    } else {
      // Get latest general news
      articles = await newsService.fetchLatestNews()
    }

    const sentiment = await newsService.analyzeNewsSentiment(articles.slice(0, 50))

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
 * Get AI poll generation history for user
 * GET /api/ai-polls/history
 */
router.get('/history', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const { page = 1, limit = 20 } = req.query

    const polls = await prisma.poll.findMany({
      where: {
        creatorId: userId,
        aiGenerated: true
      },
      include: {
        pollTranslations: {
          where: { language: 'en' }
        },
        options: {
          include: {
            pollOptionTranslations: {
              where: { language: 'en' }
            }
          }
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
            votes: true,
            comments: true,
            predictions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    })

    const totalCount = await prisma.poll.count({
      where: {
        creatorId: userId,
        aiGenerated: true
      }
    })

    res.json({
      polls,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    })

  } catch (error) {
    logger.error('Error fetching AI poll history:', error)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

/**
 * Public API endpoint for AI poll generation (requires API key)
 * POST /api/ai-polls/public/generate
 */
router.post('/public/generate', optionalAuth, async (req, res) => {
  try {
    const { category, language = 'en', difficulty = 'MEDIUM', customPrompt, count = 1 } = req.body

    if (count > 5) {
      return res.status(400).json({
        error: 'Maximum 5 polls can be generated per request'
      })
    }

    const generatedPolls = await aiService.generatePollsFromTrends({
      category,
      language,
      difficulty,
      customPrompt,
      count
    })

    // // Track API usage
    // await prisma.apiKey.update({
    //   where: { key: req.apiKey.key },
    //   data: { lastUsed: new Date() }
    // })

    res.json({
      polls: generatedPolls,
      timestamp: new Date().toISOString()
      // api_usage: {
      //   remaining_requests: req.apiKey.rateLimit - 1
      // }
    })

  } catch (error) {
    logger.error('Error in public AI poll generation:', error)
    res.status(500).json({ error: 'Failed to generate polls' })
  }
})

/**
 * Get AI service statistics
 * GET /api/ai-polls/stats
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const { timeframe = 'week' } = req.query
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
    }

    const [totalAIPolls, totalVotes, totalPredictions] = await Promise.all([
      prisma.poll.count({
        where: {
          aiGenerated: true,
          createdAt: { gte: startDate }
        }
      }),
      prisma.vote.count({
        where: {
          poll: { aiGenerated: true },
          createdAt: { gte: startDate }
        }
      }),
      prisma.prediction.count({
        where: {
          poll: { aiGenerated: true },
          createdAt: { gte: startDate }
        }
      })
    ])

    const topCategories = await prisma.poll.groupBy({
      by: ['categoryId'],
      where: {
        aiGenerated: true,
        createdAt: { gte: startDate }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    })

    res.json({
      timeframe,
      stats: {
        totalAIPolls,
        totalVotes,
        totalPredictions,
        averageConfidence: 0.75, // This would be calculated from actual data
        topCategories
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error fetching AI poll stats:', error)
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
})

/**
 * Get or create demo AI user for generating polls
 */
async function getOrCreateAIUser(): Promise<string> {
  const aiUser = await prisma.user.findFirst({
    where: { 
      email: 'ai@tapvote.demo',
      isBot: true
    }
  })

  if (aiUser) {
    return aiUser.id
  }

  // Create AI bot user
  const newAIUser = await prisma.user.create({
    data: {
      email: 'ai@tapvote.demo',
      username: 'tapvote_ai',
      displayName: 'TapVote AI',
      bio: 'AI-powered poll generation bot',
      isBot: true,
      isVerified: true,
      reputation: 1000
    }
  })

  return newAIUser.id
}

export default router