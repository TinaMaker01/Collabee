import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import documentsRoute from '../routes/documents.js'
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

describe('Documents routes, upload & security', () => {
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
    app.route('/api/documents', documentsRoute)
  })

  it('GET /api/documents should return documents list', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@collabee.com', name: 'Admin', role: 'admin' })
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([
        { id: 1, employeeId: 2, title: 'Contract', url: 'https://example.com/contract.pdf', type: 'contract' },
      ]),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/api/documents', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].title).toBe('Contract')
  })

  it('POST /api/documents/upload should upload a valid file and return URL', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@collabee.com', name: 'Admin', role: 'admin' })

    const formData = new FormData()
    const file = new File(['dummy pdf content'], 'test-contract.pdf', { type: 'application/pdf' })
    formData.append('file', file)

    const res = await app.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.url).toMatch(/^\/api\/documents\/file\/[a-f0-9-]+.pdf$/)
    expect(data.filename).toBe('test-contract.pdf')

    // Test downloading the uploaded file
    const downloadRes = await app.request(data.url, {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(downloadRes.status).toBe(200)
    expect(downloadRes.headers.get('content-type')).toBe('application/pdf')
  })

  it('POST /api/documents/upload should reject unsupported file extensions', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ id: 1, email: 'admin@collabee.com', name: 'Admin', role: 'admin' })

    const formData = new FormData()
    const file = new File(['malicious'], 'script.exe', { type: 'application/x-msdownload' })
    formData.append('file', file)

    const res = await app.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })
})
