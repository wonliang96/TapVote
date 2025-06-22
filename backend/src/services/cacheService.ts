import { PrismaClient } from '@prisma/client'
import { logger } from '../lib/logger'

const prisma = new PrismaClient()

interface CacheConfig {
  defaultTTL: number
  maxSize: number
  cleanupInterval: number
  compressionThreshold: number
}

interface CacheEntry {
  key: string
  value: any
  ttl: number
  createdAt: Date
  lastAccessed: Date
  hitCount: number
  size: number
  compressed: boolean
}

interface CacheStats {
  hitRate: number
  missRate: number
  totalHits: number
  totalMisses: number
  totalEntries: number
  totalSize: number
  oldestEntry: Date
  newestEntry: Date
  topKeys: Array<{ key: string; hits: number }>
}

export class CacheService {
  private inMemoryCache = new Map<string, CacheEntry>()
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0
  }
  
  private config: CacheConfig = {
    defaultTTL: 300, // 5 minutes
    maxSize: 100 * 1024 * 1024, // 100MB
    cleanupInterval: 60000, // 1 minute
    compressionThreshold: 1024 // 1KB
  }

  private cleanupTimer?: NodeJS.Timeout
  private currentSize = 0

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config }
    this.startCleanupTimer()
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try in-memory cache first
    const memoryResult = this.getFromMemory<T>(key)
    if (memoryResult !== null) {
      this.stats.hits++
      return memoryResult
    }

    // Try database cache
    try {
      const dbEntry = await prisma.cacheEntry.findUnique({
        where: { key }
      })

      if (dbEntry && new Date() < dbEntry.expiresAt) {
        this.stats.hits++
        
        // Promote to memory cache if frequently accessed
        const value = this.deserializeValue(dbEntry.value)
        this.setInMemory(key, value, dbEntry.ttl, false)
        
        return value
      } else if (dbEntry) {
        // Expired entry, delete it
        await this.delete(key)
      }
    } catch (error) {
      logger.error('Error reading from database cache:', error)
    }

    this.stats.misses++
    return null
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const actualTTL = ttl || this.config.defaultTTL
    const expiresAt = new Date(Date.now() + actualTTL * 1000)
    
    this.stats.sets++

    // Set in memory cache
    this.setInMemory(key, value, actualTTL)

    // Set in database cache for persistence
    try {
      const serializedValue = this.serializeValue(value)
      
      await prisma.cacheEntry.upsert({
        where: { key },
        update: {
          value: serializedValue,
          ttl: actualTTL,
          expiresAt
        },
        create: {
          key,
          value: serializedValue,
          ttl: actualTTL,
          expiresAt
        }
      })
    } catch (error) {
      logger.error('Error writing to database cache:', error)
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    this.stats.deletes++

    // Delete from memory
    const memoryEntry = this.inMemoryCache.get(key)
    if (memoryEntry) {
      this.currentSize -= memoryEntry.size
      this.inMemoryCache.delete(key)
    }

    // Delete from database
    try {
      await prisma.cacheEntry.delete({
        where: { key }
      })
    } catch (error) {
      // Entry might not exist, ignore error
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await fetchFn()
    await this.set(key, value, ttl)
    return value
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (this.inMemoryCache.has(key)) {
      return true
    }

    try {
      const entry = await prisma.cacheEntry.findUnique({
        where: { key },
        select: { expiresAt: true }
      })
      
      return entry ? new Date() < entry.expiresAt : false
    } catch (error) {
      return false
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    let cleared = 0

    // Clear from memory
    const memoryKeys = Array.from(this.inMemoryCache.keys())
    const regex = new RegExp(pattern)
    
    for (const key of memoryKeys) {
      if (regex.test(key)) {
        const entry = this.inMemoryCache.get(key)
        if (entry) {
          this.currentSize -= entry.size
        }
        this.inMemoryCache.delete(key)
        cleared++
      }
    }

    // Clear from database
    try {
      const dbEntries = await prisma.cacheEntry.findMany({
        where: {
          key: {
            contains: pattern.replace(/\*/g, '')
          }
        },
        select: { key: true }
      })

      for (const entry of dbEntries) {
        if (regex.test(entry.key)) {
          await prisma.cacheEntry.delete({
            where: { key: entry.key }
          })
          cleared++
        }
      }
    } catch (error) {
      logger.error('Error clearing cache pattern from database:', error)
    }

    return cleared
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses
    
    // Get top accessed keys
    const memoryEntries = Array.from(this.inMemoryCache.entries())
    const topKeys = memoryEntries
      .sort((a, b) => b[1].hitCount - a[1].hitCount)
      .slice(0, 10)
      .map(([key, entry]) => ({ key, hits: entry.hitCount }))

    // Get oldest and newest entries
    const dates = memoryEntries.map(([, entry]) => entry.createdAt)
    const oldestEntry = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date()
    const newestEntry = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date()

    return {
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalEntries: this.inMemoryCache.size,
      totalSize: this.currentSize,
      oldestEntry,
      newestEntry,
      topKeys
    }
  }

  /**
   * Flush all cache entries
   */
  async flush(): Promise<void> {
    // Clear memory cache
    this.inMemoryCache.clear()
    this.currentSize = 0

    // Clear database cache
    try {
      await prisma.cacheEntry.deleteMany({})
    } catch (error) {
      logger.error('Error flushing database cache:', error)
    }

    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    }
  }

  /**
   * Cache invalidation for specific entities
   */
  async invalidatePoll(pollId: string): Promise<void> {
    const patterns = [
      `poll:${pollId}`,
      `poll:${pollId}:*`,
      `polls:*`,
      `trending:*`,
      `category:*:polls`,
      `user:*:polls`,
      `analytics:poll:${pollId}*`
    ]

    for (const pattern of patterns) {
      await this.clearPattern(pattern)
    }
  }

  async invalidateUser(userId: string): Promise<void> {
    const patterns = [
      `user:${userId}`,
      `user:${userId}:*`,
      `users:*`,
      `leaderboard:*`,
      `analytics:user:${userId}*`
    ]

    for (const pattern of patterns) {
      await this.clearPattern(pattern)
    }
  }

  async invalidateCategory(categoryId: string): Promise<void> {
    const patterns = [
      `category:${categoryId}`,
      `category:${categoryId}:*`,
      `categories:*`,
      `trending:category:${categoryId}*`
    ]

    for (const pattern of patterns) {
      await this.clearPattern(pattern)
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(): Promise<void> {
    logger.info('Starting cache warm-up...')

    try {
      // Warm trending polls
      const trendingPolls = await prisma.poll.findMany({
        where: { isTrending: true },
        include: {
          pollTranslations: true,
          options: {
            include: {
              pollOptionTranslations: true
            }
          },
          category: {
            include: {
              categoryTranslations: true
            }
          }
        },
        take: 20
      })

      for (const poll of trendingPolls) {
        await this.set(`poll:${poll.id}`, poll, 600) // 10 minutes
      }

      // Warm categories
      const categories = await prisma.category.findMany({
        include: {
          categoryTranslations: true
        }
      })

      await this.set('categories:all', categories, 3600) // 1 hour

      // Warm top users
      const topUsers = await prisma.user.findMany({
        orderBy: { reputation: 'desc' },
        take: 50,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          reputation: true,
          totalPolls: true,
          totalVotes: true
        }
      })

      await this.set('users:top', topUsers, 1800) // 30 minutes

      logger.info('Cache warm-up completed')
    } catch (error) {
      logger.error('Error during cache warm-up:', error)
    }
  }

  /**
   * Private helper methods
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.inMemoryCache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.createdAt.getTime() + entry.ttl * 1000) {
      this.inMemoryCache.delete(key)
      this.currentSize -= entry.size
      return null
    }

    // Update access stats
    entry.lastAccessed = new Date()
    entry.hitCount++

    return entry.compressed ? this.decompress(entry.value) : entry.value
  }

  private setInMemory(key: string, value: any, ttl: number, shouldEvict = true): void {
    const serialized = JSON.stringify(value)
    const size = Buffer.byteLength(serialized, 'utf8')
    const shouldCompress = size > this.config.compressionThreshold

    // Check if we need to evict entries
    if (shouldEvict && this.currentSize + size > this.config.maxSize) {
      this.evictLeastRecentlyUsed(size)
    }

    const entry: CacheEntry = {
      key,
      value: shouldCompress ? this.compress(value) : value,
      ttl,
      createdAt: new Date(),
      lastAccessed: new Date(),
      hitCount: 0,
      size,
      compressed: shouldCompress
    }

    this.inMemoryCache.set(key, entry)
    this.currentSize += size
  }

  private evictLeastRecentlyUsed(requiredSpace: number): void {
    const entries = Array.from(this.inMemoryCache.entries())
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime())

    let freedSpace = 0
    for (const [key, entry] of entries) {
      this.inMemoryCache.delete(key)
      this.currentSize -= entry.size
      freedSpace += entry.size
      this.stats.evictions++

      if (freedSpace >= requiredSpace) {
        break
      }
    }
  }

  private serializeValue(value: any): any {
    return JSON.stringify(value)
  }

  private deserializeValue(value: any): any {
    return typeof value === 'string' ? JSON.parse(value) : value
  }

  private compress(value: any): any {
    // In a real implementation, use a compression library like zlib
    return JSON.stringify(value)
  }

  private decompress(value: any): any {
    // In a real implementation, use a compression library like zlib
    return JSON.parse(value)
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    // Clean expired entries from memory
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (now > entry.createdAt.getTime() + entry.ttl * 1000) {
        this.inMemoryCache.delete(key)
        this.currentSize -= entry.size
        cleanedCount++
      }
    }

    // Clean expired entries from database (async, don't wait)
    this.cleanupDatabase().catch(error => {
      logger.error('Error during database cache cleanup:', error)
    })

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired cache entries`)
    }
  }

  private async cleanupDatabase(): Promise<void> {
    try {
      const result = await prisma.cacheEntry.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })

      if (result.count > 0) {
        logger.debug(`Cleaned up ${result.count} expired database cache entries`)
      }
    } catch (error) {
      logger.error('Error cleaning up database cache:', error)
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }
}

// Specialized cache implementations
export class PollCache extends CacheService {
  async getPoll(pollId: string): Promise<any> {
    return this.getOrSet(
      `poll:${pollId}`,
      async () => {
        return prisma.poll.findUnique({
          where: { id: pollId },
          include: {
            pollTranslations: true,
            options: {
              include: {
                pollOptionTranslations: true
              }
            },
            category: {
              include: {
                categoryTranslations: true
              }
            },
            creator: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true
              }
            }
          }
        })
      },
      300 // 5 minutes
    )
  }

  async getTrendingPolls(limit = 20): Promise<any> {
    return this.getOrSet(
      `trending:polls:${limit}`,
      async () => {
        return prisma.poll.findMany({
          where: { isTrending: true },
          include: {
            pollTranslations: true,
            options: {
              include: {
                pollOptionTranslations: true
              }
            },
            category: true
          },
          orderBy: { trendingScore: 'desc' },
          take: limit
        })
      },
      180 // 3 minutes
    )
  }

  async getPollsByCategory(categoryId: string, limit = 20): Promise<any> {
    return this.getOrSet(
      `category:${categoryId}:polls:${limit}`,
      async () => {
        return prisma.poll.findMany({
          where: { categoryId },
          include: {
            pollTranslations: true,
            options: {
              include: {
                pollOptionTranslations: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit
        })
      },
      600 // 10 minutes
    )
  }
}

export class UserCache extends CacheService {
  async getUser(userId: string): Promise<any> {
    return this.getOrSet(
      `user:${userId}`,
      async () => {
        return prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            reputation: true,
            totalPolls: true,
            totalVotes: true,
            streakDays: true,
            isVerified: true,
            lastActiveAt: true,
            createdAt: true
          }
        })
      },
      600 // 10 minutes
    )
  }

  async getLeaderboard(timeframe: string, limit = 50): Promise<any> {
    return this.getOrSet(
      `leaderboard:${timeframe}:${limit}`,
      async () => {
        // Implementation would depend on timeframe
        return prisma.user.findMany({
          orderBy: { reputation: 'desc' },
          take: limit,
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            reputation: true,
            totalPolls: true,
            totalVotes: true
          }
        })
      },
      300 // 5 minutes
    )
  }
}

// Global cache instance
export const globalCache = new CacheService()
export const pollCache = new PollCache()
export const userCache = new UserCache()