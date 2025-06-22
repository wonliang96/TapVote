import { Router } from 'express'
import { query } from 'express-validator'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { validate } from '../middleware/validation'

const router = Router()

// Get all categories
router.get('/',
  query('language').optional().isString(),
  validate,
  asyncHandler(async (req, res) => {
    const language = req.query.language as string || 'en'

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        categoryTranslations: {
          where: { language }
        },
        _count: {
          select: { polls: true }
        }
      },
      orderBy: { orderIndex: 'asc' }
    })

    const formattedCategories = categories.map(category => ({
      id: category.id,
      slug: category.slug,
      name: category.categoryTranslations[0]?.name || category.slug,
      description: category.categoryTranslations[0]?.description,
      icon: category.icon,
      color: category.color,
      pollCount: category._count.polls
    }))

    res.json(formattedCategories)
  })
)

// Get category by slug
router.get('/:slug',
  query('language').optional().isString(),
  validate,
  asyncHandler(async (req, res) => {
    const slug = req.params.slug
    const language = req.query.language as string || 'en'

    const category = await prisma.category.findUnique({
      where: { slug, isActive: true },
      include: {
        categoryTranslations: {
          where: { language }
        },
        _count: {
          select: { polls: true }
        }
      }
    })

    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }

    const formattedCategory = {
      id: category.id,
      slug: category.slug,
      name: category.categoryTranslations[0]?.name || category.slug,
      description: category.categoryTranslations[0]?.description,
      icon: category.icon,
      color: category.color,
      pollCount: category._count.polls
    }

    res.json(formattedCategory)
  })
)

export { router as categoryRoutes }