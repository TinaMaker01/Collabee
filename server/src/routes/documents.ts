import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { documents, employees } from '../db/schema.js'
import { protectRoute, requireRole } from '../middleware/auth.js'
import { NotFoundError, ValidationError } from '../middleware/error.js'
import { documentSchema, documentUpdateSchema } from '../shared/schemas.js'
import { logActivity } from '../utils/activityLogger.js'
import { withCache, invalidateCache } from '../utils/cache.js'

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const documentsRoute = new Hono()

documentsRoute.use('*', protectRoute)

documentsRoute.get('/', async (c) => {
  const user = c.get('user')
  const employeeId = c.req.query('employeeId')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp) return c.json([])
    const data = await withCache(c, () => db.select().from(documents).where(eq(documents.employeeId, emp.id)))
    return c.json(data)
  }

  if (employeeId) {
    const data = await db
      .select()
      .from(documents)
      .where(eq(documents.employeeId, parseInt(employeeId, 10)))
    return c.json(data)
  }
  const data = await withCache(c, () => db.select().from(documents))
  return c.json(data)
})

documentsRoute.get('/:id', async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const [doc] = await db.select().from(documents).where(eq(documents.id, id))
  if (!doc) throw new NotFoundError('Document not found')

  if (user.role === 'user') {
    const [emp] = await db.select().from(employees).where(eq(employees.email, user.email))
    if (!emp || doc.employeeId !== emp.id) {
      throw new NotFoundError('Document not found')
    }
  }

  return c.json(doc)
})

documentsRoute.post('/', requireRole('admin', 'manager'), zValidator('json', documentSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const [newDoc] = await db.insert(documents).values(body).returning()
  invalidateCache('/api/documents')
  await logActivity(user.id, 'CREATE', 'DOCUMENT', newDoc.id, { title: newDoc.title })
  return c.json(newDoc, 201)
})

documentsRoute.put('/:id', requireRole('admin', 'manager'), zValidator('json', documentUpdateSchema), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')
  const body = c.req.valid('json')
  const [updated] = await db.update(documents).set(body).where(eq(documents.id, id)).returning()
  if (!updated) throw new NotFoundError('Document not found')
  invalidateCache('/api/documents')
  await logActivity(user.id, 'UPDATE', 'DOCUMENT', id, { title: updated.title })
  return c.json(updated)
})

documentsRoute.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id')!, 10)
  if (isNaN(id)) throw new NotFoundError('Invalid ID')

  const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning()
  if (!deleted) throw new NotFoundError('Document not found')

  invalidateCache('/api/documents')
  await logActivity(user.id, 'DELETE', 'DOCUMENT', id, { title: deleted.title })
  return c.json({ message: 'Document deleted' })
})

documentsRoute.post('/upload', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    throw new ValidationError('A file is required')
  }

  // Max 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    throw new ValidationError('File size exceeds the 10MB limit')
  }

  const rawExt = path.extname(file.name).toLowerCase()
  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.csv', '.docx', '.xlsx']
  if (!allowedExts.includes(rawExt)) {
    throw new ValidationError('Unsupported file extension. Allowed: PDF, images, Office docs, text/csv.')
  }

  const uploadDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const safeFilename = `${crypto.randomUUID()}${rawExt}`
  const destination = path.join(uploadDir, safeFilename)

  const arrayBuffer = await file.arrayBuffer()
  fs.writeFileSync(destination, Buffer.from(arrayBuffer))

  const url = `/api/documents/file/${safeFilename}`
  return c.json({ url, filename: file.name, size: file.size }, 201)
})

documentsRoute.get('/file/:filename', async (c) => {
  const rawParam = c.req.param('filename')
  // Path traversal prevention: keep only the base file name
  const safeName = path.basename(rawParam)
  const uploadDir = path.resolve(process.cwd(), 'uploads')
  const filePath = path.join(uploadDir, safeName)

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('File not found')
  }

  const ext = path.extname(safeName).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
  const fileBuffer = fs.readFileSync(filePath)

  return c.body(fileBuffer, 200, {
    'Content-Type': mimeType,
    'X-Content-Type-Options': 'nosniff',
  })
})

export default documentsRoute
