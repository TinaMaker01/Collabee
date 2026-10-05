import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { sql } from 'drizzle-orm'
import 'dotenv/config'
import NodeCache from 'node-cache'
import { db } from './db/index.js'
import { seed } from './db/seed.js'
import { logger } from './utils/logger.js'
import { AppError } from './middleware/error.js'
import employeesRoute from './routes/employees.js'
import authRoute from './routes/auth.js'
import departmentsRoute from './routes/departments.js'
import attendanceRoute from './routes/attendance.js'
import leaveRoute from './routes/leave.js'
import tasksRoute from './routes/tasks.js'
import adminRoute from './routes/admin.js'
import notificationsRoute from './routes/notifications.js'
import leaveBalanceRoute from './routes/leaveBalance.js'
import documentsRoute from './routes/documents.js'
import activityLogsRoute from './routes/activityLogs.js'
import dashboardRoute from './routes/dashboard.js'

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

  const app = new Hono()

  app.use('*', async (c, next) => {
    const start = Date.now()
    await next()
    const dur = Date.now() - start
    logger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, duration: dur },
      `${c.req.method} ${c.req.path} ${c.res.status} ${dur}ms`,
    )
  })

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
  app.use('*', cors({ origin: corsOrigin, credentials: true }))

  const RATE_LIMIT = parseEnvInt(process.env.RATE_LIMIT, 100)
  const RATE_WINDOW_SEC = 60
  const rateLimitCache = new NodeCache({ stdTTL: RATE_WINDOW_SEC, checkperiod: 30 })

  // Strict auth rate limiter (10 attempts per minute per IP to prevent brute-force)
  const authRateLimitCache = new NodeCache({ stdTTL: 60, checkperiod: 30 })
  const AUTH_RATE_LIMIT = parseEnvInt(process.env.AUTH_RATE_LIMIT, 10)

  app.use('/api/auth/*', async (c, next) => {
    if (c.req.path === '/api/auth/login' || c.req.path === '/api/auth/register') {
      const ip =
        c.req.header('cf-connecting-ip') ||
        c.req.header('x-real-ip') ||
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        '127.0.0.1'
      const count = authRateLimitCache.get<number>(ip) ?? 0
      if (count >= AUTH_RATE_LIMIT) {
        return c.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many authentication attempts. Please try again later.',
            },
          },
          429,
        )
      }
      authRateLimitCache.set(ip, count + 1)
    }
    await next()
  })

  app.use('*', async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-real-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      '127.0.0.1'
    const currentCount = rateLimitCache.get<number>(ip)
    if (currentCount === undefined) {
      rateLimitCache.set(ip, 1)
    } else {
      if (currentCount >= RATE_LIMIT) {
        return c.json({ error: 'Too many requests' }, 429)
      }
      const ttl = rateLimitCache.getTtl(ip)
      if (ttl !== undefined) {
        const remainingTtl = (ttl - Date.now()) / 1000
        rateLimitCache.set(ip, currentCount + 1, remainingTtl)
      } else {
        rateLimitCache.set(ip, currentCount + 1)
      }
    }
    await next()
  })

  app.use('*', async (c, next) => {
    await next()
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('X-Frame-Options', 'DENY')
    c.res.headers.set('X-XSS-Protection', '0')
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    c.res.headers.set('Content-Security-Policy', "default-src 'self'")
    c.res.headers.set('Referrer-Policy', 'no-referrer')
    c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  })

  app.get('/api/health', async (c) => {
    try {
      await db.execute(sql`SELECT 1`)
      return c.json({ status: 'ok', db: 'connected' })
    } catch {
      return c.json({ status: 'error', db: 'disconnected' }, 503)
    }
  })

  app.onError((err, c) => {
    if (err instanceof AppError) {
      c.status(err.statusCode as 400 | 401 | 403 | 404 | 409 | 500)
      return c.json({ error: { code: err.code, message: err.message, details: err.details } })
    }
    const pgErr = err as { code?: string; constraint?: string }
    if (pgErr.code === '23505') {
      return c.json({ error: { code: 'CONFLICT', message: 'A record with that value already exists' } }, 409)
    }
    if (pgErr.code === '23503') {
      return c.json({ error: { code: 'FK_VIOLATION', message: 'Referenced record not found' } }, 400)
    }
    logger.error(err)
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
  })

  app.notFound((c) => {
    return c.json({ error: { code: 'NOT_FOUND', message: `Route not found: ${c.req.method} ${c.req.path}` } }, 404)
  })

  app.route('/api/auth', authRoute)
  app.route('/api/employees', employeesRoute)
  app.route('/api/departments', departmentsRoute)
  app.route('/api/attendance', attendanceRoute)
  app.route('/api/leave', leaveRoute)
  app.route('/api/tasks', tasksRoute)
  app.route('/api/admin', adminRoute)
  app.route('/api/notifications', notificationsRoute)
  app.route('/api/leave-balance', leaveBalanceRoute)
  app.route('/api/documents', documentsRoute)
  app.route('/api/activity-logs', activityLogsRoute)
  app.route('/api/dashboard', dashboardRoute)

  const port = parseEnvInt(process.env.PORT, 3000)
  serve({ fetch: app.fetch, port })
  logger.info(`Server is running on port ${port}`)
}

startup().catch((err) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})
