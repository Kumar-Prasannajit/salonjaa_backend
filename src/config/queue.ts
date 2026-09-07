import { ConnectionOptions } from "bullmq";
import { env } from "@/config/env";

/**
 * BullMQ requires its own ioredis-compatible connection config (not a shared client
 * instance) so blocking commands used by workers don't collide with app Redis usage.
 */
export const queueConnection: ConnectionOptions = {
  host: new URL(env.REDIS_URL).hostname,
  port: Number(new URL(env.REDIS_URL).port || 6379),
  maxRetriesPerRequest: null,
};

// BullMQ v5 rejects ":" in queue names (reserved as its own Redis key separator) — use "."
// instead of the TRD's illustrative "module:action" notation.
export const QUEUE_NAMES = {
  NOTIFICATION_SEND: "notification.send",
  BOOKING_EXPIRE: "booking.expire",
  // Not in the TRD's original job list — added so Reviews (which require a COMPLETED
  // booking, per frontend_handover.md) have a way to ever reach that state, since no
  // documented endpoint marks a booking complete. Decided with the user.
  BOOKING_COMPLETE: "booking.complete",
  BOOKING_CHECKIN_OTP: "booking.checkin-otp",
  PROMOTION_DEACTIVATE: "promotion.deactivate",
  PAYMENT_PROVIDER_EVENT: "payment.provider-event",
  REFUND_PROCESS: "refund.process",
  // Not in the TRD's original job list — added (Module 13) so a payment left PENDING forever
  // (Razorpay widget closed without completing, no webhook) doesn't permanently block
  // create-order's "only a FAILED payment can be retried" rule. Same delayed-job mechanism as
  // BOOKING_EXPIRE.
  PAYMENT_EXPIRE: "payment.expire",
  // Module 14b — the client's "approve then 15-minute payment window" rule. Not in the TRD's
  // original job list, same "add when a real gap needs it" precedent as BOOKING_COMPLETE/
  // PAYMENT_EXPIRE. Auto-cancels a booking still AWAITING_PAYMENT once the window lapses.
  PAYMENT_WINDOW_EXPIRE: "payment-window.expire",
} as const;
