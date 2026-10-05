import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tasks, employees } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { taskSchema, taskUpdateSchema } from '../shared/schemas.js'

const tasksRoute = new Hono()

tasksRoute.use('*', protectRoute)

tasksRoute.get('/', async (c) => {
  const user = c.get('user')
  const assignedTo = c.req.query('assignedTo')
  const departmentId = c.req.query('departmentId')
  const conditions: SQL[] = []
  if (assignedTo) conditions.push(eq(tasks.assignedTo, parseInt(assignedTo, 10)))
  if (departmentId) conditions.push(eq(tasks.departmentId, parseInt(departmentId, 10)))

  if (user.role === 'user' && !assignedTo && !departmentId) {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (emp) {
      const data = await withCache(c, () => db.select().from(tasks).where(eq(tasks.assignedTo, emp.id)))
      return c.json(data)
    }
  }

  if (conditions.length > 0) {
    const query = db
      .select()
      .from(tasks)
      .where(and(...conditions))
    const data = await query
    return c.json(data)
  }
  const data = await withCache(c, () => db.select().from(tasks))
  return c.json(data)
})

tasksRoute.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!task) throw new NotFoundError('Task not found')
  return c.json(task)
})

tasksRoute.post('/', requireRole('admin', 'manager'), zValidator('json', taskSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const [newTask] = await db
    .insert(tasks)
    .values({
      title: body.title,
      description: body.description,
      assignedTo: body.assignedTo,
      createdBy: user.id,
      departmentId: body.departmentId,
      status: body.status,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    })
    .returning()
  invalidateCache('/api/tasks')
  return c.json(newTask, 201)
})

tasksRoute.put(
  '/:id',
  protectRoute,
  requireRole('admin', 'manager'),
  zValidator('json', taskUpdateSchema),
  async (c) => {
    const id = parseInt(c.req.param('id')!, 10)
    const body = c.req.valid('json')
    const values: Record<string, unknown> = {}
    if (body.title !== undefined) values.title = body.title
    if (body.description !== undefined) values.description = body.description
    if (body.assignedTo !== undefined) values.assignedTo = body.assignedTo
    if (body.departmentId !== undefined) values.departmentId = body.departmentId
    if (body.status !== undefined) values.status = body.status
    if (body.priority !== undefined) values.priority = body.priority
    if (body.dueDate !== undefined) values.dueDate = new Date(body.dueDate)
    const [updated] = await db.update(tasks).set(values).where(eq(tasks.id, id)).returning()
    if (!updated) throw new NotFoundError('Task not found')
    invalidateCache('/api/tasks')
    return c.json(updated)
  },
)

tasksRoute.delete('/:id', protectRoute, requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id')!, 10)
  const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning()
  if (!deleted) throw new NotFoundError('Task not found')
  invalidateCache('/api/tasks')
  return c.json({ message: 'Task deleted' })
})

export default tasksRoute
