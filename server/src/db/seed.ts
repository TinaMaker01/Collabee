import { db } from './index.js'
import { users, departments, employees, attendance, leaveRequests, tasks, notifications } from './schema.js'
import { hashPassword } from '../services/auth.js'
import { logger } from '../utils/logger.js'

export async function seed() {
  const existingUsers = await db.select().from(users).limit(1)
  if (existingUsers.length > 0) {
    logger.info('Data already seeded, skipping.')
    return
  }

  logger.info('Seeding data...')

  const passwordHash = await hashPassword('password123')

  const [admin, manager, user] = await db
    .insert(users)
    .values([
      { name: 'Admin', email: 'admin@collabee.com', passwordHash, role: 'admin' },
      { name: 'Manager', email: 'manager@collabee.com', passwordHash, role: 'manager' },
      { name: 'Regular User', email: 'user@collabee.com', passwordHash, role: 'user' },
    ])
    .returning()

  const deptData = await db
    .insert(departments)
    .values([
      { name: 'Engineering', description: 'Software development and infrastructure' },
      { name: 'Human Resources', description: 'People operations and culture' },
      { name: 'Sales', description: 'Revenue and customer acquisition' },
      { name: 'Marketing', description: 'Brand and communications' },
      { name: 'Finance', description: 'Financial planning and accounting' },
    ])
    .returning()

  const [eng, hr, sales, marketing, finance] = deptData

  const empData = await db
    .insert(employees)
    .values([
      {
        name: 'Alice Dupont',
        position: 'Lead Developer',
        email: 'alice@collabee.com',
        departmentId: eng.id,
        hireDate: new Date('2023-01-15'),
        salary: 7500000,
        status: 'active',
        isDummy: true,
      },
      {
        name: 'Bob Martin',
        position: 'Developer',
        email: 'bob@collabee.com',
        departmentId: eng.id,
        hireDate: new Date('2023-06-01'),
        salary: 5500000,
        status: 'active',
        isDummy: true,
      },
      {
        name: 'Claire Fontaine',
        position: 'HR Manager',
        email: 'claire@collabee.com',
        departmentId: hr.id,
        hireDate: new Date('2022-09-01'),
        salary: 6500000,
        status: 'active',
        isDummy: true,
      },
      {
        name: 'David Chen',
        position: 'Sales Representative',
        email: 'david@collabee.com',
        departmentId: sales.id,
        hireDate: new Date('2024-01-10'),
        salary: 5000000,
        status: 'active',
        isDummy: true,
      },
      {
        name: 'Emma Wilson',
        position: 'Marketing Specialist',
        email: 'emma@collabee.com',
        departmentId: marketing.id,
        hireDate: new Date('2023-11-01'),
        salary: 5200000,
        status: 'active',
        isDummy: true,
      },
      {
        name: 'Francois Leroy',
        position: 'Accountant',
        email: 'francois@collabee.com',
        departmentId: finance.id,
        hireDate: new Date('2024-02-15'),
        salary: 4800000,
        status: 'active',
        isDummy: true,
      },
    ])
    .returning()

  const [alice, bob, claire, david, emma, francois] = empData

  const today = new Date()
  const dayMs = 24 * 60 * 60 * 1000

  const yesterday = new Date(today.getTime() - dayMs)
  const makeTime = (hours: number, minutes: number) =>
    new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hours, minutes)

  await db.insert(attendance).values([
    { employeeId: alice.id, date: yesterday, checkIn: makeTime(8, 30), checkOut: makeTime(17, 30), status: 'present' },
    { employeeId: bob.id, date: yesterday, checkIn: makeTime(9, 0), checkOut: makeTime(18, 0), status: 'present' },
    { employeeId: claire.id, date: yesterday, checkIn: makeTime(8, 45), checkOut: makeTime(17, 0), status: 'present' },
    { employeeId: david.id, date: yesterday, checkIn: makeTime(9, 15), checkOut: makeTime(17, 45), status: 'late' },
    { employeeId: emma.id, date: yesterday, status: 'absent' },
    {
      employeeId: francois.id,
      date: yesterday,
      checkIn: makeTime(8, 0),
      checkOut: makeTime(16, 30),
      status: 'present',
    },
  ])

  await db.insert(leaveRequests).values([
    {
      employeeId: bob.id,
      type: 'annual',
      startDate: new Date(today.getTime() + 7 * dayMs),
      endDate: new Date(today.getTime() + 11 * dayMs),
      reason: "Vacances d'été",
      status: 'pending',
    },
    {
      employeeId: emma.id,
      type: 'sick',
      startDate: new Date(today.getTime() - 3 * dayMs),
      endDate: new Date(today.getTime() - dayMs),
      reason: 'Maladie',
      status: 'approved',
      approvedBy: admin.id,
    },
    {
      employeeId: francois.id,
      type: 'personal',
      startDate: new Date(today.getTime() + 14 * dayMs),
      endDate: new Date(today.getTime() + 14 * dayMs),
      reason: 'Rendez-vous personnel',
      status: 'pending',
    },
    {
      employeeId: alice.id,
      type: 'annual',
      startDate: new Date(today.getTime() - 10 * dayMs),
      endDate: new Date(today.getTime() - 6 * dayMs),
      reason: 'Congés annuels',
      status: 'approved',
      approvedBy: admin.id,
    },
    {
      employeeId: david.id,
      type: 'unpaid',
      startDate: new Date(today.getTime() + 21 * dayMs),
      endDate: new Date(today.getTime() + 25 * dayMs),
      reason: 'Congé sans solde',
      status: 'rejected',
      approvedBy: admin.id,
    },
  ])

  await db.insert(tasks).values([
    {
      title: 'Implement API authentication',
      description: 'Add JWT-based auth to all endpoints',
      assignedTo: alice.id,
      createdBy: admin.id,
      departmentId: eng.id,
      status: 'done',
      priority: 'high',
      dueDate: new Date(today.getTime() - 5 * dayMs),
    },
    {
      title: 'Design dashboard page',
      description: 'Create wireframes for the main dashboard',
      assignedTo: emma.id,
      createdBy: admin.id,
      departmentId: marketing.id,
      status: 'in_progress',
      priority: 'medium',
      dueDate: new Date(today.getTime() + 5 * dayMs),
    },
    {
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions for automated builds',
      assignedTo: bob.id,
      createdBy: admin.id,
      departmentId: eng.id,
      status: 'todo',
      priority: 'medium',
      dueDate: new Date(today.getTime() + 10 * dayMs),
    },
    {
      title: 'Review Q1 budget',
      description: 'Analyze Q1 financial reports',
      assignedTo: francois.id,
      createdBy: admin.id,
      departmentId: finance.id,
      status: 'todo',
      priority: 'urgent',
      dueDate: new Date(today.getTime() + 3 * dayMs),
    },
    {
      title: 'Prepare sales presentation',
      description: 'Create deck for prospect meeting',
      assignedTo: david.id,
      createdBy: admin.id,
      departmentId: sales.id,
      status: 'blocked',
      priority: 'high',
      dueDate: new Date(today.getTime() + 2 * dayMs),
    },
    {
      title: 'Update employee handbook',
      description: 'Revise HR policies for 2025',
      assignedTo: claire.id,
      createdBy: admin.id,
      departmentId: hr.id,
      status: 'in_progress',
      priority: 'low',
      dueDate: new Date(today.getTime() + 15 * dayMs),
    },
  ])

  await db.insert(notifications).values([
    {
      userId: admin.id,
      title: 'Welcome',
      message: 'Welcome to Collabee! Start managing your HR operations.',
      type: 'info',
      read: false,
    },
    {
      userId: admin.id,
      title: 'Pending Leaves',
      message: 'There are leave requests awaiting your approval.',
      type: 'warning',
      read: false,
    },
    { userId: manager.id, title: 'Welcome', message: 'Welcome to Collabee!', type: 'info', read: false },
    {
      userId: manager.id,
      title: 'Pending Leaves',
      message: 'Review pending leave requests',
      type: 'warning',
      read: false,
    },
    { userId: user.id, title: 'Welcome', message: 'Welcome to Collabee!', type: 'info', read: false },
  ])

  logger.info('Seed complete.')
}
