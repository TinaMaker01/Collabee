import NodeCache from 'node-cache'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { organizations } from '../db/schema.js'

const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG || 'collabee-hq'
const DEFAULT_ORG_NAME = 'Collabee HQ'

// Short-lived cache: the default organization almost never changes, but we
// still want a fresh lookup periodically rather than hardcoding an id.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 })
const CACHE_KEY = 'default-organization-id'

/**
 * Resolves the id of the default ("legacy"/single-tenant) organization,
 * creating it if it does not exist yet. This must never assume id === 1:
 * see migration 0005, which fixed the organizations id sequence after
 * migration 0004 inserted the default org with a hardcoded id.
 */
export async function getDefaultOrganizationId(): Promise<number> {
  const cached = cache.get<number>(CACHE_KEY)
  if (cached !== undefined) return cached

  const [existing] = await db.select().from(organizations).where(eq(organizations.slug, DEFAULT_ORG_SLUG))
  if (existing) {
    cache.set(CACHE_KEY, existing.id)
    return existing.id
  }

  const [created] = await db
    .insert(organizations)
    .values({ name: DEFAULT_ORG_NAME, slug: DEFAULT_ORG_SLUG })
    .onConflictDoNothing()
    .returning()

  if (created) {
    cache.set(CACHE_KEY, created.id)
    return created.id
  }

  // Lost a race with a concurrent creator: re-read instead of retrying blindly.
  const [row] = await db.select().from(organizations).where(eq(organizations.slug, DEFAULT_ORG_SLUG))
  if (!row) {
    throw new Error(`Failed to resolve or create default organization (slug: ${DEFAULT_ORG_SLUG})`)
  }
  cache.set(CACHE_KEY, row.id)
  return row.id
}
