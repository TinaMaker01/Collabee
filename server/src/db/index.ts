import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

function parsePoolInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

const client = postgres(process.env.DATABASE_URL, {
  max: parsePoolInt(process.env.DB_POOL_MAX, 10),
  idle_timeout: parsePoolInt(process.env.DB_IDLE_TIMEOUT, 30),
  connect_timeout: parsePoolInt(process.env.DB_CONNECT_TIMEOUT, 10),
})

export const db = drizzle(client, { schema })

// Accepts either the database instance or a transaction (from db.transaction())
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type TxClient = typeof db | DbTransaction
