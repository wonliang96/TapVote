import { PrismaClient } from '@prisma/client'
import { logger } from '../lib/logger'

const prisma = new PrismaClient()

interface AnalyticsEvent {
  userId?: string
  sessionId: string
  eventType: string
  entityType?: string
  entityId?: string
  properties?: Record<string, any>
  timestamp: Date
  ipAddress?: string
  userAgent?: string
  referer?: string
  country?: string
  city?: string
}

interface DashboardMetrics {
  totalUsers: number
  totalPolls: number
  totalVotes: number
  totalPredictions: number
  activeUsers: {
    daily: number
    weekly: number
    monthly: number
  }
  engagement: {
    averageSessionTime: number
    bounceRate: number
    pagesPerSession: number
  }
  growth: {
    userGrowth: number
    pollGrowth: number
    voteGrowth: number
  }
  topCategories: Array<{
    category: string
    polls: number
    votes: number
    engagement: number
  }>
  recentActivity: Array<{
    type: string
    description: string
    timestamp: Date
    userId?: string
  }>
}

interface PollMetrics {
  pollId: string
  title: string
  totalVotes: number
  uniqueVoters: number
  totalViews: number
  conversionRate: number
  averageTimeOnPoll: number
  shareCount: number
  commentCount: number
  engagementScore: number
  votingPattern: Array<{
    hour: number
    votes: number
  }>
  demographicBreakdown: {
    byCountry: Record<string, number>
    byAge: Record<string, number>
    byDevice: Record<string, number>
  }
  predictionAccuracy?: number
  marketVolume?: number
}

interface UserAnalytics {
  userId: string
  totalPolls: number
  totalVotes: number
  totalPredictions: number
  accuracy: number
  reputation: number
  streak: number
  favoriteCategories: string[]
  activityPattern: Array<{
    hour: number
    activity: number
  }>
  engagementMetrics: {
    averageSessionTime: number
    totalSessions: number
    lastActive: Date
  }
  socialMetrics: {
    followers: number
    following: number
    totalShares: number
  }
}

export class AnalyticsService {
  private eventQueue: AnalyticsEvent[] = []
  private readonly BATCH_SIZE = 100
  private readonly FLUSH_INTERVAL = 30000 // 30 seconds
  private flushTimer?: NodeJS.Timeout

  constructor() {
    this.startBatchProcessor()
  }

  /**
   * Track an analytics event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): Promise<void> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date()
    }

    this.eventQueue.push(fullEvent)

    // Flush immediately for critical events
    const criticalEvents = ['user_registered', 'poll_created', 'prediction_placed']
    if (criticalEvents.includes(event.eventType)) {
      await this.flushEvents()
    }
  }

  /**
   * Get dashboard metrics for admin
   */
  async getDashboardMetrics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<DashboardMetrics> {
    const startDate = this.getTimeframeStart(timeframe)
    const previousStartDate = this.getPreviousPeriodStart(timeframe)

    // Basic counts
    const [totalUsers, totalPolls, totalVotes, totalPredictions] = await Promise.all([
      prisma.user.count(),
      prisma.poll.count(),
      prisma.vote.count(),
      prisma.prediction.count()
    ])

    // Active users
    const activeUsers = await this.getActiveUsers(startDate)
    
    // Engagement metrics
    const engagement = await this.getEngagementMetrics(startDate)
    
    // Growth metrics
    const growth = await this.getGrowthMetrics(startDate, previousStartDate)
    
    // Top categories
    const topCategories = await this.getTopCategories(startDate)
    
    // Recent activity
    const recentActivity = await this.getRecentActivity(20)

    return {
      totalUsers,
      totalPolls,
      totalVotes,
      totalPredictions,
      activeUsers,
      engagement,
      growth,
      topCategories,
      recentActivity
    }
  }

  /**
   * Get detailed analytics for a specific poll
   */
  async getPollAnalytics(pollId: string): Promise<PollMetrics> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        pollTranslations: {
          where: { language: 'en' }
        },
        votes: true,
        comments: true,
        predictions: true,
        analytics: {
          orderBy: { date: 'desc' },
          take: 30
        }
      }
    })

    if (!poll) {
      throw new Error('Poll not found')
    }

    // Calculate metrics
    const totalVotes = poll.votes.length
    const uniqueVoters = new Set(poll.votes.map(v => v.userId || v.sessionId)).size
    const totalViews = poll.analytics.reduce((sum, a) => sum + a.totalViews, 0)
    const conversionRate = totalViews > 0 ? (totalVotes / totalViews) * 100 : 0

    // Voting pattern (by hour)
    const votingPattern = this.calculateVotingPattern(poll.votes)
    
    // Demographic breakdown
    const demographicBreakdown = await this.getDemographicBreakdown(pollId)
    
    // Engagement score
    const engagementScore = this.calculateEngagementScore({
      votes: totalVotes,
      comments: poll.comments.length,
      shares: poll.totalShares,
      views: totalViews
    })

    return {
      pollId,
      title: poll.pollTranslations[0]?.title || 'Untitled Poll',
      totalVotes,
      uniqueVoters,
      totalViews,
      conversionRate,
      averageTimeOnPoll: poll.analytics.length > 0 
        ? poll.analytics.reduce((sum, a) => sum + a.averageTime, 0) / poll.analytics.length 
        : 0,
      shareCount: poll.totalShares,
      commentCount: poll.comments.length,
      engagementScore,
      votingPattern,
      demographicBreakdown,
      predictionAccuracy: poll.predictions.length > 0 
        ? this.calculatePredictionAccuracy(poll.predictions) 
        : undefined,
      marketVolume: poll.predictions.reduce((sum, p) => sum + p.points, 0)
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        polls: true,
        votes: true,
        predictions: {
          include: {
            poll: {
              select: {
                resolvedAt: true,
                resolutionResult: true
              }
            }
          }
        },
        followers: true,
        following: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Calculate accuracy
    const resolvedPredictions = user.predictions.filter(p => p.poll.resolvedAt)
    const correctPredictions = resolvedPredictions.filter(p => 
      p.poll.resolutionResult === p.optionId
    )
    const accuracy = resolvedPredictions.length > 0 
      ? (correctPredictions.length / resolvedPredictions.length) * 100 
      : 0

    // Get favorite categories
    const favoriteCategories = await this.getUserFavoriteCategories(userId)
    
    // Activity pattern
    const activityPattern = await this.getUserActivityPattern(userId)
    
    // Engagement metrics
    const engagementMetrics = await this.getUserEngagementMetrics(userId)

    return {
      userId,
      totalPolls: user.polls.length,
      totalVotes: user.votes.length,
      totalPredictions: user.predictions.length,
      accuracy,
      reputation: user.reputation,
      streak: user.streakDays,
      favoriteCategories,
      activityPattern,
      engagementMetrics,
      socialMetrics: {
        followers: user.followers.length,
        following: user.following.length,
        totalShares: 0 // Would need to track shares by user
      }
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(
    type: 'user' | 'poll' | 'category' | 'overall',
    timeframe: 'day' | 'week' | 'month' | 'year',
    filters?: Record<string, any>
  ): Promise<any> {
    const startDate = this.getTimeframeStart(timeframe)
    
    switch (type) {
      case 'user':
        return this.generateUserReport(startDate, filters)
      case 'poll':
        return this.generatePollReport(startDate, filters)
      case 'category':
        return this.generateCategoryReport(startDate, filters)
      case 'overall':
        return this.generateOverallReport(startDate, filters)
      default:
        throw new Error('Invalid report type')
    }
  }

  /**
   * Track poll view
   */
  async trackPollView(pollId: string, userId?: string, sessionId?: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId: sessionId || 'anonymous',
      eventType: 'poll_viewed',
      entityType: 'POLL',
      entityId: pollId,
      properties: metadata
    })

    // Update daily analytics
    await this.updateDailyAnalytics(pollId, 'view')
  }

  /**
   * Track vote
   */
  async trackVote(pollId: string, optionId: string, userId?: string, sessionId?: string): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId: sessionId || 'anonymous',
      eventType: 'vote_cast',
      entityType: 'POLL',
      entityId: pollId,
      properties: { optionId }
    })

    await this.updateDailyAnalytics(pollId, 'vote')
  }

  /**
   * Track prediction
   */
  async trackPrediction(pollId: string, predictionId: string, userId: string, confidence: number, points: number): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId: userId,
      eventType: 'prediction_placed',
      entityType: 'PREDICTION',
      entityId: predictionId,
      properties: { pollId, confidence, points }
    })
  }

  /**
   * Private helper methods
   */
  private startBatchProcessor(): void {
    this.flushTimer = setInterval(async () => {
      if (this.eventQueue.length > 0) {
        await this.flushEvents()
      }
    }, this.FLUSH_INTERVAL)
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const events = this.eventQueue.splice(0, this.BATCH_SIZE)
    
    try {
      // In a real implementation, you'd store these in a time-series database
      // For now, we'll just log them
      logger.info(`Processing ${events.length} analytics events`)
      
      // Could store in ClickHouse, TimescaleDB, or similar
      // await this.storeEventsInTimeSeriesDB(events)
      
    } catch (error) {
      logger.error('Error flushing analytics events:', error)
      // Re-queue events on failure
      this.eventQueue.unshift(...events)
    }
  }

  private getTimeframeStart(timeframe: string): Date {
    const now = new Date()
    switch (timeframe) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
  }

  private getPreviousPeriodStart(timeframe: string): Date {
    const current = this.getTimeframeStart(timeframe)
    const now = new Date()
    const duration = now.getTime() - current.getTime()
    return new Date(current.getTime() - duration)
  }

  private async getActiveUsers(startDate: Date): Promise<{ daily: number; weekly: number; monthly: number }> {
    const daily = await prisma.user.count({
      where: {
        lastActiveAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })

    const weekly = await prisma.user.count({
      where: {
        lastActiveAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    })

    const monthly = await prisma.user.count({
      where: {
        lastActiveAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })

    return { daily, weekly, monthly }
  }

  private async getEngagementMetrics(startDate: Date): Promise<{
    averageSessionTime: number
    bounceRate: number
    pagesPerSession: number
  }> {
    // These would be calculated from stored analytics events
    // For now, return placeholder values
    return {
      averageSessionTime: 180, // 3 minutes
      bounceRate: 0.35, // 35%
      pagesPerSession: 2.5
    }
  }

  private async getGrowthMetrics(startDate: Date, previousStartDate: Date): Promise<{
    userGrowth: number
    pollGrowth: number
    voteGrowth: number
  }> {
    const [currentUsers, previousUsers] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count({ where: { createdAt: { gte: previousStartDate, lt: startDate } } })
    ])

    const [currentPolls, previousPolls] = await Promise.all([
      prisma.poll.count({ where: { createdAt: { gte: startDate } } }),
      prisma.poll.count({ where: { createdAt: { gte: previousStartDate, lt: startDate } } })
    ])

    const [currentVotes, previousVotes] = await Promise.all([
      prisma.vote.count({ where: { createdAt: { gte: startDate } } }),
      prisma.vote.count({ where: { createdAt: { gte: previousStartDate, lt: startDate } } })
    ])

    return {
      userGrowth: previousUsers > 0 ? ((currentUsers - previousUsers) / previousUsers) * 100 : 0,
      pollGrowth: previousPolls > 0 ? ((currentPolls - previousPolls) / previousPolls) * 100 : 0,
      voteGrowth: previousVotes > 0 ? ((currentVotes - previousVotes) / previousVotes) * 100 : 0
    }
  }

  private async getTopCategories(startDate: Date): Promise<Array<{
    category: string
    polls: number
    votes: number
    engagement: number
  }>> {
    const categories = await prisma.category.findMany({
      include: {
        polls: {
          where: { createdAt: { gte: startDate } },
          include: {
            votes: true,
            comments: true
          }
        }
      }
    })

    return categories.map(category => {
      const polls = category.polls.length
      const votes = category.polls.reduce((sum, poll) => sum + poll.votes.length, 0)
      const comments = category.polls.reduce((sum, poll) => sum + poll.comments.length, 0)
      const engagement = polls > 0 ? (votes + comments) / polls : 0

      return {
        category: category.categoryTranslations[0]?.name || category.slug,
        polls,
        votes,
        engagement
      }
    }).sort((a, b) => b.engagement - a.engagement)
  }

  private async getRecentActivity(limit: number): Promise<Array<{
    type: string
    description: string
    timestamp: Date
    userId?: string
  }>> {
    // This would come from analytics events
    // For now, return recent polls and votes
    const recentPolls = await prisma.poll.findMany({
      take: limit / 2,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { username: true, displayName: true } },
        pollTranslations: { where: { language: 'en' } }
      }
    })

    const recentVotes = await prisma.vote.findMany({
      take: limit / 2,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true, displayName: true } },
        poll: {
          include: {
            pollTranslations: { where: { language: 'en' } }
          }
        }
      }
    })

    const activity = [
      ...recentPolls.map(poll => ({
        type: 'poll_created',
        description: `${poll.creator.username || poll.creator.displayName || 'Someone'} created "${poll.pollTranslations[0]?.title || 'a poll'}"`,
        timestamp: poll.createdAt,
        userId: poll.creatorId
      })),
      ...recentVotes.map(vote => ({
        type: 'vote_cast',
        description: `${vote.user?.username || vote.user?.displayName || 'Someone'} voted on "${vote.poll.pollTranslations[0]?.title || 'a poll'}"`,
        timestamp: vote.createdAt,
        userId: vote.userId || undefined
      }))
    ]

    return activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
  }

  private calculateVotingPattern(votes: any[]): Array<{ hour: number; votes: number }> {
    const pattern = Array.from({ length: 24 }, (_, hour) => ({ hour, votes: 0 }))
    
    votes.forEach(vote => {
      const hour = new Date(vote.createdAt).getHours()
      pattern[hour].votes++
    })

    return pattern
  }

  private async getDemographicBreakdown(pollId: string): Promise<{
    byCountry: Record<string, number>
    byAge: Record<string, number>
    byDevice: Record<string, number>
  }> {
    // This would be calculated from analytics events with IP geolocation and user agent parsing
    return {
      byCountry: { 'US': 45, 'CA': 20, 'UK': 15, 'Other': 20 },
      byAge: { '18-24': 30, '25-34': 35, '35-44': 20, '45+': 15 },
      byDevice: { 'Mobile': 65, 'Desktop': 30, 'Tablet': 5 }
    }
  }

  private calculateEngagementScore(metrics: {
    votes: number
    comments: number
    shares: number
    views: number
  }): number {
    if (metrics.views === 0) return 0
    
    const voteRate = metrics.votes / metrics.views
    const commentRate = metrics.comments / metrics.views
    const shareRate = metrics.shares / metrics.views
    
    // Weighted engagement score
    return (voteRate * 0.5 + commentRate * 0.3 + shareRate * 0.2) * 100
  }

  private calculatePredictionAccuracy(predictions: any[]): number {
    const resolved = predictions.filter(p => p.isResolved)
    if (resolved.length === 0) return 0
    
    const correct = resolved.filter(p => p.payout && p.payout > p.points)
    return (correct.length / resolved.length) * 100
  }

  private async getUserFavoriteCategories(userId: string): Promise<string[]> {
    const userPolls = await prisma.poll.findMany({
      where: { creatorId: userId },
      include: { category: true }
    })

    const categoryCount = new Map<string, number>()
    userPolls.forEach(poll => {
      const category = poll.category.slug
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1)
    })

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category)
  }

  private async getUserActivityPattern(userId: string): Promise<Array<{ hour: number; activity: number }>> {
    const pattern = Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 }))
    
    // Get user's votes and polls by hour
    const votes = await prisma.vote.findMany({
      where: { userId },
      select: { createdAt: true }
    })

    const polls = await prisma.poll.findMany({
      where: { creatorId: userId },
      select: { createdAt: true }
    })

    const allItems = votes.concat(polls)
    allItems.forEach(item => {
      const hour = new Date(item.createdAt).getHours()
      pattern[hour].activity++
    })

    return pattern
  }

  private async getUserEngagementMetrics(userId: string): Promise<{
    averageSessionTime: number
    totalSessions: number
    lastActive: Date
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveAt: true }
    })

    // These would be calculated from analytics events
    return {
      averageSessionTime: 240, // 4 minutes
      totalSessions: 50,
      lastActive: user?.lastActiveAt || new Date()
    }
  }

  private async updateDailyAnalytics(pollId: string, type: 'view' | 'vote'): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const updateData = type === 'view' 
      ? { totalViews: { increment: 1 } }
      : { totalVotes: { increment: 1 } }

    await prisma.pollAnalytics.upsert({
      where: {
        pollId_date: {
          pollId,
          date: today
        }
      },
      update: updateData,
      create: {
        pollId,
        date: today,
        ...updateData
      }
    })
  }

  private async generateUserReport(startDate: Date, filters?: Record<string, any>): Promise<any> {
    // Implementation for user-specific reports
    return { type: 'user', timeframe: 'week', data: {} }
  }

  private async generatePollReport(startDate: Date, filters?: Record<string, any>): Promise<any> {
    // Implementation for poll-specific reports
    return { type: 'poll', timeframe: 'week', data: {} }
  }

  private async generateCategoryReport(startDate: Date, filters?: Record<string, any>): Promise<any> {
    // Implementation for category-specific reports
    return { type: 'category', timeframe: 'week', data: {} }
  }

  private async generateOverallReport(startDate: Date, filters?: Record<string, any>): Promise<any> {
    // Implementation for overall platform reports
    return { type: 'overall', timeframe: 'week', data: {} }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
  }
}