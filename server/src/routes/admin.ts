import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, sql, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, employees, tasks, leaveRequests, notifications } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError } from '../middleware/error.js'
import { hashPassword } from '../services/auth.js'
import { userCreateSchema, userUpdateSchema } from '../shared/schemas.js'
import { logger } from '../utils/logger.js'

const adminRoute = new Hono()

adminRoute.use('*', protectRoute)
adminRoute.use('*', requireRole('admin'))

adminRoute.get('/stats', async (c) => {
  const [userCount] = await db.select({ value: count() }).from(users)
  const [employeeCount] = await db.select({ value: count() }).from(employees)
  const [activeTasks] = await db
    .select({ value: count() })
    .from(tasks)
    .where(sql`${tasks.status} != 'done'`)
  const [pendingLeaves] = await db
    .select({ value: count() })
    .from(leaveRequests)
    .where(eq(leaveRequests.status, 'pending'))

  return c.json({
    users: Number(userCount.value),
    employees: Number(employeeCount.value),
    activeTasks: Number(activeTasks.value),
    pendingLeaves: Number(pendingLeaves.value),
  })
})

adminRoute.get('/users', async (c) => {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
  return c.json(allUsers)
})

const roleSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']),
})

adminRoute.put('/users/:id/role', zValidator('json', roleSchema), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const { role } = c.req.valid('json')
  const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
  })
  if (!updated) throw new NotFoundError('User not found')
  return c.json(updated)
})

adminRoute.delete('/users/:id', async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  // Clean up related records before deleting the user
  await db.delete(notifications).where(eq(notifications.userId, id))
  logger.info({ userId: id }, 'Deleted user notifications')
  // Note: tasks and leave_requests created/approved by this user are preserved
  // to maintain referential integrity of historical data
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({
    id: users.id,
    name: users.name,
    email: users.email,
  })
  if (!deleted) throw new NotFoundError('User not found')
  return c.json({ message: 'User deleted' })
})

adminRoute.post('/users', zValidator('json', userCreateSchema), async (c) => {
  const body = c.req.valid('json')
  const passwordHash = await hashPassword(body.password)
  const [user] = await db
    .insert(users)
    .values({
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role ?? 'user',
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
  return c.json(user, 201)
})

adminRoute.put('/users/:id', zValidator('json', userUpdateSchema), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const body = c.req.valid('json')
  const [updated] = await db.update(users).set(body).where(eq(users.id, id)).returning({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
  })
  if (!updated) throw new NotFoundError('User not found')
  return c.json(updated)
})

export default adminRoute
