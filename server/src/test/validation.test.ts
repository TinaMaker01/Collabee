import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  loginSchema,
  departmentSchema,
  attendanceSchema,
  leaveRequestSchema,
  taskSchema,
  employeeUpdateSchema,
} from '../shared/schemas.js'

describe('registerSchema', () => {
  it('should accept valid data', () => {
    const result = registerSchema.safeParse({ name: 'John', email: 'john@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = registerSchema.safeParse({ name: 'John', email: 'not-an-email', password: 'password123' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email')
    }
  })

  it('should reject name exceeding 255 chars', () => {
    const result = registerSchema.safeParse({
      name: 'a'.repeat(256),
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing name', () => {
    const result = registerSchema.safeParse({ email: 'john@example.com', password: 'password123' })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('should accept valid data', () => {
    const result = loginSchema.safeParse({ email: 'john@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({ email: 'invalid', password: 'password123' })
    expect(result.success).toBe(false)
  })
})

describe('departmentSchema', () => {
  it('should accept valid data', () => {
    const result = departmentSchema.safeParse({ name: 'Engineering' })
    expect(result.success).toBe(true)
  })

  it('should reject name exceeding 255 chars', () => {
    const result = departmentSchema.safeParse({ name: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })
})

describe('employeeUpdateSchema', () => {
  it('should accept valid data', () => {
    const result = employeeUpdateSchema.safeParse({ name: 'John', email: 'john@example.com' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = employeeUpdateSchema.safeParse({ email: 'bad' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email')
    }
  })

  it('should reject email exceeding 255 chars', () => {
    const result = employeeUpdateSchema.safeParse({ email: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })

  it('should reject phone exceeding 50 chars', () => {
    const result = employeeUpdateSchema.safeParse({ phone: 'a'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('should reject salary exceeding 50 chars', () => {
    const result = employeeUpdateSchema.safeParse({ salary: 'a'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('should reject status exceeding 50 chars', () => {
    const result = employeeUpdateSchema.safeParse({ status: 'a'.repeat(51) })
    expect(result.success).toBe(false)
  })
})

describe('attendanceSchema', () => {
  it('should accept valid data', () => {
    const result = attendanceSchema.safeParse({ employeeId: 1, date: '2024-01-01', status: 'present' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid status', () => {
    const result = attendanceSchema.safeParse({ employeeId: 1, date: '2024-01-01', status: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('leaveRequestSchema', () => {
  it('should accept valid data', () => {
    const result = leaveRequestSchema.safeParse({
      employeeId: 1,
      type: 'annual',
      startDate: '2024-01-01',
      endDate: '2024-01-05',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid type', () => {
    const result = leaveRequestSchema.safeParse({
      employeeId: 1,
      type: 'invalid',
      startDate: '2024-01-01',
      endDate: '2024-01-05',
    })
    expect(result.success).toBe(false)
  })
})

describe('taskSchema', () => {
  it('should accept valid data', () => {
    const result = taskSchema.safeParse({ title: 'Fix bug' })
    expect(result.success).toBe(true)
  })

  it('should reject title exceeding 255 chars', () => {
    const result = taskSchema.safeParse({ title: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })
})
