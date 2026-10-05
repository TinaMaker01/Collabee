import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import leaveRoute from '../routes/leave.js'
import { AppError } from '../middleware/error.js'

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([
                { id: 1, employeeId: 1, type: 'annual', startDate: new Date(), endDate: new Date(), status: 'pending' },
              ]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Object.assign(Promise.resolve([]), {
                groupBy: vi.fn().mockResolvedValue([]),
              }),
            ),
          }),
        }),
        update: vi.fn(),
      }),
    ),
  },
}))

vi.mock('../services/auth.js', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('../utils/cache.js', () => ({
  withCache: vi.fn((_c: unknown, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

vi.mock('../services/leave.js', () => ({
  getLeaveBalance: vi.fn().mockResolvedValue({ annualRemaining: 25, sickRemaining: 10, personalRemaining: 5 }),
  getAllLeaveBalances: vi.fn().mockResolvedValue([]),
}))

import { db } from '../db/index.js'
import { verifyToken } from '../services/auth.js'

describe('Leave routes & IDOR protection', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.onError((err, c) => {
      if (err instanceof AppError) {
        c.status(err.statusCode as 400 | 401 | 403 | 404 | 409 | 500)
        return c.json({ error: { code: err.code, message: err.message, details: err.details } })
      }
      return c.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, 500)
    })
    app.route('/api/leave', leaveRoute)
  })

  it('GET /api/leave for user role should only query own employee leave requests', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 2, email: 'user@example.com', name: 'User', role: 'user' })

    // Mock employees query returning employee id 5
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 5, email: 'user@example.com', name: 'User' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock leave requests query returning 1 record
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 10, employeeId: 5, type: 'annual', status: 'approved' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/leave', {
      headers: { Authorization: 'Bearer user-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].employeeId).toBe(5)
  })

  it('POST /api/leave should reject if standard user attempts to submit for another employee ID', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 2, email: 'user@example.com', name: 'User', role: 'user' })

    // Mock employee match for user having ID 5
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 5, email: 'user@example.com' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/leave', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 99, // Another employee ID!
        type: 'annual',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        reason: 'Vacation',
      }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-token' },
    })

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('POST /api/leave should succeed if standard user submits for their own employee ID', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 2, email: 'user@example.com', name: 'User', role: 'user' })

    // Mock employee match for user having ID 5
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 5, email: 'user@example.com' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/leave', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 5,
        type: 'annual',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        reason: 'Vacation',
      }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-token' },
    })

    expect(res.status).toBe(201)
  })
})
