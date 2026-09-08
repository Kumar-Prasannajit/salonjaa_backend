import { z } from "zod";

export const couponIdParamSchema = z.object({
  id: z.string().uuid("Invalid coupon id"),
});

export const createCouponSchema = z.object({
  couponCode: z.string().trim().min(1, "couponCode is required").max(50),
  type: z.enum(["FIXED", "PERCENTAGE"]),
  value: z.number().positive(),
  minimumAmount: z.number().nonnegative().optional(),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateCouponSchema = z.object({
  type: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  value: z.number().positive().optional(),
  minimumAmount: z.number().nonnegative().optional(),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});
