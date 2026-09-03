import { Queue } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";

interface BookingCompleteJobData {
  bookingId: string;
}

// Not part of the TRD's original job list — added so a booking can ever reach COMPLETED at
// all, since no documented endpoint marks one complete and Reviews require exactly that
// status. Decided with the user: auto-complete when an APPROVED booking's scheduledEnd passes.
export const bookingCompletionQueue = new Queue<BookingCompleteJobData>(QUEUE_NAMES.BOOKING_COMPLETE, {
  connection: queueConnection,
});

function jobIdFor(bookingId: string): string {
  return `complete-${bookingId}`;
}

export async function scheduleBookingCompletion(bookingId: string, delayMs: number): Promise<void> {
  await bookingCompletionQueue.add(
    "complete",
    { bookingId },
    { delay: Math.max(delayMs, 0), jobId: jobIdFor(bookingId), removeOnComplete: true, removeOnFail: true }
  );
}

/** Used when a reschedule changes scheduledEnd — the stale job (at the old time) must not fire early. */
export async function rescheduleBookingCompletion(bookingId: string, delayMs: number): Promise<void> {
  const existing = await bookingCompletionQueue.getJob(jobIdFor(bookingId));
  if (existing) {
    await existing.remove();
  }
  await scheduleBookingCompletion(bookingId, delayMs);
}

export async function closeBookingCompletionQueue(): Promise<void> {
  await bookingCompletionQueue.close();
}
