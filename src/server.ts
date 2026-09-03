import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { checkDatabaseConnection, closeDatabaseConnection } from "@/config/database";
import { closeRedisConnection } from "@/config/redis";
import { startBookingExpiryWorker, stopBookingExpiryWorker } from "@/queues/booking-expiry.worker";
import { closeBookingExpiryQueue } from "@/queues/booking-expiry.queue";
import { startBookingCompletionWorker, stopBookingCompletionWorker } from "@/queues/booking-completion.worker";
import { closeBookingCompletionQueue } from "@/queues/booking-completion.queue";
import { startNotificationSendWorker, stopNotificationSendWorker } from "@/queues/notification-send.worker";
import { closeNotificationSendQueue } from "@/queues/notification-send.queue";

async function main(): Promise<void> {
  await checkDatabaseConnection();
  logger.info("Database connection verified");

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Salonjaa backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  startBookingExpiryWorker();
  startBookingCompletionWorker();
  startNotificationSendWorker();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await stopBookingExpiryWorker();
      await closeBookingExpiryQueue();
      await stopBookingCompletionWorker();
      await closeBookingCompletionQueue();
      await stopNotificationSendWorker();
      await closeNotificationSendQueue();
      await closeDatabaseConnection();
      await closeRedisConnection();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
