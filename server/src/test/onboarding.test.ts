import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import onboardingRoute from '../routes/onboarding.js'
import { AppError } from '../middleware/error.js'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

describe('Onboarding Routes', () => {
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
    app.route('/api/onboarding', onboardingRoute)
  })

  it('GET /api/onboarding for regular user returns checklist and statistics', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      id: 2,
      email: 'employee@collabee.local',
      name: 'John Doe',
      role: 'user',
    })

    const mockEmp = { id: 10, email: 'employee@collabee.local', name: 'John Doe' }
    const mockTasks = [
      { id: 1, employeeId: 10, title: 'Compléter profil', completed: false, category: 'profile', order: 1 },
      { id: 2, employeeId: 10, title: 'Téléverser documents', completed: true, category: 'documents', order: 2 },
    ]

    // 1. Select employee
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockEmp]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      // 2. Select onboarding tasks
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockTasks),
          }),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/onboarding', {
      headers: { Authorization: 'Bearer user-token' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.employeeId).toBe(10)
    expect(data.tasks).toHaveLength(2)
    expect(data.stats.total).toBe(2)
    expect(data.stats.completed).toBe(1)
    expect(data.stats.percent).toBe(50)
  })

  it('PATCH /api/onboarding/:id/toggle updates task completion', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      id: 2,
      email: 'employee@collabee.local',
      name: 'John Doe',
      role: 'user',
    })

    const existingTask = { id: 1, employeeId: 10, title: 'Compléter profil', completed: false }
    const mockEmp = { id: 10, email: 'employee@collabee.local' }

    vi.mocked(db.select)
      // Find task
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingTask]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      // Find employee
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockEmp]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      // Check remaining tasks
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...existingTask, completed: true }]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      // Find employee for notification
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockEmp]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      // Find user for notification
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 2, email: 'employee@collabee.local' }]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...existingTask, completed: true }]),
        }),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 100, title: 'Parcours complété' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/onboarding/1/toggle', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer user-token' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.completed).toBe(true)
  })

  it('POST /api/onboarding creates a custom onboarding task (admin)', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      id: 1,
      email: 'admin@collabee.local',
      name: 'Admin',
      role: 'admin',
    })

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 10, name: 'Alice' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const newTask = {
      id: 5,
      employeeId: 10,
      title: 'Setup VPN and workstation',
      category: 'general',
      order: 10,
      completed: false,
    }

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([newTask]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        employeeId: 10,
        title: 'Setup VPN and workstation',
        category: 'general',
        order: 10,
      }),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.title).toBe('Setup VPN and workstation')
  })

  it('DELETE /api/onboarding/:id removes an onboarding task (admin)', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      id: 1,
      email: 'admin@collabee.local',
      name: 'Admin',
      role: 'admin',
    })

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 5, title: 'Old Task' }]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/onboarding/5', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toContain('deleted')
  })
})
