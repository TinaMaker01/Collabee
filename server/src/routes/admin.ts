import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and, sql, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, employees, tasks, leaveRequests, notifications } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError, ConflictError } from '../middleware/error.js'
import { hashPassword } from '../services/auth.js'
import { userCreateSchema, userUpdateSchema } from '../shared/schemas.js'
import { logger } from '../utils/logger.js'
import { logActivity } from '../utils/activityLogger.js'
import { requireTenantId } from '../services/tenant.js'
import { revokeUserTokensIssuedBefore } from '../services/revocation.js'

const adminRoute = new Hono()

adminRoute.use('*', protectRoute)
adminRoute.use('*', requireRole('admin'))

adminRoute.get('/stats', async (c) => {
  const tenantId = await requireTenantId(c)
  const [userCount] = await db.select({ value: count() }).from(users).where(eq(users.organizationId, tenantId))
  const [employeeCount] = await db
    .select({ value: count() })
    .from(employees)
    .where(eq(employees.organizationId, tenantId))
  const [activeTasks] = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.organizationId, tenantId), sql`${tasks.status} != 'done'`))
  const [pendingLeaves] = await db
    .select({ value: count() })
    .from(leaveRequests)
    .where(and(eq(leaveRequests.organizationId, tenantId), eq(leaveRequests.status, 'pending')))

  return c.json({
    users: Number(userCount.value),
    employees: Number(employeeCount.value),
    activeTasks: Number(activeTasks.value),
    pendingLeaves: Number(pendingLeaves.value),
  })
})

adminRoute.get('/users', async (c) => {
  const tenantId = await requireTenantId(c)
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
    .where(eq(users.organizationId, tenantId))
  return c.json(allUsers)
})

const roleSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']),
})

adminRoute.put('/users/:id/role', zValidator('json', roleSchema), async (c) => {
  const currentUser = c.get('user')
  const tenantId = await requireTenantId(c)
  const id = parseInt(c.req.param('id')!, 10)
  const { role } = c.req.valid('json')

  // Check if admin is demoting themselves
  if (id === currentUser.id && role !== 'admin') {
    throw new ConflictError('Cannot demote your own admin account')
  }

  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.organizationId, tenantId)))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
  if (!updated) throw new NotFoundError('User not found')

  // The role embedded in this user's existing token(s) is now stale;
  // force re-authentication so a fresh token carries the new role.
  revokeUserTokensIssuedBefore(id)

  await logActivity(currentUser.id, 'update', 'user', id, `Updated role of user ${updated.email} to ${role}`)
  return c.json(updated)
})

adminRoute.delete('/users/:id', async (c) => {
  const currentUser = c.get('user')
  const tenantId = await requireTenantId(c)
  const id = parseInt(c.req.param('id')!, 10)

  if (id === currentUser.id) {
    throw new ConflictError('Cannot delete your own account')
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.organizationId, tenantId)))
  if (!targetUser) throw new NotFoundError('User not found')

  if (targetUser.role === 'admin') {
    const [adminCount] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.organizationId, tenantId)))
    if (Number(adminCount.value) <= 1) {
      throw new ConflictError('Cannot delete the last remaining admin account')
    }
  }

  // Clean up notifications and reassign foreign keys to avoid DB constraint failures.
  // Scoped by id alone is safe: id already uniquely identifies a row within this
  // tenant (targetUser was confirmed to belong to tenantId above).
  await db.delete(notifications).where(eq(notifications.userId, id))
  await db.update(tasks).set({ createdBy: currentUser.id }).where(eq(tasks.createdBy, id))
  await db.update(leaveRequests).set({ approvedBy: currentUser.id }).where(eq(leaveRequests.approvedBy, id))

  logger.info({ userId: id }, 'Cleaned references for user before deletion')

  const [deleted] = await db
    .delete(users)
    .where(and(eq(users.id, id), eq(users.organizationId, tenantId)))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
    })
  if (!deleted) throw new NotFoundError('User not found')

  // A deleted user's previously issued token(s) must stop working
  // immediately, not after waiting out the remaining token lifetime.
  revokeUserTokensIssuedBefore(id)

  await logActivity(currentUser.id, 'delete', 'user', id, `Deleted user ${deleted.email}`)
  return c.json({ message: 'User deleted' })
})

adminRoute.post('/users', zValidator('json', userCreateSchema), async (c) => {
  const currentUser = c.get('user')
  const body = c.req.valid('json')
  const passwordHash = await hashPassword(body.password)
  const organizationId = await requireTenantId(c)
  const [user] = await db
    .insert(users)
    .values({
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role ?? 'user',
      organizationId,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })

  await logActivity(currentUser.id, 'create', 'user', user.id, `Created user ${user.email} (${user.role})`)
  return c.json(user, 201)
})

adminRoute.put('/users/:id', zValidator('json', userUpdateSchema), async (c) => {
  const currentUser = c.get('user')
  const tenantId = await requireTenantId(c)
  const id = parseInt(c.req.param('id')!, 10)
  const body = c.req.valid('json')
  const [updated] = await db
    .update(users)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.organizationId, tenantId)))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
  if (!updated) throw new NotFoundError('User not found')

  // This update can change role or email, both embedded in existing
  // tokens; force re-authentication so a fresh token reflects them.
  revokeUserTokensIssuedBefore(id)

  await logActivity(currentUser.id, 'update', 'user', id, `Updated user profile for ${updated.email}`)
  return c.json(updated)
})

export default adminRoute
