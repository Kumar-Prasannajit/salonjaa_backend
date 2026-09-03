import { pgTable, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { bookingStatusEnum } from "@/db/schema/enums";
import { branches } from "@/db/schema/branch";
import { staff } from "@/db/schema/staff";

// Minimal slice of the TRD §4 `bookings` table — just enough for Availability (Module 5) to
// compute live capacity against real reservations. Booking (Module 6) will ALTER this table
// to add the remaining TRD columns (customer_id, salon_id, booking_number, booking_type,
// amounts, reasons, approval/completion/cancellation timestamps, etc.) when it builds the
// actual create/approve/cancel/reschedule flows. Never soft-deleted or physically deleted,
// per TRD ("never soft-delete or physically delete").
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    selectedStaffId: uuid("selected_staff_id").references(() => staff.id, { onDelete: "restrict" }),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
    bookingStatus: bookingStatusEnum("booking_status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    branchRangeStatusIdx: index("bookings_branch_range_status_idx").on(
      table.branchId,
      table.scheduledStart,
      table.scheduledEnd,
      table.bookingStatus
    ),
    staffRangeIdx: index("bookings_staff_range_idx").on(
      table.selectedStaffId,
      table.scheduledStart,
      table.scheduledEnd
    ),
  })
);
