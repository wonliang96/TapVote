import axios from 'axios'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'
import Parser from 'rss-parser'
const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: ['category', 'keywords', 'media:content']
  }
})

interface NewsSource {
  id: string
  name: string
  type: 'api' | 'rss' | 'scraper'
  url: string
  apiKey?: string
  category: string
  language: string
  isActive: boolean
  rateLimit: number
  lastFetched?: Date
}

interface NewsArticle {
  id: string
  title: string
  description: string
  content: string
  url: string
  imageUrl?: string
  publishedAt: Date
  source: string
  category: string
  language: string
  keywords: string[]
  sentiment: number
  importance: number
  region?: string
  author?: string
}

interface TrendingKeyword {
  keyword: string
  mentions: number
  sentiment: number
  momentum: number
  category: string
  articles: NewsArticle[]
}

export class NewsService {
  private sources: NewsSource[] = [
    {
      id: 'newsapi',
      name: 'NewsAPI',
      type: 'api',
      url: 'https://newsapi.org/v2',
      apiKey: process.env.NEWS_API_KEY,
      category: 'general',
      language: 'en',
      isActive: true,
      rateLimit: 1000
    },
    {
      id: 'reuters',
      name: 'Reuters',
      type: 'rss',
      url: 'https://feeds.reuters.com/reuters/topNews',
      category: 'general',
      language: 'en',
      isActive: true,
      rateLimit: 60
    },
    {
      id: 'bbc',
      name: 'BBC',
      type: 'rss',
      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      category: 'world',
      language: 'en',
      isActive: true,
      rateLimit: 60
    },
    {
      id: 'techcrunch',
      name: 'TechCrunch',
      type: 'rss',
      url: 'https://feeds.feedburner.com/TechCrunch',
      category: 'technology',
      language: 'en',
      isActive: true,
      rateLimit: 60
    },
    {
      id: 'reddit',
      name: 'Reddit',
      type: 'api',
      url: 'https://www.reddit.com/r/all/hot.json',
      category: 'social',
      language: 'en',
      isActive: true,
      rateLimit: 60
    }
  ]

  private cache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_TTL = 15 * 60 * 1000 // 15 minutes

  /**
   * Fetch latest news from all active sources
   */
  async fetchLatestNews(): Promise<NewsArticle[]> {
    const allArticles: NewsArticle[] = []
    
    for (const source of this.sources.filter(s => s.isActive)) {
      try {
        const articles = await this.fetchFromSource(source)
        allArticles.push(...articles)
        
        // Update last fetched timestamp
        source.lastFetched = new Date()
        
        logger.info(`Fetched ${articles.length} articles from ${source.name}`)
      } catch (error) {
        logger.error(`Error fetching from ${source.name}:`, error)
      }
    }

    // Deduplicate and rank articles
    const uniqueArticles = this.deduplicateArticles(allArticles)
    const rankedArticles = this.rankArticles(uniqueArticles)
    
    // Store in database
    await this.storeArticles(rankedArticles.slice(0, 100)) // Store top 100
    
    return rankedArticles
  }

  /**
   * Get trending keywords and topics
   */
  async getTrendingKeywords(limit = 20): Promise<TrendingKeyword[]> {
    // Return demo data if no API key is configured
    if (!process.env.NEWS_API_KEY) {
      return this.getDemoTrendingKeywords(limit)
    }

    const cacheKey = 'trending_keywords'
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    // Fetch recent articles
    const articles = await this.getRecentArticles(24) // Last 24 hours
    
    // Extract and analyze keywords
    const keywordMap = new Map<string, {
      mentions: number
      articles: NewsArticle[]
      sentiment: number[]
      categories: Set<string>
    }>()

    articles.forEach(article => {
      article.keywords.forEach(keyword => {
        if (keyword.length < 3) return // Skip short keywords
        
        const existing = keywordMap.get(keyword) || {
          mentions: 0,
          articles: [],
          sentiment: [],
          categories: new Set()
        }
        
        existing.mentions++
        existing.articles.push(article)
        existing.sentiment.push(article.sentiment)
        existing.categories.add(article.category)
        
        keywordMap.set(keyword, existing)
      })
    })

    // Calculate trending keywords
    const trendingKeywords: TrendingKeyword[] = []
    
    for (const [keyword, data] of keywordMap.entries()) {
      if (data.mentions < 3) continue // Minimum threshold
      
      const avgSentiment = data.sentiment.reduce((sum, s) => sum + s, 0) / data.sentiment.length
      const momentum = this.calculateMomentum(data.articles)
      const category = this.getMostCommonCategory(data.categories)
      
      trendingKeywords.push({
        keyword,
        mentions: data.mentions,
        sentiment: avgSentiment,
        momentum,
        category,
        articles: data.articles.slice(0, 5) // Top 5 articles
      })
    }

    // Sort by momentum and mentions
    trendingKeywords.sort((a, b) => {
      const scoreA = a.momentum * 0.6 + (a.mentions / 100) * 0.4
      const scoreB = b.momentum * 0.6 + (b.mentions / 100) * 0.4
      return scoreB - scoreA
    })

    const result = trendingKeywords.slice(0, limit)
    
    // Cache result
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })

    // Store trending topics in database
    await this.storeTrendingTopics(result)

    return result
  }

  /**
   * Get news articles by category
   */
  async getNewsByCategory(category: string, limit = 20): Promise<NewsArticle[]> {
    const articles = await this.getRecentArticles(48, category) // Last 48 hours
    return articles.slice(0, limit)
  }

  /**
   * Search news articles
   */
  async searchNews(query: string, filters?: {
    category?: string
    language?: string
    dateFrom?: Date
    dateTo?: Date
    sources?: string[]
  }): Promise<NewsArticle[]> {
    const searchTerms = query.toLowerCase().split(' ')
    
    let articles = await this.getRecentArticles(168) // Last week
    
    // Apply text search
    articles = articles.filter(article => {
      const searchText = `${article.title} ${article.description} ${article.content}`.toLowerCase()
      return searchTerms.some(term => searchText.includes(term))
    })

    // Apply filters
    if (filters?.category) {
      articles = articles.filter(a => a.category === filters.category)
    }
    
    if (filters?.language) {
      articles = articles.filter(a => a.language === filters.language)
    }
    
    if (filters?.dateFrom) {
      articles = articles.filter(a => a.publishedAt >= filters.dateFrom!)
    }
    
    if (filters?.dateTo) {
      articles = articles.filter(a => a.publishedAt <= filters.dateTo!)
    }
    
    if (filters?.sources) {
      articles = articles.filter(a => filters.sources!.includes(a.source))
    }

    // Rank by relevance
    return this.rankSearchResults(articles, searchTerms)
  }

  /**
   * Analyze news sentiment for poll generation
   */
  async analyzeNewsSentiment(articles: NewsArticle[]): Promise<{
    overall: number
    byCategory: Record<string, number>
    controversial: NewsArticle[]
    trending: NewsArticle[]
  }> {
    const sentiments = articles.map(a => a.sentiment)
    const overall = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length

    // Group by category
    const byCategory: Record<string, number[]> = {}
    articles.forEach(article => {
      if (!byCategory[article.category]) {
        byCategory[article.category] = []
      }
      byCategory[article.category].push(article.sentiment)
    })

    const categoryAverages: Record<string, number> = {}
    Object.entries(byCategory).forEach(([category, sentiments]) => {
      categoryAverages[category] = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length
    })

    // Find controversial topics (mixed sentiment)
    const controversial = articles.filter(article => {
      return Math.abs(article.sentiment) < 0.3 && article.importance > 0.6
    }).sort((a, b) => b.importance - a.importance)

    // Find trending topics (high importance + recent)
    const trending = articles.filter(article => {
      const hoursOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60)
      return article.importance > 0.7 && hoursOld < 12
    }).sort((a, b) => b.importance - a.importance)

    return {
      overall,
      byCategory: categoryAverages,
      controversial: controversial.slice(0, 10),
      trending: trending.slice(0, 10)
    }
  }

  /**
   * Get news-based poll suggestions
   */
  async getPollSuggestions(): Promise<Array<{
    title: string
    description: string
    options: string[]
    category: string
    sourceArticles: NewsArticle[]
    confidence: number
  }>> {
    const trendingKeywords = await this.getTrendingKeywords(10)
    const suggestions = []

    for (const trending of trendingKeywords) {
      if (trending.articles.length < 2) continue

      // Generate poll based on trending topic
      const suggestion = await this.generatePollFromTrend(trending)
      if (suggestion) {
        suggestions.push(suggestion)
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Private helper methods
   */
  private async fetchFromSource(source: NewsSource): Promise<NewsArticle[]> {
    switch (source.type) {
      case 'api':
        return this.fetchFromAPI(source)
      case 'rss':
        return this.fetchFromRSS(source)
      case 'scraper':
        return this.fetchFromScraper(source)
      default:
        return []
    }
  }

  private async fetchFromAPI(source: NewsSource): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = []
    
    if (source.id === 'newsapi' && source.apiKey) {
      const endpoints = [
        `/top-headlines?country=us&apiKey=${source.apiKey}`,
        `/everything?q=trending&sortBy=popularity&from=${new Date(Date.now() - 24*60*60*1000).toISOString()}&apiKey=${source.apiKey}`
      ]

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${source.url}${endpoint}`)
          const newsArticles = response.data.articles || []
          
          newsArticles.forEach((article: any) => {
            articles.push(this.parseNewsAPIArticle(article, source))
          })
        } catch (error) {
          logger.error(`Error fetching from NewsAPI endpoint ${endpoint}:`, error)
        }
      }
    } else if (source.id === 'reddit') {
      try {
        const response = await axios.get(`${source.url}?limit=25`)
        const posts = response.data.data?.children || []
        
        posts.forEach((post: any) => {
          articles.push(this.parseRedditPost(post.data, source))
        })
      } catch (error) {
        logger.error('Error fetching from Reddit:', error)
      }
    }

    return articles
  }

  private async fetchFromRSS(source: NewsSource): Promise<NewsArticle[]> {
    try {
      const feed = await parser.parseURL(source.url)
      return feed.items.map(item => this.parseRSSItem(item, source))
    } catch (error) {
      logger.error(`Error fetching RSS from ${source.name}:`, error)
      return []
    }
  }

  private async fetchFromScraper(source: NewsSource): Promise<NewsArticle[]> {
    // Implement custom scrapers for specific sites
    // This would require careful implementation to respect robots.txt and rate limits
    return []
  }

  private parseNewsAPIArticle(article: any, source: NewsSource): NewsArticle {
    return {
      id: this.generateArticleId(article.url),
      title: article.title || '',
      description: article.description || '',
      content: article.content || article.description || '',
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: new Date(article.publishedAt),
      source: article.source?.name || source.name,
      category: this.categorizeContent(article.title + ' ' + article.description),
      language: source.language,
      keywords: this.extractKeywords(article.title + ' ' + article.description),
      sentiment: this.analyzeSentiment(article.title + ' ' + article.description),
      importance: this.calculateImportance(article),
      author: article.author
    }
  }

  private parseRSSItem(item: any, source: NewsSource): NewsArticle {
    return {
      id: this.generateArticleId(item.link || item.guid),
      title: item.title || '',
      description: item.contentSnippet || item.summary || '',
      content: item.content || item.contentSnippet || '',
      url: item.link || '',
      imageUrl: item.enclosure?.url,
      publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
      source: source.name,
      category: item.category || source.category,
      language: source.language,
      keywords: this.extractKeywords(item.title + ' ' + item.contentSnippet),
      sentiment: this.analyzeSentiment(item.title + ' ' + item.contentSnippet),
      importance: this.calculateImportance(item),
      author: item.creator || item.author
    }
  }

  private parseRedditPost(post: any, source: NewsSource): NewsArticle {
    return {
      id: this.generateArticleId(post.permalink),
      title: post.title || '',
      description: post.selftext?.substring(0, 200) || '',
      content: post.selftext || '',
      url: `https://reddit.com${post.permalink}`,
      imageUrl: post.thumbnail !== 'self' ? post.thumbnail : undefined,
      publishedAt: new Date(post.created_utc * 1000),
      source: 'Reddit',
      category: this.categorizeContent(post.title),
      language: 'en',
      keywords: this.extractKeywords(post.title + ' ' + post.selftext),
      sentiment: this.analyzeSentiment(post.title + ' ' + post.selftext),
      importance: this.calculateRedditImportance(post),
      region: 'global'
    }
  }

  private generateArticleId(url: string): string {
    return Buffer.from(url).toString('base64').substring(0, 16)
  }

  private categorizeContent(text: string): string {
    const categories: Record<string, string[]> = {
      'technology': ['tech', 'ai', 'software', 'digital', 'crypto', 'blockchain', 'app'],
      'politics': ['election', 'government', 'political', 'policy', 'congress', 'senate'],
      'business': ['market', 'stock', 'economy', 'company', 'financial', 'business'],
      'environment': ['climate', 'environment', 'green', 'sustainable', 'carbon'],
      'sports': ['sport', 'game', 'team', 'championship', 'olympic', 'football'],
      'entertainment': ['movie', 'music', 'celebrity', 'film', 'entertainment', 'netflix'],
      'health': ['health', 'medical', 'doctor', 'medicine', 'hospital', 'vaccine'],
      'science': ['science', 'research', 'study', 'scientist', 'discovery']
    }

    const lowerText = text.toLowerCase()
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return category
      }
    }
    return 'general'
  }

  private extractKeywords(text: string): string[] {
    if (!text) return []
    
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'as', 'are', 'was', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'is', 'it', 'this', 'that', 'these', 'those'])
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
    
    // Return unique words, sorted by frequency
    const wordCount = new Map<string, number>()
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1)
    })
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
  }

  private analyzeSentiment(text: string): number {
    if (!text) return 0
    
    // Simple sentiment analysis based on keywords
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'success', 'win', 'positive', 'growth', 'increase', 'rise', 'up', 'improve', 'better', 'best', 'love', 'like', 'happy', 'excited']
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike', 'angry', 'sad', 'problem', 'issue', 'crisis', 'fail', 'failure', 'decline', 'decrease', 'fall', 'down', 'worse', 'concern', 'worry']
    
    const words = text.toLowerCase().split(/\s+/)
    let sentiment = 0
    
    words.forEach(word => {
      if (positiveWords.includes(word)) sentiment += 1
      if (negativeWords.includes(word)) sentiment -= 1
    })
    
    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, sentiment / Math.max(words.length / 10, 1)))
  }

  private calculateImportance(article: any): number {
    let score = 0.5 // Base score
    
    // Title length (longer titles often indicate more detailed stories)
    if (article.title && article.title.length > 50) score += 0.1
    
    // Description presence and length
    if (article.description && article.description.length > 100) score += 0.2
    
    // Image presence
    if (article.urlToImage || article.imageUrl) score += 0.1
    
    // Source credibility (simplified)
    const trustedSources = ['Reuters', 'BBC', 'Associated Press', 'CNN', 'NPR']
    if (trustedSources.includes(article.source?.name || article.source)) score += 0.2
    
    return Math.min(1, score)
  }

  private calculateRedditImportance(post: any): number {
    let score = 0.3 // Base score for Reddit
    
    // Upvote ratio
    score += (post.upvote_ratio || 0.5) * 0.3
    
    // Number of comments (engagement)
    score += Math.min(post.num_comments / 1000, 0.2)
    
    // Score (upvotes - downvotes)
    score += Math.min(post.score / 10000, 0.2)
    
    return Math.min(1, score)
  }

  private deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>()
    return articles.filter(article => {
      const key = article.title.toLowerCase().substring(0, 50)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private rankArticles(articles: NewsArticle[]): NewsArticle[] {
    return articles.sort((a, b) => {
      // Combine recency, importance, and engagement
      const aScore = this.calculateArticleScore(a)
      const bScore = this.calculateArticleScore(b)
      return bScore - aScore
    })
  }

  private calculateArticleScore(article: NewsArticle): number {
    const hoursOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60)
    const recencyScore = Math.max(0, 1 - (hoursOld / 48)) // Decay over 48 hours
    
    return (recencyScore * 0.4) + (article.importance * 0.6)
  }

  private calculateMomentum(articles: NewsArticle[]): number {
    if (articles.length < 2) return 0
    
    // Sort by publication time
    articles.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
    
    const timeSpan = articles[articles.length - 1].publishedAt.getTime() - articles[0].publishedAt.getTime()
    const frequency = articles.length / (timeSpan / (1000 * 60 * 60)) // Articles per hour
    
    return Math.min(1, frequency / 10) // Normalize
  }

  private getMostCommonCategory(categories: Set<string>): string {
    if (categories.size === 0) return 'general'
    return Array.from(categories)[0] // Simplified - could implement proper frequency count
  }

  private rankSearchResults(articles: NewsArticle[], searchTerms: string[]): NewsArticle[] {
    return articles.map(article => {
      const searchText = `${article.title} ${article.description}`.toLowerCase()
      let relevanceScore = 0
      
      searchTerms.forEach(term => {
        const titleMatches = (article.title.toLowerCase().match(new RegExp(term, 'g')) || []).length
        const descMatches = (article.description.toLowerCase().match(new RegExp(term, 'g')) || []).length
        
        relevanceScore += titleMatches * 2 + descMatches // Title matches weighted higher
      })
      
      return { ...article, relevanceScore }
    }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
  }

  private async storeArticles(articles: NewsArticle[]): Promise<void> {
    for (const article of articles) {
      try {
        // Check if article already exists
        const existing = await prisma.searchIndex.findUnique({
          where: {
            entityType_entityId: {
              entityType: 'NEWS',
              entityId: article.id
            }
          }
        })

        if (!existing) {
          await prisma.searchIndex.create({
            data: {
              entityType: 'NEWS',
              entityId: article.id,
              content: `${article.title} ${article.description}`,
              keywords: article.keywords,
              language: article.language,
              boost: article.importance
            }
          })
        }
      } catch (error) {
        logger.error('Error storing article:', error)
      }
    }
  }

  private async storeTrendingTopics(topics: TrendingKeyword[]): Promise<void> {
    for (const topic of topics) {
      try {
        await prisma.trendingTopic.upsert({
          where: { keyword: topic.keyword },
          update: {
            mentions: topic.mentions,
            sentiment: topic.sentiment,
            momentum: topic.momentum,
            lastUpdated: new Date()
          },
          create: {
            keyword: topic.keyword,
            category: topic.category,
            mentions: topic.mentions,
            sentiment: topic.sentiment,
            momentum: topic.momentum,
            source: 'NEWS',
            language: 'en'
          }
        })
      } catch (error) {
        logger.error('Error storing trending topic:', error)
      }
    }
  }

  private async getRecentArticles(hours: number, category?: string): Promise<NewsArticle[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    const searchResults = await prisma.searchIndex.findMany({
      where: {
        entityType: 'NEWS',
        updatedAt: { gte: since }
      }
    })

    // This is a simplified version - in practice you'd store full articles
    return []
  }

  private async generatePollFromTrend(trending: TrendingKeyword): Promise<any> {
    // This would use AI to generate a poll based on the trending topic
    // For now, return a simple structure
    const confidence = Math.min(0.9, trending.momentum + (trending.mentions / 100) * 0.1)
    
    if (confidence < 0.5) return null

    return {
      title: `What's your opinion on the trending topic: ${trending.keyword}?`,
      description: `Based on recent news coverage with ${trending.mentions} mentions`,
      options: ['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'],
      category: trending.category,
      sourceArticles: trending.articles,
      confidence
    }
  }

  /**
   * Generate demo trending keywords when API is not available
   */
  private getDemoTrendingKeywords(limit: number): TrendingKeyword[] {
    const demoKeywords: TrendingKeyword[] = [
      {
        keyword: 'artificial intelligence',
        mentions: 47,
        sentiment: 0.7,
        momentum: 0.8,
        category: 'technology',
        articles: []
      },
      {
        keyword: 'climate change',
        mentions: 35,
        sentiment: -0.2,
        momentum: 0.6,
        category: 'environment',
        articles: []
      },
      {
        keyword: 'cryptocurrency',
        mentions: 28,
        sentiment: 0.3,
        momentum: 0.5,
        category: 'finance',
        articles: []
      },
      {
        keyword: 'space exploration',
        mentions: 22,
        sentiment: 0.8,
        momentum: 0.7,
        category: 'science',
        articles: []
      },
      {
        keyword: 'renewable energy',
        mentions: 19,
        sentiment: 0.6,
        momentum: 0.4,
        category: 'environment',
        articles: []
      },
      {
        keyword: 'mental health',
        mentions: 31,
        sentiment: 0.1,
        momentum: 0.5,
        category: 'health',
        articles: []
      },
      {
        keyword: 'remote work',
        mentions: 25,
        sentiment: 0.4,
        momentum: 0.3,
        category: 'business',
        articles: []
      },
      {
        keyword: 'electric vehicles',
        mentions: 18,
        sentiment: 0.7,
        momentum: 0.6,
        category: 'technology',
        articles: []
      }
    ]

    return demoKeywords.slice(0, limit)
  }
}