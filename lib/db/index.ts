import { drizzle } from 'drizzle-orm/vercel-postgres'
import { sql } from '@vercel/postgres'
import * as schema from './schema'

// Instancia singleton de Drizzle conectada a Vercel Postgres
export const db = drizzle(sql, { schema })

export * from './schema'
