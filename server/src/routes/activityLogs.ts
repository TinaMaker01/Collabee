import { Hono } from 'hono'
import { desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { activityLogs } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'

const activityLogsRoute = new Hono()

activityLogsRoute.use('*', protectRoute)
activityLogsRoute.use('*', requireRole('admin'))

activityLogsRoute.get('/', async (c) => {
  const data = await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(100)
  return c.json(data)
})

export default activityLogsRoute
