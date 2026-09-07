import { sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const log = logger.child({ module: "health" })

export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({
      status: "ok",
      checks: { database: "ok" },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.error({ err: error }, "health check failed")
    return Response.json(
      {
        status: "error",
        checks: { database: "error" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
