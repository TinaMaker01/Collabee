export class AppError extends Error {
  public statusCode: number
  public code: string
  public details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, 'CONFLICT', message)
    this.name = 'ConflictError'
  }
}

/**
 * Pentest finding (Low): every call site that tried to detect a Postgres
 * unique/FK violation checked `err.code` / `err.constraint` directly, but
 * the `postgres` driver's real error — code, constraint_name, etc. — is
 * wrapped by Drizzle in `err.cause`, not present on the top-level error at
 * all. Neither property existed, so these checks silently never matched
 * and every such violation fell through to a generic 500 instead of a
 * 409/400. This unwraps `cause` and normalizes the Postgres driver's
 * snake_case `constraint_name` into `constraint` for callers.
 */
export function getPgErrorInfo(err: unknown): { code?: string; constraint?: string } {
  const top = err as { code?: string; constraint?: string; cause?: unknown }
  const cause = top?.cause as { code?: string; constraint_name?: string } | undefined
  return {
    code: top?.code ?? cause?.code,
    constraint: top?.constraint ?? cause?.constraint_name,
  }
}
