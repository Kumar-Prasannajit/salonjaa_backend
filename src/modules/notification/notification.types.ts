// Covers the TRD §11 event list that's actually reachable given what's built: booking
// creation/approval/rejection/expiry/completion, reschedule request/decision/proposal,
// cancellation, and refund request. OTP already has its own delivery path (EmailOtpProvider,
// Module 1) and isn't re-routed through here. Promotion events don't apply — that module
// isn't built.
export type NotificationEventType =
  | "BOOKING_CREATED"
  | "BOOKING_APPROVED"
  // Module 14b — see PROGRESS.md's Module 14b entry (AWAITING_PAYMENT booking status).
  | "BOOKING_AWAITING_PAYMENT"
  | "BOOKING_PAYMENT_WINDOW_EXPIRED"
  | "BOOKING_REJECTED"
  | "BOOKING_EXPIRED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_RESCHEDULE_REQUESTED"
  | "BOOKING_RESCHEDULE_APPROVED"
  | "BOOKING_RESCHEDULE_REJECTED"
  | "BOOKING_RESCHEDULE_PROPOSED"
  // Module 15 — owner-facing counterparts of BOOKING_RESCHEDULE_APPROVED/REJECTED, sent when
  // the CUSTOMER responds to a SALON-proposed reschedule (see BookingService's
  // notifyRescheduleResolution) rather than the other way around.
  | "BOOKING_RESCHEDULE_ACCEPTED_BY_CUSTOMER"
  | "BOOKING_RESCHEDULE_DECLINED_BY_CUSTOMER"
  | "REFUND_REQUESTED"
  | "SALON_VERIFIED"
  | "SALON_REJECTED"
  | "SALON_SUSPENDED"
  | "SALON_REACTIVATED"
  | "REFUND_APPROVED"
  | "REFUND_REJECTED"
  | "COMPLAINT_RESOLVED"
  | "COMPLAINT_REJECTED"
  // Module 16 — customer strikes / advance payment / NO_SHOW.
  | "BOOKING_NO_SHOW"
  | "ADVANCE_PAYMENT_RECEIVED"
  // Module 20 — wallet. Replaces ADVANCE_PAYMENT_FORFEITED_COUPON_ISSUED (Module 16's original
  // forfeiture-coupon mechanism, since replaced by a wallet credit — see WalletService).
  | "ADVANCE_PAYMENT_FORFEITED_TO_WALLET"
  | "BOOKING_PAYMENT_REFUNDED_TO_WALLET"
  // Module 23 — "claim a walk-in" (docs/NEXT_SESSION_PLAN.md item 5a).
  | "BOOKING_CLAIMED";

export interface NotifyInput {
  userId: string;
  eventType: NotificationEventType;
  data: Record<string, string>;
}
