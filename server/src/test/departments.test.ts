import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import departmentsRoute from '../routes/departments.js'
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

describe('Departments routes & RBAC', () => {
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
    app.route('/api/departments', departmentsRoute)
  })

  it('GET /api/departments should return list of departments', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'user@test.com', name: 'User', role: 'user' })

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { id: 1, name: 'Engineering', description: 'Dev team' },
        { id: 2, name: 'HR', description: 'People ops' },
      ]),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/departments', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
  })

  it('POST /api/departments as regular user should return 403 Forbidden', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 2, email: 'user@test.com', name: 'User', role: 'user' })

    const res = await app.request('/api/departments', {
      method: 'POST',
      body: JSON.stringify({ name: 'Marketing' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-token' },
    })
    expect(res.status).toBe(403)
  })

  it('POST /api/departments as admin should return 201 Created', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' })

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 3, name: 'Marketing', description: 'Growth' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/departments', {
      method: 'POST',
      body: JSON.stringify({ name: 'Marketing', description: 'Growth' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Marketing')
  })
})
