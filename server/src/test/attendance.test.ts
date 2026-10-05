import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import attendanceRoute from '../routes/attendance.js'
import { AppError } from '../middleware/error.js'

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../services/auth.js', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('../utils/cache.js', () => ({
  withCache: vi.fn((_c: unknown, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

vi.mock('../utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../db/index.js'
import { verifyToken } from '../services/auth.js'

describe('Attendance routes & Check-in / Check-out', () => {
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
    app.route('/api/attendance', attendanceRoute)
  })

  it('POST /api/attendance/check-in should record employee clock-in', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 5, email: 'emp@test.com', name: 'Emp', role: 'user' })

    // Mock finding employee
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 10, email: 'emp@test.com' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock checking existing attendance (none for today)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock insert
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 1, employeeId: 10, date: new Date(), checkIn: new Date(), status: 'present' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/attendance/check-in', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token' },
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.employeeId).toBe(10)
    expect(data.status).toBe('present')
  })

  it('POST /api/attendance/check-out should update checkout time', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 5, email: 'emp@test.com', name: 'Emp', role: 'user' })

    // Mock finding employee
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 10, email: 'emp@test.com' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock finding today's attendance record
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 1, employeeId: 10, checkIn: new Date() }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock update
    const checkoutTime = new Date()
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([
              { id: 1, employeeId: 10, checkIn: new Date(), checkOut: checkoutTime, status: 'present' },
            ]),
        }),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/attendance/check-out', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.checkOut).toBeDefined()
  })
})
