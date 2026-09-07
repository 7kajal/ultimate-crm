import { z } from "zod"

import { leadSourceEnum, leadStageEnum } from "@/lib/db/schema"

export const leadSourceValues = leadSourceEnum.enumValues
export const leadStageValues = leadStageEnum.enumValues

export type LeadSourceValue = (typeof leadSourceValues)[number]
export type LeadStageValue = (typeof leadStageValues)[number]

const optionalString = z.string().trim().max(255).optional().or(z.literal(""))

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  company: optionalString,
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: optionalString,
  source: z.enum(leadSourceValues).default("other"),
  stage: z.enum(leadStageValues).default("new"),
  /** Rupees on the wire; stored as paise. */
  value: z.coerce.number().min(0).max(1_000_000_000).default(0),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  assignedTo: z.string().uuid().optional().or(z.literal("")),
  nextFollowUpAt: z.coerce.date().optional().nullable(),
  expectedCloseAt: z.coerce.date().optional().nullable(),
})

export const updateLeadSchema = createLeadSchema.partial()

export const assignLeadSchema = z.object({
  leadId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
})

export const changeStageSchema = z.object({
  leadId: z.string().uuid(),
  stage: z.enum(leadStageValues),
})

export const addActivitySchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["note", "call", "email", "meeting"]),
  body: z.string().trim().min(1, "Cannot be empty").max(5000),
})

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueAt: z.coerce.date().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().or(z.literal("")),
})

export const toggleTaskSchema = z.object({
  taskId: z.string().uuid(),
  done: z.boolean(),
})

export const convertLeadSchema = z.object({
  leadId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  company: optionalString,
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: optionalString,
  gstin: optionalString,
  addressLine: optionalString,
  city: optionalString,
  state: optionalString,
  pincode: optionalString,
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
