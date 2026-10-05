import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { employees } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { employeeSchema, employeeUpdateSchema } from '../shared/schemas.js'
import { NotFoundError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { parseCsv } from '../utils/csv.js'
import { logActivity } from '../utils/activityLogger.js'
import { z } from 'zod'

const employeesRoute = new Hono()

employeesRoute.use('*', protectRoute)

employeesRoute.get('/', async (c) => {
  const user = c.get('user')
  const data = await withCache(c, () => db.select().from(employees))
  if (user.role === 'user') {
    return c.json(
      data.map((emp) => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        position: emp.position,
        departmentId: emp.departmentId,
        avatarUrl: emp.avatarUrl,
        status: emp.status,
      })),
    )
  }
  return c.json(data)
})

employeesRoute.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const [employee] = await db.select().from(employees).where(eq(employees.id, id))
  if (!employee) throw new NotFoundError('Employee not found')

  const user = c.get('user')
  if (user.role === 'user' && employee.email !== user.email) {
    return c.json({ id: employee.id, name: employee.name, position: employee.position, avatarUrl: employee.avatarUrl })
  }

  return c.json(employee)
})

employeesRoute.post('/', requireRole('admin', 'manager'), zValidator('json', employeeSchema), async (c) => {
  const body = c.req.valid('json')
  const [newEmployee] = await db
    .insert(employees)
    .values({
      name: body.name,
      email: body.email,
      position: body.position,
      phone: body.phone,
      avatarUrl: body.avatarUrl,
      departmentId: body.departmentId,
      hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
      salary: body.salary,
      status: body.status,
      isDummy: false,
    })
    .returning()
  invalidateCache('/api/employees')
  invalidateCache('/api/leave-balance')
  await logActivity(c.get('user').id, 'create', 'employee', newEmployee.id, `Created employee "${newEmployee.name}"`)
  return c.json(newEmployee, 201)
})

const csvRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  position: z.string().optional().default(''),
})

employeesRoute.post(
  '/bulk-import',
  requireRole('admin'),
  zValidator('form', z.object({ file: z.any() })),
  async (c) => {
    const { file } = c.req.valid('form')
    const text = await file.text()
    const raw = parseCsv<Record<string, string>>(text)
    const errors: { row: number; issues: string[] }[] = []
    const valid: z.infer<typeof csvRowSchema>[] = []

    for (let i = 0; i < raw.length; i++) {
      const result = csvRowSchema.safeParse(raw[i])
      if (result.success) {
        valid.push(result.data)
      } else {
        errors.push({ row: i + 2, issues: result.error.issues.map((iss) => iss.message) })
      }
    }

    if (errors.length > 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'CSV contains invalid rows', details: errors } }, 400)
    }

    if (valid.length > 0) {
      await db.insert(employees).values(
        valid.map((emp) => ({
          name: emp.name,
          email: emp.email,
          position: emp.position || null,
          isDummy: false,
        })),
      )
    }

    invalidateCache('/api/employees')
    invalidateCache('/api/leave-balance')
    await logActivity(c.get('user').id, 'bulk_import', 'employee', undefined, `Imported ${valid.length} employees`)
    return c.json({ message: 'Bulk import successful', count: valid.length }, 201)
  },
)

employeesRoute.put('/:id', requireRole('admin', 'manager'), zValidator('json', employeeUpdateSchema), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const body = c.req.valid('json')
  const values: Record<string, unknown> = {}
  if (body.name !== undefined) values.name = body.name
  if (body.position !== undefined) values.position = body.position
  if (body.email !== undefined) values.email = body.email
  if (body.phone !== undefined) values.phone = body.phone
  if (body.avatarUrl !== undefined) values.avatarUrl = body.avatarUrl
  if (body.departmentId !== undefined) values.departmentId = body.departmentId
  if (body.hireDate !== undefined) values.hireDate = new Date(body.hireDate)
  if (body.salary !== undefined) values.salary = body.salary
  if (body.status !== undefined) values.status = body.status
  const [updated] = await db.update(employees).set(values).where(eq(employees.id, id)).returning()
  if (!updated) throw new NotFoundError('Employee not found')
  invalidateCache('/api/employees')
  invalidateCache('/api/leave-balance')
  await logActivity(c.get('user').id, 'update', 'employee', id, `Updated employee "${updated.name}"`)
  return c.json(updated)
})

employeesRoute.delete('/:id', requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const [deleted] = await db.delete(employees).where(eq(employees.id, id)).returning()
  if (!deleted) throw new NotFoundError('Employee not found')
  invalidateCache('/api/employees')
  invalidateCache('/api/leave-balance')
  await logActivity(c.get('user').id, 'delete', 'employee', id, `Deleted employee "${deleted.name}"`)
  return c.json({ message: 'Employee deleted' })
})

export default employeesRoute
