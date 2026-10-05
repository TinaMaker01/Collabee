import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import tasksRoute from '../routes/tasks.js'
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

describe('Tasks routes & BOLA authorization', () => {
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
    app.route('/api/tasks', tasksRoute)
  })

  it('GET /api/tasks as user should only return tasks scoped to that employee', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 2, email: 'emp@test.com', name: 'Emp', role: 'user' })

    // Mock finding employee
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 10, email: 'emp@test.com', departmentId: 3 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock finding scoped tasks
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 101, title: 'My Task', assignedTo: 10, departmentId: 3 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/tasks?assignedTo=999', {
      headers: { Authorization: 'Bearer user-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe(101)
  })

  it('GET /api/tasks/:id as user should reject access if task belongs to another employee', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 2, email: 'emp@test.com', name: 'Emp', role: 'user' })

    // Mock task query
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 200, title: 'Secret Task', assignedTo: 99, departmentId: 99 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock employee query
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 10, email: 'emp@test.com', departmentId: 3 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/tasks/200', {
      headers: { Authorization: 'Bearer user-token' },
    })
    expect(res.status).toBe(403)
  })

  it('POST /api/tasks as admin should succeed and return 201', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' })

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 1, title: 'Deploy to Prod', status: 'todo', priority: 'high', createdBy: 1 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Deploy to Prod', priority: 'high' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.title).toBe('Deploy to Prod')
  })
})
