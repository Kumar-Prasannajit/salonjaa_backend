import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { complaintTypeEnum, complaintStatusEnum } from "@/db/schema/enums";
import { users } from "@/db/schema/identity";

// docs/ADMIN_CONTRACT.md §2 gives POST /complaints a single generic `referenceId` field, not
// TRD §4's implied per-entity FK split (nullable booking/salon IDs) — followed the documented
// request body exactly rather than TRD's abstract column sketch. Filed by "Customer or Salon
// Owner" per the contract, so this is `filedByUserId`, not `customerId`.
export const complaints = pgTable(
  "complaints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filedByUserId: uuid("filed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: complaintTypeEnum("type").notNull(),
    referenceId: uuid("reference_id"),
    description: text("description").notNull(),
    status: complaintStatusEnum("status").notNull().default("OPEN"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolutionNotes: text("resolution_notes"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("complaints_status_idx").on(table.status),
    filedByIdx: index("complaints_filed_by_idx").on(table.filedByUserId),
  })
);
