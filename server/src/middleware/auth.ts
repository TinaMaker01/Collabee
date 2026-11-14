import { Context, Next } from 'hono'
import { verifyToken, UserPayload } from '../services/auth.js'
import { UnauthorizedError, ForbiddenError } from './error.js'

export async function protectRoute(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  const queryToken = c.req.query('token')
  let token: string | undefined

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else if (queryToken) {
    token = queryToken
  }

  if (!token) {
    throw new UnauthorizedError('Unauthorized')
  }

  const user = await verifyToken(token)
  if (!user) {
    throw new UnauthorizedError('Invalid or expired token')
  }

  c.set('user', user)
  // Cheap, synchronous fast path: if the token already carries the org
  // claim, seed tenantId now so route handlers can skip the DB-fallback
  // lookup in services/tenant.ts#requireTenantId for freshly issued tokens.
  if (user.organizationId != null) {
    c.set('tenantId', user.organizationId)
  }
  await next()
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user: UserPayload | undefined = c.get('user')
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenError('Forbidden')
    }
    await next()
  }
}
