import * as Sentry from "@sentry/nextjs"

export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return // zero-op in development unless configured

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
  })
}
