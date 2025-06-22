import axios from 'axios'
import { PrismaClient } from '@prisma/client'
import { logger } from '../lib/logger'

const prisma = new PrismaClient()

interface NewsArticle {
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  category: string
  sentiment: 'positive' | 'negative' | 'neutral'
  keywords: string[]
}

interface GeneratedPoll {
  question: string
  description: string
  options: string[]
  category: string
  tags: string[]
  sourceUrl?: string
  expiresAt: Date
  metadata: {
    confidence: number
    complexity: 'simple' | 'complex'
    audience: string
    region?: string
  }
}

interface AIResponse {
  polls: GeneratedPoll[]
  reasoning: string
  trends_identified: string[]
}

export class AIPollGenerator {
  private openaiApiKey: string
  private newsApiKey: string
  private newsApiUrl = 'https://newsapi.org/v2'
  private maxPollsPerBatch = 5
  private cache = new Map<string, any>()
  private cacheExpiry = 15 * 60 * 1000 // 15 minutes

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || ''
    this.newsApiKey = process.env.NEWS_API_KEY || ''
    
    if (!this.openaiApiKey) {
      logger.warn('OpenAI API key not configured. AI poll generation will be limited.')
    }
    if (!this.newsApiKey) {
      logger.warn('News API key not configured. Using fallback news sources.')
    }
  }

  /**
   * Fetch trending news from multiple sources
   */
  async fetchTrendingNews(): Promise<NewsArticle[]> {
    const cacheKey = 'trending_news'
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }

    try {
      const sources = await Promise.allSettled([
        this.fetchNewsAPI(),
        this.fetchRSSFeeds(),
        this.fetchRedditTrending(),
        this.fetchTwitterTrends()
      ])

      const allArticles: NewsArticle[] = []
      sources.forEach((result) => {
        if (result.status === 'fulfilled') {
          allArticles.push(...result.value)
        }
      })

      // Deduplicate and rank by relevance
      const uniqueArticles = this.deduplicateNews(allArticles)
      const rankedArticles = await this.rankNewsByRelevance(uniqueArticles)
      
      // Cache results
      this.cache.set(cacheKey, {
        data: rankedArticles,
        timestamp: Date.now()
      })

      return rankedArticles
    } catch (error) {
      logger.error('Error fetching trending news:', error)
      return this.getFallbackNews()
    }
  }

  /**
   * Fetch news from News API
   */
  private async fetchNewsAPI(): Promise<NewsArticle[]> {
    if (!this.newsApiKey) return []

    const endpoints = [
      `/top-headlines?country=us&apiKey=${this.newsApiKey}`,
      `/everything?q=trending&sortBy=popularity&apiKey=${this.newsApiKey}`,
      `/top-headlines?category=technology&apiKey=${this.newsApiKey}`,
      `/top-headlines?category=business&apiKey=${this.newsApiKey}`,
    ]

    const results = await Promise.allSettled(
      endpoints.map(endpoint => 
        axios.get(`${this.newsApiUrl}${endpoint}`)
      )
    )

    const articles: NewsArticle[] = []
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const newsData = result.value.data.articles || []
        newsData.forEach((article: any) => {
          articles.push({
            title: article.title,
            description: article.description || '',
            url: article.url,
            source: article.source?.name || 'Unknown',
            publishedAt: article.publishedAt,
            category: this.categorizeNews(article.title + ' ' + article.description),
            sentiment: 'neutral', // Will be analyzed by AI
            keywords: this.extractKeywords(article.title + ' ' + article.description)
          })
        })
      }
    })

    return articles.slice(0, 50) // Limit results
  }

  /**
   * Fetch RSS feeds from major news sources
   */
  private async fetchRSSFeeds(): Promise<NewsArticle[]> {
    const rssFeeds = [
      'https://feeds.reuters.com/reuters/topNews',
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://rss.cnn.com/rss/edition.rss',
      'https://feeds.npr.org/1001/rss.xml'
    ]

    // For production, implement RSS parser
    // For now, return empty array
    return []
  }

  /**
   * Fetch trending topics from Reddit
   */
  private async fetchRedditTrending(): Promise<NewsArticle[]> {
    try {
      const response = await axios.get('https://www.reddit.com/r/all/hot.json?limit=25')
      const posts = response.data.data.children

      return posts.map((post: any) => ({
        title: post.data.title,
        description: post.data.selftext || '',
        url: `https://reddit.com${post.data.permalink}`,
        source: 'Reddit',
        publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
        category: this.categorizeNews(post.data.title),
        sentiment: 'neutral',
        keywords: this.extractKeywords(post.data.title)
      })).slice(0, 10)
    } catch (error) {
      logger.error('Error fetching Reddit trends:', error)
      return []
    }
  }

  /**
   * Fetch Twitter trends (placeholder - requires Twitter API v2)
   */
  private async fetchTwitterTrends(): Promise<NewsArticle[]> {
    // Twitter API integration would go here
    // Requires Twitter API v2 credentials and proper OAuth
    return []
  }

  /**
   * Generate polls using AI from trending topics
   */
  async generatePollsFromTrends(): Promise<GeneratedPoll[]> {
    try {
      const news = await this.fetchTrendingNews()
      if (news.length === 0) {
        logger.warn('No trending news found, using fallback poll generation')
        return this.generateFallbackPolls()
      }

      // Group news by category and importance
      const categorizedNews = this.categorizeNewsByImportance(news)
      
      // Generate polls for top topics
      const pollPromises = Object.entries(categorizedNews).map(([category, articles]) =>
        this.generatePollsForCategory(category, articles.slice(0, 3))
      )

      const results = await Promise.allSettled(pollPromises)
      const allPolls: GeneratedPoll[] = []

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allPolls.push(...result.value)
        }
      })

      // Rank and filter polls by quality
      const qualityPolls = this.filterPollsByQuality(allPolls)
      
      // Save to database
      await this.savePollsToDatabase(qualityPolls)

      return qualityPolls
    } catch (error) {
      logger.error('Error generating polls from trends:', error)
      return this.generateFallbackPolls()
    }
  }

  /**
   * Generate polls for a specific category using AI
   */
  private async generatePollsForCategory(category: string, articles: NewsArticle[]): Promise<GeneratedPoll[]> {
    if (!this.openaiApiKey) {
      return this.generateSimplePolls(articles)
    }

    const prompt = this.buildAIPrompt(category, articles)
    
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert poll creator for a prediction market platform like Polymarket. Create engaging, thought-provoking polls that will drive user engagement and meaningful discussions. Focus on topics that have clear, measurable outcomes.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      })

      const aiResponse: AIResponse = JSON.parse(response.data.choices[0].message.content)
      
      return aiResponse.polls.map(poll => ({
        ...poll,
        expiresAt: this.calculateExpiration(poll.metadata.complexity),
        metadata: {
          ...poll.metadata,
          aiGenerated: true,
          model: 'gpt-4-turbo-preview',
          generatedAt: new Date().toISOString()
        }
      }))
    } catch (error) {
      logger.error('Error calling OpenAI API:', error)
      return this.generateSimplePolls(articles)
    }
  }

  /**
   * Build AI prompt for poll generation
   */
  private buildAIPrompt(category: string, articles: NewsArticle[]): string {
    const articlesText = articles.map(a => 
      `Title: ${a.title}\nDescription: ${a.description}\nSource: ${a.source}\n`
    ).join('\n---\n')

    return `
Based on these trending ${category} news articles, create 2-3 high-quality prediction market polls that would be suitable for a platform like Polymarket.

NEWS ARTICLES:
${articlesText}

REQUIREMENTS:
1. Each poll should have a clear, binary or multiple-choice outcome
2. Questions should be specific, measurable, and have a definitive resolution date
3. Avoid subjective opinions - focus on factual, verifiable outcomes
4. Include relevant context in the description
5. Provide 2-4 meaningful options per poll
6. Consider global audience appeal
7. Ensure questions are engaging and will drive discussion

FORMAT your response as JSON:
{
  "polls": [
    {
      "question": "Clear, specific question",
      "description": "Context and details",
      "options": ["Option 1", "Option 2", "Option 3"],
      "category": "${category}",
      "tags": ["tag1", "tag2"],
      "sourceUrl": "relevant_article_url",
      "metadata": {
        "confidence": 0.8,
        "complexity": "simple",
        "audience": "general",
        "region": "global"
      }
    }
  ],
  "reasoning": "Why these polls were chosen",
  "trends_identified": ["trend1", "trend2"]
}
`
  }

  /**
   * Calculate poll expiration based on complexity
   */
  private calculateExpiration(complexity: string): Date {
    const now = new Date()
    switch (complexity) {
      case 'simple':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      case 'complex':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      default:
        return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days
    }
  }

  /**
   * Generate simple polls without AI
   */
  private generateSimplePolls(articles: NewsArticle[]): GeneratedPoll[] {
    return articles.slice(0, 2).map((article, index) => ({
      question: `What will be the outcome of: ${article.title.substring(0, 80)}?`,
      description: article.description || 'Based on recent news developments',
      options: ['Very Likely', 'Somewhat Likely', 'Unlikely', 'Very Unlikely'],
      category: article.category,
      tags: article.keywords.slice(0, 3),
      sourceUrl: article.url,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      metadata: {
        confidence: 0.6,
        complexity: 'simple' as const,
        audience: 'general',
        aiGenerated: false
      }
    }))
  }

  /**
   * Filter polls by quality metrics
   */
  private filterPollsByQuality(polls: GeneratedPoll[]): GeneratedPoll[] {
    return polls
      .filter(poll => 
        poll.question.length > 10 && 
        poll.options.length >= 2 && 
        poll.metadata.confidence > 0.5
      )
      .sort((a, b) => b.metadata.confidence - a.metadata.confidence)
      .slice(0, this.maxPollsPerBatch)
  }

  /**
   * Save generated polls to database
   */
  private async savePollsToDatabase(polls: GeneratedPoll[]): Promise<void> {
    for (const poll of polls) {
      try {
        // Check if similar poll already exists
        const existingPoll = await prisma.poll.findFirst({
          where: {
            question: {
              contains: poll.question.substring(0, 50)
            },
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })

        if (existingPoll) {
          logger.info(`Skipping duplicate poll: ${poll.question}`)
          continue
        }

        // Create poll
        const createdPoll = await prisma.poll.create({
          data: {
            question: poll.question,
            description: poll.description,
            categoryId: await this.getCategoryId(poll.category),
            expiresAt: poll.expiresAt,
            isFromNews: true,
            newsSourceUrl: poll.sourceUrl,
            aiGenerated: poll.metadata.aiGenerated || false,
            metadata: poll.metadata,
            options: {
              create: poll.options.map((option, index) => ({
                text: option,
                position: index
              }))
            }
          }
        })

        logger.info(`Created AI-generated poll: ${createdPoll.id}`)
      } catch (error) {
        logger.error(`Error saving poll to database:`, error)
      }
    }
  }

  /**
   * Helper methods
   */
  private categorizeNews(text: string): string {
    const categories = {
      'technology': ['ai', 'tech', 'software', 'app', 'digital', 'crypto', 'blockchain'],
      'politics': ['election', 'government', 'political', 'policy', 'senate', 'congress'],
      'business': ['market', 'stock', 'economy', 'company', 'financial', 'business'],
      'environment': ['climate', 'environment', 'green', 'sustainable', 'carbon'],
      'sports': ['sport', 'game', 'team', 'championship', 'olympic'],
      'entertainment': ['movie', 'music', 'celebrity', 'film', 'entertainment']
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
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    return [...new Set(words)].slice(0, 5)
  }

  private deduplicateNews(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>()
    return articles.filter(article => {
      const key = article.title.toLowerCase().substring(0, 50)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private async rankNewsByRelevance(articles: NewsArticle[]): Promise<NewsArticle[]> {
    // Simple ranking algorithm - can be enhanced with ML
    return articles.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a)
      const bScore = this.calculateRelevanceScore(b)
      return bScore - aScore
    })
  }

  private calculateRelevanceScore(article: NewsArticle): number {
    let score = 0
    
    // Recency bonus
    const hoursSincePublished = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60)
    score += Math.max(0, 24 - hoursSincePublished) * 2
    
    // Source credibility
    const trustedSources = ['Reuters', 'BBC', 'CNN', 'NPR', 'Associated Press']
    if (trustedSources.includes(article.source)) score += 10
    
    // Content quality
    if (article.description && article.description.length > 100) score += 5
    score += article.keywords.length * 2
    
    return score
  }

  private categorizeNewsByImportance(news: NewsArticle[]): Record<string, NewsArticle[]> {
    const categorized: Record<string, NewsArticle[]> = {}
    
    news.forEach(article => {
      if (!categorized[article.category]) {
        categorized[article.category] = []
      }
      categorized[article.category].push(article)
    })
    
    return categorized
  }

  private async getCategoryId(categoryName: string): Promise<string> {
    const category = await prisma.category.findFirst({
      where: { name: categoryName }
    })
    
    if (category) return category.id
    
    // Create category if doesn't exist
    const newCategory = await prisma.category.create({
      data: { name: categoryName, slug: categoryName.toLowerCase() }
    })
    
    return newCategory.id
  }

  private getFallbackNews(): NewsArticle[] {
    return [
      {
        title: "Global Technology Trends Shaping 2024",
        description: "Analysis of emerging technologies and their impact",
        url: "https://example.com/tech-trends",
        source: "TechNews",
        publishedAt: new Date().toISOString(),
        category: "technology",
        sentiment: "neutral",
        keywords: ["technology", "trends", "2024", "innovation"]
      }
    ]
  }

  private generateFallbackPolls(): GeneratedPoll[] {
    return [
      {
        question: "Which technology will have the biggest impact in 2024?",
        description: "Based on current market trends and expert predictions",
        options: ["Artificial Intelligence", "Quantum Computing", "Renewable Energy", "Biotechnology"],
        category: "technology",
        tags: ["technology", "2024", "innovation"],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        metadata: {
          confidence: 0.7,
          complexity: "simple" as const,
          audience: "general"
        }
      }
    ]
  }
}