import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(1, 'Password is required'),
})

export const departmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  managerId: z.number().optional(),
})

export const departmentUpdateSchema = departmentSchema.partial()

export const attendanceSchema = z.object({
  employeeId: z.number(),
  date: z.string(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(['present', 'absent', 'late', 'half-day']),
  notes: z.string().optional(),
})

export const attendanceUpdateSchema = attendanceSchema.partial()

export const leaveRequestSchema = z.object({
  employeeId: z.number(),
  type: z.enum(['annual', 'sick', 'personal', 'unpaid']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
})

export const leaveUpdateSchema = z.object({
  employeeId: z.number().optional(),
  type: z.enum(['annual', 'sick', 'personal', 'unpaid']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
})

export const taskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  assignedTo: z.number().optional(),
  departmentId: z.number().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  dueDate: z.string().optional(),
})

export const taskUpdateSchema = taskSchema.partial()

export const employeeSchema = z.object({
  name: z.string().min(1).max(255),
  position: z.string().max(255).optional(),
  email: z.string().email('Invalid email').max(255),
  phone: z.string().max(50).optional(),
  avatarUrl: z.string().optional(),
  departmentId: z.number().optional(),
  hireDate: z.string().optional(),
  salary: z.number().optional(), // Now a number (cents)
  status: z.string().max(50).optional().default('active'),
})

export const employeeUpdateSchema = employeeSchema.partial()

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

export const userProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().optional(),
})

export const documentSchema = z.object({
  employeeId: z.number(),
  title: z.string().min(1).max(255),
  url: z.string().url(),
  type: z.string().max(50).optional(),
})

export const documentUpdateSchema = documentSchema.partial()

export const userCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['user', 'manager', 'admin']).optional().default('user'),
})

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Invalid email').max(255).optional(),
  role: z.enum(['user', 'manager', 'admin']).optional(),
})

export const LEAVE_DEFAULTS = {
  annual: 20,
  sick: 10,
  personal: 5,
  unpaid: 0,
} as const
