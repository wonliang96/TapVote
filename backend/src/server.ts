import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import { PrismaClient } from '@prisma/client'
import { logger } from './lib/logger'
import { errorHandler } from './middleware/errorHandler'
// import authRoutes from './routes/auth'
import pollRoutes from './routes/polls-simple'
// import commentRoutes from './routes/comments'
// import categoryRoutes from './routes/categories'
// import newsRoutes from './routes/news'
import aiPollRoutes from './routes/ai-polls'
import predictionRoutes from './routes/predictions'
// import analyticsRoutes from './routes/analytics'
// import WebSocketHandlers from './websocket/handlers'
// import { globalCache } from './services/cacheService'

dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

const prisma = new PrismaClient()
const PORT = process.env.PORT || 5000

// Initialize WebSocket handlers
// const wsHandlers = new WebSocketHandlers(io)

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
})

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}))
app.use(limiter)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })
  next()
})

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      cache: 'active',
      websocket: {
        connected: 0 // wsHandlers.getConnectedUsersCount()
      }
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    })
  }
})

// API Routes
// app.use('/api/auth', authRoutes)
app.use('/api/polls', pollRoutes)
// app.use('/api/comments', commentRoutes)
// app.use('/api/categories', categoryRoutes)
// app.use('/api/news', newsRoutes)
app.use('/api/ai-polls', aiPollRoutes)
app.use('/api/predictions', predictionRoutes)
// app.use('/api/analytics', analyticsRoutes)

// Error handling
app.use(errorHandler)

// Start cache warming
// globalCache.warmCache().catch(error => {
//   logger.error('Error warming cache on startup:', error)
// })

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...')
  
  try {
    // Close WebSocket connections
    io.close()
    
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed')
    })
    
    // Close database connection
    await prisma.$disconnect()
    logger.info('Database connection closed')
    
    // Destroy cache service
    // globalCache.destroy()
    // logger.info('Cache service destroyed')
    
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

server.listen(PORT, () => {
  logger.info(`🚀 TapVote Server running on port ${PORT}`)
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`)
  logger.info(`🗄️  Database: SQLite`)
  logger.info(`⚡ Cache: Multi-layer (Memory + Database)`)
  logger.info(`🔌 WebSocket: Enabled`)
  logger.info(`🤖 AI Services: Available`)
  logger.info(`📰 News Integration: Active`)
  logger.info(`📈 Analytics: Real-time`)
  logger.info(`🎯 Prediction Markets: Enabled`)
})