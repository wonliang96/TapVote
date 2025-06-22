import { Server as SocketIOServer, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { logger } from '../lib/logger'
import { globalCache } from '../services/cacheService'
import { PredictionMarketService } from '../services/predictionMarket'
import { AnalyticsService } from '../services/analyticsService'

const prisma = new PrismaClient()
const predictionMarketService = new PredictionMarketService()
const analyticsService = new AnalyticsService()

interface AuthenticatedSocket extends Socket {
  userId?: string
  sessionId?: string
}

export class WebSocketHandlers {
  private io: SocketIOServer
  private connectedUsers = new Map<string, AuthenticatedSocket>()
  private pollRooms = new Map<string, Set<string>>()

  constructor(io: SocketIOServer) {
    this.io = io
    this.setupHandlers()
  }

  private setupHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`WebSocket connection established: ${socket.id}`)

      // Handle authentication
      socket.on('authenticate', async (data: { userId?: string; sessionId: string }) => {
        try {
          socket.userId = data.userId
          socket.sessionId = data.sessionId

          if (data.userId) {
            this.connectedUsers.set(data.userId, socket)
            
            // Update user's last active timestamp
            await prisma.user.update({
              where: { id: data.userId },
              data: { lastActiveAt: new Date() }
            })
          }

          socket.emit('authenticated', { success: true })
          logger.info(`User authenticated: ${data.userId || 'anonymous'} (${socket.id})`)

        } catch (error) {
          logger.error('Authentication error:', error)
          socket.emit('authenticated', { success: false, error: 'Authentication failed' })
        }
      })

      // Handle joining poll rooms for real-time updates
      socket.on('join_poll', async (data: { pollId: string }) => {
        try {
          const { pollId } = data

          // Verify poll exists
          const poll = await prisma.poll.findUnique({
            where: { id: pollId, isActive: true }
          })

          if (!poll) {
            socket.emit('error', { message: 'Poll not found' })
            return
          }

          // Join the poll room
          socket.join(`poll:${pollId}`)
          
          // Track room membership
          if (!this.pollRooms.has(pollId)) {
            this.pollRooms.set(pollId, new Set())
          }
          this.pollRooms.get(pollId)!.add(socket.id)

          // Send current poll state
          const pollData = await this.getPollData(pollId)
          socket.emit('poll_state', pollData)

          // Track analytics
          await analyticsService.trackPollView(
            pollId,
            socket.userId,
            socket.sessionId,
            { source: 'websocket' }
          )

          logger.info(`Socket ${socket.id} joined poll room: ${pollId}`)

        } catch (error) {
          logger.error('Error joining poll room:', error)
          socket.emit('error', { message: 'Failed to join poll' })
        }
      })

      // Handle leaving poll rooms
      socket.on('leave_poll', (data: { pollId: string }) => {
        const { pollId } = data
        socket.leave(`poll:${pollId}`)
        
        if (this.pollRooms.has(pollId)) {
          this.pollRooms.get(pollId)!.delete(socket.id)
        }

        logger.info(`Socket ${socket.id} left poll room: ${pollId}`)
      })

      // Handle real-time voting
      socket.on('vote', async (data: { pollId: string; optionId: string }) => {
        try {
          const { pollId, optionId } = data

          // Verify vote is valid (similar to REST API logic)
          const poll = await prisma.poll.findUnique({
            where: { id: pollId, isActive: true },
            include: { options: true }
          })

          if (!poll) {
            socket.emit('vote_error', { message: 'Poll not found' })
            return
          }

          if (poll.expiresAt && poll.expiresAt < new Date()) {
            socket.emit('vote_error', { message: 'Poll has expired' })
            return
          }

          const optionExists = poll.options.some(option => option.id === optionId)
          if (!optionExists) {
            socket.emit('vote_error', { message: 'Invalid option' })
            return
          }

          // Check for existing vote
          const existingVote = await prisma.vote.findFirst({
            where: {
              pollId,
              OR: [
                ...(socket.userId ? [{ userId: socket.userId }] : []),
                ...(socket.sessionId ? [{ sessionId: socket.sessionId }] : [])
              ]
            }
          })

          if (existingVote) {
            socket.emit('vote_error', { message: 'Already voted' })
            return
          }

          // Create vote
          await prisma.vote.create({
            data: {
              pollId,
              optionId,
              userId: socket.userId,
              sessionId: socket.sessionId,
              ipAddress: socket.handshake.address
            }
          })

          // Track analytics
          await analyticsService.trackVote(pollId, optionId, socket.userId, socket.sessionId)

          // Invalidate caches
          await globalCache.invalidatePoll(pollId)

          // Get updated poll data
          const updatedPollData = await this.getPollData(pollId)

          // Broadcast to all users in the poll room
          this.io.to(`poll:${pollId}`).emit('poll_updated', updatedPollData)

          // Send confirmation to voter
          socket.emit('vote_success', { 
            pollId, 
            optionId,
            timestamp: new Date().toISOString()
          })

          logger.info(`Real-time vote: Poll ${pollId}, Option ${optionId}, User ${socket.userId || 'anonymous'}`)

        } catch (error) {
          logger.error('Error processing real-time vote:', error)
          socket.emit('vote_error', { message: 'Failed to process vote' })
        }
      })

      // Handle real-time predictions
      socket.on('predict', async (data: { 
        pollId: string; 
        optionId: string; 
        confidence: number; 
        points: number; 
        reasoning?: string 
      }) => {
        try {
          if (!socket.userId) {
            socket.emit('predict_error', { message: 'Authentication required for predictions' })
            return
          }

          const { pollId, optionId, confidence, points, reasoning } = data

          // Create prediction using the service
          const prediction = await predictionMarketService.createPrediction({
            userId: socket.userId,
            pollId,
            optionId,
            confidence,
            points,
            reasoning
          })

          // Get updated market odds
          const marketOdds = await predictionMarketService.getMarketOdds(pollId)

          // Broadcast market update to all users in the poll room
          this.io.to(`poll:${pollId}`).emit('market_updated', {
            pollId,
            marketOdds,
            timestamp: new Date().toISOString()
          })

          // Send confirmation to predictor
          socket.emit('predict_success', {
            prediction,
            marketOdds,
            timestamp: new Date().toISOString()
          })

          logger.info(`Real-time prediction: Poll ${pollId}, User ${socket.userId}, Points ${points}`)

        } catch (error) {
          logger.error('Error processing real-time prediction:', error)
          socket.emit('predict_error', { 
            message: error.message || 'Failed to process prediction' 
          })
        }
      })

      // Handle real-time comments
      socket.on('comment', async (data: { 
        pollId: string; 
        content: string; 
        parentId?: string;
        language?: string 
      }) => {
        try {
          if (!socket.userId) {
            socket.emit('comment_error', { message: 'Authentication required for comments' })
            return
          }

          const { pollId, content, parentId, language = 'en' } = data

          if (!content || content.trim().length === 0) {
            socket.emit('comment_error', { message: 'Comment content is required' })
            return
          }

          // Create comment
          const comment = await prisma.comment.create({
            data: {
              pollId,
              userId: socket.userId,
              parentId,
              originalLanguage: language
            }
          })

          // Create comment translation
          await prisma.commentTranslation.create({
            data: {
              commentId: comment.id,
              language,
              content: content.trim()
            }
          })

          // Get comment with user info
          const commentWithUser = await prisma.comment.findUnique({
            where: { id: comment.id },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true
                }
              },
              commentTranslations: {
                where: { language }
              }
            }
          })

          // Broadcast new comment to all users in the poll room
          this.io.to(`poll:${pollId}`).emit('new_comment', {
            comment: commentWithUser,
            timestamp: new Date().toISOString()
          })

          // Send confirmation
          socket.emit('comment_success', {
            comment: commentWithUser,
            timestamp: new Date().toISOString()
          })

          logger.info(`Real-time comment: Poll ${pollId}, User ${socket.userId}`)

        } catch (error) {
          logger.error('Error processing real-time comment:', error)
          socket.emit('comment_error', { message: 'Failed to post comment' })
        }
      })

      // Handle typing indicators
      socket.on('typing_start', (data: { pollId: string }) => {
        if (socket.userId) {
          socket.to(`poll:${data.pollId}`).emit('user_typing', {
            userId: socket.userId,
            pollId: data.pollId
          })
        }
      })

      socket.on('typing_stop', (data: { pollId: string }) => {
        if (socket.userId) {
          socket.to(`poll:${data.pollId}`).emit('user_stopped_typing', {
            userId: socket.userId,
            pollId: data.pollId
          })
        }
      })

      // Handle poll resolution updates
      socket.on('subscribe_predictions', (data: { userId: string }) => {
        if (socket.userId === data.userId) {
          socket.join(`user_predictions:${data.userId}`)
          logger.info(`User ${data.userId} subscribed to prediction updates`)
        }
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId)
        }

        // Clean up poll room memberships
        this.pollRooms.forEach((members, pollId) => {
          members.delete(socket.id)
          if (members.size === 0) {
            this.pollRooms.delete(pollId)
          }
        })

        logger.info(`WebSocket disconnected: ${socket.id}`)
      })
    })
  }

  // Public methods for broadcasting updates from other parts of the application

  public async broadcastPollUpdate(pollId: string) {
    try {
      const pollData = await this.getPollData(pollId)
      this.io.to(`poll:${pollId}`).emit('poll_updated', pollData)
    } catch (error) {
      logger.error('Error broadcasting poll update:', error)
    }
  }

  public async broadcastMarketUpdate(pollId: string) {
    try {
      const marketOdds = await predictionMarketService.getMarketOdds(pollId)
      this.io.to(`poll:${pollId}`).emit('market_updated', {
        pollId,
        marketOdds,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Error broadcasting market update:', error)
    }
  }

  public broadcastPollResolution(pollId: string, winningOptionId: string) {
    this.io.to(`poll:${pollId}`).emit('poll_resolved', {
      pollId,
      winningOptionId,
      timestamp: new Date().toISOString()
    })
  }

  public broadcastUserNotification(userId: string, notification: any) {
    const userSocket = this.connectedUsers.get(userId)
    if (userSocket) {
      userSocket.emit('notification', notification)
    }

    // Also broadcast to user's prediction subscription room
    this.io.to(`user_predictions:${userId}`).emit('prediction_update', notification)
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size
  }

  public getPollRoomSize(pollId: string): number {
    return this.pollRooms.get(pollId)?.size || 0
  }

  // Private helper methods

  private async getPollData(pollId: string) {
    try {
      const cacheKey = `websocket:poll:${pollId}`
      const cachedData = await globalCache.get(cacheKey)
      
      if (cachedData) {
        return cachedData
      }

      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          pollTranslations: {
            where: { language: 'en' }
          },
          options: {
            include: {
              pollOptionTranslations: {
                where: { language: 'en' }
              },
              _count: {
                select: { votes: true }
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
        }
      })

      if (!poll) {
        throw new Error('Poll not found')
      }

      const pollData = {
        id: poll.id,
        title: poll.pollTranslations[0]?.title,
        description: poll.pollTranslations[0]?.description,
        options: poll.options.map(option => ({
          id: option.id,
          text: option.pollOptionTranslations[0]?.text,
          votes: option._count.votes,
          percentage: poll._count.votes > 0 
            ? Math.round((option._count.votes / poll._count.votes) * 100) 
            : 0
        })),
        totalVotes: poll._count.votes,
        totalComments: poll._count.comments,
        totalPredictions: poll._count.predictions,
        expiresAt: poll.expiresAt,
        isActive: poll.isActive,
        timestamp: new Date().toISOString()
      }

      // Cache for 30 seconds
      await globalCache.set(cacheKey, pollData, 30)

      return pollData

    } catch (error) {
      logger.error('Error getting poll data:', error)
      throw error
    }
  }
}

export default WebSocketHandlers