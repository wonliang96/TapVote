import { Router } from 'express'
import { body } from 'express-validator'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { validate } from '../middleware/validation'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Register
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('username').optional().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('preferredLanguage').optional().isIn(['en', 'zh', 'ms']),
  validate,
  asyncHandler(async (req, res) => {
    const { email, password, username, preferredLanguage = 'en' } = req.body

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      }
    })

    if (existingUser) {
      throw createError('User with this email or username already exists', 409)
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username,
        preferredLanguage
      },
      select: {
        id: true,
        email: true,
        username: true,
        preferredLanguage: true,
        createdAt: true
      }
    })

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    logger.info(`User registered: ${user.id} (${user.email})`)

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    })
  })
)

// Login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      throw createError('Invalid credentials', 401)
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw createError('Invalid credentials', 401)
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    logger.info(`User logged in: ${user.id} (${user.email})`)

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        preferredLanguage: user.preferredLanguage
      },
      token
    })
  })
)

// Get current user profile
router.get('/me',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        preferredLanguage: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            polls: true,
            votes: true,
            comments: true
          }
        }
      }
    })

    if (!user) {
      throw createError('User not found', 404)
    }

    res.json(user)
  })
)

// Update user profile
router.put('/profile',
  authenticateToken,
  body('username').optional().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('preferredLanguage').optional().isIn(['en', 'zh', 'ms']),
  validate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { username, preferredLanguage } = req.body
    const userId = req.user!.id

    // Check if username is already taken
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: userId }
        }
      })

      if (existingUser) {
        throw createError('Username already taken', 409)
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(preferredLanguage && { preferredLanguage })
      },
      select: {
        id: true,
        email: true,
        username: true,
        preferredLanguage: true,
        updatedAt: true
      }
    })

    logger.info(`User profile updated: ${userId}`)

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    })
  })
)

// Change password
router.put('/password',
  authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  validate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = req.body
    const userId = req.user!.id

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw createError('User not found', 404)
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      throw createError('Current password is incorrect', 400)
    }

    // Hash new password
    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    })

    logger.info(`Password changed for user: ${userId}`)

    res.json({ message: 'Password changed successfully' })
  })
)

export { router as authRoutes }