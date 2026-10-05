import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { employees } from '../db/schema.js'
import { protectRoute } from '../middleware/auth.js'
import { getAllLeaveBalances, getLeaveBalance } from '../services/leave.js'
import { withCache } from '../utils/cache.js'

const leaveBalanceRoute = new Hono()

leaveBalanceRoute.use('*', protectRoute)

leaveBalanceRoute.get('/', async (c) => {
  const user = c.get('user')
  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp) return c.json([])
    const balance = await getLeaveBalance(emp.id)
    return c.json([
      {
        employeeId: emp.id,
        employeeName: emp.name,
        ...balance,
      },
    ])
  }

  const result = await withCache(c, () => getAllLeaveBalances())
  return c.json(result)
})

export default leaveBalanceRoute
