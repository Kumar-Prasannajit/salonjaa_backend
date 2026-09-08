import { z } from "zod";

export const settlementIdParamSchema = z.object({
  id: z.string().uuid("Invalid settlement id"),
});

export const createSettlementSchema = z
  .object({
    salonId: z.string().uuid("Invalid salon id"),
    branchId: z.string().uuid("Invalid branch id").optional(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    grossAmount: z.number().nonnegative(),
    commissionAmount: z.number().nonnegative().optional(),
    refundAmount: z.number().nonnegative().optional(),
    adjustmentAmount: z.number().optional(),
    bookingIds: z.array(z.string().uuid("Invalid booking id")).optional(),
  })
  .refine((v) => new Date(v.periodStart) < new Date(v.periodEnd), { message: "periodStart must be before periodEnd", path: ["periodEnd"] });

export const listSettlementsQuerySchema = z.object({
  salonId: z.string().uuid("Invalid salon id").optional(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED"]).optional(),
});
