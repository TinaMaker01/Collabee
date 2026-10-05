import { db } from '../db/index.js'
import { createUser, generateToken } from '../services/auth.js'
import { logger } from '../utils/logger.js'

export async function setupTestDb() {
  // Safety check: refuse to run if .env.test wasn't loaded
  const dbUrl = process.env.DATABASE_URL || ''
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    throw new Error(
      'Refusing to run tests: DATABASE_URL does not point to localhost. ' +
        'Ensure .env.test is configured and loaded before running tests.',
    )
  }
  logger.info('Setting up test database')
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
}

export async function teardownTestDb() {
  const tables = ['notifications', 'tasks', 'leave_requests', 'attendance', 'employees', 'departments', 'users']
  for (const table of tables) {
    await db.execute(`DROP TABLE IF EXISTS ${table} CASCADE`)
  }
}

export async function createTestUser() {
  const user = await createUser('Test User', 'test@example.com', 'password123')
  const token = await generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
  return { user, token }
}
