import { describe, it, expect } from 'vitest'
import { revokeUserTokensIssuedBefore, revokeToken, isTokenRevoked } from '../services/revocation.js'

describe('revocation (bulk, per-user cutoff)', () => {
  it('does not flag a token for a user who was never revoked', () => {
    expect(isTokenRevoked(999001, Math.floor(Date.now() / 1000), 'jti-1')).toBe(false)
  })

  it('flags a token issued before the revocation as revoked', () => {
    const userId = 999002
    const beforeRevocation = Math.floor(Date.now() / 1000) - 10
    revokeUserTokensIssuedBefore(userId)
    expect(isTokenRevoked(userId, beforeRevocation, 'jti-2')).toBe(true)
  })

  it('does not flag a token issued after the revocation (fresh login works)', () => {
    const userId = 999003
    revokeUserTokensIssuedBefore(userId)
    const afterRevocation = Math.floor(Date.now() / 1000) + 10
    expect(isTokenRevoked(userId, afterRevocation, 'jti-3')).toBe(false)
  })

  it('treats a token with no iat as revoked once any revocation is recorded', () => {
    const userId = 999004
    revokeUserTokensIssuedBefore(userId)
    expect(isTokenRevoked(userId, undefined, 'jti-4')).toBe(true)
  })
})

describe('revocation (per-session jti)', () => {
  it('does not flag a token whose jti was never revoked', () => {
    expect(isTokenRevoked(999005, Math.floor(Date.now() / 1000), 'jti-untouched')).toBe(false)
  })

  it('flags only the revoked jti, not other tokens for the same user', () => {
    const userId = 999006
    const now = Math.floor(Date.now() / 1000)
    revokeToken('jti-logged-out')
    expect(isTokenRevoked(userId, now, 'jti-logged-out')).toBe(true)
    expect(isTokenRevoked(userId, now, 'jti-still-active')).toBe(false)
  })

  it('does not flag a token with no jti just because another token was revoked', () => {
    const userId = 999007
    revokeToken('jti-irrelevant')
    expect(isTokenRevoked(userId, Math.floor(Date.now() / 1000), undefined)).toBe(false)
  })
})
