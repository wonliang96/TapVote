const { PrismaClient } = require('@prisma/client')

async function setup() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🗄️  Setting up database...')
    
    // Create sample category
    const category = await prisma.category.upsert({
      where: { slug: 'general' },
      update: {},
      create: {
        slug: 'general',
        icon: '📊',
        color: '#3B82F6',
        categoryTranslations: {
          create: {
            language: 'en',
            name: 'General',
            description: 'General polling questions'
          }
        }
      }
    })

    // Create sample user
    const user = await prisma.user.upsert({
      where: { email: 'demo@tapvote.com' },
      update: {},
      create: {
        email: 'demo@tapvote.com',
        username: 'demo',
        displayName: 'Demo User'
      }
    })

    // Create sample poll
    const poll = await prisma.poll.upsert({
      where: { id: 'sample-poll-1' },
      update: {},
      create: {
        id: 'sample-poll-1',
        creatorId: user.id,
        categoryId: category.id,
        originalLanguage: 'en',
        pollTranslations: {
          create: {
            language: 'en',
            title: 'What is your favorite programming language?',
            description: 'Choose your preferred programming language for web development.'
          }
        },
        options: {
          create: [
            {
              orderIndex: 0,
              originalLanguage: 'en',
              pollOptionTranslations: {
                create: {
                  language: 'en',
                  text: 'JavaScript'
                }
              }
            },
            {
              orderIndex: 1,
              originalLanguage: 'en',
              pollOptionTranslations: {
                create: {
                  language: 'en',
                  text: 'Python'
                }
              }
            },
            {
              orderIndex: 2,
              originalLanguage: 'en',
              pollOptionTranslations: {
                create: {
                  language: 'en',
                  text: 'TypeScript'
                }
              }
            }
          ]
        }
      }
    })

    console.log('✅ Database setup complete!')
    console.log('📊 Sample poll created:', poll.id)
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setup()