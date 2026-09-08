import { Queue } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";

interface PromotionDeactivateJobData {
  promotionId: string;
}

// TRD §10's own job list already named this ("promotion:deactivate" -> QUEUE_NAMES.
// PROMOTION_DEACTIVATE) but it sat unused since queue.ts was first scaffolded — Module 16
// finally gives it a real producer/consumer, same delayed-job shape as booking.expire/
// payment.expire.
export const promotionDeactivateQueue = new Queue<PromotionDeactivateJobData>(QUEUE_NAMES.PROMOTION_DEACTIVATE, {
  connection: queueConnection,
});

function jobIdFor(promotionId: string): string {
  return `deactivate-${promotionId}`;
}

export async function schedulePromotionDeactivation(promotionId: string, delayMs: number): Promise<void> {
  // Re-scheduling (e.g. endsAt changed) removes any existing job first — same
  // rescheduleBookingCompletion precedent — so a stale job never fires at the old time.
  const existing = await promotionDeactivateQueue.getJob(jobIdFor(promotionId));
  if (existing) {
    await existing.remove();
  }
  await promotionDeactivateQueue.add(
    "deactivate",
    { promotionId },
    { delay: Math.max(delayMs, 0), jobId: jobIdFor(promotionId), removeOnComplete: true, removeOnFail: true }
  );
}

export async function closePromotionDeactivateQueue(): Promise<void> {
  await promotionDeactivateQueue.close();
}
