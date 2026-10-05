import { Context, Next } from 'hono'
import { verifyToken, UserPayload } from '../services/auth.js'
import { UnauthorizedError, ForbiddenError } from './error.js'

export async function protectRoute(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Unauthorized')
  }

  const token = authHeader.slice(7)
  const user = await verifyToken(token)
  if (!user) {
    throw new UnauthorizedError('Invalid or expired token')
  }

  c.set('user', user)
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
