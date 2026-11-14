import { describe, it, expect } from 'vitest'
import { revokeUserTokensIssuedBefore, isTokenRevoked } from '../services/revocation.js'

describe('revocation', () => {
  it('does not flag a token for a user who was never revoked', () => {
    expect(isTokenRevoked(999001, Math.floor(Date.now() / 1000))).toBe(false)
  })

  it('flags a token issued before the revocation as revoked', () => {
    const userId = 999002
    const beforeRevocation = Math.floor(Date.now() / 1000) - 10
    revokeUserTokensIssuedBefore(userId)
    expect(isTokenRevoked(userId, beforeRevocation)).toBe(true)
  })

  it('does not flag a token issued after the revocation (fresh login works)', () => {
    const userId = 999003
    revokeUserTokensIssuedBefore(userId)
    const afterRevocation = Math.floor(Date.now() / 1000) + 10
    expect(isTokenRevoked(userId, afterRevocation)).toBe(false)
  })

  it('treats a token with no iat as revoked once any revocation is recorded', () => {
    const userId = 999004
    revokeUserTokensIssuedBefore(userId)
    expect(isTokenRevoked(userId, undefined)).toBe(true)
  })
})
