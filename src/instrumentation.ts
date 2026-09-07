export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("./sentry/server")
    initSentry()

    const { logger } = await import("@/lib/logger")
    logger.info(
      {
        env: process.env.NODE_ENV,
        logLevel: process.env.LOG_LEVEL ?? "info",
        sentry: Boolean(process.env.SENTRY_DSN),
      },
      "server initializing"
    )
  }
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | undefined> },
  context: { routerKind: string; routePath: string; routeType: string }
) => {
  // Sentry (no-op when SENTRY_DSN is absent).
  if (process.env.SENTRY_DSN) {
    const { captureRequestError } = await import("@sentry/nextjs")
    await captureRequestError(err, request, context)
    return
  }

  // Fallback: structured stdout log with digest for correlation.
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest: unknown }).digest)
      : undefined
  console.error(
    JSON.stringify({
      level: "error",
      msg: "unhandled server error",
      digest,
      path: request?.path,
      method: request?.method,
      routerKind: context?.routerKind,
      routePath: context?.routePath,
    })
  )
}
