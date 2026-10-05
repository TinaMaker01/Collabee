import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import dashboardRoute from '../routes/dashboard.js'
import { AppError } from '../middleware/error.js'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../services/auth.js', () => ({
  verifyToken: vi.fn(),
}))

import { db } from '../db/index.js'
import { verifyToken } from '../services/auth.js'

describe('Dashboard aggregated stats route', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.onError((err, c) => {
      if (err instanceof AppError) {
        c.status(err.statusCode as 400 | 401 | 403 | 404 | 409 | 500)
        return c.json({ error: { code: err.code, message: err.message } })
      }
      return c.json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } }, 500)
    })
    app.route('/api/dashboard', dashboardRoute)
  })

  it('GET /api/dashboard/stats should return aggregated KPIs', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'emp@test.com', name: 'Emp', role: 'user' })

    // Users count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ value: 12 }]),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Employees count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ value: 8 }]),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Dept count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ value: 3 }]),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Pending leave count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ value: 2 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Current employee lookup
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 4, email: 'emp@test.com' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Tasks for employee
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/dashboard/stats', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.employeesCount).toBe(8)
    expect(data.departmentsCount).toBe(3)
    expect(data.pendingLeavesCount).toBe(2)
    expect(data.myTasksCount).toBe(5)
    expect(data.usersCount).toBe(12)
  })
})
