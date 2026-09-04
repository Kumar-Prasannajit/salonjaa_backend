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
};

export function renderNotification(eventType: NotificationEventType, data: Record<string, string>): RenderedNotification {
  return TEMPLATES[eventType](data);
}
