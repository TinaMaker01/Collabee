import { db } from '../db/index.js'
import { activityLogs } from '../db/schema.js'
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
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null,
    })
  } catch (err) {
    logger.error(err, 'Failed to log activity')
  }
}
