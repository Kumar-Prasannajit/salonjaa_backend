import { Job, Worker } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";
import { NotificationRepository } from "@/modules/notification/notification.repository";
import { notificationChannelProviders } from "@/providers/notification";
import { logger } from "@/shared/logger";

const repo = new NotificationRepository();

async function processSend(job: Job<{ notificationId: string }>): Promise<void> {
  const notification = await repo.findById(job.data.notificationId);
  if (!notification || notification.status !== "PENDING") {
    return; // already delivered/failed or gone — safe no-op
  }

  const provider = notificationChannelProviders[notification.type];
  const to = notification.userId ? await repo.findUserEmail(notification.userId) : null;

  if (!provider || !to) {
    // Nothing will change by retrying (no channel implementation yet, or no destination) —
    // fail immediately rather than burning retry attempts.
    logger.warn(
      { notificationId: notification.id, type: notification.type, hasProvider: !!provider, hasAddress: !!to },
      "Notification cannot be delivered — no channel provider or no destination address"
    );
    await repo.markFailed(notification.id);
    return;
  }

  try {
    await provider.send({ to, subject: notification.subject ?? undefined, message: notification.message });
    await repo.markSent(notification.id);
  } catch (err) {
    const attempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= attempts;
    if (isFinalAttempt) {
      await repo.markFailed(notification.id);
    }
    logger.error({ err, notificationId: notification.id, isFinalAttempt }, "Notification delivery failed");
    throw err; // let BullMQ record/retry the attempt per configured backoff
  }
}

let worker: Worker | null = null;

export function startNotificationSendWorker(): Worker {
  worker = new Worker(QUEUE_NAMES.NOTIFICATION_SEND, processSend, { connection: queueConnection });
  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Notification send job failed");
  });
  return worker;
}

export async function stopNotificationSendWorker(): Promise<void> {
  await worker?.close();
}
