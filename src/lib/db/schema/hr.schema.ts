import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "./auth.schema"

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "intern",
  "contract",
])

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "leave",
  "half_day",
  "wfh",
])

export const leaveTypeEnum = pgEnum("leave_type", [
  "casual",
  "sick",
  "unpaid",
])

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
])

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const employees = pgTable(
  "employees",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    employeeCode: text("employee_code").notNull().unique(),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    managerId: text("manager_id").references(() => user.id, {
      onDelete: "set null",
    }),
    employmentType: employmentTypeEnum("employment_type")
      .notNull()
      .default("full_time"),
    /** Annual paid-leave entitlement remaining (days). */
    leaveBalance: integer("leave_balance").notNull().default(24),
    joinedAt: date("joined_at").notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("employees_department_idx").on(table.departmentId),
    index("employees_manager_idx").on(table.managerId),
  ]
)

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    status: attendanceStatusEnum("status").notNull().default("present"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("attendance_user_day_unique").on(table.userId, table.day),
    index("attendance_day_idx").on(table.day),
  ]
)

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: leaveTypeEnum("type").notNull().default("casual"),
    status: leaveStatusEnum("status").notNull().default("pending"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    /** Working days requested (computed on apply). */
    days: integer("days").notNull().default(1),
    reason: text("reason"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leave_requests_user_idx").on(table.userId),
    index("leave_requests_status_idx").on(table.status),
  ]
)

export type Department = typeof departments.$inferSelect
export type Employee = typeof employees.$inferSelect
export type Attendance = typeof attendance.$inferSelect
export type LeaveRequest = typeof leaveRequests.$inferSelect
