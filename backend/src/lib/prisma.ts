import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// Connect to database
prisma.$connect()
  .then(() => {
    logger.info('Connected to database')
  })
  .catch((error) => {
    logger.error('Failed to connect to database', error)
    process.exit(1)
  })