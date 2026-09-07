import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "./auth.schema"
import { customers, leads } from "./crm.schema"

export const waDirectionEnum = pgEnum("wa_direction", ["in", "out"])

export const waMessageTypeEnum = pgEnum("wa_message_type", [
  "text",
  "template",
  "image",
  "document",
  "interactive",
  "system",
])

export const waMessageStatusEnum = pgEnum("wa_message_status", [
  "received",
  "sent",
  "delivered",
  "read",
  "failed",
])

export const campaignStatusEnum = pgEnum("wa_campaign_status", [
  "draft",
  "scheduled",
  "running",
  "completed",
  "cancelled",
])

export const recipientStatusEnum = pgEnum("wa_recipient_status", [
  "pending",
  "sent",
  "failed",
])

export const waContacts = pgTable(
  "wa_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** E.164 without "+", e.g. "919820000001". */
    waPhone: text("wa_phone").notNull().unique(),
    name: text("name"),
    /** Name from WhatsApp profile, when Meta provides it. */
    pushName: text("push_name"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    tags: text("tags").array().notNull().default([]),
    optedIn: boolean("opted_in").notNull().default(true),
    assignedTo: text("assigned_to").references(() => user.id, {
      onDelete: "set null",
    }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("wa_contacts_last_message_idx").on(table.lastMessageAt),
    index("wa_contacts_assigned_idx").on(table.assignedTo),
  ]
)

export const waMessages = pgTable(
  "wa_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Meta wamid — unique for dedupe across webhook retries. */
    waMessageId: text("wa_message_id").unique(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => waContacts.id, { onDelete: "cascade" }),
    direction: waDirectionEnum("direction").notNull(),
    type: waMessageTypeEnum("type").notNull().default("text"),
    body: text("body").notNull().default(""),
    templateName: text("template_name"),
    /** Raw Meta payload for audit/re-render. */
    payload: jsonb("payload"),
    status: waMessageStatusEnum("status").notNull().default("sent"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    campaignId: uuid("campaign_id"),
    /** Message timestamp from Meta (or send time for outbound). */
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    sentBy: text("sent_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("wa_messages_contact_ts_idx").on(table.contactId, table.timestamp),
    index("wa_messages_campaign_idx").on(table.campaignId),
  ]
)

export const waTemplates = pgTable(
  "wa_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metaTemplateId: text("meta_template_id").notNull().unique(),
    name: text("name").notNull(),
    /** MARKETING | UTILITY | AUTHENTICATION */
    category: text("category").notNull(),
    language: text("language").notNull().default("en"),
    components: jsonb("components"),
    status: text("status").notNull().default("PENDING"),
    rejectionReason: text("rejection_reason"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("wa_templates_status_idx").on(table.status)]
)

export const waCampaigns = pgTable(
  "wa_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => waTemplates.id, { onDelete: "restrict" }),
    /** { tags: string[], stages: string[] } — audience selector. */
    audienceFilter: jsonb("audience_filter").notNull().default({}),
    status: campaignStatusEnum("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sentCount: text("sent_count").notNull().default("0"),
    failedCount: text("failed_count").notNull().default("0"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("wa_campaigns_status_idx").on(table.status)]
)

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => waCampaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => waContacts.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => waMessages.id, {
      onDelete: "set null",
    }),
    status: recipientStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    unique("campaign_recipient_unique").on(table.campaignId, table.contactId),
    index("campaign_recipients_campaign_idx").on(table.campaignId),
  ]
)

export type WaContact = typeof waContacts.$inferSelect
export type WaMessage = typeof waMessages.$inferSelect
export type WaTemplate = typeof waTemplates.$inferSelect
export type WaCampaign = typeof waCampaigns.$inferSelect
