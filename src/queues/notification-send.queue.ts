import { Queue } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";

interface NotificationSendJobData {
  notificationId: string;
}

export const notificationSendQueue = new Queue<NotificationSendJobData>(QUEUE_NAMES.NOTIFICATION_SEND, {
  connection: queueConnection,
});

/** TRD §10: "exponential retries for provider failures; persist each result in notifications; dead-letter after configured attempts." */
export async function scheduleNotificationDelivery(notificationId: string): Promise<void> {
  await notificationSendQueue.add(
    "send",
    { notificationId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

export async function closeNotificationSendQueue(): Promise<void> {
  await notificationSendQueue.close();
}
