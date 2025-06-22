interface TranslationItem {
  id: string
  originalText: string
  originalLanguage: string
  translations: Record<string, {
    text: string
    isMachineTranslated: boolean
  }>
}

export class TranslationManager {
  private cache = new Map<string, TranslationItem>()
  
  async translateText(
    text: string, 
    fromLanguage: string, 
    toLanguage: string
  ): Promise<{ text: string; isMachineTranslated: boolean }> {
    // Check cache first
    const cacheKey = `${text}:${fromLanguage}:${toLanguage}`
    const cached = this.cache.get(cacheKey)
    
    if (cached?.translations[toLanguage]) {
      return cached.translations[toLanguage]
    }

    // If same language, return original
    if (fromLanguage === toLanguage) {
      return { text, isMachineTranslated: false }
    }

    try {
      // In a real implementation, this would call Google Translate API or similar
      // For demo purposes, we'll return a placeholder
      const translatedText = await this.callTranslationAPI(text, fromLanguage, toLanguage)
      
      const result = {
        text: translatedText,
        isMachineTranslated: true
      }

      // Update cache
      if (!this.cache.has(cacheKey)) {
        this.cache.set(cacheKey, {
          id: cacheKey,
          originalText: text,
          originalLanguage: fromLanguage,
          translations: {}
        })
      }

      const item = this.cache.get(cacheKey)!
      item.translations[toLanguage] = result

      return result
    } catch (error) {
      console.error('Translation failed:', error)
      return { text, isMachineTranslated: false }
    }
  }

  private async callTranslationAPI(
    text: string, 
    from: string, 
    to: string
  ): Promise<string> {
    // Mock translation API call
    // In production, replace with actual Google Translate API call
    
    const mockTranslations: Record<string, Record<string, string>> = {
      'What is the most important technology trend for 2024?': {
        zh: '2024年最重要的技术趋势是什么？',
        ms: 'Apakah trend teknologi paling penting untuk tahun 2024?'
      },
      'Should remote work become the standard for tech companies?': {
        zh: '远程工作应该成为科技公司的标准吗？',
        ms: 'Patutkah kerja jarak jauh menjadi standard untuk syarikat teknologi?'
      },
      'Which programming language will dominate in 2025?': {
        zh: '哪种编程语言将在2025年占主导地位？',
        ms: 'Bahasa pengaturcaraan manakah yang akan menguasai pada tahun 2025?'
      },
      'Best approach for sustainable development?': {
        zh: '可持续发展的最佳方法是什么？',
        ms: 'Pendekatan terbaik untuk pembangunan mampan?'
      },
      'Artificial Intelligence': {
        zh: '人工智能',
        ms: 'Kecerdasan Buatan'
      },
      'Quantum Computing': {
        zh: '量子计算',
        ms: 'Pengkomputeran Kuantum'
      },
      'Blockchain': {
        zh: '区块链',
        ms: 'Blockchain'
      },
      'Renewable Energy Tech': {
        zh: '可再生能源技术',
        ms: 'Teknologi Tenaga Boleh Diperbaharui'
      },
      'Machine Learning': {
        zh: '机器学习',
        ms: 'Pembelajaran Mesin'
      },
      'Cloud Computing': {
        zh: '云计算',
        ms: 'Pengkomputeran Awan'
      },
      'JavaScript': {
        zh: 'JavaScript',
        ms: 'JavaScript'
      },
      'Python': {
        zh: 'Python',
        ms: 'Python'
      },
      'TypeScript': {
        zh: 'TypeScript',
        ms: 'TypeScript'
      },
      'Rust': {
        zh: 'Rust',
        ms: 'Rust'
      },
      'Green Technology': {
        zh: '绿色技术',
        ms: 'Teknologi Hijau'
      },
      'Circular Economy': {
        zh: '循环经济',
        ms: 'Ekonomi Sirkuler'
      },
      'Carbon Neutral': {
        zh: '碳中和',
        ms: 'Neutral Karbon'
      },
      'Solar Energy': {
        zh: '太阳能',
        ms: 'Tenaga Solar'
      },
      'Technology': {
        zh: '技术',
        ms: 'Teknologi'
      },
      'Programming': {
        zh: '编程',
        ms: 'Pengaturcaraan'
      },
      'Environment': {
        zh: '环境',
        ms: 'Alam Sekitar'
      },
      'Politics': {
        zh: '政治',
        ms: 'Politik'
      },
      'Sports': {
        zh: '体育',
        ms: 'Sukan'
      },
      'Entertainment': {
        zh: '娱乐',
        ms: 'Hiburan'
      }
    }

    // Simple mock lookup
    const translation = mockTranslations[text]?.[to]
    if (translation) {
      return translation
    }

    // Fallback: simulate API delay and return prefixed text
    await new Promise(resolve => setTimeout(resolve, 500))
    return `[${to.toUpperCase()}] ${text}`
  }

  getOriginalText(translatedText: string, language: string): string | null {
    for (const [, item] of this.cache) {
      const translation = item.translations[language]
      if (translation?.text === translatedText) {
        return item.originalText
      }
    }
    return null
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const translationManager = new TranslationManager()