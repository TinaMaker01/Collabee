import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import employeesRoute from '../routes/employees.js'
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

import { db } from '../db/index.js'
import { withCache } from '../utils/cache.js'
import { verifyToken } from '../services/auth.js'

describe('Employees routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' })
    app = new Hono()
    app.onError((err, c) => {
      if (err instanceof AppError) {
        c.status(err.statusCode as 400 | 401 | 403 | 404 | 409 | 500)
        return c.json({ error: { code: err.code, message: err.message, details: err.details } })
      }
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
    })
    app.route('/api/employees', employeesRoute)
  })

  it('GET /api/employees should return array', async () => {
    vi.mocked(withCache).mockResolvedValue([{ id: 1, name: 'John' }])

    const res = await app.request('/api/employees', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /api/employees/:id should return employee', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 1, name: 'John', email: 'john@example.com' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/employees/1', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('John')
  })

  it('GET /api/employees/:id with bad id should return 404', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/employees/999', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/employees should create employee', async () => {
    const mockEmployee = { id: 1, name: 'Jane', email: 'jane@example.com', position: 'Engineer' }
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockEmployee]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane', email: 'jane@example.com', position: 'Engineer' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Jane')
  })

  it('POST /api/employees with invalid email should return 400', async () => {
    const res = await app.request('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane', email: 'not-an-email' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(400)
  })
})
