import { afterAll } from "vitest";
import { closeDatabaseConnection } from "@/config/database";
import { closeRedisConnection } from "@/config/redis";
import { closeBookingExpiryQueue } from "@/queues/booking-expiry.queue";
import { closeBookingCompletionQueue } from "@/queues/booking-completion.queue";
import { closeNotificationSendQueue } from "@/queues/notification-send.queue";
import { closePaymentExpiryQueue } from "@/queues/payment-expiry.queue";
import { closePaymentWindowExpiryQueue } from "@/queues/payment-window-expiry.queue";
import { closePromotionDeactivateQueue } from "@/queues/promotion-deactivate.queue";

// Runs once per test file (vitest.config.ts's fileParallelism:false keeps files sequential,
// so this doesn't fight over the shared test DB/Redis-db-1 with another file's run).
afterAll(async () => {
  await Promise.all([
    closeBookingExpiryQueue(),
    closeBookingCompletionQueue(),
    closeNotificationSendQueue(),
    closePaymentExpiryQueue(),
    closePaymentWindowExpiryQueue(),
    closePromotionDeactivateQueue(),
  ]);
  await closeRedisConnection();
  await closeDatabaseConnection();
});
