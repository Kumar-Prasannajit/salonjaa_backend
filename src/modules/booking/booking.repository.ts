import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { bookings, bookingServices, bookingStatusHistory, bookingRescheduleRequests } from "@/db/schema";
import { CAPACITY_CONSUMING_BOOKING_STATUSES } from "@/shared/constants";
import { ConflictError } from "@/shared/errors";
import { BookingServiceLine } from "@/modules/booking/booking.types";

interface CreateBookingParams {
  bookingNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  salonId: string;
  branchId: string;
  bookingType: "ONLINE" | "WALK_IN";
  bookingStatus: "PENDING" | "APPROVED";
  selectedStaffId: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
  totalDurationMinutes: number;
  effectiveCapacity: number;
  notes: string | null;
  services: BookingServiceLine[];
  changedByUserId: string | null;
}

export class BookingRepository {
  async findById(bookingId: string) {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    return row ?? null;
  }

  async findServicesForBooking(bookingId: string) {
    return db.select().from(bookingServices).where(eq(bookingServices.bookingId, bookingId));
  }

  async listByCustomer(customerId: string, status?: string) {
    const conditions = [eq(bookings.customerId, customerId)];
    if (status) conditions.push(eq(bookings.bookingStatus, status as never));
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
          selectedStaffId: params.selectedStaffId,
          scheduledStart: params.scheduledStart,
          scheduledEnd: params.scheduledEnd,
          totalDurationMinutes: params.totalDurationMinutes,
          subtotalAmount,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotalAmount,
          notes: params.notes,
          approvedAt: params.bookingStatus === "APPROVED" ? new Date() : null,
        })
        .returning();

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
          }))
        );
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
}
