import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { attendance, employees } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { attendanceSchema, attendanceUpdateSchema } from '../shared/schemas.js'

const attendanceRoute = new Hono()

attendanceRoute.use('*', protectRoute)

attendanceRoute.get('/', async (c) => {
  const user = c.get('user')
  const employeeId = c.req.query('employeeId')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp) return c.json([])
    const data = await withCache(c, () =>
      db.select().from(attendance).where(eq(attendance.employeeId, emp.id)),
    )
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
  return c.json(newRecord, 201)
})

attendanceRoute.put(
  '/:id',
  protectRoute,
  requireRole('admin', 'manager'),
  zValidator('json', attendanceUpdateSchema),
  async (c) => {
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
    return c.json(updated)
  },
)

attendanceRoute.delete('/:id', protectRoute, requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const [deleted] = await db.delete(attendance).where(eq(attendance.id, id)).returning()
  if (!deleted) throw new NotFoundError('Attendance record not found')
  invalidateCache('/api/attendance')
  return c.json({ message: 'Attendance record deleted' })
})

export default attendanceRoute
