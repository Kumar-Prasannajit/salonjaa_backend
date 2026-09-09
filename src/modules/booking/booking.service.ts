import { BookingRepository } from "@/modules/booking/booking.repository";
import { AvailabilityRepository } from "@/modules/availability/availability.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { BranchService } from "@/modules/branch/branch.service";
import { StaffService } from "@/modules/staff/staff.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { StrikeService } from "@/modules/strike/strike.service";
import { WalletService } from "@/modules/wallet/wallet.service";
import {
  ApproveBookingInput,
  BookingDTO,
  BookingNames,
  BookingServiceLine,
  CancelBookingInput,
  CreateBookingInput,
  ProposeRescheduleInput,
  RescheduleRequestDTO,
  RescheduleRequestInput,
  WalkInInput,
} from "@/modules/booking/booking.types";
import { BadRequestError, ConflictError, NotFoundError, UnprocessableEntityError } from "@/shared/errors";
import { assertCouponEligible, computeCouponDiscount } from "@/shared/coupon";
import { generateBookingNumber } from "@/shared/crypto";
import { CANCELLATION_CUTOFF_HOURS, CAPACITY_CONSUMING_BOOKING_STATUSES, ROLE_NAMES } from "@/shared/constants";
import { env } from "@/config/env";
import { scheduleBookingExpiry } from "@/queues/booking-expiry.queue";
import { scheduleBookingCompletion, rescheduleBookingCompletion } from "@/queues/booking-completion.queue";
import { schedulePaymentWindowExpiry } from "@/queues/payment-window-expiry.queue";
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
    private readonly notificationService: NotificationService = new NotificationService(),
    private readonly strikeService: StrikeService = new StrikeService(),
    private readonly walletService: WalletService = new WalletService()
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

    const coupon = input.couponCode ? await this.resolveCoupon(input.couponCode, lines, userId) : undefined;
    const paymentMethod = input.paymentMethod ?? "ONLINE";

    // Module 16 — a restricted customer (4+ lifetime NO_SHOW strikes) choosing PAY_AT_SALON
    // now needs a 10% advance deposit before the salon reviews it; choosing ONLINE already
    // pays the full amount upfront, which already exceeds what the advance is meant to
    // secure, so no separate advance is layered on top of it.
    let requiresAdvancePayment = false;
    let advanceAmount: number | null = null;
    if (paymentMethod === "PAY_AT_SALON" && (await this.strikeService.isAdvancePaymentRequired(userId))) {
      requiresAdvancePayment = true;
      const subtotalAmount = lines.reduce((sum, l) => sum + l.totalAmount, 0);
      const totalAmount = subtotalAmount - (coupon?.discountAmount ?? 0);
      advanceAmount = this.strikeService.computeAdvanceAmount(totalAmount);
    }

    const booking = await this.createWithRetry({
      customerId: userId,
      customerName: null,
      customerPhone: null,
      salonId: input.salonId,
      branchId: input.branchId,
      bookingType: "ONLINE",
      bookingStatus: "PENDING",
      paymentMethod,
      selectedStaffId: input.staffId ?? null,
      scheduledStart: start,
      scheduledEnd: end,
      totalDurationMinutes,
      effectiveCapacity,
      notes: input.notes ?? null,
      services: lines,
      changedByUserId: userId,
      coupon,
      requiresAdvancePayment,
      advanceAmount,
    });

    await scheduleBookingExpiry(booking.id, env.BOOKING_DEFAULT_EXPIRY_MINUTES * 60 * 1000);
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

  /**
   * Backs GET /users/me/bookings (Module 2's deferred endpoint, closed out now that Booking
   * exists — see docs/PROGRESS.md). Its documented status filter (`COMPLETED|CANCELLED|
   * UPCOMING`) doesn't match any real `bookingStatus` value 1:1 — COMPLETED/CANCELLED map
   * directly, UPCOMING is synthetic (any not-yet-resolved booking: PENDING/AWAITING_PAYMENT/
   * APPROVED — the same set `isCapacityConsuming` already treats as "still active").
   */
  async listMyBookingHistory(userId: string, status?: "COMPLETED" | "CANCELLED" | "UPCOMING"): Promise<BookingDTO[]> {
    const statusFilter = status === "UPCOMING" ? [...CAPACITY_CONSUMING_BOOKING_STATUSES] : status;
    const rows = await this.repo.listByCustomer(userId, statusFilter);
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
   * Cancellation policy (finalized Module 16 — was provisional/no-cutoff before): a
   * PENDING/APPROVED/AWAITING_PAYMENT booking can be cancelled by its customer any time up to
   * CANCELLATION_CUTOFF_HOURS before scheduledStart; inside that window, cancellation is
   * blocked entirely (decided with the user — no "late cancel with strike" path).
   *
   * If this booking had a paid advance deposit (Module 16 strikes policy), that deposit is
   * forfeited rather than refunded — see forfeitAdvanceToWallet. If it was paid in full by
   * wallet (Module 20), that spend IS refunded back in full — see refundWalletPaymentIfAny —
   * these are two different money layers and don't conflict (a WALLET-paid booking never has
   * requiresAdvancePayment set — see create()).
   */
  async cancel(userId: string, bookingId: string, input: CancelBookingInput): Promise<BookingDTO> {
    const { reasonCode, reason } = input;
    const booking = await this.repo.findById(bookingId);
    if (!booking || booking.customerId !== userId) {
      throw new NotFoundError("Booking not found");
    }
    if (!this.isCapacityConsuming(booking.bookingStatus)) {
      throw new ConflictError("Booking cannot be cancelled in its current state");
    }
    const hoursUntilStart = (booking.scheduledStart.getTime() - Date.now()) / 3_600_000;
    if (hoursUntilStart < CANCELLATION_CUTOFF_HOURS) {
      throw new ConflictError(`Cancellation is only allowed until ${CANCELLATION_CUTOFF_HOURS} hours before the scheduled time`);
    }
    const updated = await this.repo.transitionStatus(
      bookingId,
      booking.bookingStatus,
      "CANCELLED",
      { cancelledAt: new Date(), cancellationReason: reason ?? null, cancellationReasonCode: reasonCode ?? null },
      userId,
      reason
    );

    if (booking.requiresAdvancePayment) {
      await this.forfeitAdvanceToWallet(booking);
    }
    await this.refundWalletPaymentIfAny(booking);

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

  /**
   * No requestId in the documented route — always resolves the latest PENDING request.
   *
   * Handles BOTH directions on the same endpoint (context.md's Pending Decisions flagged this
   * exact gap: "supplied inventory gives owner approve/reject endpoints while BRD also
   * requires customer response to salon proposals" — no separate customer-facing route name
   * was ever specified). Resolved by making the responder generic: whoever did NOT propose
   * the pending request is the one who must respond — a CUSTOMER-initiated request needs the
   * owning Salon Owner to act (existing behavior, unchanged), a SALON-initiated request needs
   * the booking's own customer to act. See `assertRescheduleResponder`. Route-level
   * `requireRole(SALON_OWNER)` was removed for this reason — `requireAuth` (from the router's
   * `router.use`) plus this in-service check is now what gates it, same "ownership checked in
   * the service, not the route" pattern as GET /bookings/:id.
   */
  async approveReschedule(userId: string, bookingId: string): Promise<BookingDTO> {
    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }
    const request = await this.repo.findLatestPendingRescheduleRequest(bookingId);
    if (!request) {
      throw new NotFoundError("No pending reschedule request for this booking");
    }
    await this.assertRescheduleResponder(userId, booking, request);

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
    // Notify whoever proposed the change, not whoever just responded to it.
    await this.notifyRescheduleResolution(booking, request.requestedBy, "BOOKING_RESCHEDULE_APPROVED");

    return this.toDTO(updated);
  }

  async rejectReschedule(userId: string, bookingId: string, reason?: string): Promise<RescheduleRequestDTO> {
    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }
    const request = await this.repo.findLatestPendingRescheduleRequest(bookingId);
    if (!request) {
      throw new NotFoundError("No pending reschedule request for this booking");
    }
    await this.assertRescheduleResponder(userId, booking, request);
    const updated = await this.repo.resolveRescheduleRequest(request.id, "REJECTED", reason);

    await this.notifyRescheduleResolution(booking, request.requestedBy, "BOOKING_RESCHEDULE_REJECTED");

    return this.toRescheduleDTO(updated);
  }

  async approve(userId: string, bookingId: string, input: ApproveBookingInput): Promise<BookingDTO> {
    const booking = await this.assertOwnedBooking(userId, bookingId);
    if (booking.bookingStatus !== "PENDING") {
      throw new ConflictError("Only a pending booking can be approved");
    }

    // Module 16 — a restricted customer's advance deposit must clear before the owner can
    // even approve, not just before payment: it's the whole point of requiring it upfront.
    if (booking.requiresAdvancePayment) {
      const advancePayment = await this.repo.findSuccessfulAdvancePayment(bookingId);
      if (!advancePayment) {
        throw new ConflictError("This booking's advance payment hasn't been completed yet");
      }
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

    // Module 14b — see PROGRESS.md's Module 14b entry. PAY_AT_SALON keeps the pre-existing
    // behavior exactly (straight to APPROVED, no online payment ever expected). ONLINE now
    // stops at AWAITING_PAYMENT until the customer actually pays.
    const payingOnline = booking.paymentMethod === "ONLINE";
    const nextStatus = payingOnline ? "AWAITING_PAYMENT" : "APPROVED";

    const updated = await this.repo.transitionStatus(
      bookingId,
      booking.bookingStatus,
      nextStatus,
      { approvedAt: new Date() },
      userId,
      input.notes
    );

    if (payingOnline) {
      await schedulePaymentWindowExpiry(bookingId, env.BOOKING_PAYMENT_WINDOW_MINUTES * 60 * 1000);
    } else {
      // Only a PAY_AT_SALON (or walk-in, which never reaches approve()) booking is actually
      // confirmed at this point — an ONLINE booking's completion job now waits for payment
      // success (see PaymentService.verifyPayment).
      await scheduleBookingCompletion(bookingId, booking.scheduledEnd.getTime() - Date.now());
    }

    if (booking.customerId) {
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: payingOnline ? "BOOKING_AWAITING_PAYMENT" : "BOOKING_APPROVED",
        data: {
          bookingNumber: booking.bookingNumber,
          paymentWindowMinutes: String(env.BOOKING_PAYMENT_WINDOW_MINUTES),
        },
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
    await this.refundWalletPaymentIfAny(booking);

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
      // Module 14b — a walk-in is inherently paid at the salon; there's no online-payment UX
      // for it anywhere in the docs. Explicit rather than relying on the ONLINE default.
      paymentMethod: "PAY_AT_SALON",
      selectedStaffId: input.staffId,
      scheduledStart: start,
      scheduledEnd: end,
      totalDurationMinutes,
      effectiveCapacity,
      notes: null,
      services: lines,
      changedByUserId: userId,
      // Module 16 — a walk-in has no customerId, so there's no strikes history to check
      // against; the advance-payment policy simply doesn't apply to it.
      requiresAdvancePayment: false,
      advanceAmount: null,
    });

    // No notification — walk-in customers have no account (customerId is null).
    await scheduleBookingCompletion(booking.id, end.getTime() - Date.now());

    return this.toDTO(booking);
  }

  /**
   * Module 16 — no documented contract existed for this anywhere (context.md flagged the
   * NO_SHOW enum gap itself). Co-defined with the user: owning Salon Owner marks it manually,
   * any time after scheduledStart, on a still-APPROVED booking. Records a NO_SHOW strike
   * against the customer (skipped for a walk-in — no customerId to strike) — see
   * src/modules/strike. Capacity releases naturally (NO_SHOW isn't in
   * CAPACITY_CONSUMING_BOOKING_STATUSES); any already-scheduled completion job safely no-ops
   * (it re-checks the booking is still APPROVED before acting, same as every other delayed
   * job in this codebase).
   */
  async markNoShow(userId: string, bookingId: string): Promise<BookingDTO> {
    const booking = await this.assertOwnedBooking(userId, bookingId);
    if (booking.bookingStatus !== "APPROVED") {
      throw new ConflictError("Only an approved booking can be marked no-show");
    }
    if (booking.scheduledStart.getTime() > Date.now()) {
      throw new BadRequestError("Cannot mark no-show before the scheduled start time");
    }

    const updated = await this.repo.transitionStatus(bookingId, booking.bookingStatus, "NO_SHOW", { noShowAt: new Date() }, userId);

    if (booking.customerId) {
      await this.strikeService.recordNoShow(booking.customerId, bookingId);
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: "BOOKING_NO_SHOW",
        data: { bookingNumber: booking.bookingNumber },
      });
    }

    return this.toDTO(updated);
  }

  // ---- Shared internals ----

  /**
   * Module 16 — the advance deposit on a strikes-restricted booking is non-refundable on
   * cancellation (decided with the user). Module 20 replaces the original coupon-based
   * mechanism (a single-use, customer-restricted coupon minted for the forfeited amount) with a
   * direct wallet credit — same underlying policy ("forfeited, not refunded, but not simply
   * lost either"), simpler delivery: one general-purpose balance instead of a one-off coupon.
   */
  private async forfeitAdvanceToWallet(booking: BookingRow): Promise<void> {
    if (!booking.customerId || !booking.advanceAmount) return;
    const advancePayment = await this.repo.findSuccessfulAdvancePayment(booking.id);
    if (!advancePayment) return; // Advance was never actually paid — nothing to forfeit.

    await this.walletService.creditForfeiture(booking.customerId, advancePayment.amount, booking.id, booking.bookingNumber);
    await this.notificationService.notify({
      userId: booking.customerId,
      eventType: "ADVANCE_PAYMENT_FORFEITED_TO_WALLET",
      data: { bookingNumber: booking.bookingNumber, amount: String(advancePayment.amount) },
    });
  }

  /**
   * Module 20 — a booking paid in full by wallet (paymentMethod: "WALLET") that ends up
   * cancelled or rejected gets that spend refunded back in full (decided with the user) — a
   * plain ledger credit, no gateway involved, unlike ONLINE's payment-refund story which still
   * has no automated path. A booking that expires unconfirmed (booking.expire worker) gets the
   * same treatment — see booking-expiry.worker.ts.
   */
  private async refundWalletPaymentIfAny(booking: BookingRow): Promise<void> {
    if (booking.paymentMethod !== "WALLET" || !booking.customerId) return;
    await this.walletService.refundBookingPayment(booking.customerId, booking.totalAmount, booking.id, booking.bookingNumber);
    await this.notificationService.notify({
      userId: booking.customerId,
      eventType: "BOOKING_PAYMENT_REFUNDED_TO_WALLET",
      data: { bookingNumber: booking.bookingNumber, amount: String(booking.totalAmount) },
    });
  }

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
    lines: BookingServiceLine[],
    customerId: string
  ): Promise<{ couponId: string; couponCode: string; couponType: "FIXED" | "PERCENTAGE"; discountAmount: number }> {
    const coupon = await this.repo.findActiveCouponByCode(couponCode);
    if (!coupon) {
      throw new UnprocessableEntityError("Coupon not found or inactive");
    }
    const subtotalAmount = lines.reduce((sum, l) => sum + l.totalAmount, 0);
    // customerId enforces Module 16's restrictedToCustomerId (forfeiture coupons).
    assertCouponEligible(coupon, subtotalAmount, customerId);
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

  /**
   * Whoever did NOT propose a pending reschedule request is the one who must respond to it —
   * see approveReschedule's doc comment for why this replaces a role-only route gate.
   * `NotFoundError` (not `ForbiddenError`) either way, matching the existing ownership-pattern
   * philosophy of not leaking a resource's existence to a caller who isn't party to it.
   */
  private async assertRescheduleResponder(
    userId: string,
    booking: BookingRow,
    request: { requestedBy: string }
  ): Promise<void> {
    if (request.requestedBy === "SALON") {
      if (booking.customerId !== userId) {
        throw new NotFoundError("Booking not found");
      }
      return;
    }
    await this.salonService.assertOwned(userId, booking.salonId);
  }

  /**
   * Notifies whoever proposed the reschedule (not whoever just responded) that it was
   * resolved. A CUSTOMER-initiated request resolves back to the customer (unchanged
   * behavior); a SALON-initiated one resolves to the owner instead — reuses the existing
   * customer-facing event copy for the former and a dedicated owner-facing pair for the
   * latter (see notification.templates.ts).
   */
  private async notifyRescheduleResolution(
    booking: BookingRow,
    requestedBy: string,
    outcome: "BOOKING_RESCHEDULE_APPROVED" | "BOOKING_RESCHEDULE_REJECTED"
  ): Promise<void> {
    if (requestedBy === "SALON") {
      const ownerUserId = await this.salonService.findOwnerUserId(booking.salonId);
      if (!ownerUserId) return;
      await this.notificationService.notify({
        userId: ownerUserId,
        eventType: outcome === "BOOKING_RESCHEDULE_APPROVED" ? "BOOKING_RESCHEDULE_ACCEPTED_BY_CUSTOMER" : "BOOKING_RESCHEDULE_DECLINED_BY_CUSTOMER",
        data: { bookingNumber: booking.bookingNumber },
      });
      return;
    }
    if (!booking.customerId) return;
    await this.notificationService.notify({
      userId: booking.customerId,
      eventType: outcome,
      data: { bookingNumber: booking.bookingNumber },
    });
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
      paymentMethod: "ONLINE" | "PAY_AT_SALON" | "WALLET";
      selectedStaffId: string | null;
      scheduledStart: Date;
      scheduledEnd: Date;
      totalDurationMinutes: number;
      effectiveCapacity: number;
      notes: string | null;
      services: BookingServiceLine[];
      changedByUserId: string | null;
      coupon?: { couponId: string; couponCode: string; couponType: "FIXED" | "PERCENTAGE"; discountAmount: number };
      requiresAdvancePayment: boolean;
      advanceAmount: number | null;
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
      paymentMethod: booking.paymentMethod,
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
      cancellationReasonCode: booking.cancellationReasonCode,
      approvedAt: booking.approvedAt?.toISOString() ?? null,
      completedAt: booking.completedAt?.toISOString() ?? null,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      expiredAt: booking.expiredAt?.toISOString() ?? null,
      noShowAt: booking.noShowAt?.toISOString() ?? null,
      requiresAdvancePayment: booking.requiresAdvancePayment,
      advanceAmount: booking.advanceAmount,
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
      branchPhone: names?.branchPhone ?? null,
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
