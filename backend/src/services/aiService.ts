import OpenAI from 'openai'
import { NewsService } from './newsService'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'

interface AIGenerationOptions {
  category?: string
  language?: string
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD'
  customPrompt?: string
  count?: number
}

interface GeneratedPoll {
  title: string
  description: string
  options: string[]
  categoryId: string
  confidence: number
  sourceArticles: any[]
  keywords: string[]
}

export class AIService {
  private openai: OpenAI
  private newsService: NewsService

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    }

    this.newsService = new NewsService()
  }

  /**
   * Generate polls from trending topics using AI
   */
  async generatePollsFromTrends(options: AIGenerationOptions): Promise<GeneratedPoll[]> {
    try {
      // Return demo poll if no OpenAI API key is configured
      if (!this.openai) {
        return this.generateDemoPolls(options)
      }

      const {
        category,
        language = 'en',
        difficulty = 'MEDIUM',
        customPrompt,
        count = 1
      } = options

      // Get trending keywords and news
      const trendingKeywords = await this.newsService.getTrendingKeywords(10)
      let relevantKeywords = trendingKeywords

      // Filter by category if specified
      if (category) {
        relevantKeywords = trendingKeywords.filter(k => k.category === category)
      }

      if (relevantKeywords.length === 0) {
        // Fallback to general trending if no category-specific trends
        relevantKeywords = trendingKeywords.slice(0, 5)
      }

      // Get category ID
      const categoryRecord = await this.getCategoryForTopic(category, relevantKeywords[0]?.category)

      const generatedPolls: GeneratedPoll[] = []

      for (let i = 0; i < count; i++) {
        const keyword = relevantKeywords[i % relevantKeywords.length]
        
        try {
          const poll = await this.generateSinglePoll(
            keyword,
            categoryRecord.id,
            language,
            difficulty,
            customPrompt
          )

          if (poll) {
            generatedPolls.push(poll)
          }
        } catch (error) {
          logger.error(`Error generating poll ${i + 1}:`, error)
          continue
        }
      }

      return generatedPolls

    } catch (error) {
      logger.error('Error generating polls from trends:', error)
      throw new Error('Failed to generate polls from trending topics')
    }
  }

  /**
   * Generate a single poll from a trending keyword
   */
  private async generateSinglePoll(
    keyword: any,
    categoryId: string,
    language: string,
    difficulty: string,
    customPrompt?: string
  ): Promise<GeneratedPoll | null> {
    try {
      // Build context from the keyword's articles
      const articles = keyword.articles.slice(0, 3)
      const articleSummaries = articles.map((article: any) => 
        `"${article.title}" - ${article.description}`
      ).join('\n')

      // Create AI prompt
      const systemPrompt = this.buildSystemPrompt(language, difficulty)
      const userPrompt = customPrompt || this.buildUserPrompt(
        keyword.keyword,
        articleSummaries,
        keyword.sentiment,
        difficulty
      )

      // Generate poll using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from OpenAI')
      }

      // Parse the AI response
      const pollData = this.parseAIResponse(response)
      if (!pollData) {
        throw new Error('Failed to parse AI response')
      }

      return {
        title: pollData.title,
        description: pollData.description,
        options: pollData.options,
        categoryId,
        confidence: this.calculateConfidence(keyword, pollData),
        sourceArticles: articles,
        keywords: [keyword.keyword, ...this.extractKeywords(pollData.title + ' ' + pollData.description)]
      }

    } catch (error) {
      logger.error('Error generating single poll:', error)
      return null
    }
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(language: string, difficulty: string): string {
    const languageInstructions = {
      'en': 'Respond in English',
      'zh': 'Respond in Chinese (Simplified)',
      'ms': 'Respond in Malay'
    }

    const difficultyInstructions = {
      'EASY': 'Create simple, straightforward polls that are easy to understand for general audiences.',
      'MEDIUM': 'Create moderately complex polls that require some thought and consideration.',
      'HARD': 'Create sophisticated polls that involve nuanced thinking and multiple perspectives.'
    }

    return `You are an expert poll creator for a multilingual polling platform similar to Polymarket. Your task is to create engaging, relevant, and unbiased polls based on trending news topics.

${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en}.

${difficultyInstructions[difficulty as keyof typeof difficultyInstructions]}.

Guidelines:
- Create polls that encourage prediction and debate
- Ensure questions are clear and unambiguous
- Provide 2-4 balanced options that cover the main perspectives
- Avoid leading or biased language
- Focus on verifiable outcomes when possible
- Consider multiple viewpoints and cultural sensitivities

Format your response as valid JSON with this structure:
{
  "title": "Poll question/title",
  "description": "Brief description providing context",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}

Ensure the JSON is properly formatted and includes 2-4 options.`
  }

  /**
   * Build user prompt for specific topic
   */
  private buildUserPrompt(
    keyword: string,
    articleSummaries: string,
    sentiment: number,
    difficulty: string
  ): string {
    const sentimentContext = sentiment > 0.2 ? 'positive' : sentiment < -0.2 ? 'negative' : 'neutral'
    
    return `Create a poll about the trending topic: "${keyword}"

Recent news context:
${articleSummaries}

The overall sentiment around this topic is ${sentimentContext}.

Create a poll that:
1. Relates directly to this trending topic
2. Asks about a specific, measurable outcome or opinion
3. Provides balanced options for different perspectives
4. Is appropriate for a global, multilingual audience
5. Encourages thoughtful engagement and predictions

Topic: ${keyword}
Difficulty: ${difficulty}`
  }

  /**
   * Parse AI response into structured poll data
   */
  private parseAIResponse(response: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const pollData = JSON.parse(jsonMatch[0])

      // Validate required fields
      if (!pollData.title || !pollData.options || !Array.isArray(pollData.options)) {
        throw new Error('Invalid poll structure')
      }

      if (pollData.options.length < 2 || pollData.options.length > 6) {
        throw new Error('Invalid number of options')
      }

      return {
        title: pollData.title.trim(),
        description: (pollData.description || '').trim(),
        options: pollData.options.map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0)
      }

    } catch (error) {
      logger.error('Error parsing AI response:', error)
      return null
    }
  }

  /**
   * Calculate confidence score for generated poll
   */
  private calculateConfidence(keyword: any, pollData: any): number {
    let confidence = 0.5 // Base confidence

    // Factor in keyword momentum and mentions
    confidence += Math.min(keyword.momentum * 0.3, 0.2)
    confidence += Math.min(keyword.mentions / 100 * 0.1, 0.1)

    // Factor in poll quality indicators
    const titleLength = pollData.title.length
    if (titleLength >= 20 && titleLength <= 100) confidence += 0.1

    const hasDescription = pollData.description && pollData.description.length > 10
    if (hasDescription) confidence += 0.05

    const optionCount = pollData.options.length
    if (optionCount >= 3 && optionCount <= 4) confidence += 0.05

    // Factor in topic relevance (simplified)
    const topicWords = keyword.keyword.toLowerCase().split(' ')
    const titleWords = pollData.title.toLowerCase()
    const relevanceScore = topicWords.filter((word: string) => titleWords.includes(word)).length / topicWords.length
    confidence += relevanceScore * 0.1

    return Math.min(Math.max(confidence, 0.1), 0.95)
  }

  /**
   * Get appropriate category for topic
   */
  private async getCategoryForTopic(requestedCategory?: string, inferredCategory?: string): Promise<any> {
    try {
      // Try requested category first
      if (requestedCategory) {
        const category = await prisma.category.findFirst({
          where: { 
            slug: requestedCategory,
            isActive: true
          }
        })
        if (category) return category
      }

      // Try inferred category
      if (inferredCategory) {
        const category = await prisma.category.findFirst({
          where: { 
            slug: inferredCategory,
            isActive: true
          }
        })
        if (category) return category
      }

      // Fallback to default category
      let defaultCategory = await prisma.category.findFirst({
        where: { 
          slug: 'general',
          isActive: true
        }
      })

      if (!defaultCategory) {
        // Create default category if it doesn't exist
        defaultCategory = await prisma.category.create({
          data: {
            slug: 'general',
            isActive: true
          }
        })

        await prisma.categoryTranslation.create({
          data: {
            categoryId: defaultCategory.id,
            language: 'en',
            name: 'General',
            description: 'General topics and discussions'
          }
        })
      }

      return defaultCategory

    } catch (error) {
      logger.error('Error getting category for topic:', error)
      throw error
    }
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])
    
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5)
  }

  /**
   * Generate poll description from articles (fallback method)
   */
  async generatePollDescription(title: string, articles: any[]): Promise<string> {
    try {
      const articleSummaries = articles.slice(0, 2).map(article => 
        `${article.title}: ${article.description}`
      ).join('\n')

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Create a brief, neutral description for a poll based on the given title and news context. Keep it under 200 characters.'
          },
          {
            role: 'user',
            content: `Poll title: ${title}\n\nNews context:\n${articleSummaries}`
          }
        ],
        temperature: 0.5,
        max_tokens: 100
      })

      return completion.choices[0]?.message?.content?.trim() || ''

    } catch (error) {
      logger.error('Error generating poll description:', error)
      return ''
    }
  }

  /**
   * Generate demo polls when OpenAI API is not available
   */
  private async generateDemoPolls(options: AIGenerationOptions): Promise<GeneratedPoll[]> {
    logger.info('Generating demo polls (OpenAI API not configured)')
    
    const demoPolls = [
      {
        title: "What's the future of remote work post-pandemic?",
        description: "As companies adapt to post-pandemic work environments, opinions vary on the optimal work arrangement.",
        options: [
          "Fully remote is the future",
          "Hybrid model works best",
          "Return to office is necessary",
          "Depends on the industry"
        ],
        categoryId: await this.getDemoCategoryId(),
        confidence: 0.8,
        sourceArticles: [],
        keywords: ['remote work', 'pandemic', 'future', 'workplace']
      },
      {
        title: "Which renewable energy source should be prioritized?",
        description: "Global climate initiatives are pushing for renewable energy adoption across different sectors.",
        options: [
          "Solar power",
          "Wind energy", 
          "Hydroelectric power",
          "Nuclear fusion"
        ],
        categoryId: await this.getDemoCategoryId(),
        confidence: 0.75,
        sourceArticles: [],
        keywords: ['renewable energy', 'climate', 'sustainability', 'green tech']
      },
      {
        title: "What's the biggest challenge facing social media platforms?",
        description: "Social media companies are dealing with multiple regulatory and social challenges worldwide.",
        options: [
          "Misinformation and fake news",
          "Privacy and data protection",
          "Content moderation",
          "Mental health impact"
        ],
        categoryId: await this.getDemoCategoryId(),
        confidence: 0.7,
        sourceArticles: [],
        keywords: ['social media', 'technology', 'regulation', 'digital rights']
      }
    ]

    return demoPolls.slice(0, options.count || 1)
  }

  /**
   * Get demo category ID for polls
   */
  private async getDemoCategoryId(): Promise<string> {
    try {
      let generalCategory = await prisma.category.findFirst({
        where: { slug: 'general', isActive: true }
      })

      if (!generalCategory) {
        generalCategory = await prisma.category.create({
          data: {
            slug: 'general',
            isActive: true
          }
        })

        await prisma.categoryTranslation.create({
          data: {
            categoryId: generalCategory.id,
            language: 'en',
            name: 'General',
            description: 'General topics and discussions'
          }
        })
      }

      return generalCategory.id
    } catch (error) {
      logger.error('Error getting demo category:', error)
      throw error
    }
  }
}

export default AIService