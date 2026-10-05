import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import adminRoute from '../routes/admin.js'
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
  hashPassword: vi.fn().mockResolvedValue('hashed-pw'),
}))

vi.mock('../utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../db/index.js'
import { verifyToken } from '../services/auth.js'

describe('Admin routes & Safeguards', () => {
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
    app.route('/api/admin', adminRoute)
  })

  it('GET /api/admin/stats should return aggregated counters', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' })

    // Mock count selects for users, employees, tasks, leave
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
        then: (fn: (val: unknown) => unknown) => Promise.resolve(fn([{ value: 10 }])),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/admin/stats', {
      headers: { Authorization: 'Bearer admin-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.users).toBeDefined()
    expect(data.employees).toBeDefined()
  })

  it('DELETE /api/admin/users/:id should prevent self-deletion with 409 Conflict', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' })

    const res = await app.request('/api/admin/users/1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    })
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error.code).toBe('CONFLICT')
  })

  it('PUT /api/admin/users/:id/role should prevent admin from demoting themselves with 409', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' })

    const res = await app.request('/api/admin/users/1/role', {
      method: 'PUT',
      body: JSON.stringify({ role: 'user' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
    })
    expect(res.status).toBe(409)
  })
})
