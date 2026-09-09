import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  time,
  timestamp,
  date,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { branchStatusEnum, genderServedEnum } from "@/db/schema/enums";
import { salons } from "@/db/schema/salon";
import { users } from "@/db/schema/identity";

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    addressLine1: varchar("address_line1", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    totalChairs: integer("total_chairs").notNull(),
    openingTime: time("opening_time").notNull(),
    closingTime: time("closing_time").notNull(),
    status: branchStatusEnum("status").notNull().default("ACTIVE"),
    // Module 21 — closes docs/COMPETITOR_COMPARISON_LUZO.md's "Unisex/Men tags absent" gap.
    // Owner-set, branch-level. Defaults UNISEX for every branch that existed before this
    // column and any that doesn't set it explicitly — the least presumptive default.
    genderServed: genderServedEnum("gender_served").notNull().default("UNISEX"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    salonStatusIdx: index("branches_salon_status_deleted_idx").on(table.salonId, table.status, table.deletedAt),
  })
);

export const branchHolidays = pgTable(
  "branch_holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    holidayDate: date("holiday_date").notNull(),
    reason: varchar("reason", { length: 255 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    branchDateUnique: uniqueIndex("branch_holidays_branch_date_unique").on(table.branchId, table.holidayDate),
    branchDateIdx: index("branch_holidays_branch_date_idx").on(table.branchId, table.holidayDate),
  })
);

export const branchCapacityRules = pgTable(
  "branch_capacity_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    maxCapacityOverride: integer("max_capacity_override"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    branchUnique: uniqueIndex("branch_capacity_rules_branch_unique").on(table.branchId),
  })
);

// TRD §4 — deferred since Module 3/5 ("no CRUD endpoint anywhere, so Availability generates
// slots at a fixed DEFAULT_SLOT_INTERVAL_MINUTES instead"). Module 16 gives it a real CRUD
// surface and wires it into AvailabilityService — see that module's buildCandidateWindows.
export const branchSlotTemplates = pgTable(
  "branch_slot_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    slotDurationMinutes: integer("slot_duration_minutes").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    branchActiveIdx: index("branch_slot_templates_branch_active_idx").on(table.branchId, table.active),
  })
);
