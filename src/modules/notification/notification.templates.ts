import { NotificationEventType } from "@/modules/notification/notification.types";

interface RenderedNotification {
  subject: string;
  body: string;
}

// Hardcoded, same style as EmailOtpProvider's OTP_SUBJECT map (Module 1) — notification_templates
// stays schema-only/no-consumer for now (per docs/PROGRESS.md, unchanged since Module 1),
// consistent with the one delivery path this codebase already has.
const TEMPLATES: Record<NotificationEventType, (data: Record<string, string>) => RenderedNotification> = {
  BOOKING_CREATED: (d) => ({
    subject: "Your Salonjaa booking is pending approval",
    body: `Your booking ${d.bookingNumber} is pending approval from the salon.`,
  }),
  BOOKING_APPROVED: (d) => ({
    subject: "Your Salonjaa booking is confirmed",
    body: `Your booking ${d.bookingNumber} has been approved.`,
  }),
  BOOKING_AWAITING_PAYMENT: (d) => ({
    subject: "Your Salonjaa booking is approved — pay to confirm",
    body: `Your booking ${d.bookingNumber} has been approved. Complete payment within ${d.paymentWindowMinutes} minutes to confirm it, or the booking will be automatically cancelled.`,
  }),
  BOOKING_PAYMENT_WINDOW_EXPIRED: (d) => ({
    subject: "Your Salonjaa booking was cancelled — payment window expired",
    body: `Your booking ${d.bookingNumber} was automatically cancelled because payment wasn't completed within the ${d.paymentWindowMinutes}-minute window.`,
  }),
  BOOKING_REJECTED: (d) => ({
    subject: "Your Salonjaa booking was declined",
    body: `Your booking ${d.bookingNumber} was declined by the salon. Reason: ${d.reason ?? "Not specified"}.`,
  }),
  BOOKING_EXPIRED: (d) => ({
    subject: "Your Salonjaa booking request expired",
    body: `Your booking ${d.bookingNumber} expired because the salon did not respond in time.`,
  }),
  BOOKING_CANCELLED: (d) => ({
    subject: "A Salonjaa booking was cancelled",
    body: `Booking ${d.bookingNumber} was cancelled by the customer. Reason: ${d.reason ?? "Not specified"}.`,
  }),
  BOOKING_COMPLETED: (d) => ({
    subject: "Your Salonjaa appointment is complete",
    body: `Your booking ${d.bookingNumber} is now marked complete. We'd love your feedback!`,
  }),
  BOOKING_RESCHEDULE_REQUESTED: (d) => ({
    subject: "A reschedule was requested for a Salonjaa booking",
    body: `A reschedule was requested for booking ${d.bookingNumber}.`,
  }),
  BOOKING_RESCHEDULE_APPROVED: (d) => ({
    subject: "Your Salonjaa reschedule request was approved",
    body: `Your booking ${d.bookingNumber} has been rescheduled.`,
  }),
  BOOKING_RESCHEDULE_REJECTED: (d) => ({
    subject: "Your Salonjaa reschedule request was declined",
    body: `Your reschedule request for booking ${d.bookingNumber} was declined.`,
  }),
  BOOKING_RESCHEDULE_PROPOSED: (d) => ({
    subject: "The salon proposed a new time for your Salonjaa booking",
    body: `The salon proposed a new time for booking ${d.bookingNumber}. Review it in the app.`,
  }),
  BOOKING_RESCHEDULE_ACCEPTED_BY_CUSTOMER: (d) => ({
    subject: "Your proposed reschedule was accepted",
    body: `The customer accepted your proposed new time for booking ${d.bookingNumber}.`,
  }),
  BOOKING_RESCHEDULE_DECLINED_BY_CUSTOMER: (d) => ({
    subject: "Your proposed reschedule was declined",
    body: `The customer declined your proposed new time for booking ${d.bookingNumber}.`,
  }),
  REFUND_REQUESTED: (d) => ({
    subject: "Your Salonjaa refund request was received",
    body: `Your refund request for booking ${d.bookingNumber} (amount ${d.amount}) has been received and is pending review.`,
  }),
  SALON_VERIFIED: (d) => ({
    subject: "Your Salonjaa salon is now verified",
    body: `${d.salonName} has been verified and is now visible to customers.`,
  }),
  SALON_REJECTED: (d) => ({
    subject: "Your Salonjaa salon registration was declined",
    body: `${d.salonName}'s registration was declined. Reason: ${d.reason ?? "Not specified"}.`,
  }),
  SALON_SUSPENDED: (d) => ({
    subject: "Your Salonjaa salon has been suspended",
    body: `${d.salonName} has been suspended. Reason: ${d.reason ?? "Not specified"}. Contact support for details.`,
  }),
  SALON_REACTIVATED: (d) => ({
    subject: "Your Salonjaa salon is active again",
    body: `${d.salonName} has been reactivated and is visible to customers again.`,
  }),
  REFUND_APPROVED: (d) => ({
    subject: "Your Salonjaa refund was approved",
    body: `Your refund request for booking ${d.bookingNumber} (amount ${d.amount}) has been approved.`,
  }),
  REFUND_REJECTED: (d) => ({
    subject: "Your Salonjaa refund request was declined",
    body: `Your refund request for booking ${d.bookingNumber} was declined. Reason: ${d.reason ?? "Not specified"}.`,
  }),
  COMPLAINT_RESOLVED: (d) => ({
    subject: "Your Salonjaa complaint has been resolved",
    body: `Your complaint has been resolved. Notes: ${d.resolutionNotes ?? "Not specified"}.`,
  }),
  COMPLAINT_REJECTED: (d) => ({
    subject: "Your Salonjaa complaint was reviewed",
    body: `Your complaint was reviewed and rejected. Reason: ${d.reason ?? "Not specified"}.`,
  }),
  BOOKING_NO_SHOW: (d) => ({
    subject: "You were marked a no-show for a Salonjaa booking",
    body: `You were marked as a no-show for booking ${d.bookingNumber}. Repeated no-shows require an advance payment on future bookings.`,
  }),
  ADVANCE_PAYMENT_RECEIVED: (d) => ({
    subject: "Your Salonjaa advance payment was received",
    body: `Your advance payment of ${d.amount} for booking ${d.bookingNumber} was received. The salon will review your booking shortly.`,
  }),
  ADVANCE_PAYMENT_FORFEITED_COUPON_ISSUED: (d) => ({
    subject: "Your advance payment was converted to a coupon",
    body: `Your advance payment for booking ${d.bookingNumber} is non-refundable, so we've converted it into a coupon (code ${d.couponCode}, worth ${d.amount}) you can use on a future booking.`,
  }),
};

export function renderNotification(eventType: NotificationEventType, data: Record<string, string>): RenderedNotification {
  return TEMPLATES[eventType](data);
}
