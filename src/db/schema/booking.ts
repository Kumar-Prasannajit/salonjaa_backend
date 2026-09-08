import { pgTable, uuid, varchar, text, integer, boolean, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";
import {
  bookingStatusEnum,
  bookingTypeEnum,
  requestedByEnum,
  rescheduleRequestStatusEnum,
  paymentMethodEnum,
} from "@/db/schema/enums";
import { branches } from "@/db/schema/branch";
import { staff } from "@/db/schema/staff";
import { salons } from "@/db/schema/salon";
import { users } from "@/db/schema/identity";
import { branchServices } from "@/db/schema/service";

// TRD §4 `bookings` table. Module 5 (Availability) migrated a minimal slice of this table
// (branchId, selectedStaffId, scheduledStart/End, bookingStatus, timestamps) before Booking
// existed, purely so capacity math had something real to query. This is Module 6 ALTERing
// that table to add the rest. Never soft-deleted or physically deleted, per TRD.
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingNumber: varchar("booking_number", { length: 32 }).notNull().unique(),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "restrict" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    bookingType: bookingTypeEnum("booking_type").notNull().default("ONLINE"),
    bookingStatus: bookingStatusEnum("booking_status").notNull().default("PENDING"),
    // Module 14b — existing enum (Module 7) that had zero writers until now. Set at creation
    // time so approve() knows, before the fact, whether this booking should stop at
    // AWAITING_PAYMENT (ONLINE) or go straight to APPROVED (PAY_AT_SALON) — see PROGRESS.md.
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("ONLINE"),
    selectedStaffId: uuid("selected_staff_id").references(() => staff.id, { onDelete: "restrict" }),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
    totalDurationMinutes: integer("total_duration_minutes").notNull(),
    subtotalAmount: doublePrecision("subtotal_amount").notNull().default(0),
    discountAmount: doublePrecision("discount_amount").notNull().default(0),
    taxAmount: doublePrecision("tax_amount").notNull().default(0),
    totalAmount: doublePrecision("total_amount").notNull().default(0),
    // Walk-in-only convenience fields — not in the TRD's explicit bookings column list, but
    // needed to satisfy the documented POST /salon-bookings/walk-in request body
    // (customerName/customerPhone) for a customer with no `users` row (customerId stays
    // null). Decided with the user rather than fabricating a synthetic user account.
    customerName: varchar("customer_name", { length: 200 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    notes: text("notes"),
    rejectionReason: text("rejection_reason"),
    cancellationReason: text("cancellation_reason"),
    rescheduleReason: text("reschedule_reason"),
    // Module 16 — customer-strikes/advance-payment policy. Set at creation time when the
    // customer already has 4+ lifetime NO_SHOW strikes (see src/modules/strike). Amount is a
    // frozen snapshot (10% of this booking's totalAmount at creation), never recomputed later.
    requiresAdvancePayment: boolean("requires_advance_payment").notNull().default(false),
    advanceAmount: doublePrecision("advance_amount"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    noShowAt: timestamp("no_show_at", { withTimezone: true }),
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
    customerCreatedIdx: index("bookings_customer_created_idx").on(table.customerId, table.createdAt),
    salonStatusIdx: index("bookings_salon_status_idx").on(table.salonId, table.bookingStatus),
  })
);

// Immutable snapshot of each service at the time of booking — service price/duration/name
// changes later must never rewrite history.
export const bookingServices = pgTable(
  "booking_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => branchServices.id, { onDelete: "restrict" }),
    serviceName: varchar("service_name", { length: 200 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    price: doublePrecision("price").notNull(),
    quantity: integer("quantity").notNull().default(1),
    totalAmount: doublePrecision("total_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    bookingIdx: index("booking_services_booking_id_idx").on(table.bookingId),
  })
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    oldStatus: bookingStatusEnum("old_status"),
    newStatus: bookingStatusEnum("new_status").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    bookingCreatedIdx: index("booking_status_history_booking_created_idx").on(table.bookingId, table.createdAt),
  })
);

export const bookingRescheduleRequests = pgTable(
  "booking_reschedule_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    requestedBy: requestedByEnum("requested_by").notNull(),
    oldScheduledStart: timestamp("old_scheduled_start", { withTimezone: true }).notNull(),
    oldScheduledEnd: timestamp("old_scheduled_end", { withTimezone: true }).notNull(),
    newScheduledStart: timestamp("new_scheduled_start", { withTimezone: true }).notNull(),
    newScheduledEnd: timestamp("new_scheduled_end", { withTimezone: true }).notNull(),
    reason: text("reason"),
    // Not in the TRD's column list (which has a single `reason` field) — added because
    // frontend_handover.md's reject-reschedule body requires its own mandatory `reason`,
    // distinct from the original requester's `reason` above.
    responseReason: text("response_reason"),
    status: rescheduleRequestStatusEnum("status").notNull().default("PENDING"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    bookingStatusCreatedIdx: index("booking_reschedule_requests_booking_status_created_idx").on(
      table.bookingId,
      table.status,
      table.createdAt
    ),
  })
);
