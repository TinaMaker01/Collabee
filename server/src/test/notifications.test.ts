import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import notificationsRoute from '../routes/notifications.js'
import { AppError } from '../middleware/error.js'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../services/auth.js', () => ({
  verifyToken: vi.fn(),
}))

import { db } from '../db/index.js'
import { verifyToken } from '../services/auth.js'

describe('Notifications routes', () => {
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
    app.route('/api/notifications', notificationsRoute)
  })

  it('GET /api/notifications should list notifications for current user', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'user@test.com', name: 'User', role: 'user' })

    const mockNotifs = [
      { id: 10, userId: 1, title: 'Task Alert', message: 'Assigned', type: 'info', read: false },
    ]

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockNotifs),
          }),
        }),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/notifications', {
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].title).toBe('Task Alert')
  })

  it('PATCH /api/notifications/:id/read should mark notification as read', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'user@test.com', name: 'User', role: 'user' })

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 10, read: true }]),
        }),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/notifications/10/read', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.read).toBe(true)
  })

  it('PATCH /api/notifications/read-all should mark all as read', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'user@test.com', name: 'User', role: 'user' })

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(200)
  })

  it('DELETE /api/notifications/:id should delete notification', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'user@test.com', name: 'User', role: 'user' })

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/notifications/10', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(200)
  })
})
