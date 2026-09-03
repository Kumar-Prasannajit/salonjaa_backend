import { Job, Worker } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";
import { BookingRepository } from "@/modules/booking/booking.repository";
import { NotificationService } from "@/modules/notification/notification.service";
import { logger } from "@/shared/logger";

const repo = new BookingRepository();
const notificationService = new NotificationService();

async function processCompletion(job: Job<{ bookingId: string }>): Promise<void> {
  const booking = await repo.findById(job.data.bookingId);
  if (!booking || booking.bookingStatus !== "APPROVED") {
    // Already cancelled/rejected/etc, or rescheduled (in which case a fresh job replaced this
    // one) — safe no-op either way.
    return;
  }

  await repo.transitionStatus(booking.id, "APPROVED", "COMPLETED", { completedAt: new Date() }, null, "Auto-completed: scheduled end time passed");
  logger.info({ bookingId: booking.id }, "Booking auto-completed");

  if (booking.customerId) {
    await notificationService.notify({
      userId: booking.customerId,
      eventType: "BOOKING_COMPLETED",
      data: { bookingNumber: booking.bookingNumber },
    });
  }
}

let worker: Worker | null = null;

export function startBookingCompletionWorker(): Worker {
  worker = new Worker(QUEUE_NAMES.BOOKING_COMPLETE, processCompletion, { connection: queueConnection });
  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Booking completion job failed");
  });
  return worker;
}

export async function stopBookingCompletionWorker(): Promise<void> {
  await worker?.close();
}
