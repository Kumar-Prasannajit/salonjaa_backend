import { pgTable, uuid, varchar, text, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { users } from "@/db/schema/identity";
import { branches } from "@/db/schema/branch";
import { branchServices } from "@/db/schema/service";

// TRD §4 `promotions`/`promotion_branches`/`promotion_services` — deferred since Module 10
// ("no source of truth," per docs/PROGRESS.md's Not-started note). Module 16 gives it a real
// contract, co-defined with the user: Salon Owner creates a promotion targeting one or more
// of their own branches/services; TRD §10's `promotion:deactivate` job auto-flips `active`
// false at `endsAt` (see src/queues/promotion-deactivate.*).
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    bannerImageUrl: text("banner_image_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    activeRangeIdx: index("promotions_active_range_idx").on(table.active, table.startsAt, table.endsAt),
  })
);

export const promotionBranches = pgTable(
  "promotion_branches",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.promotionId, table.branchId] }),
  })
);

export const promotionServices = pgTable(
  "promotion_services",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => branchServices.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.promotionId, table.serviceId] }),
  })
);
