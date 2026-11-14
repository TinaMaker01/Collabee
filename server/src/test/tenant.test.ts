import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}))

import { db } from '../db/index.js'
import { resolveOrganizationId, requireTenantId } from '../services/tenant.js'
import { AppError } from '../middleware/error.js'
import type { Context } from 'hono'

function makeContext(user: { id: number; organizationId?: number | null }, tenantId?: number) {
  const store: Record<string, unknown> = { user, ...(tenantId !== undefined ? { tenantId } : {}) }
  return {
    get: vi.fn((key: string) => store[key]),
    set: vi.fn((key: string, value: unknown) => {
      store[key] = value
    }),
  } as unknown as Context
}

describe('resolveOrganizationId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the org id from the JWT claim without hitting the DB', async () => {
    const result = await resolveOrganizationId({ id: 1, email: 'a@test.com', name: 'A', role: 'user', organizationId: 5 })
    expect(result).toBe(5)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('returns null from the claim when the user is explicitly org-less', async () => {
    const result = await resolveOrganizationId({ id: 1, email: 'a@test.com', name: 'A', role: 'user', organizationId: null })
    expect(result).toBe(null)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('falls back to a DB lookup when the claim is absent (legacy token)', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ organizationId: 7 }]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    const result = await resolveOrganizationId({ id: 2, email: 'b@test.com', name: 'B', role: 'user' })
    expect(result).toBe(7)
    expect(db.select).toHaveBeenCalledTimes(1)
  })
})

describe('requireTenantId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the already-resolved tenantId from context without re-resolving', async () => {
    const c = makeContext({ id: 1, organizationId: 5 }, 5)
    const result = await requireTenantId(c)
    expect(result).toBe(5)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('resolves and caches the tenantId when not yet set on context', async () => {
    const c = makeContext({ id: 1, organizationId: 9 })
    const result = await requireTenantId(c)
    expect(result).toBe(9)
    expect(c.set).toHaveBeenCalledWith('tenantId', 9)
  })

  it('throws ForbiddenError when the user has no organization', async () => {
    const c = makeContext({ id: 1, organizationId: null })
    await expect(requireTenantId(c)).rejects.toThrow(AppError)
  })
})
