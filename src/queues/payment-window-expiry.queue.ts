import { Queue } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";

interface PaymentWindowExpireJobData {
  bookingId: string;
}

export const paymentWindowExpiryQueue = new Queue<PaymentWindowExpireJobData>(QUEUE_NAMES.PAYMENT_WINDOW_EXPIRE, {
  connection: queueConnection,
});

/**
 * Schedules a booking's AWAITING_PAYMENT->CANCELLED transition (Module 14b — see
 * docs/PROGRESS.md's Module 14b entry). Same pattern as scheduleBookingExpiry: not cancelled
 * when payment succeeds first — the worker re-checks the booking is still AWAITING_PAYMENT
 * before acting, so a stale job is always a safe no-op.
 */
export async function schedulePaymentWindowExpiry(bookingId: string, delayMs: number): Promise<void> {
  await paymentWindowExpiryQueue.add(
    "expire",
    { bookingId },
    { delay: delayMs, jobId: `payment-window-expire-${bookingId}`, removeOnComplete: true, removeOnFail: true }
  );
}

export async function closePaymentWindowExpiryQueue(): Promise<void> {
  await paymentWindowExpiryQueue.close();
}
