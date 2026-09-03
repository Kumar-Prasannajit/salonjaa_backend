import { Queue } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";

interface BookingExpireJobData {
  bookingId: string;
}

export const bookingExpiryQueue = new Queue<BookingExpireJobData>(QUEUE_NAMES.BOOKING_EXPIRE, {
  connection: queueConnection,
});

/**
 * Schedules a booking's PENDING->EXPIRED transition. Deliberately not cancelled when a
 * booking is approved/rejected/cancelled first — the worker re-checks the booking is still
 * PENDING before acting, so a stale job is always a safe no-op. Simpler than tracking job
 * IDs to remove, for MVP scope.
 */
export async function scheduleBookingExpiry(bookingId: string, delayMs: number): Promise<void> {
  await bookingExpiryQueue.add(
    "expire",
    { bookingId },
    { delay: delayMs, jobId: `expire-${bookingId}`, removeOnComplete: true, removeOnFail: true }
  );
}

export async function closeBookingExpiryQueue(): Promise<void> {
  await bookingExpiryQueue.close();
}
