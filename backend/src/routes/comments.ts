import { Router } from 'express'
import { body, query, param } from 'express-validator'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { validate } from '../middleware/validation'

const router = Router()

// Get comments for a poll
router.get('/',
  query('pollId').isUUID(),
  query('language').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const pollId = req.query.pollId as string
    const language = req.query.language as string || 'en'
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const comments = await prisma.comment.findMany({
      where: {
        pollId,
        parentId: null, // Only top-level comments
        isDeleted: false
      },
      include: {
        commentTranslations: {
          where: { language }
        },
        user: {
          select: {
            id: true,
            username: true
          }
        },
        replies: {
          include: {
            commentTranslations: {
              where: { language }
            },
            user: {
              select: {
                id: true,
                username: true
              }
            }
          },
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.comment.count({
      where: {
        pollId,
        parentId: null,
        isDeleted: false
      }
    })

    const formattedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.commentTranslations[0]?.content || 'Translation not available',
      author: comment.isAnonymous 
        ? { id: null, username: 'Anonymous' }
        : comment.user,
      createdAt: comment.createdAt,
      isAnonymous: comment.isAnonymous,
      replies: comment.replies.map(reply => ({
        id: reply.id,
        content: reply.commentTranslations[0]?.content || 'Translation not available',
        author: reply.isAnonymous 
          ? { id: null, username: 'Anonymous' }
          : reply.user,
        createdAt: reply.createdAt,
        isAnonymous: reply.isAnonymous
      }))
    }))

    res.json({
      comments: formattedComments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  })
)

// Create comment
router.post('/',
  body('pollId').isUUID(),
  body('content').isString().isLength({ min: 1, max: 1000 }),
  body('parentId').optional().isUUID(),
  body('isAnonymous').optional().isBoolean(),
  body('language').optional().isString(),
  validate,
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { pollId, content, parentId, isAnonymous = false, language = 'en' } = req.body
    const userId = req.user?.id

    // Check if poll exists
    const poll = await prisma.poll.findUnique({
      where: { id: pollId, isActive: true }
    })

    if (!poll) {
      throw createError('Poll not found', 404)
    }

    // Check if parent comment exists (for replies)
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId, pollId, isDeleted: false }
      })

      if (!parentComment) {
        throw createError('Parent comment not found', 404)
      }
    }

    // Create comment with transaction
    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          pollId,
          parentId,
          userId: isAnonymous ? null : userId,
          isAnonymous,
          originalLanguage: language
        }
      })

      await tx.commentTranslation.create({
        data: {
          commentId: comment.id,
          language,
          content
        }
      })

      return comment
    })

    logger.info(`Comment created: ${result.id} on poll ${pollId}`)

    res.status(201).json({
      id: result.id,
      message: 'Comment created successfully'
    })
  })
)

// Delete comment (soft delete)
router.delete('/:id',
  param('id').isUUID(),
  validate,
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const commentId = req.params.id
    const userId = req.user!.id

    const comment = await prisma.comment.findUnique({
      where: { id: commentId, isDeleted: false }
    })

    if (!comment) {
      throw createError('Comment not found', 404)
    }

    // Check if user owns the comment
    if (comment.userId !== userId) {
      throw createError('Not authorized to delete this comment', 403)
    }

    // Soft delete
    await prisma.comment.update({
      where: { id: commentId },
      data: { isDeleted: true }
    })

    logger.info(`Comment deleted: ${commentId} by user ${userId}`)

    res.json({ message: 'Comment deleted successfully' })
  })
)

// Flag comment
router.post('/:id/flag',
  param('id').isUUID(),
  validate,
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const commentId = req.params.id

    const comment = await prisma.comment.findUnique({
      where: { id: commentId, isDeleted: false }
    })

    if (!comment) {
      throw createError('Comment not found', 404)
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { isFlagged: true }
    })

    logger.info(`Comment flagged: ${commentId}`)

    res.json({ message: 'Comment flagged for review' })
  })
)

export { router as commentRoutes }