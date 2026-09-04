import { z } from "zod";

export const refundIdParamSchema = z.object({
  id: z.string().uuid("Invalid refund id"),
});

export const listRefundsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED"]).optional(),
});

export const approveRefundSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const rejectRefundSchema = z.object({
  reason: z.string().trim().min(1, "reason is required").max(500),
});
