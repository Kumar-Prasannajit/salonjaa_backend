import { z } from "zod";

export const fileComplaintSchema = z.object({
  type: z.enum(["BOOKING", "PAYMENT", "SALON", "STAFF", "REFUND", "OTHER"]),
  referenceId: z.string().uuid("Invalid reference id").optional(),
  description: z.string().trim().min(1, "description is required").max(2000),
});
