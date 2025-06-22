import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Create categories
  const categories = [
    {
      slug: 'politics',
      icon: '🏛️',
      color: '#dc2626',
      translations: {
        en: { name: 'Politics', description: 'Political discussions and governance' },
        zh: { name: '政治', description: '政治讨论和治理' },
        ms: { name: 'Politik', description: 'Perbincangan politik dan tadbir urus' }
      }
    },
    {
      slug: 'technology',
      icon: '💻',
      color: '#2563eb',
      translations: {
        en: { name: 'Technology', description: 'Tech trends and innovations' },
        zh: { name: '科技', description: '科技趋势和创新' },
        ms: { name: 'Teknologi', description: 'Trend teknologi dan inovasi' }
      }
    },
    {
      slug: 'entertainment',
      icon: '🎬',
      color: '#dc2626',
      translations: {
        en: { name: 'Entertainment', description: 'Movies, music, and pop culture' },
        zh: { name: '娱乐', description: '电影、音乐和流行文化' },
        ms: { name: 'Hiburan', description: 'Filem, muzik, dan budaya popular' }
      }
    },
    {
      slug: 'sports',
      icon: '⚽',
      color: '#16a34a',
      translations: {
        en: { name: 'Sports', description: 'Sports news and discussions' },
        zh: { name: '体育', description: '体育新闻和讨论' },
        ms: { name: 'Sukan', description: 'Berita sukan dan perbincangan' }
      }
    },
    {
      slug: 'lifestyle',
      icon: '🌟',
      color: '#ca8a04',
      translations: {
        en: { name: 'Lifestyle', description: 'Health, wellness, and daily life' },
        zh: { name: '生活', description: '健康、福祉和日常生活' },
        ms: { name: 'Gaya Hidup', description: 'Kesihatan, kesejahteraan, dan kehidupan seharian' }
      }
    },
    {
      slug: 'world-news',
      icon: '🌍',
      color: '#0891b2',
      translations: {
        en: { name: 'World News', description: 'Global news and current events' },
        zh: { name: '国际新闻', description: '全球新闻和时事' },
        ms: { name: 'Berita Dunia', description: 'Berita global dan peristiwa semasa' }
      }
    }
  ]

  for (const categoryData of categories) {
    const category = await prisma.category.create({
      data: {
        slug: categoryData.slug,
        icon: categoryData.icon,
        color: categoryData.color,
        orderIndex: categories.indexOf(categoryData)
      }
    })

    // Create translations
    for (const [lang, translation] of Object.entries(categoryData.translations)) {
      await prisma.categoryTranslation.create({
        data: {
          categoryId: category.id,
          language: lang,
          name: translation.name,
          description: translation.description
        }
      })
    }

    console.log(`Created category: ${categoryData.slug}`)
  }

  // Create a test user
  const passwordHash = await bcrypt.hash('testpassword123', 12)
  const testUser = await prisma.user.create({
    data: {
      email: 'test@tapvote.com',
      passwordHash,
      username: 'testuser',
      preferredLanguage: 'en',
      isVerified: true
    }
  })

  console.log('Created test user: test@tapvote.com')

  // Create sample polls
  const techCategory = await prisma.category.findUnique({
    where: { slug: 'technology' }
  })

  const lifestyleCategory = await prisma.category.findUnique({
    where: { slug: 'lifestyle' }
  })

  if (techCategory) {
    // Create AI poll
    const aiPoll = await prisma.poll.create({
      data: {
        creatorId: testUser.id,
        categoryId: techCategory.id,
        originalLanguage: 'en',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isTrending: true
      }
    })

    await prisma.pollTranslation.create({
      data: {
        pollId: aiPoll.id,
        language: 'en',
        title: 'What is the most important AI development for 2024?',
        description: 'Share your thoughts on which AI advancement will have the biggest impact this year.'
      }
    })

    // Create poll options
    const aiOptions = [
      'Large Language Models (LLMs)',
      'Computer Vision',
      'Autonomous Vehicles',
      'AI in Healthcare'
    ]

    for (let i = 0; i < aiOptions.length; i++) {
      const option = await prisma.pollOption.create({
        data: {
          pollId: aiPoll.id,
          orderIndex: i,
          originalLanguage: 'en'
        }
      })

      await prisma.pollOptionTranslation.create({
        data: {
          optionId: option.id,
          language: 'en',
          text: aiOptions[i]
        }
      })
    }

    console.log('Created AI poll')
  }

  if (lifestyleCategory) {
    // Create work-life balance poll
    const workPoll = await prisma.poll.create({
      data: {
        creatorId: testUser.id,
        categoryId: lifestyleCategory.id,
        originalLanguage: 'en',
        isTrending: true
      }
    })

    await prisma.pollTranslation.create({
      data: {
        pollId: workPoll.id,
        language: 'en',
        title: 'What is your ideal work arrangement?',
        description: 'With the rise of remote work, what setup works best for you?'
      }
    })

    const workOptions = [
      'Fully remote',
      'Hybrid (2-3 days in office)',
      'Mostly in-office',
      'Fully in-office'
    ]

    for (let i = 0; i < workOptions.length; i++) {
      const option = await prisma.pollOption.create({
        data: {
          pollId: workPoll.id,
          orderIndex: i,
          originalLanguage: 'en'
        }
      })

      await prisma.pollOptionTranslation.create({
        data: {
          optionId: option.id,
          language: 'en',
          text: workOptions[i]
        }
      })
    }

    console.log('Created work-life balance poll')
  }

  console.log('Database seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })