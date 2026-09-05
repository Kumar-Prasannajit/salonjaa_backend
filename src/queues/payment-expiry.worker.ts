import { Job, Worker } from "bullmq";
import { queueConnection, QUEUE_NAMES } from "@/config/queue";
import { PaymentRepository } from "@/modules/payment/payment.repository";
import { logger } from "@/shared/logger";

const repo = new PaymentRepository();

async function processExpiry(job: Job<{ paymentId: string }>): Promise<void> {
  const payment = await repo.findById(job.data.paymentId);
  if (!payment || payment.status !== "PENDING") {
    // Already verified (SUCCESS/FAILED) or explicitly cancelled by the customer — safe no-op.
    return;
  }

  await repo.updateStatus(payment.id, "FAILED", {});
  await repo.createTransaction({
    paymentId: payment.id,
    provider: payment.provider,
    providerOrderId: payment.providerOrderId,
    status: "FAILED",
  });
  logger.info({ paymentId: payment.id }, "Payment order expired (stale PENDING, verify() never called)");
}

let worker: Worker | null = null;

export function startPaymentExpiryWorker(): Worker {
  worker = new Worker(QUEUE_NAMES.PAYMENT_EXPIRE, processExpiry, { connection: queueConnection });
  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Payment expiry job failed");
  });
  return worker;
}

export async function stopPaymentExpiryWorker(): Promise<void> {
  await worker?.close();
}
