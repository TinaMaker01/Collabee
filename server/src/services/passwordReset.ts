import crypto from 'node:crypto'
import { logger } from '../utils/logger.js'

interface TokenData {
  email: string
  expiresAt: number
}

// In-memory token store with 1-hour expiration
const tokenStore = new Map<string, TokenData>()

export function createPasswordResetToken(email: string): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 60 * 60 * 1000 // 1 hour

  tokenStore.set(token, { email, expiresAt })
  return token
}

export function verifyAndConsumePasswordResetToken(token: string): string | null {
  const data = tokenStore.get(token)
  if (!data) return null

  if (Date.now() > data.expiresAt) {
    tokenStore.delete(token)
    return null
  }

  tokenStore.delete(token)
  return data.email
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = process.env.CLIENT_URL
    ? `${process.env.CLIENT_URL}/forgot-password?token=${token}`
    : `http://localhost:5173/forgot-password?token=${token}`

  logger.info({ email, resetUrl }, 'Password reset requested - link generated')
}
