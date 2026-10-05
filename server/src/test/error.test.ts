import { describe, it, expect } from 'vitest'
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '../middleware/error.js'

describe('AppError', () => {
  it('should have correct status code and code', () => {
    const err = new AppError(400, 'BAD_REQUEST', 'Something went wrong')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('BAD_REQUEST')
    expect(err.message).toBe('Something went wrong')
    expect(err.name).toBe('AppError')
  })
})

describe('NotFoundError', () => {
  it('should have 404 status code', () => {
    const err = new NotFoundError()
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Resource not found')
  })

  it('should accept custom message', () => {
    const err = new NotFoundError('Employee not found')
    expect(err.message).toBe('Employee not found')
  })
})

describe('UnauthorizedError', () => {
  it('should have 401 status code', () => {
    const err = new UnauthorizedError()
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
  })
})

describe('ForbiddenError', () => {
  it('should have 403 status code', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
  })
})

describe('ValidationError', () => {
  it('should have 400 status code', () => {
    const err = new ValidationError()
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
  })
})

describe('ConflictError', () => {
  it('should have 409 status code', () => {
    const err = new ConflictError()
    expect(err.statusCode).toBe(409)
    expect(err.code).toBe('CONFLICT')
  })
})
