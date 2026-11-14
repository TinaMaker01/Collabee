import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { count, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { organizations, departments, users, employees } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { organizationUpdateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'
import { requireTenantId } from '../services/tenant.js'
import { NotFoundError, ConflictError, getPgErrorInfo } from '../middleware/error.js'

const organizationRoute = new Hono()

organizationRoute.use('*', protectRoute)

organizationRoute.get('/', async (c) => {
  const tenantId = await requireTenantId(c)
  const [org] = await db.select().from(organizations).where(eq(organizations.id, tenantId))
  if (!org) throw new NotFoundError('Organization not found')

  const [deptCount] = await db.select({ value: count() }).from(departments).where(eq(departments.organizationId, tenantId))
  const [userCount] = await db.select({ value: count() }).from(users).where(eq(users.organizationId, tenantId))
  const [empCount] = await db.select({ value: count() }).from(employees).where(eq(employees.organizationId, tenantId))

  return c.json({
    organization: org,
    stats: {
      departmentsCount: Number(deptCount.value),
      usersCount: Number(userCount.value),
      employeesCount: Number(empCount.value),
    },
  })
})

organizationRoute.patch('/', requireRole('admin'), zValidator('json', organizationUpdateSchema), async (c) => {
  const body = c.req.valid('json')
  const tenantId = await requireTenantId(c)

  const [existing] = await db.select().from(organizations).where(eq(organizations.id, tenantId))
  if (!existing) throw new NotFoundError('Organization not found')

  let updated
  try {
    ;[updated] = await db
      .update(organizations)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.slug ? { slug: body.slug } : {}),
        ...(body.domain !== undefined ? { domain: body.domain } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, tenantId))
      .returning()
  } catch (err: unknown) {
    const pgErr = getPgErrorInfo(err)
    if (pgErr.constraint === 'organizations_slug_unique' || pgErr.code === '23505') {
      throw new ConflictError('Slug already in use')
    }
    throw err
  }

  const currentUser = c.get('user')
  await logActivity(currentUser.id, 'UPDATE_ORGANIZATION', 'organization', updated.id, { changes: body })

  return c.json({ organization: updated })
})

export default organizationRoute
