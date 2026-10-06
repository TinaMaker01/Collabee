import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { protectRoute } from '../middleware/auth.js'
import {
  registerSchema,
  loginSchema,
  userProfileSchema,
  passwordChangeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../shared/schemas.js'
import {
  createUser,
  authenticateUser,
  generateToken,
  getUserById,
  verifyPassword,
  hashPassword,
} from '../services/auth.js'
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../middleware/error.js'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { logActivity } from '../utils/activityLogger.js'
import {
  createPasswordResetToken,
  verifyAndConsumePasswordResetToken,
  sendPasswordResetEmail,
} from '../services/passwordReset.js'

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
    await logActivity(user.id, 'create', 'user', user.id, 'User self-registered')
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

authRoute.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json')

  const [existingUser] = await db.select().from(users).where(eq(users.email, email))
  if (existingUser) {
    const token = createPasswordResetToken(email)
    await sendPasswordResetEmail(email, token)
    await logActivity(existingUser.id, 'request', 'password_reset', existingUser.id, 'Password reset requested')
  }

  // Always return identical success message to prevent user enumeration
  return c.json({
    message: 'If an account exists with this email, a password reset link has been sent.',
  })
})

authRoute.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const { token, newPassword } = c.req.valid('json')

  const email = verifyAndConsumePasswordResetToken(token)
  if (!email) {
    throw new ValidationError('Invalid or expired password reset token')
  }

  const [targetUser] = await db.select().from(users).where(eq(users.email, email))
  if (!targetUser) {
    throw new NotFoundError('User not found')
  }

  const newHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, targetUser.id))
  await logActivity(targetUser.id, 'update', 'password', targetUser.id, 'Password reset successfully')

  return c.json({ message: 'Password has been reset successfully' })
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
  await logActivity(user.id, 'update', 'user', user.id, 'Profile updated')
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

  const valid = await verifyPassword(currentPassword, fullUser.passwordHash)
  if (!valid) throw new UnauthorizedError('Current password is incorrect')

  const newHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id))
  await logActivity(user.id, 'update', 'password', user.id, 'Password changed')
  return c.json({ message: 'Password updated' })
})

export default authRoute
