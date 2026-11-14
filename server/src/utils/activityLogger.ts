import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { activityLogs, users } from '../db/schema.js'
import { logger } from './logger.js'

export async function logActivity(
  userId: number,
  action: string,
  entityType: string,
  entityId?: number,
  details?: unknown,
) {
  try {
    await db.insert(activityLogs).values({
      userId,
      // Stamp the acting user's current organization via a correlated
      // subquery rather than threading organizationId through every one
      // of this function's ~40 call sites.
      organizationId: sql`(SELECT ${users.organizationId} FROM ${users} WHERE ${users.id} = ${userId})`,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null,
    })
  } catch (err) {
    logger.error(err, 'Failed to log activity')
  }
}
