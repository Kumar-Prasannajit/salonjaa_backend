import { z } from "zod";

// Not specified anywhere in frontend_handover.md — comma-separated is the chosen convention
// for this array-shaped query param (e.g. ?serviceIds=id1,id2). Documented in PROGRESS.md.
const serviceIdsSchema = z
  .string()
  .min(1, "serviceIds is required")
  .transform((val) =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.string().uuid("Invalid service id")).min(1, "At least one service is required"));

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((val) => !Number.isNaN(Date.parse(val)), "date must be a valid date")
  .refine((val) => new Date(val).getTime() >= Date.now() - 24 * 60 * 60 * 1000, "date must not be in the past");

export const availabilityQuerySchema = z.object({
  branchId: z.string().uuid("Invalid branch id"),
  date: dateSchema,
  serviceIds: serviceIdsSchema,
});
