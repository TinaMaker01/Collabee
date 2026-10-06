import { serve } from '@hono/node-server'
import { sql } from 'drizzle-orm'
import 'dotenv/config'
import { db } from './db/index.js'
import { seed } from './db/seed.js'
import { logger } from './utils/logger.js'
import { createApp } from './app.js'

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

async function waitForDb(maxRetries = 10, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await db.execute(sql`SELECT 1`)
      logger.info('Database connected')
      return
    } catch {
      if (i < maxRetries - 1) {
        logger.warn(`Database not ready, retrying in ${delay}ms... (${i + 1}/${maxRetries})`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  logger.error('Could not connect to database after multiple retries')
  process.exit(1)
}

async function startup() {
  validateEnv()
  await waitForDb()
  await seed()
  logger.info('Seed complete')

  const app = createApp()
  const port = parseEnvInt(process.env.PORT, 3000)
  serve({ fetch: app.fetch, port })
  logger.info(`Server is running on port ${port}`)
}

startup().catch((err) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})
