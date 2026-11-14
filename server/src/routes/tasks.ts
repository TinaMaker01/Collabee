import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, or, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tasks, employees, departments, notifications, users } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../middleware/error.js'
import { withCache, invalidateCache } from '../utils/cache.js'
import { taskSchema, taskUpdateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'
import { emitNotification } from '../services/notificationEvents.js'
import { requireTenantId } from '../services/tenant.js'

async function assertAssigneeInTenant(employeeId: number, tenantId: number) {
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.organizationId, tenantId)))
  if (!emp) throw new ValidationError('assignedTo does not belong to your organization')
}

async function assertDepartmentInTenant(departmentId: number, tenantId: number) {
  const [dept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.organizationId, tenantId)))
  if (!dept) throw new ValidationError('departmentId does not belong to your organization')
}

async function notifyTaskAssignee(employeeId: number, taskTitle: string) {
  try {
    const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId))
    if (!emp) return
    const [targetUser] = await db.select().from(users).where(eq(users.email, emp.email))
    if (!targetUser) return
    const [inserted] = await db
      .insert(notifications)
      .values({
        userId: targetUser.id,
        organizationId: targetUser.organizationId,
        title: 'New Task Assigned',
        message: `You have been assigned to task: "${taskTitle}"`,
        type: 'info',
      })
      .returning()
    if (inserted) {
      emitNotification(targetUser.id, inserted)
    }
  } catch {
    // Non-blocking notification delivery
  }
}

const tasksRoute = new Hono()

tasksRoute.use('*', protectRoute)

tasksRoute.get('/', async (c) => {
  const user = c.get('user')
  const tenantId = await requireTenantId(c)
  const assignedTo = c.req.query('assignedTo')
  const departmentId = c.req.query('departmentId')

  if (user.role === 'user') {
    const [emp] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.email, user.email), eq(employees.organizationId, tenantId)))
    if (!emp) return c.json([])

    // Enforce scoping: user can only see their own tasks or their department's tasks
    const scopingCondition = emp.departmentId
      ? or(eq(tasks.assignedTo, emp.id), eq(tasks.departmentId, emp.departmentId))
      : eq(tasks.assignedTo, emp.id)

    const userTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.organizationId, tenantId), scopingCondition))
    return c.json(userTasks)
  }

  // Managers and Admins can query with optional filters
  const conditions: SQL[] = [eq(tasks.organizationId, tenantId)]
  if (assignedTo) conditions.push(eq(tasks.assignedTo, parseInt(assignedTo, 10)))
  if (departmentId) conditions.push(eq(tasks.departmentId, parseInt(departmentId, 10)))

  if (assignedTo || departmentId) {
    const data = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
    return c.json(data)
  }

  const data = await withCache(c, () => db.select().from(tasks).where(eq(tasks.organizationId, tenantId)))
  return c.json(data)
})

tasksRoute.get('/:id', async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const tenantId = await requireTenantId(c)

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, tenantId)))
  if (!task) throw new NotFoundError('Task not found')

  if (user.role === 'user') {
    const [emp] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.email, user.email), eq(employees.organizationId, tenantId)))
    if (!emp) throw new ForbiddenError('Forbidden')
    const hasAccess = task.assignedTo === emp.id || (emp.departmentId && task.departmentId === emp.departmentId)
    if (!hasAccess) throw new ForbiddenError('Forbidden')
  }

  return c.json(task)
})

tasksRoute.post('/', requireRole('admin', 'manager'), zValidator('json', taskSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const organizationId = await requireTenantId(c)
  if (body.assignedTo != null) {
    await assertAssigneeInTenant(body.assignedTo, organizationId)
  }
  if (body.departmentId != null) {
    await assertDepartmentInTenant(body.departmentId, organizationId)
  }
  const [newTask] = await db
    .insert(tasks)
    .values({
      title: body.title,
      description: body.description,
      assignedTo: body.assignedTo,
      createdBy: user.id,
      departmentId: body.departmentId,
      organizationId,
      status: body.status,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    })
    .returning()

  invalidateCache('/api/tasks')
  await logActivity(user.id, 'create', 'task', newTask.id, `Created task "${newTask.title}"`)

  if (newTask.assignedTo) {
    await notifyTaskAssignee(newTask.assignedTo, newTask.title)
  }

  return c.json(newTask, 201)
})

tasksRoute.put('/:id', zValidator('json', taskUpdateSchema), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const tenantId = await requireTenantId(c)

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, tenantId)))
  if (!task) throw new NotFoundError('Task not found')

  const body = c.req.valid('json')
  const isManagerOrAdmin = user.role === 'admin' || user.role === 'manager'

  // If regular user, check if they are the assignee and only allow status update
  if (!isManagerOrAdmin) {
    const [emp] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.email, user.email), eq(employees.organizationId, tenantId)))
    if (!emp || task.assignedTo !== emp.id) {
      throw new ForbiddenError('Forbidden')
    }
    // Assignee can only update status
    if (body.status === undefined) {
      return c.json(task)
    }
    const [updated] = await db
      .update(tasks)
      .set({ status: body.status, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, tenantId)))
      .returning()
    invalidateCache('/api/tasks')
    await logActivity(user.id, 'update', 'task', id, `Updated task status to "${body.status}"`)
    return c.json(updated)
  }

  if (body.assignedTo != null) {
    await assertAssigneeInTenant(body.assignedTo, tenantId)
  }
  if (body.departmentId != null) {
    await assertDepartmentInTenant(body.departmentId, tenantId)
  }

  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title !== undefined) values.title = body.title
  if (body.description !== undefined) values.description = body.description
  if (body.assignedTo !== undefined) values.assignedTo = body.assignedTo
  if (body.departmentId !== undefined) values.departmentId = body.departmentId
  if (body.status !== undefined) values.status = body.status
  if (body.priority !== undefined) values.priority = body.priority
  if (body.dueDate !== undefined) values.dueDate = new Date(body.dueDate)

  const [updated] = await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, tenantId)))
    .returning()
  if (!updated) throw new NotFoundError('Task not found')

  invalidateCache('/api/tasks')
  await logActivity(user.id, 'update', 'task', id, `Updated task "${updated.title}"`)

  if (body.assignedTo && body.assignedTo !== task.assignedTo) {
    await notifyTaskAssignee(body.assignedTo, updated.title)
  }

  return c.json(updated)
})

tasksRoute.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const tenantId = await requireTenantId(c)

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, tenantId)))
    .returning()
  if (!deleted) throw new NotFoundError('Task not found')

  invalidateCache('/api/tasks')
  await logActivity(user.id, 'delete', 'task', id, `Deleted task "${deleted.title}"`)
  return c.json({ message: 'Task deleted' })
})

export default tasksRoute
