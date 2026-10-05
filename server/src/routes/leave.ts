import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { leaveRequests, notifications, employees, users } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { leaveRequestSchema, leaveUpdateSchema } from '../shared/schemas.js'
import { type TxClient } from '../db/index.js'
import { logActivity } from '../utils/activityLogger.js'
import { getLeaveBalance } from '../services/leave.js'
import { logger } from '../utils/logger.js'

async function notifyEmployee(tx: TxClient, employeeId: number, title: string, message: string, type: string) {
  const [emp] = await tx.select().from(employees).where(eq(employees.id, employeeId))
  if (!emp) {
    logger.warn({ employeeId }, 'No employee found for ID')
    return
  }
  const [targetUser] = await tx.select().from(users).where(eq(users.email, emp.email))
  if (!targetUser) {
    logger.warn({ employeeEmail: emp.email }, 'No user found for employee email')
    return
  }
  await tx.insert(notifications).values({ userId: targetUser.id, title, message, type })
}

const leaveRoute = new Hono()

leaveRoute.use('*', protectRoute)

leaveRoute.get('/', async (c) => {
  const user = c.get('user')
  const employeeId = c.req.query('employeeId')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp) return c.json([])
    const data = await withCache(c, () =>
      db.select().from(leaveRequests).where(eq(leaveRequests.employeeId, emp.id)),
    )
    return c.json(data)
  }

  if (employeeId) {
    const data = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.employeeId, parseInt(employeeId, 10)))
    return c.json(data)
  }
  const data = await withCache(c, () => db.select().from(leaveRequests))
  return c.json(data)
})

leaveRoute.get('/:id', async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const [request] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id))
  if (!request) throw new NotFoundError('Leave request not found')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp || request.employeeId !== emp.id) {
      throw new NotFoundError('Leave request not found')
    }
  }

  return c.json(request)
})

leaveRoute.post('/', zValidator('json', leaveRequestSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp || body.employeeId !== emp.id) {
      throw new ForbiddenError('Cannot submit leave request for another employee')
    }
  }

  const newRequest = await db.transaction(async (tx) => {
    // Check balance inside transaction for atomicity
    if (body.type === 'annual' || body.type === 'sick' || body.type === 'personal') {
      const balance = await getLeaveBalance(body.employeeId, tx)
      const startDate = new Date(body.startDate).getTime()
      const endDate = new Date(body.endDate).getTime()
      const daysRequested = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1

      if (body.type === 'annual' && balance.annualRemaining < daysRequested)
        throw new ValidationError('Insufficient annual leave balance')
      if (body.type === 'sick' && balance.sickRemaining < daysRequested)
        throw new ValidationError('Insufficient sick leave balance')
      if (body.type === 'personal' && balance.personalRemaining < daysRequested)
        throw new ValidationError('Insufficient personal leave balance')
    }

    const [req] = await tx
      .insert(leaveRequests)
      .values({
        employeeId: body.employeeId,
        type: body.type,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        reason: body.reason,
        status: 'pending',
      })
      .returning()
    return req
  })

  if (!newRequest) throw new ValidationError('Failed to create leave request')

  await logActivity(user.id, 'CREATE', 'LEAVE_REQUEST', newRequest.id, { type: body.type })
  invalidateCache('/api/leave')
  return c.json(newRequest, 201)
})

leaveRoute.put('/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const user = c.get('user')

  const updated = await db.transaction(async (tx) => {
    const [req] = await tx
      .update(leaveRequests)
      .set({
        status: 'approved',
        approvedBy: user.id,
      })
      .where(eq(leaveRequests.id, id))
      .returning()

    if (!req) return null

    await notifyEmployee(
      tx,
      req.employeeId,
      'Leave Approved',
      `Your leave request (${req.type}) has been approved.`,
      'info',
    )
    return req
  })

  if (!updated) throw new NotFoundError('Leave request not found')
  await logActivity(user.id, 'APPROVE', 'LEAVE_REQUEST', id)
  invalidateCache('/api/leave')
  return c.json(updated)
})

leaveRoute.put('/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const user = c.get('user')

  const updated = await db.transaction(async (tx) => {
    const [req] = await tx
      .update(leaveRequests)
      .set({
        status: 'rejected',
        approvedBy: user.id,
      })
      .where(eq(leaveRequests.id, id))
      .returning()

    if (!req) return null

    await notifyEmployee(
      tx,
      req.employeeId,
      'Leave Rejected',
      `Your leave request (${req.type}) has been rejected.`,
      'warning',
    )
    return req
  })

  if (!updated) throw new NotFoundError('Leave request not found')
  await logActivity(user.id, 'REJECT', 'LEAVE_REQUEST', id)
  invalidateCache('/api/leave')
  return c.json(updated)
})

leaveRoute.put('/:id', requireRole('admin', 'manager'), zValidator('json', leaveUpdateSchema), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  const body = c.req.valid('json')
  const values: Record<string, unknown> = {}
  if (body.employeeId !== undefined) values.employeeId = body.employeeId
  if (body.type !== undefined) values.type = body.type
  if (body.startDate !== undefined) values.startDate = new Date(body.startDate)
  if (body.endDate !== undefined) values.endDate = new Date(body.endDate)
  if (body.reason !== undefined) values.reason = body.reason
  if (body.status !== undefined) values.status = body.status

  const [updated] = await db.update(leaveRequests).set(values).where(eq(leaveRequests.id, id)).returning()
  if (!updated) throw new NotFoundError('Leave request not found')

  await logActivity(user.id, 'UPDATE', 'LEAVE_REQUEST', id)
  invalidateCache('/api/leave')
  return c.json(updated)
})

leaveRoute.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  const [deleted] = await db.delete(leaveRequests).where(eq(leaveRequests.id, id)).returning()
  if (!deleted) throw new NotFoundError('Leave request not found')

  await logActivity(user.id, 'DELETE', 'LEAVE_REQUEST', id)
  invalidateCache('/api/leave')
  return c.json({ message: 'Leave request deleted' })
})

export default leaveRoute
