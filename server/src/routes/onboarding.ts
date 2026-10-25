import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { onboardingTasks, employees, users, departments, notifications } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError, ForbiddenError } from '../middleware/error.js'
import { onboardingTaskCreateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'
import { emitNotification } from '../services/notificationEvents.js'

const DEFAULT_ONBOARDING_TASKS = [
  {
    title: 'Compléter mes coordonnées et profil',
    description: 'Vérifiez votre nom, téléphone et informations personnelles dans les paramètres.',
    category: 'profile',
    order: 1,
  },
  {
    title: 'Téléverser mes documents d’embauche',
    description: 'Téléversez votre pièce d’identité et votre contrat de travail dans l’onglet Documents.',
    category: 'documents',
    order: 2,
  },
  {
    title: 'Découvrir l’équipe et l’organigramme',
    description: 'Consultez l’organigramme d’entreprise pour identifier vos collègues et votre manager.',
    category: 'team',
    order: 3,
  },
  {
    title: 'Prendre connaissance de mes premières tâches',
    description: 'Accédez au tableau Kanban des tâches pour visualiser les missions assignées.',
    category: 'tasks',
    order: 4,
  },
  {
    title: 'Définir un mot de passe sécurisé',
    description: 'Mettez à jour votre mot de passe initial depuis vos Paramètres de compte.',
    category: 'security',
    order: 5,
  },
  {
    title: 'Effectuer mon premier pointage de présence',
    description: 'Enregistrez votre première arrivée sur la plateforme via le bouton Check-In.',
    category: 'attendance',
    order: 6,
  },
]

async function seedDefaultTasksForEmployee(employeeId: number) {
  const tasksToInsert = DEFAULT_ONBOARDING_TASKS.map((t) => ({
    employeeId,
    title: t.title,
    description: t.description,
    category: t.category,
    order: t.order,
    completed: false,
  }))
  await db.insert(onboardingTasks).values(tasksToInsert)
}

const onboardingRoute = new Hono()

onboardingRoute.use('*', protectRoute)

onboardingRoute.get('/', async (c) => {
  const user = c.get('user')
  const employeeIdParam = c.req.query('employeeId')
  const view = c.req.query('view')

  // Admin / Manager viewing overview of all employees
  if ((user.role === 'admin' || user.role === 'manager') && view === 'overview') {
    const allEmployees = await db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        position: employees.position,
        departmentId: employees.departmentId,
        departmentName: departments.name,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .orderBy(asc(employees.name))

    const allTasks = await db.select().from(onboardingTasks)

    const summaries = allEmployees.map((emp) => {
      const empTasks = allTasks.filter((t) => t.employeeId === emp.id)
      const total = empTasks.length
      const completed = empTasks.filter((t) => t.completed).length
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0
      return {
        ...emp,
        totalTasks: total,
        completedTasks: completed,
        percent,
      }
    })

    return c.json(summaries)
  }

  // Determine target employeeId
  let targetEmployeeId: number

  if (employeeIdParam) {
    if (user.role === 'user') {
      const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
      if (!emp || emp.id !== parseInt(employeeIdParam, 10)) {
        throw new ForbiddenError('You can only view your own onboarding checklist')
      }
      targetEmployeeId = emp.id
    } else {
      targetEmployeeId = parseInt(employeeIdParam, 10)
    }
  } else {
    // Current user's employee profile
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp) {
      return c.json({ tasks: [], stats: { total: 0, completed: 0, percent: 0 } })
    }
    targetEmployeeId = emp.id
  }

  if (isNaN(targetEmployeeId)) {
    throw new NotFoundError('Invalid employee ID')
  }

  // Fetch or auto-seed onboarding tasks
  let tasksList = await db
    .select()
    .from(onboardingTasks)
    .where(eq(onboardingTasks.employeeId, targetEmployeeId))
    .orderBy(asc(onboardingTasks.order), asc(onboardingTasks.id))

  if (tasksList.length === 0) {
    await seedDefaultTasksForEmployee(targetEmployeeId)
    tasksList = await db
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.employeeId, targetEmployeeId))
      .orderBy(asc(onboardingTasks.order), asc(onboardingTasks.id))
  }

  const total = tasksList.length
  const completed = tasksList.filter((t) => t.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return c.json({
    employeeId: targetEmployeeId,
    tasks: tasksList,
    stats: {
      total,
      completed,
      percent,
    },
  })
})

onboardingRoute.patch('/:id/toggle', async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid task ID')

  const [task] = await db.select().from(onboardingTasks).where(eq(onboardingTasks.id, id))
  if (!task) throw new NotFoundError('Onboarding task not found')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp || emp.id !== task.employeeId) {
      throw new ForbiddenError('You can only update your own onboarding tasks')
    }
  }

  const newCompleted = !task.completed
  const [updated] = await db
    .update(onboardingTasks)
    .set({
      completed: newCompleted,
      completedAt: newCompleted ? new Date() : null,
    })
    .where(eq(onboardingTasks.id, id))
    .returning()

  await logActivity(
    user.id,
    newCompleted ? 'complete' : 'uncomplete',
    'onboarding',
    id,
    `${newCompleted ? 'Completed' : 'Reopened'} onboarding task: "${task.title}"`,
  )

  // Check if all tasks for this employee are now complete
  if (newCompleted) {
    const allEmpTasks = await db
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.employeeId, task.employeeId))

    const allFinished = allEmpTasks.length > 0 && allEmpTasks.every((t) => t.completed)
    if (allFinished) {
      const [emp] = await db.select().from(employees).where(eq(employees.id, task.employeeId))
      if (emp) {
        const [targetUser] = await db.select().from(users).where(eq(users.email, emp.email))
        if (targetUser) {
          const [notif] = await db
            .insert(notifications)
            .values({
              userId: targetUser.id,
              title: 'Parcours d’intégration complété ! 🎉',
              message: 'Félicitations, vous avez validé 100% de vos étapes d’onboarding.',
              type: 'success',
            })
            .returning()
          if (notif) emitNotification(targetUser.id, notif)
        }
      }
    }
  }

  return c.json(updated)
})

onboardingRoute.post('/', requireRole('admin', 'manager'), zValidator('json', onboardingTaskCreateSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  const [newEmployee] = await db.select().from(employees).where(eq(employees.id, body.employeeId))
  if (!newEmployee) throw new NotFoundError('Employee not found')

  const [inserted] = await db
    .insert(onboardingTasks)
    .values({
      employeeId: body.employeeId,
      title: body.title,
      description: body.description,
      category: body.category,
      order: body.order,
      completed: false,
    })
    .returning()

  await logActivity(user.id, 'create', 'onboarding', inserted.id, `Created onboarding task "${inserted.title}"`)

  return c.json(inserted, 201)
})

onboardingRoute.delete('/:id', requireRole('admin', 'manager'), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid task ID')

  const [deleted] = await db.delete(onboardingTasks).where(eq(onboardingTasks.id, id)).returning()
  if (!deleted) throw new NotFoundError('Onboarding task not found')

  await logActivity(user.id, 'delete', 'onboarding', id, `Deleted onboarding task "${deleted.title}"`)

  return c.json({ message: 'Onboarding task deleted successfully' })
})

export default onboardingRoute
