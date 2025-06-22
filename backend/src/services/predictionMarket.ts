import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'

interface MarketOdds {
  optionId: string
  option: string
  probability: number
  impliedOdds: string
  volume: number
  trend: 'up' | 'down' | 'stable'
  confidence: number
}

interface PredictionPayload {
  userId: string
  pollId: string
  optionId: string
  confidence: number
  points: number
  reasoning?: string
}

interface MarketAnalytics {
  totalVolume: number
  uniquePredictors: number
  averageConfidence: number
  consensusProbability: number
  marketEfficiency: number
  volatility: number
  liquidityIndex: number
}

export class PredictionMarketService {
  private readonly HOUSE_EDGE = 0.05 // 5% house edge
  private readonly MIN_PREDICTION = 1
  private readonly MAX_PREDICTION = 1000
  private readonly CONFIDENCE_WEIGHT = 0.7
  private readonly VOLUME_WEIGHT = 0.3

  /**
   * Create a new prediction in the market
   */
  async createPrediction(payload: PredictionPayload): Promise<any> {
    const { userId, pollId, optionId, confidence, points, reasoning } = payload

    // Validate inputs
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1')
    }

    if (points < this.MIN_PREDICTION || points > this.MAX_PREDICTION) {
      throw new Error(`Points must be between ${this.MIN_PREDICTION} and ${this.MAX_PREDICTION}`)
    }

    // Check if poll is still active
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true }
    })

    if (!poll || !poll.isActive) {
      throw new Error('Poll is not active')
    }

    if (poll.expiresAt && new Date() > poll.expiresAt) {
      throw new Error('Poll has expired')
    }

    // Check if user already has a prediction for this poll
    const existingPrediction = await prisma.prediction.findUnique({
      where: {
        userId_pollId: {
          userId,
          pollId
        }
      }
    })

    let prediction
    if (existingPrediction) {
      // Update existing prediction
      prediction = await prisma.prediction.update({
        where: { id: existingPrediction.id },
        data: {
          optionId,
          confidence,
          points,
          reasoning,
          createdAt: new Date() // Update timestamp for market calculations
        }
      })
    } else {
      // Create new prediction
      prediction = await prisma.prediction.create({
        data: {
          userId,
          pollId,
          optionId,
          confidence,
          points,
          reasoning
        }
      })
    }

    // Update market odds and analytics
    await this.updateMarketOdds(pollId)
    await this.updatePollAnalytics(pollId)
    
    // Check for achievement triggers
    await this.checkPredictionAchievements(userId)

    return prediction
  }

  /**
   * Get current market odds for a poll
   */
  async getMarketOdds(pollId: string): Promise<MarketOdds[]> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          include: {
            predictions: {
              where: { isResolved: false }
            },
            pollOptionTranslations: {
              where: { language: 'en' }
            }
          }
        }
      }
    })

    if (!poll) {
      throw new Error('Poll not found')
    }

    const marketOdds: MarketOdds[] = []
    const totalVolume = poll.options.reduce((sum, option) => 
      sum + option.predictions.reduce((optSum, pred) => optSum + pred.points, 0), 0
    )

    for (const option of poll.options) {
      const predictions = option.predictions
      const volume = predictions.reduce((sum, pred) => sum + pred.points, 0)
      const weightedConfidence = this.calculateWeightedConfidence(predictions)
      const probability = this.calculateMarketProbability(predictions, totalVolume)
      
      // Calculate trend based on recent predictions
      const trend = await this.calculateTrend(option.id)
      
      marketOdds.push({
        optionId: option.id,
        option: option.pollOptionTranslations[0]?.text || `Option ${option.orderIndex + 1}`,
        probability,
        impliedOdds: this.formatOdds(probability),
        volume,
        trend,
        confidence: weightedConfidence
      })
    }

    // Normalize probabilities to sum to 1 (accounting for house edge)
    const totalProb = marketOdds.reduce((sum, odds) => sum + odds.probability, 0)
    const normalizationFactor = (1 - this.HOUSE_EDGE) / totalProb
    
    marketOdds.forEach(odds => {
      odds.probability *= normalizationFactor
      odds.impliedOdds = this.formatOdds(odds.probability)
    })

    return marketOdds.sort((a, b) => b.probability - a.probability)
  }

  /**
   * Get market analytics for a poll
   */
  async getMarketAnalytics(pollId: string): Promise<MarketAnalytics> {
    const predictions = await prisma.prediction.findMany({
      where: { 
        pollId,
        isResolved: false
      },
      include: {
        user: {
          select: { id: true, reputation: true }
        }
      }
    })

    const totalVolume = predictions.reduce((sum, pred) => sum + pred.points, 0)
    const uniquePredictors = new Set(predictions.map(p => p.userId)).size
    const averageConfidence = predictions.length > 0 
      ? predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length 
      : 0

    // Calculate consensus probability (weighted by reputation and points)
    const consensusProbability = this.calculateConsensus(predictions)
    
    // Market efficiency (how close predictions are to each other)
    const marketEfficiency = this.calculateMarketEfficiency(predictions)
    
    // Volatility (how much predictions change over time)
    const volatility = await this.calculateVolatility(pollId)
    
    // Liquidity index (based on volume and number of predictors)
    const liquidityIndex = this.calculateLiquidityIndex(totalVolume, uniquePredictors)

    return {
      totalVolume,
      uniquePredictors,
      averageConfidence,
      consensusProbability,
      marketEfficiency,
      volatility,
      liquidityIndex
    }
  }

  /**
   * Resolve poll and calculate payouts
   */
  async resolvePoll(pollId: string, winningOptionId: string, resolutionSource: string): Promise<void> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        predictions: {
          where: { isResolved: false }
        }
      }
    })

    if (!poll) {
      throw new Error('Poll not found')
    }

    if (poll.resolvedAt) {
      throw new Error('Poll already resolved')
    }

    // Update poll resolution
    await prisma.poll.update({
      where: { id: pollId },
      data: {
        resolvedAt: new Date(),
        resolutionResult: winningOptionId,
        resolutionSource,
        isActive: false
      }
    })

    // Calculate payouts
    const totalPool = poll.predictions.reduce((sum, pred) => sum + pred.points, 0)
    const winningPredictions = poll.predictions.filter(pred => pred.optionId === winningOptionId)
    const winningPool = winningPredictions.reduce((sum, pred) => sum + pred.points, 0)

    if (winningPool === 0) {
      // No one predicted correctly, house keeps all
      logger.info(`Poll ${pollId} resolved with no winners`)
      return
    }

    // Calculate payouts proportional to confidence and stake
    for (const prediction of winningPredictions) {
      const share = prediction.points / winningPool
      const basePayout = share * totalPool * (1 - this.HOUSE_EDGE)
      
      // Bonus for high confidence
      const confidenceBonus = prediction.confidence * 0.1
      const finalPayout = Math.floor(basePayout * (1 + confidenceBonus))

      await prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          payout: finalPayout,
          isResolved: true,
          resolvedAt: new Date()
        }
      })

      // Update user reputation
      await this.updateUserReputation(prediction.userId, finalPayout, prediction.confidence)
    }

    // Mark losing predictions as resolved
    const losingPredictions = poll.predictions.filter(pred => pred.optionId !== winningOptionId)
    for (const prediction of losingPredictions) {
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          payout: 0,
          isResolved: true,
          resolvedAt: new Date()
        }
      })

      // Small reputation penalty for incorrect predictions
      await this.updateUserReputation(prediction.userId, -prediction.points * 0.1, 0)
    }

    // Create notifications
    await this.createResolutionNotifications(pollId, winningOptionId)
    
    logger.info(`Poll ${pollId} resolved. Winning option: ${winningOptionId}. Total pool: ${totalPool}`)
  }

  /**
   * Get leaderboard for prediction market
   */
  async getLeaderboard(timeframe: 'daily' | 'weekly' | 'monthly' | 'all' = 'all', limit = 50) {
    const startDate = this.getTimeframeStart(timeframe)
    
    const users = await prisma.user.findMany({
      where: {
        predictions: {
          some: {
            createdAt: startDate ? { gte: startDate } : undefined
          }
        }
      },
      include: {
        predictions: {
          where: {
            isResolved: true,
            createdAt: startDate ? { gte: startDate } : undefined
          }
        },
        _count: {
          select: {
            predictions: {
              where: {
                createdAt: startDate ? { gte: startDate } : undefined
              }
            }
          }
        }
      },
      take: limit
    })

    return users.map(user => {
      const totalPayout = user.predictions.reduce((sum, pred) => sum + (pred.payout || 0), 0)
      const totalStake = user.predictions.reduce((sum, pred) => sum + pred.points, 0)
      const winRate = user.predictions.length > 0 
        ? user.predictions.filter(pred => (pred.payout || 0) > 0).length / user.predictions.length 
        : 0
      const roi = totalStake > 0 ? ((totalPayout - totalStake) / totalStake) * 100 : 0

      return {
        userId: user.id,
        username: user.username || user.displayName || 'Anonymous',
        avatar: user.avatar,
        reputation: user.reputation,
        totalPredictions: user._count.predictions,
        totalPayout,
        totalStake,
        netProfit: totalPayout - totalStake,
        winRate: Math.round(winRate * 100),
        roi: Math.round(roi * 100) / 100
      }
    }).sort((a, b) => b.netProfit - a.netProfit)
  }

  /**
   * Private helper methods
   */
  private calculateWeightedConfidence(predictions: any[]): number {
    if (predictions.length === 0) return 0
    
    const totalWeight = predictions.reduce((sum, pred) => sum + pred.points, 0)
    if (totalWeight === 0) return 0
    
    return predictions.reduce((sum, pred) => 
      sum + (pred.confidence * pred.points), 0
    ) / totalWeight
  }

  private calculateMarketProbability(predictions: any[], totalVolume: number): number {
    if (predictions.length === 0 || totalVolume === 0) return 0
    
    const optionVolume = predictions.reduce((sum, pred) => sum + pred.points, 0)
    const weightedConfidence = this.calculateWeightedConfidence(predictions)
    
    // Combine volume share with weighted confidence
    const volumeShare = optionVolume / totalVolume
    return (volumeShare * this.VOLUME_WEIGHT) + (weightedConfidence * this.CONFIDENCE_WEIGHT)
  }

  private async calculateTrend(optionId: string): Promise<'up' | 'down' | 'stable'> {
    const recentPredictions = await prisma.prediction.findMany({
      where: { 
        optionId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    if (recentPredictions.length < 2) return 'stable'

    const firstHalf = recentPredictions.slice(0, Math.floor(recentPredictions.length / 2))
    const secondHalf = recentPredictions.slice(Math.floor(recentPredictions.length / 2))

    const firstAvg = firstHalf.reduce((sum, pred) => sum + pred.confidence, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, pred) => sum + pred.confidence, 0) / secondHalf.length

    const threshold = 0.05
    if (secondAvg > firstAvg + threshold) return 'up'
    if (secondAvg < firstAvg - threshold) return 'down'
    return 'stable'
  }

  private formatOdds(probability: number): string {
    if (probability === 0) return '∞:1'
    if (probability === 1) return '1:∞'
    
    const odds = (1 / probability) - 1
    if (odds >= 1) {
      return `${odds.toFixed(1)}:1`
    } else {
      return `1:${(1/odds).toFixed(1)}`
    }
  }

  private calculateConsensus(predictions: any[]): number {
    if (predictions.length === 0) return 0
    
    // Weight by user reputation and stake
    const totalWeight = predictions.reduce((sum, pred) => 
      sum + (pred.points * (1 + pred.user.reputation / 1000)), 0
    )
    
    return predictions.reduce((sum, pred) => 
      sum + (pred.confidence * pred.points * (1 + pred.user.reputation / 1000)), 0
    ) / totalWeight
  }

  private calculateMarketEfficiency(predictions: any[]): number {
    if (predictions.length < 2) return 1
    
    const confidences = predictions.map(pred => pred.confidence)
    const mean = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
    const variance = confidences.reduce((sum, conf) => sum + Math.pow(conf - mean, 2), 0) / confidences.length
    
    // Lower variance = higher efficiency
    return Math.max(0, 1 - (variance * 4)) // Scale to 0-1 range
  }

  private async calculateVolatility(pollId: string): Promise<number> {
    const snapshots = await prisma.voteSnapshot.findMany({
      where: { pollId },
      orderBy: { snapshotDate: 'asc' },
      take: 10 // Last 10 snapshots
    })

    if (snapshots.length < 2) return 0

    const percentageChanges = []
    for (let i = 1; i < snapshots.length; i++) {
      const change = Math.abs(snapshots[i].percentage - snapshots[i-1].percentage)
      percentageChanges.push(change)
    }

    return percentageChanges.reduce((sum, change) => sum + change, 0) / percentageChanges.length
  }

  private calculateLiquidityIndex(volume: number, predictors: number): number {
    // Normalize to 0-1 scale based on typical market values
    const volumeScore = Math.min(volume / 10000, 1) // Max at 10k points
    const predictorScore = Math.min(predictors / 100, 1) // Max at 100 predictors
    
    return (volumeScore + predictorScore) / 2
  }

  private async updateMarketOdds(pollId: string): Promise<void> {
    // This would trigger real-time updates via WebSocket
    // Implementation depends on your WebSocket setup
  }

  private async updatePollAnalytics(pollId: string): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const predictions = await prisma.prediction.findMany({
      where: { pollId }
    })

    const analytics = await prisma.pollAnalytics.upsert({
      where: {
        pollId_date: {
          pollId,
          date: today
        }
      },
      update: {
        uniqueVoters: new Set(predictions.map(p => p.userId)).size,
        totalVotes: predictions.length,
        engagementRate: predictions.length > 0 ? predictions.length / 100 : 0 // Placeholder calculation
      },
      create: {
        pollId,
        date: today,
        uniqueVoters: new Set(predictions.map(p => p.userId)).size,
        totalVotes: predictions.length,
        engagementRate: predictions.length > 0 ? predictions.length / 100 : 0
      }
    })
  }

  private async checkPredictionAchievements(userId: string): Promise<void> {
    // Check for various achievements
    const userPredictions = await prisma.prediction.count({
      where: { userId }
    })

    const achievements = []
    if (userPredictions === 1) achievements.push('first_prediction')
    if (userPredictions === 10) achievements.push('prediction_novice')
    if (userPredictions === 100) achievements.push('prediction_expert')

    // Implement achievement unlocking logic
    for (const achievementName of achievements) {
      await this.unlockAchievement(userId, achievementName)
    }
  }

  private async unlockAchievement(userId: string, achievementName: string): Promise<void> {
    const achievement = await prisma.achievement.findUnique({
      where: { name: achievementName }
    })

    if (!achievement) return

    await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id
        }
      },
      update: { isCompleted: true },
      create: {
        userId,
        achievementId: achievement.id,
        isCompleted: true
      }
    })

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Achievement Unlocked!',
        message: `You earned the "${achievement.name}" achievement!`,
        data: { achievementId: achievement.id }
      }
    })
  }

  private async updateUserReputation(userId: string, pointChange: number, confidence: number): Promise<void> {
    const reputationChange = Math.floor(pointChange * 0.1 * (1 + confidence))
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        reputation: {
          increment: reputationChange
        }
      }
    })
  }

  private async createResolutionNotifications(pollId: string, winningOptionId: string): Promise<void> {
    const predictions = await prisma.prediction.findMany({
      where: { pollId },
      include: { user: true }
    })

    for (const prediction of predictions) {
      const isWinner = prediction.optionId === winningOptionId
      await prisma.notification.create({
        data: {
          userId: prediction.userId,
          type: 'POLL_RESOLVED',
          title: isWinner ? 'Prediction Won!' : 'Prediction Resolved',
          message: isWinner 
            ? `Congratulations! You won ${prediction.payout} points!`
            : 'Your prediction was incorrect, but thanks for participating!',
          data: { 
            pollId, 
            predictionId: prediction.id,
            payout: prediction.payout
          }
        }
      })
    }
  }

  private getTimeframeStart(timeframe: string): Date | null {
    const now = new Date()
    switch (timeframe) {
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      default:
        return null
    }
  }
}