const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message })
  }
})

// Get polls
app.get('/api/polls', async (req, res) => {
  try {
    console.log('Fetching polls...')
    
    const polls = await prisma.poll.findMany({
      where: { isActive: true },
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
        category: {
          include: {
            categoryTranslations: {
              where: { language: 'en' }
            }
          }
        },
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true
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
      orderBy: [
        { isTrending: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    console.log(`Found ${polls.length} polls`)

    const formattedPolls = polls.map(poll => ({
      id: poll.id,
      title: poll.pollTranslations[0]?.title || 'No title',
      description: poll.pollTranslations[0]?.description,
      options: poll.options.map(option => ({
        id: option.id,
        text: option.pollOptionTranslations[0]?.text || 'No text',
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
      sourceType: poll.sourceType,
      isTrending: poll.isTrending
    }))

    res.json({
      polls: formattedPolls,
      pagination: {
        page: 1,
        limit: 10,
        total: polls.length,
        pages: 1
      }
    })

  } catch (error) {
    console.error('Error fetching polls:', error)
    res.status(500).json({ error: 'Failed to fetch polls' })
  }
})

// Vote on poll
app.post('/api/polls/:id/vote', async (req, res) => {
  try {
    const { id: pollId } = req.params
    const { optionId } = req.body
    const sessionId = req.headers['x-session-id'] || 'demo-session'
    
    console.log(`Vote request: Poll ${pollId}, Option ${optionId}`)

    // Check if already voted
    const existingVote = await prisma.vote.findFirst({
      where: {
        pollId,
        sessionId
      }
    })

    if (existingVote) {
      return res.status(400).json({ error: 'Already voted' })
    }

    // Create vote
    await prisma.vote.create({
      data: {
        pollId,
        optionId,
        sessionId,
        ipAddress: req.ip || '127.0.0.1'
      }
    })

    // Get updated results
    const options = await prisma.pollOption.findMany({
      where: { pollId },
      include: {
        _count: { select: { votes: true } }
      }
    })

    const totalVotes = options.reduce((sum, opt) => sum + opt._count.votes, 0)
    const results = options.map(opt => ({
      optionId: opt.id,
      votes: opt._count.votes,
      percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0
    }))

    console.log(`Vote successful. New totals:`, results)

    res.json({
      message: 'Vote cast successfully',
      results,
      totalVotes
    })

  } catch (error) {
    console.error('Error voting:', error)
    res.status(500).json({ error: 'Failed to cast vote' })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Simple TapVote API running on port ${PORT}`)
  console.log(`📊 Health: http://localhost:${PORT}/health`)
  console.log(`🗳️  Polls: http://localhost:${PORT}/api/polls`)
})