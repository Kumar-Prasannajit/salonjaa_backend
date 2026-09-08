import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { strikeTypeEnum } from "@/db/schema/enums";
import { users } from "@/db/schema/identity";
import { bookings } from "@/db/schema/booking";

// TRD §4 `customer_strikes` — existed as schema-only enum values since the start
// (strikeTypeEnum, adminActionTypeEnum's REMOVE_STRIKE) with no table and no consumer.
// Module 16 gives it both: NO_SHOW strikes are recorded automatically when a Salon Owner
// marks a booking NO_SHOW; FAKE_BOOKING/ABUSIVE_CANCELLATION are available for an admin to
// record manually (no automated trigger currently produces them — same "schema ready, no
// automatic writer yet" precedent as several other tables in this codebase).
//
// Append-only per TRD: "removal is metadata, not deletion" — removedAt/removedBy/
// removalReason record an admin's REMOVE_STRIKE action without ever deleting the row, so the
// history stays intact for audit even after a strike stops counting.
export const customerStrikes = pgTable(
  "customer_strikes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "restrict" }),
    type: strikeTypeEnum("type").notNull(),
    notes: text("notes"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by").references(() => users.id, { onDelete: "set null" }),
    removalReason: text("removal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerRemovedIdx: index("customer_strikes_customer_removed_idx").on(table.customerId, table.removedAt),
  })
);
