import { z } from "zod"

import { employmentTypeEnum, leaveStatusEnum, leaveTypeEnum } from "@/lib/db/schema"

export const employmentTypeValues = employmentTypeEnum.enumValues
export const leaveTypeValues = leaveTypeEnum.enumValues

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "employee"]),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  managerId: z.string().uuid().optional().or(z.literal("")),
  employmentType: z.enum(employmentTypeValues).default("full_time"),
  leaveBalance: z.coerce.number().int().min(0).max(365).default(24),
})

export const updateEmployeeSchema = z.object({
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  managerId: z.string().uuid().optional().or(z.literal("")),
  employmentType: z.enum(employmentTypeValues).optional(),
  leaveBalance: z.coerce.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
})

export const markAttendanceSchema = z.object({
  status: z.enum(["present", "absent", "leave", "half_day", "wfh"]),
  note: z.string().trim().max(200).optional().or(z.literal("")),
})

export const applyLeaveSchema = z
  .object({
    type: z.enum(leaveTypeValues),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  })

export const reviewLeaveSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(leaveStatusEnum.enumValues),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
