import { pgTable, uuid, varchar, text, integer, doublePrecision, date, timestamp, index } from "drizzle-orm/pg-core";
import { staffTypeEnum, staffStatusEnum, userGenderEnum, leaveStatusEnum } from "@/db/schema/enums";
import { branches } from "@/db/schema/branch";

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    profileImage: text("profile_image"),
    gender: userGenderEnum("gender"),
    joiningDate: date("joining_date"),
    experienceYears: integer("experience_years"),
    bio: text("bio"),
    staffType: staffTypeEnum("staff_type").notNull().default("NORMAL"),
    consultationFee: doublePrecision("consultation_fee"),
    salary: doublePrecision("salary"),
    status: staffStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    branchStatusIdx: index("staff_branch_status_deleted_idx").on(table.branchId, table.status, table.deletedAt),
  })
);

export const staffLeaves = pgTable(
  "staff_leaves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    startDateTime: timestamp("start_datetime", { withTimezone: true }).notNull(),
    endDateTime: timestamp("end_datetime", { withTimezone: true }).notNull(),
    reason: varchar("reason", { length: 255 }),
    status: leaveStatusEnum("status").notNull().default("APPROVED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    staffStatusRangeIdx: index("staff_leaves_staff_status_range_idx").on(
      table.staffId,
      table.status,
      table.startDateTime,
      table.endDateTime
    ),
  })
);
