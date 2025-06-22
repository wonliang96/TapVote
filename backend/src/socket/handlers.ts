import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'

interface AuthenticatedSocket extends Socket {
  userId?: string
}

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware for socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true }
        })
        
        if (user) {
          socket.userId = user.id
        }
      }
      
      next()
    } catch (error) {
      logger.error('Socket authentication error', error)
      next()
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Socket connected: ${socket.id}`)

    // Join poll room for real-time updates
    socket.on('join-poll', (pollId: string) => {
      socket.join(`poll:${pollId}`)
      logger.info(`Socket ${socket.id} joined poll:${pollId}`)
    })

    // Leave poll room
    socket.on('leave-poll', (pollId: string) => {
      socket.leave(`poll:${pollId}`)
      logger.info(`Socket ${socket.id} left poll:${pollId}`)
    })

    // Handle real-time voting
    socket.on('vote-cast', async (data: { pollId: string; optionId: string }) => {
      try {
        const { pollId, optionId } = data

        // Get updated poll results
        const pollOptions = await prisma.pollOption.findMany({
          where: { pollId },
          include: {
            _count: {
              select: { votes: true }
            }
          }
        })

        const totalVotes = pollOptions.reduce((sum, option) => sum + option._count.votes, 0)

        const results = pollOptions.map(option => ({
          optionId: option.id,
          votes: option._count.votes,
          percentage: totalVotes > 0 ? Math.round((option._count.votes / totalVotes) * 100) : 0
        }))

        // Broadcast updated results to all clients in the poll room
        io.to(`poll:${pollId}`).emit('poll-results-updated', {
          pollId,
          results,
          totalVotes
        })

        logger.info(`Real-time vote update broadcast for poll:${pollId}`)

      } catch (error) {
        logger.error('Socket vote-cast error', error)
        socket.emit('error', { message: 'Failed to process vote' })
      }
    })

    // Handle new comments
    socket.on('new-comment', async (data: { pollId: string; commentId: string }) => {
      try {
        const { pollId, commentId } = data

        // Get the new comment with details
        const comment = await prisma.comment.findUnique({
          where: { id: commentId },
          include: {
            commentTranslations: {
              where: { language: 'en' }
            },
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        })

        if (comment) {
          const formattedComment = {
            id: comment.id,
            content: comment.commentTranslations[0]?.content || 'Translation not available',
            author: comment.isAnonymous 
              ? { id: null, username: 'Anonymous' }
              : comment.user,
            createdAt: comment.createdAt,
            isAnonymous: comment.isAnonymous
          }

          // Broadcast new comment to all clients in the poll room
          io.to(`poll:${pollId}`).emit('new-comment', {
            pollId,
            comment: formattedComment
          })

          logger.info(`New comment broadcast for poll:${pollId}`)
        }

      } catch (error) {
        logger.error('Socket new-comment error', error)
        socket.emit('error', { message: 'Failed to process comment' })
      }
    })

    // Handle typing indicators for comments
    socket.on('typing-start', (data: { pollId: string; username: string }) => {
      socket.to(`poll:${data.pollId}`).emit('user-typing', {
        pollId: data.pollId,
        username: data.username,
        isTyping: true
      })
    })

    socket.on('typing-stop', (data: { pollId: string; username: string }) => {
      socket.to(`poll:${data.pollId}`).emit('user-typing', {
        pollId: data.pollId,
        username: data.username,
        isTyping: false
      })
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`)
    })
  })

  // Utility function to broadcast poll updates
  const broadcastPollUpdate = (pollId: string, update: any) => {
    io.to(`poll:${pollId}`).emit('poll-updated', {
      pollId,
      ...update
    })
  }

  // Export for use in other parts of the application
  return { broadcastPollUpdate }
}