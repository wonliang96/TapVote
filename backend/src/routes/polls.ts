import express from 'express'
import { body, query, param } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { logger } from '../lib/logger'
import { authMiddleware, optionalAuth } from '../middleware/auth'
import { rateLimitMiddleware } from '../middleware/rateLimit'
import { pollCache, globalCache } from '../services/cacheService'
import { AnalyticsService } from '../services/analyticsService'

const router = express.Router()
const prisma = new PrismaClient()
const analyticsService = new AnalyticsService()

// Apply rate limiting
router.use(rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 200 })) // 200 requests per 15 minutes

/**
 * Get polls with pagination and filtering
 * GET /api/polls
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const category = req.query.category as string
    const trending = req.query.trending === 'true'
    const language = req.query.language as string || 'en'
    const skip = (page - 1) * limit

    // Create cache key
    const cacheKey = `polls:${page}:${limit}:${category || 'all'}:${trending}:${language}:${req.user?.id || 'anon'}`
    
    // Check cache first
    const cachedPolls = await pollCache.get(cacheKey)
    if (cachedPolls) {
      return res.json(cachedPolls)
    }

    const where: any = {
      isActive: true,
      ...(category && { category: { slug: category } }),
      ...(trending && { isTrending: true })
    }

    const [polls, total] = await Promise.all([
      prisma.poll.findMany({
        where,
        include: {
          pollTranslations: {
            where: { language }
          },
          options: {
            include: {
              pollOptionTranslations: {
                where: { language }
              },
              _count: {
                select: { votes: true }
              }
            }
          },
          category: {
            include: {
              categoryTranslations: {
                where: { language }
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
          },
          ...(req.user && {
            votes: {
              where: { userId: req.user.id },
              select: { optionId: true }
            }
          })
        },
        orderBy: [
          { isTrending: 'desc' },
          { trendingScore: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.poll.count({ where })
    ])

    const formattedPolls = polls.map(poll => ({
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
      userVoted: req.user ? poll.votes.length > 0 : false,
      votedOptionId: req.user && poll.votes.length > 0 ? poll.votes[0].optionId : null,
      sourceType: poll.sourceType,
      newsSourceUrl: poll.newsSourceUrl,
      aiGenerated: poll.aiGenerated,
      aiConfidence: poll.aiConfidence,
      difficulty: poll.difficulty,
      tags: poll.tags,
      isTrending: poll.isTrending,
      trendingScore: poll.trendingScore
    }))

    const result = {
      polls: formattedPolls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      timestamp: new Date().toISOString()
    }

    // Cache for 5 minutes
    await pollCache.set(cacheKey, result, 300)

    res.json(result)

  } catch (error) {
    logger.error('Error fetching polls:', error)
    res.status(500).json({ error: 'Failed to fetch polls' })
  }
})

/**
 * Get single poll
 * GET /api/polls/:id
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const pollId = req.params.id
    const language = req.query.language as string || 'en'

    const poll = await prisma.poll.findUnique({
      where: { id: pollId, isActive: true },
      include: {
        pollTranslations: {
          where: { language }
        },
        options: {
          include: {
            pollOptionTranslations: {
              where: { language }
            },
            _count: {
              select: { votes: true }
            }
          }
        },
        category: {
          include: {
            categoryTranslations: {
              where: { language }
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
        },
        ...(req.user && {
          votes: {
            where: { userId: req.user.id },
            select: { optionId: true }
          }
        })
      }
    })

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' })
    }

    const formattedPoll = {
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
      userVoted: req.user ? poll.votes?.length > 0 : false,
      votedOptionId: req.user && poll.votes?.length > 0 ? poll.votes[0].optionId : null,
      sourceType: poll.sourceType,
      newsSourceUrl: poll.newsSourceUrl,
      aiGenerated: poll.aiGenerated,
      difficulty: poll.difficulty,
      isTrending: poll.isTrending
    }

    res.json(formattedPoll)

  } catch (error) {
    logger.error('Error fetching poll:', error)
    res.status(500).json({ error: 'Failed to fetch poll' })
  }
})

// Create poll
router.post('/',
  body('question').isString().isLength({ min: 10, max: 500 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('options').isArray({ min: 2, max: 6 }),
  body('options.*').isString().isLength({ min: 1, max: 200 }),
  body('categoryId').isUUID(),
  body('expiresAt').optional().isISO8601(),
  body('language').optional().isString(),
  validate,
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const { question, description, options, categoryId, expiresAt, language = 'en' } = req.body
    const userId = req.user!.id

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId, isActive: true }
    })

    if (!category) {
      throw createError('Invalid category', 400)
    }

    // Create poll with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create poll
      const poll = await tx.poll.create({
        data: {
          creatorId: userId,
          categoryId,
          originalLanguage: language,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          sourceType: 'USER'
        }
      })

      // Create poll translation
      await tx.pollTranslation.create({
        data: {
          pollId: poll.id,
          language,
          title: question,
          description
        }
      })

      // Create options and their translations
      for (let i = 0; i < options.length; i++) {
        const option = await tx.pollOption.create({
          data: {
            pollId: poll.id,
            orderIndex: i,
            originalLanguage: language
          }
        })

        await tx.pollOptionTranslation.create({
          data: {
            optionId: option.id,
            language,
            text: options[i]
          }
        })
      }

      return poll
    })

    logger.info(`Poll created: ${result.id} by user ${userId}`)

    res.status(201).json({
      id: result.id,
      message: 'Poll created successfully'
    })
  })
)

/**
 * Vote on poll
 * POST /api/polls/:id/vote
 */
router.post('/:id/vote', optionalAuth, async (req, res) => {
  try {
    const pollId = req.params.id
    const { optionId } = req.body
    const userId = req.user?.id
    const sessionId = req.sessionID || req.headers['x-session-id'] as string
    const ipAddress = req.ip

    if (!optionId) {
      return res.status(400).json({ error: 'Option ID is required' })
    }

    // Check if poll exists and is active
    const poll = await prisma.poll.findUnique({
      where: { id: pollId, isActive: true },
      include: {
        options: {
          select: { id: true }
        }
      }
    })

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' })
    }

    // Check if poll is expired
    if (poll.expiresAt && poll.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Poll has expired' })
    }

    // Check if option exists
    const optionExists = poll.options.some(option => option.id === optionId)
    if (!optionExists) {
      return res.status(400).json({ error: 'Invalid option' })
    }

    // Check for existing vote
    const existingVote = await prisma.vote.findFirst({
      where: {
        pollId,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(sessionId ? [{ sessionId }] : [])
        ]
      }
    })

    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted on this poll' })
    }

    // Create vote
    const vote = await prisma.vote.create({
      data: {
        pollId,
        optionId,
        userId,
        sessionId,
        ipAddress
      }
    })

    // Track analytics
    await analyticsService.trackVote(pollId, optionId, userId, sessionId)

    // Invalidate poll caches
    await globalCache.invalidatePoll(pollId)

    logger.info(`Vote cast: Poll ${pollId}, Option ${optionId}, User ${userId || 'anonymous'}`)

    // Get updated poll results
    const updatedOptions = await prisma.pollOption.findMany({
      where: { pollId },
      include: {
        _count: {
          select: { votes: true }
        }
      }
    })

    const totalVotes = updatedOptions.reduce((sum, option) => sum + option._count.votes, 0)

    const results = updatedOptions.map(option => ({
      optionId: option.id,
      votes: option._count.votes,
      percentage: totalVotes > 0 ? Math.round((option._count.votes / totalVotes) * 100) : 0
    }))

    res.json({
      message: 'Vote cast successfully',
      results,
      totalVotes,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error casting vote:', error)
    res.status(500).json({ error: 'Failed to cast vote' })
  }
})

// Get poll results/analytics
router.get('/:id/analytics',
  param('id').isUUID(),
  query('days').optional().isInt({ min: 1, max: 365 }),
  validate,
  asyncHandler(async (req, res) => {
    const pollId = req.params.id
    const days = parseInt(req.query.days as string) || 30

    const snapshots = await prisma.voteSnapshot.findMany({
      where: {
        pollId,
        snapshotDate: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        option: {
          include: {
            pollOptionTranslations: {
              where: { language: 'en' }
            }
          }
        }
      },
      orderBy: { snapshotDate: 'asc' }
    })

    const analytics = snapshots.reduce((acc, snapshot) => {
      const date = snapshot.snapshotDate.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push({
        optionId: snapshot.optionId,
        optionText: snapshot.option.pollOptionTranslations[0]?.text || 'Unknown',
        votes: snapshot.voteCount,
        percentage: parseFloat(snapshot.percentage.toString())
      })
      return acc
    }, {} as Record<string, any[]>)

    res.json({ analytics })
  })
)

export default router