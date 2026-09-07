import { Job, Worker } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";
import { BookingRepository } from "@/modules/booking/booking.repository";
import { NotificationService } from "@/modules/notification/notification.service";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";

const repo = new BookingRepository();
const notificationService = new NotificationService();

async function processExpiry(job: Job<{ bookingId: string }>): Promise<void> {
  const booking = await repo.findById(job.data.bookingId);
  if (!booking || booking.bookingStatus !== "AWAITING_PAYMENT") {
    // Already paid (-> APPROVED) or cancelled by the customer first — safe no-op.
    return;
  }

  await repo.transitionStatus(
    booking.id,
    "AWAITING_PAYMENT",
    "CANCELLED",
    { cancelledAt: new Date(), cancellationReason: "Payment window expired" },
    null,
    `Payment window (${env.BOOKING_PAYMENT_WINDOW_MINUTES} minutes) expired with no successful payment`
  );
  logger.info({ bookingId: booking.id }, "Booking auto-cancelled: payment window expired");

  if (booking.customerId) {
    await notificationService.notify({
      userId: booking.customerId,
      eventType: "BOOKING_PAYMENT_WINDOW_EXPIRED",
      data: { bookingNumber: booking.bookingNumber, paymentWindowMinutes: String(env.BOOKING_PAYMENT_WINDOW_MINUTES) },
    });
  }
}

let worker: Worker | null = null;

export function startPaymentWindowExpiryWorker(): Worker {
  worker = new Worker(QUEUE_NAMES.PAYMENT_WINDOW_EXPIRE, processExpiry, { connection: queueConnection });
  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Payment window expiry job failed");
  });
  return worker;
}

export async function stopPaymentWindowExpiryWorker(): Promise<void> {
  await worker?.close();
}
