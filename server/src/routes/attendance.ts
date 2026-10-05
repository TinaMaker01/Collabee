import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { attendance, employees } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { attendanceSchema, attendanceUpdateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'

const attendanceRoute = new Hono()

attendanceRoute.use('*', protectRoute)

attendanceRoute.get('/', async (c) => {
  const user = c.get('user')
  const employeeId = c.req.query('employeeId')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp) return c.json([])
    const data = await withCache(c, () => db.select().from(attendance).where(eq(attendance.employeeId, emp.id)))
    return c.json(data)
  }

  if (employeeId) {
    const data = await db
      .select()
      .from(attendance)
      .where(eq(attendance.employeeId, parseInt(employeeId, 10)))
    return c.json(data)
  }
  const data = await withCache(c, () => db.select().from(attendance))
  return c.json(data)
})

attendanceRoute.post('/check-in', async (c) => {
  const user = c.get('user')
  const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
  if (!emp) throw new NotFoundError('Employee profile not found')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const now = new Date()

  const [existing] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employeeId, emp.id), eq(attendance.date, today)))

  if (existing) {
    if (!existing.checkIn) {
      const [updated] = await db
        .update(attendance)
        .set({ checkIn: now })
        .where(eq(attendance.id, existing.id))
        .returning()
      invalidateCache('/api/attendance')
      await logActivity(user.id, 'check_in', 'attendance', updated.id, 'Employee checked in')
      return c.json(updated)
    }
    return c.json(existing)
  }

  const [newRecord] = await db
    .insert(attendance)
    .values({
      employeeId: emp.id,
      date: today,
      checkIn: now,
      status: 'present',
    })
    .returning()

  invalidateCache('/api/attendance')
  await logActivity(user.id, 'check_in', 'attendance', newRecord.id, 'Employee checked in')
  return c.json(newRecord, 201)
})

attendanceRoute.post('/check-out', async (c) => {
  const user = c.get('user')
  const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
  if (!emp) throw new NotFoundError('Employee profile not found')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const now = new Date()

  const [existing] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employeeId, emp.id), eq(attendance.date, today)))

  if (!existing) {
    const [newRecord] = await db
      .insert(attendance)
      .values({
        employeeId: emp.id,
        date: today,
        checkOut: now,
        status: 'present',
      })
      .returning()
    invalidateCache('/api/attendance')
    await logActivity(user.id, 'check_out', 'attendance', newRecord.id, 'Employee checked out')
    return c.json(newRecord, 201)
  }

  const [updated] = await db.update(attendance).set({ checkOut: now }).where(eq(attendance.id, existing.id)).returning()

  invalidateCache('/api/attendance')
  await logActivity(user.id, 'check_out', 'attendance', updated.id, 'Employee checked out')
  return c.json(updated)
})

attendanceRoute.get('/:id', async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const [record] = await db.select().from(attendance).where(eq(attendance.id, id))
  if (!record) throw new NotFoundError('Attendance record not found')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp || record.employeeId !== emp.id) {
      throw new NotFoundError('Attendance record not found')
    }
  }

  return c.json(record)
})

attendanceRoute.post('/', requireRole('admin', 'manager'), zValidator('json', attendanceSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const [newRecord] = await db
    .insert(attendance)
    .values({
      employeeId: body.employeeId,
      date: new Date(body.date),
      checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
      checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
      status: body.status,
      notes: body.notes,
    })
    .returning()
  invalidateCache('/api/attendance')
  await logActivity(user.id, 'create', 'attendance', newRecord.id, 'Created attendance record')
  return c.json(newRecord, 201)
})

attendanceRoute.put('/:id', requireRole('admin', 'manager'), zValidator('json', attendanceUpdateSchema), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  const body = c.req.valid('json')
  const values: Record<string, unknown> = {}
  if (body.employeeId !== undefined) values.employeeId = body.employeeId
  if (body.date !== undefined) values.date = new Date(body.date)
  if (body.checkIn !== undefined) values.checkIn = new Date(body.checkIn)
  if (body.checkOut !== undefined) values.checkOut = new Date(body.checkOut)
  if (body.status !== undefined) values.status = body.status
  if (body.notes !== undefined) values.notes = body.notes
  const [updated] = await db.update(attendance).set(values).where(eq(attendance.id, id)).returning()
  if (!updated) throw new NotFoundError('Attendance record not found')
  invalidateCache('/api/attendance')
  await logActivity(user.id, 'update', 'attendance', id, 'Updated attendance record')
  return c.json(updated)
})

attendanceRoute.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  const [deleted] = await db.delete(attendance).where(eq(attendance.id, id)).returning()
  if (!deleted) throw new NotFoundError('Attendance record not found')
  invalidateCache('/api/attendance')
  await logActivity(user.id, 'delete', 'attendance', id, 'Deleted attendance record')
  return c.json({ message: 'Attendance record deleted' })
})

export default attendanceRoute
