import { z } from "zod";

export const salonIdParamSchema = z.object({
  salonId: z.string().uuid("Invalid salon id"),
});

export const listSalonsQuerySchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});

export const rejectSalonSchema = z.object({
  reason: z.string().trim().min(1, "reason is required").max(500),
});

export const suspendSalonSchema = z.object({
  reason: z.string().trim().min(1, "reason is required").max(500),
});
