import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { departments, employees, tasks, users } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError, ValidationError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { departmentSchema, departmentUpdateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'
import { requireTenantId } from '../services/tenant.js'

async function assertManagerInTenant(managerId: number, tenantId: number) {
  const [manager] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, managerId), eq(users.organizationId, tenantId)))
  if (!manager) throw new ValidationError('managerId does not belong to your organization')
}

const departmentsRoute = new Hono()

departmentsRoute.use('*', protectRoute)

departmentsRoute.get('/', async (c) => {
  const tenantId = await requireTenantId(c)
  const data = await withCache(c, () => db.select().from(departments).where(eq(departments.organizationId, tenantId)))
  return c.json(data)
})

departmentsRoute.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const tenantId = await requireTenantId(c)
  const [department] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.organizationId, tenantId)))
  if (!department) throw new NotFoundError('Department not found')
  return c.json(department)
})

departmentsRoute.post('/', requireRole('admin', 'manager'), zValidator('json', departmentSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const organizationId = await requireTenantId(c)
  if (body.managerId != null) {
    await assertManagerInTenant(body.managerId, organizationId)
  }
  const [newDepartment] = await db.insert(departments).values({ ...body, organizationId }).returning()
  invalidateCache('/api/departments')
  await logActivity(user.id, 'create', 'department', newDepartment.id, `Created department "${newDepartment.name}"`)
  return c.json(newDepartment, 201)
})

departmentsRoute.put('/:id', requireRole('admin', 'manager'), zValidator('json', departmentUpdateSchema), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  const tenantId = await requireTenantId(c)
  const body = c.req.valid('json')
  if (body.managerId != null) {
    await assertManagerInTenant(body.managerId, tenantId)
  }
  const [updated] = await db
    .update(departments)
    .set(body)
    .where(and(eq(departments.id, id), eq(departments.organizationId, tenantId)))
    .returning()
  if (!updated) throw new NotFoundError('Department not found')
  invalidateCache('/api/departments')
  invalidateCache('/api/employees')
  await logActivity(user.id, 'update', 'department', id, `Updated department "${updated.name}"`)
  return c.json(updated)
})

departmentsRoute.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  const tenantId = await requireTenantId(c)

  // Confirm ownership before mutating anything: otherwise a delete attempt
  // on another organization's department id would still disassociate that
  // other org's employees/tasks below, even though the delete itself would
  // later fail and return 404.
  const [existing] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.organizationId, tenantId)))
  if (!existing) throw new NotFoundError('Department not found')

  // Disassociate employees and tasks from this department before deleting
  // to maintain referential integrity.
  await db.update(employees).set({ departmentId: null }).where(eq(employees.departmentId, id))
  await db.update(tasks).set({ departmentId: null }).where(eq(tasks.departmentId, id))

  const [deleted] = await db
    .delete(departments)
    .where(and(eq(departments.id, id), eq(departments.organizationId, tenantId)))
    .returning()
  if (!deleted) throw new NotFoundError('Department not found')
  invalidateCache('/api/departments')
  invalidateCache('/api/employees')
  await logActivity(user.id, 'delete', 'department', id, `Deleted department "${deleted.name}"`)
  return c.json({ message: 'Department deleted' })
})

export default departmentsRoute
