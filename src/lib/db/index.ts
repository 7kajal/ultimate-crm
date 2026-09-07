import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

const globalForDb = globalThis as typeof globalThis & {
  __crmConnection?: postgres.Sql
}

function createConnection() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }
  // prepare: false → compatible with transaction-poolers (Supabase, Neon, PgBouncer)
  return postgres(url, { prepare: false, max: 10 })
}

// Reuse the connection across dev hot-reloads to avoid exhausting Postgres.
const conn =
  process.env.NODE_ENV === "production"
    ? createConnection()
    : (globalForDb.__crmConnection ??= createConnection())

export const db = drizzle(conn, { schema })

export type Db = typeof db
