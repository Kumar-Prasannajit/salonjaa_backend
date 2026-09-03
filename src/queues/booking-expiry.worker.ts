import { Job, Worker } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";
import { BookingRepository } from "@/modules/booking/booking.repository";
import { logger } from "@/shared/logger";

const repo = new BookingRepository();

async function processExpiry(job: Job<{ bookingId: string }>): Promise<void> {
  const booking = await repo.findById(job.data.bookingId);
  if (!booking || booking.bookingStatus !== "PENDING") {
    // Already approved/rejected/cancelled by the time this fired — safe no-op.
    return;
  }

  await repo.transitionStatus(
    booking.id,
    "PENDING",
    "EXPIRED",
    { expiredAt: new Date() },
    null,
    "Booking expired: no owner decision within the configured window"
  );
  logger.info({ bookingId: booking.id }, "Booking expired");
}

let worker: Worker | null = null;

export function startBookingExpiryWorker(): Worker {
  worker = new Worker(QUEUE_NAMES.BOOKING_EXPIRE, processExpiry, { connection: queueConnection });
  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Booking expiry job failed");
  });
  return worker;
}

export async function stopBookingExpiryWorker(): Promise<void> {
  await worker?.close();
}
