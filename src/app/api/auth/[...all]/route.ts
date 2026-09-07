import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { logger } from "@/lib/logger"

const log = logger.child({ module: "auth-handler" })

export async function GET(request: Request) {
  try {
    return auth.handler(request)
  } catch (error) {
    log.error({ err: error }, "auth handler error")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    return auth.handler(request)
  } catch (error) {
    log.error({ err: error }, "auth handler error")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
