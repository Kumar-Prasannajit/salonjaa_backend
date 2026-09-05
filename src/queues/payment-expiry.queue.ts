import { Queue } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";

interface PaymentExpireJobData {
  paymentId: string;
}

export const paymentExpiryQueue = new Queue<PaymentExpireJobData>(QUEUE_NAMES.PAYMENT_EXPIRE, {
  connection: queueConnection,
});

/**
 * Schedules a payment's PENDING->FAILED transition (Module 13 — see docs/PROGRESS.md's
 * "payment left open in the widget can never be retried" note). Same pattern as
 * scheduleBookingExpiry: not cancelled when verify() succeeds/fails first — the worker
 * re-checks the payment is still PENDING before acting, so a stale job is always a safe
 * no-op.
 */
export async function schedulePaymentExpiry(paymentId: string, delayMs: number): Promise<void> {
  await paymentExpiryQueue.add(
    "expire",
    { paymentId },
    { delay: delayMs, jobId: `expire-payment-${paymentId}`, removeOnComplete: true, removeOnFail: true }
  );
}

export async function closePaymentExpiryQueue(): Promise<void> {
  await paymentExpiryQueue.close();
}
