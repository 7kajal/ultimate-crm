import pino from "pino"

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.secret",
  "*.token",
  "*.apiKey",
]

const isProd = process.env.NODE_ENV === "production"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: redactPaths,
  base: { service: "ultimate-crm" },
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
        },
      }),
})

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}

export type Logger = typeof logger
