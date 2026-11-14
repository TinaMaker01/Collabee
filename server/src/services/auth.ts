import { sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

// Pentest finding (Medium): the shipped .env used a well-known placeholder
// value. An attacker who reads a committed/leaked .env.example or guesses a
// common placeholder can forge any claim (role, org) the server will
// accept. Fail fast at startup rather than silently accepting a weak or
// default secret in any environment.
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'secret',
  'changeme',
  'change-me',
  'change-this',
  'password',
  'dev-secret-change-in-production',
  'change-me-to-a-random-secret',
  'your-secret-here',
  'your-jwt-secret',
  'jwt-secret',
])
const MIN_SECRET_LENGTH = 32

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set a strong random secret in production.')
}
if (KNOWN_PLACEHOLDER_SECRETS.has(JWT_SECRET.toLowerCase()) || JWT_SECRET.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `JWT_SECRET is too weak or a known placeholder value (must be a random string of at least ${MIN_SECRET_LENGTH} characters). ` +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  )
}
const SALT_ROUNDS = 12

export type UserPayload = {
  id: number
  email: string
  name: string
  role: string
  // Optional for backward compatibility: tokens issued before this field
  // existed (up to 24h old) won't carry it, and verifyToken must still
  // accept them. See middleware/auth.ts and services/tenant.ts.
  organizationId?: number | null
  // When the token was issued (unix seconds). Used by services/revocation.ts
  // to reject tokens issued before a user's deletion/role-change/password-
  // change, without needing a server-side session store. Optional for the
  // same backward-compatibility reason as organizationId.
  iat?: number
  // Unique per-token id (JWT ID). Lets services/revocation.ts invalidate
  // one specific session (plain logout) without affecting any other
  // session the same user holds elsewhere. Optional for the same
  // backward-compatibility reason as organizationId/iat.
  jti?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createUser(name: string, email: string, password: string, organizationId: number) {
  const passwordHash = await hashPassword(password)
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role: 'user',
      organizationId,
    })
    .returning()
  return user
}

export async function authenticateUser(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return user
}

export async function generateToken(user: UserPayload): Promise<string> {
  return sign(
    {
      sub: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      // `org` is intentionally allowed to be null (org-less legacy users),
      // but always present on freshly issued tokens from here on.
      org: user.organizationId ?? null,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    },
    JWT_SECRET!,
  )
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const payload = (await verify(token, JWT_SECRET!, 'HS256')) as {
      sub?: string
      email?: string
      name?: string
      role?: string
      org?: number | null
      iat?: number
      jti?: string
      exp?: number
    }
    if (!payload.sub || !payload.email || !payload.name || !payload.role) return null
    return {
      id: parseInt(payload.sub),
      email: payload.email,
      name: payload.name,
      role: payload.role,
      // Tokens issued before this claim existed simply won't have `org`;
      // treat that the same as an explicit null rather than rejecting them.
      organizationId: payload.org ?? null,
      iat: payload.iat,
      jti: payload.jti,
    }
  } catch {
    return null
  }
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user || null
}
