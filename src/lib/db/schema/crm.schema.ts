import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "./auth.schema"

export const leadStageEnum = pgEnum("lead_stage", [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
])

export const leadSourceEnum = pgEnum("lead_source", [
  "website",
  "referral",
  "whatsapp",
  "cold_call",
  "campaign",
  "other",
])

export const activityTypeEnum = pgEnum("activity_type", [
  "note",
  "call",
  "email",
  "meeting",
  "status_change",
  "assignment",
  "system",
  "whatsapp",
])

export const taskStatusEnum = pgEnum("task_status", ["open", "done", "cancelled"])
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high"])

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    source: leadSourceEnum("source").notNull().default("other"),
    stage: leadStageEnum("stage").notNull().default("new"),
    /** Deal value in paise. */
    value: bigint("value", { mode: "number" }).notNull().default(0),
    aiScore: integer("ai_score"),
    assignedTo: text("assigned_to").references(() => user.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tags: text("tags").array().notNull().default([]),
    notes: text("notes"),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    expectedCloseAt: timestamp("expected_close_at", { withTimezone: true }),
    convertedCustomerId: uuid("converted_customer_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("leads_stage_idx").on(table.stage),
    index("leads_assigned_to_idx").on(table.assignedTo),
    index("leads_deleted_at_idx").on(table.deletedAt),
  ]
)

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    type: activityTypeEnum("type").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_activities_lead_id_idx").on(table.leadId)]
)

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("open"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    assigneeId: text("assignee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_assignee_idx").on(table.assigneeId),
    index("tasks_lead_idx").on(table.leadId),
    index("tasks_status_idx").on(table.status),
  ]
)

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    gstin: text("gstin"),
    addressLine: text("address_line"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    notes: text("notes"),
    originLeadId: uuid("origin_lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("customers_owner_idx").on(table.ownerId)]
)

export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
export type LeadActivity = typeof leadActivities.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Customer = typeof customers.$inferSelect
export type LeadStage = (typeof leadStageEnum.enumValues)[number]
export type LeadSource = (typeof leadSourceEnum.enumValues)[number]
