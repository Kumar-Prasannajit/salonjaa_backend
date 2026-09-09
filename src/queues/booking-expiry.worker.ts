import { Job, Worker } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";
import { BookingRepository } from "@/modules/booking/booking.repository";
import { NotificationService } from "@/modules/notification/notification.service";
import { WalletService } from "@/modules/wallet/wallet.service";
import { logger } from "@/shared/logger";

const repo = new BookingRepository();
const notificationService = new NotificationService();
const walletService = new WalletService();

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

  // Module 20 — a WALLET-paid booking that expires unconfirmed gets that spend refunded back
  // in full, same treatment as cancel()/reject() — see BookingService.refundWalletPaymentIfAny
  // (duplicated here rather than shared since this worker has no BookingService instance).
  if (booking.paymentMethod === "WALLET" && booking.customerId) {
    await walletService.refundBookingPayment(booking.customerId, booking.totalAmount, booking.id, booking.bookingNumber);
    await notificationService.notify({
      userId: booking.customerId,
      eventType: "BOOKING_PAYMENT_REFUNDED_TO_WALLET",
      data: { bookingNumber: booking.bookingNumber, amount: String(booking.totalAmount) },
    });
  }

  if (booking.customerId) {
    await notificationService.notify({
      userId: booking.customerId,
      eventType: "BOOKING_EXPIRED",
      data: { bookingNumber: booking.bookingNumber },
    });
  }
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
