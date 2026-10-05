import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { departments } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { departmentSchema, departmentUpdateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'

const departmentsRoute = new Hono()

departmentsRoute.use('*', protectRoute)

departmentsRoute.get('/', async (c) => {
  const data = await withCache(c, () => db.select().from(departments))
  return c.json(data)
})

departmentsRoute.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const [department] = await db.select().from(departments).where(eq(departments.id, id))
  if (!department) throw new NotFoundError('Department not found')
  return c.json(department)
})

departmentsRoute.post('/', requireRole('admin', 'manager'), zValidator('json', departmentSchema), async (c) => {
  const body = c.req.valid('json')
  const [newDepartment] = await db.insert(departments).values(body).returning()
  invalidateCache('/api/departments')
  await logActivity(c.get('user').id, 'CREATE', 'DEPARTMENT', newDepartment.id, { name: newDepartment.name })
  return c.json(newDepartment, 201)
})

departmentsRoute.put(
  '/:id',
  protectRoute,
  requireRole('admin', 'manager'),
  zValidator('json', departmentUpdateSchema),
  async (c) => {
    const id = parseInt(c.req.param('id')!, 10)
    const body = c.req.valid('json')
    const [updated] = await db.update(departments).set(body).where(eq(departments.id, id)).returning()
    if (!updated) throw new NotFoundError('Department not found')
    invalidateCache('/api/departments')
    return c.json(updated)
  },
)

departmentsRoute.delete('/:id', protectRoute, requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const [deleted] = await db.delete(departments).where(eq(departments.id, id)).returning()
  if (!deleted) throw new NotFoundError('Department not found')
  invalidateCache('/api/departments')
  return c.json({ message: 'Department deleted' })
})

export default departmentsRoute
