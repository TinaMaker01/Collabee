import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  varchar,
  integer,
  foreignKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

/**
 * Organizations table supporting multi-tenant workspace isolation.
 */
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  domain: varchar('domain', { length: 255 }),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

export const organizationsRelations = relations(organizations, ({ many }) => ({
  departments: many(departments),
  users: many(users),
}))

/**
 * System users with authentication credentials and role-based access control.
 * Roles: user, manager, admin.
 * Each user can create tasks and receive notifications.
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  avatarUrl: text('avatar_url'),
  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  leaveRequests: many(leaveRequests),
  tasks: many(tasks),
  notifications: many(notifications),
}))

/**
 * Organizational departments that group employees.
 * Each department can have a manager assigned from the users table.
 */
export const departments = pgTable(
  'departments',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    managerId: integer('manager_id'),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('departments_name_idx').on(table.name),
    // Replaces the old global-unique name constraint: department names only
    // need to be unique within an organization (see migration 0006).
    organizationNameUniqueIdx: uniqueIndex('departments_organization_name_unique_idx').on(
      table.organizationId,
      table.name,
    ),
  }),
)

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.organizationId],
    references: [organizations.id],
  }),
  employees: many(employees),
  tasks: many(tasks),
}))

/**
 * Employees belonging to departments, with contact and employment details.
 * Tracks status (active/inactive) and distinguishes real vs dummy records.
 */
export const employees = pgTable(
  'employees',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    position: varchar('position', { length: 255 }),
    email: varchar('email', { length: 255 }).unique().notNull(),
    phone: varchar('phone', { length: 50 }),
    avatarUrl: text('avatar_url'),
    departmentId: integer('department_id'),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    hireDate: timestamp('hire_date'),
    salary: integer('salary'),
    status: varchar('status', { length: 50 }).default('active'),
    isDummy: boolean('is_dummy').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    departmentFk: foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    nameIdx: index('employees_name_idx').on(table.name),
    positionIdx: index('employees_position_idx').on(table.position),
    departmentIdIdx: index('employees_department_id_idx').on(table.departmentId),
    statusIdx: index('employees_status_idx').on(table.status),
    departmentStatusIdx: index('employees_department_status_idx').on(table.departmentId, table.status),
    organizationStatusIdx: index('employees_organization_status_idx').on(table.organizationId, table.status),
    organizationDepartmentIdx: index('employees_organization_department_idx').on(
      table.organizationId,
      table.departmentId,
    ),
  }),
)

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  attendance: many(attendance),
  leaveRequests: many(leaveRequests),
  tasks: many(tasks),
  documents: many(documents),
  onboardingTasks: many(onboardingTasks),
}))

/**
 * Daily attendance records tracking employee check-in/check-out times.
 * Supports status tracking (present, absent, late, etc.).
 */
export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    date: timestamp('date').notNull(),
    checkIn: timestamp('check_in'),
    checkOut: timestamp('check_out'),
    status: varchar('status', { length: 50 }).notNull().default('present'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    employeeFk: foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employees.id],
    }),
    employeeIdIdx: index('attendance_employee_id_idx').on(table.employeeId),
    dateIdx: index('attendance_date_idx').on(table.date),
    employeeDateIdx: uniqueIndex('attendance_emp_date_unique_idx').on(table.employeeId, table.date),
    organizationDateIdx: index('attendance_organization_date_idx').on(table.organizationId, table.date),
  }),
)

export const attendanceRelations = relations(attendance, ({ one }) => ({
  employee: one(employees, {
    fields: [attendance.employeeId],
    references: [employees.id],
  }),
}))

/**
 * Leave requests submitted by employees, with approval workflow.
 * Types: vacation, sick, personal, etc. Statuses: pending, approved, rejected.
 */
export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    type: varchar('type', { length: 50 }).notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    reason: text('reason'),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    approvedBy: integer('approved_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    employeeFk: foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employees.id],
    }),
    approverFk: foreignKey({
      columns: [table.approvedBy],
      foreignColumns: [users.id],
    }),
    employeeIdIdx: index('leave_requests_employee_id_idx').on(table.employeeId),
    statusIdx: index('leave_requests_status_idx').on(table.status),
    employeeStatusIdx: index('leave_requests_employee_status_idx').on(table.employeeId, table.status),
    organizationStatusIdx: index('leave_requests_organization_status_idx').on(table.organizationId, table.status),
    approvedByIdx: index('leave_requests_approved_by_idx').on(table.approvedBy),
  }),
)

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id],
  }),
  approver: one(users, {
    fields: [leaveRequests.approvedBy],
    references: [users.id],
  }),
}))

/**
 * Tasks assigned to employees within departments, with priority and due dates.
 * Created by system users, assignable to employees.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    assignedTo: integer('assigned_to'),
    createdBy: integer('created_by').notNull(),
    departmentId: integer('department_id'),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 50 }).notNull().default('todo'),
    priority: varchar('priority', { length: 50 }).notNull().default('medium'),
    dueDate: timestamp('due_date'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    assignedFk: foreignKey({
      columns: [table.assignedTo],
      foreignColumns: [employees.id],
    }),
    creatorFk: foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }),
    departmentFk: foreignKey({
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    assignedToIdx: index('tasks_assigned_to_idx').on(table.assignedTo),
    statusIdx: index('tasks_status_idx').on(table.status),
    departmentIdIdx: index('tasks_department_id_idx').on(table.departmentId),
    dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
    createdByIdx: index('tasks_created_by_idx').on(table.createdBy),
    organizationStatusIdx: index('tasks_organization_status_idx').on(table.organizationId, table.status),
    organizationDueDateIdx: index('tasks_organization_due_date_idx').on(table.organizationId, table.dueDate),
  }),
)

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(employees, {
    fields: [tasks.assignedTo],
    references: [employees.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [tasks.departmentId],
    references: [departments.id],
  }),
}))

/**
 * Notifications delivered to system users for events and alerts.
 * Supports read/unread tracking and different notification types.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 50 }).notNull().default('info'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    readIdx: index('notifications_read_idx').on(table.read),
    organizationUserReadIdx: index('notifications_organization_user_read_idx').on(
      table.organizationId,
      table.userId,
      table.read,
    ),
  }),
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))

/**
 * Activity logs tracking mutations performed by users.
 */
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: integer('entity_id'),
    details: text('details'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
    userIdIdx: index('activity_logs_user_id_idx').on(table.userId),
    actionIdx: index('activity_logs_action_idx').on(table.action),
    entityTypeIdx: index('activity_logs_entity_type_idx').on(table.entityType),
    organizationCreatedAtIdx: index('activity_logs_organization_created_at_idx').on(
      table.organizationId,
      table.createdAt,
    ),
  }),
)

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}))

/**
 * Documents associated with employees.
 */
export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    url: text('url').notNull(),
    type: varchar('type', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    employeeFk: foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employees.id],
    }),
    employeeIdIdx: index('documents_employee_id_idx').on(table.employeeId),
    organizationEmployeeIdx: index('documents_organization_employee_idx').on(
      table.organizationId,
      table.employeeId,
    ),
  }),
)

export const documentsRelations = relations(documents, ({ one }) => ({
  employee: one(employees, {
    fields: [documents.employeeId],
    references: [employees.id],
  }),
}))

/**
 * Onboarding milestone checklist for new employees.
 */
export const onboardingTasks = pgTable(
  'onboarding_tasks',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 50 }).notNull().default('general'),
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamp('completed_at'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    employeeFk: foreignKey({
      columns: [table.employeeId],
      foreignColumns: [employees.id],
    }).onDelete('cascade'),
    employeeIdIdx: index('onboarding_tasks_employee_id_idx').on(table.employeeId),
    completedIdx: index('onboarding_tasks_completed_idx').on(table.completed),
    organizationEmployeeIdx: index('onboarding_tasks_organization_employee_idx').on(
      table.organizationId,
      table.employeeId,
    ),
  }),
)

export const onboardingTasksRelations = relations(onboardingTasks, ({ one }) => ({
  employee: one(employees, {
    fields: [onboardingTasks.employeeId],
    references: [employees.id],
  }),
}))
