import { z } from "zod";

export const customerIdParamSchema = z.object({
  customerId: z.string().uuid("Invalid customer id"),
});

export const strikeIdParamSchema = z.object({
  customerId: z.string().uuid("Invalid customer id"),
  strikeId: z.string().uuid("Invalid strike id"),
});

export const addStrikeSchema = z.object({
  type: z.enum(["FAKE_BOOKING", "NO_SHOW", "ABUSIVE_CANCELLATION"]),
  bookingId: z.string().uuid("Invalid booking id").optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const removeStrikeSchema = z.object({
  reason: z.string().trim().min(1, "reason is required").max(500),
});
