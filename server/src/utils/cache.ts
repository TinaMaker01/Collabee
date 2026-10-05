import NodeCache from 'node-cache'
import type { Context } from 'hono'

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

const CACHE_TTL = parseEnvInt(process.env.CACHE_TTL, 300)

export const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 60 })

export function getCacheKey(c: Context): string {
  const url = new URL(c.req.url)
  const user = c.get('user') as { id?: number; role?: string } | undefined
  const userSuffix = user ? `:${user.role}:${user.id}` : ''
  return url.pathname + url.search + userSuffix
}

export async function withCache<T>(c: Context, fetchData: () => Promise<T>, ttl?: number): Promise<T> {
  const key = getCacheKey(c)
  const cached = cache.get<T>(key)
  if (cached !== undefined) return cached
  const data = await fetchData()
  cache.set(key, data, ttl ?? CACHE_TTL)
  return data
}

export function invalidateCache(prefix: string): void {
  const keys = cache.keys().filter((k) => k === prefix || k.startsWith(prefix + '?') || k.startsWith(prefix + ':'))
  if (keys.length > 0) {
    cache.del(keys)
  }
}
