import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { compareSync, hashSync } from 'bcryptjs'
import { protectRoute } from '../middleware/auth.js'
import { registerSchema, loginSchema, userProfileSchema, passwordChangeSchema } from '../shared/schemas.js'
import { createUser, authenticateUser, generateToken, getUserById } from '../services/auth.js'
import { ConflictError, NotFoundError, UnauthorizedError } from '../middleware/error.js'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const validateRegister = zValidator('json', registerSchema)
const validateLogin = zValidator('json', loginSchema)
const validateProfile = zValidator('json', userProfileSchema)

const authRoute = new Hono()

authRoute.post('/register', validateRegister, async (c) => {
  const { name, email, password } = c.req.valid('json')

  try {
    const user = await createUser(name, email, password)
    const token = await generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
    return c.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token }, 201)
  } catch (err: unknown) {
    const pgErr = err as { constraint?: string; code?: string }
    if (pgErr.constraint === 'users_email_unique' || pgErr.code === '23505') {
      throw new ConflictError('Email already in use')
    }
    throw err
  }
})

authRoute.post('/login', validateLogin, async (c) => {
  const { email, password } = c.req.valid('json')
  const user = await authenticateUser(email, password)
  if (!user) {
    throw new UnauthorizedError('Invalid email or password')
  }
  const token = await generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
  return c.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token })
})

authRoute.get('/me', protectRoute, async (c) => {
  const user = c.get('user')
  const fullUser = await getUserById(user.id)
  if (!fullUser) {
    throw new NotFoundError('User not found')
  }
  return c.json({
    id: fullUser.id,
    name: fullUser.name,
    email: fullUser.email,
    role: fullUser.role,
    avatarUrl: fullUser.avatarUrl,
  })
})

authRoute.put('/profile', protectRoute, validateProfile, async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const [updated] = await db
    .update(users)
    .set({
      name: body.name,
      avatarUrl: body.avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning()

  if (!updated) throw new NotFoundError('User not found')
  return c.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    avatarUrl: updated.avatarUrl,
  })
})

authRoute.post('/logout', protectRoute, async (c) => {
  return c.json({ message: 'Logged out successfully' })
})

authRoute.put('/password', protectRoute, zValidator('json', passwordChangeSchema), async (c) => {
  const { currentPassword, newPassword } = c.req.valid('json')
  const user = c.get('user')
  const fullUser = await getUserById(user.id)
  if (!fullUser) throw new NotFoundError('User not found')

  const valid = compareSync(currentPassword, fullUser.passwordHash)
  if (!valid) throw new UnauthorizedError('Current password is incorrect')

  const newHash = hashSync(newPassword, 12)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id))
  return c.json({ message: 'Password updated' })
})

export default authRoute
