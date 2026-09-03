import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { adminActionTypeEnum } from "@/db/schema/enums";
import { users } from "@/db/schema/identity";

// TRD §4's simpler, admin-specific action log — sits alongside the generic `audit_logs`
// (identity.ts, Module 1, unused until this module) which carries the full old/new JSONB
// diff. This table is the readable "which admin did what to which entity" trail.
export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    action: adminActionTypeEnum("action").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityIdx: index("admin_actions_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    adminIdx: index("admin_actions_admin_user_id_idx").on(table.adminUserId),
  })
);
