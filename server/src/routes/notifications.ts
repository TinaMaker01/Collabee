import { Hono } from 'hono'
import { db } from '../db/index.js'
import { notifications } from '../db/schema.js'
import { eq, desc, and } from 'drizzle-orm'
import { protectRoute } from '../middleware/auth.js'
import { NotFoundError } from '../middleware/error.js'

const notificationsRoute = new Hono()

notificationsRoute.get('/', protectRoute, async (c) => {
  const user = c.get('user')
  const data = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
  return c.json(data)
})

notificationsRoute.patch('/:id/read', protectRoute, async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid notification ID')
  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning()
  if (!updated) throw new NotFoundError('Notification not found')
  return c.json(updated)
})

notificationsRoute.patch('/read-all', protectRoute, async (c) => {
  const user = c.get('user')
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id))
  return c.json({ message: 'All notifications marked as read' })
})

notificationsRoute.delete('/:id', protectRoute, async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid notification ID')
  const [deleted] = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning()
  if (!deleted) throw new NotFoundError('Notification not found')
  return c.json({ message: 'Notification deleted' })
})

export default notificationsRoute
