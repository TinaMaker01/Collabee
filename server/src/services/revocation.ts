import NodeCache from 'node-cache'

// Pentest finding (Medium): deleting a user, changing their role, or
// changing their password had no effect on tokens already issued to
// them — the JWT is stateless, so the old token kept working for up to
// its full 24h lifetime. This is a lightweight in-memory revocation
// list: no DB column, no extra query on the hot path for users who were
// never revoked (the common case), single-process only (matches every
// other in-memory cache already in this codebase — see utils/cache.ts,
// services/tenant.ts, services/notificationEvents.ts).
//
// TTL exceeds the max token lifetime (24h) so entries are never needed
// longer than a token could possibly still be valid, and the cache
// never grows unbounded.
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24
const revokedBefore = new NodeCache({ stdTTL: TOKEN_LIFETIME_SECONDS + 60 * 60, checkperiod: 300 })

/**
 * Marks every token issued to this user before now as invalid. Call this
 * whenever a user's credentials or access materially change: deletion,
 * role change, password change.
 */
export function revokeUserTokensIssuedBefore(userId: number): void {
  revokedBefore.set(String(userId), Math.floor(Date.now() / 1000))
}

/**
 * True if a token with this iat (issued-at, unix seconds) for this user
 * was issued before the user's most recent revocation. A token with no
 * iat (issued before this field existed) is treated as revoked once any
 * revocation has been recorded for that user, since there's no way to
 * know it postdates the revocation.
 */
export function isTokenRevoked(userId: number, iat: number | undefined): boolean {
  const cutoff = revokedBefore.get<number>(String(userId))
  if (cutoff === undefined) return false
  if (iat === undefined) return true
  return iat <= cutoff
}
