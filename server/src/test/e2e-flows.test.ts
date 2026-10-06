import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}))

vi.mock('../services/auth.js', () => ({
  verifyToken: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue('hashed-password-123'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateToken: vi.fn().mockResolvedValue('mocked-e2e-jwt-token'),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  authenticateUser: vi.fn(),
}))

vi.mock('../utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../db/index.js'
import { verifyToken, generateToken, authenticateUser, getUserById } from '../services/auth.js'

describe('End-to-End Critical Flows (T7)', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    vi.clearAllMocks()
    app = createApp()
  })

  it('Flow 1: Healthcheck & Security Headers', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('connected')

    // Verify critical OWASP security headers
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
  })

  it('Flow 2: Auth Login -> Me -> Authenticated access', async () => {
    const mockUser = {
      id: 1,
      name: 'Admin Boss',
      email: 'admin@collabee.local',
      role: 'admin',
      passwordHash: 'hashed',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(authenticateUser).mockResolvedValue(mockUser)
    vi.mocked(generateToken).mockResolvedValue('admin-jwt-token-xyz')
    vi.mocked(getUserById).mockResolvedValue(mockUser)
    vi.mocked(verifyToken).mockResolvedValue({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
    })

    // 1. Login
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@collabee.local', password: 'password123' }),
    })

    expect(loginRes.status).toBe(200)
    const loginData = await loginRes.json()
    expect(loginData.token).toBe('admin-jwt-token-xyz')
    expect(loginData.user.email).toBe('admin@collabee.local')

    // 2. Fetch /api/auth/me using token
    const meRes = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${loginData.token}` },
    })

    expect(meRes.status).toBe(200)
    const meData = await meRes.json()
    expect(meData.name).toBe('Admin Boss')
    expect(meData.role).toBe('admin')
  })

  it('Flow 3: Employee creation & Paginated Retrieval Flow', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      id: 1,
      email: 'admin@collabee.local',
      name: 'Admin',
      role: 'admin',
    })

    const newEmp = {
      id: 42,
      name: 'Alice Developer',
      email: 'alice@collabee.local',
      position: 'Software Engineer',
      salary: 65000,
      departmentId: null,
      status: 'active',
      phone: null,
      avatarUrl: null,
      hireDate: '2026-01-15',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([newEmp]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // 1. Create employee
    const createRes = await app.request('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-jwt-token',
      },
      body: JSON.stringify({
        name: 'Alice Developer',
        email: 'alice@collabee.local',
        position: 'Software Engineer',
      }),
    })

    expect(createRes.status).toBe(201)
    const createdData = await createRes.json()
    expect(createdData.id).toBe(42)

    // 2. Query paginated list
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ value: 1 }]),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([newEmp]),
          }),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const listRes = await app.request('/api/employees?page=1&limit=10', {
      headers: { Authorization: 'Bearer admin-jwt-token' },
    })

    expect(listRes.status).toBe(200)
    expect(listRes.headers.get('X-Total-Count')).toBe('1')
    expect(listRes.headers.get('X-Page')).toBe('1')
    const list = await listRes.json()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Alice Developer')
  })

  it('Flow 4: Attendance Clock-in Flow', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      id: 2,
      email: 'alice@collabee.local',
      name: 'Alice',
      role: 'user',
    })

    // Mock finding employee then checking existing attendance
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 42, email: 'alice@collabee.local', name: 'Alice' },
          ]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    // Mock check-in insertion
    const now = new Date().toISOString()
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 101,
            employeeId: 42,
            date: now.split('T')[0],
            checkIn: now,
            status: 'present',
          },
        ]),
      }),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const clockInRes = await app.request('/api/attendance/check-in', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-jwt-token' },
    })

    expect(clockInRes.status).toBe(201)
    const clockInData = await clockInRes.json()
    expect(clockInData.status).toBe('present')
    expect(clockInData.employeeId).toBe(42)
  })
})
