import NodeCache from 'node-cache'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { ForbiddenError } from '../middleware/error.js'
import type { UserPayload } from './auth.js'
import type { Context } from 'hono'

// Short TTL fallback cache keyed by user id, used only when a token predates
// the `org` JWT claim. Removed in phase 5 once the claim is required.
const orgLookupCache = new NodeCache({ stdTTL: 60, checkperiod: 120 })

/**
 * Resolves a user's organization id: prefers the JWT claim (no DB hit) and
 * falls back to a cached DB lookup for tokens issued before the claim
 * existed. Returns null if the user genuinely has no organization.
 */
export async function resolveOrganizationId(user: UserPayload): Promise<number | null> {
  if (user.organizationId !== undefined) {
    return user.organizationId
  }

  const cacheKey = `user:${user.id}`
  const cached = orgLookupCache.get<number | null>(cacheKey)
  if (cached !== undefined) return cached

  const [row] = await db.select({ organizationId: users.organizationId }).from(users).where(eq(users.id, user.id))
  const organizationId = row?.organizationId ?? null
  orgLookupCache.set(cacheKey, organizationId)
  return organizationId
}

/**
 * Resolves and caches the current request's tenant id on the Hono context,
 * throwing ForbiddenError if the authenticated user has no organization.
 * Call this from route handlers once they are ready to enforce tenant
 * scoping (phase 4) — it is intentionally not wired into protectRoute.
 */
export async function requireTenantId(c: Context): Promise<number> {
  const existing = c.get('tenantId')
  if (existing != null) return existing

  const user: UserPayload = c.get('user')
  const organizationId = await resolveOrganizationId(user)
  if (organizationId == null) {
    throw new ForbiddenError('NO_ORGANIZATION')
  }

  c.set('tenantId', organizationId)
  return organizationId
}
