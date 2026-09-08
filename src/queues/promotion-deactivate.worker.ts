import { Job, Worker } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";
import { PromotionRepository } from "@/modules/promotion/promotion.repository";
import { logger } from "@/shared/logger";

const repo = new PromotionRepository();

async function processDeactivation(job: Job<{ promotionId: string }>): Promise<void> {
  const promotion = await repo.findById(job.data.promotionId);
  if (!promotion || !promotion.active) {
    // Already deactivated/deleted, or endsAt changed (a fresh job replaced this one) — safe no-op.
    return;
  }
  await repo.deactivate(promotion.id);
  logger.info({ promotionId: promotion.id }, "Promotion auto-deactivated");
}

let worker: Worker | null = null;

export function startPromotionDeactivateWorker(): Worker {
  worker = new Worker(QUEUE_NAMES.PROMOTION_DEACTIVATE, processDeactivation, { connection: queueConnection });
  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Promotion deactivation job failed");
  });
  return worker;
}

export async function stopPromotionDeactivateWorker(): Promise<void> {
  await worker?.close();
}
