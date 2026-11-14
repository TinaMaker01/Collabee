import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { count, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { organizations, departments, users, employees } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { organizationUpdateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'

const organizationRoute = new Hono()

organizationRoute.use('*', protectRoute)

organizationRoute.get('/', async (c) => {
  const orgList = await db.select().from(organizations).limit(1)
  let org = orgList[0]

  if (!org) {
    const [created] = await db
      .insert(organizations)
      .values({
        name: 'Collabee HQ',
        slug: 'collabee-hq',
        domain: 'collabee.com',
      })
      .returning()
    org = created
  }

  const [deptCount] = await db.select({ value: count() }).from(departments)
  const [userCount] = await db.select({ value: count() }).from(users)
  const [empCount] = await db.select({ value: count() }).from(employees)

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
  const orgList = await db.select().from(organizations).limit(1)
  let org = orgList[0]

  if (!org) {
    const [created] = await db
      .insert(organizations)
      .values({
        name: body.name || 'Collabee HQ',
        slug: body.slug || 'collabee-hq',
        domain: body.domain || 'collabee.com',
      })
      .returning()
    org = created
  } else {
    const [updated] = await db
      .update(organizations)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.slug ? { slug: body.slug } : {}),
        ...(body.domain !== undefined ? { domain: body.domain } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id))
      .returning()
    org = updated
  }

  const currentUser = c.get('user')
  await logActivity(currentUser.id, 'UPDATE_ORGANIZATION', 'organization', org.id, { changes: body })

  return c.json({ organization: org })
})

export default organizationRoute
