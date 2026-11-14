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
// Two independent mechanisms, for two different needs:
// - revokeUserTokensIssuedBefore / the per-user cutoff: a *bulk*
//   invalidation for events where every session this user holds must
//   die (their identity/permissions changed): deletion, role change,
//   password change.
// - revokeToken / the per-session jti set: a *single-session*
//   invalidation for a plain logout, which should end only the
//   session the caller is logging out of, not every device/tab the
//   user happens to be logged in on elsewhere.
//
// TTL exceeds the max token lifetime (24h) so entries are never needed
// longer than a token could possibly still be valid, and neither cache
// grows unbounded.
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24
const CACHE_TTL_SECONDS = TOKEN_LIFETIME_SECONDS + 60 * 60
const revokedBefore = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 300 })
const revokedJti = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 300 })

/**
 * Marks every token issued to this user before now as invalid. Call this
 * whenever a user's credentials or access materially change: deletion,
 * role change, password change.
 */
export function revokeUserTokensIssuedBefore(userId: number): void {
  revokedBefore.set(String(userId), Math.floor(Date.now() / 1000))
}

/**
 * Marks one specific token (by its jti claim) as invalid, without
 * affecting any other session the same user holds. Call this on a
 * plain, single-session logout.
 */
export function revokeToken(jti: string): void {
  revokedJti.set(jti, true)
}

/**
 * True if this specific token was individually revoked (logout), or if
 * it was issued at or before the user's most recent bulk revocation
 * (deletion/role/password change). A token with no iat (issued before
 * that field existed) is treated as revoked once any bulk revocation
 * has been recorded for that user, since there's no way to know it
 * postdates the revocation. A token with no jti simply can't be
 * individually revoked by logout — it's still covered by the bulk
 * check.
 */
export function isTokenRevoked(userId: number, iat: number | undefined, jti: string | undefined): boolean {
  if (jti !== undefined && revokedJti.has(jti)) return true

  const cutoff = revokedBefore.get<number>(String(userId))
  if (cutoff === undefined) return false
  if (iat === undefined) return true
  return iat <= cutoff
}
