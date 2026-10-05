import { Hono } from 'hono'
import { count, eq, sql, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, employees, departments, leaveRequests, tasks } from '../db/schema.js'
import { protectRoute } from '../middleware/auth.js'

const dashboardRoute = new Hono()

dashboardRoute.use('*', protectRoute)

dashboardRoute.get('/stats', async (c) => {
  const user = c.get('user')

  const [userCount] = await db.select({ value: count() }).from(users)
  const [empCount] = await db.select({ value: count() }).from(employees)
  const [deptCount] = await db.select({ value: count() }).from(departments)
  const [pendingLeaveCount] = await db
    .select({ value: count() })
    .from(leaveRequests)
    .where(eq(leaveRequests.status, 'pending'))

  const [currentEmp] = await db.select().from(employees).where(eq(employees.email, user.email))
  let myTasksCount = 0
  if (currentEmp) {
    const [tasksRes] = await db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.assignedTo, currentEmp.id), sql`${tasks.status} != 'done'`))
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
