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
  | "REFUND_REQUESTED"
  | "SALON_VERIFIED"
  | "SALON_REJECTED"
  | "SALON_SUSPENDED"
  | "SALON_REACTIVATED"
  | "REFUND_APPROVED"
  | "REFUND_REJECTED"
  | "COMPLAINT_RESOLVED"
  | "COMPLAINT_REJECTED";

export interface NotifyInput {
  userId: string;
  eventType: NotificationEventType;
  data: Record<string, string>;
}
