import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { user } from "./auth.schema"
import { leads } from "./crm.schema"

export const aiInsightTypeEnum = pgEnum("ai_insight_type", [
  "lead_score",
  "risk_alert",
  "summary",
  "forecast",
])

export const aiRoleEnum = pgEnum("ai_message_role", [
  "user",
  "assistant",
  "system",
])

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: aiInsightTypeEnum("type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /** 0–100 for lead_score; nullable for others. */
    score: integer("score"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    payload: jsonb("payload"),
    modelVersion: text("model_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_insights_type_idx").on(table.type),
    index("ai_insights_entity_idx").on(table.entityType, table.entityId),
  ]
)

export const aiThreads = pgTable(
  "ai_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("ai_threads_user_idx").on(table.userId)]
)

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade" }),
    role: aiRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_messages_thread_idx").on(table.threadId)]
)

export type AiInsight = typeof aiInsights.$inferSelect

/** Convenience: latest score insight per lead lives on leads.aiScore. */
export const _leadScoreRef = leads.aiScore
