import { Hono } from 'hono'
import { count, eq, sql, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, employees, departments, leaveRequests, tasks } from '../db/schema.js'
import { protectRoute } from '../middleware/auth.js'
import { requireTenantId } from '../services/tenant.js'

const dashboardRoute = new Hono()

dashboardRoute.use('*', protectRoute)

dashboardRoute.get('/stats', async (c) => {
  const user = c.get('user')
  const tenantId = await requireTenantId(c)

  const [userCount] = await db.select({ value: count() }).from(users).where(eq(users.organizationId, tenantId))
  const [empCount] = await db
    .select({ value: count() })
    .from(employees)
    .where(eq(employees.organizationId, tenantId))
  const [deptCount] = await db
    .select({ value: count() })
    .from(departments)
    .where(eq(departments.organizationId, tenantId))
  const [pendingLeaveCount] = await db
    .select({ value: count() })
    .from(leaveRequests)
    .where(and(eq(leaveRequests.organizationId, tenantId), eq(leaveRequests.status, 'pending')))

  const [currentEmp] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.email, user.email), eq(employees.organizationId, tenantId)))
  let myTasksCount = 0
  if (currentEmp) {
    const [tasksRes] = await db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, tenantId),
          eq(tasks.assignedTo, currentEmp.id),
          sql`${tasks.status} != 'done'`,
        ),
      )
    myTasksCount = Number(tasksRes.value)
  }

  return c.json({
    employeesCount: Number(empCount.value),
    departmentsCount: Number(deptCount.value),
    pendingLeavesCount: Number(pendingLeaveCount.value),
    myTasksCount,
    usersCount: Number(userCount.value),
  })
})

export default dashboardRoute
