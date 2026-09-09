import { pgTable, uuid, varchar, text, integer, doublePrecision, timestamp, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { serviceStatusEnum } from "@/db/schema/enums";
import { branches } from "@/db/schema/branch";
import { staff } from "@/db/schema/staff";

// Platform-managed lifecycle (TRD §4: "platform category lifecycle"). No CRUD endpoint is
// documented in frontend_handover.md — rows come only from `npm run db:seed`, same pattern
// as role seeding. Reuses `serviceStatusEnum` (ACTIVE/INACTIVE); TRD doesn't define a
// dedicated category-status enum.
export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    icon: text("icon"),
    status: serviceStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    activeSlugUnique: uniqueIndex("service_categories_active_slug_unique")
      .on(table.slug)
      .where(sql`${table.deletedAt} is null`),
    statusIdx: index("service_categories_status_idx").on(table.status),
  })
);

// Named `branch_services` in the TRD; exposed to the frontend as `/services`.
export const branchServices = pgTable(
  "branch_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    basePrice: doublePrecision("base_price").notNull(),
    imageUrl: text("image_url"),
    status: serviceStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    branchStatusIdx: index("branch_services_branch_status_deleted_idx").on(
      table.branchId,
      table.status,
      table.deletedAt
    ),
    categoryStatusIdx: index("branch_services_category_status_idx").on(table.categoryId, table.status),
  })
);

// Module 22 — docs/NEXT_SESSION_PLAN.md item 1. A single-select, required-when-present variant
// on a service (e.g. Facial — Papaya ₹999 / Diamond ₹1499), decided with the user: overrides
// price only, never duration (same durationMinutes as the base service for every variant).
// A service "has variants" iff it has ≥1 active variant row here — no separate
// hasVariants/variantRequired flag on branch_services, avoiding an invalid combination of
// flag-without-variants or variants-without-the-flag (see BookingService.resolveServiceLines,
// which enforces variantId as required exactly when this is true).
export const serviceVariants = pgTable(
  "service_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchServiceId: uuid("branch_service_id")
      .notNull()
      .references(() => branchServices.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    price: doublePrecision("price").notNull(),
    // Same status/soft-delete shape as branch_services above, not the plain boolean
    // branch_slot_templates uses — a variant is closer to "a small service" than a template.
    status: serviceStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    serviceStatusIdx: index("service_variants_service_status_deleted_idx").on(
      table.branchServiceId,
      table.status,
      table.deletedAt
    ),
  })
);

export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => branchServices.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.staffId, table.serviceId] }),
    serviceIdx: index("staff_services_service_id_idx").on(table.serviceId),
  })
);
