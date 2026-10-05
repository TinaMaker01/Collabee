import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import authRoute from '../routes/auth.js'
import { registerSchema, loginSchema } from '../shared/schemas.js'
import { AppError } from '../middleware/error.js'
interface MockUser {
  id: number
  name: string
  email: string
  role: string
  passwordHash: string
  avatarUrl: string | null
  createdAt: Date | null
  updatedAt: Date | null
}

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../services/auth.js', () => ({
  createUser: vi.fn(),
  authenticateUser: vi.fn(),
  generateToken: vi.fn(),
  getUserById: vi.fn(),
  verifyToken: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

import { createUser, authenticateUser, generateToken, getUserById, verifyToken } from '../services/auth.js'

describe('registerSchema', () => {
  it('should validate register with valid data', () => {
    const result = registerSchema.safeParse({ name: 'John', email: 'john@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('should reject register with invalid email', () => {
    const result = registerSchema.safeParse({ name: 'John', email: 'bad', password: 'password123' })
    expect(result.success).toBe(false)
  })

  it('should reject register with short password', () => {
    const result = registerSchema.safeParse({ name: 'John', email: 'john@example.com', password: '12345' })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('should validate login with valid data', () => {
    const result = loginSchema.safeParse({ email: 'john@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('should reject login with invalid email', () => {
    const result = loginSchema.safeParse({ email: 'bad', password: 'password123' })
    expect(result.success).toBe(false)
  })
})

describe('Auth routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.onError((err, c) => {
      if (err instanceof AppError) {
        c.status(err.statusCode as 400 | 401 | 403 | 404 | 409 | 500)
        return c.json({ error: { code: err.code, message: err.message, details: err.details } })
      }
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
    })
    app.route('/api/auth', authRoute)
  })

  it('POST /api/auth/register with valid data should return 201', async () => {
    const mockUser: MockUser = {
      id: 1,
      name: 'John',
      email: 'john@example.com',
      role: 'user',
      passwordHash: '',
      avatarUrl: null,
      createdAt: null,
      updatedAt: null,
    }
    vi.mocked(createUser).mockResolvedValue(mockUser)
    vi.mocked(generateToken).mockResolvedValue('mock-token')

    const res = await app.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', email: 'john@example.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.token).toBe('mock-token')
    expect(data.user.email).toBe('john@example.com')
  })

  it('POST /api/auth/register with duplicate email should return 409', async () => {
    vi.mocked(createUser).mockRejectedValue({ constraint: 'users_email_unique', code: '23505' } as never)

    const res = await app.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', email: 'existing@example.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(409)
  })

  it('POST /api/auth/login with valid credentials should return 200', async () => {
    const mockUser: MockUser = {
      id: 1,
      name: 'John',
      email: 'john@example.com',
      role: 'user',
      passwordHash: '',
      avatarUrl: null,
      createdAt: null,
      updatedAt: null,
    }
    vi.mocked(authenticateUser).mockResolvedValue(mockUser)
    vi.mocked(generateToken).mockResolvedValue('mock-token')

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'john@example.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.token).toBe('mock-token')
  })

  it('POST /api/auth/login with invalid password should return 401', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(null)

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'john@example.com', password: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me without token should return 401', async () => {
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me with valid token should return user data', async () => {
    const mockUser: MockUser = {
      id: 1,
      name: 'John',
      email: 'john@example.com',
      role: 'user',
      passwordHash: '',
      avatarUrl: null,
      createdAt: null,
      updatedAt: null,
    }
    vi.mocked(getUserById).mockResolvedValue(mockUser)
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'john@example.com', name: 'John', role: 'user' })

    const res = await app.request('/api/auth/me', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(200)
  })
})
