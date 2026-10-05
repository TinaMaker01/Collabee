import { eq, sql, inArray, and } from 'drizzle-orm'
import { db, type TxClient } from '../db/index.js'
import { leaveRequests, employees } from '../db/schema.js'
import { LEAVE_DEFAULTS } from '../shared/schemas.js'

export async function getLeaveBalance(employeeId: number, tx: TxClient = db) {
  const leaveStats = await tx
    .select({
      type: leaveRequests.type,
      totalDays: sql<number>`SUM(DATE_PART('day', ${leaveRequests.endDate}::timestamp - ${leaveRequests.startDate}::timestamp) + 1)::integer`,
    })
    .from(leaveRequests)
    .where(and(inArray(leaveRequests.status, ['approved', 'pending']), eq(leaveRequests.employeeId, employeeId)))
    .groupBy(leaveRequests.type)

  const used = { annual: 0, sick: 0, personal: 0, unpaid: 0 }
  for (const stat of leaveStats) {
    if (stat.type in used) {
      used[stat.type as keyof typeof used] = stat.totalDays
    }
  }

  return {
    annualRemaining: Math.max(0, LEAVE_DEFAULTS.annual - used.annual),
    sickRemaining: Math.max(0, LEAVE_DEFAULTS.sick - used.sick),
    personalRemaining: Math.max(0, LEAVE_DEFAULTS.personal - used.personal),
  }
}

export async function getAllLeaveBalances(tx: TxClient = db) {
  const allEmployees = await tx.select({ id: employees.id, name: employees.name }).from(employees)
  if (allEmployees.length === 0) return []

  const leaveStats = await tx
    .select({
      employeeId: leaveRequests.employeeId,
      type: leaveRequests.type,
      totalDays: sql<number>`SUM(DATE_PART('day', ${leaveRequests.endDate}::timestamp - ${leaveRequests.startDate}::timestamp) + 1)::integer`,
    })
    .from(leaveRequests)
    .where(inArray(leaveRequests.status, ['approved', 'pending']))
    .groupBy(leaveRequests.employeeId, leaveRequests.type)

  const usedMap = new Map<number, { annual: number; sick: number; personal: number; unpaid: number }>()
  for (const stat of leaveStats) {
    if (!usedMap.has(stat.employeeId)) {
      usedMap.set(stat.employeeId, { annual: 0, sick: 0, personal: 0, unpaid: 0 })
    }
    const current = usedMap.get(stat.employeeId)!
    if (stat.type in current) {
      current[stat.type as keyof typeof current] = stat.totalDays
    }
  }

  const results = allEmployees.map((emp) => {
    const used = usedMap.get(emp.id) ?? { annual: 0, sick: 0, personal: 0, unpaid: 0 }
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      annualRemaining: Math.max(0, LEAVE_DEFAULTS.annual - used.annual),
      sickRemaining: Math.max(0, LEAVE_DEFAULTS.sick - used.sick),
      personalRemaining: Math.max(0, LEAVE_DEFAULTS.personal - used.personal),
    }
  })

  return results.sort((a, b) => a.employeeId - b.employeeId)
}
