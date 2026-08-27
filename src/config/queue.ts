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

export const QUEUE_NAMES = {
  NOTIFICATION_SEND: "notification:send",
  BOOKING_EXPIRE: "booking:expire",
  BOOKING_CHECKIN_OTP: "booking:checkin-otp",
  PROMOTION_DEACTIVATE: "promotion:deactivate",
  PAYMENT_PROVIDER_EVENT: "payment:provider-event",
  REFUND_PROCESS: "refund:process",
} as const;
