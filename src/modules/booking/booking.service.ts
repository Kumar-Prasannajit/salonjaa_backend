import { BookingRepository } from "@/modules/booking/booking.repository";
import { AvailabilityRepository } from "@/modules/availability/availability.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { BranchService } from "@/modules/branch/branch.service";
import { StaffService } from "@/modules/staff/staff.service";
import { NotificationService } from "@/modules/notification/notification.service";
import {
  ApproveBookingInput,
  BookingDTO,
  BookingNames,
  BookingServiceLine,
  CreateBookingInput,
  ProposeRescheduleInput,
  RescheduleRequestDTO,
  RescheduleRequestInput,
  WalkInInput,
} from "@/modules/booking/booking.types";
import { BadRequestError, ConflictError, NotFoundError, UnprocessableEntityError } from "@/shared/errors";
import { assertCouponEligible, computeCouponDiscount } from "@/shared/coupon";
import { generateBookingNumber } from "@/shared/crypto";
import { CAPACITY_CONSUMING_BOOKING_STATUSES, ROLE_NAMES } from "@/shared/constants";
import { env } from "@/config/env";
import { scheduleBookingExpiry } from "@/queues/booking-expiry.queue";
import { scheduleBookingCompletion, rescheduleBookingCompletion } from "@/queues/booking-completion.queue";
import { bookings } from "@/db/schema";

type BookingRow = typeof bookings.$inferSelect;
type BookingServiceRow = { serviceId: string; serviceName: string; durationMinutes: number; price: number; quantity: number; totalAmount: number };

export class BookingService {
  constructor(
    private readonly repo: BookingRepository = new BookingRepository(),
    private readonly availabilityRepo: AvailabilityRepository = new AvailabilityRepository(),
    private readonly salonService: SalonService = new SalonService(),
    private readonly branchService: BranchService = new BranchService(),
    private readonly staffService: StaffService = new StaffService(),
    private readonly notificationService: NotificationService = new NotificationService()
  ) {}

  async create(userId: string, input: CreateBookingInput): Promise<{ bookingId: string; status: string }> {
    const branch = await this.availabilityRepo.findBookableBranch(input.branchId);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }
    if (branch.salonId !== input.salonId) {
      throw new BadRequestError("branchId does not belong to the given salonId");
    }

    const holiday = await this.availabilityRepo.findHoliday(input.branchId, input.bookingDate);
    if (holiday) {
      throw new BadRequestError("Branch is closed on this date");
    }

    const { lines, totalDurationMinutes } = await this.resolveServiceLines(input.branchId, input.services);
    const { start, end } = this.resolveSlot(input.bookingDate, input.slotId, totalDurationMinutes, branch);
    const uniqueServiceIds = [...new Set(input.services)];

    const effectiveCapacity = await this.validateStaffAndCapacity(
      input.branchId,
      uniqueServiceIds,
      input.staffId,
      start,
      end,
      branch.totalChairs
    );

    const coupon = input.couponCode ? await this.resolveCoupon(input.couponCode, lines) : undefined;

    const booking = await this.createWithRetry({
      customerId: userId,
      customerName: null,
      customerPhone: null,
      salonId: input.salonId,
      branchId: input.branchId,
      bookingType: "ONLINE",
      bookingStatus: "PENDING",
      selectedStaffId: input.staffId ?? null,
      scheduledStart: start,
      scheduledEnd: end,
      totalDurationMinutes,
      effectiveCapacity,
      notes: input.notes ?? null,
      services: lines,
      changedByUserId: userId,
      coupon,
    });

    await scheduleBookingExpiry(booking.id, env.BOOKING_DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);
    await this.notificationService.notify({
      userId,
      eventType: "BOOKING_CREATED",
      data: { bookingNumber: booking.bookingNumber },
    });

    return { bookingId: booking.id, status: booking.bookingStatus };
  }

  async getDetail(userId: string, roles: string[], bookingId: string): Promise<BookingDTO> {
    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }
    const isOwner = booking.customerId === userId;
    const isAdmin = roles.includes(ROLE_NAMES.ADMIN);
    if (!isOwner && !isAdmin) {
      await this.salonService.assertOwned(userId, booking.salonId);
    }
    const services = await this.repo.findServicesForBooking(bookingId);
    const names = await this.repo.findNamesForBookings([booking]);
    return this.toDTO(booking, services, names.get(booking.id));
  }

  async listMyBookings(userId: string, status?: string): Promise<BookingDTO[]> {
    const rows = await this.repo.listByCustomer(userId, status);
    const names = await this.repo.findNamesForBookings(rows);
    return rows.map((r) => this.toDTO(r, undefined, names.get(r.id)));
  }

  async listSalonBookings(userId: string, status?: string): Promise<BookingDTO[]> {
    const salons = await this.salonService.listMySalons(userId);
    const rows = await this.repo.listBySalonIds(
      salons.map((s) => s.id),
      status
    );
    const names = await this.repo.findNamesForBookings(rows);
    return rows.map((r) => this.toDTO(r, undefined, names.get(r.id)));
  }

  /**
   * PROVISIONAL cancellation policy: any PENDING/APPROVED booking can be cancelled by its
   * customer at any time before scheduled_start, no cutoff, no strike ever recorded. The
   * client's actual cancellation/strike policy is still being decided (context.md Pending
   * Decisions) — the user explicitly asked to ship this safe placeholder now rather than
   * wait. Revisit when the real policy is finalized.
   */
  async cancel(userId: string, bookingId: string, reason?: string): Promise<BookingDTO> {
    const booking = await this.repo.findById(bookingId);
    if (!booking || booking.customerId !== userId) {
      throw new NotFoundError("Booking not found");
    }
    if (!this.isCapacityConsuming(booking.bookingStatus)) {
      throw new ConflictError("Booking cannot be cancelled in its current state");
    }
    const updated = await this.repo.transitionStatus(
      bookingId,
      booking.bookingStatus,
      "CANCELLED",
      { cancelledAt: new Date(), cancellationReason: reason ?? null },
      userId,
      reason
    );

    const ownerUserId = await this.salonService.findOwnerUserId(booking.salonId);
    if (ownerUserId) {
      await this.notificationService.notify({
        userId: ownerUserId,
        eventType: "BOOKING_CANCELLED",
        data: { bookingNumber: booking.bookingNumber, reason: reason ?? "Not specified" },
      });
    }

    return this.toDTO(updated);
  }

  async requestReschedule(userId: string, bookingId: string, input: RescheduleRequestInput): Promise<RescheduleRequestDTO> {
    const booking = await this.repo.findById(bookingId);
    if (!booking || booking.customerId !== userId) {
      throw new NotFoundError("Booking not found");
    }
    if (!this.isCapacityConsuming(booking.bookingStatus)) {
      throw new ConflictError("Only a pending or approved booking can be rescheduled");
    }

    const { start, end } = await this.resolveNewTimeForBooking(booking, input.bookingDate, input.slotId);

    const request = await this.repo.createRescheduleRequest({
      bookingId,
      requestedBy: "CUSTOMER",
      oldScheduledStart: booking.scheduledStart,
      oldScheduledEnd: booking.scheduledEnd,
      newScheduledStart: start,
      newScheduledEnd: end,
      reason: input.reason,
    });

    const ownerUserId = await this.salonService.findOwnerUserId(booking.salonId);
    if (ownerUserId) {
      await this.notificationService.notify({
        userId: ownerUserId,
        eventType: "BOOKING_RESCHEDULE_REQUESTED",
        data: { bookingNumber: booking.bookingNumber },
      });
    }

    return this.toRescheduleDTO(request);
  }

  /** No requestId in the documented route — always resolves the latest PENDING request. */
  async approveReschedule(userId: string, bookingId: string): Promise<BookingDTO> {
    const booking = await this.assertOwnedBooking(userId, bookingId);
    const request = await this.repo.findLatestPendingRescheduleRequest(bookingId);
    if (!request) {
      throw new NotFoundError("No pending reschedule request for this booking");
    }

    const branch = await this.availabilityRepo.findBookableBranch(booking.branchId);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }

    const uniqueServiceIds = await this.getBookingServiceIds(bookingId);
    await this.validateStaffAndCapacity(
      booking.branchId,
      uniqueServiceIds,
      booking.selectedStaffId ?? undefined,
      request.newScheduledStart,
      request.newScheduledEnd,
      branch.totalChairs
    );

    const updated = await this.repo.updateScheduledTime(bookingId, request.newScheduledStart, request.newScheduledEnd);
    await this.repo.resolveRescheduleRequest(request.id, "ACCEPTED");

    // Only an already-APPROVED booking has a completion job scheduled (see approve() below) —
    // reschedule it to the new end time so it doesn't fire early against the old schedule.
    if (booking.bookingStatus === "APPROVED") {
      await rescheduleBookingCompletion(bookingId, request.newScheduledEnd.getTime() - Date.now());
    }
    if (booking.customerId) {
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: "BOOKING_RESCHEDULE_APPROVED",
        data: { bookingNumber: booking.bookingNumber },
      });
    }

    return this.toDTO(updated);
  }

  async rejectReschedule(userId: string, bookingId: string, reason?: string): Promise<RescheduleRequestDTO> {
    const booking = await this.assertOwnedBooking(userId, bookingId);
    const request = await this.repo.findLatestPendingRescheduleRequest(bookingId);
    if (!request) {
      throw new NotFoundError("No pending reschedule request for this booking");
    }
    const updated = await this.repo.resolveRescheduleRequest(request.id, "REJECTED", reason);

    if (booking.customerId) {
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: "BOOKING_RESCHEDULE_REJECTED",
        data: { bookingNumber: booking.bookingNumber },
      });
    }

    return this.toRescheduleDTO(updated);
  }

  async approve(userId: string, bookingId: string, input: ApproveBookingInput): Promise<BookingDTO> {
    const booking = await this.assertOwnedBooking(userId, bookingId);
    if (booking.bookingStatus !== "PENDING") {
      throw new ConflictError("Only a pending booking can be approved");
    }

    // TRD: "Re-read ... selected stylist availability in the transaction" before approving.
    // Capacity itself doesn't need re-counting here — PENDING already reserves capacity, and
    // PENDING/APPROVED are both capacity-consuming, so approval doesn't add new consumption.
    if (booking.selectedStaffId) {
      const leaves = await this.availabilityRepo.findLeavesInRange(
        [booking.selectedStaffId],
        booking.scheduledStart,
        booking.scheduledEnd
      );
      if (leaves.length > 0) {
        throw new ConflictError("Selected staff is now on leave for this booking's time — resolve before approving");
      }
    }

    const updated = await this.repo.transitionStatus(
      bookingId,
      booking.bookingStatus,
      "APPROVED",
      { approvedAt: new Date() },
      userId,
      input.notes
    );

    await scheduleBookingCompletion(bookingId, booking.scheduledEnd.getTime() - Date.now());
    if (booking.customerId) {
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: "BOOKING_APPROVED",
        data: { bookingNumber: booking.bookingNumber },
      });
    }

    return this.toDTO(updated);
  }

  async reject(userId: string, bookingId: string, reason: string): Promise<BookingDTO> {
    const booking = await this.assertOwnedBooking(userId, bookingId);
    if (booking.bookingStatus !== "PENDING") {
      throw new ConflictError("Only a pending booking can be rejected");
    }
    const updated = await this.repo.transitionStatus(
      bookingId,
      booking.bookingStatus,
      "REJECTED",
      { rejectionReason: reason },
      userId,
      reason
    );

    if (booking.customerId) {
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: "BOOKING_REJECTED",
        data: { bookingNumber: booking.bookingNumber, reason },
      });
    }

    return this.toDTO(updated);
  }

  /**
   * Owner-proposed reschedule. No documented endpoint exists yet for the customer to accept
   * or reject this proposal (context.md Pending Decisions flags this exact gap) — the
   * request is created and sits PENDING until such an endpoint is added.
   */
  async proposeReschedule(userId: string, bookingId: string, input: ProposeRescheduleInput): Promise<RescheduleRequestDTO> {
    const booking = await this.assertOwnedBooking(userId, bookingId);
    if (!this.isCapacityConsuming(booking.bookingStatus)) {
      throw new ConflictError("Only a pending or approved booking can be rescheduled");
    }

    const { start, end } = await this.resolveNewTimeForBooking(booking, input.bookingDate, input.slotId);

    const request = await this.repo.createRescheduleRequest({
      bookingId,
      requestedBy: "SALON",
      oldScheduledStart: booking.scheduledStart,
      oldScheduledEnd: booking.scheduledEnd,
      newScheduledStart: start,
      newScheduledEnd: end,
      reason: input.reason,
    });

    if (booking.customerId) {
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: "BOOKING_RESCHEDULE_PROPOSED",
        data: { bookingNumber: booking.bookingNumber },
      });
    }

    return this.toRescheduleDTO(request);
  }

  /**
   * staffId is effectively required (decided with the user) — it's the only field in the
   * documented walk-in body that can resolve which branch this walk-in belongs to.
   */
  async walkIn(userId: string, input: WalkInInput): Promise<BookingDTO> {
    const staffRow = await this.staffService.findRawById(input.staffId);
    if (!staffRow) {
      throw new NotFoundError("Staff not found");
    }
    const branch = await this.branchService.assertOwned(userId, staffRow.branchId);
    if (branch.status !== "ACTIVE") {
      throw new BadRequestError("Branch is not active");
    }

    const holiday = await this.availabilityRepo.findHoliday(branch.id, input.bookingDate);
    if (holiday) {
      throw new BadRequestError("Branch is closed on this date");
    }

    const { lines, totalDurationMinutes } = await this.resolveServiceLines(branch.id, input.services);
    const { start, end } = this.resolveSlot(input.bookingDate, input.slotId, totalDurationMinutes, branch);
    const uniqueServiceIds = [...new Set(input.services)];

    const effectiveCapacity = await this.validateStaffAndCapacity(
      branch.id,
      uniqueServiceIds,
      input.staffId,
      start,
      end,
      branch.totalChairs
    );

    const booking = await this.createWithRetry({
      customerId: null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      salonId: branch.salonId,
      branchId: branch.id,
      bookingType: "WALK_IN",
      // No customer-facing approval flow is required for walk-ins, per TRD — go straight to
      // APPROVED rather than PENDING.
      bookingStatus: "APPROVED",
      selectedStaffId: input.staffId,
      scheduledStart: start,
      scheduledEnd: end,
      totalDurationMinutes,
      effectiveCapacity,
      notes: null,
      services: lines,
      changedByUserId: userId,
    });

    // No notification — walk-in customers have no account (customerId is null).
    await scheduleBookingCompletion(booking.id, end.getTime() - Date.now());

    return this.toDTO(booking);
  }

  // ---- Shared internals ----

  /**
   * Validated eagerly, before the booking transaction opens — matches
   * PaymentService.validateCoupon's existing eligibility rules exactly (shared via
   * src/shared/coupon.ts) rather than re-deriving them. Throws 422 on any ineligibility, so
   * an invalid/expired/exhausted/below-minimum code never silently creates an undiscounted
   * booking.
   *
   * Known gap, flagged rather than silently accepted: `usageLimit` isn't re-checked inside
   * the booking's own transaction (repositories don't throw AppError, per CONVENTIONS.md, so
   * a fresh in-transaction re-validation doesn't fit cleanly) — under high concurrent load a
   * coupon could theoretically be used one or two times past its limit. Same "MVP, revisit if
   * it matters" treatment as this module's other provisional policies.
   */
  private async resolveCoupon(
    couponCode: string,
    lines: BookingServiceLine[]
  ): Promise<{ couponId: string; couponCode: string; couponType: "FIXED" | "PERCENTAGE"; discountAmount: number }> {
    const coupon = await this.repo.findActiveCouponByCode(couponCode);
    if (!coupon) {
      throw new UnprocessableEntityError("Coupon not found or inactive");
    }
    const subtotalAmount = lines.reduce((sum, l) => sum + l.totalAmount, 0);
    assertCouponEligible(coupon, subtotalAmount);
    const discountAmount = computeCouponDiscount(coupon, subtotalAmount);
    return { couponId: coupon.id, couponCode: coupon.couponCode, couponType: coupon.type, discountAmount };
  }

  private isCapacityConsuming(status: string): boolean {
    return (CAPACITY_CONSUMING_BOOKING_STATUSES as readonly string[]).includes(status);
  }

  private async assertOwnedBooking(userId: string, bookingId: string): Promise<BookingRow> {
    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }
    await this.salonService.assertOwned(userId, booking.salonId);
    return booking;
  }

  private async getBookingServiceIds(bookingId: string): Promise<string[]> {
    const rows = await this.repo.findServicesForBooking(bookingId);
    return [...new Set(rows.map((r) => r.serviceId))];
  }

  private async resolveNewTimeForBooking(
    booking: BookingRow,
    bookingDate: string,
    slotId: string
  ): Promise<{ start: Date; end: Date }> {
    const branch = await this.availabilityRepo.findBookableBranch(booking.branchId);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }
    const holiday = await this.availabilityRepo.findHoliday(booking.branchId, bookingDate);
    if (holiday) {
      throw new BadRequestError("Branch is closed on this date");
    }
    // Only a light branch-hours/holiday check happens at request/propose time. The real
    // capacity/staff recheck happens at approve time, matching the TRD's "recheck in the
    // mutation transaction" philosophy for the moment state actually changes.
    return this.resolveSlot(bookingDate, slotId, booking.totalDurationMinutes, branch);
  }

  private async resolveServiceLines(
    branchId: string,
    serviceIds: string[]
  ): Promise<{ lines: BookingServiceLine[]; totalDurationMinutes: number }> {
    const uniqueIds = [...new Set(serviceIds)];
    const services = await this.availabilityRepo.findActiveServices(branchId, uniqueIds);
    if (services.length !== uniqueIds.length) {
      throw new BadRequestError("One or more services are invalid, inactive, or not part of this branch");
    }

    const counts = new Map<string, number>();
    for (const id of serviceIds) counts.set(id, (counts.get(id) ?? 0) + 1);

    const lines: BookingServiceLine[] = services.map((s) => {
      const quantity = counts.get(s.id) ?? 1;
      return {
        serviceId: s.id,
        serviceName: s.name,
        durationMinutes: s.durationMinutes,
        price: s.basePrice,
        quantity,
        totalAmount: s.basePrice * quantity,
      };
    });
    const totalDurationMinutes = lines.reduce((sum, l) => sum + l.durationMinutes * l.quantity, 0);
    return { lines, totalDurationMinutes };
  }

  private async validateStaffAndCapacity(
    branchId: string,
    uniqueServiceIds: string[],
    staffId: string | undefined,
    start: Date,
    end: Date,
    totalChairs: number
  ): Promise<number> {
    const eligibleStaff = await this.availabilityRepo.findEligibleStaff(branchId, uniqueServiceIds);

    if (staffId) {
      const staffEligible = eligibleStaff.some((s) => s.id === staffId);
      if (!staffEligible) {
        throw new BadRequestError("Selected staff is not eligible for the requested services");
      }
      const leaves = await this.availabilityRepo.findLeavesInRange([staffId], start, end);
      if (leaves.length > 0) {
        throw new ConflictError("Selected staff is on leave during this time");
      }
    }

    const leavesForCapacity = await this.availabilityRepo.findLeavesInRange(
      eligibleStaff.map((s) => s.id),
      start,
      end
    );
    const onLeave = new Set(leavesForCapacity.map((l) => l.staffId));
    const activeStaffCount = eligibleStaff.length - onLeave.size;
    const capacityRule = await this.availabilityRepo.findCapacityOverride(branchId);
    const effectiveCapacity = Math.min(totalChairs, activeStaffCount, capacityRule?.maxCapacityOverride ?? Number.POSITIVE_INFINITY);

    if (effectiveCapacity <= 0) {
      throw new ConflictError("No capacity available for the requested services at this time");
    }
    return effectiveCapacity;
  }

  private resolveSlot(
    date: string,
    slotId: string,
    durationMinutes: number,
    branch: { openingTime: string; closingTime: string }
  ): { start: Date; end: Date } {
    const [startLabel] = slotId.split("-");
    const start = this.buildDateTime(date, startLabel);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const dayStart = this.buildDateTime(date, branch.openingTime);
    const dayEnd = this.buildDateTime(date, branch.closingTime);

    if (start.getTime() < dayStart.getTime() || end.getTime() > dayEnd.getTime()) {
      throw new BadRequestError("Requested time is outside branch operating hours");
    }
    return { start, end };
  }

  private buildDateTime(date: string, time: string): Date {
    const [hh, mm] = time.split(":");
    return new Date(`${date}T${hh}:${mm}:00`);
  }

  private async createWithRetry(
    params: {
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
      coupon?: { couponId: string; couponCode: string; couponType: "FIXED" | "PERCENTAGE"; discountAmount: number };
    },
    attempt = 0
  ): Promise<BookingRow> {
    const bookingNumber = generateBookingNumber();
    try {
      return await this.repo.createBookingTransactional({ ...params, bookingNumber });
    } catch (err) {
      if (attempt < 2 && this.isUniqueViolation(err)) {
        return this.createWithRetry(params, attempt + 1);
      }
      throw err;
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
  }

  private toDTO(booking: BookingRow, services?: BookingServiceRow[], names?: BookingNames): BookingDTO {
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      salonId: booking.salonId,
      branchId: booking.branchId,
      bookingType: booking.bookingType,
      bookingStatus: booking.bookingStatus,
      selectedStaffId: booking.selectedStaffId,
      scheduledStart: booking.scheduledStart.toISOString(),
      scheduledEnd: booking.scheduledEnd.toISOString(),
      totalDurationMinutes: booking.totalDurationMinutes,
      subtotalAmount: booking.subtotalAmount,
      discountAmount: booking.discountAmount,
      taxAmount: booking.taxAmount,
      totalAmount: booking.totalAmount,
      notes: booking.notes,
      rejectionReason: booking.rejectionReason,
      cancellationReason: booking.cancellationReason,
      approvedAt: booking.approvedAt?.toISOString() ?? null,
      completedAt: booking.completedAt?.toISOString() ?? null,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      expiredAt: booking.expiredAt?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
      services: services?.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        durationMinutes: s.durationMinutes,
        price: s.price,
        quantity: s.quantity,
        totalAmount: s.totalAmount,
      })),
      salonName: names?.salonName ?? null,
      branchName: names?.branchName ?? null,
      city: names?.city ?? null,
      staffName: names?.staffName ?? null,
    };
  }

  private toRescheduleDTO(request: {
    id: string;
    bookingId: string;
    requestedBy: string;
    oldScheduledStart: Date;
    oldScheduledEnd: Date;
    newScheduledStart: Date;
    newScheduledEnd: Date;
    reason: string | null;
    status: string;
  }): RescheduleRequestDTO {
    return {
      id: request.id,
      bookingId: request.bookingId,
      requestedBy: request.requestedBy,
      oldScheduledStart: request.oldScheduledStart.toISOString(),
      oldScheduledEnd: request.oldScheduledEnd.toISOString(),
      newScheduledStart: request.newScheduledStart.toISOString(),
      newScheduledEnd: request.newScheduledEnd.toISOString(),
      reason: request.reason,
      status: request.status,
    };
  }
}
