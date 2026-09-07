import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"

import { db } from "@/lib/db"
import * as authSchema from "@/lib/db/schema/auth.schema"

export const auth = betterAuth({
  baseURL: process.env.APP_URL ?? "http://localhost:3000",
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
