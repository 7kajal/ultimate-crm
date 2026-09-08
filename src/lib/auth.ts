import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"

import { db } from "@/lib/db"
import * as authSchema from "@/lib/db/schema/auth.schema"
import { env } from "@/lib/env"

export const auth = betterAuth({
  baseURL: env.APP_URL,
  trustHost: true,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  advanced: {
    database: { joins: true },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      designation: { type: "string", required: false },
    },
  },
  plugins: [
    admin({
      defaultRole: "employee",
      adminRoles: ["admin"],
    }),
  ],
})
