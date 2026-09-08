import { PaymentRepository } from "@/modules/payment/payment.repository";
import { BookingRepository } from "@/modules/booking/booking.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { NotificationService } from "@/modules/notification/notification.service";
import {
  CreateOrderInput,
  PaymentDTO,
  RefundDTO,
  RefundRequestInput,
  SettlementDTO,
  ValidateCouponInput,
  VerifyPaymentInput,
} from "@/modules/payment/payment.types";
import { paymentProvider } from "@/providers/payment";
import { BadRequestError, ConflictError, NotFoundError, UnprocessableEntityError } from "@/shared/errors";
import { assertCouponEligible, computeCouponDiscount } from "@/shared/coupon";
import { ROLE_NAMES } from "@/shared/constants";
import { env } from "@/config/env";
import { schedulePaymentExpiry } from "@/queues/payment-expiry.queue";
import { scheduleBookingCompletion } from "@/queues/booking-completion.queue";
import { payments, refunds, settlements } from "@/db/schema";

type PaymentRow = typeof payments.$inferSelect;
type RefundRow = typeof refunds.$inferSelect;
type SettlementRow = typeof settlements.$inferSelect;

// PROVISIONAL — see requestRefund() below for why these two statuses and nothing more.
const REFUND_ELIGIBLE_BOOKING_STATUSES = ["CANCELLED", "COMPLETED"];

export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository = new PaymentRepository(),
    private readonly bookingRepo: BookingRepository = new BookingRepository(),
    private readonly salonService: SalonService = new SalonService(),
    private readonly notificationService: NotificationService = new NotificationService()
  ) {}

  async createOrder(userId: string, input: CreateOrderInput): Promise<{ orderId: string; amount: number; currency: string }> {
    const booking = await this.bookingRepo.findById(input.bookingId);
    if (!booking || booking.customerId !== userId) {
      throw new NotFoundError("Booking not found");
    }

    // Module 16 — a restricted customer's PAY_AT_SALON booking needs its advance settled
    // before the salon can even review it, independent of the normal AWAITING_PAYMENT flow
    // below (which this booking's paymentMethod never enters — the remainder is still paid
    // at the salon). Checked first since it applies to a still-PENDING booking.
    if (booking.requiresAdvancePayment) {
      const alreadyPaid = await this.bookingRepo.findSuccessfulAdvancePayment(booking.id);
      if (!alreadyPaid) {
        return this.createAdvanceOrder(userId, booking);
      }
      // Advance already paid — fall through. The booking's own paymentMethod (PAY_AT_SALON)
      // never reaches AWAITING_PAYMENT, so the check below correctly rejects a redundant call.
    }

    // Module 14b — payment can now only be created during the booking's AWAITING_PAYMENT
    // window (salon approved an ONLINE booking, payment due within
    // BOOKING_PAYMENT_WINDOW_MINUTES). A PAY_AT_SALON booking never enters AWAITING_PAYMENT,
    // so it correctly can never reach here either — nothing to pay online. See PROGRESS.md's
    // Module 14b entry.
    if (booking.bookingStatus !== "AWAITING_PAYMENT") {
      throw new ConflictError("Booking must be awaiting payment before an order can be created");
    }

    const existing = await this.repo.findActivePaymentForBooking(booking.id, "FULL");
    if (existing) {
      throw new ConflictError("A payment already exists for this booking");
    }

    const order = await paymentProvider.createOrder(booking.totalAmount, "INR", booking.id);

    const payment = await this.repo.createPayment({
      bookingId: booking.id,
      customerId: userId,
      method: "ONLINE",
      purpose: "FULL",
      provider: "RAZORPAY",
      providerOrderId: order.orderId,
      amount: booking.totalAmount,
      currency: "INR",
      status: "PENDING",
    });

    await this.repo.createTransaction({
      paymentId: payment.id,
      provider: "RAZORPAY",
      providerOrderId: order.orderId,
      status: "PENDING",
    });

    // Module 13 — without this, a customer who closes the Razorpay widget without completing
    // (no webhook ever tells us) leaves this payment PENDING forever, and create-order's
    // "only a FAILED payment can be retried" rule permanently blocks a retry. See
    // cancelPendingPayment() below for the immediate/explicit counterpart to this backstop.
    await schedulePaymentExpiry(payment.id, env.PAYMENT_ORDER_EXPIRY_MINUTES * 60 * 1000);

    return { orderId: order.orderId, amount: order.amount, currency: order.currency };
  }

  /**
   * Module 16 — the advance-payment counterpart to the FULL flow above, reusing the same
   * Razorpay order + PENDING-payment + expiry-job shape. Fires while the booking is still
   * PENDING (before the owner can approve it) rather than at AWAITING_PAYMENT, since a
   * PAY_AT_SALON booking never reaches that status — only the advance amount is collected
   * online here, the remainder stays pay-at-salon as normal.
   */
  private async createAdvanceOrder(
    userId: string,
    booking: { id: string; bookingStatus: string; advanceAmount: number | null }
  ): Promise<{ orderId: string; amount: number; currency: string }> {
    if (booking.bookingStatus !== "PENDING") {
      throw new ConflictError("Advance payment window has passed for this booking");
    }
    if (booking.advanceAmount === null) {
      throw new ConflictError("This booking has no advance amount set");
    }
    const existing = await this.repo.findActivePaymentForBooking(booking.id, "ADVANCE");
    if (existing) {
      throw new ConflictError("An advance payment already exists for this booking");
    }

    const order = await paymentProvider.createOrder(booking.advanceAmount, "INR", booking.id);

    const payment = await this.repo.createPayment({
      bookingId: booking.id,
      customerId: userId,
      method: "ONLINE",
      purpose: "ADVANCE",
      provider: "RAZORPAY",
      providerOrderId: order.orderId,
      amount: booking.advanceAmount,
      currency: "INR",
      status: "PENDING",
    });

    await this.repo.createTransaction({
      paymentId: payment.id,
      provider: "RAZORPAY",
      providerOrderId: order.orderId,
      status: "PENDING",
    });

    await schedulePaymentExpiry(payment.id, env.PAYMENT_ORDER_EXPIRY_MINUTES * 60 * 1000);

    return { orderId: order.orderId, amount: order.amount, currency: order.currency };
  }

  async verifyPayment(userId: string, input: VerifyPaymentInput): Promise<{ success: true; paymentStatus: string }> {
    const payment = await this.repo.findByProviderOrderId(input.orderId);
    if (!payment || payment.customerId !== userId) {
      throw new NotFoundError("Payment not found");
    }
    if (payment.status === "SUCCESS") {
      // Idempotent: client retried verify after already succeeding.
      return { success: true, paymentStatus: "SUCCESS" };
    }

    const isValid = paymentProvider.verifySignature(input.orderId, input.paymentId, input.signature);
    const newStatus = isValid ? "SUCCESS" : "FAILED";

    await this.repo.updateStatus(payment.id, newStatus, {
      providerPaymentId: input.paymentId,
      paidAt: isValid ? new Date() : null,
    });
    await this.repo.createTransaction({
      paymentId: payment.id,
      provider: "RAZORPAY",
      providerOrderId: input.orderId,
      providerTransactionId: input.paymentId,
      signature: input.signature,
      status: newStatus,
    });

    if (!isValid) {
      throw new BadRequestError("Payment signature verification failed");
    }

    // Module 14b — this is the moment an ONLINE booking actually becomes confirmed: the
    // payment window ends here, not at approve() (see BookingService.approve). The
    // AWAITING_PAYMENT->CANCELLED expiry job (schedulePaymentWindowExpiry) is left running
    // rather than explicitly cancelled — same "stale job is a safe no-op" precedent as every
    // other delayed job in this codebase; it re-checks the booking is still AWAITING_PAYMENT
    // before acting, so it's now a no-op once this transition lands.
    const booking = await this.bookingRepo.findById(payment.bookingId);
    if (booking && booking.bookingStatus === "AWAITING_PAYMENT") {
      await this.bookingRepo.transitionStatus(
        booking.id,
        "AWAITING_PAYMENT",
        "APPROVED",
        {},
        booking.customerId,
        "Payment received"
      );
      await scheduleBookingCompletion(booking.id, booking.scheduledEnd.getTime() - Date.now());
      if (booking.customerId) {
        await this.notificationService.notify({
          userId: booking.customerId,
          eventType: "BOOKING_APPROVED",
          data: { bookingNumber: booking.bookingNumber },
        });
      }
    } else if (booking && payment.purpose === "ADVANCE" && booking.customerId) {
      // Module 16 — an ADVANCE payment doesn't move the booking's status (it stays PENDING,
      // same as before this payment — the owner still reviews it normally); just let the
      // customer know the deposit went through.
      await this.notificationService.notify({
        userId: booking.customerId,
        eventType: "ADVANCE_PAYMENT_RECEIVED",
        data: { bookingNumber: booking.bookingNumber, amount: String(payment.amount) },
      });
    }

    return { success: true, paymentStatus: "SUCCESS" };
  }

  /**
   * Module 13's second, immediate half of the "stale PENDING payment" fix — the explicit
   * counterpart to the automatic expiry job scheduled in createOrder(). Lets the frontend's
   * Razorpay `ondismiss` handler (checkout widget closed without completing) cancel the
   * attempt right away rather than waiting out PAYMENT_ORDER_EXPIRY_MINUTES, so create-order
   * becomes retryable immediately.
   */
  async cancelPendingPayment(userId: string, paymentId: string): Promise<PaymentDTO> {
    const payment = await this.repo.findById(paymentId);
    if (!payment || payment.customerId !== userId) {
      throw new NotFoundError("Payment not found");
    }
    if (payment.status !== "PENDING") {
      throw new ConflictError("Only a pending payment can be cancelled");
    }

    const updated = await this.repo.updateStatus(payment.id, "FAILED", {});
    await this.repo.createTransaction({
      paymentId: payment.id,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId,
      status: "FAILED",
    });

    return this.toPaymentDTO(updated);
  }

  async getDetail(userId: string, roles: string[], paymentId: string): Promise<PaymentDTO> {
    const payment = await this.repo.findById(paymentId);
    if (!payment) {
      throw new NotFoundError("Payment not found");
    }
    const isOwner = payment.customerId === userId;
    const isAdmin = roles.includes(ROLE_NAMES.ADMIN);
    if (!isOwner && !isAdmin) {
      const booking = await this.bookingRepo.findById(payment.bookingId);
      if (!booking) {
        throw new NotFoundError("Payment not found");
      }
      await this.salonService.assertOwned(userId, booking.salonId);
    }
    return this.toPaymentDTO(payment);
  }

  async listMyPayments(userId: string): Promise<PaymentDTO[]> {
    const rows = await this.repo.listByCustomer(userId);
    return rows.map((r) => this.toPaymentDTO(r));
  }

  /**
   * PROVISIONAL refund-eligibility policy — no cutoff/percentage rule, matches the same
   * placeholder treatment as booking cancellation (context.md Pending Decisions covers both
   * under "booking cancellation/refund eligibility policy"). Explicitly flagged; the user
   * asked to ship this now and add the real policy later.
   */
  async requestRefund(userId: string, input: RefundRequestInput): Promise<RefundDTO> {
    const booking = await this.bookingRepo.findById(input.bookingId);
    if (!booking || booking.customerId !== userId) {
      throw new NotFoundError("Booking not found");
    }
    if (!REFUND_ELIGIBLE_BOOKING_STATUSES.includes(booking.bookingStatus)) {
      throw new ConflictError("Booking is not eligible for a refund in its current state");
    }

    const payment = await this.repo.findSuccessfulPaymentForBooking(booking.id);
    if (!payment) {
      throw new ConflictError("No successful payment found for this booking");
    }

    const existingRefund = await this.repo.findRefundForPayment(payment.id);
    if (existingRefund) {
      throw new ConflictError("A refund has already been requested for this payment");
    }

    const refund = await this.repo.createRefund({
      bookingId: booking.id,
      paymentId: payment.id,
      customerId: userId,
      amount: payment.amount,
      reason: input.reason,
    });

    await this.notificationService.notify({
      userId,
      eventType: "REFUND_REQUESTED",
      data: { bookingNumber: booking.bookingNumber, amount: String(refund.amount) },
    });

    return this.toRefundDTO(refund);
  }

  async listMyRefunds(userId: string): Promise<RefundDTO[]> {
    const rows = await this.repo.listRefundsByCustomer(userId);
    return rows.map((r) => this.toRefundDTO(r));
  }

  async listSalonSettlements(userId: string): Promise<SettlementDTO[]> {
    const salons = await this.salonService.listMySalons(userId);
    const rows = await this.repo.listSettlementsBySalonIds(salons.map((s) => s.id));
    return rows.map((r) => this.toSettlementDTO(r));
  }

  /**
   * Pure preview check, no side effects — no documented endpoint ever attaches a coupon to a
   * booking (POST /bookings has no couponCode field), so usage isn't recorded here.
   */
  async validateCoupon(input: ValidateCouponInput, customerId: string): Promise<{ valid: true; discount: number }> {
    const coupon = await this.repo.findActiveCouponByCode(input.couponCode);
    if (!coupon) {
      throw new UnprocessableEntityError("Coupon not found or inactive");
    }
    // Shared with BookingService's coupon attach (Module 12) — see src/shared/coupon.ts.
    // customerId enforces Module 16's restrictedToCustomerId (forfeiture coupons).
    assertCouponEligible(coupon, input.bookingAmount, customerId);
    const discount = computeCouponDiscount(coupon, input.bookingAmount);
    return { valid: true, discount };
  }

  private toPaymentDTO(payment: PaymentRow): PaymentDTO {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      customerId: payment.customerId,
      method: payment.method,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId,
      providerPaymentId: payment.providerPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private toRefundDTO(refund: RefundRow): RefundDTO {
    return {
      id: refund.id,
      bookingId: refund.bookingId,
      paymentId: refund.paymentId,
      customerId: refund.customerId,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      processedAt: refund.processedAt?.toISOString() ?? null,
      createdAt: refund.createdAt.toISOString(),
    };
  }

  private toSettlementDTO(settlement: SettlementRow): SettlementDTO {
    return {
      id: settlement.id,
      salonId: settlement.salonId,
      branchId: settlement.branchId,
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      grossAmount: settlement.grossAmount,
      commissionAmount: settlement.commissionAmount,
      refundAmount: settlement.refundAmount,
      adjustmentAmount: settlement.adjustmentAmount,
      netAmount: settlement.netAmount,
      status: settlement.status,
      settledAt: settlement.settledAt?.toISOString() ?? null,
    };
  }
}
