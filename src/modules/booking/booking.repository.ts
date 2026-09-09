import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/config/database";
import {
  bookings,
  bookingServices,
  bookingStatusHistory,
  bookingRescheduleRequests,
  bookingCoupons,
  couponUsages,
  coupons,
  payments,
  salons,
  branches,
  staff,
  wallets,
  walletTransactions,
} from "@/db/schema";
import { CAPACITY_CONSUMING_BOOKING_STATUSES } from "@/shared/constants";
import { ConflictError, UnprocessableEntityError } from "@/shared/errors";
import { BookingNames, BookingServiceLine } from "@/modules/booking/booking.types";

interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  couponType: "FIXED" | "PERCENTAGE";
  discountAmount: number;
}

interface CreateBookingParams {
  bookingNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  salonId: string;
  branchId: string;
  bookingType: "ONLINE" | "WALK_IN";
  bookingStatus: "PENDING" | "APPROVED";
  // Module 14b — see PROGRESS.md's Module 14b entry. Module 20 adds WALLET.
  paymentMethod: "ONLINE" | "PAY_AT_SALON" | "WALLET";
  selectedStaffId: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
  totalDurationMinutes: number;
  effectiveCapacity: number;
  notes: string | null;
  services: BookingServiceLine[];
  changedByUserId: string | null;
  // Already validated + priced by the service before this is called (see
  // BookingService.create) — the repository only writes what it's given, per convention
  // (repositories never validate/throw AppError). Optional: only present when the request
  // carried a couponCode.
  coupon?: AppliedCoupon;
  // Module 16 — frozen at creation time by BookingService (see StrikeService); the repository
  // just persists what it's told, same as everything else in this file.
  requiresAdvancePayment: boolean;
  advanceAmount: number | null;
}

export class BookingRepository {
  async findById(bookingId: string) {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    return row ?? null;
  }

  /**
   * Own copy of the same lookup PaymentRepository.findActiveCouponByCode already has —
   * deliberately not reused across modules, same precedent as Module 9b's admin-refund.*
   * querying directly rather than reusing PaymentRepository.
   */
  async findActiveCouponByCode(code: string) {
    const [row] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.couponCode, code), eq(coupons.active, true), isNull(coupons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findServicesForBooking(bookingId: string) {
    return db.select().from(bookingServices).where(eq(bookingServices.bookingId, bookingId));
  }

  /**
   * Resolves salonName/branchName/city/staffName for a batch of bookings in three bulk
   * queries (never N+1), keyed by bookingId. Used by both getDetail (a 1-element batch) and
   * listMyBookings/listSalonBookings — see docs/PROGRESS.md's "booking responses have no
   * resolved names" note. A booking whose salon/branch/staff row is somehow missing (should
   * never happen — these are `restrict`-on-delete FKs) resolves that one field to null rather
   * than throwing, since this is display-only enrichment, not the booking's own data.
   */
  async findNamesForBookings(rows: (typeof bookings.$inferSelect)[]): Promise<Map<string, BookingNames>> {
    const salonIds = [...new Set(rows.map((r) => r.salonId))];
    const branchIds = [...new Set(rows.map((r) => r.branchId))];
    const staffIds = [...new Set(rows.map((r) => r.selectedStaffId).filter((id): id is string => id !== null))];

    const [salonRows, branchRows, staffRows] = await Promise.all([
      salonIds.length
        ? db.select({ id: salons.id, name: salons.name }).from(salons).where(inArray(salons.id, salonIds))
        : Promise.resolve([]),
      branchIds.length
        ? db
            .select({ id: branches.id, name: branches.name, city: branches.city, phone: branches.phone })
            .from(branches)
            .where(inArray(branches.id, branchIds))
        : Promise.resolve([]),
      staffIds.length
        ? db.select({ id: staff.id, fullName: staff.fullName }).from(staff).where(inArray(staff.id, staffIds))
        : Promise.resolve([]),
    ]);

    const salonMap = new Map(salonRows.map((s) => [s.id, s.name]));
    const branchMap = new Map(branchRows.map((b) => [b.id, { name: b.name, city: b.city, phone: b.phone }]));
    const staffMap = new Map(staffRows.map((s) => [s.id, s.fullName]));

    const result = new Map<string, BookingNames>();
    for (const r of rows) {
      const branch = branchMap.get(r.branchId);
      result.set(r.id, {
        salonName: salonMap.get(r.salonId) ?? null,
        branchName: branch?.name ?? null,
        city: branch?.city ?? null,
        staffName: r.selectedStaffId ? staffMap.get(r.selectedStaffId) ?? null : null,
        branchPhone: branch?.phone ?? null,
      });
    }
    return result;
  }

  async listByCustomer(customerId: string, status?: string | string[]) {
    const conditions = [eq(bookings.customerId, customerId)];
    if (Array.isArray(status)) {
      if (status.length > 0) conditions.push(inArray(bookings.bookingStatus, status as never[]));
    } else if (status) {
      conditions.push(eq(bookings.bookingStatus, status as never));
    }
    return db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.createdAt));
  }

  async listBySalonIds(salonIds: string[], status?: string) {
    if (salonIds.length === 0) return [];
    const conditions = [inArray(bookings.salonId, salonIds)];
    if (status) conditions.push(eq(bookings.bookingStatus, status as never));
    return db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.createdAt));
  }

  /**
   * Creates a booking inside one transaction, serialized per-branch via a Postgres advisory
   * lock (pg_advisory_xact_lock) so two concurrent requests for the same branch/time never
   * both pass the capacity check. Redis is deliberately not involved — decided with the user
   * (Postgres transaction only), matching "Redis is never the booking source of truth."
   */
  async createBookingTransactional(params: CreateBookingParams) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${params.branchId}))`);

      const overlapping = await tx
        .select({ id: bookings.id, selectedStaffId: bookings.selectedStaffId })
        .from(bookings)
        .where(
          and(
            eq(bookings.branchId, params.branchId),
            inArray(bookings.bookingStatus, [...CAPACITY_CONSUMING_BOOKING_STATUSES]),
            lt(bookings.scheduledStart, params.scheduledEnd),
            gt(bookings.scheduledEnd, params.scheduledStart)
          )
        );

      if (overlapping.length >= params.effectiveCapacity) {
        throw new ConflictError("This slot is no longer available");
      }

      if (params.selectedStaffId && overlapping.some((b) => b.selectedStaffId === params.selectedStaffId)) {
        throw new ConflictError("Selected staff is no longer available for this time");
      }

      const subtotalAmount = params.services.reduce((sum, s) => sum + s.totalAmount, 0);
      const discountAmount = params.coupon?.discountAmount ?? 0;
      const totalAmount = subtotalAmount - discountAmount;

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingNumber: params.bookingNumber,
          customerId: params.customerId,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          salonId: params.salonId,
          branchId: params.branchId,
          bookingType: params.bookingType,
          bookingStatus: params.bookingStatus,
          paymentMethod: params.paymentMethod,
          selectedStaffId: params.selectedStaffId,
          scheduledStart: params.scheduledStart,
          scheduledEnd: params.scheduledEnd,
          totalDurationMinutes: params.totalDurationMinutes,
          subtotalAmount,
          discountAmount,
          taxAmount: 0,
          totalAmount,
          notes: params.notes,
          requiresAdvancePayment: params.requiresAdvancePayment,
          advanceAmount: params.advanceAmount,
          approvedAt: params.bookingStatus === "APPROVED" ? new Date() : null,
        })
        .returning();

      // Module 20 — a customer paying by wallet is debited immediately, inside this same
      // transaction, so a failure anywhere else in booking creation rolls the debit back too.
      // Deliberately NOT delegated to WalletRepository.debit (which opens its own transaction —
      // see WalletService's note): inlined here directly, same "own repository, don't share a
      // transaction across module boundaries" precedent as the coupon writes just below. An
      // insufficient balance throws 422 here and unwinds the whole transaction, so no booking
      // is ever created against a wallet spend that didn't actually happen — same "don't
      // silently create an undiscounted/unpaid booking" philosophy as the coupon check.
      if (params.paymentMethod === "WALLET") {
        // Only ever reached via the authenticated customer flow (POST /bookings) — walk-ins
        // always hardcode PAY_AT_SALON — so customerId is always present here.
        const customerId = params.customerId as string;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${customerId}))`);
        const [existingWallet] = await tx.select().from(wallets).where(eq(wallets.userId, customerId)).limit(1);
        const wallet = existingWallet ?? (await tx.insert(wallets).values({ userId: customerId, balance: 0 }).returning())[0];
        if (wallet.balance < totalAmount) {
          throw new UnprocessableEntityError("Insufficient wallet balance");
        }
        const balanceAfter = wallet.balance - totalAmount;
        await tx.update(wallets).set({ balance: balanceAfter, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
        await tx.insert(walletTransactions).values({
          walletId: wallet.id,
          type: "DEBIT",
          amount: totalAmount,
          balanceAfter,
          reason: "BOOKING_PAYMENT",
          referenceId: booking.id,
          description: `Booking ${booking.bookingNumber}`,
        });
      }

      if (params.services.length > 0) {
        await tx.insert(bookingServices).values(
          params.services.map((s) => ({
            bookingId: booking.id,
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            durationMinutes: s.durationMinutes,
            price: s.price,
            quantity: s.quantity,
            totalAmount: s.totalAmount,
            variantId: s.variantId,
            variantName: s.variantName,
          }))
        );
      }

      // First real writer of booking_coupons/coupon_usages — both tables existed since
      // Module 7 with zero consumers (POST /bookings had no couponCode field). See
      // docs/PROGRESS.md's "coupon can never attach to a booking" note (Module 12).
      if (params.coupon) {
        await tx.insert(bookingCoupons).values({
          bookingId: booking.id,
          couponCode: params.coupon.couponCode,
          couponType: params.coupon.couponType,
          discountAmount: params.coupon.discountAmount,
          appliedAmount: totalAmount,
        });
        await tx.insert(couponUsages).values({
          couponId: params.coupon.couponId,
          bookingId: booking.id,
          customerId: params.customerId,
          discountAmount: params.coupon.discountAmount,
        });
        await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() })
          .where(eq(coupons.id, params.coupon.couponId));
      }

      await tx.insert(bookingStatusHistory).values({
        bookingId: booking.id,
        oldStatus: null,
        newStatus: booking.bookingStatus,
        changedByUserId: params.changedByUserId,
      });

      return booking;
    });
  }

  async transitionStatus(
    bookingId: string,
    oldStatus: string,
    newStatus: string,
    extraFields: Record<string, unknown>,
    changedByUserId: string | null,
    notes?: string
  ) {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookings)
        .set({ bookingStatus: newStatus as never, updatedAt: new Date(), ...extraFields })
        .where(eq(bookings.id, bookingId))
        .returning();

      await tx.insert(bookingStatusHistory).values({
        bookingId,
        oldStatus: oldStatus as never,
        newStatus: newStatus as never,
        changedByUserId,
        notes,
      });

      return updated;
    });
  }

  async updateScheduledTime(bookingId: string, scheduledStart: Date, scheduledEnd: Date) {
    const [updated] = await db
      .update(bookings)
      .set({ scheduledStart, scheduledEnd, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();
    return updated;
  }

  // ---- Reschedule requests ----

  async createRescheduleRequest(params: {
    bookingId: string;
    requestedBy: "CUSTOMER" | "SALON";
    oldScheduledStart: Date;
    oldScheduledEnd: Date;
    newScheduledStart: Date;
    newScheduledEnd: Date;
    reason?: string;
  }) {
    const [row] = await db.insert(bookingRescheduleRequests).values(params).returning();
    return row;
  }

  /** No requestId in the documented routes — always resolves the latest PENDING request. */
  async findLatestPendingRescheduleRequest(bookingId: string) {
    const [row] = await db
      .select()
      .from(bookingRescheduleRequests)
      .where(and(eq(bookingRescheduleRequests.bookingId, bookingId), eq(bookingRescheduleRequests.status, "PENDING")))
      .orderBy(desc(bookingRescheduleRequests.createdAt))
      .limit(1);
    return row ?? null;
  }

  async resolveRescheduleRequest(requestId: string, status: "ACCEPTED" | "REJECTED", responseReason?: string) {
    const [row] = await db
      .update(bookingRescheduleRequests)
      .set({ status, respondedAt: new Date(), responseReason })
      .where(eq(bookingRescheduleRequests.id, requestId))
      .returning();
    return row;
  }

  // ---- Module 16: strikes / advance payment ----

  /** Own copy of PaymentRepository's payments lookup, same "own repository, direct cross-table
   * query" precedent as findNamesForBookings above (salons/branches/staff). */
  async findSuccessfulAdvancePayment(bookingId: string) {
    const [row] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), eq(payments.purpose, "ADVANCE"), eq(payments.status, "SUCCESS")))
      .limit(1);
    return row ?? null;
  }
}
