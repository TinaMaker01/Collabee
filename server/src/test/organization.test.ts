import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import organizationRoute from '../routes/organization.js'
import { AppError } from '../middleware/error.js'

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../services/auth.js', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('../utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../db/index.js'
import { verifyToken } from '../services/auth.js'

describe('Organization & Multi-tenant routes', () => {
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
    app.route('/api/organization', organizationRoute)
  })

  it('GET /api/organization returns organization workspace info and stats', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'user@test.com', name: 'User', role: 'user', organizationId: 1 })

    const mockOrg = {
      id: 1,
      name: 'Collabee HQ',
      slug: 'collabee-hq',
      domain: 'collabee.com',
      logoUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    vi.mocked(db.select)
      // 1. organizations select by tenant id
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockOrg]),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // 2. departments count, scoped by organizationId
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 5 }]),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // 3. users count, scoped by organizationId
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 12 }]),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // 4. employees count, scoped by organizationId
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 25 }]),
        }),
      } as unknown as ReturnType<typeof db.select>)

    const res = await app.request('/api/organization', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organization.name).toBe('Collabee HQ')
    expect(body.stats.departmentsCount).toBe(5)
    expect(body.stats.usersCount).toBe(12)
    expect(body.stats.employeesCount).toBe(25)
  })

  it('PATCH /api/organization as admin allows updating organization settings', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin', organizationId: 1 })

    const existingOrg = {
      id: 1,
      name: 'Collabee HQ',
      slug: 'collabee-hq',
      domain: 'collabee.com',
    }

    const updatedOrg = {
      ...existingOrg,
      name: 'Collabee International',
      domain: 'collabee.global',
    }

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([existingOrg]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedOrg]),
        }),
      }),
    } as unknown as ReturnType<typeof db.update>)

    const res = await app.request('/api/organization', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Collabee International', domain: 'collabee.global' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organization.name).toBe('Collabee International')
    expect(body.organization.domain).toBe('collabee.global')
  })

  it('PATCH /api/organization as regular user returns 403 Forbidden', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 2, email: 'user@test.com', name: 'User', role: 'user', organizationId: 1 })

    const res = await app.request('/api/organization', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hacked Name' }),
    })

    expect(res.status).toBe(403)
  })
})
