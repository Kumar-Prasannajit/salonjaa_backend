import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  paymentMethodEnum,
  paymentProviderEnum,
  paymentPurposeEnum,
  paymentStatusEnum,
  refundStatusEnum,
  couponTypeEnum,
  settlementStatusEnum,
} from "@/db/schema/enums";
import { bookings } from "@/db/schema/booking";
import { users } from "@/db/schema/identity";
import { salons } from "@/db/schema/salon";
import { branches } from "@/db/schema/branch";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    method: paymentMethodEnum("method").notNull().default("ONLINE"),
    // Module 16 — ADVANCE for the strikes-policy pre-payment, FULL for everything else
    // (every payment before this module was implicitly FULL).
    purpose: paymentPurposeEnum("purpose").notNull().default("FULL"),
    provider: paymentProviderEnum("provider").notNull().default("RAZORPAY"),
    providerOrderId: varchar("provider_order_id", { length: 100 }),
    providerPaymentId: varchar("provider_payment_id", { length: 100 }),
    amount: doublePrecision("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerPaymentIdUnique: uniqueIndex("payments_provider_payment_id_unique")
      .on(table.providerPaymentId)
      .where(sql`${table.providerPaymentId} is not null`),
    // Mirrors PaymentRepository.findActivePaymentForBooking's "PENDING or SUCCESS reserves this
    // booking" rule as a DB-level constraint, not just an application-level check — closes the
    // race where two concurrent POST /payments/create-order requests for the same booking both
    // pass the check before either has inserted, and both succeed. FAILED payments are excluded
    // so a booking can still be retried after a failed/expired attempt (see
    // PaymentService.cancelPendingPayment / the payment-expiry job).
    activePaymentPerBookingUnique: uniqueIndex("payments_active_booking_purpose_unique")
      .on(table.bookingId, table.purpose)
      .where(sql`${table.status} <> 'FAILED'`),
    bookingStatusIdx: index("payments_booking_status_idx").on(table.bookingId, table.status),
    customerCreatedIdx: index("payments_customer_created_idx").on(table.customerId, table.createdAt),
  })
);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    providerOrderId: varchar("provider_order_id", { length: 100 }),
    providerTransactionId: varchar("provider_transaction_id", { length: 100 }),
    signature: text("signature"),
    rawResponse: jsonb("raw_response"),
    status: paymentStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerTransactionIdUnique: uniqueIndex("payment_transactions_provider_txn_id_unique")
      .on(table.providerTransactionId)
      .where(sql`${table.providerTransactionId} is not null`),
    paymentIdx: index("payment_transactions_payment_id_idx").on(table.paymentId),
  })
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    amount: doublePrecision("amount").notNull(),
    reason: text("reason"),
    status: refundStatusEnum("status").notNull().default("PENDING"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    paymentStatusIdx: index("refunds_payment_status_idx").on(table.paymentId, table.status),
    customerCreatedIdx: index("refunds_customer_created_idx").on(table.customerId, table.createdAt),
  })
);

export const refundHistory = pgTable(
  "refund_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => refunds.id, { onDelete: "cascade" }),
    oldStatus: refundStatusEnum("old_status"),
    newStatus: refundStatusEnum("new_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    refundIdx: index("refund_history_refund_id_idx").on(table.refundId),
  })
);

// "owner/admin coupons" per TRD §3, but no CRUD endpoint is documented anywhere in
// frontend_handover.md (only POST /payments/coupons/validate) — same precedent as
// service_categories: createdByUserId is nullable so `npm run db:seed` can create
// platform-level coupons with no specific creator.
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    // Module 16 — set only for a strikes-policy forfeiture coupon (see src/modules/strike):
    // when non-null, only this customer may redeem it (assertCouponEligible enforces this).
    // Null for every ordinary platform-wide coupon, unchanged from before this module.
    restrictedToCustomerId: uuid("restricted_to_customer_id").references(() => users.id, { onDelete: "set null" }),
    couponCode: varchar("coupon_code", { length: 50 }).notNull(),
    type: couponTypeEnum("type").notNull(),
    value: doublePrecision("value").notNull(),
    minimumAmount: doublePrecision("minimum_amount"),
    maxDiscount: doublePrecision("max_discount"),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    codeUnique: uniqueIndex("coupons_code_unique").on(table.couponCode).where(sql`${table.deletedAt} is null`),
    activeRangeIdx: index("coupons_active_range_idx").on(table.active, table.startsAt, table.expiresAt),
  })
);

// No documented endpoint applies a coupon to a booking (POST /bookings has no couponCode
// field), so nothing currently writes to this table — POST /payments/coupons/validate is a
// pure preview check with no side effects. Kept per TRD §4 for when that contract exists.
export const couponUsages = pgTable(
  "coupon_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    discountAmount: doublePrecision("discount_amount").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    couponBookingUnique: uniqueIndex("coupon_usages_coupon_booking_unique").on(table.couponId, table.bookingId),
    couponIdx: index("coupon_usages_coupon_id_idx").on(table.couponId),
    customerIdx: index("coupon_usages_customer_id_idx").on(table.customerId),
  })
);

// Same as above — no writer exists yet given the current documented contract.
export const bookingCoupons = pgTable("booking_coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "restrict" }),
  couponCode: varchar("coupon_code", { length: 50 }).notNull(),
  couponType: couponTypeEnum("coupon_type").notNull(),
  discountAmount: doublePrecision("discount_amount").notNull(),
  appliedAmount: doublePrecision("applied_amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// "Manual MVP records" per TRD §4 — nothing creates these yet (no Admin/settlement-generation
// endpoint is documented); GET /payments/salon-settlements is a pure read against whatever
// rows exist, same precedent as salon verification being flipped manually in Postgres.
export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    grossAmount: doublePrecision("gross_amount").notNull().default(0),
    commissionAmount: doublePrecision("commission_amount").notNull().default(0),
    refundAmount: doublePrecision("refund_amount").notNull().default(0),
    adjustmentAmount: doublePrecision("adjustment_amount").notNull().default(0),
    netAmount: doublePrecision("net_amount").notNull().default(0),
    status: settlementStatusEnum("status").notNull().default("PENDING"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    salonStatusCreatedIdx: index("settlements_salon_status_created_idx").on(
      table.salonId,
      table.status,
      table.createdAt
    ),
    branchIdx: index("settlements_branch_id_idx").on(table.branchId),
  })
);

export const settlementBookings = pgTable(
  "settlement_bookings",
  {
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => settlements.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "restrict" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.settlementId, table.bookingId] }),
  })
);
