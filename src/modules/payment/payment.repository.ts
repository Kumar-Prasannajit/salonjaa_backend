import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { payments, paymentTransactions, refunds, refundHistory, coupons, settlements } from "@/db/schema";

interface CreatePaymentParams {
  bookingId: string;
  customerId: string | null;
  method: "ONLINE" | "PAY_AT_SALON";
  // Module 16 — defaults to FULL (every payment before this module was implicitly FULL).
  purpose?: "FULL" | "ADVANCE";
  provider: "RAZORPAY" | "CASHFREE" | "NONE";
  providerOrderId: string | null;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

interface CreateTransactionParams {
  paymentId: string;
  provider: "RAZORPAY" | "CASHFREE" | "NONE";
  providerOrderId?: string | null;
  providerTransactionId?: string | null;
  signature?: string | null;
  rawResponse?: unknown;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

interface CreateRefundParams {
  bookingId: string;
  paymentId: string;
  customerId: string | null;
  amount: number;
  reason?: string;
}

export class PaymentRepository {
  async createPayment(params: CreatePaymentParams) {
    const [row] = await db.insert(payments).values(params).returning();
    return row;
  }

  async createTransaction(params: CreateTransactionParams) {
    const [row] = await db
      .insert(paymentTransactions)
      .values({ ...params, rawResponse: params.rawResponse ?? null })
      .returning();
    return row;
  }

  async findById(paymentId: string) {
    const [row] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    return row ?? null;
  }

  async findByProviderOrderId(orderId: string) {
    const [row] = await db.select().from(payments).where(eq(payments.providerOrderId, orderId)).limit(1);
    return row ?? null;
  }

  /** A PENDING or SUCCESS payment already reserves this booking — used to block duplicate order creation. */
  async findActivePaymentForBooking(bookingId: string, purpose: "FULL" | "ADVANCE" = "FULL") {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(eq(payments.bookingId, bookingId), eq(payments.purpose, purpose), inArray(payments.status, ["PENDING", "SUCCESS"]))
      )
      .limit(1);
    return row ?? null;
  }

  /** Module 16 — defaults to FULL so refund-request never picks up a non-refundable ADVANCE
   * payment (see BookingService.cancel's forfeiture-coupon path instead). */
  async findSuccessfulPaymentForBooking(bookingId: string, purpose: "FULL" | "ADVANCE" = "FULL") {
    const [row] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), eq(payments.purpose, purpose), eq(payments.status, "SUCCESS")))
      .limit(1);
    return row ?? null;
  }

  async updateStatus(paymentId: string, status: "SUCCESS" | "FAILED", extra: Record<string, unknown> = {}) {
    const [row] = await db
      .update(payments)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(eq(payments.id, paymentId))
      .returning();
    return row;
  }

  async listByCustomer(customerId: string) {
    return db.select().from(payments).where(eq(payments.customerId, customerId)).orderBy(desc(payments.createdAt));
  }

  // ---- Refunds ----

  async findRefundForPayment(paymentId: string) {
    const [row] = await db.select().from(refunds).where(eq(refunds.paymentId, paymentId)).limit(1);
    return row ?? null;
  }

  async createRefund(params: CreateRefundParams) {
    return db.transaction(async (tx) => {
      const [refund] = await tx.insert(refunds).values(params).returning();
      await tx.insert(refundHistory).values({
        refundId: refund.id,
        oldStatus: null,
        newStatus: refund.status,
        changedBy: params.customerId,
      });
      return refund;
    });
  }

  async listRefundsByCustomer(customerId: string) {
    return db.select().from(refunds).where(eq(refunds.customerId, customerId)).orderBy(desc(refunds.createdAt));
  }

  // ---- Coupons ----

  async findActiveCouponByCode(code: string) {
    const [row] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.couponCode, code), eq(coupons.active, true), isNull(coupons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  // ---- Settlements ----

  async listSettlementsBySalonIds(salonIds: string[]) {
    if (salonIds.length === 0) return [];
    return db
      .select()
      .from(settlements)
      .where(inArray(settlements.salonId, salonIds))
      .orderBy(desc(settlements.createdAt));
  }
}
